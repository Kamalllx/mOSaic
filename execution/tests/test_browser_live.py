"""LIVE end-to-end browser path (P1 side): DockerSandboxManager starts mosaic/sandbox-browser, a reference Playwright
client connects to SandboxInfo.endpoints["playwright"], and BrowserBackend opens a real page, enforces the network
allowlist, stores the screenshot as an artifact and cleans the sandbox up.

P4's production BrowserDriver replaces `ReferenceDriver` below; this test proves the P1 half works for real.
Needs Docker + `docker build -t mosaic/sandbox-browser:latest execution/images/sandbox-browser`.
"""
import asyncio
import http.server
import socket
import threading

import pytest
from mosaic_contracts.schema import BrowserPage, SandboxInfo, ToolInvocation, ToolResultStatus
from mosaic_contracts.schema.common import new_id
from mosaic_contracts.testing.fakes import InMemoryEventBus
from mosaic_contracts.wiring import ServiceBundle, Settings
from mosaic_execution.artifacts.store import FsArtifactStore
from mosaic_execution.sandbox.docker_manager import DockerSandboxManager
from mosaic_execution.tools.sandboxed import BrowserBackend, SandboxPool

PAGE = b"""<!doctype html><html><head><title>PayCo SDK v5: release status</title></head>
<body><h1>SDK v5</h1><p>General availability moved to 2026-10-20.</p><a href="/guide.html">guide</a></body></html>"""


class ReferenceDriver:
    """Minimal Playwright client (the shape of P4's driver) used only to exercise the P1 path."""

    def __init__(self) -> None:
        self._pw, self._pages = None, {}

    async def _page(self, sb: SandboxInfo):
        if sb.sandbox_id not in self._pages:
            from playwright.async_api import async_playwright

            self._pw = self._pw or await async_playwright().start()
            browser = await self._pw.chromium.connect(sb.endpoints["playwright"], timeout=20000)
            self._pages[sb.sandbox_id] = (browser, await (await browser.new_context()).new_page())
        return self._pages[sb.sandbox_id][1]

    async def open(self, sb, url):
        page = await self._page(sb)
        await page.goto(url, timeout=15000)
        return BrowserPage(url=page.url, title=await page.title(), text=(await page.inner_text("body"))[:20000])

    async def click(self, sb, selector):
        raise NotImplementedError

    async def type(self, sb, selector, text):
        raise NotImplementedError

    async def screenshot(self, sb) -> bytes:
        return await (await self._page(sb)).screenshot(type="png")

    async def close(self, sb):
        entry = self._pages.pop(sb.sandbox_id, None)
        if entry:
            await entry[0].close()
        if not self._pages and self._pw:
            await self._pw.stop()
            self._pw = None


@pytest.fixture(scope="module")
def site():
    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(PAGE)

        def log_message(self, *a):
            pass

    with socket.socket() as s:
        s.bind(("0.0.0.0", 0))
        port = s.getsockname()[1]
    server = http.server.ThreadingHTTPServer(("0.0.0.0", port), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield port
    server.shutdown()


def _client():
    try:
        import docker

        c = docker.from_env()
        c.ping()
        c.images.get("mosaic/sandbox-browser:latest")
        return c
    except Exception as e:
        pytest.skip(f"browser sandbox unavailable: {str(e)[:120]}")


def test_browser_open_in_real_sandbox(site, tmp_path):
    client = _client()
    mgr = DockerSandboxManager(tmp_path / "ws", client=client)
    if mgr.endpoint_mode != "port":
        pytest.skip("host-served page test assumes Docker Desktop port mode")
    bus, artifacts = InMemoryEventBus(), FsArtifactStore(tmp_path / "artifacts")
    services = ServiceBundle(settings=Settings(), event_bus=bus, sandbox=mgr, browser=ReferenceDriver(), artifacts=artifacts)
    pool = SandboxPool(services)
    backend = BrowserBackend(services, pool)
    host = "host.docker.internal"
    allow = {"network_allow": [f"{host}:{site}"]}

    def inv(url: str) -> ToolInvocation:
        return ToolInvocation(invocation_id=new_id("INV"), syscall_id=new_id("SC"), task_id="T-browse", pid=104,
                              tool="browser", operation="open", arguments={"url": url}, constraints=allow)

    async def go():
        denied = await backend.execute(inv("https://example.com/"))
        opened = await backend.execute(inv(f"http://{host}:{site}/sdk-v5.html"))
        png = await artifacts.get(opened.artifacts[0]) if opened.artifacts else b""
        sandbox_ids = [s.sandbox_id for s in await mgr.list("T-browse")]
        await pool.release_task("T-browse")
        return denied, opened, png, sandbox_ids

    denied, opened, png, sandbox_ids = asyncio.run(go())
    assert denied.status == ToolResultStatus.ERROR and denied.error.code == "POLICY_DENIED"
    assert opened.status == ToolResultStatus.SUCCESS, opened.error
    assert opened.output["title"] == "PayCo SDK v5: release status"
    assert "2026-10-20" in opened.output["text"]
    assert png.startswith(b"\x89PNG") and len(png) > 1000
    assert [e.type for e in bus.history] == ["sandbox.started", "sandbox.screenshot", "sandbox.destroyed"]
    assert not client.containers.list(all=True, filters={"label": f"mosaic.sandbox={sandbox_ids[0]}"})
