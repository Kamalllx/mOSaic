"""Factory contract for P1 — kernel side (see mosaic_contracts.wiring). mosaicd calls these when MOSAIC_MODE_<X>=real."""
from mosaic_contracts.interfaces import AuditLog, EventBus, PolicyEngine
from mosaic_contracts.wiring import ServiceBundle, Settings


def build_event_bus(settings: Settings, services: ServiceBundle) -> EventBus:
    from .events.bus import KernelEventBus

    return KernelEventBus()


def build_policy_engine(settings: Settings, services: ServiceBundle) -> PolicyEngine:
    from .policy.engine import YamlPolicyEngine

    return YamlPolicyEngine(settings.policies_dir, event_bus=services.event_bus)


def build_audit_log(settings: Settings, services: ServiceBundle) -> AuditLog:
    from .audit.log import SqliteAuditLog

    return SqliteAuditLog(settings.data_dir / "audit.db")


def build_kernel_app(settings: Settings, services: ServiceBundle):
    """The FastAPI gateway with the kernel running on top of `services` (any mix of fake and real)."""
    from .gateway.app import create_app
    from .kernel import Kernel

    return create_app(Kernel(settings, services))
