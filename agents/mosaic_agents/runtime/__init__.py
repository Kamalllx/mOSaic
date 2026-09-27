"""AgentRuntime implementation: load entrypoint from the manifest, pick adapter by framework, run.

Owner: P3 — Agents & Models

TODO:
  - [ ] importlib the 'module:Class' entrypoint; instantiate per pid
  - [ ] custom -> call run(); nooa -> adapters.nooa
  - [ ] map exceptions to AgentResult(status=failed, error=...) only for handled failures
  - [ ] restore(state) for ai-resume
"""
