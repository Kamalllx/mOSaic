"""Human approval queue.

Owner: P1 — Kernel & Execution

TODO:
  - [ ] create Approval from PolicyDecision; publish approval.requested
  - [ ] resolve(approve/reject) wakes the waiting syscall; APPROVAL_ALREADY_RESOLVED on double resolve
  - [ ] expiry -> EXPIRED -> syscall REJECTED
"""
