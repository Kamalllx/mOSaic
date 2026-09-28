"""Unit tests for the execution layer: jails, allowlists, rollback, container hardening, browser backend."""
import asyncio
from pathlib import Path

import pytest
from mosaic_contracts.errors import MosaicError
from mosaic_contracts.schema import (
    NetworkMode,
    SandboxSpec,
    ToolInvocation,
    ToolResultStatus,
)
from mosaic_contracts.schema.common import new_id
from mosaic_contracts.testing.fakes import FakeBrowserDriver, FakeSandboxManager, InMemoryArtifactStore, InMemoryEventBus
from mosaic_contracts.wiring import ServiceBundle, Settings
from mosaic_execution.artifacts.store import FsArtifactStore
from mosaic_execution.connectors.jira import JiraBackend
from mosaic_execution.files.workspace import FsBackend
from mosaic_execution.sandbox.docker_manager import DockerSandboxManager
from mosaic_execution.tools.base import network_allowed
from mosaic_execution.tools.executor import Executor
from mosaic_execution.tools.sandboxed import BrowserBackend, SandboxPool


def inv(tool: str, op: str, task_id: str = "T-1", constraints=None, timeout_s: int = 120, **args) -> ToolInvocation:
    return ToolInvocation(invocation_id=new_id("INV"), syscall_id=new_id("SC"), task_id=task_id, pid=105, tool=tool,
                          operation=op, arguments=args, constraints=constraints or {}, timeout_s=timeout_s)


def test_artifact_names_cannot_escape(tmp_path):
    store = FsArtifactStore(tmp_path)
    for bad in ("../x", "/etc/passwd", "a/../../b", ".meta/x"):
        with pytest.raises(MosaicError):
            asyncio.run(store.put("T-1", bad, b"x"))
    ref = asyncio.run(store.put("T-1", "screenshots/001.png", b"png", "image/png"))
    assert asyncio.run(store.list("T-1")) == [ref] and store.content_type(ref) == "image/png"


def test_fs_jail_write_verify_rollback(tmp_path):
    fs = FsBackend(tmp_path)

    async def go():
        escape = await fs.execute(inv("fs", "write_file", path="../../evil.txt", content="x"))
        first = inv("fs", "write_file", path="reports/r.md", content="v1")
        r1 = await fs.execute(first)
        second = inv("fs", "write_file", path="/workspace/reports/r.md", content="v2")
        r2 = await fs.execute(second)
        verified = await fs.verify(second, r2)
        undone = await fs.rollback(second, r2)
        read = await fs.execute(inv("fs", "read_file", path="reports/r.md"))
        return escape, r1, verified, undone, read

    escape, r1, verified, undone, read = asyncio.run(go())
    assert escape.status == ToolResultStatus.ERROR and escape.error.code == "CAPABILITY_DENIED"
    assert r1.status == ToolResultStatus.SUCCESS and verified.passed and undone
    assert read.output["content"] == "v1", "rollback restored the previous version"


def test_jira_comment_update_and_rollback():
    jira = JiraBackend("inprocess")

    async def go():
        up = inv("jira", "update_issue", key="APOLLO-12", fields={"status": "At Risk"}, comment="root causes: …")
        res = await jira.execute(up)
        ver = await jira.verify(up, res)
        rolled = await jira.rollback(up, res)
        after = await jira.execute(inv("jira", "get_issue", key="APOLLO-12"))
        search = await jira.execute(inv("jira", "search_issues", project="APOLLO"))
        return res, ver, rolled, after, search

    res, ver, rolled, after, search = asyncio.run(go())
    assert res.output["status"] == "At Risk" and "root causes: …" in res.output["comments"]
    assert ver.passed and {c.name for c in ver.checks} >= {"field:status", "comment"}
    assert rolled and after.output["status"] == "In Progress" and after.output["comments"] == []
    assert {i["key"] for i in search.output["issues"]} == {"APOLLO-12", "APOLLO-31"}


@pytest.mark.parametrize("url,allow,ok", [
    ("http://vendor-docs/sdk-v5.html", ["vendor-docs:80"], True),
    ("https://docs.vendor.example/x", ["*.vendor.example:443"], True),
    ("https://evil.example/x", ["vendor-docs:80"], False),
    ("http://vendor-docs:8080/", ["vendor-docs:80"], False),
    ("http://anything/", None, True),       # no constraint from policy (e.g. fake policy)
    ("http://anything/", [], False),        # constraint present but empty => nothing allowed
])
def test_network_allowlist(url, allow, ok):
    assert network_allowed(url, {} if allow is None else {"network_allow": allow}) is ok


