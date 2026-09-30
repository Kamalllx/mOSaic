"""Event bus envelope + the event type catalog (full producer/consumer table: shared/catalogs/events.yaml)."""
from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import Field

from .common import Contract, Pid, TaskId, new_id, utcnow


class EventType(StrEnum):
    # tasks (P1)
    TASK_CREATED = "task.created"
    TASK_STATUS_CHANGED = "task.status_changed"
    TASK_COMPLETED = "task.completed"
    TASK_FAILED = "task.failed"
    # processes (P1)
    PROCESS_SPAWNED = "process.spawned"
    PROCESS_STATE_CHANGED = "process.state_changed"
    PROCESS_CHECKPOINTED = "process.checkpointed"
    PROCESS_USAGE = "process.usage"
    AGENT_LOG = "agent.log"                  # agent "thoughts"/progress lines for the UI
    # syscalls / governance (P1)
    SYSCALL_REQUESTED = "syscall.requested"
    SYSCALL_DECIDED = "syscall.decided"
    SYSCALL_COMPLETED = "syscall.completed"
    APPROVAL_REQUESTED = "approval.requested"
    APPROVAL_RESOLVED = "approval.resolved"
    TRANSACTION_COMMITTED = "transaction.committed"
    TRANSACTION_ROLLED_BACK = "transaction.rolled_back"
    POLICY_UPDATED = "policy.updated"
    AUDIT_APPENDED = "audit.appended"
    # IPC (P1 routes, P3 produces)
    IPC_MESSAGE = "ipc.message"
    # knowledge & memory (P2)
    KNOWLEDGE_CHANGED = "knowledge.changed"
    KNOWLEDGE_REINDEXED = "knowledge.reindexed"
    KNOWLEDGE_RETRIEVED = "knowledge.retrieved"
    INGEST_PROGRESS = "ingest.progress"
    MOUNT_SYNCED = "mount.synced"
    CONNECTOR_CHANGED = "connector.changed"
    MEMORY_INVALIDATED = "memory.invalidated"
    MEMORY_CONSOLIDATED = "memory.consolidated"
    # models (P3)
    MODEL_INVOKED = "model.invoked"
    # execution (P4)
    SANDBOX_STARTED = "sandbox.started"
    SANDBOX_DESTROYED = "sandbox.destroyed"
    SANDBOX_SCREENSHOT = "sandbox.screenshot"
    TOOL_STARTED = "tool.started"
    TOOL_COMPLETED = "tool.completed"
    # system (P1/P4)
    SYSTEM_READY = "system.ready"
    SYSTEM_HEALTH = "system.health"
    CRON_TRIGGERED = "cron.triggered"


class Event(Contract):
    event_id: str = Field(default_factory=lambda: new_id("EV"))
    type: str = Field(description="An EventType value; custom types must be namespaced x.<owner>.<name>")
    ts: datetime = Field(default_factory=utcnow)
    source: str = Field(description='Component or "pid:<n>", e.g. "kernel.scheduler", "knowledge.indexer"')
    org_id: str | None = None
    task_id: TaskId | None = None
    pid: Pid | None = None
    correlation_id: str | None = Field(None, description="e.g. syscall_id or approval_id")
    payload: dict[str, Any] = Field(default_factory=dict, description="See events.yaml for the payload model per type")
