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

## Next
B2 (dynamic agents) on `b/dynamic-agents` from `b/thought-events`: write the plan here first.