def test_executor_timeout_and_unknown_tool():
    class Slow:
        name = "slow"

        def spec(self):
            from mosaic_contracts.testing.fakes import FAKE_TOOL_SPECS

            return FAKE_TOOL_SPECS[0]

        async def execute(self, i):
            await asyncio.sleep(5)

    ex = Executor([Slow()])
    r = asyncio.run(ex.execute(inv("slow", "x", timeout_s=0)))
    assert r.status == ToolResultStatus.ERROR and r.error.code == "TIMEOUT"
    assert asyncio.run(ex.execute(inv("nope", "x"))).error.code == "NOT_FOUND"


def test_browser_backend_enforces_allowlist_and_saves_screenshot():
    bus, sandbox, browser, artifacts = InMemoryEventBus(), FakeSandboxManager(), FakeBrowserDriver(), InMemoryArtifactStore()
    services = ServiceBundle(settings=Settings(), event_bus=bus, sandbox=sandbox, browser=browser, artifacts=artifacts)
    pool = SandboxPool(services)
    backend = BrowserBackend(services, pool)
    allow = {"network_allow": ["vendor-docs:80"]}

    async def go():
        blocked = await backend.execute(inv("browser", "open", constraints=allow, url="https://evil.example/"))
        opened = await backend.execute(inv("browser", "open", constraints=allow, url="http://vendor-docs/sdk-v5.html"))
        await pool.release_task("T-1")
        return blocked, opened

    blocked, opened = asyncio.run(go())
    assert blocked.error.code == "POLICY_DENIED"
    assert opened.status == ToolResultStatus.SUCCESS and opened.output["title"].startswith("Fake page")
    assert opened.artifacts == ["artifact://T-1/screenshots/001.png"]
    assert [e.type for e in bus.history] == ["sandbox.started", "sandbox.screenshot", "sandbox.destroyed"]
    assert sandbox.sandboxes and all(s.status.value == "destroyed" for s in sandbox.sandboxes.values())


def test_docker_run_kwargs_are_hardened(tmp_path):
    mgr = DockerSandboxManager(tmp_path, client=object(), endpoint_mode="ip")
    kw = mgr.run_kwargs("SB-1", SandboxSpec(task_id="T-1", network=NetworkMode.NONE, memory_mb=512, cpu=0.5), tmp_path)
    assert kw["read_only"] and kw["cap_drop"] == ["ALL"] and kw["user"] == "10001"
    assert kw["network_mode"] == "none" and "no-new-privileges" in kw["security_opt"]
    assert kw["mem_limit"] == "512m" and kw["nano_cpus"] == 500_000_000 and kw["pids_limit"] == 256
    assert list(kw["volumes"].values()) == [{"bind": "/workspace", "mode": "rw"}]

    browser = mgr.run_kwargs("SB-2", SandboxSpec(task_id="T-1", display=True, network=NetworkMode.ALLOWLIST), tmp_path)
    assert browser["image"].startswith("mosaic/sandbox-browser") and browser["network"] == "mosaic_sandbox"
    assert "ports" not in browser

    dev = DockerSandboxManager(tmp_path, client=object(), endpoint_mode="port")
    browser_dev = dev.run_kwargs("SB-3", SandboxSpec(task_id="T-1", display=True), tmp_path)
    assert browser_dev["ports"] == {"3000/tcp": ("127.0.0.1", None)}


def test_docker_manager_lifecycle_with_fake_client(tmp_path):
    class Container:
        def __init__(self, kw):
            self.kw, self.removed, self.labels = kw, False, kw["labels"]
            self.attrs = {"NetworkSettings": {"Networks": {}, "Ports": {}}}
            self.name = kw["name"]

        def reload(self):
            pass

        def exec_run(self, cmd, workdir, demux):
            class R:
                exit_code, output = 0, (b"hi\n", b"")

            return R()

        def remove(self, force):
            self.removed = True

    class Client:
        def __init__(self):
            self.containers = self
            self.started: list[Container] = []

        def list(self, all, filters):
            return []

        def run(self, **kw):
            self.started.append(Container(kw))
            return self.started[-1]

    client = Client()
    mgr = DockerSandboxManager(Path(tmp_path), client=client, endpoint_mode="ip")

    async def go():
        info = await mgr.provision(SandboxSpec(task_id="T-9"))
        from mosaic_contracts.schema import ExecRequest

        res = await mgr.exec(info.sandbox_id, ExecRequest(command=["echo", "hi"]))
        await mgr.destroy(info.sandbox_id)
        return info, res, await mgr.list("T-9")

    info, res, listed = asyncio.run(go())
    assert res.stdout == "hi\n" and client.started[0].removed
    assert listed[0].status.value == "destroyed" and (tmp_path / "T-9").is_dir()
