"""Kernel state store + boot recovery (blueprint §5).

Owner: P1 — Kernel & Execution

TODO:
  - [ ] SQLAlchemy models for tasks, processes, approvals, checkpoints under $MOSAIC_DATA_DIR/kernel.db
  - [ ] on boot: RUNNING pids -> RETRYING/resume from checkpoint; publish system.ready
"""
