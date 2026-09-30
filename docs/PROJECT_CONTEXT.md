# mOSaic: complete project context (hackathon edition)

Last updated 2026-09-30, `main` at `6e54a07`, contract **0.7.0**, 305 Python tests green, ruff clean.

This is the one document to read before working on mOSaic during the hackathon. It covers:
- what the system is and how the pieces fit;
- what is built and verified;
- how to run it;
- where everything lives;
- the rules;
- what is still open.

Deeper material is linked at the end.

Team during the hack:

| Person | Area | Who |
|---|---|---|
| **A** | Demo, ops, pitch; owns the demo laptop and merges to `main` | Kamal (@kamalllx) |
| **B** | Backend and agents: `kernel/`, `agents/`, `knowledge/`, `execution/`, `models/`, `shared/`, `data/`, `policies/` | see `docs/team/HACK-B-backend.md` |
| **C** | Frontend, mobile, README: `apps/web/`, `apps/mobile/`, `README.md`, `docs/readme/`, `docs/ui-revamp/` | see `docs/team/HACK-C-frontend.md` |

---

## 1. What mOSaic is

mOSaic is a self-hosted "AI operating system" for a company. It borrows the shape of a classic OS:

| OS idea | mOSaic |
|---|---|
| Filesystem | Company knowledge as `/org/...` paths, backed by OKF Markdown files (`data/okf/`) with front-matter (type, trust, links) |
| Processes | Agents run as processes with PIDs, parent/child tree, states (running, waiting, paused, killed...), quotas (tokens, tool calls, wall time) |
| Syscalls | Every action that changes the world (write Jira, write a file, open a browser) is a governed syscall: **policy → approval → sandboxed execution → verify → commit or rollback** |
| Kernel log | A hash-chained audit journal per task; the kernel can verify the chain |
| Page cache / coherence | Agent memories remember which documents they came from (`derived_from`); when a document changes, those memories go stale and are re-derived |
| Security boundary | A context firewall: retrieved text is data, never instructions. Untrusted and instruction-like text is flagged before agents read it |

Everything runs locally: one Python server (**mosaicd**) with a FastAPI gateway, a Next.js console, Docker sandboxes, Postgres with pgvector, Redis, and local models on Ollama. Private data never leaves the machine (`privacy=restricted` never goes to a remote model).

### The demo story: Project Apollo
The user types:

> Investigate why Project Apollo is over budget and six weeks behind schedule. Identify root causes, update the tracker, and prepare a recovery plan.

What happens:

1. The **planner agent** (PID 1 of the task) splits the job and spawns specialists: **finance**, **engineering**, **research**, **action**.
2. They search `/org` with hybrid retrieval. One hit is a vendor email containing a prompt injection (`/org/inbox/vendor-email-2026-09-12`). The firewall flags it UNTRUSTED/instruction-like, the timeline shows "treated as data, not instructions", and no agent acts on it.
3. Research opens vendor docs in a **browser sandbox** (no internet access, allowlisted URLs), taking screenshots.
4. The action agent requests `jira.write` (a comment on APOLLO-31). Policy says external writes need a human, so an **approval** pops up in the console (or on a phone). A human approves.
5. The write runs, is verified and committed. The audit journal shows the whole chain: "hash chain verified".
6. The Result tab shows a summary, **the three root causes** with citation chips, and recovery steps. The root causes are: dual-run cloud cost; the duplicate-recon-id backfill failure; PayCo certification plus the emergency contract. The cost is 6.2 lakh / 31% over.
7. **Invalidation moment:** edit `data/okf/finance/cloud-bill-2026-09.md`. Within about 0.1 s the finance memories go stale (toast naming finance-agent). Within about 3.5 s they are **re-derived** from the new text (a teal "re-derived" chip). Engineering's memories stay fresh. There is an optional variant: swap in `data/demo-assets/security-policy-v2.md`, which invalidates only finance memories.

