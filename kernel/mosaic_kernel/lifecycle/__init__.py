"""Agent lifecycle: spawn / run / pause / resume / kill / retry / checkpoint.

Owner: P1 — Kernel & Execution

TODO:
  - [ ] spawn(SpawnRequest) -> AgentProcess: capabilities = child manifest ∩ policy (parent may only spawn agents in ITS manifest.capabilities.agents); start asyncio.Task running AgentRuntime.run
  - [ ] kill = cancel the asyncio.Task (+ children) -> TERMINATED; pause/resume via ctx gate
  - [ ] failure -> FAILED -> RETRYING (retry policy, attempt_count) -> fallback agent -> human escalation (blueprint §49)
  - [ ] checkpoint(pid): ask agent via ctx.checkpoint state, persist Checkpoint; resume via AgentRuntime.restore
"""
