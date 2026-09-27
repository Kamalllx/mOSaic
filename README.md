# mOSaic

**An operating system for organizational intelligence.** A local-first, multi-user AI execution environment where the organization's knowledge becomes a managed filesystem, agents become processes, context becomes memory, MCP becomes a governed syscall layer, and a policy-driven kernel controls what AI can know, compute and do.

## Start here

| Doc | What it's for |
|---|---|
| [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md) | the team split, interfaces, milestones, integration order, risks |
| [docs/team/](docs/team) | **one detailed brief per person** (inputs/outputs, specs, ordered tasks, DoD). Load yours into your coding agent |
| [docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md) | every folder: purpose, owner, generated vs hand-written, "where does X go?" |
| [AGENTS.md](AGENTS.md) / [CLAUDE.md](CLAUDE.md) | hard rules for coding agents (auto-loaded by Claude Code; nested copies per folder) |
| [shared/README.md](shared/README.md) | the integration contract and how to change it |
| [Mosaic_Preoject_Description.md](Mosaic_Preoject_Description.md) | the architecture blueprint |
| [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) | the live demo run-sheet |

## Team split

| | Split | 
|---|---|
| **P1** | [Kernel & Execution](docs/team/P1-kernel-execution.md) | 
| **P2** | [Knowledge, Memory & Console](docs/team/P2-knowledge-console.md) | 
| **P3** | [Agents & Models](docs/team/P3-agents-models.md) | 
| **P4** | [Platform, Data & Demo](docs/team/P4-platform-data-demo.md) |

## Quick start

```bash
uv sync --all-packages
uv run pytest -rs                 # contract suites; unimplemented parts show as skipped
uv run mosaicd                    # http://localhost:8080/docs (serves the contract mock until the kernel lands)

# coding-agent context
echo "@docs/team/P1-kernel-execution.md" > CLAUDE.local.md      # Claude Code users (pick your brief)
uv run python scripts/context_pack.py P3                         # everyone else → .context/P3-context.md
```
