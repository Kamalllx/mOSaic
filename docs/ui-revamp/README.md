# Console revamp (apps/web)

The operator console was rebuilt from the design pack in [`reference/`](reference) (the spec and the storyboard), keeping
the data layer as it was: `lib/mosaic-client.ts` (only additive wrappers for existing routes), `useTaskEvents`, the event
reducer and its tests, and the WebSocket handling. Every screen reads existing gateway routes and events; anything in the
pack without backend support was left out (list below).

## Before and after

`before/` was captured from the old console against the mock gateway; `after/` from the new one, dark and light at
1920×1080, dark at 1366×768 (a common projector mode), and a phone set at 390 px.

| Screen | Before | After (dark) | After (light) | 1366×768 | Phone |
|---|---|---|---|---|---|
| Home | [before](before/home-dark-1920x1080.png) | [after](after/home-dark-1920x1080.jpg) | [light](after/home-light-1920x1080.jpg) | [1366](after/home-dark-1366x768.jpg) | [phone](after/phone-home.jpg) |
| Task · live | [before](before/task-dark-1920x1080.png) | [after](after/task-dark-1920x1080.jpg) | [light](after/task-light-1920x1080.jpg) | [1366](after/task-dark-1366x768.jpg) | — |
| Approval drawer | (inside task) | [after](after/drawer-dark-1920x1080.jpg) | [light](after/drawer-light-1920x1080.jpg) | [1366](after/drawer-dark-1366x768.jpg) | [phone](after/phone-task-approval.jpg) |
| Approvals | [before](before/approvals-dark-1920x1080.png) | [after](after/approvals-dark-1920x1080.jpg) | [light](after/approvals-light-1920x1080.jpg) | [1366](after/approvals-dark-1366x768.jpg) | [phone](after/phone-approvals.jpg) |
| Task · result | [before](before/result-dark-1920x1080.png) | [after](after/result-dark-1920x1080.jpg) | [light](after/result-light-1920x1080.jpg) | [1366](after/result-dark-1366x768.jpg) | [phone](after/phone-task-after-approve.jpg) |
| Audit | [before](before/audit-dark-1920x1080.png) | [after](after/audit-dark-1920x1080.jpg) | [light](after/audit-light-1920x1080.jpg) | [1366](after/audit-dark-1366x768.jpg) | [phone](after/phone-audit.jpg) |
| Knowledge | [before](before/knowledge-dark-1920x1080.png) | [after](after/knowledge-dark-1920x1080.jpg) | [light](after/knowledge-light-1920x1080.jpg) | [1366](after/knowledge-dark-1366x768.jpg) | [phone](after/phone-knowledge.jpg) |
| Memory (new) | — | [after](after/memory-dark-1920x1080.jpg) | [light](after/memory-light-1920x1080.jpg) | [1366](after/memory-dark-1366x768.jpg) | [phone](after/phone-memory.jpg) |
| System | [before](before/system-dark-1920x1080.png) | [after](after/system-dark-1920x1080.jpg) | [light](after/system-light-1920x1080.jpg) | [1366](after/system-dark-1366x768.jpg) | [phone](after/phone-system.jpg) |
| Agents (new) | — | [after](after/agents-dark-1920x1080.jpg) | [light](after/agents-light-1920x1080.jpg) | [1366](after/agents-dark-1366x768.jpg) | [phone](after/phone-agents.jpg) |
| Tasks (new) | — | [after](after/tasks-dark-1920x1080.jpg) | [light](after/tasks-light-1920x1080.jpg) | [1366](after/tasks-dark-1366x768.jpg) | [phone](after/phone-tasks.jpg) |
| Boot (new) | — | [after](after/boot-dark-1920x1080.jpg) | [light](after/boot-light-1920x1080.jpg) | [1366](after/boot-dark-1366x768.jpg) | — |

## Polish pass (c/polish)

These improvements were added on top of the revamp, keeping the same information architecture:

### Firewall visibility (knowledge panel + task timeline)

The knowledge panel now uses a `role="alert"` card with a double border, a larger icon, bold uppercase heading, and per-path `FirewallHit` rows that each show the path and the label "offending text — treated as data, not instructions". A green confirmation row reads "treated as data, not instructions" after the list of hits. The `detectedBy` prop on each hit supports "caught by regex" vs "caught by classifier" labelling when the backend provides a classifier flag (currently not emitted by the mock). The retrieval list also shows a flagged count inline.

