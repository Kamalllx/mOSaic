"""FastAPI REST + WebSocket gateway. Route set MUST match shared/api/openapi.json (the mock gateway)."""
from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from fnmatch import fnmatch
from typing import Any

from fastapi import Body, FastAPI, Header, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from mosaic_contracts import CONTRACT_VERSION
from mosaic_contracts.api import artifact_headers, artifact_media_type
from mosaic_contracts.errors import MosaicError
from mosaic_contracts.schema import (
    TERMINAL_STATES,
    AgentManifest,
    AgentProcess,
    Approval,
    ApprovalResolution,
    ApprovalStatus,
    Checkpoint,
    Event,
    EvidenceSet,
    GraphResult,
    IngestRequest,
    IngestResult,
    KnowledgeListing,
    KnowledgeObject,
    MemoryQuery,
    MemoryRecord,
    ModelInfo,
    PolicyDocument,
    Principal,
    PrincipalKind,
    PrivacyLevel,
    ProcessTreeNode,
    ResourceSnapshot,
    RunTimeline,
    SandboxInfo,
    SearchQuery,
    SpawnRequest,
    SystemConfig,
    SystemStatus,
    Task,
    TaskCreate,
    TaskStatus,
    ToolSpec,
    ValidationReport,
)

from .. import __version__
from ..kernel import Kernel
from ..policy.engine import load_policy_documents
from .config import build_system_config

log = logging.getLogger("mosaic.kernel.gateway")


def user_principal(user: str, org: str, roles: str = "") -> Principal:
    return Principal(kind=PrincipalKind.USER, org_id=org, user_id=user, roles=[r for r in roles.split(",") if r],
                     capabilities=["*"], data_scopes=["/org/**"], max_privacy=PrivacyLevel.INTERNAL)


