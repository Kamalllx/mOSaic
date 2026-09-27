# P2: Knowledge, Memory & Console

| Tooling | Review buddy | Skills |
|---|---|---|
| Claude Code (Opus 5.5) | P3 (you consume their router/embeddings; your UI shows their agents' output) | PostgreSQL + pgvector, information retrieval, Python async, React/Next.js/Tailwind |

> **Coding-agent setup:** create `CLAUDE.local.md` in the repo root containing `@docs/team/P2-knowledge-console.md`. Work backend (T1–T8) and frontend (W1–W6) in separate Claude sessions, since they have different contexts. For UI sessions, also point Claude at `apps/AGENTS.md`.

---

## 1. Mission
Two jobs:
1. **The knowledge and memory engine.** OKF is the source of truth and indexes are disposable. Retrieval is hybrid, permission-filtered, provenance-carrying and injection-aware. Context is managed like memory: load, evict, consolidate, invalidate.
2. **The console.** The web UI that makes the OS metaphor visible: process tree, live timeline, approval center, audit journal, knowledge explorer.

## 2. Scope
**You own:** `knowledge/` **except** `mosaic_knowledge/ingestion/`, `tests/samples/`, `tests/test_ingestion_contract.py` (P4's converters); `apps/`; `agents/mosaic_agents/adapters/` (NOOA, stretch); the `postgres` service schema.
**Never edit:** P4's converter code (you *call* it), other splits' folders, generated files in `shared/`.

## 3. Inputs: what you consume

| Input | Provider | How you get it | Dev stand-in |
|---|---|---|---|
| `ModelRouter.embed / embedding_dim / generate` | P3 | `services.models` | `FakeModelRouter` (deterministic 64-dim hashed embeddings) |
| `EventBus` | P1 | `services.event_bus` | `InMemoryEventBus` |
| `ContextFirewall` (your own) | P2 | `services.firewall` (built before knowledge) | |
| `list[SourceConverter]` | P4 | `services.converters` | `[FakeMarkdownConverter()]` |
| OKF bundle | P4 (demo), shared (tests) | `settings.okf_dir` | `shared/fixtures/okf` (frozen) |
| Gateway REST + WS (for the UI) | P1 | `apps/web/lib/mosaic-client.ts` | `uv run mosaic-mock-gateway --speed 4` |
| `Principal` on every read | P1 | argument | `fakes.user_principal()` / `system_principal()` |

## 4. Outputs: what you provide

### 4.1 `KnowledgeService` (`interfaces/knowledge.py`)
| Method | Input → Output | Must |
|---|---|---|
| `read(path, principal)` | `/org/...` → `KnowledgeObject` | raise `KNOWLEDGE_NOT_FOUND` / `KNOWLEDGE_FORBIDDEN`; fill `links`, `provenance`, `content_hash` |
| `list(path, principal)` | → `KnowledgeListing` | children with `is_dir`; hide entries out of scope |
| `search(SearchQuery, principal)` | → `EvidenceSet` | hybrid search; `scores` per mode; `provenance` on every hit; `filtered_by_policy` count; **firewall screening on the full body**; `body` only when `include_body` |
| `traverse(path, principal, depth, relations)` | → `GraphResult` | scope-filtered nodes and edges |
| `ingest(IngestRequest)` | → `IngestResult` | converters → write OKF → validate → index → `knowledge.changed` per path |
| `reindex(paths=None)` | → count | rebuild derived data; `knowledge.reindexed {count}` |
| `validate()` | → `ValidationReport` | lint rules (§6.2) |

### 4.2 `ContextFirewall.screen(hits) -> hits`
Adds `"instruction_like"` to `firewall_flags` for instruction-like text anywhere in the hit's body/snippet. It may also add `"untrusted_source"` **only** when `provenance.trust == untrusted`. It never drops a hit. A plain fact from an unverified source must come back with **no** flags (the contract test checks this).

### 4.3 `MemoryService`
`store`, `recall` (stale excluded unless `include_stale`), `build_working_set` (LOAD+EVICT), `summarize`, `consolidate(task_id)`, `invalidate(source)` (transitive; publishes `memory.invalidated`), `rehydrate(pid)`.

### 4.4 Events you publish
`knowledge.changed` (`KnowledgeChange`), `knowledge.reindexed`, `memory.invalidated` (`InvalidationReport`), `memory.consolidated {created}`.

### 4.5 The web console (`apps/web`)
The screens in §7, all driven by the gateway API and event stream only.

---

## 5. Backend architecture

```text
KnowledgeFS (implements KnowledgeService)
 ├── bundle: OKFBundle(okf_dir)                     okf/
 ├── store: PgStore(database_url, dim)              indexing/   (schema, upserts, FTS + vector queries)
 ├── indexer: Indexer(bundle, store, models)        indexing/   (chunk + embed + upsert, by content_hash)
 ├── retriever: HybridRetriever(store, graph, models, firewall)   retrieval/
 ├── graph: GraphStore(store)                       graph/
 └── ingest pipeline: converters → bundle.write_draft → validate → indexer → events   kfs/
MemoryManager (implements MemoryService)            memory/   (PgStore tables memories, working_sets)
Coherence: subscribes knowledge.changed → memory.invalidate + indexer.reindex(path)   coherence/
ContextFirewall                                     firewall/
```
Factories: `build_context_firewall` (needs `services.models` for the optional classifier), `build_knowledge_service`, `build_memory_service`. Run the schema migration on first build (idempotent `CREATE ... IF NOT EXISTS`).

## 6. Backend implementation spec

### 6.1 OKF I/O (`okf/`)
- `OKFBundle(root)`: `load_all() -> dict[path, KnowledgeObject]` (skip `README.md`); a parser equivalent to `fakes.parse_okf` but tolerant (a missing frontmatter gets type `note` and the title from the first `# heading` or the filename).
- Link resolution: Markdown links `[..](rel.md)` relative to the file directory, plus `frontmatter.related` entries (`.md` relative, or `/org/...`). Map with `util.okf_file_to_org_path`.
- `write_draft(OKFDraft) -> KnowledgeChange` serializes YAML frontmatter (keeping unknown keys, `sort_keys=False`) + body. It creates or updates the file, and a `created`/`updated` change is decided by existence plus hash.
- Optional: `git add/commit` in `okf_dir` after ingest (message `ingest: <n> files`), which makes the bundle diffable.

### 6.2 Validation (`validation/`)
Rules. **error:** frontmatter fails `OKFFrontmatter`, broken link, duplicate path. **warning:** missing description, missing `index.md` in a directory, duplicate title, orphan file (no inbound links, except `index.md`).

### 6.3 Postgres schema (`indexing/schema.sql`, applied by `PgStore.migrate()`)
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS meta(key text PRIMARY KEY, value text);          -- embedding_model, embedding_dim
CREATE TABLE IF NOT EXISTS okf_objects(
  path text PRIMARY KEY, okf_file text NOT NULL, type text, title text, privacy text, trust text,
  tags text[], frontmatter jsonb, body text, content_hash text, version int DEFAULT 1, updated_at timestamptz);
CREATE TABLE IF NOT EXISTS chunks(
  chunk_id text PRIMARY KEY, path text REFERENCES okf_objects(path) ON DELETE CASCADE, ord int,
  heading text, text text,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(heading,'') || ' ' || text)) STORED,
  embedding vector(__DIM__));
