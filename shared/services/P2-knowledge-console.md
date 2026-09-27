# P2 Knowledge, Memory & Console: what this split provides
Full brief: [docs/team/P2-knowledge-console.md](../../docs/team/P2-knowledge-console.md) · Packages: `knowledge/` (`mosaic_knowledge`, minus `ingestion/`), `apps/web/`, `agents/mosaic_agents/adapters/` (stretch)

| Provides | Kind | Consumers | Fake until ready | Contract |
|---|---|---|---|---|
| `KnowledgeService` (`/org` filesystem, hybrid search, graph, ingest pipeline) | interface | P1 (for agents + gateway) | `FakeKnowledgeService` | `KnowledgeServiceContract` |
| `ContextFirewall` | interface | KnowledgeFS, P1 context | `FakeContextFirewall` | `ContextFirewallContract` |
| `MemoryService` | interface | P1 context/lifecycle | `FakeMemoryService` | `MemoryServiceContract` |
| Web console | UI over the gateway | humans / demo | mock gateway | — |
| NOOA adapter (stretch) | runtime adapter | P3 runtime | falls back to custom | — |

**Access rule:** every read filters by `principal.data_scopes` (`util.path_allowed`) and `principal.max_privacy` (`util.privacy_allows`). **Events published:** `knowledge.changed`, `knowledge.reindexed`, `memory.invalidated`, `memory.consolidated`.
**Consumes:** `ModelRouter.embed/embedding_dim/generate` (P3), `EventBus` (P1), `services.converters` (P4), and the gateway (P1) for the UI. Owns the `postgres` schema.

**Behaviour notes for consumers**
- `search()` screens every hit's **full body** with the firewall, so P1's `ctx.search()` must not screen again (hits already carry `firewall_flags`). `untrusted_source` is added only when `provenance.trust == untrusted`.
- `filtered_by_policy` counts only objects removed by the principal's `data_scopes` / `max_privacy`, never by the query's own `types` / `tags` / `min_trust`.
- The first call on a fresh `KnowledgeFS` migrates the schema and indexes `settings.okf_dir` (a few seconds). A change of embedding model or dim drops the embeddings and re-embeds everything automatically.
- `ingest()` reports converter/validation problems in `IngestResult.errors` (it doesn't raise). Re-ingesting identical content lands in `skipped` and publishes no event.
- `build_memory_service` starts coherence: every `knowledge.changed` → `memory.invalidate(path)` → `knowledge.reindex([path])` → `memory.invalidated` + `knowledge.reindexed`. The file watcher (`coherence.watch_bundle`) is opt-in: with `MOSAIC_KNOWLEDGE_WATCH=true` (contract 0.3.0) `KnowledgeFS` starts it on its first call and republishes manual edits under `okf_dir` as `knowledge.changed`.
- CLI: `uv run mosaic-okf validate | search "<text>" | reindex | ingest <path> --target /org/...`.
- **Any event loop:** Postgres I/O runs on worker threads (sync psycopg + `asyncio.to_thread`), so the knowledge and memory services work on every asyncio loop, including uvicorn's default `ProactorEventLoop` on Windows, which Playwright and asyncio subprocesses need. No process needs a loop-policy change for P2.
- **Memory recall:** a memory with no word in common with the query is only recalled when its embedding cosine is ≥ `RECALL_KEYWORD_GATE_COSINE` (0.5, tuned on the hashed fake embeddings). It gets retuned for the real embedding model at T9.

## How it is tested
| Suite | What it proves | Needs |
|---|---|---|
| `knowledge/tests/test_contract.py` | Knowledge, firewall and memory contracts on the real implementations | Postgres (skips if unreachable) |
| `test_retrieval_units.py` | fused ordering, per-mode scores in [0,1], `filtered_by_policy` counting | Postgres |
| `test_memory_units.py` | 3-hop invalidation CTE, stale recall, working-set budget + pinning + `<untrusted-data>`, rehydrate, consolidate | Postgres |
| `test_ingest.py` | converter → files + index + `knowledge.changed`; unchanged = no-op; deleted files leave the index | Postgres |
| `test_coherence.py` | editing an OKF file → `knowledge.changed` → `memory.invalidated` (right `affected_agents`) → reindexed and searchable | Postgres |
| `test_chunker.py`, `test_validation.py` | chunking, linter rules; the fixtures validate with zero errors | nothing |

## Status (owner keeps this current)
| Item | Status |
|---|---|
| OKF I/O + validation | ✅ |
| Postgres schema + indexing | ✅ (auto re-embed on model/dim change) |
| Hybrid retrieval + graph + scope filter | ✅ |
| Context firewall | ✅ regex; optional LLM classifier built, off by default |
| Memory manager + coherence | ✅ (re-consolidation queue not done) |
| Ingest pipeline (uses P4 converters) | ✅ with `FakeMarkdownConverter`; waiting on P4's real converters |
| Real embeddings (P3 router) + run under P1's real kernel (T9, M2) | ☐ waiting on P1 merge to `main` and P3's router |
| UI: composer · timeline · tree · approvals | ☐ |
| UI: audit · explorer · monitor · result | ☐ |
| Retrieval QA ≥ 9/10 on data/okf | ☐ |
