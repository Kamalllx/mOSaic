"""Model router factory for P3.

Owner: P3 — Agents & Models

Builds a PolicyRouter over OllamaProvider using settings from:
  - settings.ollama_url  (MOSAIC_OLLAMA_URL env var, default http://localhost:11434)
  - models/models.yaml   (routing config)
"""
from __future__ import annotations

import logging

import yaml
from mosaic_contracts.interfaces import ModelRouter
from mosaic_contracts.wiring import REPO_ROOT, ServiceBundle, Settings

log = logging.getLogger("mosaic.models.factory")

_MODELS_YAML = REPO_ROOT / "models" / "models.yaml"


def build_model_router(settings: Settings, services: ServiceBundle) -> ModelRouter:
    """Build and return the real PolicyRouter backed by OllamaProvider."""
    from mosaic_models.providers.ollama import OllamaProvider
    from mosaic_models.router.router import PolicyRouter

    config_path = _MODELS_YAML
    if not config_path.exists():
        log.warning("models.yaml not found at %s, using empty config", config_path)
        config: dict = {}
    else:
        config = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}

    ollama_url = settings.ollama_url
    log.info("building model router: ollama_url=%s, config=%s", ollama_url, config_path)

    providers = [OllamaProvider(ollama_url)]
    return PolicyRouter(providers, config)
