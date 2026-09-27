"""Kernel state store + boot recovery (blueprint §5).

Owner: P1 — Kernel & Execution

TODO:
  - [x] SQLAlchemy models for tasks, processes, approvals, checkpoints under $MOSAIC_DATA_DIR/kernel.db
  - [x] on boot: RUNNING pids -> RETRYING/resume from checkpoint; publish system.ready
  - [ ] resume interrupted pids from their last checkpoint (today: they fail cleanly; queued tasks re-run)
"""
