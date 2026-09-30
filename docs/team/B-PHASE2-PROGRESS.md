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

## B2: dynamic agents (in progress)

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

## Next
Build B2 per the plan above: contract branch first.