CREATE INDEX IF NOT EXISTS chunks_tsv ON chunks USING gin(tsv);
CREATE INDEX IF NOT EXISTS chunks_vec ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE TABLE IF NOT EXISTS edges(src text, dst text, relation text, weight real DEFAULT 1,
  PRIMARY KEY (src, dst, relation));
CREATE TABLE IF NOT EXISTS memories(
  memory_id text PRIMARY KEY, kind text, scope text, org_id text, owner text, task_id text,
  content text, summary text, derived_from text[], tags text[], importance real, stale bool DEFAULT false,
  created_at timestamptz, last_used_at timestamptz, embedding vector(__DIM__));
CREATE INDEX IF NOT EXISTS memories_derived ON memories USING gin(derived_from);
CREATE TABLE IF NOT EXISTS working_sets(pid int PRIMARY KEY, data jsonb, updated_at timestamptz);
```
`__DIM__` = `await models.embedding_dim()`. If `meta.embedding_dim` or `embedding_model` differs, drop `chunks`/`memories.embedding` and fully reindex (log a warning). Use psycopg 3 async (`AsyncConnectionPool`) + `pgvector.psycopg.register_vector_async`.

### 6.4 Indexing (`indexing/`)
- Chunk by `##` headings. Split sections longer than ~400 tokens (`util.estimate_tokens`) on paragraphs. `chunk_id = f"{path}#{ord}"`. Prepend the title to each chunk's text for embedding.
- Embed in batches of 32 via `models.embed`. Upsert `okf_objects`, then delete and insert the chunks for changed paths only (compare `content_hash`).
- Edges: `links_to` (body links), `related_to` (frontmatter.related), `owned_by` (frontmatter.owner → `/org/people/<owner>` if it exists), `decided_in` (a project linking to a decision).

