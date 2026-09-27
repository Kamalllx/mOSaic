"""Contract tests for P2 — run against shared/fixtures/okf. SKIP until implemented."""
import pytest
from mosaic_contracts.testing import contracts as c
from mosaic_contracts.testing.fakes import FIXTURE_OKF_DIR, FakeModelRouter, InMemoryEventBus
from mosaic_contracts.wiring import ServiceBundle, Settings
from mosaic_knowledge import factory


def _build(fn):
    s = Settings(okf_dir=FIXTURE_OKF_DIR)
    b = ServiceBundle(settings=s, models=FakeModelRouter(), event_bus=InMemoryEventBus())
    try:
        b.firewall = factory.build_context_firewall(s, b)
    except NotImplementedError:
        pass
    try:
        return fn(s, b)
    except NotImplementedError as e:
        pytest.skip(f"not implemented yet: {e}")


class TestKnowledge(c.KnowledgeServiceContract):
    def make(self):
        return _build(factory.build_knowledge_service)


class TestFirewall(c.ContextFirewallContract):
    def make(self):
        return _build(factory.build_context_firewall)


class TestMemory(c.MemoryServiceContract):
    def make(self):
        return _build(factory.build_memory_service)
