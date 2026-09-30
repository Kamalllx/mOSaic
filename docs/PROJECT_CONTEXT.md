# mOSaic: complete project context

Last updated 2026-09-30 (evening), for phase 2 of the hackathon. Read this first, then your own brief in `docs/team/PHASE2-*.md`.

State of the code:
- **`main` (`e356d0b`)**: the demo-safe snapshot. It has the old console layout, contract **0.8.0**, 313 Python tests and 65 web tests.
- **`ui/desktop`**: the console rebuilt as a desktop OS (windows, dock, launcher). This is **the base branch for phase 2**: branch from it, and merge back into it.
- **Demo**: the scored Apollo run passes **8/8** on real models on both branches.

---

## 1. What mOSaic is

mOSaic is a self-hosted operating system for a company's AI. It borrows the shape of a classic OS:

| OS idea | mOSaic |
|---|---|
| Filesystem | Company knowledge as `/org/...` paths, backed by OKF Markdown files (`data/okf/`) with front-matter (type, trust, privacy, links) |
| Processes | Agents are processes. Each has a PID, a parent, a state (running, waiting, paused, killed) and quotas (tokens, tool calls, wall time) |
| Syscalls | Every world-changing action (write Jira, write a file, open a browser) is a governed syscall: **policy → approval → sandboxed execution → verify → commit or rollback** |
| Kernel log | A hash-chained audit journal per task; the kernel verifies the chain |
| Cache coherence | Memories record the documents they came from (`derived_from`). When a document changes, those memories go stale and are re-derived from the new text |
| Protection boundary | A context firewall: retrieved text is data, never instructions. Untrusted or instruction-like text is flagged before agents read it |

Everything runs locally:
- one Python server, **mosaicd**, with a FastAPI gateway;
- a Next.js console;
- Docker sandboxes;
- Postgres with pgvector, and Redis;
- local models on Ollama.

Data marked `restricted` never goes to a remote model.

### The demo: Project Apollo
Goal: *"Investigate why Project Apollo is over budget and six weeks behind schedule. Identify root causes, update the tracker, and prepare a recovery plan."*

