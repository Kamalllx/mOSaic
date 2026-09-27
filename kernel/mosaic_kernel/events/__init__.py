"""Event bus (in-memory now, Redis Streams for durability) + subscriptions that wake agents.

Owner: P1 — Kernel & Execution

TODO:
  - [x] implement EventBus protocol; pass EventBusContract
  - [ ] stretch: mirror to Redis Streams for durability/replay
  - [x] wire knowledge.changed -> MemoryService.invalidate -> notify affected pids (blueprint §21)
  - [ ] cron.triggered / scheduled agents (stretch)
"""
