"""Production-like browser check on the RTX node (P4). Linux host only: it connects to the container IP.

Starts mosaic/sandbox-browser on the internal mosaic_sandbox network with P1's sandbox flags, drives it with the
real PlaywrightDriver, opens the offline vendor site and saves a screenshot. Proves: host -> internal network
reachability, vendor-docs DNS from inside the sandbox, run-server under read-only/uid 10001, screenshots.

    docker compose -f infra/compose/docker-compose.yml up -d vendor-docs
    uv run python scripts/browser_smoke.py            # -> .data/smoke/vendor.png
"""
from __future__ import annotations

import asyncio
import json
import subprocess
import sys
from pathlib import Path

from mosaic_contracts.schema import SandboxInfo, SandboxSpec, SandboxStatus
from mosaic_execution.browser.driver import PlaywrightDriver

ROOT = Path(__file__).resolve().parents[1]
NAME = "mosaic-browser-smoke"
NETWORK = "mosaic_sandbox"
URL = "http://vendor-docs/sdk-v5.html"
EXPECT = "2026-10-20"
FLAGS = ["--read-only", "--tmpfs", "/tmp", "--user", "10001", "--cap-drop", "ALL",
         "--security-opt", "no-new-privileges", "--init", "--network", NETWORK]


def docker(*args: str) -> str:
    return subprocess.run(["docker", *args], check=True, capture_output=True, text=True).stdout.strip()


async def drive(ip: str) -> bytes:
    sb = SandboxInfo(sandbox_id="SB-smoke", status=SandboxStatus.RUNNING, spec=SandboxSpec(task_id="T-smoke", display=True),
                     endpoints={"playwright": f"ws://{ip}:3000/"})
    drv = PlaywrightDriver()
    try:
        page = await drv.open(sb, URL)
        print(f"title: {page.title!r}\nlinks: {page.links}")
        if EXPECT not in page.text:
            raise SystemExit(f"FAIL: {EXPECT} not on the page:\n{page.text[:500]}")
        return await drv.screenshot(sb)
    finally:
        await drv.close(sb)


def main() -> None:
    if sys.platform != "linux":
        raise SystemExit("run this on the Linux node: container IPs are not routable from Docker Desktop hosts")
    subprocess.run(["docker", "rm", "-f", NAME], capture_output=True)
    docker("run", "-d", "--rm", "--name", NAME, *FLAGS, "mosaic/sandbox-browser:latest")
    try:
        nets = json.loads(docker("inspect", "-f", "{{json .NetworkSettings.Networks}}", NAME))
        ip = nets[NETWORK]["IPAddress"]
        png = asyncio.run(drive(ip))
        out = ROOT / ".data" / "smoke" / "vendor.png"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(png)
        print(f"OK: screenshot {out} ({len(png)} bytes)")
    finally:
        subprocess.run(["docker", "rm", "-f", NAME], capture_output=True)


if __name__ == "__main__":
    main()
