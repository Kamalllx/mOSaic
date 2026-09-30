# Handoff to Kamal (@kamalllx)

From Mishka, 2026-09-28. You now own everything that's left of P1, P2, P3 and P4, and the demo runs on your laptop. This page covers what works, how to set up your laptop, how to run the demo, and a single checklist of what's still open.

## 1. What's done

`main` has the whole system, integrated: P1's kernel and gateway, P2's knowledge, memory and console, P3's agents and router on local Ollama, and P4's demo bundle, browser sandbox and probe. It came from the `integration/m3` branch: 7 merges plus one small commit per fix, each prefixed with the area it touched (`p1-fix:`, `p2:`, `p3-fix:`, `p4-fix:`, `contract:`, `team:`). Run `git log --oneline 82af170..` to see them all; each merge commit explains its conflict resolutions. The contract version is **0.4.0**.

Verified on a Windows 11 laptop (Docker Desktop, Ollama with `llama3.2:3b` + `nomic-embed-text`, every component `real`):

| Check | Result |
|---|---|
| `uv run pytest -q` on `main` | **293 passed, 0 skipped** after `uv sync --all-packages --all-extras`. Without the extras: 290 passed and 3 skipped (the `document` converter needs markitdown) |
| `ruff check .`, contract regeneration | clean; regenerating the contracts produces no diff |
| Console (`apps/web`) | `npm run build`, `npm run lint` and `npm test` (16/16) pass |
| Real run 2 (`T-598fc7b441`), driven through the console | 65.9 s, 1 approval, 3 cited root causes, 6.2 lakh / 31% |
| Real run 3 (`T-19de354787`), driven through the console | 75.1 s. The vendor email was flagged at 22 s and no agent acted on it: the only syscalls were `browser.open` ×2, `jira.read`, `jira.write` and `fs.write`. 6 cited root causes, 6.2 lakh / 31% (also in the Jira comment), screenshots in W7/W8, "hash chain: all 96 entries link to their predecessor" |
| Kill and restart (`T-8242e0a303`) | `taskkill /F` on mosaicd 25 s into a run, then a restart. "Resumed after kernel restart #1", re-run from the root checkpoint, a single `jira.write`, completed (123 s of machine time) |
| Invalidation demo (DEMO_SCRIPT step 18) | Appending a line to the cloud bill produced the toast "N memories stale … Affected agents: finance-agent" after 0.2 s, and the explorer showed the edit after 0.9 s. Engineering's memories stayed fresh. `git checkout` resets it |
| Retrieval QA on `data/okf` | **10/10** (`knowledge/tests/test_retrieval_qa.py`) |

## 2. Setting up your laptop (Windows)

### 2.1 Prerequisites
Install these once and restart the terminal afterwards:
```powershell
winget install astral-sh.uv
winget install Docker.DockerDesktop      # then start Docker Desktop (WSL 2 backend)
winget install OpenJS.NodeJS.LTS
winget install Ollama.Ollama             # native Ollama uses your NVIDIA GPU directly
winget install Git.Git
```
Optional: `winget install jqlang.jq` makes the `jq` one-liners in the docs work as written. §2.10 has PowerShell equivalents if you'd rather not install it.

### 2.2 Code
```powershell
git clone https://github.com/Kamalllx/mOSaic; cd mOSaic      # or, if you have it: git checkout main; git pull
uv sync --all-packages --all-extras                           # --all-extras adds markitdown (the document converter)
```

### 2.3 Containers
If port 5432 is free (no native Postgres), use the compose Postgres:
```powershell
docker compose -f infra/compose/docker-compose.yml up -d postgres redis vendor-docs
```
- **Leave out `ollama`**: use native Ollama, since the compose one has no GPU on Windows.
- **Leave out `mock-jira`**: `MOSAIC_JIRA_URL=inprocess` runs it inside mosaicd, which also avoids a clash on :8090.
- **`vendor-docs`** must come up. Starting it creates the internal `mosaic_sandbox` network that the browser sandbox uses.

