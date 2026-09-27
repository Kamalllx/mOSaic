# P1: Kernel & Execution

| Tooling | Review buddy | Skills |
|---|---|---|
| Claude Code (Opus 5.5) | P4 (their browser driver plugs into your executor; their infra runs your server) | asyncio, FastAPI, SQLAlchemy, Docker SDK, state machines, security mindset |

> **Coding-agent setup:** create `CLAUDE.local.md` in the repo root containing `@docs/team/P1-kernel-execution.md`. The root `CLAUDE.md` already loads `AGENTS.md` (hard rules). Then prompt: *"Do task T<n> from my brief: tests first, then implement until green."*

---

## 1. Mission
Make the OS metaphor real. Every agent is a process with a PID, a state, a quota and capabilities. Every model call, knowledge read and world action goes through the kernel. World actions are **syscalls**: policy → (human approval) → transactional execution in a sandbox → verify → commit or rollback. Everything is journaled. You also own the **execution layer** (tools, sandboxes, artifacts, mock Jira) and **integration** (`mosaicd`, the e2e test).

## 2. Scope
**You own (edit freely):** `kernel/`, `execution/` (except `mosaic_execution/browser/`, `images/sandbox-browser/`, `tests/test_browser_contract.py`, which are P4's), `mosaicd/`, `policies/`, and you maintain `tests/integration/`.
**Never edit:** other splits' folders; generated files in `shared/`. For contract changes, use a `contract/…` PR (see `shared/README.md`).

## 3. Inputs: what you consume

All of these arrive through `services: ServiceBundle` (`mosaic_contracts.wiring`). Develop against `mosaic_contracts.testing.fakes.fake_bundle()`.

| Interface | Provider | Methods you call | Where you use it |
|---|---|---|---|
| `ModelRouter` | P3 | `generate`, `route`, `list_models` | `ctx.llm()`, `GET /models` |
| `KnowledgeService` | P2 | `read`, `list`, `search`, `traverse`, `ingest`, `reindex`, `validate` (always with the agent's or user's `Principal`) | `ctx.read/list/search`, `/knowledge/*` routes |
| `ContextFirewall` | P2 | `screen(hits)` | inside `ctx.search()`, **if** P2's service doesn't already screen. Check `firewall_flags` and don't double-screen |
| `MemoryService` | P2 | `recall`, `store`, `build_working_set`, `consolidate`, `invalidate`, `rehydrate` | `ctx.recall/remember`, task completion, boot recovery, the `knowledge.changed` handler |
| `AgentRegistry` | P3 | `list`, `get`, `match` | spawn, scheduler, `GET /registry/agents` |
| `AgentRuntime` | P3 | `run(manifest, goal, ctx)`, `restore(...)` | lifecycle |
| `BrowserDriver` | P4 | `open`, `click`, `type`, `screenshot`, `close` | your `browser` tool backend |
| `ResourceProbe` | P4 | `snapshot()` | `GET /system/resources`, `ai-top`, scheduler admission |
| `SourceConverter` list | P4 | none directly (P2 uses them) | |

## 4. Outputs: what you provide (your contract with the team)

### 4.1 In-process interfaces (`mosaic_contracts/interfaces/kernel.py`, `execution.py`)

| Interface | Guarantees |
|---|---|
| `EventBus` | `publish(Event)` never raises because of a subscriber; `subscribe(pattern)` uses fnmatch over `Event.type`; `stream(pattern, task_id)` registers eagerly |
| `PolicyEngine` | `evaluate(SyscallRequest, Principal) -> PolicyDecision`, pure. Rules in §6.9 |
| `AuditLog` | `append` assigns a monotonic `seq` per task; `timeline(task_id) -> RunTimeline` with stats |
| **`AgentContext`** (implemented as `KernelAgentContext`) | See §6.5. Every call is capability-checked, quota-charged, audited and evented. `syscall()` blocks through approval and **returns** DENIED/REJECTED (it doesn't raise) |
| `ToolExecutor` | `list_tools()` includes `jira`, `fs`, `browser` (+ `sandbox`) with the same operation names as `FAKE_TOOL_SPECS`; `execute` never raises for tool errors; `verify`; `rollback` via `rollback_token` |
| `SandboxManager` | `provision/exec/screenshot/destroy/list`; hardened defaults; `endpoints["playwright"]` set when `spec.display=True` |
| `ArtifactStore` | `artifact://<task>/<name>` ↔ `$MOSAIC_DATA_DIR/artifacts/<task>/<name>` |

### 4.2 HTTP + WebSocket gateway (consumed by P2's UI and the CLI)
Contract: `shared/api/openapi.json`, generated from `mosaic_contracts/api/mock_gateway.py`. **Your app must expose the same (method, path) set.** `kernel/tests/test_contract.py::test_gateway_matches_contract` enforces this.

| Area | Routes | Response model |
|---|---|---|
| Tasks | `POST /tasks` (201) · `GET /tasks?status=` · `GET /tasks/{id}` · `POST /tasks/{id}/cancel` · `/resume` · `/checkpoint` · `GET /tasks/{id}/artifacts` | `Task` · `list[Task]` · `list[Checkpoint]` · `list[str]` |
| Processes | `GET /agents?task_id=` · `GET /agents/tree?task_id=` · `GET /agents/{pid}` · `POST /agents/spawn` (201) · `POST /agents/{pid}/pause·resume·kill` · `POST /agents/{pid}/checkpoint` | `AgentProcess` · `list[ProcessTreeNode]` · `Checkpoint` |
| Registry | `GET /registry/agents` · `GET /registry/tools` | `list[AgentManifest]` · `list[ToolSpec]` |
| Knowledge (pass-through to P2 with the **user** principal) | `GET /knowledge/search?q=&scope=&top_k=` · `/knowledge/tree?path=` · `/knowledge/object?path=` · `/knowledge/graph?path=&depth=` · `POST /knowledge/ingest` · `/reindex` · `/validate` · `GET /memory?owner=&task_id=` | `EvidenceSet` · `KnowledgeListing` · `KnowledgeObject` · `GraphResult` · `IngestResult` · `{indexed:int}` · `ValidationReport` · `list[MemoryRecord]` |
| Governance | `GET /approvals?status=` · `POST /approvals/{id}/approve` · `/reject` (body `ApprovalResolution`) · `GET /audit/{task_id}` · `GET /policies` | `list[Approval]` · `Approval` · `RunTimeline` · `list[PolicyDocument]` |
| System | `GET /health` · `/system/status` · `/system/resources` · `/models` · `/sandboxes?task_id=` | `{ok}` · `SystemStatus` · `ResourceSnapshot` · `list[ModelInfo]` · `list[SandboxInfo]` |
| Events | `WS /ws/events?task_id=&types=glob,glob` | one `Event` JSON per message |

**Auth (MVP):** the headers `X-Mosaic-User` and `X-Mosaic-Org` (defaults `alice`/`acme`) build the user `Principal(kind=user, max_privacy=internal, data_scopes=["/org/**"])`. **Errors:** `MosaicError` → `ErrorInfo` JSON with `errors.ERROR_HTTP_STATUS`. Enable CORS for `*` in dev.

### 4.3 Events you publish
`task.*`, `process.*`, `agent.log`, `syscall.*`, `approval.*`, `transaction.*`, `policy.updated`, `audit.appended`, `ipc.message`, `knowledge.retrieved`, `model.invoked`, `sandbox.*`, `tool.*`, `system.*`. **Payloads must match `shared/catalogs/events.yaml`** exactly, because P2's UI reducers depend on them. `examples.events()` shows the expected sequence.

### 4.4 CLI
`ai-ps`, `ai-tree`, `ai-top`, `ai-kill <pid>`, `ai-audit <task>`, `ai-checkpoint <pid>`, `ai-resume <pid>`, `ai-mount [path]`. These are HTTP clients using `MOSAIC_URL`, built with `typer` + `rich` tables. `ai-ps` output format is in blueprint §47.

---

## 5. Internal architecture

```text
Kernel(services, settings)
 ├── store: StateStore (SQLite, $MOSAIC_DATA_DIR/kernel.db)
 ├── bus: EventBus            audit: AuditLog          policy: YamlPolicyEngine
 ├── tasks: TaskManager       procs: ProcessTable      scheduler: Scheduler
 ├── lifecycle: Lifecycle     quotas: QuotaManager     mailboxes: Mailboxes (IPC)
 ├── approvals: ApprovalQueue  transactions: TransactionManager  syscalls: SyscallGateway
 └── make_context(proc, manifest, principal) -> KernelAgentContext
Gateway = FastAPI app holding the Kernel (startup: kernel.boot(); shutdown: kernel.shutdown())
Executor (execution pkg) = ToolExecutor over backends {jira, fs, browser, sandbox, (mcp)}
```

Put a `Kernel` class in `mosaic_kernel/kernel.py`. `factory.build_kernel_app(settings, services)` creates `Kernel(services)` and returns `gateway.create_app(kernel)`.

---

## 6. Implementation spec

### 6.1 Process table (`process/`)
- `ProcessTable.create(task_id, agent, goal, ppid, owner, capabilities, quota, memory_mounts) -> AgentProcess`. PIDs come from a counter starting at 101, persisted and never reused.
- `transition(pid, new_state, *, reason=None, waiting_on=None)`: validate with `can_transition` → `MosaicError("INVALID_STATE_TRANSITION")`; update `updated_at`; persist; publish `process.state_changed {old,new,reason}`; audit `AuditKind.STATE`.
- `tree(task_id) -> list[ProcessTreeNode]`, `children(pid)`, `list(task_id)`.

### 6.2 Tasks (`tasks/`)
- `create(TaskCreate, user: Principal) -> Task`: `task_id=new_id("T")`, status `queued`; persist; publish `task.created {goal,user_id}`; audit `TASK` with `data={"goal": ...}` (the `AuditLog.timeline` goal field relies on this); `scheduler.enqueue`.
- **Status derivation** (recompute on every process transition):
  `cancelled` if cancelled · `completed`/`failed` when the root pid is COMPLETED/FAILED-and-not-retrying · `waiting_approval` if any pid has `waiting_on` starting with `approval:` · `planning` if only the root is running with no children · otherwise `running`. Publish `task.status_changed {old,new}` on change.
- On root completion: build `TaskResult(summary=root.summary, artifacts, evidence, actions=[committed syscall ids], usage=sum over processes)`, publish `task.completed {summary}`, call `memory.consolidate(task_id)` in the background.

### 6.3 Scheduler (`scheduler/`)
- Three `asyncio.PriorityQueue`s (high/normal/background). `MAX_CONCURRENT_TASKS=2`, `MAX_RUNNING_PIDS=8`. Admission also checks `ResourceProbe.snapshot().gpu.memory_used_mb / total < 0.95`.
- The loop dequeues and calls `lifecycle.spawn(SpawnRequest(agent="planner-agent", goal=task.goal, task_id=task.task_id))`.
- `best_agent(goal)` uses `registry.match(goal)[0]`. It's exposed for the planner only if P3 asks (it isn't in the contract today).

### 6.4 Lifecycle (`lifecycle/`)
```text
spawn(req, parent: AgentProcess | None) -> AgentProcess
  manifest = await registry.get(req.agent)                      # AGENT_NOT_FOUND
  if parent: require req.agent in parent_manifest.capabilities.agents else CAPABILITY_DENIED
  caps   = narrow(manifest.all_capabilities(), req.capabilities)  # request may only narrow
  scopes = intersect(mounts_as_globs(manifest.memory.mounts), task.data_scope, policy.knowledge.allow − deny)
  principal = Principal(kind=agent, org_id, user_id=task.user_id, pid, agent=manifest.name,
                        capabilities=caps, data_scopes=scopes, max_privacy=user_max_privacy)
  quota  = ResourceQuota(max_tokens=manifest.resources.max_tokens_per_task, max_tool_calls=manifest.resources.max_tool_calls)
  proc   = procs.create(...); CREATED→INITIALIZING→READY; publish process.spawned {agent, ppid}; audit SPAWN
  ctx    = kernel.make_context(proc, manifest, principal)
  proc → RUNNING; tasks[pid] = asyncio.create_task(_run(proc, manifest, ctx))

_run(proc, manifest, ctx):
  try:    result = await runtime.run(manifest, proc.goal, ctx)
  except CancelledError:            → TERMINATED (also cancel children), result = cancelled
  except MosaicError("QUOTA_EXCEEDED"): → FAILED (no retry)
  except Exception as e:            → FAILED; if attempt_count < 2: → RETRYING → RUNNING, re-run (attempt_count += 1)
  on AgentResult: store it; → COMPLETED (status completed) or FAILED; resolve waiters of ctx.wait(pid)
```
- `mounts_as_globs`: `/org/finance` → `/org/finance/**`. `intersect` keeps a glob when it is covered by some glob in the other set (`util.path_matches(base, other)`), or keeps the narrower one.
- **Capabilities:** a child's capabilities come from **its own manifest ∩ policy**. The parent decides *which* agents it may spawn, not their capabilities. (The planner has no `jira.write`, yet it spawns the action agent, which does.)
- `kill(pid)`: cancel the task plus its children recursively → TERMINATED. `pause(pid)`: clear the context's gate (`asyncio.Event`), then → PAUSED; every `ctx.*` call awaits the gate first. `resume(pid)`: set the gate, then → RUNNING.
- `checkpoint(pid)` (API/CLI) → CHECKPOINTING → snapshot the **latest** state the agent itself saved via `ctx.checkpoint(state)` plus its memory working set → persist `Checkpoint` → RUNNING. The kernel never introspects agent objects. `resume` after restart uses `runtime.restore(manifest, goal, ctx, state)`.

### 6.5 KernelAgentContext (`context/`): the heart
The pattern for every method: `await gate` → `check capability` → `charge quota` → call the service → publish the event → audit.

| Method | Capability | Behaviour |
|---|---|---|
| `llm(req)` | none | set `task_id`, `pid`; if manifest `model_policy == local-only` then force `privacy=restricted`; charge tokens after the call (`resp.usage`); set `proc.model`; publish `model.invoked {model,provider,local,tokens}`; audit MODEL `data={"model":…}` |
| `search(q)` | `knowledge.search` | `knowledge.search(q, principal)` (P2 screens with the firewall; the kernel does not re-screen); publish `knowledge.retrieved {query,hits,filtered_by_policy,paths}`; audit KNOWLEDGE with `refs=paths` |
| `read(path)` / `list(path)` | `knowledge.read` | pass-through with the principal; audit KNOWLEDGE |
| `recall(q)` / `remember(rec)` | none / `memory.write` optional | force `q.org_id` and `rec.org_id` to the principal's org; default `owner` = the agent name |
| `spawn(agent, goal, inputs)` | `agent.spawn` + child listed in the manifest | `lifecycle.spawn(...)`; returns the pid immediately; count toward `max_children` |
| `wait(pid, timeout)` | must be your own child | await the child's result future; parent → WAITING (`waiting_on="pid:<n>"`) while waiting, then → RUNNING |
| `send(msg)` | `agent.message` (implicit for same-task pids) | **overwrite** `sender_pid/sender` with the truth; fill `receiver` from the process table; the receiver must be in the same task; put it in the receiver's `Mailboxes` queue; publish `ipc.message`; audit IPC |
| `receive(timeout)` | none | pop from own mailbox; state → WAITING (`waiting_on="ipc"`) while blocked |
| `syscall(req)` | checked by policy | set `req.task_id/pid` to the truth → `SyscallGateway.handle(req, principal)` (§6.8) |
| `put_artifact` / `get_artifact` | none | ArtifactStore under this task only (reject refs of other tasks) |
| `log(msg, level, data)` | none | publish `agent.log {level,message,data}` |
| `checkpoint(state)` | none | persist `Checkpoint(agent_state=state)`; publish `process.checkpointed`; return the id |
| `cancelled()` | none | True when a kill/cancel was requested |
| attributes | `task_id, pid, ppid, principal, manifest, inputs` | `inputs` = `SpawnRequest.inputs` |

### 6.6 Quotas (`quota/`)
Per pid: tokens (prompt+completion), tool calls (syscalls), children, wall clock (checked on each call). Exceeding any limit raises `QUOTA_EXCEEDED`. Update `proc.usage` and publish `process.usage` at most once per second per pid.

### 6.7 Events & audit (`events/`, `audit/`)
- EventBus: productionise the in-memory fake (bounded queues, drop the oldest on overflow for slow WS clients). Stretch: mirror to Redis Streams `mosaic:events` for replay.
- Subscriptions you own: `knowledge.changed` → `memory.invalidate(path)` → for every `affected_agents` pid in a running task, send an `agent.log` warning (and an ipc `cancel`/refresh message in the stretch version).
- AuditLog: a SQLite table `audit(task_id, seq, entry_id, ts, pid, actor, kind, summary, data json, refs json, prev_hash, hash)`. Actor format: `user:alice`, `agent:finance-agent#102`, `kernel.policy`. Stretch: hash = sha256(prev_hash + canonical json).

### 6.8 Syscall path (`syscalls/`, `approvals/`, `transactions/`)
```text
handle(req, principal):
  publish syscall.requested; audit SYSCALL
  spec = tool operation lookup (list_tools cache) → unknown → DENIED(reason "unknown tool/operation")
  req.capability must equal spec.capability → else DENIED
  req.risk = max(req.risk, spec.risk)
  decision = await policy.evaluate(req, principal); publish syscall.decided; audit POLICY data={"decision":…,"policy":…}
  DENY               → SyscallResult(DENIED)
  REQUIRES_APPROVAL  → approval = Approval(approval_id=decision.approval_id, ..., status=pending)
                       store; publish approval.requested {approval_id, capability}; pid → WAITING(waiting_on="approval:<id>")
                       outcome = await approvals.wait(id, timeout=600)   # asyncio.Future resolved by the API
                       pid → RUNNING; rejected/expired → SyscallResult(REJECTED); audit APPROVAL
  ALLOW / approved   → charge tool_call quota; return await transactions.run(req, decision)

transactions.run(req, decision):
  inv = ToolInvocation(invocation_id=new_id("INV"), syscall_id, task_id, pid, tool, operation, arguments,
                       arguments_ref, constraints=decision.constraints)
  idempotency: same idempotency_key already committed → return the stored result
  publish tool.started; result = await tools.execute(inv); publish tool.completed; audit TOOL
  error   → SyscallResult(FAILED, error=result.error)
  verify  = await tools.verify(inv, result); audit VERIFY
  passed  → publish transaction.committed {verified:true}; audit COMMIT; SyscallResult(COMPLETED, verified=True)
  failed  → ok = await tools.rollback(inv, result); publish transaction.rolled_back; audit ROLLBACK; SyscallResult(ROLLED_BACK)
  publish syscall.completed {status}
```
The approval API: `approve(id, by, comment)` resolves the future with approved and publishes `approval.resolved {approval_id,status,resolved_by}`. A second resolve raises `APPROVAL_ALREADY_RESOLVED`.

### 6.9 Policy engine (`policy/`)
Load `policies/*.yaml` → `PolicyDocument`s. Pick the documents whose `applies_to.agents` matches the agent name (fnmatch) and sort them by `priority` (lower = more specific).
```text
evaluate(req, principal):
  if not has_capability(req.capability, principal.capabilities): DENY "capability not granted"
  for doc in matching_docs:
     if any capability_matches(req.capability, g) for g in doc.tools.deny:  DENY
     mode = approval mode for req.capability in doc.approval (exact key, then glob keys) or None
     if listed in doc.tools.allow (glob) or mode is not None:
        if mode == never: DENY
        if mode == required or req.risk in (high, critical): REQUIRES_APPROVAL(approval_id=new_id("APR"))
        return ALLOW, constraints={"network_allow": doc.network.allow}
  DENY "no policy allows <capability>"
```
Also expose `knowledge_scopes(agent) -> (allow, deny)` for lifecycle. `PolicyEngineContract` must pass with the repo's `policies/`.

### 6.10 Persistence & recovery (`persistence/`)
SQLite (stdlib `sqlite3`, WAL mode, one lock; not bound to an event loop) at `$MOSAIC_DATA_DIR/kernel.db`, with tables: `tasks`, `processes`, `approvals`, `checkpoints`, `audit`, `counters`. Store Pydantic models as JSON columns plus indexed ids.
**Boot:** mount the data dir → load state → pids that were RUNNING/WAITING become RETRYING and are restored from their last checkpoint (`runtime.restore`) or marked FAILED with `last_error="restart"` → pending approvals are re-armed → publish `system.ready {components}` (from `bundle.modes` + health checks).

### 6.11 Gateway (`gateway/`)
`create_app(kernel) -> FastAPI`. Reuse the models from `mosaic_contracts.schema` as `response_model`s. Handle `MosaicError` globally. The WS handler does `async for ev in bus.stream(pattern="*", task_id=...)` and filters `types` with fnmatch. Knowledge routes call P2 with the **user** principal from the headers. `/system/status` → `SystemStatus(components=[ComponentHealth(component, ok, mode=bundle.modes[...])])`.

### 6.12 Execution layer (`execution/`)
- **FsArtifactStore:** root `data_dir/artifacts`; `put` writes the file plus `<name>.meta.json` (content type); reject names containing `..` or starting with `/`; `list` is sorted.
- **Workspace fs tool:** root `data_dir/workspaces/<task_id>/` (the sandbox mounts this at `/workspace`). Operations `read_file`, `write_file` (rollback token → previous content saved under `data_dir/rollback/<token>`). Resolve the path and require `is_relative_to(root)`.
- **Mock Jira** (`connectors/jira_mock.py`): a FastAPI app on `:8090` seeded with APOLLO-12 and APOLLO-31 (same as `FakeToolExecutor.issues`). Endpoints: `GET /rest/api/2/issue/{key}`, `PUT /rest/api/2/issue/{key}` `{fields}`, `POST /rest/api/2/issue/{key}/comment` `{body}`, `GET /rest/api/2/search?jql=project=APOLLO`. `mosaic-mock-jira` runs it. The **jira backend** uses httpx against `settings.jira_url`. `update_issue` reads the old state first → `rollback_token`; `verify` re-reads and compares fields; `rollback` PUTs the old fields and deletes the added comment.
- **Executor** (`tools/`): `ToolExecutor(backends)`, where each backend has `spec() -> ToolSpec`, `execute`, `verify`, `rollback`. Dispatch on `invocation.tool`. Enforce `constraints["network_allow"]` for agent-chosen destinations (browser URLs, sandbox egress). Operator-configured connectors like `jira_url` are trusted and `timeout_s` via `asyncio.wait_for` (→ `TIMEOUT` result). Tool operation names must stay compatible with `FAKE_TOOL_SPECS`.
- **Browser backend:** lazily `sandbox.provision(SandboxSpec(task_id, pid, display=True, network=allowlist, network_allow=constraints))` per `(task_id)`. Call `services.browser.open(sandbox_info, url)`, take a screenshot → `artifacts.put(task, f"screenshot-{n}.png")` → publish `sandbox.screenshot`. Output = `BrowserPage` dict + screenshot ref. Destroy the sandbox on `task.completed`/`task.failed`.
- **DockerSandboxManager** (docker SDK via `asyncio.to_thread`): `containers.run(image, detach=True, user="10001", read_only=True, tmpfs={"/tmp": ""}, mem_limit=f"{mb}m", nano_cpus=int(cpu*1e9), cap_drop=["ALL"], security_opt=["no-new-privileges"], network_mode="none" | "mosaic_sandbox", volumes={workspace: {"bind": "/workspace", "mode": "rw"}}, labels={"mosaic.task": task_id, "mosaic.sandbox": id})`. The GPU goes through `device_requests` when `spec.gpu`. Display sandboxes use `mosaic/sandbox-browser:latest`: `endpoints["playwright"] = f"ws://{container_ip}:3000/"` (on Windows/macOS dev hosts, publish port 3000 to a random host port and use `127.0.0.1`). `exec` uses `exec_run` with a timeout; `destroy` does `remove(force=True)`. On startup, remove stale containers labelled `mosaic.sandbox`. Publish `sandbox.started/destroyed`.
- **MCP adapter** *(stretch)*: MCP client over stdio/http → `ToolSpec(transport=mcp)`, with the capability `mcp.call` or a per-tool mapping.

---

## 7. Ordered task list (each is one PR)

| # | Task | Acceptance criteria |
|---|---|---|
| T1 | `events/` EventBus + `audit/` SQLite AuditLog + `factory.build_event_bus/build_audit_log` | `EventBusContract`, `AuditLogContract` green |
| T2 | `policy/` YamlPolicyEngine + `factory.build_policy_engine` | `PolicyEngineContract` green; unit tests for deny-wins, approval modes, network constraints |
| T3 | `process/` ProcessTable + `persistence/` StateStore | invalid transitions raise; tree correct; survives reopen of the DB |
| T4 | `context/` KernelAgentContext + `lifecycle/` spawn/run/kill/wait + `tasks/` + `scheduler/` (all on `fake_bundle()`) | a task with `FakeAgentRuntime` spawns planner + children and completes; kill cancels the tree |
| T5 | `syscalls/` + `approvals/` + `transactions/` on `FakeToolExecutor` | approve → COMPLETED; reject → REJECTED; forced verify failure → ROLLED_BACK; events in the right order |
| T6 | `gateway/` + `factory.build_kernel_app` | `test_gateway_matches_contract` green; **`tests/integration/test_e2e_apollo.py` green with all fakes** ← **M1 gate** |
| T7 | `cli/` ai-ps, ai-tree, ai-audit, ai-kill | work against both the mock gateway and your gateway |
| T8 | `execution/` FsArtifactStore + fs tool + mock Jira service + jira backend + executor | `ArtifactStoreContract`, `ToolExecutorContract` green (against the mock-jira server started in the test fixture) |
| T9 | `execution/` DockerSandboxManager + `images/sandbox-base` | `SandboxManagerContract` green on a Docker host |
| T10 | quotas + usage events + `/system/resources` via ResourceProbe | QUOTA_EXCEEDED triggers; `ai-top` shows live usage |
| T11 | integrate P3 (`MOSAIC_MODE_AGENTS=real`) | e2e green with real agents on fake models, then real models |
| T12 | browser backend wired to P4's BrowserDriver | research agent's `browser.open` produces a screenshot artifact + event |
| T13 | boot recovery + checkpoints | kill `mosaicd` mid-run → restart → task resumes or fails cleanly; `ai-checkpoint/resume` work |
| T14 | full real e2e on the RTX box (`MOSAIC_DEFAULT_MODE=real`) | e2e green 3× in a row ← **M3 gate** |
| S1–S4 | stretch: Redis Streams, audit hash chain, MCP adapter, scheduler preemption | |

## 8. Tests
- Contract suites (already wired): `kernel/tests/test_contract.py`, `execution/tests/test_contract.py`. They start running the moment your factory stops raising `NotImplementedError`.
- Write unit tests for lifecycle (retry, kill tree, pause gate), syscall flows (the approve/reject/rollback matrix), the status derivation table, and the policy rules.
- The integration gate is `tests/integration/test_e2e_apollo.py`, which you own. Keep it the definition of "the demo works".

## 9. Integration duties
- Coordinate the daily integration standup and flip components to `real` in the order from MASTER_PLAN §6.
- Review all `contract/…` PRs; keep `mosaicd/wiring.py` `REGISTRY` current.
- Review buddy for **P4**: review their browser driver and probe, and help out if the browser work slips (it plugs into your executor).
- Keep `shared/services/P1-kernel-execution.md` status current.

## 10. Definition of done
All P1 contract suites run and are green · gateway conformance green · e2e green with all-fake (M1) and all-real on the RTX box (M3) · `ai-ps`/`ai-tree`/`ai-audit` usable live in the demo · no imports of other splits' packages · status table updated.

## 11. Pitfalls
- **Don't hold locks across `await runtime.run()`.** Agents call back into the context concurrently.
- `asyncio.create_task` references must be stored, or tasks get garbage-collected. Always await or cancel children on kill.
- An approval wait must not block the event loop or other pids. Use Futures, never polling.
- Emit events **after** persisting state, so the UI never sees a state it can't fetch.
- SQLite concurrency: use one writer connection (or `aiosqlite` with WAL mode).
- The Docker SDK is synchronous; wrap it with `asyncio.to_thread`. On Windows dev hosts, container IPs aren't routable, so publish ports.
- Payload keys in events are consumed by P2's UI. Keep them exactly as in `events.yaml`.
