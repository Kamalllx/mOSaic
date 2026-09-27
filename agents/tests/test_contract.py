"""Contract tests for P3 agents. Every manifest must run against FakeAgentContext. SKIP until implemented."""
import pytest
from mosaic_agents import factory
from mosaic_contracts.testing import contracts as c
from mosaic_contracts.wiring import ServiceBundle, Settings


def _build(fn):
    s = Settings()
    try:
        return fn(s, ServiceBundle(settings=s))
    except NotImplementedError as e:
        pytest.skip(f"not implemented yet: {e}")


class TestRegistry(c.AgentRegistryContract):
    def make(self):
        return _build(factory.build_agent_registry)


class TestRuntime(c.AgentRuntimeContract):
    def make(self):
        return _build(factory.build_agent_runtime), _build(factory.build_agent_registry)