If a native Postgres holds 5432 (`Get-Service postgres*` shows it running), either stop it (`Get-Service postgres* | Stop-Service`, as admin) or run pgvector on 5433, as I did. The compose file pins 5432:
```powershell
docker compose -f infra/compose/docker-compose.yml up -d redis vendor-docs
docker run -d --name mosaic-postgres-dev -p 5433:5432 -e POSTGRES_USER=mosaic -e POSTGRES_PASSWORD=mosaic -e POSTGRES_DB=mosaic --restart unless-stopped pgvector/pgvector:pg16
```
Then create the test database. Tests write to whatever `MOSAIC_DATABASE_URL` points at, so keep them away from the demo database:
```powershell
docker exec mosaic-postgres-dev createdb -U mosaic mosaic_test     # compose variant: docker compose -f infra/compose/docker-compose.yml exec postgres createdb -U mosaic mosaic_test
```

### 2.4 Sandbox images
```powershell
docker build -t mosaic/sandbox-base:latest execution/images/sandbox-base
docker build -t mosaic/sandbox-browser:latest execution/images/sandbox-browser
```

### 2.5 Models
`models/models.yaml` routes planning, reasoning and extraction to **`qwen2.5:7b-instruct`**, summarization, classification and latency-critical calls to `llama3.2:3b`, and embeddings to `nomic-embed-text`. Code and vision (`qwen2.5-coder:7b`, `llava:7b`) aren't used by the Apollo demo. On an 8 GB GPU, start mosaicd with `MOSAIC_MODELS_CONFIG=./models/models.7b-only.yaml`: it sends summarization, classification and latency-critical calls to the 7B as well, so memory consolidation never evicts the 7B mid-run.
```powershell
ollama pull qwen2.5:7b-instruct
ollama pull llama3.2:3b
ollama pull nomic-embed-text
ollama pull qwen2.5-coder:7b; ollama pull llava:7b        # only for completeness (preflight lists them)
```
**Does the 7B fit your GPU?**
```powershell
nvidia-smi --query-gpu=name,memory.total,memory.used --format=csv
ollama run qwen2.5:7b-instruct "say ok"; ollama ps          # PROCESSOR must read "100% GPU"
```
- qwen2.5:7b (Q4) needs about 5–6 GB of VRAM at the 8k context, and the embedding model adds about 0.5 GB. With **8 GB or more** you're fine.
- To mirror the appliance, set these as user environment variables before starting Ollama: `OLLAMA_KEEP_ALIVE=-1`, `OLLAMA_CONTEXT_LENGTH=8192`, `OLLAMA_MAX_LOADED_MODELS=2`, `OLLAMA_FLASH_ATTENTION=1`, `OLLAMA_KV_CACHE_TYPE=q8_0`.
- **Fallback, for 6 GB or less, or if `ollama ps` shows a CPU split:** `ollama rm qwen2.5:7b-instruct`. When a routed model isn't pulled, the router falls back to any pulled chat model, so everything runs on `llama3.2:3b`. My laptop (RTX 3050, 6 GB) ran every verified run above this way. The root causes still come out, but the 7B writes a noticeably better summary, so use it if it fits.

### 2.6 `.env` (repo root, git-ignored): dev defaults, read by tests too
```powershell
Copy-Item .env.example .env
```
Then change these lines in `.env` (use port 5432 instead if you went with the compose Postgres):
```
MOSAIC_DATABASE_URL=postgresql+psycopg://mosaic:mosaic@localhost:5433/mosaic_test
MOSAIC_REDIS_URL=redis://127.0.0.1:6379/0
```
Keep `MOSAIC_DEFAULT_MODE=fake` in `.env`. The real settings go in the terminal that runs mosaicd (§2.7), and process environment variables override `.env`.

Use `127.0.0.1`, not `localhost`, for Redis. On Windows `localhost` tries IPv6 first, and Docker's port binding is IPv4.

### 2.7 Run mosaicd (the real stack)
Paste this into a PowerShell window in the repo:
```powershell
$env:MOSAIC_DEFAULT_MODE = "real"
$env:MOSAIC_OKF_DIR = "./data/okf"
$env:MOSAIC_KNOWLEDGE_WATCH = "true"          # needed for the invalidation demo
$env:MOSAIC_SANDBOX_ENDPOINT = "port"         # Docker Desktop (see the known limit in §4)
$env:MOSAIC_JIRA_URL = "inprocess"
$env:MOSAIC_DATABASE_URL = "postgresql+psycopg://mosaic:mosaic@localhost:5433/mosaic"   # the demo DB, not mosaic_test
$env:MOSAIC_REDIS_URL = "redis://127.0.0.1:6379/1"
$env:MOSAIC_GATEWAY_PORT = "8089"             # 8080 is often taken; any free port works
$env:MOSAIC_URL = "http://localhost:8089"     # for the ai-* CLI
$env:PYTHONIOENCODING = "utf-8"
uv run mosaicd
```
Check it's up, then index the bundle once. Re-running the reindex is safe: unchanged files are skipped by content hash.
```powershell
$s = Invoke-RestMethod http://localhost:8089/system/status; $s.ready; $s.components | Format-Table component, mode, ok
Invoke-RestMethod -Method Post http://localhost:8089/knowledge/reindex
```
Every component should show `real` and `ok`.