def create_app(kernel: Kernel) -> FastAPI:
    k = kernel
    svc = kernel.services

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        await k.boot()
        try:
            yield
        finally:
            await k.shutdown()

    app = FastAPI(title="mOSaic Gateway API", version=CONTRACT_VERSION, lifespan=lifespan,
                  description="mOSaic kernel gateway (real implementation of shared/api/openapi.json).")
    app.state.kernel = kernel
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

    @app.exception_handler(MosaicError)
    async def _mosaic_error(_: Request, exc: MosaicError) -> JSONResponse:
        return JSONResponse(status_code=exc.http_status, content=exc.to_info().model_dump(mode="json"))

    User = Header("alice", alias="X-Mosaic-User")
    Org = Header("acme", alias="X-Mosaic-Org")

    # ------------------------------------------------------------------ system
    @app.get("/health", tags=["system"])
    async def health() -> dict[str, Any]:
        return {"ok": k.ready}

    @app.get("/system/status", response_model=SystemStatus, tags=["system"])
    async def system_status() -> SystemStatus:
        comps = k.components()
        return SystemStatus(ready=k.ready, version=__version__, contract_version=CONTRACT_VERSION,
                            uptime_s=round(time.monotonic() - k.started_at, 1), components=comps)

    @app.get("/system/resources", response_model=ResourceSnapshot, tags=["system"])
    async def system_resources() -> ResourceSnapshot:
        snap = await svc.probe.snapshot() if svc.probe else ResourceSnapshot(cpu_percent=0, ram_used_mb=0, ram_total_mb=0)
        sandboxes = await svc.sandbox.list() if svc.sandbox else []
        return snap.model_copy(update={
            "running_processes": sum(1 for p in k.procs.list() if p.state not in TERMINAL_STATES),
            "queued_tasks": k.tasks.queued(),
            "active_sandboxes": sum(1 for s in sandboxes if s.status.value == "running"),
            "tokens_last_minute": k.quotas.tokens_last_minute()})

    @app.get("/system/config", response_model=SystemConfig, tags=["system"])
    async def system_config() -> SystemConfig:
        # permission: config.read once RBAC lands (Person C)
        return await build_system_config(k)

    @app.get("/models", response_model=list[ModelInfo], tags=["system"])
    async def list_models() -> list[ModelInfo]:
        return await svc.require("models").list_models()

    # ------------------------------------------------------------------ tasks
    @app.post("/tasks", response_model=Task, status_code=201, tags=["tasks"])
    async def create_task(body: TaskCreate, user: str = User, org: str = Org,
                          roles: str = Header("", alias="X-Mosaic-Roles")) -> Task:
        return await k.tasks.create(body, user_principal(user, org, roles))

    @app.get("/tasks", response_model=list[Task], tags=["tasks"])
    async def list_tasks(status: TaskStatus | None = None) -> list[Task]:
        return k.tasks.list(status)

    @app.get("/tasks/{task_id}", response_model=Task, tags=["tasks"])
    async def get_task(task_id: str) -> Task:
        return k.tasks.get(task_id)

    @app.post("/tasks/{task_id}/cancel", response_model=Task, tags=["tasks"])
    async def cancel_task(task_id: str) -> Task:
        return await k.tasks.cancel(task_id)

    @app.post("/tasks/{task_id}/resume", response_model=Task, tags=["tasks"])
    async def resume_task(task_id: str) -> Task:
        return await k.tasks.resume(task_id)

    @app.post("/tasks/{task_id}/checkpoint", response_model=list[Checkpoint], tags=["tasks"])
    async def checkpoint_task(task_id: str) -> list[Checkpoint]:
        k.tasks.get(task_id)
        return [await k.lifecycle.checkpoint(p.pid) for p in k.procs.list(task_id)
                if p.state not in TERMINAL_STATES and p.pid in k.lifecycle.contexts]

    @app.get("/tasks/{task_id}/artifacts", response_model=list[str], tags=["tasks"])
    async def task_artifacts(task_id: str) -> list[str]:
        k.tasks.get(task_id)
        return await svc.artifacts.list(task_id) if svc.artifacts else []

    @app.get("/tasks/{task_id}/artifacts/{name:path}", tags=["tasks"], response_class=Response,
             responses={200: {"content": {"application/octet-stream": {}}, "description": "the artifact bytes"}})
    async def task_artifact(task_id: str, name: str) -> Response:
        k.tasks.get(task_id)
        ref = f"artifact://{task_id}/{name}"
        if svc.artifacts is None:
            raise MosaicError("ARTIFACT_NOT_FOUND", ref)
        data = await svc.artifacts.get(ref)  # the store rejects names that escape the task folder
        return Response(data, media_type=artifact_media_type(name), headers=artifact_headers(name))

    # ------------------------------------------------------------------ processes
    @app.get("/agents", response_model=list[AgentProcess], tags=["agents"])
    async def list_processes(task_id: str | None = None) -> list[AgentProcess]:
        return k.procs.list(task_id)

    @app.get("/agents/tree", response_model=list[ProcessTreeNode], tags=["agents"])
    async def process_tree(task_id: str | None = None) -> list[ProcessTreeNode]:
        return k.procs.tree(task_id)

    @app.post("/agents/spawn", response_model=AgentProcess, status_code=201, tags=["agents"])
    async def spawn(body: SpawnRequest) -> AgentProcess:
        return k.procs.get(await k.lifecycle.spawn(body))

    @app.get("/agents/{pid}", response_model=AgentProcess, tags=["agents"])
    async def get_process(pid: int) -> AgentProcess:
        return k.procs.get(pid)

    @app.post("/agents/{pid}/pause", response_model=AgentProcess, tags=["agents"])
    async def pause(pid: int) -> AgentProcess:
        await k.lifecycle.pause(pid)
        return k.procs.get(pid)

    @app.post("/agents/{pid}/resume", response_model=AgentProcess, tags=["agents"])
    async def resume(pid: int) -> AgentProcess:
        await k.lifecycle.resume(pid)
        return k.procs.get(pid)

    @app.post("/agents/{pid}/kill", response_model=AgentProcess, tags=["agents"])
    async def kill(pid: int) -> AgentProcess:
        await k.lifecycle.kill(pid, reason="killed by user")
        return k.procs.get(pid)

    @app.post("/agents/{pid}/checkpoint", response_model=Checkpoint, tags=["agents"])
    async def checkpoint_process(pid: int) -> Checkpoint:
        return await k.lifecycle.checkpoint(pid)

    # ------------------------------------------------------------------ registry
    @app.get("/registry/agents", response_model=list[AgentManifest], tags=["registry"])
    async def registry_agents() -> list[AgentManifest]:
        return await svc.require("agent_registry").list()

    @app.get("/registry/tools", response_model=list[ToolSpec], tags=["registry"])
    async def registry_tools() -> list[ToolSpec]:
        return await svc.require("tools").list_tools()

    # ------------------------------------------------------------------ knowledge (user principal)
    @app.get("/knowledge/search", response_model=EvidenceSet, tags=["knowledge"])
    async def knowledge_search(q: str, scope: list[str] = Query(default=["/org"]), top_k: int = 8,
                               user: str = User, org: str = Org) -> EvidenceSet:
        return await svc.require("knowledge").search(SearchQuery(text=q, scope=scope, top_k=top_k), user_principal(user, org))

    @app.get("/knowledge/tree", response_model=KnowledgeListing, tags=["knowledge"])
    async def knowledge_tree(path: str = "/org", user: str = User, org: str = Org) -> KnowledgeListing:
        return await svc.require("knowledge").list(path, user_principal(user, org))

    @app.get("/knowledge/object", response_model=KnowledgeObject, tags=["knowledge"])
    async def knowledge_object(path: str, user: str = User, org: str = Org) -> KnowledgeObject:
        return await svc.require("knowledge").read(path, user_principal(user, org))

    @app.get("/knowledge/graph", response_model=GraphResult, tags=["knowledge"])
    async def knowledge_graph(path: str, depth: int = 1, user: str = User, org: str = Org) -> GraphResult:
        return await svc.require("knowledge").traverse(path, user_principal(user, org), depth=depth)

    @app.post("/knowledge/ingest", response_model=IngestResult, tags=["knowledge"])
    async def knowledge_ingest(body: IngestRequest) -> IngestResult:
        return await svc.require("knowledge").ingest(body)

    @app.post("/knowledge/reindex", tags=["knowledge"])
    async def knowledge_reindex() -> dict[str, int]:
        return {"indexed": await svc.require("knowledge").reindex()}

    @app.post("/knowledge/validate", response_model=ValidationReport, tags=["knowledge"])
    async def knowledge_validate() -> ValidationReport:
        return await svc.require("knowledge").validate()

    @app.get("/memory", response_model=list[MemoryRecord], tags=["knowledge"])
    async def memory(owner: str | None = None, task_id: str | None = None, org: str = Org) -> list[MemoryRecord]:
        return await svc.require("memory").recall(MemoryQuery(text="", org_id=org, owner=owner, task_id=task_id,
                                                              include_stale=True, top_k=50))

    # ------------------------------------------------------------------ governance
    @app.get("/approvals", response_model=list[Approval], tags=["governance"])
    async def list_approvals(status: ApprovalStatus | None = None) -> list[Approval]:
        return k.approvals.list(status)

    @app.post("/approvals/{approval_id}/approve", response_model=Approval, tags=["governance"])
    async def approve(approval_id: str, body: ApprovalResolution = Body(default_factory=ApprovalResolution),
                      user: str = User) -> Approval:
        return await k.approvals.resolve(approval_id, True, user, body.comment)

    @app.post("/approvals/{approval_id}/reject", response_model=Approval, tags=["governance"])
    async def reject(approval_id: str, body: ApprovalResolution = Body(default_factory=ApprovalResolution),
                     user: str = User) -> Approval:
        return await k.approvals.resolve(approval_id, False, user, body.comment)

    @app.get("/audit/{task_id}", response_model=RunTimeline, tags=["governance"])
    async def audit(task_id: str) -> RunTimeline:
        k.tasks.get(task_id)
        return await k.audit.timeline(task_id)

    @app.get("/policies", response_model=list[PolicyDocument], tags=["governance"])
    async def policies() -> list[PolicyDocument]:
        documents = getattr(k.policy, "documents", None)
        return documents() if documents else load_policy_documents(k.settings.policies_dir)

    @app.get("/sandboxes", response_model=list[SandboxInfo], tags=["execution"])
    async def sandboxes(task_id: str | None = None) -> list[SandboxInfo]:
        return await svc.sandbox.list(task_id) if svc.sandbox else []

    # ------------------------------------------------------------------ events
    @app.websocket("/ws/events")
    async def ws_events(ws: WebSocket, task_id: str | None = None, types: str = "*") -> None:
        """Replays the task's history first (so late subscribers see the whole run), then streams live events."""
        await ws.accept()
        patterns = [t.strip() for t in types.split(",") if t.strip()] or ["*"]
        stream = k.bus.stream("*", task_id)  # register before snapshotting history: nothing can fall in between

        def wanted(ev: Event) -> bool:
            return any(fnmatch(ev.type, p) for p in patterns)

        async def watch_disconnect() -> None:
            with contextlib.suppress(WebSocketDisconnect):
                while True:
                    await ws.receive_text()

        closed = asyncio.create_task(watch_disconnect())
        try:
            replayed = set()
            for ev in list(k.history.get(task_id, ())) if task_id else []:
                replayed.add(ev.event_id)
                if wanted(ev):
                    await ws.send_text(ev.model_dump_json())
            while not closed.done():
                nxt = asyncio.ensure_future(stream.__anext__())
                done, _ = await asyncio.wait({nxt, closed}, return_when=asyncio.FIRST_COMPLETED)
                if nxt not in done:
                    nxt.cancel()
                    break
                ev = nxt.result()
                if ev.event_id not in replayed and wanted(ev):
                    await ws.send_text(ev.model_dump_json())
        except (WebSocketDisconnect, RuntimeError):
            pass
        finally:
            closed.cancel()
            close = getattr(stream, "close", None)
            if close:
                close()

    return app
