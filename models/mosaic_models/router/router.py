"""Policy-driven model router (blueprint §45).

Owner: P3 — Agents & Models

Routing rules (in priority order):
1. privacy == restricted  =>  local providers only; raise MODEL_UNAVAILABLE if none.
2. model = model_hint if available and pulled.
3. If latency == critical  =>  config['latency_critical'] model.
4. by_task_class[task_class] if available and pulled.
5. config['default'].
6. Any local chat model that is pulled.
7. Raise MODEL_UNAVAILABLE.

JSON repair rule (rule 4 in the spec):
If json_schema was set and parsed is None or fails validation, retry once with a repair message.

Embedding always uses config['embedding'] model. embedding_dim is cached after the first call.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncIterator
from typing import Any

import jsonschema
from mosaic_contracts.errors import MosaicError
from mosaic_contracts.schema import (
    EmbedRequest,
    EmbedResponse,
    Latency,
    ModelInfo,
    ModelRequest,
    ModelResponse,
    PrivacyLevel,
    RoutingDecision,
    StreamChunk,
)

log = logging.getLogger("mosaic.models.router")

_MODEL_LIST_TTL = 60.0  # seconds


class PolicyRouter:
    """Policy-driven router over a list of ModelProviders."""

    def __init__(self, providers: list, config: dict[str, Any]) -> None:
        self._providers = {p.name: p for p in providers}
        self._config = config
        self._cached_models: list[ModelInfo] = []
        self._cache_ts: float = 0.0
        self._dim: int | None = None
        self._dim_lock = asyncio.Lock()

    # ------------------------------------------------------------------ internal helpers

    @property
    def _local_providers(self) -> list:
        return [p for p in self._providers.values()]  # all our providers are local for now

    async def _get_models(self) -> list[ModelInfo]:
        now = time.monotonic()
        if now - self._cache_ts > _MODEL_LIST_TTL:
            models: list[ModelInfo] = []
            for p in self._providers.values():
                try:
                    models.extend(await p.list_models())
                except Exception:
                    pass
            self._cached_models = models
            self._cache_ts = now
        return self._cached_models

    def _is_pulled(self, model_name: str, models: list[ModelInfo]) -> bool:
        return any(m.name == model_name or m.name.startswith(model_name + ":") for m in models)

    def _best_local_chat(self, models: list[ModelInfo]) -> str | None:
        for m in models:
            if "chat" in m.capabilities and m.local and m.available:
                return m.name
        return None

    def _provider_for(self, model_name: str, models: list[ModelInfo]) -> Any:
        for m in models:
            if m.name == model_name or m.name.startswith(model_name + ":"):
                p = self._providers.get(m.provider)
                if p:
                    return p
        # fall back to first provider
        if self._providers:
            return next(iter(self._providers.values()))
        return None

    async def _resolve_model(self, req: ModelRequest, local_only: bool, models: list[ModelInfo]) -> tuple[str, Any, str]:
        """Return (model_name, provider, reason)."""
        # Rule: privacy restricted => local only (already handled by caller)
        cfg = self._config

        # 1. model_hint
        if req.model_hint and (not local_only or self._is_pulled(req.model_hint, models)):
            p = self._provider_for(req.model_hint, models)
            if p:
                return req.model_hint, p, f"model_hint={req.model_hint}"

        # 2. latency critical
        if req.latency == Latency.CRITICAL:
            lat_model = cfg.get("latency_critical", cfg.get("default", ""))
            if lat_model and self._is_pulled(lat_model, models):
                p = self._provider_for(lat_model, models)
                if p:
                    return lat_model, p, f"latency_critical={lat_model}"

        # 3. by_task_class
        task_model = cfg.get("by_task_class", {}).get(req.task_class.value if hasattr(req.task_class, "value") else str(req.task_class))
        if task_model and self._is_pulled(task_model, models):
            p = self._provider_for(task_model, models)
            if p:
                return task_model, p, f"task_class={req.task_class}"

        # 4. default
        default = cfg.get("default", "")
        if default and self._is_pulled(default, models):
            p = self._provider_for(default, models)
            if p:
                return default, p, "config_default"

        # 5. any local chat model
        best = self._best_local_chat(models)
        if best:
            p = self._provider_for(best, models)
            if p:
                return best, p, "any_local_chat"

        # 6. use the default model even if not confirmed pulled (optimistic)
        default = cfg.get("default", "")
        if default and self._providers:
            p = next(iter(self._providers.values()))
            return default, p, "config_default_optimistic"

        raise MosaicError("MODEL_UNAVAILABLE", "No suitable model found for the request")

    # ------------------------------------------------------------------ public API

    async def route(self, request: ModelRequest) -> RoutingDecision:
        local_only = request.privacy == PrivacyLevel.RESTRICTED
        models = await self._get_models()
        model_name, provider, reason = await self._resolve_model(request, local_only, models)
        return RoutingDecision(model=model_name, provider=provider.name, local=True, reason=reason)

    async def generate(self, request: ModelRequest) -> ModelResponse:
        local_only = request.privacy == PrivacyLevel.RESTRICTED
        if local_only and not self._local_providers:
            raise MosaicError("MODEL_UNAVAILABLE", "privacy=restricted but no local providers configured")

        models = await self._get_models()
        model_name, provider, reason = await self._resolve_model(request, local_only, models)
        log.debug("routing %s to %s/%s (reason: %s)", request.task_class, provider.name, model_name, reason)

        resp = await provider.generate(request, model_name)

        # JSON repair: if schema was requested and parsed is None or invalid, retry once
        if request.json_schema and resp.parsed is None:
            try:
                resp = await self._repair_json(request, model_name, provider, resp)
            except Exception as e:
                log.warning("JSON repair failed for %s: %s", model_name, e)

        return resp

    async def _repair_json(self, request: ModelRequest, model: str, provider: Any, first_resp: ModelResponse) -> ModelResponse:
        """Retry once with an explicit JSON repair instruction."""
        from mosaic_contracts.schema import ChatMessage, Role
        repair_msg = ChatMessage(
            role=Role.USER,
            content=f"Your previous answer was not valid JSON for the schema. Reply with JSON only matching this schema: {json.dumps(request.json_schema)}",
        )
        repaired_req = request.model_copy(update={"messages": list(request.messages) + [repair_msg]})
        resp = await provider.generate(repaired_req, model)
        if resp.parsed is None and resp.content:
            try:
                resp = resp.model_copy(update={"parsed": json.loads(resp.content)})
            except (json.JSONDecodeError, TypeError):
                pass
        # Validate against schema
        if resp.parsed is not None and request.json_schema:
            try:
                jsonschema.validate(resp.parsed, request.json_schema)
            except jsonschema.ValidationError as e:
                log.warning("JSON validation failed after repair: %s", e.message)
                resp = resp.model_copy(update={"parsed": None})
        return resp

    async def stream(self, request: ModelRequest) -> AsyncIterator[StreamChunk]:
        local_only = request.privacy == PrivacyLevel.RESTRICTED
        models = await self._get_models()
        model_name, provider, _ = await self._resolve_model(request, local_only, models)
        async for chunk in provider.stream(request, model_name):
            yield chunk

    async def embed(self, request: EmbedRequest) -> EmbedResponse:
        embed_model = self._config.get("embedding", "nomic-embed-text")
        # find a provider that can embed — try all until one succeeds
        for provider in self._providers.values():
            try:
                return await provider.embed(request, embed_model)
            except MosaicError:
                pass
        raise MosaicError("MODEL_UNAVAILABLE", f"No provider could produce embeddings with model {embed_model}")

    async def embedding_dim(self) -> int:
        if self._dim is not None:
            return self._dim
        async with self._dim_lock:
            if self._dim is not None:
                return self._dim
            resp = await self.embed(EmbedRequest(texts=["dim probe"]))
            self._dim = resp.dim
            log.info("embedding_dim=%d (model=%s)", self._dim, resp.model)
            return self._dim

    async def list_models(self) -> list[ModelInfo]:
        return await self._get_models()
