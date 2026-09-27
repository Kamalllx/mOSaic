# agents/ — owner P3, EXCEPT `mosaic_agents/adapters/` (NOOA adapter, owner P2, stretch)
- Agent code imports ONLY `mosaic_contracts` and `mosaic_agents.sdk`. All effects go through `ctx: AgentContext`.
- Unit-test every agent with `mosaic_contracts.testing.fakes.FakeAgentContext` (no kernel, no GPU needed).
- Agents must survive garbage LLM output (the fake model returns placeholders): never raise, return AgentResult(status=failed) instead.
- Brief: docs/team/P3-agents-models.md