1. The planner (the task's first process) forks specialists: finance, engineering, research and action.
2. They search `/org` with hybrid retrieval. A vendor email containing a prompt injection is flagged UNTRUSTED, and no agent acts on it.
3. Research opens vendor docs in a browser sandbox with no internet access.
4. The action agent requests `jira.write`. Policy requires a human, so the kernel blocks until someone approves from the console, a notification or a phone.
5. The write runs, is verified and committed. The audit chain is verified.
6. Result: three cited root causes (dual-run cloud cost; the duplicate-recon-id backfill failure; PayCo certification plus the emergency contract), an overrun of 6.2 lakh / 31%, and a recovery plan.
7. Edit `data/okf/finance/cloud-bill-2026-09.md`. Within about 0.1 s the finance memories go stale and engineering's stay fresh. Within about 3.5 s the local model re-derives them.

A run takes about 48–51 s on the demo laptop (RTX 5070 Laptop, 8 GB, qwen2.5:7b at about 57 tok/s). `scripts/demo_run.py` scores it out of 8.

---

## 2. Architecture

```
  Console (apps/web, Next.js desktop, :3000)      Phone (apps/mobile, Expo)      CLI (ai-*)
                      │  HTTP + WebSocket /ws/events
                      ▼
  ┌───────────────────────── mosaicd (one Python process; gateway :8089 on the laptop) ────────────────────────┐
  │ kernel/     gateway (FastAPI), tasks, process table, scheduler, syscalls, policy, approvals, quotas,          │
  │             transactions (commit/rollback), audit hash chain, event bus, lifecycle (resume after a crash)     │
  │ agents/     runtime, library agents (planner, finance, engineering, research, action), manifests, IPC,        │
  │             registry (loads agents/manifests/*.yaml), adapters (NOOA)                                         │
  │ knowledge/  ingestion + converters, indexing (pgvector + lexical + graph), hybrid retrieval, context firewall   │
  │             (regex + optional LLM classifier), memory (derived_from, invalidation, re-derivation), coherence   │
  │ models/     router (task class and privacy → model), Ollama provider, GPU probe                               │
  │ execution/  Docker sandbox manager (+ relay on Docker Desktop), tools, connectors (Jira, mock Jira), MCP       │
  │             backend, headless browser                                                                         │
  └──────────────┬──────────────────────┬──────────────────────┬───────────────────────┬────────────────────────┘
                 ▼                      ▼                      ▼                       ▼
        Postgres + pgvector      Redis (events)       Ollama (GPU)          Docker: sandbox-base, sandbox-browser,
                                                                              vendor-docs, mosaic_sandbox network
```

- **Wiring:** `mosaicd/mosaicd/wiring.py` is the only place that imports implementations. Each component is `fake` or `real`: `MOSAIC_DEFAULT_MODE`, or `MOSAIC_MODE_<COMPONENT>` for one component. `uv run mosaicd --print-wiring` lists them. Fake mode needs no GPU, no Docker and no Ollama.
- **Contracts:** everything that crosses a module boundary lives in `shared/python/mosaic_contracts/`:
  - `schema/`: Pydantic models;
  - `interfaces/`: Protocols;
  - `testing/`: fakes and contract suites;
  - `wiring.py`: `Settings`, the only config object;
  - `util`: shared semantics such as `path_allowed` and `privacy_allows`.

  `shared/ts` generates the TypeScript types (`@mosaic/contracts`) used by the web and mobile apps. `shared/catalogs/` lists the events, syscalls, capabilities and error codes.
- **Contract history:**

  | Version | Change |
  |---|---|
  | 0.4.0 | Handoff baseline |
  | 0.5.0 | `Settings.models_config` |
  | 0.6.0 | `RunTimeline.chain_verified` |
  | 0.7.0 | `EmbedRequest.input_type` (nomic query/document prefixes) |
  | 0.8.0 | `Settings.firewall_llm` (`MOSAIC_FIREWALL_LLM`), the `instruction_like_llm` flag |
- **Identity today:** there is none to speak of. The gateway trusts the `X-Mosaic-User` / `X-Mosaic-Org` headers (default `alice` / `acme`). There is no login, and there are no org or member tables. Policies are per agent (`policies/*.yaml`), not per user role. Phase 2 replaces this.

---

## 3. What is built and verified

### Backend
| Feature | Where |
|---|---|
| Kernel: tasks, process table, scheduler, quotas, checkpoints, resume after kill (verified by killing mosaicd mid-run) | `kernel/mosaic_kernel/*` |
| Governed syscalls: policy, approval, sandbox, verify, commit/rollback | `kernel/.../syscalls`, `policy`, `approvals`, `transactions`; `policies/*.yaml` (`default-v1`: `jira.write` requires approval) |
| Audit hash chain, and the kernel's `chain_verified` verdict | `kernel/.../audit` |
| Planner: top-3 cited root causes and a recovery plan | `agents/mosaic_agents/library/planner.py` |
| Fixed library agents (planner, finance, engineering, research, action) from manifests | `agents/manifests/*.yaml`, `agents/mosaic_agents/library/`, `registry/` |
| NOOA adapter: object-style agents run as governed processes | `agents/mosaic_agents/adapters/nooa.py` |
| Hybrid retrieval: 10/10 on the QA set, MRR 0.90 | `knowledge/mosaic_knowledge/retrieval`, `indexing/store.py` |
| Firewall: regex always on; LLM classifier opt-in via `MOSAIC_FIREWALL_LLM=true` (3–4 of 5 reworded injections, 0 false positives) | `knowledge/mosaic_knowledge/firewall/` |
| Memory with `derived_from`, invalidation (~0.1 s) and re-derivation (~3.5 s). A finance finding derives from every finance document it read | `knowledge/.../memory`, `coherence`; `agents/.../library/finance.py` |
| Ingestion: `POST /knowledge/ingest` takes a **URI**; converters for Markdown, PDF/DOCX (markitdown), CSV, Slack export and Jira JSON. **No upload endpoint and no ingestion UI yet** | `knowledge/mosaic_knowledge/ingestion/` |
| Browser tool in a sandbox with no internet; an MCP backend; Jira connector plus an in-process mock | `execution/mosaic_execution/{browser,mcp,connectors}` |

### Console
There are two branches:
- **`main`**: the older page-based console (sidebar and pages), used in the recorded demo video and in the deck.
- **`ui/desktop`**: the console as a desktop OS. Kamal is re-skinning it in phase 2 (Mac-like, light, colourful), but the **structure is stable**, so build on it.

`ui/desktop` contains:
- **Desktop:** a wallpaper, a menu bar, a dock and a composer on the empty desktop.
- **Windows:** you can drag, resize, maximise, minimise and close them. Each app lays out by its **window's** width, using container queries (`@3xl:` and so on, not `md:`).
- **The URL picks the window in front:** every existing link, deep link and demo script still works.
- **Wallpaper mosaic:** one tile per /org document. Tiles flare on `knowledge.retrieved`, red when flagged and amber when stale.
- **Launcher (Ctrl+K)** and **approval notifications** with Approve and Reject on the card.
- **Terminal app:** `ai-ps`, `ai-top`, `ai-run`, `ai-approve`, `ai-kill`, `ai-audit`, and `ls`/`cd`/`cat`/`search` over /org.
- **Thinking orbs** (`thinking-orbs`) for every loading state and on each process node, showing what that agent is doing.
- **Boot screen:** a large live orb with the service checklist.
- **Apps:** Tasks, Task (live run: timeline, process tree, inspector, result), Approvals, Knowledge, Memory, Audit, Agents, System, Terminal.

### Mobile (`apps/mobile`, Expo SDK 57)
There are three tabs: Approvals, Compose and Settings (the gateway URL). It has safe areas, background-aware polling and a risk badge. It has **no login**. The web build was tested end to end against the real stack; it has **not been run on a real device or emulator**, and no APK has been built.

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
| `scripts/record_demo.py` | Records the captioned backup video through the console |

The pitch kit is in `docs/pitch/`: `deck.html` and `RUNBOOK.md` (talk track, fallbacks, judge Q&A).

---

## 4. The console's structure (`ui/desktop`), and how to add an app

| Piece | File |
|---|---|
| URL → app and window key; app titles and sizes | `apps/web/lib/desktop/routes.ts` (`STATIC`, `APPS`) |
| Window manager (a pure reducer, tested) | `apps/web/lib/desktop/windows.ts` |
| The desktop shell (URL sync, windows, dock, launcher) | `apps/web/components/desktop/desktop.tsx` (`AppBody` switch) |
| Window chrome, dock, menu bar, notifications, launcher, wallpaper | `apps/web/components/desktop/*.tsx` |
| App icons and tints | `apps/web/components/desktop/app-icons.tsx` |
| The apps | `apps/web/components/apps/*.tsx` |
| A window's own URL (use instead of `useSearchParams` and `useRouter`) | `apps/web/components/desktop/window-context.tsx` (`useWindowNav`, `useWindowParams`) |
| Route markers (return null; the desktop reads the URL) | `apps/web/app/<route>/page.tsx` |
| Orbs and loading states | `apps/web/components/desktop/orb.tsx` (`Orb`, `Loading`), `big-orb.tsx`, `lib/desktop/orb.ts` |
| Design tokens (colours, radii, shadows) | `apps/web/app/globals.css`. Always use tokens: Kamal's re-skin changes their values |

**To add an app** (for example Organization, Connections, Ingest or Settings):
1. Add an `AppId`, a `STATIC` route and an `APPS` entry in `routes.ts`, plus a test line in `windows.test.ts`.
2. Add an icon and tint in `app-icons.tsx`.
3. Create the component in `components/apps/<name>.tsx`. Use `useWindowNav().navigate(url)` for in-window navigation, and use container-query breakpoints.
4. Add a route marker at `app/<route>/page.tsx` (copy an existing one).
5. Add a case to the `AppBody` switch in `desktop.tsx`, and the app to `DOCK` in `dock.tsx`.

---

## 5. API (gateway) and events

Every request carries `X-Mosaic-User` and `X-Mosaic-Org` today; phase 2 adds real sessions. The OpenAPI spec is `shared/api/openapi.json`.

| Group | Endpoints |
|---|---|
| System | `GET /health`, `/system/status`, `/system/resources`, `/models` |
| Tasks | `POST /tasks {goal, priority}`, `GET /tasks`, `GET /tasks/{id}`, `POST /tasks/{id}/cancel`, `/resume`, `/checkpoint`, `GET /tasks/{id}/artifacts[/{name}]` |
| Agents | `GET /agents[?task_id]`, `/agents/tree`, `POST /agents/spawn`, `GET /agents/{pid}`, `POST /agents/{pid}/pause`, `/resume`, `/kill`, `/checkpoint` |
| Registry | `GET /registry/agents`, `/registry/tools` |
| Knowledge | `GET /knowledge/search`, `/knowledge/tree?path` (one level), `/knowledge/object?path`, `/knowledge/graph`, `POST /knowledge/ingest {source_type, uri, target_path}`, `/knowledge/reindex`, `/knowledge/validate` |
| Memory | `GET /memory[?owner&task_id]` |
| Governance | `GET /approvals[?status]`, `POST /approvals/{id}/approve`, `/reject`, `GET /audit/{task_id}`, `GET /policies` |
| Execution | `GET /sandboxes` |
| Events | `WS /ws/events?types=...`, listed in `shared/catalogs/events.yaml`: task.*, process.*, agent.log, syscall.*, approval.*, transaction.*, audit.appended, ipc.message, knowledge.changed/reindexed/retrieved (`paths`, `flagged`), memory.invalidated/consolidated, model.invoked, sandbox.*, tool.*, system.* |

`uv run mosaic-mock-gateway --speed 4 --port 8080` replays a full Apollo run without a GPU, Docker or models. Use it for UI work.

---

## 6. Running it

- **Install:** `uv sync --all-packages --all-extras`, then `npm --prefix apps/web ci`, then `npm --prefix apps/mobile ci`, then `cp .env.example .env` (keep `MOSAIC_DEFAULT_MODE=fake` there; tests read it).
- **No GPU:**
  - `uv run mosaic-mock-gateway --port 8080`, then `cd apps/web && NEXT_PUBLIC_MOSAIC_URL=http://localhost:8080 npx next dev -p 3002`;
  - or a fake-mode mosaicd: `MOSAIC_DEFAULT_MODE=fake uv run mosaicd`. This is the real kernel, gateway, policy, approvals and audit, with fake models, knowledge and sandboxes. Use it to develop backend features like auth, connectors, ingestion and config without a GPU.
- **Tests:** `uv run pytest -q` and `uvx ruff check .`. Real-model tests skip without Ollama. Web: `npm --prefix apps/web run lint`, `npm --prefix apps/web test`, `npm --prefix apps/web run build`.
- **The real stack (demo laptop):**
  - `scripts\win\mosaic-boot.ps1`.
  - Ports: Postgres 5434, Redis 6380, gateway 8089, console 3000 (kiosk, production build), dev console 3002, preview build 3005 (`NEXT_DIST_DIR=.next-preview`), mock gateway 8080, Ollama 11434.
  - Ollama: qwen2.5:7b-instruct and nomic-embed-text, `MOSAIC_MODELS_CONFIG=./models/models.7b-only.yaml`.
  - Full manual setup is in `docs/HANDOFF-KAMAL.md` §2.

---

## 7. Rules

1. **Branches.** Branch from **`ui/desktop`** as `a/…`, `b/…`, `c/…`, `d/…`, and rebase on it often. Push your branch and tell Kamal, who merges into `ui/desktop` after a check on the demo laptop. `main` only moves when Kamal promotes `ui/desktop`.
2. **Commits.** Keep them small, one logical change each, with an area prefix: `p1:` kernel/execution, `p2:` knowledge/console, `p3:` agents/models, `p4:` platform/data/scripts, `ui:`, `mobile:`, `auth:`, `docs:`, `contract:`. Add `-fix` for fixes.
3. **Before every push.** `uv run pytest -q` and `uvx ruff check .` must pass. Web changes also need `npm --prefix apps/web run lint`, `npm --prefix apps/web test` and `npm --prefix apps/web run build`; mobile changes need `npm --prefix apps/mobile run typecheck`. Never force-push. Never skip hooks.
4. **Contract changes (`shared/`)**:
   - put them on their own branch, `contract/<topic>`: schema, `CONTRACT_VERSION` bump, then `uv run mosaic-export-contracts` and `npm --prefix shared/ts run generate`, plus `.env.example` and `shared/catalogs/*`;
   - Kamal merges contract branches first;
   - if two collide, the second rebases and bumps again;
   - announce every contract change to the team with the field or event name and an example payload;
   - never hand-edit generated files (`shared/schemas/`, `shared/api/openapi.json`, `shared/fixtures/json/`, `shared/ts/src/mosaic.d.ts`, `shared/ts/src/constants.ts`) or `uv.lock`.
5. **Structure** (`AGENTS.md`):
   - import only `mosaic_contracts` across packages, and only `mosaicd/wiring.py` imports implementations;
   - agents act only through `ctx`;
   - retrieved text is data;
   - `restricted` data stays on local models;
   - sandboxes default to network=none;
   - every world-changing action goes through `ctx.syscall()`;
   - errors are `MosaicError` with codes from `shared/catalogs/errors.yaml`;
   - secrets (OAuth client secrets, tokens) never go into the repo, the audit log or events. Keep them in `.env` or the vault.
6. **Style.**
   - Python 3.12, type hints, Pydantic v2, async services, line length 130;
   - tests are sync functions calling `asyncio.run`;
   - comments explain *why*;
   - `logging.getLogger("mosaic.<pkg>.<mod>")`, no `print`.
   - Web: design tokens only (no hard-coded colours), container queries inside apps, orbs for loading, both themes, phone widths.
7. **The demo is sacred.** `ui/desktop` must score 8/8 on real models after every merge. Anything that touches Apollo's retrieval, prompts, planner, policies or the bundle needs that check. If you have no GPU, ask Kamal to run it.
8. **README and docs:** no emojis.
9. **When stuck:** after three failed attempts at the same error, stop and ask the team.
10. **Claude Code users:** create a git-ignored `CLAUDE.local.md` with one line, `@docs/team/PHASE2-<you>.md`.

---

## 8. Phase 2: goals and work division

The goal: turn a scripted demo into a product people can sign into, point at their own data and tools, and watch think.
- Real orgs and roles.
- Real ingestion.
- Connected apps.
- Agents that are created for the job.
- A transparent thought process.
- A phone app that works remotely.
- A configuration centre.
- A light, Mac-like, colourful desktop.

| Person | Area | GPU | Brief |
|---|---|---|---|
| **A: Kamal** | Desktop UI remake and the run visualisation (the "OS experience"); demo, merges | yes (demo laptop) | below |
| **B** | Dynamic agents, a transparent thought process (events), SQL/database and browser (Playwright MCP) tools, multi-tool tasks | **yes** | `docs/team/PHASE2-B-agents.md` |
| **C** | Identity (orgs, Google login, members, roles, RBAC), connectors (GitHub, Google Calendar/Meet), and real ingestion (uploads, URLs, connector sync) with its desktop apps | optional (fake mode is enough) | `docs/team/PHASE2-C-identity-connectors-ingestion.md` |
| **D** | Mobile app (org login, RBAC, approvals, prompts, live tasks; Android emulator and APK) and the Settings / configuration centre | **no** (mock gateway, fake mode, Android emulator) | `docs/team/PHASE2-D-mobile-settings.md` |

**Already done by B (Mishka) on `b/hackathon`, merged:**
- the LLM firewall classifier setting (`MOSAIC_FIREWALL_LLM`, 0.8.0);
- the second scenario, Project Zeus Q4 budget risk (`demo_run.py --scenario zeus`, with its own 8 checks, and `--expect-llm-flag` for the reworded injection);
- robustness: model outages are retried with backoff, clearer model errors, and wall-time quotas are enforced;
- incomplete findings skip the tracker update and fail the task with a partial plan.

See `docs/team/B-HANDOFF.md`.

### A (Kamal): the desktop and the visible run
- **Theme.** A Mac-like, light, colourful theme across the whole UI: the menu bar, windows with traffic-light controls, a dock with magnification, a new wallpaper and landing, and a "techy terminal" accent. Not dark by default.
- **Shortcuts.** Switch apps (Cmd/Ctrl+Tab-style), open things, and **Alt+Space** opens a floating composer with a real entrance animation, replacing the plain composer box.
- **Run visualisation.** When a task starts, the task drops to the left. The desktop then shows what is being referred to and opened: documents, tools, sandboxes and agents, as they happen.
- **Agent faces.** Bigger orbs and **bot avatars** (`bot-avatars`, libraries.dev/bots) for agents: one shape per agent role, "working" while running and "sleeping" when idle.
- **Transparent thought process.** Render B's new events as a readable story: prompt understanding → agent assignment → creation → sub-agents → SQL query → data.
- **Integration.** Merge B, C and D, keep 8/8, and re-record the demo once the UI settles.

### Interfaces between people (agree on these early)
- **Principal and RBAC** (C, used by everyone):
  - the gateway resolves a session (`Authorization: Bearer <token>`) to a Principal `{user, org, roles}`;
  - `MOSAIC_AUTH=dev` keeps today's header behaviour for tests and the mock;
  - roles: `owner`, `admin`, `approver`, `member`, `viewer`;
  - permissions such as `task.create`, `approval.resolve`, `knowledge.ingest`, `connectors.manage`, `config.read`, `members.manage`.

  B bounds dynamic agents by the requesting user's permissions. D's mobile app uses the same login. A shows the signed-in user and org in the menu bar.
- **Thought-process events** (B defines them, A renders them): for example `task.understood` (intent, entities, capabilities needed), `agent.planned` (role, scope, reason), `agent.created` (the generated manifest), `agent.thought` (a short visible step), `tool.query` (for example SQL text and a row count), `task.data` (columns and rows). They're added to `shared/catalogs/events.yaml` and to the mock gateway's replay, so UI work can proceed without a GPU.
- **Connectors as tools** (C builds them, B's agents use them): `github.*` and `calendar.*` capabilities are governed syscalls; writes need approval by default. The OAuth tokens live in C's vault and never reach agents.
- **Config endpoint** (D): `GET /system/config` describes the stack, the models and routing, agents, tools, policies, connectors and versions. Secrets are redacted.
- **Ingestion endpoints** (C): multipart upload, URL ingest and connector sync, with progress events. C also builds the Ingest desktop app. D may reuse the endpoints in mobile ("share a file into mOSaic").

---

## 9. History

1. **M0–M3.** Four splits built the kernel and execution (P1), knowledge, memory and console (P2), agents and models (P3), and the platform, data and demo (P4) against shared contracts. They were integrated at contract 0.4.0 (`docs/HANDOFF-KAMAL.md`).
2. **Handoff (2026-09-28).** Kamal took over; the demo moved to his laptop on qwen2.5:7b.
3. **Hardening.**
   - top-3 root causes;
   - a grounded engineering slip;
   - finance consults the policies;
   - a configurable models file (0.5.0);
   - Windows scripts, `preflight.py`, and the `demo_run.py` 8/8 gate.
4. **UI revamp in tiers** (merged into `main`), and the audit chain verdict (0.6.0).
5. **Retrieval.** nomic prefixes (0.7.0) and a real-embeddings QA.
6. **Sandbox.** The browser has no internet access on Docker Desktop (relay).
7. **Stretch features.**
   - re-derivation of memories, plus its UI;
   - the NOOA adapter;
   - the mobile web build tested;
   - the LLM firewall classifier (0.8.0, the setting by Mishka).
8. **Phase-1 team work.**
   - Mishka: the firewall setting (0.8.0).
   - Mayeraa: UI states, the Memory pairing, the mobile polish, the README.
   - Kamal: integration, plus fixes for a duplicate Memory display, a flaky invalidation dependency and iOS safe areas.
9. **`ui/desktop`.** The console as a desktop OS: windows, dock, launcher, the wallpaper mosaic, the Terminal, orbs, the boot screen. It scores 8/8 through the new UI.
10. **Public links.** github.com/Kamalllx/mOSaic, mosaic-os-black.vercel.app, and the demo and explainer videos linked in `README.md`.

## 10. Where to read more
| What | Where |
|---|---|
| Rules for any agent in the repo | `AGENTS.md`, plus the nested `*/AGENTS.md` files |
| Full design and plan | `Mosaic_Preoject_Description.md`, `docs/MASTER_PLAN.md`, `docs/FOLDER_STRUCTURE.md` |
| Laptop setup and port clashes | `docs/HANDOFF-KAMAL.md` |
| Demo run sheet, fallbacks | `docs/DEMO_SCRIPT.md`; pitch kit in `docs/pitch/` |
| Desktop direction | `docs/ui-os/DIRECTION.md` |
| Per-area service status | `shared/services/P1…P4-*.md` |
| Contract rules | `shared/README.md` |
| Env variables | `.env.example` |