### 2.8 Run the console
```powershell
cd apps/web
"NEXT_PUBLIC_MOSAIC_URL=http://localhost:8089" | Out-File -Encoding ascii .env.local
npm ci
npm run build
npx next start -p 3000          # open http://localhost:3000
```
`NEXT_PUBLIC_MOSAIC_URL` is baked in at build time, so **rebuild whenever the gateway port changes**. For UI work, `npm run dev` hot-reloads instead. The mock gateway (`uv run mosaic-mock-gateway --speed 2`) replays a full run without models, which is also the demo fallback.

### 2.9 Port clashes to watch
| Port | Usual culprit | Fix |
|---|---|---|
| 5432 | native Windows Postgres | stop it, or pgvector on 5433 (§2.3) |
| 8080 | Java/Spring apps, other dev servers | `MOSAIC_GATEWAY_PORT=8089`, rebuild the console with the matching URL; the compose `mosaicd` uses `MOSAIC_HOST_PORT` |
| 8090 | the compose mock-Jira, and other apps | `MOSAIC_JIRA_URL=inprocess`; don't start `mock-jira` |
| 3000 | old `next` servers | `Get-NetTCPConnection -State Listen -LocalPort 3000` → stop that PID, or use `-p 3002` |
| 11434 | compose `ollama` alongside native Ollama | run only one of them (native) |

List what's listening: `Get-NetTCPConnection -State Listen | Where-Object LocalPort -in 3000,5432,5433,6379,8080,8089,8090,11434`.

### 2.10 `jq` commands, in PowerShell
`scripts/preflight.sh` targets the Linux appliance (`systemctl`, `.venv/bin`), so on Windows run these checks by hand:

| Doc / script command | PowerShell |
|---|---|
| `curl -s …/memory?task_id=<id> \| jq '.[] \| {owner, derived_from}'` (DEMO_SCRIPT step 18) | `Invoke-RestMethod "http://localhost:8089/memory?task_id=<id>" \| Select-Object owner, derived_from, stale` |
| `… /system/status \| jq -e '.ready == true'` | `(Invoke-RestMethod http://localhost:8089/system/status).ready` |
| `… \| jq -e '[.components[].mode] \| all(. == "real")'` | `(Invoke-RestMethod http://localhost:8089/system/status).components \| Where-Object mode -ne real` (must print nothing) |
| `curl … $OLLAMA/api/tags \| jq -r '.models[].name'` | `(Invoke-RestMethod http://localhost:11434/api/tags).models.name` |
| `… /knowledge/search?q=apollo%20budget&top_k=3 \| jq -e '.hits \| length > 0'` | `(Invoke-RestMethod "http://localhost:8089/knowledge/search?q=apollo%20budget&top_k=3" -Headers @{"X-Mosaic-User"="preflight";"X-Mosaic-Org"="acme"}).hits.Count` |
| bundle validity | `uv run python scripts/check_okf.py` |
| browser smoke test | `uv run python scripts/browser_smoke.py` (works on Docker Desktop) |

## 3. Running the demo

Everything is in [`docs/DEMO_SCRIPT.md`](DEMO_SCRIPT.md). On your laptop, the laptop *is* the node. Skip the Tailscale and thin-client parts of "Setup", and use your gateway port wherever the script says `:8080`.

- **Before each rehearsal**, work through the script's QA checklist:
  1. bundle checks;
  2. one throwaway run;
  3. **the memory reset, after the throwaway run**, so the step-18 toast shows a clean count. Run it in the mosaicd Postgres with no task running:
     ```powershell
     docker exec mosaic-postgres-dev psql -U mosaic -d mosaic -c "TRUNCATE memories, working_sets;"
     # compose Postgres: docker compose -f infra/compose/docker-compose.yml exec postgres psql -U mosaic -d mosaic -c "TRUNCATE memories, working_sets;"
     ```
