"""Resource quotas: tokens, tool calls, wall clock, children, GPU share.

Owner: P1 — Kernel & Execution

TODO:
  - [ ] charge usage on every ctx.llm / ctx.syscall / ctx.spawn; raise QUOTA_EXCEEDED
  - [ ] publish process.usage periodically for ai-top / UI
"""
