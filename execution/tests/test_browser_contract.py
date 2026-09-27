"""Contract test for P4's BrowserDriver. Needs Docker + the mosaic/sandbox-browser image. SKIPs until implemented.

It starts the browser container directly (no dependency on P1's SandboxManager), so P4 can test alone:
    docker build -t mosaic/sandbox-browser:latest execution/images/sandbox-browser
"""
import shutil
import subprocess
import time

import pytest
from mosaic_contracts.schema import SandboxInfo, SandboxSpec, SandboxStatus
from mosaic_contracts.testing import contracts as c
from mosaic_contracts.wiring import ServiceBundle, Settings
from mosaic_execution.browser import factory

pytestmark = pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed")


@pytest.fixture(scope="module")
def driver():
    s = Settings()
    try:
        return factory.build_browser_driver(s, ServiceBundle(settings=s))
    except NotImplementedError as e:
        pytest.skip(f"not implemented yet: {e}")


@pytest.fixture(scope="module")
def browser_sandbox(driver):
    name = "mosaic-browser-contract-test"
    if subprocess.run(["docker", "image", "inspect", "mosaic/sandbox-browser:latest"], capture_output=True).returncode != 0:
        pytest.skip("image mosaic/sandbox-browser:latest not built")
    started = subprocess.run(["docker", "run", "-d", "--rm", "--name", name, "-p", "3999:3000",
                              "mosaic/sandbox-browser:latest"], capture_output=True, text=True)
    if started.returncode != 0:
        pytest.skip(f"cannot start mosaic/sandbox-browser: {started.stderr.strip()[:200]}")
    time.sleep(3)
    yield SandboxInfo(sandbox_id="SB-test", status=SandboxStatus.RUNNING, spec=SandboxSpec(task_id="T-test", display=True),
                      endpoints={"playwright": "ws://127.0.0.1:3999/"})
    subprocess.run(["docker", "rm", "-f", name], capture_output=True)


class TestBrowser(c.BrowserDriverContract):
    @pytest.fixture(autouse=True)
    def _setup(self, driver, browser_sandbox):
        self.driver, self.sandbox = driver, browser_sandbox

    def make(self):
        return self.driver, self.sandbox, "https://example.com"
