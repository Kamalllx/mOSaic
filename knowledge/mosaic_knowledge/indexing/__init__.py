"""Derived, disposable indexes (OKF stays the source of truth).

Owner: P2 — Knowledge, Memory & Console

TODO:
  - [ ] chunk by heading; embeddings via ModelRouter.embed (dim from embedding_dim())
  - [ ] Postgres: pgvector table + tsvector full-text; incremental by content_hash
  - [ ] reindex() rebuilds from scratch; publish knowledge.reindexed
"""
