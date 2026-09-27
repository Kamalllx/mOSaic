"""Factory contract for P2 (see mosaic_contracts.wiring)."""

from mosaic_contracts.interfaces import ContextFirewall, KnowledgeService, MemoryService
from mosaic_contracts.wiring import ServiceBundle, Settings

from .firewall import ContextFirewall as ContextFirewallImpl
from .indexing import PgStore
from .kfs import KnowledgeFS
from .memory import MemoryManager


def build_context_firewall(settings: Settings, services: ServiceBundle) -> ContextFirewall:
    return ContextFirewallImpl(models=services.models)


def build_knowledge_service(settings: Settings, services: ServiceBundle) -> KnowledgeService:
    """Uses services.models (embeddings), services.firewall, services.event_bus."""
    store = PgStore(settings.database_url)
    return KnowledgeFS(settings.okf_dir, store, services.models, services.firewall, services.event_bus, services.converters)


def build_memory_service(settings: Settings, services: ServiceBundle) -> MemoryService:
    store = PgStore(settings.database_url)
    return MemoryManager(store, services.models, services.event_bus)
