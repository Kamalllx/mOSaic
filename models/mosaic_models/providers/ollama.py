"""Ollama HTTP provider for the mOSaic model layer.

Owner: P3 — Agents & Models
"""
from __future__ import annotations

import json
import logging
import time

import httpx
from mosaic_contracts.errors import MosaicError
from mosaic_contracts.schema import EmbedRequest, EmbedResponse, ModelInfo, ModelRequest, ModelResponse, StreamChunk, TokenUsage

log = logging.getLogger("mosaic.models.providers.ollama")


class OllamaProvider:
    """One backend: Ollama HTTP API (POST /api/chat, POST /api/embed, GET /api/tags)."""

    name = "ollama"

    def __init__(self, base_url: str, timeout: float = 180.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(base_url=self.base_url, timeout=timeout)

    def _body(self, req: ModelRequest, model: str, stream: bool) -> dict:
        body: dict = {
            "model": model,
            "stream": stream,
            "messages": [{"role": m.role.value, "content": m.content} for m in req.messages],
            "options": {
                "temperature": req.temperature,
                "num_predict": req.max_tokens,
                "stop": req.stop or None,
            },
        }
        if req.json_schema:
            body["format"] = req.json_schema  # Ollama structured outputs
        return body

    async def generate(self, req: ModelRequest, model: str) -> ModelResponse:
        t0 = time.perf_counter()
        try:
            r = await self.client.post("/api/chat", json=self._body(req, model, stream=False))
            r.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise MosaicError("MODEL_UNAVAILABLE", f"ollama {model}: HTTP {e.response.status_code} — {e.response.text[:200]}") from e
        except httpx.HTTPError as e:
            raise MosaicError("MODEL_UNAVAILABLE", f"ollama {model}: {e}") from e

        data = r.json()
        if "error" in data:
            raise MosaicError("MODEL_UNAVAILABLE", f"ollama {model}: {data['error']}")

        content = data.get("message", {}).get("content", "")
        parsed = None
        if req.json_schema:
            try:
                parsed = json.loads(content)
            except (json.JSONDecodeError, TypeError):
                parsed = None  # the router repairs/retries

        return ModelResponse(
            model=model,
            provider=self.name,
            content=content,
            parsed=parsed,
            local=True,
            usage=TokenUsage(
                prompt=data.get("prompt_eval_count", 0),
                completion=data.get("eval_count", 0),
            ),
            latency_ms=(time.perf_counter() - t0) * 1000,
            finish_reason=data.get("done_reason", "stop"),
        )

    async def stream(self, req: ModelRequest, model: str):
        """Async generator of StreamChunks."""
        try:
            async with self.client.stream("POST", "/api/chat", json=self._body(req, model, stream=True)) as r:
                r.raise_for_status()
                async for line in r.aiter_lines():
                    if not line:
                        continue
                    try:
                        d = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if d.get("done"):
                        yield StreamChunk(
                            delta="",
                            done=True,
                            usage=TokenUsage(
                                prompt=d.get("prompt_eval_count", 0),
                                completion=d.get("eval_count", 0),
                            ),
                        )
                    else:
                        yield StreamChunk(delta=d.get("message", {}).get("content", ""))
        except httpx.HTTPError as e:
            raise MosaicError("MODEL_UNAVAILABLE", f"ollama stream {model}: {e}") from e

    async def embed(self, req: EmbedRequest, model: str) -> EmbedResponse:
        vecs = []
        try:
            for text in req.texts:
                r = await self.client.post("/api/embeddings", json={"model": model, "prompt": text})
                if r.status_code >= 400:
                    raise MosaicError("MODEL_UNAVAILABLE", f"embed {model}: {r.text[:200]}")
                data = r.json()
                vec = data.get("embedding")
                if not vec:
                    raise MosaicError("MODEL_UNAVAILABLE", f"ollama embed returned no embeddings for {model}")
                vecs.append(vec)
        except httpx.HTTPError as e:
            raise MosaicError("MODEL_UNAVAILABLE", f"ollama embed {model}: {e}") from e

        return EmbedResponse(model=model, dim=len(vecs[0]), vectors=vecs)

    async def list_models(self) -> list[ModelInfo]:
        try:
            r = await self.client.get("/api/tags", timeout=5.0)
            r.raise_for_status()
            names = [m["name"] for m in r.json().get("models", [])]
            return [
                ModelInfo(
                    name=n,
                    provider=self.name,
                    local=True,
                    capabilities=["embed"] if "embed" in n else ["chat", "json"],
                )
                for n in names
            ]
        except httpx.HTTPError as e:
            log.warning("ollama list_models failed: %s", e)
            return []

    async def health(self) -> bool:
        try:
            r = await self.client.get("/api/tags", timeout=2.0)
            return r.status_code == 200
        except httpx.HTTPError:
            return False

    async def aclose(self) -> None:
        await self.client.aclose()
