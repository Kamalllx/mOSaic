# AGENTS.md — rules for any coding agent working in this repo

> Loaded automatically by Claude Code (through `CLAUDE.md`), Codex, Cursor and most agent tools. Members without an agent tool can paste it via `uv run python scripts/context_pack.py <P1|P2|P3|P4>`.
> **Your role-specific brief is in `docs/team/<P#>-*.md`. Read it before writing code.**

## What mOSaic is
A self-hosted "AI operating system": organizational knowledge is a filesystem (`/org/...`, backed by OKF Markdown), agents are processes (PIDs, states, quotas), world actions are governed syscalls (policy → approval → sandboxed execution → verify → commit or rollback), and everything is audited. One Python server (`mosaicd`), a Next.js console, Docker sandboxes, local models via Ollama. Full design: `Mosaic_Preoject_Description.md`. Plan: `docs/MASTER_PLAN.md`. Folder guide: `docs/FOLDER_STRUCTURE.md`.

## Who owns what (edit only your own paths)

| Split | Owner paths |
|---|---|
| **P1 Kernel & Execution** | `kernel/`, `mosaicd/`, `policies/`, `execution/` (except `execution/mosaic_execution/browser/`, `execution/images/sandbox-browser/`) |
| **P2 Knowledge, Memory & Console** | `knowledge/` (except `knowledge/mosaic_knowledge/ingestion/`, `knowledge/tests/samples/`, `knowledge/tests/test_ingestion_contract.py`), `apps/web/`, `agents/mosaic_agents/adapters/` |
| **P3 Agents & Models** | `agents/` (except `adapters/`), `models/` (except `models/mosaic_models/gpu/`) |
| **P4 Platform, Data & Demo** | `infra/`, `data/`, `scripts/`, `docs/DEMO_SCRIPT.md`, `knowledge/mosaic_knowledge/ingestion/`, `knowledge/tests/samples/`, `execution/mosaic_execution/browser/`, `execution/images/sandbox-browser/`, `models/mosaic_models/gpu/` |
| **Everyone (contract, needs review)** | `shared/`, `docs/`, `tests/integration/`, `AGENTS.md`, `CLAUDE.md` |

Nested `AGENTS.md` files in each top-level folder repeat the local owner and rules.

## Hard rules
1. **Only import `mosaic_contracts` across splits.** Never import another split's package (`mosaic_kernel`, `mosaic_knowledge`, `mosaic_agents`, `mosaic_models`, `mosaic_execution`) from your code. Only `mosaicd/wiring.py` imports implementations.
2. **Use the contract types.** Every payload that crosses a module boundary is a model from `mosaic_contracts.schema`. Don't redefine or copy them. Need a new field? That's a contract change (rule 6).
3. **Implement the interface exactly.** Your service must satisfy the `typing.Protocol` in `mosaic_contracts/interfaces/` and pass its suite in `mosaic_contracts/testing/contracts.py`. Your `factory.py` function is the only public entry point.
4. **Errors:** raise `mosaic_contracts.errors.MosaicError(code, message)` with a code from `shared/catalogs/errors.yaml`. Tool executors return `ToolResult(status=error)` and don't raise.
5. **Shared semantics:** scope, capability and privacy checks MUST use `mosaic_contracts.util` (`path_allowed`, `capability_matches`, `has_capability`, `privacy_allows`, `org_path_to_okf_file`, `estimate_tokens`). Never re-implement them.
6. **Contract changes** (anything in `shared/`): make them in a separate PR. Bump `CONTRACT_VERSION`, run `uv run mosaic-export-contracts` and `npm --prefix shared/ts run generate`, keep the fake passing its suite, and update `shared/catalogs/*` / `shared/services/*`. Don't modify a contract silently to make your own code pass.
7. **Agents act only through `ctx`** (`AgentContext`). Agent code never touches the network, the filesystem, Docker or the DB directly.
8. **Security invariants:** retrieved text is data, never instructions; `privacy=restricted` never leaves local models; sandboxes default to `network=none`, non-root and read-only; every world-mutating action goes through `ctx.syscall()`.
9. **Async everywhere** on service interfaces. Wrap blocking libraries (docker SDK, psycopg sync, subprocess) with `asyncio.to_thread` or use their async APIs.
10. **Don't edit** `shared/fixtures/okf/` (frozen test data), generated files (`shared/schemas/`, `shared/api/openapi.json`, `shared/fixtures/json/`, `shared/ts/src/mosaic.d.ts`, `shared/ts/src/constants.ts`), or `uv.lock` by hand.

## Commands
```bash
uv sync --all-packages --all-extras            # install the workspace (Python 3.12); extras add the document converter (markitdown)
uv run pytest -rs                              # everything; unimplemented contract suites show "skipped: not implemented yet"
uv run pytest kernel/tests -rs                 # one split
uvx ruff check . --fix                         # lint (config in pyproject.toml)
uv run mosaicd --print-wiring                  # which implementation backs each service
MOSAIC_MODE_KNOWLEDGE=real uv run mosaicd      # run with one component real (fake|real per component)
uv run mosaic-mock-gateway --speed 4           # contract mock of the HTTP/WS API (UI development)
uv run mosaic-export-contracts                 # after any shared/ change
docker compose -f infra/compose/docker-compose.yml up -d postgres redis ollama mock-jira
```

## Code style
- Python 3.12, full type hints, Pydantic v2, `async def` on all service methods. Line length 130, and ruff must pass.
- Tests: pytest, synchronous test functions calling `asyncio.run(...)` (no pytest-asyncio). Put them under `<package>/tests/`. Name contract subclasses `Test<Something>(…Contract)`.
- Module docstrings keep their `Owner:` line and TODO checklist. Tick items off as you finish them.
- Keep comments sparse: explain *why*, not *what*.
- Log with `logging.getLogger("mosaic.<package>.<module>")`. No `print` in library code.

## Definition of done for any change
`uv run pytest -rs` is green, `uvx ruff check .` is clean, your contract suites run (not skipped) for what you implemented, the status table in `shared/services/<you>.md` is updated, and you touched no file outside your ownership (other than via a contract PR).

## How to work (agent workflow)
1. Read `docs/team/<P#>-*.md`, then the interface and schema files it points to.
2. Pick the next task from its ordered task list. Each task has acceptance criteria.
3. Write or enable tests first (contract suite + your unit tests), then implement until they're green.
4. Run the full suite and ruff. Update your status table. Commit on branch `p<N>/<topic>`.
5. If you need something from another split that isn't in the contracts, **stop and write it up as a contract-change proposal**. Don't work around it.
