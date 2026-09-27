"""Factory contract for P3 — models (see mosaic_contracts.wiring)."""
from mosaic_contracts.interfaces import ModelRouter
from mosaic_contracts.wiring import ServiceBundle, Settings


def build_model_router(settings: Settings, services: ServiceBundle) -> ModelRouter:
    raise NotImplementedError("P3: router.PolicyRouter([OllamaProvider(settings.ollama_url)], config='models/models.yaml')")
