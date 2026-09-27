"""Composition root: the ONLY place that knows which implementation backs each interface.

For every component, MOSAIC_MODE_<COMPONENT>=fake|real (or MOSAIC_DEFAULT_MODE) picks
    fake -> mosaic_contracts.testing.fakes
    real -> <package>.factory.build_<thing>(settings, services)

Integration = flipping one component at a time from fake to real and running tests/integration.
Nobody edits another person's package to integrate; if wiring needs a change, it happens here.
"""
from __future__ import annotations

import importlib
import logging
from collections.abc import Callable
from typing import Any

from mosaic_contracts.testing import fakes
from mosaic_contracts.wiring import ServiceBundle, Settings

log = logging.getLogger("mosaicd.wiring")

# component -> (bundle attribute(s), fake builder, "module:function" of the real factory)
REGISTRY: list[tuple[str, str, Callable[[Settings, ServiceBundle], Any], str]] = [
    ("events",    "event_bus",      lambda s, b: fakes.InMemoryEventBus(),                         "mosaic_kernel.factory:build_event_bus"),
    ("artifacts", "artifacts",      lambda s, b: fakes.InMemoryArtifactStore(),                    "mosaic_execution.factory:build_artifact_store"),
    ("models",    "models",         lambda s, b: fakes.FakeModelRouter(),                          "mosaic_models.factory:build_model_router"),
    ("firewall",  "firewall",       lambda s, b: fakes.FakeContextFirewall(),                      "mosaic_knowledge.factory:build_context_firewall"),
    ("converters", "converters",  lambda s, b: [fakes.FakeMarkdownConverter()],                  "mosaic_knowledge.ingestion.factory:build_converters"),
    ("knowledge", "knowledge",      lambda s, b: fakes.FakeKnowledgeService(s.okf_dir, b.models, b.firewall, b.event_bus),
                                                                                                    "mosaic_knowledge.factory:build_knowledge_service"),
    ("memory",    "memory",         lambda s, b: fakes.FakeMemoryService(b.event_bus),             "mosaic_knowledge.factory:build_memory_service"),
    ("sandbox",   "sandbox",        lambda s, b: fakes.FakeSandboxManager(),                       "mosaic_execution.factory:build_sandbox_manager"),
    ("browser",   "browser",        lambda s, b: fakes.FakeBrowserDriver(),                        "mosaic_execution.browser.factory:build_browser_driver"),
    ("tools",     "tools",          lambda s, b: fakes.FakeToolExecutor(),                         "mosaic_execution.factory:build_tool_executor"),
    ("agents",    "agent_registry", lambda s, b: fakes.FakeAgentRegistry(directory=s.manifests_dir if s.manifests_dir.exists() else None),
                                                                                                    "mosaic_agents.factory:build_agent_registry"),
    ("agents",    "agent_runtime",  lambda s, b: fakes.FakeAgentRuntime(),                         "mosaic_agents.factory:build_agent_runtime"),
    ("probe",     "probe",          lambda s, b: fakes.FakeResourceProbe(),                        "mosaic_models.gpu.factory:build_resource_probe"),
    ("policy",    "policy",         lambda s, b: fakes.FakePolicyEngine(),                         "mosaic_kernel.factory:build_policy_engine"),
    ("audit",     "audit",          lambda s, b: fakes.InMemoryAuditLog(),                         "mosaic_kernel.factory:build_audit_log"),
]


def _load(target: str) -> Callable[[Settings, ServiceBundle], Any]:
    module, func = target.split(":")
    return getattr(importlib.import_module(module), func)


def build_services(settings: Settings | None = None) -> ServiceBundle:
    settings = settings or Settings.from_env()
    bundle = ServiceBundle(settings=settings)
    for component, attr, fake, real in REGISTRY:
        mode = settings.modes.get(component, "fake")
        if mode == "real":
            try:
                svc = _load(real)(settings, bundle)
            except NotImplementedError as e:
                log.warning("%s: real implementation not ready (%s) — falling back to fake", component, e)
                svc, mode = fake(settings, bundle), "fake(fallback)"
        else:
            svc = fake(settings, bundle)
        setattr(bundle, attr, svc)
        bundle.modes[attr] = mode
    return bundle


def build_app(bundle: ServiceBundle):
    """The gateway app: the real kernel if implemented, otherwise the mock gateway from the contracts."""
    try:
        return _load("mosaic_kernel.factory:build_kernel_app")(bundle.settings, bundle)
    except (NotImplementedError, ImportError) as e:
        log.warning("kernel not ready (%s) — serving the contract mock gateway", e)
        from mosaic_contracts.api.mock_gateway import build_mock_app

        return build_mock_app()
