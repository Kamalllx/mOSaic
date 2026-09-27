"""Contract tests for P1 (execution side). SKIP until implemented (sandbox also skips when Docker is unavailable)."""
import shutil

import pytest
from mosaic_contracts.testing import contracts as c
from mosaic_contracts.wiring import ServiceBundle, Settings
from mosaic_execution import factory


def _build(fn, tmp_path=None):
    s = Settings()
    try:
        return fn(s, ServiceBundle(settings=s))
    except NotImplementedError as e:
        pytest.skip(f"not implemented yet: {e}")


class TestArtifacts(c.ArtifactStoreContract):
    def make(self):
        return _build(factory.build_artifact_store)


@pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed")
class TestSandbox(c.SandboxManagerContract):
    def make(self):
        return _build(factory.build_sandbox_manager)


class TestTools(c.ToolExecutorContract):
    def make(self):
        return _build(factory.build_tool_executor)
