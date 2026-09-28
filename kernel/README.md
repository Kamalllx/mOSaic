# kernel/ — P1 Kernel & Execution (`mosaic_kernel`)
Tasks, process table, scheduler (priorities, GPU admission, preemption, cron), lifecycle (retry, escalation, kill, pause/resume, checkpoints, suspend/resume across restarts), quotas, `KernelAgentContext` (the agent ABI), YAML policy engine (hot reload), syscalls, approvals, transactions, event bus (+ Redis mirror), hash-chained audit log, SQLite state, the REST/WS gateway and the `ai-*` CLI.

- Brief: [docs/team/P1-kernel-execution.md](../docs/team/P1-kernel-execution.md) · What it provides, how it's tested, status: [shared/services/P1-kernel-execution.md](../shared/services/P1-kernel-execution.md)
- Test helpers for scripting agents against a real kernel: `mosaic_kernel.testing`.

## Run it for real (P1 components real, other splits on fakes until they land)
```bash
docker build -t mosaic/sandbox-base:latest execution/images/sandbox-base
docker build -t mosaic/sandbox-browser:latest execution/images/sandbox-browser      # optional: browser tool
docker compose -f infra/compose/docker-compose.yml up -d --build redis mock-jira vendor-docs

export MOSAIC_MODE_EVENTS=real MOSAIC_MODE_POLICY=real MOSAIC_MODE_AUDIT=real        MOSAIC_MODE_ARTIFACTS=real MOSAIC_MODE_TOOLS=real MOSAIC_MODE_SANDBOX=real
uv run mosaicd                                   # gateway on :8080, /docs for the API

uv run ai run "Investigate why Project Apollo is over budget, update the tracker"   # prompts for the approval
uv run ai-ps ; uv run ai-tree ; uv run ai-top ; uv run ai-audit <task-id> ; uv run ai-mount /org/projects
```
If another Redis already listens on `localhost:6379` (e.g. inside WSL), it shadows the compose one. Set `MOSAIC_REDIS_URL`, or `MOSAIC_EVENTS_REDIS=off`.

## Tests
```bash
uv run pytest kernel/tests execution/tests tests/integration -rs
```
The live suites (Docker hardening, real browser, HTTP Jira, Redis, the full live system) start their own containers and skip when Docker or the images are missing.
