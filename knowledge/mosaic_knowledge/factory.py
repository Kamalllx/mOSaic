"""Factory contract for P2 (see mosaic_contracts.wiring)."""

from mosaic_contracts.interfaces import ContextFirewall, KnowledgeService, MemoryService
from mosaic_contracts.wiring import ServiceBundle, Settings

from .coherence import Coherence
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
    """Also starts coherence (knowledge.changed → invalidate + reindex) when an event bus is present;
    memory is built after knowledge, so services.knowledge is available here."""
    store = PgStore(settings.database_url)
    memory = MemoryManager(store, services.models, services.event_bus)
    if services.event_bus is not None:
        Coherence(services.event_bus, services.knowledge, memory).start()
    return memory
