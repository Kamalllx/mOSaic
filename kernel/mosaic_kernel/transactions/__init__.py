"""Transactional actions: execute -> verify -> commit | rollback (blueprint §31).

Owner: P1 — Kernel & Execution

TODO:
  - [ ] build ToolInvocation from the approved SyscallRequest + decision constraints
  - [ ] ToolExecutor.execute -> verify -> commit (transaction.committed) or rollback (transaction.rolled_back)
  - [ ] idempotency_key dedupe; audit TOOL/VERIFY/COMMIT/ROLLBACK entries
"""
