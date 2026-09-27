# P2 Knowledge, Memory & Console: what this split provides
Full brief: [docs/team/P2-knowledge-console.md](../../docs/team/P2-knowledge-console.md) · Packages: `knowledge/` (`mosaic_knowledge`, minus `ingestion/`), `apps/web/`, `agents/mosaic_agents/adapters/` (stretch)

| Provides | Kind | Consumers | Fake until ready | Contract |
|---|---|---|---|---|
| `KnowledgeService` (`/org` filesystem, hybrid search, graph, ingest pipeline) | interface | P1 (for agents + gateway) | `FakeKnowledgeService` | `KnowledgeServiceContract` |
| `ContextFirewall` | interface | KnowledgeFS, P1 context | `FakeContextFirewall` | `ContextFirewallContract` |
| `MemoryService` | interface | P1 context/lifecycle | `FakeMemoryService` | `MemoryServiceContract` |
| Web console | UI over the gateway | humans / demo | mock gateway | — |
| NOOA adapter (stretch) | runtime adapter | P3 runtime | falls back to custom | — |

**Access rule:** every read filters by `principal.data_scopes` (`util.path_allowed`) and `principal.max_privacy` (`util.privacy_allows`). **Events published:** `knowledge.changed`, `knowledge.reindexed`, `memory.invalidated`, `memory.consolidated`.
**Consumes:** `ModelRouter.embed/embedding_dim/generate` (P3), `EventBus` (P1), `services.converters` (P4), and the gateway (P1) for the UI. Owns the `postgres` schema.

## Status (owner keeps this current)
| Item | Status |
|---|---|
| OKF I/O + validation | ☐ |
| Postgres schema + indexing | ☐ |
| Hybrid retrieval + graph + scope filter | ☐ |
| Context firewall | ☐ |
| Memory manager + coherence | ☐ |
| Ingest pipeline (uses P4 converters) | ☐ |
| UI: composer · timeline · tree · approvals | ☐ |
| UI: audit · explorer · monitor · result | ☐ |
| Retrieval QA ≥ 9/10 on data/okf | ☐ |
