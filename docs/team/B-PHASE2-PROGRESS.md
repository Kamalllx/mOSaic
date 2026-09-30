# Person B, phase 2: progress log

Running log of the overnight work on `docs/team/PHASE2-B-agents.md`. Newest task last. On a restart or context
compaction: read this file and `git log` first, then continue from "Next".

Stack for every gate: Mishka's laptop (RTX 3050 6 GB), qwen2.5:7b-instruct (about 84% on the GPU) + nomic-embed-text,
`MOSAIC_MODELS_CONFIG=./models/models.7b-only.yaml`, gateway 8099, after `scripts\win\reset-demo.ps1`. A gate is
`demo_run.py run --auto-approve --check-story`; the story check is its own PASS/FAIL line, not part of the score.

## B1: thought-process events (done)

Branches:
- `contract/thought-events` (pushed): `a64a2bd` contract 0.10.0 (six events, payload models, `ctx.narrate`),
  `51e5ac1` the real `KernelAgentContext.narrate` (so the contract branch merges on its own).
- `b/thought-events` (from the contract branch): `6a9b8a2` kernel emits `agent.created`, `tool.query`, `task.data`;
  `db7a7b8` agents narrate; `742b710` planned order = creation order, finance thinks in counts; `9159fc0`
  `scripts/check_story.py` + `demo_run.py --check-story`.

Decisions:
- 0.10.0, not 0.9.0: Manjunath's unmerged `contract/system-config` already uses 0.9.0. Both touch
  `schema/__init__.py` and the generated files; whoever merges second regenerates.
- Agents emit only `task.understood`, `agent.planned`, `agent.thought` (through `ctx.narrate`, the kernel stamps the
  pid). The kernel emits `agent.created`, `tool.query`, `task.data`, so an agent cannot fake a query result.
- `agent.created` is for agents a planner creates; the root planner is the task itself and gets none.
- Thought text is built from counts and names. The finance thought no longer quotes the 7B's overrun figures (a Zeus
  run said 0.4 lakh / 3.64% while the report correctly said 1.4 / 35%).
- The story checker checks order rules, not an exact sequence: real runs interleave specialists.

Tests: 361 passed, 0 skipped; ruff clean; `npm --prefix apps/web run build` passed on the contract branch.

Gates (after `9159fc0`):

| Run | Score | Time | Story |
|---|---|---|---|
| Apollo | 8/8 | 104.0 s | PASS |
| Zeus | 8/8 | 96.4 s | PASS |
| Zeus, classifier on, `--expect-llm-flag` | 9/9 | 107.0 s | PASS |

Notes for Kamal: see the B1 note (event names and example payloads); merge order `contract/thought-events`, then
`b/thought-events`.

## B2: dynamic agents (done)

Branches: `contract/dynamic-agents` (0.11.0) from `contract/thought-events`; `b/dynamic-agents` from `b/thought-events`
with the contract branch merged in.

### Plan (written before code)

**What exists and constrains the design.** The kernel spawns by manifest name from the registry; `SpawnRequest.capabilities`
can only narrow; data scopes are already `manifest mounts ∩ task.data_scope ∩ policy knowledge.allow`. Policies match
agents by name (`fnmatch` on `applies_to.agents`, first match by priority wins), so a generated name like
`finance-agent@T-1` would silently lose `finance-agent-v1` and `research-agent-v1` (browser access) and break Apollo.
After a restart only the root planner resumes (from its checkpoint); every other process is retired.

