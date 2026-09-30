# Hack brief: Person B, backend and agents

## Kickoff prompt (paste into Claude Code in the repo root)

```
You are joining the mOSaic hackathon team as Person B (backend and agents). mOSaic is a self-hosted AI operating system:
knowledge is a filesystem, agents are processes, world actions are governed syscalls, everything is audited.

First, create a git-ignored CLAUDE.local.md in the repo root containing the single line @docs/team/HACK-B-backend.md
(check .gitignore covers it). Then read, in order: docs/PROJECT_CONTEXT.md (all of it), AGENTS.md, shared/README.md, and
this brief. Skim the files each task below points to before changing anything.

Setup: git pull; git checkout -b b/firewall-setting; uv sync --all-packages --all-extras; cp .env.example .env if missing;
uv run pytest -q must be green before you start (real-model tests skip without Ollama; say so if they skip).

Work through the tasks in docs/team/HACK-B-backend.md in order. For each: write or extend the test first, implement until
green, run uv run pytest -q and uvx ruff check ., then commit (one logical change per commit, area-prefixed message).
Push your branch and tell me; Kamal merges into main after checking the demo laptop. Never push to main, never
force-push, never skip hooks. You own shared/ during the hack: follow the contract-change steps exactly. Do not change the
Apollo demo path's behaviour without saying so. If the same error beats you three times, stop and ask me.
Start with task B1.
```

## Your area
`kernel/`, `mosaicd/`, `agents/`, `knowledge/`, `execution/`, `models/`, `policies/`, `data/`, and `shared/`. **You are the only one changing contracts during the hack.** `apps/web` belongs to Person C; if your change gives the UI something new to show (a field, an event), write C a two-line note: what changed, the event or field name, and an example payload.

**The demo is sacred.** `main` must always score 8/8 with `uv run python scripts/demo_run.py run --auto-approve` on real models. If you don't have a GPU with ≥ 8 GB and Ollama, ask Kamal to run it on the laptop before your branch is merged. Anything that changes Apollo's retrieval, prompts, planner or policies needs that check.

## Tasks (in order)

### B1. A setting for the LLM firewall classifier (contract 0.8.0)
**Why:** the regex firewall catches the demo vendor email. The LLM classifier also catches reworded injections the regex misses: 3–4 of 5, with 0 false positives on the bundle, at about 0.2 s per document. But it can only be turned on in code today.
- **Files:**
  - `shared/python/mosaic_contracts/wiring.py` (`Settings`; look at how `models_config` reads its env var);
  - `shared/python/mosaic_contracts/__init__.py` (`CONTRACT_VERSION`);
  - `.env.example`;
  - `knowledge/mosaic_knowledge/factory.py` (`build_context_firewall`);
  - `knowledge/mosaic_knowledge/firewall/__init__.py`;
  - `knowledge/tests/test_firewall_llm_real.py`.
- **Do:**
  - add `firewall_llm: bool = False` (env `MOSAIC_FIREWALL_LLM`);
  - bump to 0.8.0;
  - `uv run mosaic-export-contracts`, then `npm --prefix shared/ts run generate`;
  - document it in `.env.example`;
  - the factory passes `use_llm_classifier=settings.firewall_llm`.
- **Tests:**
  - a unit test with the fake model router showing the factory honours the setting (on → the classifier is consulted for unverified/untrusted hits, off → it isn't);
  - the contract suites stay green.
- **Log it:** when the LLM (not the regex) flags a hit, log it and put a flag reason the UI can show into the hit. Check how `firewall_flags` and the `knowledge.retrieved` event reach the timeline first. Adding a new flag value such as `instruction_like_llm` alongside `instruction_like` is a contract-visible change, so note it for C.
- **Done when:**
  - `MOSAIC_FIREWALL_LLM=true` on the real stack flags an extra reworded-injection document (add one under `data/okf/inbox/` only in B2, not here);
  - Apollo still scores 8/8 **with the setting on**, and the run is no more than ~5 s slower.

### B2. A second demo scenario, beside Apollo
**Why:** judges may ask "does it only do the one task?"
- **Do:**
  - read the bundle (`data/okf/projects/zeus.md`, `finance/zeus-budget.md`, `projects/atlas.md`, hermes, iris, the meetings and Slack) and pick a goal the existing agents can answer with evidence. For example: "Prepare a steering-committee briefing on Project Zeus budget risk, cite the evidence, and post a summary comment to the tracker". Use a different project, so Apollo's retrieval is unaffected;
  - add any missing documents as **new** files with proper front-matter (`uv run python scripts/check_okf.py` must pass);
  - include one reworded injection (untrusted email) that only the B1 classifier catches, to show B1 live;
  - check that the planner handles non-Apollo goals. Grep `planner.py` and the agents for Apollo-specific strings, jira keys or paths, and generalise carefully; Apollo output must not change.
  - add `--goal` presets or a `--scenario zeus` option to `scripts/demo_run.py`, with its own scoring checks. The Apollo 8 stay as they are.
- **Tests:** a fake-mode test that the planner produces sub-tasks for the new goal; a real run scored by `demo_run.py`.
- **Done when:** both scenarios score full marks on real models, back to back, after `reset-demo.ps1`. Write the new scenario's talk track as a short section for Kamal (a new section in `docs/DEMO_SCRIPT.md` is fine; tell him).

### B3. Robustness from rehearsals
Kamal will send issues from rehearsals; those come first. Proactively:
- make sure a model timeout or an Ollama restart mid-run ends in a clear `task.failed` with a reason, not a hang;
- make sure agents respect their wall-time quotas;
- check `lifecycle` resume after a mosaicd kill still works (the handoff doc §1 has the check).

Add a test for each fix.

### B4. Stretch (only if B1–B3 are merged)
- `GET /memory` already returns re-derived records (tags `reconsolidated`, `replaces:<id>`). If C wants a "re-deriving…" state, emit an event when re-consolidation starts. `memory.consolidated` is already sent at the end, with source `memory.reconsolidate`. Agree the payload with C and add it to `shared/catalogs/events.yaml`.
- `ai-*` CLI polish (`kernel/mosaic_kernel/cli`): `ai-ps` and `ai-top` look good on a projector terminal.

## Useful facts
- **Firewall classifier:** `_CLASSIFIER_PROMPT` in `firewall/__init__.py`, temperature 0, JSON `{instruction_like, span}`, cached by content hash, runs only on unverified/untrusted hits the regex didn't flag. An eval script like the one used to tune it: see `knowledge/tests/test_firewall_llm_real.py` (skips without Ollama; can flake under GPU contention).
- **Re-consolidation:** `MemoryService.reconsolidate(memory_ids)` in `knowledge/mosaic_knowledge/memory/__init__.py`; triggered from `Coherence._on_changed` (invalidate → reindex → background re-derive).
- **Models:** router config in `models/models.yaml` and `models/models.7b-only.yaml` (use the latter on 8 GB). If a routed model isn't pulled, the router falls back to any pulled chat model.
- **Embeddings:** `EMBED_SCHEME="qd1"` in `knowledge/mosaic_knowledge/indexing/store.py`. Changing how documents are embedded means bumping it, which forces a full re-embed.
- **Tests that need Postgres:** point `MOSAIC_DATABASE_URL` in `.env` at a pgvector database. They create `mosaic_real` / `mosaic_qa` themselves.
- **NOOA adapter:** `agents/mosaic_agents/adapters/nooa.py`, with a test in `agents/tests/test_agents_units.py`.
