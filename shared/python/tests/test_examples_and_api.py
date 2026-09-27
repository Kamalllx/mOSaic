import json

import pytest
from mosaic_contracts import examples
from mosaic_contracts.schema import ALLOWED_TRANSITIONS, AgentState, EventType, can_transition
from mosaic_contracts.util import capability_matches, okf_file_to_org_path, org_path_to_okf_file, path_matches


@pytest.mark.parametrize("name", sorted(examples.ALL_EXAMPLES))
def test_examples_build_and_roundtrip(name):
    value = examples.ALL_EXAMPLES[name]()
    items = value if isinstance(value, list) else [value]
    for item in items:
        assert type(item).model_validate_json(item.model_dump_json()) == item


def test_event_types_in_examples_are_catalogued():
    known = {e.value for e in EventType}
    assert {e.type for e in examples.events()} <= known


def test_state_machine_covers_all_states():
    assert set(ALLOWED_TRANSITIONS) == set(AgentState)
    assert can_transition(AgentState.RUNNING, AgentState.WAITING)
    assert not can_transition(AgentState.COMPLETED, AgentState.RUNNING)


@pytest.mark.parametrize("path,glob,ok", [
    ("/org/finance/apollo-budget", "/org/finance/**", True),
    ("/org/finance", "/org/finance/**", True),
    ("/org/financex/a", "/org/finance/**", False),
    ("/org/projects/apollo", "/org/projects", True),
    ("/org/projects/apollo/x", "/org/projects/*", False),
])
def test_path_matches(path, glob, ok):
    assert path_matches(path, glob) is ok


@pytest.mark.parametrize("cap,granted,ok", [
    ("jira.write", "jira.write", True), ("jira.write", "jira.*", True), ("jira.write", "jira.read", False),
    ("jira", "jira.*", False), ("knowledge.read", "*", True),
])
def test_capability_matches(cap, granted, ok):
    assert capability_matches(cap, granted) is ok


def test_okf_path_mapping():
    assert org_path_to_okf_file("/org/projects/apollo") == "projects/apollo.md"
    assert okf_file_to_org_path("projects/index.md") == "/org/projects"
    assert okf_file_to_org_path("index.md") == "/org"


fastapi = pytest.importorskip("fastapi")


def test_mock_gateway_flow():
    from fastapi.testclient import TestClient
    from mosaic_contracts.api.mock_gateway import build_mock_app

    with TestClient(build_mock_app(replay_speed=1000)) as client:
        assert client.get("/system/status").json()["ready"] is True
        hits = client.get("/knowledge/search", params={"q": "Apollo budget overrun"}).json()["hits"]
        assert hits[0]["path"] == "/org/finance/apollo-budget"
        task = client.post("/tasks", json={"goal": "Investigate Apollo"}).json()
        with client.websocket_connect(f"/ws/events?task_id={task['task_id']}") as ws:
            seen = []
            while True:
                ev = json.loads(ws.receive_text())
                seen.append(ev["type"])
                if ev["type"] == "approval.requested":
                    approval_id = ev["payload"]["approval_id"]
                    assert client.post(f"/approvals/{approval_id}/approve", json={}).json()["status"] == "approved"
                if ev["type"] == "task.completed":
                    break
        assert "approval.resolved" in seen
        assert client.get(f"/tasks/{task['task_id']}").json()["status"] == "completed"
        assert client.get("/tasks/T-nope").status_code == 404



def test_exported_schema_keeps_fields_named_title():
    """export strips JSON-schema "title" annotations; it must not drop real fields called `title` (regenerate with
    `uv run mosaic-export-contracts` if this fails)."""
    import json

    from mosaic_contracts.export import SHARED

    defs = json.loads((SHARED / "schemas" / "mosaic.schema.json").read_text(encoding="utf-8"))["$defs"]
    for model in ("KnowledgeEntry", "SearchHit", "OKFFrontmatter"):
        assert "title" in defs[model]["properties"], model
        assert "title" in defs[model].get("required", []), model
    assert "title" not in defs["SearchHit"]["properties"]["path"], "field-level annotations are still stripped"
