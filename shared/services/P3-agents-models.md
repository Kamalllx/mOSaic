# P3 Agents & Models: what this split provides
Full brief: [docs/team/P3-agents-models.md](../../docs/team/P3-agents-models.md) · Packages: `agents/` (`mosaic_agents`, minus `adapters/`), `models/` (`mosaic_models`, minus `gpu/`)

| Provides | Kind | Consumers | Fake until ready | Contract |
|---|---|---|---|---|
| `ModelRouter` (+ `OllamaProvider`) | interface | P1 `ctx.llm`, P2 embeddings | `FakeModelRouter` | `ModelRouterContract` |
| `AgentRegistry` (`agents/manifests/*.yaml`) | interface | P1 lifecycle, `/registry/agents` | `FakeAgentRegistry` | `AgentRegistryContract` |
| `AgentRuntime` | interface | P1 lifecycle | `FakeAgentRuntime` | `AgentRuntimeContract` |
| Agent SDK (`mosaic_agents.sdk`) | library | agent authors, P2 NOOA adapter | — | — |
| planner / finance / engineering / research / action | agents | run by P1 | `FakeAgentRuntime` | via `AgentRuntimeContract` |

**Hard rules:** `privacy=restricted` ⇒ local model; one fixed embedding model per deployment (changing it = reindex, tell P2); agents act only via `ctx`.

## Status (owner keeps this current)
| Item | Status |
|---|---|
| Ollama provider + router + embeddings | ☑ |
| SDK + runtime + registry | ☑ |
| Planner (with fallback plan) | ☑ |
| Finance · engineering · research | ☑ |
| Action (approval path) | ☑ |
| A2A helpers | ☑ |
| Prompt tuning on local models (M3) | ☑ |