A real run on the laptop takes about 33–51 s and scores **8/8** on `scripts/demo_run.py`.

---

## 2. Architecture

```
            Browser console (apps/web, :3000)     Phone: console or Expo app (apps/mobile)
                          │  HTTP + WebSocket /ws/events
                          ▼
  ┌──────────────────────── mosaicd (one Python process, gateway :8089 on the laptop) ─────────────────────────┐
  │ kernel/        gateway (FastAPI), tasks, process table, scheduler, syscalls, policy, approvals, quotas,       │
  │                transactions (commit/rollback), audit (hash chain), events bus, lifecycle (resume after crash) │
  │ agents/        runtime + library agents (planner, finance, engineering, research, action), manifests, IPC,   │
  │                adapters (NOOA)                                                                                │
  │ knowledge/     OKF ingestion, indexing (pgvector + lexical + graph), hybrid retrieval, context firewall,      │
  │                memory (derived_from, invalidation, re-consolidation), coherence (file watcher → reindex)      │
  │ models/        model router (task class → model), Ollama provider, GPU/resource probe                        │
  │ execution/     Docker sandbox manager (+ relay on Docker Desktop), tools (fs, jira, browser), connectors, MCP  │
  └──────────────┬──────────────────────┬──────────────────────┬───────────────────────┬────────────────────────┘
                 ▼                      ▼                      ▼                       ▼
        Postgres+pgvector (5434)   Redis (6380)       Ollama (11434, GPU)     Docker: sandbox-base, sandbox-browser,
                                                                              vendor-docs, mosaic_sandbox network
```

**Wiring:** `mosaicd/mosaicd/wiring.py` is the only place that imports implementations. Each component can be `fake` or `real` (`MOSAIC_DEFAULT_MODE`, `MOSAIC_MODE_<COMPONENT>`). `uv run mosaicd --print-wiring` shows what backs each service.

**Contracts:** `shared/python/mosaic_contracts/` holds everything that crosses a module boundary:
- `schema/`: Pydantic models such as Task, AgentProcess, SearchHit, MemoryRecord, Approval, Event and ModelRequest;
- `interfaces/`: typing Protocols;
- `testing/`: fakes and contract test suites;
- `wiring.py`: `Settings`, the only config object;
- `util`: shared semantics like `path_allowed` and `privacy_allows`.

`shared/ts` generates the TypeScript types (`@mosaic/contracts`) used by the console and the mobile app. Catalogs in `shared/catalogs/` list events, syscalls, capabilities and error codes.

**Contract history:**

| Version | Change |
|---|---|
| 0.4.0 | Handoff baseline |
| 0.5.0 | `Settings.models_config` (`MOSAIC_MODELS_CONFIG`) |
| 0.6.0 | `RunTimeline.chain_verified` |
| 0.7.0 | `EmbedRequest.input_type` (`query` / `document`) for nomic prefixes |
| 0.8.0 | `Settings.firewall_llm` (`MOSAIC_FIREWALL_LLM`); new flag value `instruction_like_llm` |

---

## 3. Status: what is built and verified

