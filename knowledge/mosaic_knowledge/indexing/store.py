"""Postgres/pgvector access layer shared by the indexer, retriever, graph and memory manager.

Owner: P2 — Knowledge, Memory & Console
"""

from __future__ import annotations

import asyncio
import logging
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import psycopg
from pgvector import Vector
from pgvector.psycopg import register_vector_async
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

logger = logging.getLogger("mosaic.knowledge.store")

_SCHEMA_PATH = Path(__file__).parent / "schema.sql"

if sys.platform == "win32":
    # psycopg's async mode needs a selector loop; Windows defaults to ProactorEventLoop.
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


def _to_psycopg_dsn(database_url: str) -> str:
    """SQLAlchemy-style 'postgresql+psycopg://...' -> plain 'postgresql://...' for psycopg."""
    return database_url.replace("postgresql+psycopg://", "postgresql://", 1)


@dataclass
class ChunkRow:
    chunk_id: str
    path: str
    ord: int
    heading: str | None
    text: str


class PgStore:
    """Thin async wrapper over the mosaic Postgres schema (§6.3 of the P2 brief)."""

    def __init__(self, database_url: str) -> None:
        self.database_url = _to_psycopg_dsn(database_url)
        self.pool: AsyncConnectionPool | None = None
        self.dim: int | None = None

    async def _configure(self, conn: psycopg.AsyncConnection) -> None:
        await register_vector_async(conn)

    async def _ensure_pool(self) -> AsyncConnectionPool:
        if self.pool is None:
            pool = AsyncConnectionPool(
                self.database_url,
                min_size=1,
                max_size=10,
                open=False,
                configure=self._configure,
                kwargs={"row_factory": dict_row},
            )
            await pool.open(wait=True, timeout=5)
            self.pool = pool
        return self.pool

    async def ping(self) -> bool:
        try:
            pool = await self._ensure_pool()
            async with pool.connection() as conn:
                await conn.execute("SELECT 1")
            return True
        except Exception:  # noqa: BLE001 — connectivity probe, any failure means "unreachable"
            return False

    async def close(self) -> None:
        if self.pool is not None:
            await self.pool.close()
            self.pool = None

    @asynccontextmanager
    async def connection(self) -> AsyncIterator[psycopg.AsyncConnection]:
        pool = await self._ensure_pool()
        async with pool.connection() as conn:
            yield conn

    # --------------------------------------------------------------------- migration

    async def migrate(self, dim: int, model_name: str) -> None:
        """Idempotent. Drops embedding-bearing data and warns if the model/dim changed."""
        self.dim = dim
        async with self.connection() as conn:
            await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
            await conn.execute("CREATE TABLE IF NOT EXISTS meta(key text PRIMARY KEY, value text)")
            cur = await conn.execute("SELECT key, value FROM meta WHERE key IN ('embedding_model', 'embedding_dim')")
            existing = {r["key"]: r["value"] for r in await cur.fetchall()}
            dim_changed = existing.get("embedding_dim") not in (None, str(dim))
            model_changed = existing.get("embedding_model") not in (None, model_name)
            memories_existed = False
            if dim_changed or model_changed:
                logger.warning(
                    "embedding model/dim changed (%s/%s -> %s/%s); dropping embedding-bearing data",
                    existing.get("embedding_model"),
                    existing.get("embedding_dim"),
                    model_name,
                    dim,
                )
                tables = {
                    r["tablename"]
                    for r in await (await conn.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).fetchall()
                }
                memories_existed = "memories" in tables
                if "chunks" in tables:
                    await conn.execute("DROP TABLE chunks")
                if memories_existed:
                    await conn.execute("ALTER TABLE memories DROP COLUMN IF EXISTS embedding")

            sql = _SCHEMA_PATH.read_text(encoding="utf-8").replace("__DIM__", str(dim))
            await conn.execute(sql)

            if memories_existed:
                # memories already existed and lost its embedding column above; schema.sql's
                # CREATE TABLE IF NOT EXISTS was a no-op for it, so add the column back at the new dim.
                await conn.execute(f"ALTER TABLE memories ADD COLUMN IF NOT EXISTS embedding vector({dim})")

            await conn.execute(
                "INSERT INTO meta(key, value) VALUES ('embedding_model', %s), ('embedding_dim', %s) "
                "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
                (model_name, str(dim)),
            )
            await conn.commit()

    # --------------------------------------------------------------------- okf_objects

    async def upsert_object(self, obj: Any) -> None:
        fm = obj.frontmatter
        async with self.connection() as conn:
            await conn.execute(
                "INSERT INTO okf_objects(path, okf_file, type, title, privacy, trust, tags, frontmatter, body, "
                "content_hash, version, updated_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,1,now()) "
                "ON CONFLICT (path) DO UPDATE SET okf_file=EXCLUDED.okf_file, type=EXCLUDED.type, "
                "title=EXCLUDED.title, privacy=EXCLUDED.privacy, trust=EXCLUDED.trust, tags=EXCLUDED.tags, "
                "frontmatter=EXCLUDED.frontmatter, body=EXCLUDED.body, content_hash=EXCLUDED.content_hash, "
                "version=okf_objects.version + 1, updated_at=now()",
                (
                    obj.path,
                    obj.okf_file,
                    fm.type,
                    fm.title,
                    fm.privacy.value,
                    fm.trust.value,
                    fm.tags,
                    fm.model_dump_json(),
                    obj.body,
                    obj.content_hash,
                ),
            )
            await conn.commit()

    async def delete_object(self, path: str) -> None:
        async with self.connection() as conn:
            await conn.execute("DELETE FROM okf_objects WHERE path = %s", (path,))
            await conn.commit()

    async def get_object_row(self, path: str) -> dict[str, Any] | None:
        async with self.connection() as conn:
            cur = await conn.execute("SELECT * FROM okf_objects WHERE path = %s", (path,))
            return await cur.fetchone()

    async def content_hashes(self) -> dict[str, str]:
        async with self.connection() as conn:
            cur = await conn.execute("SELECT path, content_hash FROM okf_objects")
            return {r["path"]: r["content_hash"] for r in await cur.fetchall()}

    async def paths_with_chunks(self) -> set[str]:
        async with self.connection() as conn:
            cur = await conn.execute("SELECT DISTINCT path FROM chunks")
            return {r["path"] for r in await cur.fetchall()}

    async def all_paths(self) -> list[str]:
        async with self.connection() as conn:
            cur = await conn.execute("SELECT path FROM okf_objects")
            return [r["path"] for r in await cur.fetchall()]

    # --------------------------------------------------------------------- chunks

    async def replace_chunks(self, path: str, chunks: list[tuple[str, int, str | None, str, list[float]]]) -> None:
        """chunks: (chunk_id, ord, heading, text, embedding)."""
        async with self.connection() as conn:
            await conn.execute("DELETE FROM chunks WHERE path = %s", (path,))
            for chunk_id, ord_, heading, text, embedding in chunks:
                await conn.execute(
                    "INSERT INTO chunks(chunk_id, path, ord, heading, text, embedding) VALUES (%s,%s,%s,%s,%s,%s)",
                    (chunk_id, path, ord_, heading, text, embedding),
                )
            await conn.commit()

    async def lexical_search(
        self, query_text: str, scope: list[str], types: list[str], tags: list[str], min_trust_values: list[str], limit: int = 50
    ) -> list[dict[str, Any]]:
        where, params = self._base_where(scope, types, tags, min_trust_values)
        where.append("c.tsv @@ websearch_to_tsquery('english', %s)")
        params.append(query_text)
        sql = (
            "SELECT c.chunk_id, c.path, c.ord, c.heading, c.text, "
            "ts_rank(c.tsv, websearch_to_tsquery('english', %s)) AS rank "
            "FROM chunks c JOIN okf_objects o ON o.path = c.path "
            f"WHERE {' AND '.join(where)} ORDER BY rank DESC LIMIT %s"
        )
        async with self.connection() as conn:
            cur = await conn.execute(sql, (query_text, *params, limit))
            return await cur.fetchall()

    async def semantic_search(
        self,
        query_vec: list[float],
        scope: list[str],
        types: list[str],
        tags: list[str],
        min_trust_values: list[str],
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        where, params = self._base_where(scope, types, tags, min_trust_values)
        sql = (
            "SELECT c.chunk_id, c.path, c.ord, c.heading, c.text, (c.embedding <=> %s) AS dist "
            "FROM chunks c JOIN okf_objects o ON o.path = c.path "
            f"WHERE {' AND '.join(where)} AND c.embedding IS NOT NULL ORDER BY c.embedding <=> %s LIMIT %s"
        )
        qv = Vector(query_vec)
        async with self.connection() as conn:
            cur = await conn.execute(sql, (qv, *params, qv, limit))
            return await cur.fetchall()

    def _base_where(
        self, scope: list[str], types: list[str], tags: list[str], min_trust_values: list[str]
    ) -> tuple[list[str], list[Any]]:
        where: list[str] = []
        params: list[Any] = []
        if scope:
            clauses = []
            for s in scope:
                s = s.rstrip("/")
                clauses.append("(o.path = %s OR o.path LIKE %s)")
                params.extend([s, s + "/%"])
            where.append("(" + " OR ".join(clauses) + ")")
        if types:
            where.append("o.type = ANY(%s)")
            params.append(types)
        if tags:
            where.append("o.tags && %s")
            params.append(tags)
        if min_trust_values:
            where.append("o.trust = ANY(%s)")
            params.append(min_trust_values)
        if not where:
            where.append("TRUE")
        return where, params

    # --------------------------------------------------------------------- edges

    async def replace_edges_from(self, src: str, edges: list[tuple[str, str, float]]) -> None:
        """edges: (dst, relation, weight) — all outgoing edges of `src` are replaced."""
        async with self.connection() as conn:
            await conn.execute("DELETE FROM edges WHERE src = %s", (src,))
            for dst, relation, weight in edges:
                await conn.execute(
                    "INSERT INTO edges(src, dst, relation, weight) VALUES (%s,%s,%s,%s) "
                    "ON CONFLICT (src, dst, relation) DO UPDATE SET weight = EXCLUDED.weight",
                    (src, dst, relation, weight),
                )
            await conn.commit()

    async def neighbors(self, paths: list[str], relations: list[str] | None = None) -> list[dict[str, Any]]:
        if not paths:
            return []
        where = "(src = ANY(%s) OR dst = ANY(%s))"
        params: list[Any] = [paths, paths]
        if relations:
            where += " AND relation = ANY(%s)"
            params.append(relations)
        async with self.connection() as conn:
            cur = await conn.execute(f"SELECT src, dst, relation, weight FROM edges WHERE {where}", params)
            return await cur.fetchall()


__all__ = ["PgStore", "ChunkRow"]
