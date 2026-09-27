"""Process table: PID allocation, AgentProcess records, parent/child tree, state machine.

Owner: P1 — Kernel & Execution

TODO:
  - [ ] ProcessTable.create/get/list/tree; PIDs start at 101 and are never reused
  - [ ] transition(pid, new_state) enforces mosaic_contracts.schema.ALLOWED_TRANSITIONS (else INVALID_STATE_TRANSITION)
  - [ ] every transition publishes process.state_changed and writes an AuditKind.STATE entry
"""
