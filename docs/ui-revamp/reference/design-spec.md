# mOSaic UI Master Design Spec

## Purpose
This reference pack defines the UI/UX direction for **mOSaic**, a self-hosted local AI operating system whose web console is the operator's view of the runtime.

The UI must visualize the runtime itself: **processes, states, policies, approvals, provenance, memory, knowledge, audit and system health** rather than behaving like a generic chatbot.

## Product model
- Runs entirely on one local machine with local open-source models.
- No cloud AI.
- Agents are OS-like processes with PID, PPID, state, token quota and capabilities.
- A kernel governs model calls, knowledge reads and actions.
- Real-world actions are syscalls: policy check -> approval when required -> isolated execution -> verify -> commit/rollback.
- Organization knowledge lives under `/org/...` and uses hybrid lexical + semantic + graph retrieval.
- Every knowledge result shows source and trust/provenance.
- Prompt-injection content is flagged `UNTRUSTED` and treated as data, never as instructions.
- Memories retain source links and become stale when source documents change.
- Audit records form a tamper-evident hash-chained journal.
- Kernel crash recovery resumes from the last checkpoint.

## Visual language
### Theme
- Primary: dark operator console.
- Surfaces: near-black warm charcoal, layered only a few shades lighter.
- Thin 1px borders.
- Soft shadows.
- 10-12px radius.
- No purple/blue AI gradients.
- No neon glow.
- No glassmorphism overload.
- No decorative 3D cubes/brains/sparkles.
- No stock AI artwork.
- Task Execution has a separate **light-theme** version for comparison.

### Accent
Use one restrained accent: **teal**.
Suggested values:
- Accent: `#2BB8A3`
- Accent hover: `#36CDB6`
- Accent subtle: `#103A35`

### Base palette
- App background: `#0D1117`
- Surface 1: `#151A21`
- Surface 2: `#1B222B`
- Surface 3: `#222A34`
- Border: `#2D3743`
- Border strong: `#3B4653`
- Text primary: `#F1F5F9`
- Text secondary: `#A9B3BF`
- Text muted: `#77828E`
- White: `#FFFFFF`

### Fixed state colors
- RUNNING: `#2FB344`
- WAITING: `#D99A25`
- PAUSED: `#4C86D9`
- FAILED: `#E05252`
- COMPLETED: `#8A949F`
- TERMINATED: `#4A525B`

### Risk colors
- Low: `#7D8792`
- Medium: `#D99A25`
- High: `#E87921`
- Critical: `#E05252`

### Trust
- UNTRUSTED background: `#4A1518`
- UNTRUSTED text/border: `#F06A6A`

## Typography
- UI: Inter or Geist.
- Mono: JetBrains Mono for PIDs, paths, hashes, IDs, JSON and code.

Suggested projector-safe scale:
- Display: 32px / 700
- Page title: 24px / 650
- Section title: 17px / 650
- Body: 14px / 450
- Small/meta: 12px / 450
- Dense table: 13px / 450
- Mono: 12-13px
- Button: 13px / 600

## Spacing
Use a 4px base scale:
- 4, 8, 12, 16, 20, 24, 32, 40
- Desktop content padding: 24px
- Panel padding: 16px
- Dense table row height: 40-44px
- Sidebar width: 220px expanded; 64px collapsed

## Persistent desktop shell
Present on every desktop screen:
- Left sidebar: Home, Tasks, Approvals, Knowledge, Memory, Audit, Agents, System.
- Approvals has a pending-count badge.
- Bottom: `alice · acme` and `Local · 100% on-device` indicator.
- Top bar: global knowledge search, task name when inside task, live GPU/VRAM mini-meter, bell with pending approval count.
- No login screen.
- No workspace switcher.
- No cloud-provider settings.

## Real demo data
Use only:
- user: `alice`
- org: `acme`
- task: `T-0749a1215b`
- title: `Investigate why Project Apollo is 31% over budget and 6 weeks behind schedule. Identify root causes, update the tracker, and prepare a recovery plan.`
- priority: high
- run time: about 62 s

