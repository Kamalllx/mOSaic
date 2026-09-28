"""Mock gateway: the executable API spec + a backend for P2's UI before the kernel exists.

    uv run --package mosaic-contracts mosaic-mock-gateway          # http://localhost:8080/docs

Serves the Project Apollo example run. POST /tasks starts a replay of examples.events() over
/ws/events (rewritten to the new task_id); the approval appears in GET /approvals when the replay
reaches approval.requested, and the replay waits there until POST /approvals/{id}/approve|reject.
Like the real gateway, /ws/events?task_id=... first replays the task's history, then streams live. Knowledge endpoints are backed by the fake
knowledge service over shared/fixtures/okf, so they return real search results.
"""
from __future__ import annotations

import asyncio
from fnmatch import fnmatch
from typing import Any

from fastapi import Body, FastAPI, Header, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from .. import CONTRACT_VERSION, examples
from ..errors import MosaicError
from ..schema import (
    AgentManifest,
    AgentProcess,
    AgentState,
    Approval,
    ApprovalResolution,
    ApprovalStatus,
    Checkpoint,
    Event,
    EventType,
    EvidenceSet,
    GraphResult,
    IngestRequest,
    IngestResult,
    KnowledgeListing,
    KnowledgeObject,
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
    SystemStatus,
    Task,
    TaskCreate,
    TaskStatus,
    ToolSpec,
    ValidationReport,
)
from ..schema.common import new_id, utcnow
from ..testing.fakes import FakeContextFirewall, FakeKnowledgeService, FakeModelRouter
from . import artifact_headers, artifact_media_type


class _State:
    def __init__(self) -> None:
        self.tasks: dict[str, Task] = {examples.TASK_ID: examples.task()}
        self.procs: dict[int, AgentProcess] = {p.pid: p for p in examples.processes()}
        self.approvals: dict[str, Approval] = {a.approval_id: a for a in [examples.approval()]}
        self.approval_gates: dict[str, asyncio.Event] = {}
        self.listeners: list[tuple[str | None, list[str], asyncio.Queue]] = []
        self.history: dict[str, list[Event]] = {}
        self.knowledge = FakeKnowledgeService(models=FakeModelRouter(), firewall=FakeContextFirewall())

    async def emit(self, event: Event) -> None:
        if event.task_id:
            self.history.setdefault(event.task_id, []).append(event)
        for task_id, types, q in list(self.listeners):
            if (task_id is None or event.task_id == task_id) and any(fnmatch(event.type, t) for t in types):
                q.put_nowait(event)


# 1x1 transparent PNG: the mock's stand-in for a sandbox screenshot
_PNG_1X1 = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
                         "0000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082")


def _mock_artifacts(task_id: str) -> dict[str, bytes]:
    plan = """# Project Apollo recovery plan

## Root Causes

1. **Dual-run cloud cost**: the old and new stacks ran side by side for 6 weeks
   ([/org/decisions/ADR-042](/org/decisions/ADR-042), [/org/finance/apollo-budget](/org/finance/apollo-budget)).
2. **Backfill failure**: the APOLLO-12 backfill failed twice
   ([/org/engineering/postmortem-backfill-failure](/org/engineering/postmortem-backfill-failure)).
3. **Vendor SDK certification**: SDK v5 certification slipped ([/org/projects/apollo](/org/projects/apollo)).

## Actions

- APOLLO-12 set to At Risk (approved).
"""
    return {"recovery-plan.md": plan.encode(), "engineering-evidence.json": examples.evidence().model_dump_json(indent=2).encode(),
            "screenshots/001.png": _PNG_1X1}


def _principal(user: str, org: str) -> Principal:
    return Principal(kind=PrincipalKind.USER, org_id=org, user_id=user, max_privacy=PrivacyLevel.INTERNAL)


