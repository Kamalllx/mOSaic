# Person B handoff: merge note for `b/hackathon`

Branch `b/hackathon`, based on `main` at `e356d0b`. B1 is already on `main` (your merge `51f84d7`); this note covers everything since. Contract **0.8.0** (unchanged since B1).

All checks below ran on Mishka's laptop: RTX 3050 6 GB, **qwen2.5:7b-instruct** (about 84% on the GPU, 17.8 tok/s) and nomic-embed-text, with `models/models.7b-only.yaml`. Expect shorter times on your laptop.

## What changed

### B1: the LLM firewall classifier setting (already merged)
- `5fe37b7` contract: `Settings.firewall_llm` (`MOSAIC_FIREWALL_LLM`), and the new flag value `instruction_like_llm`.
- `0f6248f` p2: `build_context_firewall` honours the setting. A hit that the LLM catches (and the regex misses) gets `instruction_like` + `instruction_like_llm`, and a warning is logged on `mosaic.knowledge.firewall`.

### B2: second demo scenario, Project Zeus Q4 budget risk
- `aba6e53` p4: new documents only; no existing document or index was edited:
  - `finance/zeus-q4-forecast` (1.4 lakh / 35% projected overrun);
  - `engineering/zeus-status-w38`;
  - `jira/zeus-9`, `jira/zeus-11`;
  - the untrusted renewal email `inbox/vendor-email-2026-09-24`. Its reworded injection gets past the regex; only the LLM classifier catches it.
  - Also **`infra/compose/vendor-docs/warehouse-pricing.html`**, a new page in your area. The Zeus run screenshots it; nginx serves it from the mounted folder, so no rebuild is needed.
- `df84aad` p1: the mock Jira seeds ZEUS-9 and ZEUS-11.
- `2fb15cb` p3: the agents follow the goal's project:
  - the tracker issue (ZEUS-11), Jira project, report name, memory tags and vendor page follow the project;
  - the planner prefixes generic step goals with "Project Zeus:" (the 7B's step goals often don't name the project);
  - **Apollo's step goals, queries and strings are unchanged**, and tests pin them.
- `38a1bb8` p2: the real-model firewall test requires the renewal email to be caught by the LLM, with no false positives elsewhere in the bundle.
- `967a082` p4: `demo_run.py --scenario zeus` (8 checks of its own), plus `--expect-llm-flag` (a ninth check). Apollo's 8 checks are unchanged and remain the default.
- `5e7a44c` docs: **the talk track is in `docs/DEMO_SCRIPT.md`, section "Second scenario: Project Zeus budget risk"**.

### B3: robustness
- `90cf3af` p2-fix, a flaky test: `test_stale_recalled_only_with_include_stale`.
  - A random query token collided, in the fake 64-dim embedding, with other tests' records in the same org (2 in 64 runs). Forced collisions reproduced it every time. The test now has its own org.
  - Knowledge tests also reached Postgres only if `test_cli` had loaded `.env` first; run on its own, `test_contract.py` skipped all 14 contract tests. `knowledge/tests/conftest.py` now loads `.env`.
- `e95809b` p2-fix: `test_coherence` left a re-derived memory on `/org/policies/security` each run, so every later run failed if run twice in a row. It now edits a document of its own. 20/20 back-to-back runs.
- `92d957f` p3-fix: model errors say what happened. Before, an Ollama restart failed agents with `ollama qwen2.5:7b-instruct: ` and nothing after it. Now: `cannot reach Ollama at <url> (ConnectError)`, or code `TIMEOUT` with `no answer within 180s`.
- `d483ee0` p1-fix: model outages are retried with backoff, and wall-time quotas hold while an agent is blocked.
  - The runtime returns model errors as FAILED results, so the kernel never retried them, and its other retries came all at once.
  - A `MODEL_UNAVAILABLE`/`TIMEOUT` failure is now retried after 5 s, then 15 s.
  - Not for an agent that has spawned children, or that holds approval-gated capabilities: a re-run would repeat work or a write. Crashes still retry at once.
  - The wall-time quota is now enforced around the whole run, not only when an agent next calls `ctx.*`.
- `bb1463d` p3: the planner logs a **warning**, with the reason, when it carries on without a failed specialist.

