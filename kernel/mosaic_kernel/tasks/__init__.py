"""Task manager: create/queue/cancel/resume tasks; TaskStatus transitions; one root planner pid per task.

Owner: P1 — Kernel & Execution

TODO:
  - [ ] TaskManager.create(TaskCreate, principal) -> Task; publish task.created
  - [ ] derive TaskStatus from the process tree (running / waiting_approval / completed / failed)
  - [ ] cancel = kill whole tree; resume = restore from last checkpoints
  - [ ] persist via persistence.StateStore
"""
