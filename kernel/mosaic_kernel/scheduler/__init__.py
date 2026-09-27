"""Agent + model + resource scheduling (blueprint §22, §44).

Owner: P1 — Kernel & Execution

TODO:
  - [ ] priority queues: high / normal / background with admission control
  - [ ] respect max concurrent RUNNING pids and GPU share (from models.gpu monitor via ResourceSnapshot)
  - [ ] score candidates from AgentRegistry.match(goal) — used when the planner asks for 'best agent'
  - [ ] stretch: preemption of background tasks when a high-priority task arrives
"""