## New settings (`.env.example`)
```
MOSAIC_FIREWALL_LLM=false               # P2: LLM classifier on unverified/untrusted hits the regex misses (flag instruction_like_llm)
# MOSAIC_KERNEL_RETRY_BACKOFF_S=5        # wait before retrying an agent after a model error (5 s, then 15 s); 0 = at once
# MOSAIC_KERNEL_MIN_AGENT_WALL_S=1800    # every agent's wall-time quota is at least this (approvals can take a while)
```
The defaults are what the demo needs. To show the classifier, add `$env:MOSAIC_FIREWALL_LLM = "true"` to `scripts\win\local.ps1`.

## For C (UI)
- `SearchHit.firewall_flags` can contain `instruction_like_llm`, always together with `instruction_like`. Example: `["instruction_like", "instruction_like_llm", "untrusted_source"]`.
- There are no new event types. Three new `agent.log` warnings, which the timeline already highlights:
  - `finance-agent: <reason>; retrying in 5s (attempt 2/3)`
  - `<agent> stopped: pid N exceeded Ns wall clock`
  - `planner: step s2 (engineering-agent) failed: <reason>; continuing without its findings`

## Results on this branch

| Check | Result |
|---|---|
| `uv run pytest -q` | 334 passed, no skips (Ollama and Postgres up) |
| `uvx ruff check .` | clean |
| `check_okf.py` | OK, 81 files; retrieval QA 10/10 with fake and real embeddings |
| After a reset, classifier off | Apollo **8/8** in 119.5 s, then Zeus **8/8** in 111.4 s |
| After a reset, `MOSAIC_FIREWALL_LLM=true` | Apollo **8/8** in 97.9 s, then Zeus **9/9** in 111.5 s (the renewal email is flagged `instruction_like_llm`) |
| Ollama restarted 35 s into Apollo | finance retried after 5 s; all specialists completed; the task completed |
| Ollama stopped for good mid-run | `task.failed` after 91 s: `MODEL_UNAVAILABLE: ollama qwen2.5:7b-instruct: cannot reach Ollama at http://127.0.0.1:11434 (ConnectError)` |
| Task with a 30 s wall quota | `task.failed` (`QUOTA_EXCEEDED`) at 30.4 s; nothing left running |
| `taskkill /F` on mosaicd 25 s in, then restart | "Resumed after kernel restart #1", one `jira.write`, Apollo 8/8 |

## After merging, on the demo laptop
```powershell
git pull; uv sync --all-packages --all-extras
scripts\win\reset-demo.ps1                          # restarts mosaicd; new documents are indexed on its first call
uv run python scripts/demo_run.py run --auto-approve                   # Apollo: must be 8/8
uv run python scripts/demo_run.py run --auto-approve --scenario zeus   # Zeus: 8/8
# classifier on: add  $env:MOSAIC_FIREWALL_LLM = "true"  to scripts\win\local.ps1, then
scripts\win\reset-demo.ps1
uv run python scripts/demo_run.py run --auto-approve
uv run python scripts/demo_run.py run --auto-approve --scenario zeus --expect-llm-flag   # 9/9
```
If Zeus scores low on retrieval, run `POST /knowledge/reindex` once. The new files are indexed by content hash on boot, but a bundle that was indexed while the watcher was off may need it.

## Watch out for
- **Open decision:** when specialists fail, the planner still runs the action step, and an approved `jira.write` is committed from partial findings before the task fails. This is existing behaviour, seen live with Ollama stopped; it's now visible as a warning, but not changed. Say if the action step should be skipped instead.
- **Retries add time during an outage:** up to about 20 s per failing specialist (5 s + 15 s). On stage, an Ollama hiccup now costs seconds instead of silently dropping a specialist.
- **Agents are now really stopped at their wall quota:** 1800 s at least, or the task's own quota if higher. A demo that waits more than 30 minutes on an approval fails with `QUOTA_EXCEEDED` instead of running on.
- **`tests/integration/test_live_system.py` is still flaky and unresolved:** "redis mirror attached", about 1 in 9 full-suite runs. It didn't reproduce in about 50 attempts (idle, heavy CPU load, heavy disk load, replays of the real suite order). What's known: the kernel attaches the Redis mirror only if a single 0.5 s ping succeeds at boot, and the test's fixture never waits for its Redis container (the kernel's own Redis test does). This one test is all it affects; the demo mosaicd reported `event bus: redis-mirrored` on every boot here.
- The test database accumulates memory rows across runs (784+). They're harmless now that the tests are isolated.
