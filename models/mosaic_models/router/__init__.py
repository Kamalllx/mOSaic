"""Policy-driven ModelRouter (blueprint §23, §45).

Owner: P3 — Agents & Models

TODO:
  - [ ] route on privacy, task_class, latency, context size, availability; models.yaml config
  - [ ] fallback chain on MODEL_UNAVAILABLE; JSON output validation + one repair retry
  - [ ] single fixed embedding model per deployment (embedding_dim())
"""