### 6.5 Hybrid retrieval (`retrieval/`)
```text
search(q, principal):
  allowed_privacy = levels ≤ principal.max_privacy
  base filter (SQL): path under any q.scope prefix, privacy IN allowed_privacy, type/tags filters, trust ≥ q.min_trust
  lexical  : top 50 chunks by ts_rank(tsv, websearch_to_tsquery('english', q.text))
  semantic : top 50 chunks by embedding <=> query_vec
  graph    : neighbours (edges, both directions) of the top-5 objects from lexical ∪ semantic
  aggregate chunks → objects (best chunk = snippet); per-mode rank lists
  RRF: score = Σ_mode 1 / (60 + rank_mode); scores[mode] = normalised per-mode score in [0,1]
  scope filter in Python: util.path_allowed(path, principal.data_scopes) → drop + count filtered_by_policy
  (count objects removed ONLY by scope or privacy — not by the query's own filters)
  top_k → attach body → firewall.screen(hits) → strip body unless include_body → EvidenceSet(took_ms=…)
```
Include only modes listed in `q.modes`. Publish nothing here: the kernel publishes `knowledge.retrieved`.

### 6.6 Firewall (`firewall/`)
1. Regex/heuristics (start from `fakes._INSTRUCTION_PATTERNS` and extend them: imperative verbs aimed at "you/assistant/AI", "system note", role-play markers, credential exfiltration, destructive DB/file verbs).
2. Optional LLM classifier, only for `trust in (unverified, untrusted)` hits: `ModelRequest(task_class=classification, privacy=restricted, json_schema={"type":"object","properties":{"instruction_like":{"type":"boolean"},"span":{"type":"string"}},"required":["instruction_like"]})`. Cache by `content_hash`.
3. Optional: neutralise the snippet, e.g. `snippet = "[flagged instruction removed] " + facts_part`. Always keep the path and provenance.

### 6.7 Memory (`memory/`)
- `store`: embed `summary or content`, insert. `recall`: filter by org/kinds/scopes/owner/task/stale, then rank by `0.6·cosine + 0.3·keyword overlap + 0.1·importance`, `top_k`, and update `last_used_at`.
- `build_working_set(pid, goal, evidence, memories, budget)`: pinned goal → evidence by score → memories by rank until the budget is spent. Flagged evidence is wrapped as `<untrusted-data flags=…>…</untrusted-data>`. Persist to `working_sets`. `tokens_used ≤ budget` except for pinned items.
- `summarize(ids)`: LLM `task_class=summarization` → a new record with `derived_from=ids`.
- `consolidate(task_id)`: episodic records of the task with `importance ≥ 0.5` → one LLM-summarised semantic record per owner (`derived_from` = episodic ids + their sources). Publish `memory.consolidated {created}`.
- `invalidate(source)`: a recursive CTE over `derived_from`, set `stale=true`, and return owners as `affected_agents`:
```sql
WITH RECURSIVE dep(id) AS (
  SELECT memory_id FROM memories WHERE $1 = ANY(derived_from)
  UNION SELECT m.memory_id FROM memories m JOIN dep ON dep.id = ANY(m.derived_from))
UPDATE memories SET stale = true WHERE memory_id IN (SELECT id FROM dep) AND NOT stale
RETURNING memory_id, owner;
```
- `rehydrate(pid)`: load from `working_sets`.

