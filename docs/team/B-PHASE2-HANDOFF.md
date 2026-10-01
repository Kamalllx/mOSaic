# Person B, phase 2: handoff

For Kamal (merging into `ui/desktop`) and Mishka. The running log with every decision is
`docs/team/B-PHASE2-PROGRESS.md`. All results below are from Mishka's laptop: RTX 3050 6 GB, qwen2.5:7b-instruct
(about 84% on the GPU) + nomic-embed-text, `MOSAIC_MODELS_CONFIG=./models/models.7b-only.yaml`, after
`scripts\win\reset-demo.ps1`. Expect shorter times on the demo laptop.

## Merge order

One chain: each branch is cut from the one before, so merge them in this order (fast-forwards if nothing else lands
in between). Every branch passed the gates on its own before it was pushed.

| # | Branch | Head | What | Merge? |
|---|---|---|---|---|
| 1 | `contract/thought-events` | `51e5ac1` | contract 0.10.0: six thought-process events, `ctx.narrate` | yes |
| 2 | `b/thought-events` | `b4b8bc9` | B1: the kernel and agents emit them; `check_story.py`, `demo_run --check-story` | yes |
| 3 | `contract/dynamic-agents` | `466a3a7` | contract 0.11.0: manifest/spawn fields, `PermissionsProvider` | yes |
| 4 | `b/dynamic-agents` | `b58b76a` | B2: agents generated per task from role templates | yes |
| 5 | `contract/db-tool` | `f6343d3` | contract 0.12.0: `db.query`/`db.write`, the demo dataset | yes |
| 6 | `b/sql-tool` | `6016419` | B3: SQL guard, db backend, seed script, vendors scenario | yes |
| 7 | `b/hardening` | `373b191` (+ this handoff) | B5: the kill fix, protections for phase-2 agents and tools | yes |
| 8 | `b/mcp-browser` | see below | B4 | see B4 below |

`ui/desktop` must first have `main` (it is behind `main` by the `b/hackathon` merge; a fast-forward).

**Collision with Manjunath:** `contract/system-config` (0.9.0, unmerged) also touches
`shared/python/mosaic_contracts/schema/__init__.py` and the generated files. My numbers (0.10.0, 0.11.0, 0.12.0)
assume it lands first. Whoever merges second runs `uv run mosaic-export-contracts` and
`npm --prefix shared/ts run generate`. If it does not land first, tell Mishka and the contract versions can be
renumbered.

**Collision with Person C:** `policies/roles.yaml` on `identity-connectors` will break the policy engine at boot:
the engine loads every `policies/*.yaml` as a `PolicyDocument`. Move it into a subfolder (as
`policies/rbac/role-capabilities.yaml` is) before merging. C's RBAC should implement `PermissionsProvider`
(contract 0.11.0) and be set as `ServiceBundle.permissions`; the kernel then stops using the stub.

## What changed, per task

### B1: thought-process events (contract 0.10.0)
- `a64a2bd` contract: `task.understood`, `agent.planned`, `agent.created`, `agent.thought`, `tool.query`,
  `task.data`, payload models, `AgentContext.narrate()`; the mock gateway replays them in the Apollo run.
- `51e5ac1` the real context implements `narrate` (the contract branch merges on its own).
- `6a9b8a2` the kernel emits `agent.created` (after each spawn a planner makes), and `tool.query` + `task.data` after
  a query tool. `db7a7b8` the agents narrate. `742b710` planned order = creation order; finance thinks in counts.
- `9159fc0` `scripts/check_story.py` and `demo_run.py --check-story`.

### B2: dynamic agents (contract 0.11.0)
- Every agent another agent creates is generated from its role template: `finance-agent@T-…` (`#2` for repeats).
  Capabilities = template ∩ request ∩ user permissions ∩ org policy; scope = template mounts ∩ requested scope ∩ user
  data scopes; a generated agent's sub-agents never get wider. Anything dropped: one `policy` audit entry saying why.
- A generated policy per agent that only narrows: writes (catalog approval-required capabilities) always need a person.
- Org policies apply through the template name (`finance-agent-v1`, `research-agent-v1` keep working).
- User permissions: `ServiceBundle.permissions`, else the stub `policies/rbac/role-capabilities.yaml` (alice = owner).
- Generated manifests/policies live in memory, mirrored to `<data_dir>/ephemeral/<task_id>/`, removed when the task
  ends, swept at boot.
- New role templates: `analyst`, `data-engineer`, `writer` (`agents/manifests/`). The model is offered them only when
  the goal asks for what they do, so the Apollo and Zeus planning prompts are unchanged (tested).

### B3: the SQL tool and the vendors scenario (contract 0.12.0)
- `db.query` (read-only) and `db.write` (approval) on `mosaic_demo_data`. The kernel checks every statement first
  (one statement, SELECT-only for queries, no DDL, LIMIT ≤ 200, UPDATE/DELETE need WHERE); the backend adds a
  READ ONLY transaction and a 5 s statement timeout.
