"""Agent SDK — what an agent author writes against (the Sovereign Agent ABI, blueprint §12.1).

Owner: P3 — Agents & Models

TODO:
  - [ ] class MosaicAgent: async run(goal, ctx: AgentContext) -> AgentResult; snapshot()/restore(state)
  - [ ] helpers: ask_json(ctx, prompt, schema), gather_evidence(ctx, query), cite(hits), propose_action(...)
  - [ ] agents NEVER import kernel/knowledge/execution — only mosaic_contracts + this sdk
"""
