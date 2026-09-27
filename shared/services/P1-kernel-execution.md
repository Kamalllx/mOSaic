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

**Behaviour notes for consumers**
- `WS /ws/events?task_id=…` first **replays the task's history**, then streams live events, so a UI that connects late still sees the whole run. Filter with `types=task.*,process.*`.
- `network_allow` in `PolicyDecision.constraints` restricts **agent-chosen destinations** (browser URLs, sandbox egress). Operator-configured connectors (`MOSAIC_JIRA_URL`) are trusted endpoints. If the key is absent, there is no constraint; if it is present but empty, nothing is allowed.
- The kernel does **not** re-screen search results: `KnowledgeService.search` (P2) screens with the firewall. The kernel logs an `agent.log` warning for flagged hits.
- `MOSAIC_JIRA_URL=inprocess` runs mock Jira inside `mosaicd` (no Docker needed). Otherwise use `uv run mosaic-mock-jira` or the compose service.
- Test helpers for scripting agents against a real kernel: `mosaic_kernel.testing` (`kernel_factory`, `ScriptedRuntime`, `start_task`).

## Status (owner keeps this current)
| Item | Status |
|---|---|
| EventBus · AuditLog (SQLite, hash chain) · PolicyEngine (YAML) | ✅ |
| Process table · lifecycle (retry, kill tree, pause/resume) · tasks · scheduler | ✅ |
| KernelAgentContext + IPC mailboxes | ✅ |
| Syscalls · approvals · transactions (verify → commit / rollback) | ✅ |
| Gateway (route conformance ✅, WS history replay) · CLI (`ai-*`, `ai run`) | ✅ |
| Artifacts · fs (jailed, reversible) · mock Jira + jira tool · executor | ✅ |
| Docker sandbox manager (hardened; unit-tested with a fake client) | ✅ live test pending a Docker host |
| Browser backend (uses P4's BrowserDriver; allowlist + screenshots) | ✅ waiting on P4's real driver |
| Quotas · boot recovery (clean fail + re-queue) · checkpoints | ✅ (checkpoint-resume after restart: open) |
| e2e all-fake (M1) / all P1 components real | ✅ / ✅ |
| Open: fallback agent/escalation, policy file watcher, MCP adapter, Redis Streams, preemption | ☐ |
