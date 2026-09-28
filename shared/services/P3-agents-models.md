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
| Integrated on `integration/m3` (2026-09-28) | ☑ real runs on llama3.2:3b + nomic-embed-text through the console: cited root causes, 6.2 lakh / 31%, one action agent, one approval |
| Memory: finance/engineering `remember_finding` (drives consolidation + invalidation) | ☑ |
| Citations limited to documents retrieved in the run; approval evidence = root-cause documents | ☑ |
| Router: batch `/api/embed`, schema-invalid JSON repaired, `MODEL_UNAVAILABLE` at routing time; model tests skip when models aren't pulled | ☑ |
| Agents consult `/org/policies` (needed for the security-policy-v2 invalidation demo) | ☐ follow-up |
| Review leftovers: `MOSAIC_MODELS_CONFIG` override (contract field, 0.5.0; `models/models.7b-only.yaml` for 8 GB GPUs) | ✅ |
| Review leftovers: nomic `search_query:`/`search_document:` prefixes (contract, co-propose with P2) | ☐ |
