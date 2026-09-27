"""Agent lifecycle: spawn / run / retry / kill / pause / resume / checkpoint. One asyncio.Task per PID."""
from __future__ import annotations

import asyncio
import logging
import re
from typing import TYPE_CHECKING

from mosaic_contracts.errors import MosaicError
from mosaic_contracts.schema import (
    TERMINAL_STATES,
    AgentManifest,
    AgentResult,
    AgentResultStatus,
    AgentState,
    AuditKind,
    Checkpoint,
    ErrorInfo,
    EventType,
    Principal,
    PrincipalKind,
    PrivacyLevel,
    ResourceQuota,
    SpawnRequest,
    Task,
    can_transition,
)
from mosaic_contracts.schema.common import new_id
from mosaic_contracts.util import has_capability, path_matches

from ..context.agent_context import KernelAgentContext

if TYPE_CHECKING:
    from ..kernel import Kernel

log = logging.getLogger("mosaic.kernel.lifecycle")

MAX_ATTEMPTS = 3          # first run + 2 retries (blueprint §49)
MIN_AGENT_WALL_SECONDS = 1800  # human approvals can take a while


# ---------------------------------------------------------------------------- scope helpers

def _base(glob: str) -> str:
    return re.sub(r"/?\*+$", "", glob.rstrip("/")) or "/org"


def _covers(outer: str, inner: str) -> bool:
    return path_matches(_base(inner), outer)


def mounts_as_globs(mounts: list[str]) -> list[str]:
    return [m.rstrip("/") + "/**" for m in mounts] or ["/org/**"]


def intersect_scopes(a: list[str], b: list[str]) -> list[str]:
    """Globs allowed by both sets (keeps the narrower glob of each overlapping pair)."""
    out: list[str] = []
    for x in a:
        for y in b:
            if _covers(y, x):
                out.append(x)
            elif _covers(x, y):
                out.append(y)
    return list(dict.fromkeys(out))


def parse_memory_mb(value: str) -> int:
    m = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*(Gi|G|Mi|M)?\s*", value or "")
    if not m:
        return 1024
    n, unit = float(m.group(1)), (m.group(2) or "Mi")
    return int(n * 1024) if unit.startswith("G") else int(n)


# ---------------------------------------------------------------------------- lifecycle