Processes:
- 101 planner-agent, PPID —, WAITING on `pid:105`, 1,240 tokens
- 102 finance-agent, PPID 101, COMPLETED, 2,310 tokens
- 103 engineering-agent, PPID 101, COMPLETED, 1,980 tokens
- 104 research-agent, PPID 101, COMPLETED, 1,450 tokens
- 105 action-agent, PPID 101, WAITING on `approval:APR-e9c8fde548`, 640 tokens

Knowledge:
- `/org/finance/apollo-budget`
- `/org/finance/cloud-bill-2026-09`
- `/org/engineering/apollo-status`
- `/org/decisions/ADR-042`
- `/org/jira/APOLLO-12`
- `/org/jira/APOLLO-31`
- `/org/inbox/vendor-email-2026-09-12` -> `UNTRUSTED`
- `/org/finance/payroll-2026` -> confidential / hidden by policy
- `/org` folders: finance, engineering, decisions, projects, people, policies, inbox, slack, jira

Approval:
- `APR-e9c8fde548`
- requester: `action-agent#105`
- capability: `jira.write`
- operation: `jira.update_issue`
- target: `APOLLO-12`
- risk: medium
- policy: `project-updates-v1`
- justification: `Record the root causes on the migration ticket`
- arguments:
```json
{ "issue": "APOLLO-12", "fields": { "status": "At Risk" }, "comment": "Root causes: dual-run cloud cost (ADR-042), backfill failure on duplicate reconciliation IDs, vendor SDK v5 certification block. Overrun 6.2L (31%)." }
```

Result:
- 6.2 lakh over budget (31%)
- 6 weeks late
- root causes:
  1. dual-run cloud cost doubled under ADR-042 while migration slipped
  2. ledger backfill failed on duplicate reconciliation IDs (APOLLO-12)
  3. vendor SDK v5 stuck in certification (APOLLO-31)
- tracker: `APOLLO-12: In Progress -> At Risk`
- artifacts: `recovery-plan.md`, `screenshots/001.png`

System:
- `qwen2.5:7b-instruct` local, loaded, 100% GPU
- `nomic-embed-text` local embeddings
- RTX, 8 GB VRAM, 7.6 GB used
- all components real / healthy
- sandbox `mosaic-sb-3f2a`: browser, vendor-docs-only network allowlist, non-root, read-only filesystem

## Screen specifications

### 1. Home
- Large composer: `What should mOSaic work on?`
- Priority selector.
- Pending approvals card with `1 pending` and `APR-e9c8fde548`.
- Running/recent tasks with status chips and durations.
- System strip: GPU/VRAM, CPU, RAM, loaded models, `all local`.
- Knowledge summary: `73 documents · last indexed 2 min ago`.

### 2. Task Execution (hero)
Header:
- task title
- `waiting_approval`
- elapsed time
- Pause / Cancel

Left column:
- live event timeline
- icons + PID chips + time offsets
- expanded vendor-email event
- red `UNTRUSTED` badge
- note: `treated as data, not instructions`
- visually distinct policy / approval events

Centre:
- process-tree node graph
- 101 above 102-105
- each node: PID, agent, state, tokens, waiting_on
- per-node pause/resume/kill controls

Right:
- selected process inspector
- capabilities
- quota bar
- model
- children
- last checkpoint

Produce both dark and light versions.

### 3. Approval Center
Right-side drawer over Task Execution.
- headline: `action-agent#105 wants to write to Jira`
- capability / operation / target
- risk badge
- policy + reason
- justification
- formatted JSON arguments
- evidence path chips
- comment box
- Approve / Reject
- note: `The action runs in a transaction: verify -> commit, or automatic rollback.`

### 4. Result / Recovery Plan
- document-style recovery plan
- summary
- `3 root causes`
- citation chips
- recovery steps
- tracker change `In Progress -> At Risk`
- side panel: Actions committed + artifacts
- sandbox screenshot thumbnail

### 5. Audit
- stats: `78 entries`, `hash chain verified ✓`
- vertical journal grouped by kind
- sequence, timestamps, actors, short hash snippets
- filters by kind and PID

### 6. Knowledge Explorer
Left:
- `/org` tree
Centre:
- `/org/decisions/ADR-042`
- type / owner / privacy / trust / source chips
- links to / linked from
Right:
- search query `apollo cloud cost`
- snippet results
- three score bars: lexical / semantic / graph
- provenance
- `UNTRUSTED` on vendor email
- `1 result hidden by policy`
- relationship graph preview

