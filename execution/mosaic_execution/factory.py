"""Factory contract for P1 (execution side) (see mosaic_contracts.wiring)."""
from mosaic_contracts.interfaces import ArtifactStore, SandboxManager, ToolExecutor
from mosaic_contracts.wiring import ServiceBundle, Settings


def build_artifact_store(settings: Settings, services: ServiceBundle) -> ArtifactStore:
    from .artifacts.store import FsArtifactStore

    return FsArtifactStore(settings.data_dir / "artifacts")


def build_sandbox_manager(settings: Settings, services: ServiceBundle) -> SandboxManager:
    from .sandbox.docker_manager import DockerSandboxManager

    return DockerSandboxManager(settings.data_dir / "workspaces")


def build_tool_executor(settings: Settings, services: ServiceBundle) -> ToolExecutor:
    """jira (settings.jira_url; "inprocess" runs the mock in-process), fs, db (settings.demo_data_url), browser (P4
    driver), sandbox exec,
    plus every MCP server listed in $MOSAIC_MCP_CONFIG."""
    from .connectors.db import DbBackend
    from .connectors.jira import JiraBackend
    from .files.workspace import FsBackend
    from .mcp.backend import McpBackend, load_mcp_config
    from .mcp.browser import McpBrowserBackend
    from .tools.executor import Executor
    from .tools.sandboxed import BrowserBackend, SandboxExecBackend, SandboxPool

    pool = SandboxPool(services)
    mcp = load_mcp_config()  # MOSAIC_MCP_CONFIG
    # A server marked `browser: true` (the Playwright MCP server in its sandbox image) serves the browser tool instead
    # of the Playwright driver; off by default (see execution/mcp.browser.example.yaml).
    mcp_browser = next((c for c in mcp if c.browser), None)
    browser = McpBrowserBackend(mcp_browser, services) if mcp_browser else BrowserBackend(services, pool)
    backends = [JiraBackend(settings.jira_url), FsBackend(settings.data_dir / "workspaces"), DbBackend(settings.demo_data_url),
                browser, SandboxExecBackend(services, pool), *(McpBackend(cfg) for cfg in mcp if not cfg.browser)]
    return Executor(backends, event_bus=services.event_bus, on_task_end=pool.release_task)
