"""Platform shims. Owner: P2 — Knowledge, Memory & Console."""

from __future__ import annotations

import asyncio
import sys


def ensure_selector_loop_on_windows() -> None:
    """psycopg's async mode can't run on Windows' default ProactorEventLoop. Call this in a process
    entry point, before any event loop starts. It's a no-op on other platforms and when already set."""
    if sys.platform == "win32" and not isinstance(asyncio.get_event_loop_policy(), asyncio.WindowsSelectorEventLoopPolicy):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


def running_on_proactor_loop() -> bool:
    if sys.platform != "win32":
        return False
    try:
        return isinstance(asyncio.get_running_loop(), asyncio.ProactorEventLoop)
    except RuntimeError:
        return False
