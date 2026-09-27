"""The Windows loop-policy helper, and PgStore's clear error on an incompatible loop. No Postgres needed."""

import asyncio
import sys

import pytest
from mosaic_contracts.errors import MosaicError
from mosaic_knowledge.compat import ensure_selector_loop_on_windows
from mosaic_knowledge.indexing.store import PgStore


def test_helper_is_idempotent():
    ensure_selector_loop_on_windows()
    ensure_selector_loop_on_windows()
    if sys.platform == "win32":
        assert isinstance(asyncio.get_event_loop_policy(), asyncio.WindowsSelectorEventLoopPolicy)


@pytest.mark.skipif(sys.platform != "win32", reason="ProactorEventLoop only exists on Windows")
def test_pgstore_on_proactor_loop_raises_a_clear_error():
    store = PgStore("postgresql+psycopg://nobody:nothing@localhost:1/none")
    with pytest.raises(MosaicError) as ei:
        asyncio.run(store.content_hashes(), loop_factory=asyncio.ProactorEventLoop)
    assert ei.value.code == "INTERNAL"
    assert "ensure_selector_loop_on_windows" in ei.value.message