### Backend
| Feature | State | Where |
|---|---|---|
| Kernel: tasks, process table, scheduler, quotas, checkpoints, resume after kill | Done, verified (kill mosaicd mid-run → restart resumes) | `kernel/mosaic_kernel/*` |
| Governed syscalls: policy → approval → sandbox → verify → commit/rollback | Done | `kernel/.../syscalls`, `policy`, `approvals`, `transactions`; `policies/*.yaml` |
| Audit hash chain + `chain_ok()` verdict on `/audit/{task}` | Done (0.6.0) | `kernel/.../audit` |
| Planner: top-3 root causes (dedup, rank), recovery plan list | Done | `agents/mosaic_agents/library/planner.py` (`_top_root_causes`) |
| Engineering slip grounded in evidence (`grounded_slip()`) | Done | `agents/.../library/engineering.py` |
| Finance consults `/org/policies` (policy-v2 demo invalidates finance only) | Done | `agents/manifests/finance-agent.yaml`, `library/finance.py`, `policies/finance-agent-v1.yaml` |
| NOOA adapter: object agents (public async methods with docstrings = skills; model picks one) | Done, tested | `agents/mosaic_agents/adapters/nooa.py` |
| Hybrid retrieval (lexical + pgvector + graph) | 10/10 QA, MRR 0.90; semantic-only 10/10 (0.83 → 0.90 with nomic prefixes) | `knowledge/mosaic_knowledge/retrieval`, `indexing/store.py` (`EMBED_SCHEME="qd1"`) |
| Context firewall: regex (always on) | Catches the demo vendor email | `knowledge/mosaic_knowledge/firewall/__init__.py` |
| Context firewall: LLM classifier (opt-in) | Prompt improved, temperature 0: 3–4 of 5 reworded injections the regex misses, 0 false positives on the bundle, ~0.2 s/doc. Off by default; `MOSAIC_FIREWALL_LLM=true` turns it on (0.8.0); its catches add the flag `instruction_like_llm` | same file; `knowledge/mosaic_knowledge/factory.py` |
| Memory with `derived_from`, invalidation on source change | Done (stale in ~0.1 s) | `knowledge/.../memory`, `coherence` |
| Re-consolidation: stale memories re-derived from new text | Done (~3.5 s); tags `reconsolidated`, `replaces:<old id>`; event `memory.consolidated` with source `memory.reconsolidate` | `memory.reconsolidate()`, `coherence._on_changed` |
| Model router + Ollama provider, nomic `search_query:`/`search_document:` prefixes | Done (0.7.0) | `models/mosaic_models/*`, `models/models.yaml`, `models/models.7b-only.yaml` |
| Docker sandboxes, network=none by default; browser sandbox with **no internet on Docker Desktop** (relay container publishes the port) | Done, live test | `execution/mosaic_execution/sandbox/docker_manager.py` (`RELAY_SOURCE`, `relay_kwargs`) |
| In-process mock Jira (`MOSAIC_JIRA_URL=inprocess`) | Done | `execution/.../connectors` |

### Console (`apps/web`, Next.js 16, Tailwind v4, next-themes, React Query, React Flow)
| Screen | URL | What it shows |
|---|---|---|
| Boot | `/boot` | Full-screen startup checklist; moves to Home when ready (kiosk start) |
| Home | `/` | Composer with priority, pending approvals, running/recent tasks, live system strip, knowledge count |
| Tasks | `/tasks` | All tasks |
| Task | `/tasks/<id>` | Live tab (timeline, process tree with inspector: quotas, capabilities, model), approval drawer (opens itself), sandboxes + screenshots, **Result** tab (summary, 3 root causes with citation chips, recovery steps, committed actions) |
| Approvals | `/approvals` | Approval center; full-screen card on phones |
| Audit | `/audit`, `/audit/<task>` | Stat tiles, PID and kind filters, chronological or grouped, hash snippets, "chain intact"/verified verdict |
| Knowledge | `/knowledge?path=...` | Three panes: tree, document (links to / linked from), search rail; theme graph; Reindex |
| Memory | `/memory` | Memories with sources; stale chip; teal "re-derived" chip and "replaces MEM-…"; invalidation toasts |
| Agents | `/agents` | Read-only registry of manifests and tools |
| System | `/system` | Bar gauges (CPU, RAM, GPU, VRAM), components and modes, models table, sandbox cards |

