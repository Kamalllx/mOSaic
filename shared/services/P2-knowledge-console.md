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
- **Memory recall:** a memory with no word in common with the query is only recalled when its embedding cosine is ≥ `RECALL_KEYWORD_GATE_COSINE` (0.42, tuned on `nomic-embed-text`: related paraphrases score 0.375–0.839, unrelated pairs 0.320–0.408). `test_recall_real_embeddings.py` guards it when Ollama is up.

## How it is tested
| Suite | What it proves | Needs |
|---|---|---|
| `knowledge/tests/test_contract.py` | Knowledge, firewall and memory contracts on the real implementations | Postgres (skips if unreachable) |
| `test_retrieval_units.py` | fused ordering, per-mode scores in [0,1], `filtered_by_policy` counting | Postgres |
| `test_memory_units.py` | 3-hop invalidation CTE, stale recall, working-set budget + pinning + `<untrusted-data>`, rehydrate, consolidate | Postgres |
| `test_ingest.py` | converter → files + index + `knowledge.changed`; unchanged = no-op; deleted files leave the index | Postgres |
| `test_coherence.py` | editing an OKF file → `knowledge.changed` → `memory.invalidated` (right `affected_agents`) → reindexed and searchable | Postgres |
| `test_chunker.py`, `test_validation.py` | chunking, linter rules; the fixtures validate with zero errors | nothing |

## Live invalidation demo (S2)
1. Run `mosaicd` with `MOSAIC_KNOWLEDGE_WATCH=true` (contract 0.3.0) and the bundle in `MOSAIC_OKF_DIR`; keep the console's `/knowledge?path=/org/policies/security` open.
2. Memories derived from the policy must exist: agents that `ctx.remember(...)` a record with `derived_from=["/org/policies/security"]` (P3's agents don't call `ctx.remember` yet, see the P3 review; seed one with `MemoryManager.store` for rehearsals). With a local patch in which finance/engineering remember their findings, editing `finance/cloud-bill-2026-09.md` staled exactly the finance-agent memories in 0.1 s and left engineering-agent's fresh (2026-09-28, real models).
3. `cp data/demo-assets/security-policy-v2.md data/okf/policies/security.md`.
4. Within ~1 s: `knowledge.changed` → `memory.invalidated` (count + affected agents; derived-of-derived memories too) → `knowledge.reindexed`. The console toasts the invalidation on every page and the explorer switches to v2 without a reload. Verified on the full real stack (P1 kernel + P4 bundle) on 2026-09-28.
5. Reset afterwards with `git checkout data/okf/policies/security.md` (the watcher reindexes v1).

## Status (owner keeps this current)
| Item | Status |
|---|---|
| OKF I/O + validation | ✅ |
| Postgres schema + indexing | ✅ (auto re-embed on model/dim change) |
| Hybrid retrieval + graph + scope filter | ✅ |
| Context firewall | ✅ regex; optional LLM classifier built, off by default |
| Memory manager + coherence | ✅ (re-consolidation queue not done) |
| Ingest pipeline (uses P4 converters) | ✅ all five of P4's converters through the pipeline; output byte-identical to P4's committed data/okf |
| Run under P1's real kernel (T9 part 1) | ✅ locally (P1 not on `main` yet) |
| Real embeddings (T9 part 2) | ✅ with P3's router + `nomic-embed-text` (768-dim): gate 0.5 → 0.42; RRF graph weight checked (0/0.1 → 9/10, 0.25 slips, ≥0.5 collapses), stays 0.1. Full index of P4's 73 files: 38.7 s; model switch re-embeds 107 chunks in 14 s |
| UI: composer · timeline · tree · approvals | ✅ on `p2/console` (mock + real gateway) |
| UI: audit · explorer · monitor · result | ✅ on `p2/console`; artifact bytes/screenshots wait on a gateway route |
| Retrieval QA ≥ 9/10 on data/okf | ✅ 9/10 with fake and with real embeddings (`test_retrieval_qa.py`); the miss (Q7, ADR-042 "decommission") is a wording gap in the data |
| Dress rehearsal (real P1 + P3 + P4, llama3.2:3b) | ✅ 39.6 s end to end, 3 approvals from the console; all 3 root causes found by the specialists |
| Live invalidation demo (S2) | ✅ |
