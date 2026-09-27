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
- `WS /ws/events?task_id=…` first **replays the task's history** (durable across restarts when Redis is up), then streams live events. Filter with `types=task.*,process.*`.
- `network_allow` in `PolicyDecision.constraints` restricts **agent-chosen destinations** (browser URLs, sandbox egress). Operator-configured connectors (`MOSAIC_JIRA_URL`, MCP servers) are trusted endpoints. If the key is absent, there is no constraint; if it is present but empty, nothing is allowed.
- The kernel does **not** re-screen search results: `KnowledgeService.search` (P2) screens with the firewall. The kernel logs an `agent.log` warning for flagged hits.
- **Approvals come in two kinds.** Privileged syscalls use the capability of the tool operation. **Escalations** (`capability: agent.retry`, `policy: kernel.escalation`) mean an agent exhausted its retries and a human decides whether to try once more. Both appear in `GET /approvals` and in `approval.requested` events, and the payload includes `tool`, `operation`, `risk` and `policy`.
- **Restart semantics:** stopping `mosaicd` suspends running tasks. On the next boot they resume from the root agent's last `ctx.checkpoint()` (up to `MOSAIC_KERNEL_MAX_RESTARTS`), queued tasks re-queue, and pending approvals expire (the resumed run asks again). Agents that call `ctx.checkpoint(state)` receive it back through `AgentRuntime.restore`.
- **Preemption:** a `high` task arriving when every slot is busy pauses a running `background` task (its processes show `PAUSED`), which resumes afterwards.
- `MOSAIC_JIRA_URL=inprocess` runs mock Jira inside `mosaicd` (no Docker needed). Otherwise use `uv run mosaic-mock-jira` or the compose service.
- MCP servers listed in `$MOSAIC_MCP_CONFIG` (see `execution/mcp.example.yaml`) become tools. Every operation requires the configured capability (default `mcp.call`), so policies must allow it.
- Test helpers for scripting agents against a real kernel: `mosaic_kernel.testing` (`kernel_factory`, `ScriptedRuntime`, `start_task`).
- Kernel knobs (`MOSAIC_KERNEL_*`) are listed in `.env.example` and `mosaic_kernel/config.py`.
- Scheduled agents: `MOSAIC_KERNEL_SCHEDULES_FILE` (see `kernel/schedules.example.yaml`). Each firing publishes `cron.triggered` and creates a normal task owned by user `scheduler`, and a job never overlaps itself.

**Totals at hand-off:** P1 suites 97 passed, 1 skipped (waiting on P4's BrowserDriver). Whole repo 171 passed, 34 skipped (all other splits' pending work).

## How it is tested
| Suite | What it proves | Needs |
|---|---|---|
| `kernel/tests/*` | lifecycle, syscalls, policy, audit chain, scheduler/preemption, cron, restart/resume, escalation, hot reload, isolation, idempotency, stress (20 tasks / 80 agents), every gateway route, the CLI | nothing |
| `kernel/tests/test_redis_live.py` | event mirror + history replay across a kernel restart | Docker (starts `redis:7-alpine`) |
| `execution/tests/test_contract.py`, `test_execution_units.py`, `test_mcp.py` | artifact/tool/sandbox contracts, jails, allowlists, rollback, hardening kwargs, MCP against a real MCP server | nothing (sandbox suite needs Docker) |
| `execution/tests/test_docker_live.py` | inside a real container: uid 10001, read-only rootfs, CapEff=0, NoNewPrivs, no network, limits, timeout reaper | Docker + `mosaic/sandbox-base` |
| `execution/tests/test_jira_http_live.py` | tool contract over real HTTP (starts its own container) | Docker + `mosaic/mock-jira` |
| `execution/tests/test_browser_live.py` | real browser sandbox + Playwright: page, allowlist, screenshot, cleanup | Docker + `mosaic/sandbox-browser` |
| `tests/integration/test_e2e_apollo.py` | the demo run through the gateway | nothing |
| `tests/integration/test_live_system.py` | the demo run with **every P1 component real** on real Redis + mock-Jira containers | Docker + `mosaic/mock-jira` |

## Status (owner keeps this current)
| Item | Status |
|---|---|
| EventBus (+ Redis Stream mirror) · AuditLog (SQLite, hash chain) · PolicyEngine (YAML, hot reload) | ✅ |
| Process table · lifecycle (retry, escalation, kill tree, pause/resume) · tasks · scheduler (priorities, GPU admission, preemption) | ✅ |
| KernelAgentContext + IPC mailboxes | ✅ |
| Syscalls · approvals · transactions (verify → commit / rollback) · idempotency | ✅ |
| Gateway (route conformance, WS history replay) · CLI (`ai-*`, `ai run`) | ✅ |
| Artifacts · fs (jailed, reversible) · mock Jira + jira tool · executor · MCP adapter | ✅ |
| Docker sandbox manager (hardening verified inside live containers) | ✅ |
| Browser backend (live-tested with a reference Playwright client) | ✅ waiting on P4's production BrowserDriver |
| Quotas · suspend/resume across restarts · checkpoints | ✅ |
| e2e: all-fake ✅ · every P1 component real on real containers ✅ | ✅ |
| Scheduled agents (cron, `MOSAIC_KERNEL_SCHEDULES_FILE`) | ✅ |
| Stretch not done: OpenShell/microVM sandbox backend | ☐ |
