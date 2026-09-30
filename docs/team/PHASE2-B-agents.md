# Phase 2 brief: Person B, dynamic agents and a transparent thought process (needs a GPU)

## Kickoff prompt (paste into Claude Code in the repo root)

```
You are Person B on the mOSaic hackathon team (phase 2). mOSaic is a self-hosted AI operating system: knowledge is a
filesystem, agents are processes, world actions are governed syscalls, everything is audited. Your area: dynamic agents
created for each task, a transparent thought process streamed as events, and new tools (SQL database, browser via
Playwright MCP) so one task can use several things.

First: git fetch; git checkout -b b/thought-events origin/ui/desktop. Create a git-ignored CLAUDE.local.md in the repo
root containing the single line @docs/team/PHASE2-B-agents.md. Read, in order: docs/PROJECT_CONTEXT.md (all of it),
AGENTS.md, shared/README.md, shared/catalogs/events.yaml, agents/mosaic_agents/library/planner.py,
agents/mosaic_agents/registry/, agents/manifests/, policies/, execution/mosaic_execution/mcp/backend.py, and this brief.

Setup: uv sync --all-packages --all-extras; cp .env.example .env if missing; make sure Ollama has qwen2.5:7b-instruct and
nomic-embed-text; uv run pytest -q must be green before you start.

Work through the tasks in docs/team/PHASE2-B-agents.md in order. For each: tests first, implement until green, run
uv run pytest -q and uvx ruff check ., commit (one logical change per commit, area prefix). Contract changes go on their
own contract/<topic> branch with a CONTRACT_VERSION bump and regenerated artifacts; tell the team the new event/field names
with an example payload. Push your branch and tell Kamal; he merges into ui/desktop after checking the demo laptop. Never
push to main or ui/desktop, never force-push, never skip hooks. The Apollo demo must still score 8/8
(uv run python scripts/demo_run.py run --auto-approve) after each of your merges. If the same error beats you three times,
stop and ask. Start with task B1.
```

## Your area
`agents/`, `kernel/` (spawn, policy for generated agents), `execution/` (new tools), `models/`, `policies/`, `data/`, and the contract changes your features need. Kamal renders your events in the desktop. Person C owns identity, RBAC and connectors: use their Principal and permissions when they land, and a stub until then.

## Tasks (in order)

### B1. Thought-process events (contract), and emitting them
**Why:** the UI should show the run as a story, for example: "understood the prompt → chose agents → created them → sub-agents → ran SQL → here is the data". Today it only sees process and syscall events.
- **Contract** (`contract/thought-events`): add to `shared/catalogs/events.yaml` and the schema, keeping payloads small and flat:

  | Event | Payload |
  |---|---|
  | `task.understood` | `intent`, `entities[]`, `capabilities_needed[]`, `plan_summary` |
  | `agent.planned` | `role`, `why`, `scope[]`, `capabilities[]` |
  | `agent.created` | `pid`, `manifest_name`, `template`, `generated: bool` |
  | `agent.thought` | `pid`, `step`, `text` (one short sentence, never raw chain-of-thought or retrieved text) |
  | `tool.query` | `pid`, `tool`, `query` (for example the SQL), `rows`, `ms` |
  | `task.data` | `columns[]`, `rows[][]` (capped at 200), `source` |

- **Mock replay:** add them to the mock gateway (`shared/python/mosaic_contracts/api/mock_gateway.py`), so Kamal and Person D can build the UI without a GPU.
- **Emit them** from the planner and runtime for the Apollo run (understood, planned, created, a few thoughts per agent).
- **Done when:** a real Apollo run streams these events in order, still scores 8/8, and the mock replays them.

### B2. Dynamic agents, spawned for the requirement, scope, role and access
**Why:** the five agents are fixed manifests today.
- **Role templates:** turn the library agents into templates with a role, a system prompt, default tools and quota (analyst, finance analyst, engineer, researcher, data engineer, operator, writer). Add a few new ones where they are needed.
- **Plan:** from the goal, produce a list of `{role, scope (/org paths), capabilities, why}` as structured output. The `task.understood` and `agent.planned` events come from this step.
- **Generate** an `AgentManifest` per planned agent at runtime. Capabilities and memory mounts are the **intersection** of the template, the plan, the requesting user's permissions (Person C's Principal; stub until it lands) and org policy. Register it as an ephemeral manifest for the task, then spawn it through the kernel with a generated policy. Writes still need approval.
- **Sub-agents:** a generated agent may fork sub-agents under the same bounds, never wider.
- **Apollo:** the planner may keep choosing the existing five for the Apollo goal, as long as it goes through the same generation path. It must still score 8/8.
- **Tests:**
  - generated capabilities never exceed the user's;
  - an unknown or over-broad request is narrowed, and a `policy` audit entry says why;
  - sub-agents inherit the bounds.

### B3. A SQL / database tool, and a data scenario
- **Tool:** a governed `db.query` capability (read-only by default; `db.write` requires approval) against a separate demo database, `mosaic_demo_data`.
- **Seed a realistic schema** for the same fictional company (vendors, invoices, cloud_costs by month and project, headcount, tickets) with a seed script under `scripts/`. Use plausible, messy numbers consistent with the Apollo bundle.
- **Text-to-SQL:** a data-engineer template writes SQL from the schema, and the kernel checks it:
  - one statement;
  - read-only unless approved;
  - a `LIMIT`;
  - no DDL.

  It then runs it and emits `tool.query` and `task.data`.
- **Second scenario:** for example "Which vendors were paid more than their contract in Q3, and by how much? Draft a note to finance." It should include understanding, agent creation, a SQL query, the data table and an approval for any email or ticket.
- **Scoring:** add it to `scripts/demo_run.py` as `--scenario vendors`, with its own checks.

### B4. The browser through a Playwright MCP server; multi-tool tasks
- Run the Playwright MCP server (`@playwright/mcp`) inside the browser sandbox image. It stays on the internal network with the URL allowlist.
- Expose its tools through `execution/mosaic_execution/mcp/backend.py` as `browser.*` capabilities.
- Screenshots become `sandbox.screenshot` events.
- A task can now combine SQL, the browser, knowledge and Person C's connectors (GitHub, Calendar) when they land. Add one scenario that uses at least three tools.

### B5. Hardening
- Timeouts, quota exhaustion and model failures end in a clear `task.failed` with a reason.
- Generated agents clean up their ephemeral manifests.
- Add a test for each fix.

## Useful facts
- **Registry:** loads `agents/manifests/*.yaml` (`registry.reload()` exists), and `match(goal)` picks agents by terms today.
- **Planner:** decomposition is in `planner.py`; structured output uses `ask_json` in `agents/mosaic_agents/sdk`.
- **Agents act only through `ctx`:** `ctx.search`, `ctx.syscall`, `ctx.remember`, `ctx.send`, `ctx.log`.
- **Policies:** YAML in `policies/`; the policy engine is in `kernel/mosaic_kernel/policy`.
- **Models:** router in `models/models.yaml`; `models.7b-only.yaml` on 8 GB GPUs.
