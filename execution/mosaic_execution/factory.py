"""Factory contract for P1 (execution side) (see mosaic_contracts.wiring)."""
from mosaic_contracts.interfaces import ArtifactStore, SandboxManager, ToolExecutor
from mosaic_contracts.wiring import ServiceBundle, Settings


def build_artifact_store(settings: Settings, services: ServiceBundle) -> ArtifactStore:
    raise NotImplementedError("P1: artifacts.FsArtifactStore(settings.data_dir / 'artifacts')")


def build_sandbox_manager(settings: Settings, services: ServiceBundle) -> SandboxManager:
    raise NotImplementedError("P1: sandbox.DockerSandboxManager(event_bus=services.event_bus)")


def build_tool_executor(settings: Settings, services: ServiceBundle) -> ToolExecutor:
    raise NotImplementedError("P1: tools.Executor(sandbox=services.sandbox, artifacts=services.artifacts)")
