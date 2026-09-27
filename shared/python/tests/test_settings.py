"""Settings.from_env: MOSAIC_<FIELD> parsing for fields that aren't plain strings."""

from mosaic_contracts.wiring import Settings


def test_knowledge_watch_defaults_off(monkeypatch):
    monkeypatch.delenv("MOSAIC_KNOWLEDGE_WATCH", raising=False)
    assert Settings.from_env(dotenv=None).knowledge_watch is False


def test_knowledge_watch_from_env(monkeypatch):
    monkeypatch.setenv("MOSAIC_KNOWLEDGE_WATCH", "true")
    assert Settings.from_env(dotenv=None).knowledge_watch is True
    monkeypatch.setenv("MOSAIC_KNOWLEDGE_WATCH", "false")
    assert Settings.from_env(dotenv=None).knowledge_watch is False