Key frontend pieces:
- `components/global-events.tsx` is the one app-level WebSocket subscription. It handles approvals, knowledge changes, memory invalidation and re-derivation toasts.
- `lib/mosaic-client.ts` is the API client.
- `lib/gateway-url.ts` works out the gateway URL at runtime, from the page's host, so phones work.
- `lib/tones.ts` is the colour-tone map.
- `lib/process-layout.ts` lays out the process tree (tested).
- `app/globals.css` holds the design tokens.
- Unit tests use vitest: `npm test`.
- UI revamp before/after screenshots are in `docs/ui-revamp/`.

### Mobile (`apps/mobile`, Expo SDK 57)
There are three tabs: Approvals (polls every 2 s), Compose, and Settings (gateway URL, headers). The web build was tested end to end against the real stack at a 390 px viewport (compose → approve → complete). `npm run typecheck` passes on 0.7.0. It has **not yet been tried in Expo Go on a real phone.**

### Ops and scripts
| Script | Purpose |
|---|---|
| `scripts/win/mosaic-boot.ps1` | Starts Docker services, Ollama with the 7B loaded, mosaicd, console; opens `/boot` in Edge kiosk |
| `scripts/win/reset-demo.ps1` | Restarts mosaicd (resets mock Jira), empties memories/working sets, runs preflight |
| `scripts/win/restart-ollama.ps1` | Kills orphan `llama-server.exe` runners holding VRAM, reloads the 7B, prints tok/s |
| `scripts/win/start-mosaicd.ps1`, `start-console.ps1` | Individual starts (console rebuilds if stale) |
| `scripts/win/phone-access.ps1` | (admin) LAN URL + QR, firewall rule for Private network; `-Remove` afterwards |
| `scripts/win/mosaic-shutdown.ps1` | Stop (`-All` also stops Ollama and containers) |
| `scripts/win/common.ps1` + `local.ps1` | Shared env; `local.ps1` is git-ignored per-machine overrides |
| `scripts/preflight.py` | Checks readiness, components real, models, ≥ 25 tok/s fully on GPU, sandboxes, bundle, search. Must print "all green" |
| `scripts/demo_run.py run --auto-approve` / `check <task>` | Runs and scores a task out of 8. `--scenario zeus` runs the second scenario (Project Zeus Q4 budget risk, its own 8 checks); with `MOSAIC_FIREWALL_LLM=true` add `--expect-llm-flag` for a ninth |
| `scripts/check_okf.py`, `ingest_raw.py`, `browser_smoke.py`, `context_pack.py` | Bundle validation, raw → OKF ingest, browser sandbox smoke, agent context pack |

---

## 4. The data bundle (`data/okf/`)

The data is a fictional company, "acme", with these folders:
- `projects/`: apollo, atlas, hermes, iris, zeus;
- `finance/`: apollo-budget, the cloud bills for 2026-08 and 2026-09, payroll, q3-forecast, vendor-contracts, zeus-budget;
- `engineering/`: apollo status W36/W37, the backfill-failure postmortem, the reconciliation parity report;
- `jira/`: APOLLO-12 … 35;
- `decisions/`: ADR-039/042/045;
- `meetings/`: two steering meetings;
- `people/`, `playbooks/`, `policies/` (approvals, data-access, security), `systems/`;
- `slack/`: apollo-eng, finance-ops, vendor-payco;
- `inbox/`: the CTO escalation, the finance cloud alert, and the **vendor email carrying the injection**.

Each file has YAML front-matter (`type`, `trust`: verified/unverified/untrusted, links). Raw sources are in `data/raw/`, and demo swap files are in `data/demo-assets/`. Validate with `uv run python scripts/check_okf.py`. Don't edit `shared/fixtures/okf/`: it's frozen test data.

Reset after the invalidation demo: `git checkout data/okf/finance/cloud-bill-2026-09.md`.

---

## 5. API (gateway)

Every request carries the headers `X-Mosaic-User` and `X-Mosaic-Org`. The OpenAPI spec is `shared/api/openapi.json`.