def build_mock_app(replay_speed: float = 4.0) -> FastAPI:
    app = FastAPI(title="mOSaic Gateway API", version=CONTRACT_VERSION,
                  description="Contract for the mOSaic kernel gateway. Served here by the mock implementation.")
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
    st = _State()

    @app.exception_handler(MosaicError)
    async def _mosaic_error(_: Request, exc: MosaicError) -> JSONResponse:
        return JSONResponse(status_code=exc.http_status, content=exc.to_info().model_dump(mode="json"))

    def _task(task_id: str) -> Task:
        if task_id not in st.tasks:
            raise MosaicError("TASK_NOT_FOUND", task_id)
        return st.tasks[task_id]

    def _proc(pid: int) -> AgentProcess:
        if pid not in st.procs:
            raise MosaicError("PROCESS_NOT_FOUND", str(pid))
        return st.procs[pid]

    def _retarget(ev: Event, task_id: str, approval_id: str) -> Event:
        payload = {k: (approval_id if v == "APR-882" else v) for k, v in ev.payload.items()}
        corr = approval_id if ev.correlation_id == "APR-882" else ev.correlation_id
        return ev.model_copy(update={"event_id": new_id("EV"), "task_id": task_id, "ts": utcnow(), "payload": payload,
                                     "correlation_id": corr})

    def _open_approval(task_id: str, approval_id: str) -> None:
        a = examples.approval()
        st.approvals[approval_id] = a.model_copy(update={
            "approval_id": approval_id, "task_id": task_id, "requested_at": utcnow(),
            "decision": a.decision.model_copy(update={"approval_id": approval_id}),
            "syscall": a.syscall.model_copy(update={"task_id": task_id})})

    async def _replay(task_id: str, approval_id: str) -> None:
        prev = None
        for ev in examples.events():
            if prev is not None:
                await asyncio.sleep(max(0.0, (ev.ts - prev).total_seconds()) / replay_speed)
            prev = ev.ts
            if ev.type == EventType.APPROVAL_REQUESTED:
                _open_approval(task_id, approval_id)
            if ev.type == EventType.APPROVAL_RESOLVED:
                await st.approval_gates[approval_id].wait()
                prev = None
                if st.approvals[approval_id].status == ApprovalStatus.REJECTED:
                    ev = ev.model_copy(update={"payload": {**ev.payload, "status": "rejected"}})
                    await st.emit(_retarget(ev, task_id, approval_id))
                    await st.emit(Event(type=EventType.TASK_FAILED, source="kernel", task_id=task_id,
                                        payload={"reason": "approval rejected"}))
                    st.tasks[task_id] = st.tasks[task_id].model_copy(update={"status": TaskStatus.FAILED})
                    return
            await st.emit(_retarget(ev, task_id, approval_id))
        st.tasks[task_id] = st.tasks[task_id].model_copy(update={"status": TaskStatus.COMPLETED, "updated_at": utcnow()})

    # ------------------------------------------------------------------ system
    @app.get("/health", tags=["system"])
    async def health() -> dict[str, Any]:
        return {"ok": True}

    @app.get("/system/status", response_model=SystemStatus, tags=["system"])
    async def system_status() -> SystemStatus:
        return examples.system_status()

    @app.get("/system/resources", response_model=ResourceSnapshot, tags=["system"])
    async def system_resources() -> ResourceSnapshot:
        return examples.resource_snapshot()

    @app.get("/models", response_model=list[ModelInfo], tags=["system"])
    async def list_models() -> list[ModelInfo]:
        return examples.models()

    # ------------------------------------------------------------------ tasks
    @app.post("/tasks", response_model=Task, status_code=201, tags=["tasks"])
    async def create_task(body: TaskCreate, x_mosaic_user: str = Header("alice"), x_mosaic_org: str = Header("acme")) -> Task:
        t = Task(task_id=new_id("T"), org_id=x_mosaic_org, user_id=x_mosaic_user, goal=body.goal,
                 session_id=body.session_id, priority=body.priority, privacy=body.privacy,
                 data_scope=body.data_scope, approval_policy=body.approval_policy, status=TaskStatus.RUNNING, root_pid=101)
        st.tasks[t.task_id] = t
        approval_id = new_id("APR")
        st.approval_gates[approval_id] = asyncio.Event()
        asyncio.get_running_loop().create_task(_replay(t.task_id, approval_id))
        return t

    @app.get("/tasks", response_model=list[Task], tags=["tasks"])
    async def list_tasks(status: TaskStatus | None = None) -> list[Task]:
        return [t for t in st.tasks.values() if status is None or t.status == status]

    @app.get("/tasks/{task_id}", response_model=Task, tags=["tasks"])
    async def get_task(task_id: str) -> Task:
        return _task(task_id)

    @app.post("/tasks/{task_id}/cancel", response_model=Task, tags=["tasks"])
    async def cancel_task(task_id: str) -> Task:
        st.tasks[task_id] = _task(task_id).model_copy(update={"status": TaskStatus.CANCELLED})
        return st.tasks[task_id]

    @app.post("/tasks/{task_id}/resume", response_model=Task, tags=["tasks"])
    async def resume_task(task_id: str) -> Task:
        st.tasks[task_id] = _task(task_id).model_copy(update={"status": TaskStatus.RUNNING})
        return st.tasks[task_id]

    @app.post("/tasks/{task_id}/checkpoint", response_model=list[Checkpoint], tags=["tasks"])
    async def checkpoint_task(task_id: str) -> list[Checkpoint]:
        _task(task_id)
        return [Checkpoint(checkpoint_id=new_id("CKPT"), pid=p.pid, task_id=examples.TASK_ID)
                for p in st.procs.values() if p.state not in (AgentState.COMPLETED, AgentState.TERMINATED)]

    @app.get("/tasks/{task_id}/artifacts", response_model=list[str], tags=["tasks"])
    async def task_artifacts(task_id: str) -> list[str]:
        _task(task_id)
        return [f"artifact://{task_id}/{name}" for name in _mock_artifacts(task_id)]

    @app.get("/tasks/{task_id}/artifacts/{name:path}", tags=["tasks"], response_class=Response,
             responses={200: {"content": {"application/octet-stream": {}}, "description": "the artifact bytes"}})
    async def task_artifact(task_id: str, name: str) -> Response:
        _task(task_id)
        data = _mock_artifacts(task_id).get(name)
        if data is None:
            raise MosaicError("ARTIFACT_NOT_FOUND", f"artifact://{task_id}/{name}")
        return Response(data, media_type=artifact_media_type(name), headers=artifact_headers(name))

    # ------------------------------------------------------------------ processes
    @app.get("/agents", response_model=list[AgentProcess], tags=["agents"])
    async def list_processes(task_id: str | None = None) -> list[AgentProcess]:
        # the mock shows the example process table for every task
        return [p.model_copy(update={"task_id": task_id}) if task_id else p for p in st.procs.values()]

    @app.get("/agents/tree", response_model=list[ProcessTreeNode], tags=["agents"])
    async def process_tree(task_id: str | None = None) -> list[ProcessTreeNode]:
        return [examples.process_tree()]

    @app.post("/agents/spawn", response_model=AgentProcess, status_code=201, tags=["agents"])
    async def spawn(body: SpawnRequest) -> AgentProcess:
        pid = max(st.procs) + 1
        p = AgentProcess(pid=pid, ppid=body.ppid, task_id=body.task_id, owner="alice", agent=body.agent,
                         goal=body.goal, state=AgentState.RUNNING)
        st.procs[pid] = p
        return p

    @app.get("/agents/{pid}", response_model=AgentProcess, tags=["agents"])
    async def get_process(pid: int) -> AgentProcess:
        return _proc(pid)

    def _set_state(pid: int, state: AgentState) -> AgentProcess:
        st.procs[pid] = _proc(pid).model_copy(update={"state": state, "updated_at": utcnow()})
        return st.procs[pid]

    @app.post("/agents/{pid}/pause", response_model=AgentProcess, tags=["agents"])
    async def pause(pid: int) -> AgentProcess:
        return _set_state(pid, AgentState.PAUSED)

    @app.post("/agents/{pid}/resume", response_model=AgentProcess, tags=["agents"])
    async def resume(pid: int) -> AgentProcess:
        return _set_state(pid, AgentState.RUNNING)

    @app.post("/agents/{pid}/kill", response_model=AgentProcess, tags=["agents"])
    async def kill(pid: int) -> AgentProcess:
        return _set_state(pid, AgentState.TERMINATED)

    @app.post("/agents/{pid}/checkpoint", response_model=Checkpoint, tags=["agents"])
    async def checkpoint_process(pid: int) -> Checkpoint:
        p = _proc(pid)
        return Checkpoint(checkpoint_id=new_id("CKPT"), pid=pid, task_id=p.task_id)

    # ------------------------------------------------------------------ registry
    @app.get("/registry/agents", response_model=list[AgentManifest], tags=["registry"])
    async def registry_agents() -> list[AgentManifest]:
        return examples.manifests()

    @app.get("/registry/tools", response_model=list[ToolSpec], tags=["registry"])
    async def registry_tools() -> list[ToolSpec]:
        return examples.tool_specs()

    # ------------------------------------------------------------------ knowledge (real fake-service results)
    @app.get("/knowledge/search", response_model=EvidenceSet, tags=["knowledge"])
    async def knowledge_search(q: str, scope: list[str] = Query(default=["/org"]), top_k: int = 8,
                               x_mosaic_user: str = Header("alice"), x_mosaic_org: str = Header("acme")) -> EvidenceSet:
        return await st.knowledge.search(SearchQuery(text=q, scope=scope, top_k=top_k), _principal(x_mosaic_user, x_mosaic_org))

    @app.get("/knowledge/tree", response_model=KnowledgeListing, tags=["knowledge"])
    async def knowledge_tree(path: str = "/org", x_mosaic_user: str = Header("alice"), x_mosaic_org: str = Header("acme")) -> KnowledgeListing:
        return await st.knowledge.list(path, _principal(x_mosaic_user, x_mosaic_org))

    @app.get("/knowledge/object", response_model=KnowledgeObject, tags=["knowledge"])
    async def knowledge_object(path: str, x_mosaic_user: str = Header("alice"), x_mosaic_org: str = Header("acme")) -> KnowledgeObject:
        return await st.knowledge.read(path, _principal(x_mosaic_user, x_mosaic_org))

    @app.get("/knowledge/graph", response_model=GraphResult, tags=["knowledge"])
    async def knowledge_graph(path: str, depth: int = 1, x_mosaic_user: str = Header("alice"), x_mosaic_org: str = Header("acme")) -> GraphResult:
        return await st.knowledge.traverse(path, _principal(x_mosaic_user, x_mosaic_org), depth=depth)

    @app.post("/knowledge/ingest", response_model=IngestResult, tags=["knowledge"])
    async def knowledge_ingest(body: IngestRequest) -> IngestResult:
        return await st.knowledge.ingest(body)

    @app.post("/knowledge/reindex", tags=["knowledge"])
    async def knowledge_reindex() -> dict[str, int]:
        return {"indexed": await st.knowledge.reindex()}

    @app.post("/knowledge/validate", response_model=ValidationReport, tags=["knowledge"])
    async def knowledge_validate() -> ValidationReport:
        return await st.knowledge.validate()

    @app.get("/memory", response_model=list[MemoryRecord], tags=["knowledge"])
    async def memory(owner: str | None = None, task_id: str | None = None) -> list[MemoryRecord]:
        return [examples.memory_record()]

    # ------------------------------------------------------------------ approvals / audit / governance
    @app.get("/approvals", response_model=list[Approval], tags=["governance"])
    async def list_approvals(status: ApprovalStatus | None = None) -> list[Approval]:
        return [a for a in st.approvals.values() if status is None or a.status == status]

    async def _resolve(approval_id: str, status: ApprovalStatus, body: ApprovalResolution, user: str) -> Approval:
        a = st.approvals.get(approval_id)
        if a is None:
            raise MosaicError("APPROVAL_NOT_FOUND", approval_id)
        if a.status != ApprovalStatus.PENDING:
            raise MosaicError("APPROVAL_ALREADY_RESOLVED", approval_id)
        st.approvals[approval_id] = a.model_copy(update={"status": status, "resolved_at": utcnow(), "resolved_by": user,
                                                         "comment": body.comment})
        if approval_id in st.approval_gates:
            st.approval_gates[approval_id].set()
        return st.approvals[approval_id]

    @app.post("/approvals/{approval_id}/approve", response_model=Approval, tags=["governance"])
    async def approve(approval_id: str, body: ApprovalResolution = Body(default_factory=ApprovalResolution),
                      x_mosaic_user: str = Header("alice")) -> Approval:
        return await _resolve(approval_id, ApprovalStatus.APPROVED, body, x_mosaic_user)

    @app.post("/approvals/{approval_id}/reject", response_model=Approval, tags=["governance"])
    async def reject(approval_id: str, body: ApprovalResolution = Body(default_factory=ApprovalResolution),
                     x_mosaic_user: str = Header("alice")) -> Approval:
        return await _resolve(approval_id, ApprovalStatus.REJECTED, body, x_mosaic_user)

    @app.get("/audit/{task_id}", response_model=RunTimeline, tags=["governance"])
    async def audit(task_id: str) -> RunTimeline:
        _task(task_id)
        return examples.audit_timeline().model_copy(update={"task_id": task_id})

    @app.get("/policies", response_model=list[PolicyDocument], tags=["governance"])
    async def policies() -> list[PolicyDocument]:
        return [examples.policy_document()]

    @app.get("/sandboxes", response_model=list[SandboxInfo], tags=["execution"])
    async def sandboxes(task_id: str | None = None) -> list[SandboxInfo]:
        return [examples.sandbox()]

    # ------------------------------------------------------------------ events
    @app.websocket("/ws/events")
    async def ws_events(ws: WebSocket, task_id: str | None = None, types: str = "*") -> None:
        await ws.accept()
        q: asyncio.Queue = asyncio.Queue()
        patterns = types.split(",")
        entry = (task_id, patterns, q)
        st.listeners.append(entry)  # before the history snapshot, so nothing falls in between
        try:
            replayed = set()
            for ev in list(st.history.get(task_id, ())) if task_id else []:
                replayed.add(ev.event_id)
                if any(fnmatch(ev.type, t) for t in patterns):
                    await ws.send_text(ev.model_dump_json())
            while True:
                ev = await q.get()
                if ev.event_id not in replayed:
                    await ws.send_text(ev.model_dump_json())
        except WebSocketDisconnect:
            pass
        finally:
            st.listeners.remove(entry)

    return app


def main() -> None:
    import argparse

    import uvicorn

    ap = argparse.ArgumentParser(description="mOSaic mock gateway")
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--speed", type=float, default=4.0, help="event replay speed multiplier")
    args = ap.parse_args()
    uvicorn.run(build_mock_app(args.speed), host="0.0.0.0", port=args.port)


if __name__ == "__main__":
    main()