**Role templates.** A template is a registry manifest (`agents/manifests/*.yaml`), so `GET /registry/agents`, the
runtime and the contract suites keep working. The four library specialists are templates as they are (`finance-agent`,
`engineering-agent`, `research-agent`, `action-agent`, same ids, so Apollo's roles do not change). New:
- `analyst`: knowledge read/search over /org, may fork `data-engineer` and `writer` (the sub-agent case);
- `data-engineer`: knowledge read/search; B3 adds `db.query` (read-only) to it;
- `writer`: knowledge read/search + `fs.write` (drafts in the task workspace).
Each has a role (description/handles), a `system_prompt` (new optional manifest field), default capabilities, a quota
(`resources`) and a default scope (`memory.mounts`). New templates run a generic `TemplateAgent` (search, then one
structured answer with citations, using the template's prompt). The planner manifest is the root and is not generated.

**Plan shape.** `AgentPlan {role, scope[], capabilities[], why}` per step, built by the planner from each validated plan
step: `role` = the step's agent (a template id), `scope`/`capabilities` = the template defaults (from the planner's role
table, kept equal to the YAML by a test), `why` = the role table's reason. It feeds `agent.planned` and is passed to
`ctx.spawn(role, goal, inputs, capabilities=..., scope=..., why=...)`. Decision: the model still chooses the roles and
step goals with the unchanged prompt, and does not write scopes/capabilities itself. Letting the 7B write them would
change Apollo's planning prompt and output; the kernel narrows whatever is requested anyway. Alternative noted for later:
ask the model for `{role, scope, capabilities, why}` directly once the prompt can change without risking the gates. The
new templates are only listed in the planning prompt when the goal matches their handles, so the Apollo and Zeus
prompts stay byte-identical (tested).

**Intersection (kernel, at spawn of any child).**
- capabilities = template.all_capabilities() ∩ requested (if given) ∩ user permissions ∩ org policy
  [∩ parent's granted capabilities when the parent is itself generated];
- scope (memory mounts, as globs) = template mounts ∩ requested scope (if given) ∩ user data scopes
  [∩ parent's scopes when the parent is generated]; the existing `task.data_scope ∩ policy knowledge.allow` still applies
  to the principal on top;
- org policy for a capability = the org documents that match the *template* name would not default-deny it (and do
  not set it to `never`);
- user permissions come from a `PermissionsProvider` (contract interface): `{user, org, roles}` → `UserPermissions
  {user, org, roles, permissions[], capabilities[], data_scopes[]}`. Stub: `policies/role-capabilities.yaml` maps
  roles to agent capabilities and data scopes (separate from C's `policies/roles.yaml`, which has app permissions
  only); a user with no roles gets `member`; alice today = `owner` (everything the demo needs). C's RBAC replaces the
  stub behind the same interface (`ServiceBundle.permissions`).
- Anything dropped is recorded: one `policy` audit entry per generated agent that was narrowed, naming each dropped
  capability or scope and why ("not in the finance-agent template", "not granted to alice (roles: member)",
  "no org policy allows it", "unknown capability").

**Ephemeral manifests and policies.** Generated manifest: the template copied with `name = <template>@<task_id>`
(`#2`, `#3` for repeats in one task), `template`, `generated: true`, `task_id`, the narrowed capabilities and mounts.
Generated policy: a `PolicyDocument` `gen-<name>` (priority 0, applies to that name only) that can only *narrow*:
its tools are the granted capabilities, its knowledge allow is the narrowed scope, and every capability whose catalog
default is `approval: required` is `required` (so writes need approval even if an org policy were laxer). The engine
evaluates org documents through the template name and then applies the generated overlay (deny outside it, upgrade
ALLOW to REQUIRES_APPROVAL for its required capabilities); it never widens. Both live in memory in the kernel
(`EphemeralAgents`) and are written to `<data_dir>/ephemeral/<task_id>/{manifests,policies}/*.yaml` for inspection.

**Cleanup.** On any terminal task status (completed, failed, cancelled; a killed root ends the task as failed or
cancelled) the task's ephemeral manifests and policies are removed from memory and disk. At boot the whole
`<data_dir>/ephemeral/` is swept: no generated process survives a restart (only the root resumes, and it regenerates its
children).

**Apollo and Zeus.** Same planner prompt, same four roles, same step goals; the only change is that each child is
spawned from its template through the generation path (name `finance-agent@T-…`, `generated: true`). Policies still
apply through the template name, so research keeps `browser.open` (auto) and action keeps `jira.write` (required) and
`fs.write` (auto): still exactly one approval. Memory owners stay the template id (`finance-agent`) so memories carry
across tasks as before. Phase-1 behaviour (retries, wall-time quota, skipping the tracker write on incomplete
findings) is per pid and unchanged.

**Contract (0.11.0, `contract/dynamic-agents`).** Additive: `AgentManifest.template/generated/task_id/system_prompt`;
`SpawnRequest.scope/why`; `AgentContext.spawn(..., *, capabilities=None, scope=None, why=None)`; `UserPermissions` +
`PermissionsProvider` + `ServiceBundle.permissions`; `util.APPROVAL_REQUIRED` (the catalog's required-by-default
capabilities, tested against the YAML); a fake permissions provider.

### Result

Branches and commits:
- `contract/dynamic-agents` (pushed; cut from `b/thought-events`, see below): `466a3a7` contract 0.11.0.
- `b/dynamic-agents` (from the contract branch): `edbca3c` plan (this log), `a124712` kernel generation, overlay
  policies, permissions stub, cleanup and sweep; `14ba976` role templates and the planner's bounded spawns.

Decisions made while building:
- **The contract branch is cut from `b/thought-events`, not `contract/thought-events`.** Cut from the contract branch
  it scored 8/8, 8/8, 9/9, but its story check failed by design (no emission on a contract-only branch), and the
  rules say never push a branch that fails `--check-story`. On `b/thought-events` it passes, and the merge order stays
  one chain: `contract/thought-events` → `b/thought-events` → `contract/dynamic-agents` → `b/dynamic-agents`. After
  the earlier merges its diff is contract-only (plus the kernel's pass-through of the new spawn arguments).
- **0.11.0:** no `origin/contract/*` uses it (`system-config` has 0.9.0, mine 0.10.0).
- **The role stub file is `policies/rbac/role-capabilities.yaml`,** not `policies/`: the policy engine loads every
  `policies/*.yaml` as a `PolicyDocument` and would fail at boot. **Person C's `policies/roles.yaml` on
  `identity-connectors` has exactly this problem** (flag for Kamal before merging it).
- **Org policy intersection skips context-level capabilities** (`knowledge.*`, `agent.*`, `memory.*`): no policy
  document lists them (`agent.spawn` would be dropped and no generated agent could fork); org policy bounds them through
  knowledge scopes.
- **Generated policies only narrow:** an overlay consulted after the org documents (deny outside the bounds; a
  catalog approval-required capability needs a person even when an org policy says auto). Decisions keep the org
  policy's name except when the overlay tightens them.
- **The root planner is not generated** (its registry manifest runs as before); every agent it or any other agent
  spawns is.
- **Scripted test runtimes** run a generated agent's template script (`kernel/mosaic_kernel/testing.py`), and five
  kernel tests now assert the generated names (`worker@T-…`, `worker@T-…#2`).
- Alternative not taken: letting the model write `{role, scope, capabilities, why}` itself (changes the Apollo
  prompt). The planner builds them from its role table; the kernel narrows whatever is asked.

Tests: 381 passed, 0 skipped (the first version of this entry said 377: a miscount); ruff clean; web build passed on the contract branch. New:
`shared/python/tests/test_dynamic_agents_contract.py` (5), `kernel/tests/test_dynamic_agents.py` (8: bounded by the
user, over-broad request narrowed with an audit entry, org policy through the template and the write overlay,
sub-agents never wider, cleanup on success/failure/cancel, boot sweep, the role stub, alice can still run the demo),
`agents/tests/test_dynamic_roles.py` (6: Apollo/Zeus prompts unchanged, templates offered by handles, spawned with the
announced bounds, role tables = templates, TemplateAgent, memory owned by the role), one scope test in
`kernel/tests/test_narrate.py`.

Gates (`b/dynamic-agents` at `14ba976`):

| Run | Score | Time | Story |
|---|---|---|---|
| Apollo | 8/8 | 102.5 s | PASS |
| Zeus | 8/8 | 105.5 s | PASS |
| Zeus, classifier on, `--expect-llm-flag` | 9/9 | 98.0 s | PASS |

The contract branch alone (at `466a3a7`): Apollo 8/8 110.9 s, Zeus 8/8 107.0 s, Zeus classifier on 9/9 137.1 s, story
PASS on all three.

Verified on the real Apollo and Zeus runs: all four children `…@T-…` with `generated: true`, no `Narrowed` audit
entries (the plan's bounds equal the templates'), `jira.write` still decided by `project-updates-v1` (through the
template name), and no ephemeral folders left after the tasks.

Notes for Kamal (contract 0.11.0):
- `agent.created` now says `"generated": true` and `manifest_name: "finance-agent@T-27b3393603"`; `template` is still
  the role (`finance-agent`), equal to `agent.planned.role`. Repeats of a role in one task: `research-agent@T-…#2`.
- `process.spawned.payload.agent` and `GET /agents` show the generated name; use the part before `@` for the avatar.
- `GET /registry/agents` lists 8 templates now (the 5 library agents + `analyst`, `data-engineer`, `writer`).
- A narrowed agent gets one audit entry, kind `policy`, summary like
  `Narrowed finance-agent@T-1: jira.read (not granted to bob (roles: viewer)); /org/finance/** (outside bob's data scopes)`,
  data `{agent, template, requested, granted, scope, dropped: {item: why}, user, roles, why}`.

Open issues: none blocking. The TemplateAgent is generic (no tools of its own yet); B3 gives `data-engineer`
`db.query`.

## B3: SQL tool + vendors scenario (done)

Branches and commits:
- `contract/db-tool` (pushed; cut from `b/dynamic-agents`, same chain rule as B2): `f6343d3` contract 0.12.0.
- `b/sql-tool` (from the contract branch): `eced521` kernel SQL guard + `db.query` as tool.query/task.data;
  `f532613` the db backend; `75d7fb1` seed script and the mosaicd URL; `2ba4ba1` data engineer, writer, the planner's
  data path, `demo_run.py --scenario vendors`, the story checker's approval rule.

What it does:
- `db.query` (low, auto) and `db.write` (high, approval required) on `mosaic_demo_data`
  (`MOSAIC_DEMO_DATA_URL`; `scripts/win/start-mosaicd.ps1` sets it on the stack's Postgres port).
- The kernel checks every statement before policy (`kernel/mosaic_kernel/syscalls/sql_guard.py`): one statement; a
  query is SELECT/WITH only, no write keyword anywhere, no DDL, no SELECT INTO / FOR UPDATE, no server functions, a
  LIMIT of at most 200 (added, lowered, or the statement wrapped); a write is one INSERT/UPDATE/DELETE, UPDATE/DELETE
  need WHERE. Refused: a DENY from policy `kernel.sql` with the reason. The statement that runs is the checked one.
- The backend runs queries in a READ ONLY transaction with a 5 s statement timeout, 200 rows max; writes in their own
  transaction. Timeout: `TIMEOUT`; unreachable: `TOOL_FAILED`; bad SQL: `BAD_REQUEST`.
- `scripts/seed_demo_data.py` (idempotent; only ever touches a database named `mosaic_demo_data`): vendors,
  contracts, invoices, cloud_costs, headcount, tickets, finance_notes, from `mosaic_contracts.testing.demo_data`
  (consistent with the bundle: PayCo's licence + emergency contract, CloudCo's committed compute and the dual-run
  bills, Cumulus's Q4 price rise). Messy on purpose: void and pending invoices, dates just outside Q3.
  Expected Q3 overpaid: PayCo 42,350.00, CloudCo 143,550.75, TalentX 11,280.00.
- The data engineer writes one SELECT from the schema (one retry with the kernel's or the database's reason); the
  writer drafts the note (prose from the model, figures as a table from the rows) and files it through `db.write`.
- The planner answers a data question (the goal's words offer the data-engineer role) on a path of its own:
  understood, data-engineer then writer, nothing filed when the query returned nothing (the task then fails with a
  partial answer), `answer.md`.

Decisions:
- **No SQL parser dependency** (none in `uv.lock`): conservative checks that refuse what they cannot read
  (comments, `$` quoting, backslashes, a second statement). Session commands (SET, COPY, DO, ...) are refused by the
  first-word rule, not by a keyword list, so `UPDATE ... SET` and a table alias `copy` are fine.
- **One dataset for Postgres and the fake:** `mosaic_contracts.testing.demo_data` (the fake db runs it in SQLite),
  so fake-mode tests, the seed and the scoring agree by construction.
- **Read-only connection, not a separate DB role:** the backend's transaction is READ ONLY (a role would need a
  password in the repo or in `.env`; noted as a follow-up).
- **Sync psycopg in a thread:** psycopg's async mode needs a selector event loop; mosaicd on Windows runs the proactor
  loop (`InterfaceError` otherwise).
- **The note goes into `finance_notes` via `db.write`** (the governed write that needs a person); there is no email
  tool. The figures in the note are rendered by code from the rows, not written by the model.
- **The data path is separate from the investigation path** in the planner, and only data questions reach it: the
  Apollo and Zeus plans, prompts and floors are untouched.
- `mosaic-execution` now declares `psycopg[binary]` (`uv lock`, 2 lines).

Tests: 412 passed, 0 skipped; ruff clean; web build passed on the contract branch. New: `test_db_tool_contract.py`
(3), `kernel/tests/test_sql_guard.py` (19), `kernel/tests/test_db_syscalls.py` (guard → policy → approval → tool.query
+ task.data with the real policy files), `execution/tests/test_db_live.py` (4, against the seeded Postgres: the answer,
read-only past the kernel, a clear TIMEOUT, placeholders), `agents/tests/test_data_agents.py` (4: only data questions
take the data path, the scenario end to end in fake mode, one rewrite of a refused query, nothing filed from an
unanswered question).

Gates (`b/sql-tool` at `2ba4ba1`, after seeding):

| Run | Score | Time | Story |
|---|---|---|---|
| Apollo | 8/8 | 105.5 s | PASS |
| Zeus | 8/8 | 131.1 s | PASS |
| Vendors | 8/8 | 19.6 s | PASS |
| Zeus, classifier on, `--expect-llm-flag` | 9/9 | 104.0 s | PASS |

A first vendors run before the gates: 8/8 in 18.1 s, correct SQL on the first attempt. `contract/db-tool` alone:
Apollo 8/8 120.6 s, Zeus 8/8 102.5 s, Zeus classifier on 9/9 102.5 s, story PASS.

Notes for Kamal (contract 0.12.0): no new event types. The vendors run streams `tool.query` with
`"tool": "db.query"` and the SQL text, then `task.data` with `"source": "db.query"`:
`{"columns": ["name", "contract_value", "total_paid", "overpayment"], "rows": [["CloudCo", 225000.0, 368550.75,
143550.75], ...], "source": "db.query"}`. The approval is `db.write` by `writer@T-…` (risk high). New capabilities in
the catalog: `db.query`, `db.write`. Command: `uv run python scripts/seed_demo_data.py`, then
`uv run python scripts/demo_run.py run --auto-approve --check-story --scenario vendors`.

Open issues:
- Once, a full `pytest` run hung for over 40 minutes (its `timeout 1500` did not kill the grandchildren on Windows);
  every folder passes on its own, and the next four full runs were green in about 3 minutes. Not reproduced.
- A read-only database role (instead of a read-only transaction) needs a secret; left for Mishka to decide.

## Next
B4 (Playwright MCP browser + multi-tool scenario) on `b/mcp-browser` from `b/sql-tool`, disk check first.
