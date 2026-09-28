"""PolicyRouter routing and JSON-repair rules against a scripted provider (no Ollama needed)."""
import asyncio

import pytest
from mosaic_contracts.errors import MosaicError
from mosaic_contracts.schema import ChatMessage, ModelInfo, ModelRequest, ModelResponse, Role
from mosaic_models.router.router import PolicyRouter

CONFIG = {"default": "qwen2.5:7b-instruct", "embedding": "nomic-embed-text", "by_task_class": {}}
SCHEMA = {"type": "object", "properties": {"n": {"type": "integer"}}, "required": ["n"]}


class Scripted:
    name = "ollama"

    def __init__(self, pulled: list[str], replies: list[dict | None] | None = None) -> None:
        self.pulled, self.replies, self.calls = pulled, list(replies or []), []

    async def list_models(self):
        return [ModelInfo(name=n, provider="ollama", capabilities=["chat", "json"]) for n in self.pulled]

    async def generate(self, request, model):
        self.calls.append(model)
        parsed = self.replies.pop(0) if self.replies else None
        return ModelResponse(model=model, provider="ollama", content="", parsed=parsed)


def req() -> ModelRequest:
    return ModelRequest(messages=[ChatMessage(role=Role.USER, content="count")], json_schema=SCHEMA)


def test_no_pulled_chat_model_is_model_unavailable_at_routing_time():
    router = PolicyRouter([Scripted(pulled=[])], CONFIG)
    with pytest.raises(MosaicError) as e:
        asyncio.run(router.route(req()))
    assert e.value.code == "MODEL_UNAVAILABLE"


def test_falls_back_to_any_pulled_chat_model():
    router = PolicyRouter([Scripted(pulled=["llama3.2:3b"])], CONFIG)
    assert asyncio.run(router.route(req())).model == "llama3.2:3b"


def test_schema_invalid_json_is_repaired_once():
    provider = Scripted(pulled=["qwen2.5:7b-instruct"], replies=[{"n": "three"}, {"n": 3}])
    resp = asyncio.run(PolicyRouter([provider], CONFIG).generate(req()))
    assert resp.parsed == {"n": 3} and len(provider.calls) == 2