| Group | Endpoints |
|---|---|
| System | `GET /health`, `/system/status`, `/system/resources`, `/models` |
| Tasks | `POST /tasks` `{goal, priority}`, `GET /tasks`, `GET /tasks/{id}`, `POST /tasks/{id}/cancel`, `/resume`, `/checkpoint`, `GET /tasks/{id}/artifacts[/{name}]` |
| Agents | `GET /agents`, `/agents/tree`, `POST /agents/spawn`, `GET /agents/{pid}`, `POST /agents/{pid}/pause`, `/resume`, `/kill`, `/checkpoint` |
| Registry | `GET /registry/agents`, `/registry/tools` |
| Knowledge | `GET /knowledge/search?q=&top_k=`, `/knowledge/tree`, `/knowledge/object?path=`, `/knowledge/graph`, `POST /knowledge/ingest`, `/knowledge/reindex`, `/knowledge/validate` |
| Memory | `GET /memory[?task_id=]` |
| Governance | `GET /approvals[?status=pending]`, `POST /approvals/{id}/approve`, `/reject`, `GET /audit/{task_id}`, `GET /policies` |
| Execution | `GET /sandboxes` |
| Events | `WS /ws/events`. Event types are in `shared/catalogs/events.yaml`: task.*, process.*, agent.log, syscall.*, approval.*, transaction.*, audit.appended, ipc.message, knowledge.changed/reindexed/retrieved, memory.invalidated/consolidated, model.invoked, sandbox.*, tool.*, system.* |

**Mock gateway:** `uv run mosaic-mock-gateway --speed 4 --port 8080` replays a full Apollo run without models, Docker or a GPU. Use it for all UI work. It is also the demo fallback.

---

## 6. Running it

### 6.1 Install (any machine)
```bash
uv sync --all-packages --all-extras        # Python 3.12 workspace (+ markitdown for the document converter)
npm --prefix apps/web ci
npm --prefix apps/mobile ci                # only if working on mobile
cp .env.example .env                       # keep MOSAIC_DEFAULT_MODE=fake in .env; tests read it
```

### 6.2 UI work without a GPU (Person C)
```bash
uv run mosaic-mock-gateway --speed 4 --port 8080
cd apps/web && NEXT_PUBLIC_MOSAIC_URL=http://localhost:8080 npx next dev -p 3002
```

### 6.3 Backend work: tests
- `uv run pytest -q` runs everything. Real-model tests (retrieval QA with real embeddings, the firewall LLM test) **skip themselves when Ollama isn't reachable**. Real Postgres tests need `MOSAIC_DATABASE_URL` in `.env` pointing at a pgvector database (they create `mosaic_real` / `mosaic_qa` themselves).
- Postgres + Redis without the whole stack: `docker compose -f infra/compose/docker-compose.yml up -d postgres redis`. Set `MOSAIC_PG_PORT` / `MOSAIC_REDIS_PORT` if 5432/6379 are taken.
- Models (if you have a GPU with ≥ 8 GB): `ollama pull qwen2.5:7b-instruct` and `ollama pull nomic-embed-text`, and use `MOSAIC_MODELS_CONFIG=./models/models.7b-only.yaml`.

### 6.4 The real stack (the demo laptop, Person A)
- `scripts\win\mosaic-boot.ps1`; before each rehearsal `scripts\win\reset-demo.ps1`; `uv run python scripts/preflight.py --gateway http://127.0.0.1:8089`.
- Laptop ports:
  - Postgres **5434**, Redis **6380**;
  - gateway **8089**;
  - console **3000** (production build) and **3002** (dev);
  - mock gateway **8080**;
  - mobile web **8095**;
  - Ollama **11434**.
