"""T8: editing an OKF file → knowledge.changed → memory.invalidated (+ reindex). Needs Postgres."""

import asyncio
import shutil

import pytest
from mosaic_contracts.schema import MemoryKind, MemoryRecord, MemoryScope, SearchQuery
from mosaic_contracts.schema.common import new_id
from mosaic_contracts.testing.fakes import FIXTURE_OKF_DIR, FakeModelRouter, InMemoryEventBus, user_principal
from mosaic_contracts.wiring import ServiceBundle, Settings
from mosaic_knowledge import factory
from mosaic_knowledge.coherence import watch_bundle

from .test_contract import _postgres_reachable


@pytest.fixture
def services(tmp_path):
    s = Settings.from_env(dotenv=None)
    if not _postgres_reachable(s.database_url):
        pytest.skip(f"Postgres unreachable at {s.database_url}")
    s.okf_dir = tmp_path / "okf"
    shutil.copytree(FIXTURE_OKF_DIR, s.okf_dir)
    b = ServiceBundle(settings=s, models=FakeModelRouter(), event_bus=InMemoryEventBus())
    b.firewall = factory.build_context_firewall(s, b)
    b.knowledge = factory.build_knowledge_service(s, b)
    b.memory = factory.build_memory_service(s, b)  # also starts coherence
    return s, b


async def _wait_for(events: list, pred, timeout: float = 10.0):
    async def poll():
        while not any(pred(e) for e in events):
            await asyncio.sleep(0.05)

    await asyncio.wait_for(poll(), timeout)
    return next(e for e in events if pred(e))


def test_manual_edit_invalidates_dependent_memories_and_reindexes(services):
    s, b = services
    security = s.okf_dir / "policies" / "security.md"

    async def go():
        seen: list = []

        async def h(e):
            seen.append(e)

        b.event_bus.subscribe("*", h)
        await b.knowledge.read("/org/policies/security", user_principal())  # load + index the scratch bundle
        summary = MemoryRecord(
            memory_id=new_id("MEM"),
            kind=MemoryKind.SEMANTIC,
            scope=MemoryScope.AGENT,
            org_id="acme",
            owner="finance-agent",
            content="security policy summary",
            derived_from=["/org/policies/security"],
        )
        derived = summary.model_copy(
            update={"memory_id": new_id("MEM"), "owner": "compliance-agent", "derived_from": [summary.memory_id]}
        )
        await b.memory.store(summary)
        await b.memory.store(derived)

        stop = asyncio.Event()
        watcher = asyncio.create_task(watch_bundle(s.okf_dir, b.event_bus, stop, debounce_ms=100))
        await asyncio.sleep(0.5)  # let the watcher arm before editing
        security.write_text(
            security.read_text(encoding="utf-8") + "\n## v2\n\nQuasarcrypt keys rotate every 30 days.\n", encoding="utf-8"
        )

        changed = await _wait_for(seen, lambda e: e.type == "knowledge.changed" and e.payload["path"] == "/org/policies/security")
        invalidated = await _wait_for(
            seen, lambda e: e.type == "memory.invalidated" and e.payload["source"] == "/org/policies/security"
        )
        await _wait_for(seen, lambda e: e.type == "knowledge.reindexed")
        hits = await b.knowledge.search(SearchQuery(text="Quasarcrypt keys rotate"), user_principal())
        stop.set()
        await watcher
        return summary, derived, changed, invalidated, hits

    summary, derived, changed, invalidated, hits = asyncio.run(go())
    assert changed.payload["change"] == "updated"
    assert set(invalidated.payload["invalidated"]) == {summary.memory_id, derived.memory_id}
    assert invalidated.payload["affected_agents"] == ["compliance-agent", "finance-agent"]
    assert hits.hits and hits.hits[0].path == "/org/policies/security", "the edit is searchable after coherence reindexed it"
