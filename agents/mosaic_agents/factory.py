"""Factory contract for P3 — agents (see mosaic_contracts.wiring).

Owner: P3 — Agents & Models
"""
from __future__ import annotations

import logging

from mosaic_contracts.interfaces import AgentRegistry, AgentRuntime
from mosaic_contracts.wiring import ServiceBundle, Settings

log = logging.getLogger("mosaic.agents.factory")


def build_agent_registry(settings: Settings, services: ServiceBundle) -> AgentRegistry:
    """Build the real ManifestRegistry from settings.manifests_dir."""
    from mosaic_agents.registry import ManifestRegistry

    manifests_dir = settings.manifests_dir
    log.info("building agent registry: manifests_dir=%s", manifests_dir)
    return ManifestRegistry(manifests_dir)


def build_agent_runtime(settings: Settings, services: ServiceBundle) -> AgentRuntime:
    """Build the real Runtime."""
    from mosaic_agents.runtime import Runtime

    log.info("building agent runtime")
    return Runtime()
