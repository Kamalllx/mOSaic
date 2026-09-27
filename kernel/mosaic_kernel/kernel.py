"""The Kernel: composes every kernel subsystem on top of a ServiceBundle (fake or real services)."""
from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from collections.abc import Coroutine
from typing import Any

from mosaic_contracts.schema import (
    TERMINAL_STATES,
    TERMINAL_TASK_STATUSES,
    AgentState,
    ApprovalStatus,
    AuditEntry,
    AuditKind,
    ComponentHealth,
    ErrorInfo,
    Event,
    EventType,
    TaskStatus,
)
from mosaic_contracts.schema.common import new_id, utcnow
from mosaic_contracts.wiring import ServiceBundle, Settings

from .approvals.queue import ApprovalQueue
from .context.mailboxes import Mailboxes
from .lifecycle.manager import Lifecycle
from .persistence.store import StateStore
from .process.table import ProcessTable
from .quota.manager import QuotaManager
from .scheduler.scheduler import Scheduler
from .syscalls.gateway import SyscallGateway
from .tasks.manager import TaskManager
from .transactions.manager import TransactionManager

log = logging.getLogger("mosaic.kernel")

HISTORY_PER_TASK = 5000


class Kernel:
    def __init__(self, settings: Settings, services: ServiceBundle) -> None:
        self.settings, self.services = settings, services
        self.bus = services.require("event_bus")
        self.audit = services.require("audit")
        self.policy = services.require("policy")
        self.store = StateStore(settings.data_dir / "kernel.db")
        self.procs = ProcessTable(self)
        self.tasks = TaskManager(self)
        self.quotas = QuotaManager(self)
        self.mailboxes = Mailboxes()
        self.approvals = ApprovalQueue(self)
        self.transactions = TransactionManager(self)
        self.syscalls = SyscallGateway(self)
        self.lifecycle = Lifecycle(self)
        self.scheduler = Scheduler(self)
        self.committed: dict[str, list[str]] = {}
        self.history: dict[str, deque[Event]] = {}
        self.ready = False
        self.started_at = time.monotonic()
        self._background: set[asyncio.Task] = set()
        self._subscriptions: list[Any] = []

    # ------------------------------------------------------------------ boot / shutdown
    async def boot(self) -> None:
        self.tasks.load(self.store.tasks())
        self.procs.load(self.store.processes())
        self.approvals.load(self.store.approvals())
        requeue = self._recover()
        self._subscriptions = [self.bus.subscribe("*", self._record_history),
                               self.bus.subscribe(EventType.KNOWLEDGE_CHANGED.value, self._on_knowledge_changed)]
        await self.scheduler.start()
        for t in requeue:
            await self.scheduler.enqueue(t)
        self.ready = True
        await self.emit(EventType.SYSTEM_READY, {"components": [c.model_dump(mode="json") for c in self.components()]})
        log.info("kernel ready (%d tasks restored, %d re-queued)", len(self.tasks.list()), len(requeue))

    def _recover(self) -> list:
        """Blueprint §5.3, MVP semantics: interrupted work fails cleanly; queued work is re-queued."""
        restart = ErrorInfo(code="INTERNAL", message="kernel restarted", retriable=True)
        for p in self.procs.list():
            if p.state not in TERMINAL_STATES and p.state != AgentState.FAILED:
                self.procs.update(p.pid, state=AgentState.TERMINATED, waiting_on=None, last_error=restart)
        for a in self.approvals.list(ApprovalStatus.PENDING):
            self.approvals._save(a.model_copy(update={"status": ApprovalStatus.EXPIRED, "resolved_at": utcnow(),
                                                      "resolved_by": "kernel", "comment": "kernel restarted"}))
        requeue = []
        for t in self.tasks.list():
            if t.status == TaskStatus.QUEUED:
                requeue.append(t)
            elif t.status not in TERMINAL_TASK_STATUSES:
                self.tasks._save(t.model_copy(update={"status": TaskStatus.FAILED, "error": restart, "updated_at": utcnow()}))
        return requeue

    async def shutdown(self) -> None:
        self.ready = False
        await self.scheduler.stop()
        await self.lifecycle.shutdown()
        for sub in self._subscriptions:
            sub.unsubscribe()
        for t in list(self._background):
            t.cancel()

    # ------------------------------------------------------------------ shared helpers
    async def emit(self, type_: EventType | str, payload: dict[str, Any] | None = None, *, task_id: str | None = None,
                   pid: int | None = None, correlation_id: str | None = None, source: str = "kernel") -> Event:
        task = self.tasks.find(task_id) if task_id else None
        event = Event(type=str(type_), source=source, org_id=task.org_id if task else None, task_id=task_id, pid=pid,
                      correlation_id=correlation_id, payload=payload or {})
        await self.bus.publish(event)
        return event

    async def journal(self, task_id: str, kind: AuditKind, summary: str, *, pid: int | None = None, actor: str = "kernel",
                      refs: list[str] | tuple[str, ...] = (), data: dict[str, Any] | None = None) -> None:
        try:
            await self.audit.append(AuditEntry(entry_id=new_id("AU"), task_id=task_id, pid=pid, actor=actor, kind=kind,
                                               summary=summary, refs=list(refs), data=data or {}))
        except Exception:  # auditing must never take the kernel down, but it must be loud
            log.exception("audit append failed (%s %s)", task_id, kind)

    def actor(self, pid: int | None) -> str:
        p = self.procs.find(pid)
        return f"agent:{p.agent}#{p.pid}" if p else "kernel"

    def spawn_background(self, coro: Coroutine[Any, Any, Any]) -> None:
        task = asyncio.create_task(coro)
        self._background.add(task)

        def done(t: asyncio.Task) -> None:
            self._background.discard(t)
            if not t.cancelled() and t.exception() is not None:
                log.error("background task failed", exc_info=t.exception())

        task.add_done_callback(done)

    def components(self) -> list[ComponentHealth]:
        modes = self.services.modes or {}
        out = [ComponentHealth(component="kernel", ok=self.ready, mode="real")]
        for name in ("event_bus", "policy", "audit", "models", "knowledge", "firewall", "memory", "agent_registry",
                     "agent_runtime", "tools", "sandbox", "browser", "artifacts", "converters", "probe"):
            svc = getattr(self.services, name, None)
            mode = modes.get(name) or ("fake" if type(svc).__module__.endswith(".fakes") else "real")
            out.append(ComponentHealth(component=name, ok=svc is not None, mode=mode,
                                       detail="" if svc is not None else "not wired"))
        return out

    # ------------------------------------------------------------------ subscriptions
    async def _record_history(self, event: Event) -> None:
        if event.task_id:
            self.history.setdefault(event.task_id, deque(maxlen=HISTORY_PER_TASK)).append(event)

    async def _on_knowledge_changed(self, event: Event) -> None:
        memory = self.services.memory
        path = event.payload.get("path")
        if memory is None or not path:
            return
        report = await memory.invalidate(path)
        if not report.affected_agents:
            return
        for p in self.procs.list():
            if p.agent in report.affected_agents and p.state not in TERMINAL_STATES:
                await self.emit(EventType.AGENT_LOG, {"level": "warning", "data": report.model_dump(mode="json"),
                                                     "message": f"{path} changed: {len(report.invalidated)} memories are stale"},
                                task_id=p.task_id, pid=p.pid, source="kernel.events")
