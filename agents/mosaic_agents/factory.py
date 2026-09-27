"""Factory contract for P3 — agents (see mosaic_contracts.wiring)."""
from mosaic_contracts.interfaces import AgentRegistry, AgentRuntime
from mosaic_contracts.wiring import ServiceBundle, Settings


def build_agent_registry(settings: Settings, services: ServiceBundle) -> AgentRegistry:
    raise NotImplementedError("P3: registry.ManifestRegistry(settings.manifests_dir)")


def build_agent_runtime(settings: Settings, services: ServiceBundle) -> AgentRuntime:
    raise NotImplementedError("P3: runtime.Runtime()")
