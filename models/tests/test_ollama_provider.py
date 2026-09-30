"""OllamaProvider against a stubbed HTTP transport (no Ollama needed)."""
import asyncio
import json

import httpx
import pytest
from mosaic_contracts.errors import MosaicError
from mosaic_contracts.schema import EmbedRequest
from mosaic_models.providers.ollama import OllamaProvider


def provider(handler) -> tuple[OllamaProvider, list[httpx.Request]]:
    seen: list[httpx.Request] = []

    def record(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    p = OllamaProvider("http://ollama")
    p.client = httpx.AsyncClient(base_url="http://ollama", transport=httpx.MockTransport(record))
    return p, seen


def test_embed_sends_one_batch_request():
    def handler(request):
        texts = json.loads(request.content)["input"]
        return httpx.Response(200, json={"embeddings": [[float(len(t)), 1.0] for t in texts]})

    p, seen = provider(handler)
    res = asyncio.run(p.embed(EmbedRequest(texts=["a", "bb", "ccc"]), "nomic-embed-text"))
    assert [r.url.path for r in seen] == ["/api/embed"]
    assert res.dim == 2 and [v[0] for v in res.vectors] == [1.0, 2.0, 3.0]


def test_embed_of_nothing_makes_no_request():
    p, seen = provider(lambda r: httpx.Response(500))
    res = asyncio.run(p.embed(EmbedRequest(texts=[]), "nomic-embed-text"))
    assert res.vectors == [] and seen == []


@pytest.mark.parametrize("response", [httpx.Response(404, text="model not found"), httpx.Response(200, json={"embeddings": [[1.0]]})])
def test_embed_errors_are_model_unavailable(response):
    p, _ = provider(lambda r: response)
    with pytest.raises(MosaicError) as e:
        asyncio.run(p.embed(EmbedRequest(texts=["a", "b"]), "nomic-embed-text"))
    assert e.value.code == "MODEL_UNAVAILABLE"


def test_nomic_gets_its_task_prefix_and_other_models_do_not():
    from mosaic_models.providers.ollama import task_prefixed

    q = EmbedRequest(texts=["why over budget?"], input_type="query")
    d = EmbedRequest(texts=["Apollo budget"], input_type="document")
    assert task_prefixed("nomic-embed-text", q) == ["search_query: why over budget?"]
    assert task_prefixed("nomic-embed-text:latest", d) == ["search_document: Apollo budget"]
    assert task_prefixed("nomic-embed-text", EmbedRequest(texts=["x"])) == ["x"], "no type, no prefix"
    assert task_prefixed("mxbai-embed-large", q) == ["why over budget?"], "only models trained with the prefixes get them"
