"""Factory contract for P1 (see mosaic_contracts.wiring). mosaicd calls these when MOSAIC_MODE_<X>=real."""
from mosaic_contracts.interfaces import AuditLog, EventBus, PolicyEngine
from mosaic_contracts.wiring import ServiceBundle, Settings


def build_event_bus(settings: Settings, services: ServiceBundle) -> EventBus:
    raise NotImplementedError("P1: events.EventBus")


def build_policy_engine(settings: Settings, services: ServiceBundle) -> PolicyEngine:
    raise NotImplementedError("P1: policy.YamlPolicyEngine(settings.policies_dir)")


def build_audit_log(settings: Settings, services: ServiceBundle) -> AuditLog:
    raise NotImplementedError("P1: audit.SqlAuditLog(settings.data_dir)")


def build_kernel_app(settings: Settings, services: ServiceBundle):
    """Return the FastAPI gateway app with the kernel running on top of `services`."""
    raise NotImplementedError("P1: gateway.create_app(Kernel(services))")