- Ollama env: `OLLAMA_KEEP_ALIVE=-1`, `OLLAMA_CONTEXT_LENGTH=8192`, `OLLAMA_MAX_LOADED_MODELS=2`, `OLLAMA_FLASH_ATTENTION=1`, `OLLAMA_KV_CACHE_TYPE=q8_0`.
- If generation drops to ~10 tok/s (instead of 55–65), orphan runners hold VRAM: run `restart-ollama.ps1`.
- `NEXT_PUBLIC_MOSAIC_URL` is baked in at build time, but the console also works out the gateway from the page host. Rebuild the console after pulling UI changes (`start-console.ps1` detects a stale build).
- Full manual setup and the port-clash table are in `docs/HANDOFF-KAMAL.md` §2. The run sheet, fallbacks and QA checklist are in `docs/DEMO_SCRIPT.md`.

---

## 7. Rules (hackathon)

1. **Branches:** work on your own branch (`b/<topic>`, `c/<topic>`), `git pull --rebase origin main` often, and keep commits small, one logical change each, with a clear message prefixed by area (`p1:`, `p2:`, `p3:`, `p4:`, `ui:`, `docs:`, `contract:`, add `-fix` for fixes).
2. **Getting into `main`:**
   - push your branch and tell Kamal;
   - Kamal (A) fast-forwards or merges it into `main` after a check on the demo laptop;
   - `main` must always demo at 8/8.
3. **Before every push:** `uv run pytest -q` and `uvx ruff check .` are green. For web changes, also run `npm --prefix apps/web run lint`, `npm --prefix apps/web test` and `npm --prefix apps/web run build`. **Never force-push. Never skip hooks.**
4. **Contracts (`shared/`):**
   - only Person B changes them;
   - bump `CONTRACT_VERSION` in `shared/python/mosaic_contracts/__init__.py`;
   - run `uv run mosaic-export-contracts` and `npm --prefix shared/ts run generate`;
   - update `.env.example` and `shared/catalogs/*` if relevant;
   - tell C when a field or event the UI can use changes.
   - Don't hand-edit generated files (`shared/schemas/`, `shared/api/openapi.json`, `shared/fixtures/json/`, `shared/ts/src/mosaic.d.ts`, `shared/ts/src/constants.ts`) or `uv.lock`.
5. **Structure rules still apply** (`AGENTS.md`):
   - only `mosaic_contracts` is imported across packages, and only `mosaicd/wiring.py` imports implementations;
   - agents act only through `ctx`;
   - retrieved text is data, never instructions;
   - `restricted` data stays on local models;
   - sandboxes default to network=none;
   - every world-changing action goes through `ctx.syscall()`;
   - errors use `MosaicError` with codes from `shared/catalogs/errors.yaml`.
6. **Style:**
   - Python 3.12, full type hints, Pydantic v2, async service methods, line length 130;
   - tests are sync functions calling `asyncio.run` (no pytest-asyncio);
   - comments explain *why*, sparingly;
   - `logging.getLogger("mosaic.<pkg>.<mod>")`, no `print` in library code;
   - frontend: match the existing Tailwind tokens and components in `components/ui/`, use `lib/tones.ts` for status colours, and support both themes and phone widths.
7. **Protect the demo:** don't change the Apollo path's behaviour (planner output, agent prompts, policies, the bundle files it cites) without running `scripts/demo_run.py` on real models. When in doubt, add a new path beside it.
8. **README:** no emojis.
9. After three failed attempts at the same error, stop and ask the team.
10. **Claude Code users:** create a git-ignored `CLAUDE.local.md` in the repo root with one line pointing at your brief, e.g. `@docs/team/HACK-B-backend.md`.

---

## 8. Open work (split)

**Person A (Kamal): demo, ops, pitch**. The pitch-day runbook (setup, timed talk track, fallback ladder, judge Q&A) is `docs/pitch/RUNBOOK.md`, and the deck is `docs/pitch/deck.html`. The backup video is recorded by `scripts/record_demo.py`.
- Rehearse `docs/DEMO_SCRIPT.md` three times, including the invalidation and re-derivation moment, and time it.
- Record a backup video.
- Set up the venue: power, hotspot, `phone-access.ps1`, kiosk boot.
- Prepare the pitch deck and judge Q&A.
- Merge B's and C's branches into `main` and re-check 8/8 after each merge.

