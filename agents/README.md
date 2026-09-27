# agents/ — P3 Agents (`mosaic_agents`); `adapters/` (NOOA, stretch) is P2's
Agent SDK, runtime, registry (`manifests/*.yaml`), A2A helpers, prompts, and the agents: planner, finance, engineering, research, action.

- **Brief (with code skeletons):** [docs/team/P3-agents-models.md](../docs/team/P3-agents-models.md)
- No Claude Code? Run `uv run python scripts/context_pack.py P3` and paste `.context/P3-context.md` into your assistant.
- Unit-test agents with `FakeAgentContext`; agent code imports only `mosaic_contracts` and `mosaic_agents.sdk`.

```bash
uv run pytest agents/tests -rs
```
