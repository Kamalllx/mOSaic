"""Contract tests for the real router. Needs a running Ollama (skips otherwise) and an implemented factory."""
import httpx
import pytest
from mosaic_contracts.testing import contracts as c
from mosaic_contracts.wiring import ServiceBundle, Settings
from mosaic_models import factory


def _build(fn):
    s = Settings.from_env()
    try:
        httpx.get(s.ollama_url, timeout=1)
    except httpx.HTTPError:
        pytest.skip("ollama not reachable")
    try:
        return fn(s, ServiceBundle(settings=s))
    except NotImplementedError as e:
        pytest.skip(f"not implemented yet: {e}")


class TestRouter(c.ModelRouterContract):
    def make(self):
        return _build(factory.build_model_router)
