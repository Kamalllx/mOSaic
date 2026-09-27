"""Gateway API contract (HTTP + WebSocket) between the kernel gateway (P1) and clients (P4 web UI, CLI, mobile).

The mock gateway in mock_gateway.py IS the spec: shared/api/openapi.json is exported from it,
and P1's real gateway must expose the same (method, path) set — see route_signatures().

Auth (MVP): every request carries  X-Mosaic-User: <user_id>  and  X-Mosaic-Org: <org_id>.
Errors: HTTP status from errors.ERROR_HTTP_STATUS, body = ErrorInfo JSON.
WebSocket: GET /ws/events?task_id=<id>&types=<glob,glob>  → stream of Event JSON objects, one per message.
"""
from __future__ import annotations

from typing import Any

USER_HEADER = "X-Mosaic-User"
ORG_HEADER = "X-Mosaic-Org"
WS_EVENTS_PATH = "/ws/events"


def route_signatures(app: Any) -> set[tuple[str, str]]:
    """{("GET", "/tasks/{task_id}"), ...} for a FastAPI/Starlette app — used by P1's conformance test."""
    sigs: set[tuple[str, str]] = set()
    for r in app.routes:
        path = getattr(r, "path", None)
        if path is None or path.startswith(("/docs", "/redoc", "/openapi")):
            continue
        for m in getattr(r, "methods", None) or {"WS"}:
            if m not in ("HEAD", "OPTIONS"):
                sigs.add((m, path))
    return sigs
