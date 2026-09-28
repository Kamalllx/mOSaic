# P3 (Agents & Models) Implementation Summary

This document outlines the complete implementation of the **P3: Agents & Models** workstream to assist other teams (P1 Kernel, P2 Knowledge, P4 Platform) in integration.

## 1. Models Component (`mosaic_models`)
**Location:** `models/mosaic_models/`

### `PolicyRouter`
- **Purpose:** Central LLM router that applies P1 security/privacy policies before forwarding requests to the actual LLM providers.
- **Routing Rules:**
  1. **Strict Privacy:** If `request.privacy == PrivacyLevel.RESTRICTED`, the request is **forced** to a local provider (e.g., Ollama).
  2. **Latency Critical:** If `request.latency_critical == True`, routes to the fastest/smallest model.
  3. **Task Class Routing:** If `request.task_class == TaskClass.REASONING`, defaults to the largest available reasoning model (e.g., `qwen2.5:7b-instruct` or falls back to `phi3`).
- **Features:** Includes automatic JSON repair heuristics (`ask_json`), handling common LLM markdown wrapper issues (e.g., extracting JSON from ````json ... ```` blocks).

### `OllamaProvider`
- **Purpose:** Async HTTP provider interacting with the local Ollama daemon.
- **Endpoints:** Uses `/api/generate`, `/api/chat`, and gracefully falls back to the legacy `/api/embeddings` endpoint since the environment might run an older Ollama version that doesn't support the newer `/api/embed` array endpoint.

## 2. Agents Component (`mosaic_agents`)
**Location:** `agents/mosaic_agents/`

### Agent SDK (`sdk/__init__.py`)
Provides the base `MosaicAgent` class and utilities for all library agents.
- **`ask_json`**: Makes structured LLM requests, repairing output via the router.
- **`gather_evidence`**: Simplifies calling `ctx.knowledge.search`.
- **`propose_action`**: Formats Syscall requests with proper justifications, risk assessments, and evidence tracing (critical for P1's approval center).

### Agent Runtime & Registry
- **`ManifestRegistry`**: Discovers and validates YAML agent definitions in `agents/manifests/*.yaml`.
- **`Runtime`**: Resolves `entrypoint` strings to Python classes dynamically, wraps execution in a try-catch to always return an `AgentResultStatus.FAILED` upon unhandled exceptions (preventing Kernel crashes).

### Specialist Library (`library/`)
1. **`PlannerAgent`:** 
   - Uses `ask_json` to break down goals into a step-by-step `Plan`.
   - Spawns agents asynchronously using `ctx.spawn(step, inputs)`.
   - Supports parallel execution respecting `depends_on` conditions.
   - Synthesizes children outputs into a final consolidated artifact.
2. **`FinanceAgent`:** Derives budget variances and financial blockers using specific JSON schemas.
3. **`EngineeringAgent`:** Focuses on tracking schedule slips and Jira integrations.
4. **`ResearchAgent`:** Executes sandboxed browser searches (`browser.open` syscall) to gather external evidence.
5. **`ActionAgent`:** Translates findings into P1 transactional operations (`jira.write`, `fs.write`), managing `SyscallStatus.DENIED` and `ROLLED_BACK` gracefully.

## 3. Integration Touchpoints for Other Teams

### For P1 (Kernel & Execution)
- **Agent Lifecycle:** P1 should interact with agents exclusively via `Runtime.run(manifest, goal, ctx)`.
- **Syscalls:** When an agent (like `ActionAgent` or `ResearchAgent`) issues a `ctx.syscall()`, it will return a `SyscallStatus`. P3 correctly parses and handles `DENIED`, `REJECTED`, or `ROLLED_BACK` by halting actions. 
- **Context Injection:** P1 must construct the `AgentContext` and inject `KnowledgeInterface`, `ModelRouter`, and `AgentTools` before calling `Runtime.run`.

### For P2 (Knowledge & Console)
- **A2A IPC:** P3 agents communicate via `ctx.send()` and `ctx.receive()` using `A2AMessage` (e.g., Research sharing findings with Planner). P2 UI can render these IPC graphs.
- **Evidence Formatting:** Agents use `AgentResult.evidence` to report sources. The console should render these K-V pairs to provide transparency for LLM hallucinations.
- **Embeddings:** P2 should call `ModelRouter.embed(EmbedRequest(texts=[...]))`. P3 handles multiplexing requests to Ollama.

### For P4 (Platform & Infrastructure)
- **Deployment:** Ensure `models.yaml` matches the Ollama tags pulled locally (e.g., `nomic-embed-text` is required for embeddings). 
- **Fake vs Real Wiring:** The E2E script `scripts/run_p3_apollo.py` serves as a template for wiring P3's real components against fake outer systems until all modules land.