class Lifecycle:
    def __init__(self, kernel: Kernel) -> None:
        self.k = kernel
        self.tasks: dict[int, asyncio.Task] = {}
        self.contexts: dict[int, KernelAgentContext] = {}
        self.manifests: dict[int, AgentManifest] = {}
        self.results: dict[int, asyncio.Future[AgentResult]] = {}

    # ------------------------------------------------------------------ spawn
    async def spawn(self, req: SpawnRequest) -> int:
        k = self.k
        task = k.tasks.get(req.task_id)
        manifest = await k.services.require("agent_registry").get(req.agent)
        parent = k.procs.get(req.ppid) if req.ppid is not None else None
        if parent is not None:
            parent_manifest = self.manifests.get(parent.pid)
            if parent_manifest is None or req.agent not in parent_manifest.capabilities.agents:
                raise MosaicError("CAPABILITY_DENIED", f"{parent.agent} may not spawn {req.agent}")
            await k.quotas.charge_child(parent.pid)

        caps = manifest.all_capabilities()
        if req.capabilities is not None:  # a request may only narrow
            caps = [c for c in caps if has_capability(c, req.capabilities)]
        quota = ResourceQuota(
            max_tokens=manifest.resources.max_tokens_per_task, max_tool_calls=manifest.resources.max_tool_calls,
            max_wall_seconds=max(task.quota.max_wall_seconds, MIN_AGENT_WALL_SECONDS),
            max_children=max(len(manifest.capabilities.agents) * 2, 1) if manifest.capabilities.agents else 0,
            cpu=manifest.resources.cpu, memory_mb=parse_memory_mb(manifest.resources.memory), gpu=manifest.resources.gpu)

        proc = k.procs.create(task_id=task.task_id, agent=manifest.name, agent_version=manifest.version, goal=req.goal,
                              ppid=req.ppid, owner=task.user_id, capabilities=caps, quota=quota,
                              memory_mounts=manifest.memory.mounts)
        pid = proc.pid
        principal = Principal(kind=PrincipalKind.AGENT, org_id=task.org_id, user_id=task.user_id, pid=pid,
                              agent=manifest.name, roles=list(task.metadata.get("roles", [])), capabilities=caps,
                              data_scopes=self._scopes(manifest, task, caps),
                              max_privacy=PrivacyLevel(task.metadata.get("max_privacy", PrivacyLevel.INTERNAL.value)))
        ctx = KernelAgentContext(k, pid=pid, ppid=req.ppid, task_id=task.task_id, manifest=manifest,
                                 principal=principal, inputs=req.inputs)
        self.manifests[pid], self.contexts[pid] = manifest, ctx
        self.results[pid] = asyncio.get_running_loop().create_future()
        if parent is None:
            await k.tasks.set_root(task.task_id, pid)

        await k.emit(EventType.PROCESS_SPAWNED, {"agent": manifest.name, "ppid": req.ppid}, task_id=task.task_id, pid=pid)
        await k.journal(task.task_id, AuditKind.SPAWN, f"Spawned {manifest.name}", pid=pid,
                        actor=k.actor(req.ppid) if req.ppid else "kernel.lifecycle",
                        data={"agent": manifest.name, "ppid": req.ppid, "goal": req.goal, "capabilities": caps})
        for state in (AgentState.INITIALIZING, AgentState.READY, AgentState.RUNNING):
            await k.procs.transition(pid, state)
        self.tasks[pid] = asyncio.create_task(self._run(pid, manifest, ctx), name=f"pid-{pid}")
        return pid

    def _scopes(self, manifest: AgentManifest, task: Task, caps: list[str]) -> list[str]:
        scopes = intersect_scopes(mounts_as_globs(manifest.memory.mounts), list(task.data_scope))
        knowledge_allow = getattr(self.k.policy, "knowledge_allow", None)
        if knowledge_allow is not None:
            probe = Principal(kind=PrincipalKind.AGENT, org_id=task.org_id, user_id=task.user_id, agent=manifest.name,
                              roles=list(task.metadata.get("roles", [])), capabilities=caps)
            allow = knowledge_allow(probe)
            if allow:
                scopes = intersect_scopes(scopes, allow)
        return scopes

    # ------------------------------------------------------------------ run
    async def _run(self, pid: int, manifest: AgentManifest, ctx: KernelAgentContext) -> None:
        k = self.k
        runtime = k.services.require("agent_runtime")
        goal = k.procs.get(pid).goal
        result: AgentResult | None = None
        try:
            attempt = 0
            while result is None:
                try:
                    checkpoint = k.store.latest_checkpoint(pid) if attempt else None
                    if checkpoint is not None and checkpoint.agent_state:
                        result = await runtime.restore(manifest, goal, ctx, checkpoint.agent_state)
                    else:
                        result = await runtime.run(manifest, goal, ctx)
                    break
                except MosaicError as e:
                    error = e.to_info()
                    if e.code == "QUOTA_EXCEEDED" or attempt + 1 >= MAX_ATTEMPTS:
                        result = self._failed(pid, manifest, error)
                        break
                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    log.exception("agent %s (pid %s) crashed", manifest.name, pid)
                    error = ErrorInfo(code="INTERNAL", message=f"{type(e).__name__}: {e}", retriable=True)
                    if attempt + 1 >= MAX_ATTEMPTS:
                        result = self._failed(pid, manifest, error)
                        break
                attempt += 1
                await self._to(pid, AgentState.FAILED, reason=error.message, error=error)
                k.procs.update(pid, attempt_count=attempt)
                await self._to(pid, AgentState.RETRYING, reason=f"attempt {attempt + 1}/{MAX_ATTEMPTS}")
                await self._to(pid, AgentState.RUNNING)
        except asyncio.CancelledError:
            result = AgentResult(pid=pid, agent=manifest.name, status=AgentResultStatus.CANCELLED,
                                 summary=f"{manifest.name} was terminated")
            await self._finish(pid, result, AgentState.TERMINATED)
            return
        target = AgentState.COMPLETED if result.status == AgentResultStatus.COMPLETED else AgentState.FAILED
        if result.status == AgentResultStatus.CANCELLED:
            target = AgentState.TERMINATED
        await self._finish(pid, result, target)

    @staticmethod
    def _failed(pid: int, manifest: AgentManifest, error: ErrorInfo) -> AgentResult:
        return AgentResult(pid=pid, agent=manifest.name, status=AgentResultStatus.FAILED,
                           summary=f"{manifest.name} failed: {error.message}", error=error)

    async def _to(self, pid: int, target: AgentState, **kw) -> None:
        """Transition, routing through RUNNING when the direct edge doesn't exist (e.g. PAUSED -> COMPLETED)."""
        state = self.k.procs.get(pid).state
        if state == target:
            return
        if not can_transition(state, target) and can_transition(state, AgentState.RUNNING):
            await self.k.procs.transition(pid, AgentState.RUNNING)
        await self.k.procs.transition(pid, target, **kw)

    async def _finish(self, pid: int, result: AgentResult, target: AgentState) -> None:
        k = self.k
        k.quotas.record_wall(pid)
        proc = k.procs.get(pid)
        result = result.model_copy(update={"pid": pid, "agent": proc.agent, "usage": proc.usage})
        k.store.put_result(result)
        try:
            await self._to(pid, target, reason=result.summary[:200], error=result.error)
        except MosaicError:
            log.exception("could not move pid %s to %s", pid, target)
        await k.journal(proc.task_id, AuditKind.STATE, f"{proc.agent} finished: {result.status.value}", pid=pid,
                        actor=k.actor(pid), refs=result.evidence, data={"summary": result.summary[:500]})
        fut = self.results.get(pid)
        if fut is not None and not fut.done():
            fut.set_result(result)
        k.mailboxes.close(pid)
        self.contexts.pop(pid, None)
        if proc.ppid is None:
            await self._root_finished(proc.task_id, pid, result)

    async def _root_finished(self, task_id: str, root_pid: int, result: AgentResult) -> None:
        for p in self.k.procs.list(task_id):  # orphans die with their root
            if p.pid != root_pid and p.state not in TERMINAL_STATES:
                await self.kill(p.pid, reason="root finished")
        if result.status == AgentResultStatus.COMPLETED:
            await self.k.tasks.complete(task_id, result)
        elif result.status == AgentResultStatus.FAILED:
            await self.k.tasks.fail(task_id, result.summary, result.error)
        else:
            await self.k.tasks.cancel(task_id)

    # ------------------------------------------------------------------ control
    async def wait_result(self, pid: int, timeout: float | None = None) -> AgentResult:
        fut = self.results.get(pid)
        if fut is None:
            stored = self.k.store.result(pid)
            if stored is None:
                raise MosaicError("PROCESS_NOT_FOUND", str(pid))
            return stored
        try:
            return await asyncio.wait_for(asyncio.shield(fut), timeout)
        except TimeoutError as e:
            raise MosaicError("TIMEOUT", f"pid {pid} did not finish within {timeout}s") from e

    async def kill(self, pid: int, reason: str = "killed") -> None:
        proc = self.k.procs.get(pid)
        for child in self.k.procs.children(pid):
            if child.state not in TERMINAL_STATES:
                await self.kill(child.pid, reason)
        ctx = self.contexts.get(pid)
        if ctx is not None:
            ctx.request_cancel()
        task = self.tasks.get(pid)
        if task is not None and not task.done():
            if task is asyncio.current_task():
                raise MosaicError("BAD_REQUEST", "a process cannot kill itself; return from run() instead")
            task.cancel()
            await asyncio.wait({task}, timeout=10)
        elif proc.state not in TERMINAL_STATES:
            await self._to(pid, AgentState.TERMINATED, reason=reason)

    async def pause(self, pid: int) -> None:
        ctx = self.contexts.get(pid)
        proc = self.k.procs.get(pid)
        if ctx is None or proc.state not in (AgentState.RUNNING, AgentState.WAITING):
            raise MosaicError("INVALID_STATE_TRANSITION", f"pid {pid} is {proc.state.value}; cannot pause")
        ctx.gate.clear()
        if proc.state == AgentState.RUNNING:
            await self.k.procs.transition(pid, AgentState.PAUSED, reason="paused by user")

    async def resume(self, pid: int) -> None:
        ctx = self.contexts.get(pid)
        proc = self.k.procs.get(pid)
        if ctx is not None:
            ctx.gate.set()
        if proc.state == AgentState.PAUSED:
            await self.k.procs.transition(pid, AgentState.RUNNING, reason="resumed by user")

    async def checkpoint(self, pid: int) -> Checkpoint:
        proc = self.k.procs.get(pid)
        ctx = self.contexts.get(pid)
        running = proc.state == AgentState.RUNNING
        if running:
            await self.k.procs.transition(pid, AgentState.CHECKPOINTING)
        ws = None
        if self.k.services.memory is not None:
            try:
                ws = await self.k.services.memory.rehydrate(pid)
            except Exception:
                log.exception("rehydrate failed for pid %s", pid)
        cp = Checkpoint(checkpoint_id=new_id("CKPT"), pid=pid, task_id=proc.task_id,
                        agent_state=dict(ctx.last_state) if ctx else {},
                        memory_refs=[i.ref for i in ws.items] if ws else [])
        self.k.store.put_checkpoint(cp)
        self.k.procs.update(pid, checkpoint_id=cp.checkpoint_id)
        await self.k.emit(EventType.PROCESS_CHECKPOINTED, {"checkpoint_id": cp.checkpoint_id}, task_id=proc.task_id, pid=pid)
        if running:
            await self.k.procs.transition(pid, AgentState.RUNNING)
        return cp

    async def shutdown(self) -> None:
        live = [t for t in self.tasks.values() if not t.done()]
        for t in live:
            t.cancel()
        if live:
            await asyncio.wait(live, timeout=10)