**Person B: backend and agents** (brief: `docs/team/HACK-B-backend.md`)
1. Done on `b/hackathon`: a setting to turn the LLM firewall classifier on (`MOSAIC_FIREWALL_LLM`, contract 0.8.0).
2. Done on `b/hackathon`: a second demo scenario, Project Zeus Q4 budget risk (`demo_run.py --scenario zeus`; talk track in `docs/DEMO_SCRIPT.md`).
3. Robustness from rehearsals: timeouts, planner on non-Apollo goals, clear error events.
4. Stretch: expose re-consolidation status via the API, or a kernel/CLI polish item.

**Person C: frontend, mobile, README** (brief: `docs/team/HACK-C-frontend.md`)
1. Refresh `README.md` with the new features (re-derivation, LLM firewall, NOOA, phone/mobile, kiosk boot). No emojis.
2. Console polish for judges: empty, loading and error states on every page; firewall-flag visibility; re-derivation moment on the Memory page.
3. Expo Go on a real phone against the laptop.
4. Refresh the screenshots in `docs/ui-revamp/after/` and `docs/readme/screens/`.

**Known limits / not planned:**
- The appliance installer (`infra/appliance/install.sh`) has never been run on a real node.
- No OpenShell/microVM sandbox backend.
- No login (use your own hotspot only).
- The `preflight.sh` script is Linux-only; use `preflight.py`.

---

## 9. History (how we got here)

1. **M0–M3:** four splits built the kernel/execution (P1), knowledge/memory/console (P2), agents/models (P3) and platform/data/demo (P4) against shared contracts. Integration landed on `main` at contract 0.4.0 (see `docs/HANDOFF-KAMAL.md`).
2. **Handoff (2026-09-28):** Kamal took over all four areas; the demo moved to his laptop (RTX 5070 Laptop, 8 GB) on qwen2.5:7b.
3. **Demo hardening:**
   - top-3 root causes;
   - grounded engineering slip;
   - finance consults policies;
   - configurable model file (0.5.0);
   - Windows scripts and `preflight.py`;
   - `demo_run.py` 8/8 gate;
   - configurable compose ports.
4. **UI revamp**, done in tiers on `ui/revamp` and merged: every page rebuilt; boot, tasks, audit, agents, knowledge and system screens; phone layouts; the gateway URL from the page host; the audit chain verdict (0.6.0).
5. **Retrieval:** nomic prefixes (0.7.0), and a real-embeddings QA at 10/10.
6. **Sandbox:** the browser has no internet access on Docker Desktop (relay).
7. **Stretch items:** re-consolidation plus UI; the NOOA adapter; the mobile app exercised end to end; an improved LLM firewall classifier.
8. **Public:**
   - GitHub `github.com/Kamalllx/mOSaic`;
   - website `mosaic-os-black.vercel.app`;
   - the demo video and explainer are linked in `README.md`.

---

## 10. Where to read more
| What | Where |
|---|---|
| Rules for any agent in the repo | `AGENTS.md`, nested `*/AGENTS.md` |
| Full design and plan | `Mosaic_Preoject_Description.md`, `docs/MASTER_PLAN.md`, `docs/FOLDER_STRUCTURE.md` |
| Handoff, laptop setup, port clashes | `docs/HANDOFF-KAMAL.md` |
| Demo run sheet, fallbacks, known limits | `docs/DEMO_SCRIPT.md` |
| Per-area service status | `shared/services/P1…P4-*.md` |
| Original per-area briefs | `docs/team/P1…P4-*.md` |
| Contract rules | `shared/README.md` |
| Env variables | `.env.example` |
| UI revamp record | `docs/ui-revamp/README.md` |
| Mobile | `apps/mobile/README.md` |
