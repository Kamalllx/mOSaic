"""FastAPI REST + WebSocket gateway. MUST match shared/api/openapi.json.

Owner: P1 — Kernel & Execution

TODO:
  - [ ] same routes as mosaic_contracts.api.mock_gateway (conformance test in tests/test_contract.py)
  - [ ] auth headers X-Mosaic-User / X-Mosaic-Org -> Principal; MosaicError -> ErrorInfo JSON
  - [ ] /ws/events streams EventBus.stream(task_id, types)
"""