- **Talk track, step 17:** the planner keeps at most three root causes (§4, done), so say **"the three root causes"** and read out the three in step 17: dual-run cloud cost, the duplicate-recon-id backfill failure, and PayCo certification + emergency contract.
- **Invalidation demo (step 18, the main one):** after a completed run, append the line to `data/okf/finance/cloud-bill-2026-09.md`. The toast names finance-agent, and the explorer updates. Reset with `git checkout data/okf/finance/cloud-bill-2026-09.md`. The security-policy-v2 swap is **optional** and currently invalidates nothing (see §4).
- **Fallbacks:** each run-sheet row has one. The universal one is the mock gateway replay.

## 4. Everything still open

In priority order for the demo. Each item lists the files to look at and a suggested fix.

- [x] **Cap the root causes at the top 3** (P3 area). Done: `_top_root_causes()` in `planner.py` drops restated symptoms, merges near-duplicates and keeps three; `recovery_plan` is now a list (the 7B's `:[`), and a heading-only summary falls back to the root causes. Original note: runs list 3–6, some overlapping (for example "Legacy pipeline not switched off" alongside the dual-run cost), and some cite only `/org/projects/apollo`.
  - *Files:* `agents/mosaic_agents/library/planner.py`: synthesis around lines 150–175, `_backed()` at about line 239, and `_root_causes_from_findings()`.
  - *Fix:* after `_backed()`, merge causes whose evidence sets are equal or a subset of another's. Rank the rest by the number of distinct retrieved documents, preferring finance/engineering citations, then slice `[:3]`, and build `recovery_plan` from the kept three. Add a unit test next to the messy-plan test from `033a943`. After that, change the talk track back to "the three root causes".
- [ ] **Rehearse 3× and record a backup video** (P4 area). Do this on your laptop, with the 7B if it fits. Record one clean full run and keep it local, not streamed. Tick DEMO_SCRIPT's QA checklist each time.
- [x] **Agents consult `/org/policies`**, which the *optional* security-policy-v2 demo needs (P3 area). Done: the finance agent searches `/org/policies` for vendor-spend rules, puts them in its prompt and in its memory's `derived_from`; swapping in v2 invalidates the finance memories only (checked on the real stack). Original note: today no memory derives from a policy, so swapping in v2 reindexes and invalidates nothing.
  - *Files:* `agents/manifests/finance-agent.yaml` (`memory.mounts: [/org/finance, /org/projects]`), `agents/mosaic_agents/library/finance.py` (search scope at about line 42, and the `remember_finding` call), and `data/demo-assets/security-policy-v2.md` versus `data/okf/policies/security.md`.
  - *Fix:* pick the agent whose finding the v2 change affects (read the diff between v1 and v2 first). Add `/org/policies` to its mounts, add one policy search, and put the cited policy paths into `remember_finding(..., derived_from=...)`. Check a `jira.write` policy rule doesn't block it. Then run the swap and expect a toast.
- [ ] **Browser sandbox internet on Docker Desktop** (P1 area; known limit, accepted for the demo, listed in DEMO_SCRIPT "Known limits").
  - *Files:* `execution/mosaic_execution/sandbox/docker_manager.py` (see its module docstring).
  - *Problem:* in `port` mode the browser container joins the default bridge to publish :3000, which gives it internet access. URLs are checked against the allowlist, but page subresources aren't.
  - *Fix:* keep the browser on `mosaic_sandbox` only, and publish :3000 through a small relay container (for example `alpine/socat`) attached to both the bridge and `mosaic_sandbox`. Or run mosaicd inside the sandbox network. `ip` mode on Linux is unaffected.
- [ ] **The `document` converter's 3 skipped tests** (P4 area). The converter is shipped (`knowledge/mosaic_knowledge/ingestion/converters/document.py`); the tests skip only when the `ingest` extra (markitdown) isn't installed. With `uv sync --all-packages --all-extras`, all 15 converter contract tests pass (checked on `main`: 293/293).
  - *Fix:* make `--all-extras` the documented install (the AGENTS.md "Commands" block), or leave it as is, since the skip is intentional.
- [x] **`MOSAIC_MODELS_CONFIG`** (contract change, P3 review should-fix 4). Done in contract 0.5.0: `Settings.models_config`, plus `models/models.7b-only.yaml`. Original note: `models/models.yaml` can't be overridden per machine.
  - *Files:* `shared/python/mosaic_contracts/wiring.py` (`Settings`) and `models/mosaic_models/factory.py` (about line 19, `_MODELS_YAML`).
  - *Fix:* add `models_config: Path | None = None`, use it in the factory when set, bump `CONTRACT_VERSION`, run `uv run mosaic-export-contracts` and `npm --prefix shared/ts run generate`, and add it to `.env.example`. This makes the 3B-only setup explicit instead of relying on the fallback.
- [ ] **nomic-embed-text prefixes** (contract change, P3 review nit). The model retrieves better with `search_query: ` / `search_document: `.
  - *Files:* `shared/python/mosaic_contracts/schema/inference.py` (`EmbedRequest`), the Ollama provider in `models/mosaic_models/providers/ollama.py`, and P2's indexer (documents) and retriever (queries) under `knowledge/mosaic_knowledge/`.
  - *Fix:* add `input_type: Literal["query", "document"] | None`, have the provider prefix when the model is nomic, and pass the right type from the indexer and retriever. Also store the prefix scheme in the index metadata so the change forces a full re-embed. Then re-run `test_retrieval_qa.py`; it must stay at 10/10 or better.
- [x] **`preflight.sh` is Linux-only** (P4 area). Done: `scripts/preflight.py` runs anywhere and adds a generation-speed and fully-on-GPU check; `scripts/win/` has boot, reset, Ollama restart, shutdown and phone-access scripts, and `scripts/demo_run.py` runs and scores a task.
- [x] **The compose Postgres port is fixed at 5432** (P4 area). Done: `MOSAIC_PG_PORT` and `MOSAIC_REDIS_PORT` in `infra/compose/docker-compose.yml`.
- [ ] *(optional)* **Memory re-consolidation queue** (P2 area). Stale memories aren't re-summarized automatically. *Files:* `knowledge/mosaic_knowledge/memory/` and `coherence/`.
- [ ] *(optional)* **LLM firewall classifier** (P2 area). It's built but off by default; the regex firewall catches the vendor email. *Files:* `knowledge/mosaic_knowledge/firewall/`.
- [ ] *(optional, stretch)* **NOOA adapter.** `agents/mosaic_agents/adapters/nooa.py` is only a stub, although the manifests say `framework: nooa`.
- [ ] *(optional, stretch)* **Mobile approve app.** `apps/mobile/` is an Expo app (approvals, compose, settings) that wasn't exercised in integration. Read its README, point it at your gateway URL, and test approve from the phone.
- [ ] *(optional, stretch)* **Appliance installer.** `infra/appliance/install.sh` (Ubuntu, systemd, Tailscale) has never been run on a real node, so the cold-boot check is still open. It isn't needed if the demo runs on your laptop.
- [ ] *(optional, stretch)* **OpenShell/microVM sandbox backend** (P1 area). Not started.

## 5. Working rules now
- `git pull` before you start.
- Run `uv run pytest -q` before **every** push, and `uvx ruff check .` too. For `shared/` changes, also regenerate the contracts and confirm there's no stray diff.
- Push straight to `main`. There are no PRs and no other reviewers now.
- The old branches (`p1/kernel-core`, `p2/knowledge-core`, `p2/console`, `mayeraa/agents-models`, `p4/platform-data-demo`, `contract/*`, `integration/m3`) are **superseded**. Don't use them.
- AGENTS.md's ownership table and the rules against importing across splits still describe how the code is structured. Keep following the structure, even though you own all of it now.

## 6. Where things are
| What | Where |
|---|---|
| Rules for anyone (or any agent) working in the repo | [`AGENTS.md`](../AGENTS.md) |
| The demo: run sheet, fallbacks, QA checklist, known limits | [`docs/DEMO_SCRIPT.md`](DEMO_SCRIPT.md) |
| What each area provides and its status | `shared/services/P1-kernel-execution.md`, `P2-knowledge-console.md`, `P3-agents-models.md`, `P4-platform-data-demo.md` |
| Plan and design | `docs/MASTER_PLAN.md`, `Mosaic_Preoject_Description.md`, `docs/FOLDER_STRUCTURE.md` |
| Per-area briefs (task lists, specs) | `docs/team/P1-…md` … `P4-…md` |
| Contract rules | `shared/README.md` |
| Env variables | `.env.example` |
