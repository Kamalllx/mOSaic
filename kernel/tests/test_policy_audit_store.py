"""Policy rules, audit hash chain, boot recovery, gateway WebSocket replay."""
import asyncio
import json

from mosaic_contracts.schema import (
    AgentProcess,
    AgentState,
    Approval,
    ApprovalStatus,
    AuditEntry,
    AuditKind,
    Decision,
    PolicyDecision,
    PrincipalKind,
    Risk,
    SyscallRequest,
    Task,
    TaskStatus,
)
from mosaic_contracts.testing.fakes import user_principal
from mosaic_contracts.wiring import REPO_ROOT
from mosaic_kernel.audit.log import SqliteAuditLog
from mosaic_kernel.persistence.store import StateStore
from mosaic_kernel.policy.engine import YamlPolicyEngine
from mosaic_kernel.testing import done, manifest, run, start_task


def _agent(name, caps):
    return user_principal().model_copy(update={"kind": PrincipalKind.AGENT, "pid": 105, "agent": name, "capabilities": caps})


def _req(cap, tool, op, risk=Risk.LOW):
    return SyscallRequest(syscall_id="SC-1", task_id="T-1", pid=105, capability=cap, tool=tool, operation=op, risk=risk)


def test_repo_policies():
    engine = YamlPolicyEngine(REPO_ROOT / "policies")
    ev = lambda cap, agent, risk=Risk.LOW: asyncio.run(engine.evaluate(_req(cap, cap.split(".")[0], "x", risk),  # noqa: E731
                                                                       _agent(agent, [cap])))
    d = ev("jira.write", "action-agent", Risk.MEDIUM)
    assert d.decision == Decision.REQUIRES_APPROVAL and d.policy == "project-updates-v1"
    assert "mock-jira:8090" in d.constraints["network_allow"]
    assert ev("fs.write", "action-agent").decision == Decision.ALLOW
    assert ev("browser.open", "research-agent").constraints["network_allow"] == ["vendor-docs:80"]
    assert ev("jira.read", "engineering-agent").decision == Decision.ALLOW          # default-v1
    assert ev("database.write", "engineering-agent").decision == Decision.REQUIRES_APPROVAL
    assert ev("sandbox.exec", "engineering-agent").decision == Decision.DENY        # nobody allows it
    assert ev("jira.read", "action-agent", Risk.HIGH).decision == Decision.REQUIRES_APPROVAL
    assert engine.knowledge_allow(_agent("finance-agent", [])) == ["/org/finance/**", "/org/projects/**", "/org/decisions/**"]


def test_deny_wins_and_never(tmp_path):
    (tmp_path / "p.yaml").write_text(
        "policy: strict\npriority: 1\napplies_to: {agents: ['*']}\n"
        "tools: {allow: ['jira.*'], deny: ['jira.delete']}\napproval: {jira.purge: never}\n")
    engine = YamlPolicyEngine(tmp_path)
    caps = ["jira.*"]
    assert asyncio.run(engine.evaluate(_req("jira.delete", "jira", "d"), _agent("a", caps))).decision == Decision.DENY
    assert asyncio.run(engine.evaluate(_req("jira.purge", "jira", "p"), _agent("a", caps))).decision == Decision.DENY
    assert asyncio.run(engine.evaluate(_req("jira.read", "jira", "r"), _agent("a", caps))).decision == Decision.ALLOW


def test_audit_hash_chain(tmp_path):
    log = SqliteAuditLog(tmp_path / "audit.db")
    for i in range(3):
        asyncio.run(log.append(AuditEntry(entry_id=f"A{i}", task_id="T-1", actor="kernel", kind=AuditKind.TASK,
                                          summary=f"e{i}")))
    assert log.verify_chain("T-1")
    log.db.execute("UPDATE audit SET data=replace(data, 'e1', 'tampered') WHERE seq=2")
    assert not log.verify_chain("T-1")


def test_boot_recovery_fails_interrupted_work(make_kernel, tmp_path):
    store = StateStore(tmp_path / "kernel.db")
    store.put_task(Task(task_id="T-old", org_id="acme", user_id="alice", goal="g", status=TaskStatus.RUNNING, root_pid=101))
    store.put_task(Task(task_id="T-queued", org_id="acme", user_id="alice", goal="g", status=TaskStatus.QUEUED,
                        metadata={"root_agent": "planner-agent"}))
    store.put_process(AgentProcess(pid=101, task_id="T-old", owner="alice", agent="planner-agent", state=AgentState.WAITING))
    req = _req("jira.write", "jira", "update_issue")
    store.put_approval(Approval(approval_id="APR-1", task_id="T-old", pid=101, agent="planner-agent", syscall=req,
                                decision=PolicyDecision(decision=Decision.REQUIRES_APPROVAL, policy="p", reason="r")))

    async def planner(goal, ctx):
        return done(ctx)

    k = make_kernel({"planner-agent": planner}, [manifest("planner-agent")])

    async def go():
        await k.boot()
        queued = await k.tasks.wait_terminal("T-queued")
        await k.shutdown()
        return queued

    queued = run(go)
    assert k.tasks.get("T-old").status == TaskStatus.FAILED
    assert k.procs.get(101).state == AgentState.TERMINATED
    assert k.approvals.get("APR-1").status == ApprovalStatus.EXPIRED
    assert queued.status == TaskStatus.COMPLETED, "queued tasks survive a restart"
    assert k.procs.get(queued.root_pid).pid > 101, "PIDs are never reused"


def test_websocket_replays_history_for_late_subscribers(make_kernel):
    from fastapi.testclient import TestClient
    from mosaic_kernel.gateway.app import create_app

    async def planner(goal, ctx):
        await ctx.log("hello")
        return done(ctx, "finished")

    k = make_kernel({"planner-agent": planner}, [manifest("planner-agent")])
    with TestClient(create_app(k)) as client:
        task = client.post("/tasks", json={"goal": "g", "metadata": {"root_agent": "planner-agent"}}).json()
        asyncio.run(asyncio.sleep(0.3))  # let it finish before we subscribe
        seen = []
        with client.websocket_connect(f"/ws/events?task_id={task['task_id']}&types=task.*,agent.log") as ws:
            while True:
                ev = json.loads(ws.receive_text())
                seen.append(ev["type"])
                if ev["type"] == "task.completed":
                    break
        assert seen[0] == "task.created" and "agent.log" in seen and "process.spawned" not in seen
        assert client.get(f"/tasks/{task['task_id']}").json()["result"]["summary"] == "finished"
        assert client.get("/tasks/T-nope").status_code == 404
        assert client.get("/system/status").json()["ready"] is True


def test_start_task_helper_uses_root_agent(make_kernel):
    async def planner(goal, ctx):
        return done(ctx, goal)

    k = make_kernel({"planner-agent": planner}, [manifest("planner-agent")])

    async def go():
        await k.boot()
        t = await k.tasks.wait_terminal(await start_task(k, goal="hello"))
        await k.shutdown()
        return t

    assert run(go).result.summary == "hello"
