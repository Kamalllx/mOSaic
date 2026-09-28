"""Tool backend protocol + result helpers shared by every backend."""
from __future__ import annotations

from typing import Any, Protocol
from urllib.parse import urlsplit

from mosaic_contracts.errors import MosaicError
from mosaic_contracts.schema import (
    ErrorInfo,
    ToolInvocation,
    ToolResult,
    ToolResultStatus,
    ToolSpec,
    VerificationCheck,
    VerificationResult,
)
from mosaic_contracts.schema.common import new_id


class ToolBackend(Protocol):
    name: str

    def spec(self) -> ToolSpec: ...
    async def execute(self, inv: ToolInvocation) -> ToolResult: ...
    async def verify(self, inv: ToolInvocation, result: ToolResult) -> VerificationResult: ...
    async def rollback(self, inv: ToolInvocation, result: ToolResult) -> bool: ...


def ok(inv: ToolInvocation, output: dict[str, Any], *, rollback_token: str | None = None,
       artifacts: list[str] | None = None, logs: str = "") -> ToolResult:
    return ToolResult(invocation_id=inv.invocation_id, status=ToolResultStatus.SUCCESS, output=output,
                      rollback_token=rollback_token, artifacts=artifacts or [], logs=logs)


def err(inv: ToolInvocation, code: str, message: str, *, retriable: bool | None = None) -> ToolResult:
    e = MosaicError(code, message, retriable=retriable)
    return ToolResult(invocation_id=inv.invocation_id, status=ToolResultStatus.ERROR, error=e.to_info())


def error_result(inv: ToolInvocation, info: ErrorInfo) -> ToolResult:
    return ToolResult(invocation_id=inv.invocation_id, status=ToolResultStatus.ERROR, error=info)


def status_check(inv: ToolInvocation, result: ToolResult, extra: list[VerificationCheck] | None = None) -> VerificationResult:
    checks = [VerificationCheck(name="status_success", passed=result.status == ToolResultStatus.SUCCESS), *(extra or [])]
    return VerificationResult(invocation_id=inv.invocation_id, passed=all(c.passed for c in checks), checks=checks)


def token() -> str:
    return new_id("RB")


def require(args: dict[str, Any], *keys: str) -> None:
    missing = [k for k in keys if k not in args]
    if missing:
        raise MosaicError("BAD_REQUEST", f"missing argument(s): {', '.join(missing)}")


def host_port(url: str) -> str:
    parts = urlsplit(url)
    port = parts.port or (443 if parts.scheme == "https" else 80)
    return f"{parts.hostname}:{port}"


def network_allowed(url: str, constraints: dict[str, Any]) -> bool:
    """Agent-chosen destinations only. Key absent = policy set no constraint; present but empty = nothing allowed."""
    if "network_allow" not in constraints:
        return True
    target = host_port(url)
    host = target.rsplit(":", 1)[0]
    for entry in constraints["network_allow"]:
        pattern_host, _, pattern_port = entry.partition(":")
        host_ok = pattern_host == host or (pattern_host.startswith("*.") and host.endswith(pattern_host[1:]))
        if host_ok and (not pattern_port or pattern_port == target.rsplit(":", 1)[1]):
            return True
    return False