- `scripts/seed_demo_data.py` (idempotent, only touches `mosaic_demo_data`).
- The data engineer writes one SELECT from the schema (one retry with the refusal's reason); the writer drafts the
  note and files it through `db.write`.

### B5: hardening
- Kill fix (`8ba97c2`): a killed task can no longer end as completed.
- Tests that generated agents and sub-agents keep the retries, wall-time quota and partial-findings rule; SQL timeouts
  fail clearly; killed tasks leave nothing generated behind.
- Live: Ollama restarted mid-Apollo; the generated finance agent was retried and the run scored 8/8.

### B4: Playwright MCP browser
See the B4 section of the progress log for its status (written last).

## Contracts, events, settings

| Version | Branch | Change |
|---|---|---|
| 0.10.0 | `contract/thought-events` | six events + payload models; `AgentContext.narrate(payload)` |
| 0.11.0 | `contract/dynamic-agents` | `AgentManifest.system_prompt/template/generated/task_id`; `SpawnRequest.scope/why`; `ctx.spawn(..., capabilities, scope, why)`; `UserPermissions` + `PermissionsProvider` + `ServiceBundle.permissions`; `util.APPROVAL_REQUIRED` |
| 0.12.0 | `contract/db-tool` | capabilities `db.query`, `db.write`; `Settings.demo_data_url`; the `db` tool spec; `mosaic_contracts.testing.demo_data` |

Example payloads (real runs):

```json
{"type": "task.understood", "pid": 101, "payload": {"intent": "Investigate why Project Apollo is over budget and six weeks behind schedule.", "entities": ["Project Apollo", "APOLLO-12"], "capabilities_needed": ["knowledge.read", "knowledge.search", "jira.read", "browser.open", "jira.write", "fs.write"], "plan_summary": "finance-agent, engineering-agent and research-agent investigate in parallel; action-agent then records the root causes on APOLLO-12."}}
{"type": "agent.planned", "pid": 101, "payload": {"role": "finance-agent", "why": "Explains the budget variance and its cost drivers with evidence", "scope": ["/org/finance", "/org/projects", "/org/policies"], "capabilities": ["knowledge.read", "knowledge.search", "jira.read"]}}
{"type": "agent.created", "pid": 102, "payload": {"pid": 102, "manifest_name": "finance-agent@T-27b3393603", "template": "finance-agent", "generated": true}}
{"type": "agent.thought", "pid": 102, "payload": {"pid": 102, "step": "analyze", "text": "Found 2 cost drivers, 2 with cited evidence."}}
{"type": "tool.query", "pid": 342, "correlation_id": "SC-…", "payload": {"pid": 342, "tool": "db.query", "query": "SELECT v.name, c.contract_value, SUM(i.amount) AS total_paid, ... LIMIT 200", "rows": 3, "ms": 45}}
{"type": "task.data", "pid": 342, "correlation_id": "SC-…", "payload": {"columns": ["name", "contract_value", "total_paid", "overpayment"], "rows": [["CloudCo", 225000.0, 368550.75, 143550.75]], "source": "db.query"}}
```

For the UI: match `agent.created.template` to `agent.planned.role`; a `tool.query` and its `task.data` share
`correlation_id`; `process.spawned.payload.agent` and `GET /agents` show the generated name (use the part before
`@`); `GET /registry/agents` lists 8 templates.

New settings / env vars:
- `MOSAIC_DEMO_DATA_URL` (0.12.0): the db tool's database. `scripts/win/start-mosaicd.ps1` sets it on the stack's
  Postgres port; `.env.example` documents it.
- `policies/rbac/role-capabilities.yaml`: the permissions stub (not an env var).

## Scenarios and expected scores

```powershell
scripts\win\reset-demo.ps1
uv run python scripts/demo_run.py run --auto-approve --check-story                      # Apollo: 8/8 + story PASS
uv run python scripts/demo_run.py run --auto-approve --check-story --scenario zeus      # Zeus: 8/8 + story PASS
uv run python scripts/seed_demo_data.py                                                 # once, and before each vendors rehearsal
uv run python scripts/demo_run.py run --auto-approve --check-story --scenario vendors   # Vendors: 8/8 + story PASS (about 20 s)
# classifier on: $env:MOSAIC_FIREWALL_LLM = "true"; scripts\win\reset-demo.ps1
uv run python scripts/demo_run.py run --auto-approve --check-story --scenario zeus --expect-llm-flag   # 9/9 + story PASS
```

Vendors talk track (one minute): "Which vendors were paid more than their contract in Q3, and by how much? Draft a note
to finance." The planner sees a data question and creates a data engineer and a writer for it (two `agent.created`,
`generated: true`). The data engineer reads the schema and writes one SQL query; the kernel checks it (read-only, one
statement, a LIMIT) and runs it: the query and the table appear (`tool.query`, `task.data`). CloudCo 1,43,550.75,
PayCo 42,350, TalentX 11,280 over. The writer drafts the note (the figures come from the table, not the model) and asks
to file it: an approval card for `db.write`. Approve; the note is filed and the run ends.

## Latest gate results

| Branch | Apollo | Zeus | Vendors | Zeus, classifier on |
|---|---|---|---|---|
| `b/hardening` (`5839d03`) | 8/8, 107.0 s | 8/8, 103.9 s | 8/8, 21.2 s | 9/9, 135.6 s |

Story order PASS on all of them. 417 tests, 0 skipped; ruff clean; web build passes on the contract branches.

## Known issues and risks
- Once, a full `pytest` run hung for more than 40 minutes; every folder passes alone and four later full runs were
  green in about 3 minutes. Not reproduced.
- The SQL guard is conservative, not a parser: it may refuse unusual but valid SQL (comments, `$` quoting). The 7B's
  queries passed first time in every real run.
- `db.query` uses a read-only transaction on the `mosaic` user, not a read-only database role.
- Real runs are on a 6 GB GPU (16-18 tok/s): timings on the demo laptop will be lower.

## For Mishka to decide in the morning
1. Push order and timing with Kamal: the chain above, after `ui/desktop` takes `main`.
2. Renumber the contracts if Manjunath's 0.9.0 will not land first.
3. Whether to add a read-only database role for `db.query` (needs a password in `.env`).
4. Whether the planner should let the model write `{role, scope, capabilities, why}` itself (today it picks roles;
   the bounds come from the role table) now that the generation path is in place.
5. B4's status (see the progress log): merge, keep behind its setting, or leave as `-wip`.