### 6.8 Coherence (`coherence/`)
Subscribe to `knowledge.changed` → `memory.invalidate(path)` → `indexer.reindex([path])`. Optional: `watchfiles` over `okf_dir` publishes `knowledge.changed` for manual edits (debounce 500 ms). **Demo:** P4 adds `policies/security.md` v2 → the finance memory is marked stale → the UI shows `memory.invalidated`.

---

## 7. Web console spec (`apps/web`)

**Stack:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + `@xyflow/react` (React Flow) + TanStack Query. Bootstrap steps are in `apps/web/README.md`. All backend access goes through `lib/mosaic-client.ts`. The types come from `@mosaic/contracts`, and state transitions come from `ALLOWED_TRANSITIONS`.

**State model:** one `useTaskEvents(taskId)` hook opens `client.events(cb, {taskId})` and reduces events into `{ processes: Map<pid, {agent, state, ppid, usage, waiting_on}>, timeline: Event[], approvals, retrieved[], sandboxes, status }`. Snapshot data (`GET /agents`, `/approvals`) seeds it; events keep it live.

| # | Route / component | Data | Acceptance |
|---|---|---|---|
| W1 | `/` Composer + recent tasks | `POST /tasks`, `GET /tasks` | submitting navigates to `/tasks/[id]` |
| W2 | `/tasks/[id]` Timeline (left) | `/ws/events?task_id=` | every event type in `events.yaml` renders a readable line (icon, pid chip, summary); `agent.log` warnings highlighted; `knowledge.retrieved` expands to paths |
| W3 | `/tasks/[id]` Process tree (center) | `GET /agents/tree` + `process.*` events | React Flow tree; node colour by `AgentState`; badges for tokens and `waiting_on`; kill button → `POST /agents/{pid}/kill` |
| W4 | Approval center (drawer + `/approvals`) | `GET /approvals?status=pending`, `approval.*` events | shows capability, tool/operation, arguments (JSON), justification, **evidence paths**, risk, policy; approve/reject with a comment; toast on resolve. **The demo's key moment. Make it beautiful** |
| W5 | `/audit/[taskId]` Audit journal | `GET /audit/{task}` | vertical timeline grouped by kind + `TimelineStats` header ("5 agents · 17 knowledge objects · 1 privileged syscall · 1 approval") |
| W6 | `/knowledge` Explorer | `/knowledge/tree`, `/object`, `/search`, `/graph` | tree + Markdown view with frontmatter chips (privacy, trust, source); search results show per-mode score bars, provenance and a **red firewall badge**; small graph view |
| W7 | `/system` Monitor + sandbox view | `/system/status`, `/system/resources` (poll 2 s), `/sandboxes`, `sandbox.screenshot` events | component modes (fake/real) visible; GPU/CPU/RAM gauges; latest sandbox screenshot |
| W8 | Result panel on `/tasks/[id]` | `task.completed` + `GET /tasks/{id}` + `/tasks/{id}/artifacts` | rendered Markdown summary + artifact links |

**Design:** a dark "OS console" look, monospace PIDs, state colours consistent everywhere (RUNNING green, WAITING amber, FAILED red, COMPLETED grey, PAUSED blue). It must work at 1080p on a projector.

---

## 8. Ordered task list

