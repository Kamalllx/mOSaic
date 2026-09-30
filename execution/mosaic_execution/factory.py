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
    """jira (settings.jira_url; "inprocess" runs the mock in-process), fs, browser (P4 driver), sandbox exec, github and
    calendar (built-in mocks until an org connects them: the gateway calls configure(token)), plus every MCP server
    listed in $MOSAIC_MCP_CONFIG."""
    from .connectors.calendar import CalendarBackend
    from .connectors.github import GitHubBackend
    from .connectors.jira import JiraBackend
    from .files.workspace import FsBackend
    from .mcp.backend import McpBackend, load_mcp_config
    from .tools.executor import Executor
    from .tools.sandboxed import BrowserBackend, SandboxExecBackend, SandboxPool

    pool = SandboxPool(services)
    backends = [JiraBackend(settings.jira_url), FsBackend(settings.data_dir / "workspaces"),
                BrowserBackend(services, pool), SandboxExecBackend(services, pool), GitHubBackend(), CalendarBackend(),
                *(McpBackend(cfg) for cfg in load_mcp_config())]  # MOSAIC_MCP_CONFIG
    return Executor(backends, event_bus=services.event_bus, on_task_end=pool.release_task)