### Memory re-derivation

The Memory page now visually groups a stale record and its re-derived replacement as a paired card with a teal border and "Memory re-derived from changed source" header. Stale record text has a strikethrough; re-derived records have a subtle teal background. The stat bar shows a teal "N re-derived" count alongside the amber stale count when both are non-zero.

### Empty and loading states

Every page now shows:
- A skeleton (animated pulse placeholders) while data is loading, matching the layout of the loaded state.
- A centred, descriptive empty state with a next-action hint instead of a bare text line.
- An inline error card with a Retry button when the gateway is unreachable.

Pages improved: Tasks, Approvals, Audit index, Agents, Memory, Knowledge, System.

### Accessibility

- `aria-label` added to `role="radiogroup"` controls.
- `role="alert"` on the firewall hit card and the invalidation banner.
- `aria-label="Tasks with audit journals"` / `"Pending approvals"` / `"Resolved approvals"` on list containers.
- Knowledge page empty state now includes the `BookOpenText` icon as a visual anchor.
- All interactive icon-only buttons already had `aria-label`; no regressions introduced.

## What was checked

- `npm run build`, `npm run lint` and `npm test` (61 tests: the event reducer, the client, the approval-drawer state,
  the process-tree layout, and WCAG AA contrast for every text token on every surface in both themes).
- `tsc --noEmit` clean in both `apps/web` and `apps/mobile`.
- The mock gateway replay on every screen, in both themes, at 1920×1080 and 1366×768, with no browser console errors.
- Phones at 390 and 430 px: no horizontal overflow on any page, and an approval approved from the phone viewport.
- After approving in the drawer, the drawer closes and the page behind it takes clicks (the dress-rehearsal overlay bug).
- A real run against mosaicd clicked through the new console scored 8/8 (one `jira.write` approval, the vendor email
  flagged and not acted on, 3 cited root causes, 6.2 lakh / 31%, the sandbox screenshot, an intact audit chain, the
  recovery plan) in 51 s; the invalidation demo showed on the Memory screen 0.2 s after the source edit.

## Left out (no backend support)

| From the design pack | Why |
|---|---|
| Agent marketplace, create-agent form, templates, cloud model names | Forbidden by the spec; there is no route to create agents (they are manifests on disk) |
| Task progress "4/5 steps", ETA, plan checklist | The plan exists only as `agent.log` text |
| A task-level Pause button | There is no `/tasks/{id}/pause`; processes pause from the tree and the inspector |
| Storage gauge; per-model "loaded" state and VRAM share | Not in `ResourceSnapshot` / `ModelInfo`; the console shows available local models and the GPU's total VRAM |
| Kernel limits ("2 tasks max concurrent, 8 PIDs max") | Not exposed; uptime is |
| Sandbox Destroy button; "non-root" flag | No route; not in `SandboxSpec` (network scope, CPU, memory, GPU, mounts and timeout are shown) |
| Knowledge New Folder / Upload | Not in scope (`/knowledge/ingest` exists if wanted later); Reindex is there |
| A trust column in the knowledge tree | `KnowledgeEntry` has no trust field; trust shows on the document and in search results |
| Line-level "detected instructions" highlight | Firewall flags are strings on search hits, with no positions |
| Invented memory tabs (Findings / Decisions / Insights) | Real kinds are episodic, semantic and working, plus a stale filter |
| Budget-vs-actual chart, Charts and Export tabs | No numeric source; the numbers exist only in the Markdown plan |
| "Last indexed 2 min ago" | Only the live `knowledge.reindexed` event carries it |
| "Hash chain verified" | The gateway returns hashes but no server-side verification; the console shows "chain intact: N entries link to their predecessor" (a link check). The kernel has `verify_chain()`; exposing it is a contract change |
| Phone push notifications | None exist; the phone uses the approvals page and the full-screen approval card |
| Classifier flag on individual paths | The mock gateway does not currently emit `classifier=true` on `knowledge.retrieved`; the `FirewallHit` component is ready to show it when Person B adds the field |