### 7. Memory
- memory records with owner agent, kind, importance, derived-from source chips
- two finance-agent records stale
- amber `source changed` marker
- toast: `Source changed: /org/finance/cloud-bill-2026-09 · 2 memories invalidated · affected: finance-agent`

### 8. System
- loaded local models + VRAM share
- CPU / RAM / GPU gauges
- component health grid
- active sandboxes: ID, type, network scope, security flags, destroy button
- `Kernel: uptime, 2 tasks max concurrent, 8 PIDs max`

### 9. Agents Registry
- 5 agents
- role
- model policy = `local-only`
- capabilities
- knowledge mounts
- resource limits
- read-only cards
- no create-agent button

### 10. Boot
- full-screen minimal boot UI
- mOSaic logo
- checklist:
  Kernel
  Policy engine
  Audit log
  Knowledge filesystem
  Memory
  Models: qwen2.5:7b on GPU
  Sandbox
- sequential ticks
- feeling: real OS startup, not a marketing splash

### 11. Phone: Approval
- approval-required notification card
- `action-agent#105 wants jira.write on APOLLO-12`
- risk badge
- justification
- evidence chips
- large Approve / Reject buttons

### 12. Phone: Task Status
- task title
- status chip
- mini process list with PID + state dots
- latest five timeline events

## Key components
1. Sidebar item
2. State chip
3. PID chip
4. Process node
5. Timeline row
6. Evidence chip
7. Score bar
8. Risk badge
9. Approval drawer
10. Memory row
11. Metric gauge
12. Model health row
13. Sandbox row
14. Knowledge tree row
15. Audit journal row
16. Hash-chain badge
17. Toast / system notification
18. Task composer
19. Progress bar
20. Tabs

## Component anatomy
### Sidebar item
Icon + label + optional count badge + active bar.

### State chip
Status dot + uppercase status. State colors never change across screens.

### PID chip
`PID 105` in JetBrains Mono; optionally append agent name.

### Process node
Agent name, PID, state, token count, waiting_on; small action menu.

### Timeline row
Time offset + event icon + event name + actor/PID + short detail + provenance.

### Evidence chip
Compact monospace path chip; hover can reveal source metadata.

### Score bars
Three mini horizontal bars labeled lexical / semantic / graph.

### Risk badge
Text + subtle border/background; no gradients.

### Approval drawer
Header -> request identity -> operation -> target -> risk -> policy -> justification -> JSON -> evidence -> comment -> actions.

### Memory row
Memory ID + kind + importance + source chips + freshness/stale state.

### Gauge
Label + numeric reading + thin progress bar + optional trend.

## Motion
- Page transitions: 160ms ease-out.
- Sidebar collapse: 180ms.
- State chip changes: 150ms color fade.
- Process state changes: 220ms.
- Timeline new event: 200ms slide/fade.
- Approval drawer: 220ms slide-in.
- Toast: 180ms in; auto-hide after 4s unless critical.
- Live gauges: smooth 350ms interpolation.
- No ambient animated glow.
- No constant pulsing except subtle activity indicator on RUNNING.

## UX principles
1. The console should feel like an **operator terminal for an AI runtime**.
2. Every important AI action should be inspectable and attributable.
3. Trust and risk must be visible at the point of action.
4. Knowledge and memory must show where they came from.
5. Never disguise system state behind generic assistant language.
6. Prefer dense, precise UI over decorative visuals.
7. Make 1080p readability a hard requirement.

## Negative constraints
Do not add:
- SSO/OAuth screens
- workspace creation
- agent marketplace
- create-agent form
- workflow/automation builder
- Gmail/Notion/GitHub/Google Drive/Slack login integrations
- cloud model names
- pricing
- testimonials
- invented metrics
- invented companies
- generic marketing hero sections

## Engineering handoff priorities
1. Build shell first.
2. Build Task Execution dark theme.
3. Build Approval drawer.
4. Build Knowledge Explorer + UNTRUSTED flow.
5. Build Memory stale-state flow.
6. Build Audit journal.
7. Build Result / recovery plan.
8. Build System and Agent registry.
9. Build boot and mobile screens.

The attached source brief is authoritative for content and constraints.
