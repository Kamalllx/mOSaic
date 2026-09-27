# kernel/ — P1 Kernel & Execution (`mosaic_kernel`)
Tasks, process table, scheduler, lifecycle, quotas, `KernelAgentContext` (the agent ABI), policy engine, syscalls, approvals, transactions, event bus, audit log, persistence and recovery, the REST/WS gateway, and the `ai-*` CLI.

- **Brief (load it into your coding agent):** [docs/team/P1-kernel-execution.md](../docs/team/P1-kernel-execution.md)
- What you provide: [shared/services/P1-kernel-execution.md](../shared/services/P1-kernel-execution.md) · Folder guide: [docs/FOLDER_STRUCTURE.md](../docs/FOLDER_STRUCTURE.md)
- Build on `mosaic_contracts.testing.fakes.fake_bundle()`. Entry point: `mosaic_kernel/factory.py`. TODOs live in each sub-package's `__init__.py`.

```bash
uv run pytest kernel/tests tests/integration -rs
uv run mosaicd                      # serves the contract mock until build_kernel_app() exists
```
