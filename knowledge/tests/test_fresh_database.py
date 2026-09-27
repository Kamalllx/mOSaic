"""A brand-new database (no pgvector extension yet) must migrate on first use. Needs Postgres."""

import asyncio
from uuid import uuid4

import psycopg
import pytest
from mosaic_contracts.schema import SearchQuery
from mosaic_contracts.testing.fakes import FIXTURE_OKF_DIR, FakeModelRouter, user_principal
from mosaic_contracts.wiring import Settings
from mosaic_knowledge.firewall import ContextFirewall
from mosaic_knowledge.indexing.store import PgStore, _to_psycopg_dsn
from mosaic_knowledge.kfs import KnowledgeFS

from .test_contract import _postgres_reachable


@pytest.fixture
def fresh_db_url():
    base = Settings.from_env(dotenv=None).database_url
    if not _postgres_reachable(base):
        pytest.skip(f"Postgres unreachable at {base}")
    name = f"mosaic_fresh_{uuid4().hex[:8]}"
    admin = _to_psycopg_dsn(base)
    with psycopg.connect(admin, autocommit=True) as conn:
        conn.execute(f'CREATE DATABASE "{name}"')  # name is generated above, never user input
    yield base.rsplit("/", 1)[0] + "/" + name
    with psycopg.connect(admin, autocommit=True) as conn:
        conn.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')


def test_knowledge_service_migrates_a_fresh_database(fresh_db_url):
    async def go():
        models = FakeModelRouter()
        fs = KnowledgeFS(FIXTURE_OKF_DIR, PgStore(fresh_db_url), models, ContextFirewall(models=models))
        try:
            return await fs.search(SearchQuery(text="Apollo budget overrun cloud cost"), user_principal())
        finally:
            await fs.aclose()

    ev = asyncio.run(go())
    assert "/org/finance/apollo-budget" in [h.path for h in ev.hits[:3]]