| # | Task | Acceptance criteria |
|---|---|---|
| T1 | `indexing/` PgStore + schema migration + `okf/` OKFBundle | loads `shared/fixtures/okf`; the schema is created idempotently |
| T2 | `indexing/` Indexer (chunk, embed with FakeModelRouter, upsert, edges) | reindex of the fixtures completes; changed-hash detection works |
| T3 | `retrieval/` HybridRetriever + `graph/` + `kfs/` KnowledgeFS read/list/search/traverse + `factory.build_knowledge_service` | **`KnowledgeServiceContract` green** (Postgres from compose) |
| T4 | `firewall/` + `factory.build_context_firewall` | **`ContextFirewallContract` green**; the vendor email flagged through `search` |
| T5 | `memory/` MemoryManager + `factory.build_memory_service` | **`MemoryServiceContract` green** ← **M1 backend gate** |
| T6 | `validation/` + `kfs.validate` + `cli.py` (`mosaic-okf validate/search/reindex`) | the fixtures validate with no errors |
| T7 | `kfs.ingest` pipeline using `services.converters` (P4) | ingesting `knowledge/tests/samples/markdown` with `FakeMarkdownConverter` creates files + index + events |
| T8 | `coherence/` + consolidation | editing an OKF file → `knowledge.changed` → `memory.invalidated` |
| W1–W4 | UI: composer, timeline, process tree, approval center on the mock gateway | full Apollo replay visible; approving continues the run ← **M1 UI gate** |
| T9 | switch to real embeddings (P3 router), reindex; run under P1's kernel with `MOSAIC_MODE_KNOWLEDGE,MEMORY,FIREWALL=real` | e2e passes with real knowledge ← **M2** |
| W5–W8 | UI: audit, explorer, monitor, result; point it at the real gateway | every screen works on the real system ← **M3** |
| T10 | retrieval QA: 10 demo questions with expected top-3 paths as a test over `data/okf` (with P4) | ≥ 9/10 pass |
| S1 | stretch: NOOA adapter in `agents/mosaic_agents/adapters/nooa.py` (coordinate with P3's runtime) | finance-agent runs with `framework: nooa` |
| S2 | stretch: live invalidation demo (security policy v2) | shown in the UI |

## 9. Tests
- `knowledge/tests/test_contract.py` (already wired): knowledge, firewall and memory suites. They need Postgres: `docker compose -f infra/compose/docker-compose.yml up -d postgres`. Skip gracefully if the DB is unreachable (add that check to `_build`), so others' CI stays green.
- Your own tests: RRF ordering, scope counting, the chunker, the invalidation CTE, the working-set budget.
- UI: Playwright smoke test against the mock gateway (submit → approve → completed), optional.

## 10. Integration
- **With P3:** at M2, the real embedding model is fixed. When `embedding_dim` changes, your store must auto-reindex.
- **With P4:** converters (`services.converters`) and the demo bundle. You review retrieval quality on `data/okf` and give P4 content feedback ("add a doc about X").
- **With P1:** the kernel calls you with agent principals. P1 publishes `knowledge.retrieved` and must not double-screen: you screen in `search`.
- Review buddy for **P3**: review their router PRs, and pair on `OllamaProvider.embed` if embeddings are blocking you (it's about 20 lines).

## 11. Definition of done
Knowledge, firewall and memory suites green on Postgres · retrieval QA ≥ 9/10 on the demo bundle · ingest works with P4's converters · all UI screens working on the real gateway · the status table in `shared/services/P2-knowledge-console.md` updated.

## 12. Pitfalls
- Count `filtered_by_policy` only for scope/privacy removals. The UI shows it as "hidden by policy".
- Never return `body` when `include_body=False`, but always screen the full body.
- `websearch_to_tsquery` handles user input safely. Never string-format SQL.
- The HNSW index needs `vector` with a fixed dim, so create tables after you know the dim.
- UI: don't reorder events client-side by arrival time; sort by `ts`. Reconnect the WebSocket with backoff.
- Keep UI types imported from `@mosaic/contracts`. If a field is missing, it's a contract change, not a local type.
