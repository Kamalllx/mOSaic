"""Factory contract for P2 (see mosaic_contracts.wiring)."""
from mosaic_contracts.interfaces import ContextFirewall, KnowledgeService, MemoryService
from mosaic_contracts.wiring import ServiceBundle, Settings


def build_context_firewall(settings: Settings, services: ServiceBundle) -> ContextFirewall:
    raise NotImplementedError("P2: firewall.ContextFirewall(models=services.models)")


def build_knowledge_service(settings: Settings, services: ServiceBundle) -> KnowledgeService:
    """Uses services.models (embeddings), services.firewall, services.event_bus."""
    raise NotImplementedError("P2: kfs.KnowledgeFS(settings.okf_dir, settings.database_url, ...)")


def build_memory_service(settings: Settings, services: ServiceBundle) -> MemoryService:
    raise NotImplementedError("P2: memory.MemoryManager(settings.database_url, services.models, services.event_bus)")
