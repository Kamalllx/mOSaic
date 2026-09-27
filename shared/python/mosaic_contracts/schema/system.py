"""Health, resource monitor (ai-top) and system status."""
from __future__ import annotations

from datetime import datetime

from pydantic import Field

from .common import Contract, utcnow


class ComponentHealth(Contract):
    component: str = Field(description="kernel | knowledge | memory | models | agents | tools | sandbox | db | redis | ollama")
    ok: bool
    mode: str = Field("real", description="real | fake — which implementation is wired in")
    detail: str = ""


class GpuStatus(Contract):
    name: str
    utilization: float = Field(ge=0.0, le=1.0)
    memory_used_mb: int
    memory_total_mb: int


class ResourceSnapshot(Contract):
    ts: datetime = Field(default_factory=utcnow)
    cpu_percent: float
    ram_used_mb: int
    ram_total_mb: int
    gpu: GpuStatus | None = None
    running_processes: int = 0
    queued_tasks: int = 0
    active_sandboxes: int = 0
    tokens_last_minute: int = 0


class SystemStatus(Contract):
    ready: bool
    version: str
    contract_version: str
    uptime_s: float
    components: list[ComponentHealth]
