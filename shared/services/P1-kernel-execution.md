# P1 Kernel & Execution: what this split provides
Full brief: [docs/team/P1-kernel-execution.md](../../docs/team/P1-kernel-execution.md) · Packages: `kernel/` (`mosaic_kernel`), `execution/` (`mosaic_execution`, minus `browser/`), `mosaicd/`, `policies/`

| Provides | Kind | Consumers | Fake until ready | Contract |
|---|---|---|---|---|
| `AgentContext` (KernelAgentContext) | in-process ABI | P3 agents | `FakeAgentContext` | via `AgentRuntimeContract` |
| `EventBus` | interface | everyone | `InMemoryEventBus` | `EventBusContract` |
| `PolicyEngine` | interface | kernel, UI via `/policies` | `FakePolicyEngine` | `PolicyEngineContract` |
| `AuditLog` | interface | UI via `/audit/{task}` | `InMemoryAuditLog` | `AuditLogContract` |
| `ToolExecutor` (jira, fs, browser, sandbox) | interface | kernel transactions | `FakeToolExecutor` | `ToolExecutorContract` |
| `SandboxManager` | interface | executor, `/sandboxes` | `FakeSandboxManager` | `SandboxManagerContract` |
| `ArtifactStore` | interface | ctx, `/tasks/{id}/artifacts` | `InMemoryArtifactStore` | `ArtifactStoreContract` |
| Gateway REST + WS | HTTP (`shared/api/openapi.json`) | P2 UI, CLI, mobile | `mosaic-mock-gateway` | route conformance |
| `ai-*` CLI | commands | humans / demo | — | — |
| mock Jira `:8090` | service | executor | `FakeToolExecutor.issues` | via `ToolExecutorContract` |

**Events published:** `task.*`, `process.*`, `agent.log`, `syscall.*`, `approval.*`, `transaction.*`, `policy.updated`, `audit.appended`, `ipc.message`, `knowledge.retrieved`, `model.invoked`, `sandbox.*`, `tool.*`, `system.*` (payloads: `shared/catalogs/events.yaml`).

## Status (owner keeps this current)
| Item | Status |
|---|---|
| EventBus · AuditLog · PolicyEngine | ☐ |
| Process table · lifecycle · tasks · scheduler | ☐ |
| KernelAgentContext + IPC | ☐ |
| Syscalls · approvals · transactions | ☐ |
| Gateway (conformance) · CLI | ☐ |
| Artifacts · fs · mock Jira · executor | ☐ |
| Docker sandbox manager | ☐ |
| Quotas · recovery · checkpoints | ☐ |
| e2e all-fake (M1) / all-real (M3) | ☐ / ☐ |
