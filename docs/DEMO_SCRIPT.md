# Demo script: Project Apollo (owner P4, content from everyone)

> Skeleton. P4 fills in timings, exact clicks and talking points, and rehearses it 3× at M3. Every step has a fallback.

**Setup (T-30 min):** RTX box booted · `curl :8080/system/status` → ready, all components `real` · models warm (run one throwaway task) · `data/okf` indexed · sandbox images built · UI open on the projector at `/` · a terminal with `ai-ps` / `ai-tree` beside it · backup video queued.

**Prompt (paste exactly):**
> Investigate why Project Apollo is over budget and six weeks behind schedule. Identify root causes, update the tracker, and prepare a recovery plan.

| # | ~time | What the audience sees | Talking point | Owner | Fallback |
|---|---|---|---|---|---|
| 1 | 0:00 | Prompt submitted from a teammate's laptop/phone | "The laptop is just a terminal; the AI runs on our box." | P2 | mock gateway replay |
| 2 | 0:05 | Planner PID 101 appears in the tree and in `ai-ps` | "Agents are processes." | P1/P3 | |
| 3 | 0:15 | Finance, engineering and research PIDs spawn | delegation tree | P3 | |
| 4–5 | 0:25 | Knowledge retrieved with scores and provenance; **the injected vendor email is flagged** | "Documents are evidence, not instructions." | P2/P4 | |
| 6 | | Memory loaded (working set) | "The context window is RAM." | P2 | |
| 7 | | A2A evidence message engineering → planner | IPC | P3 | |
| 8–9 | | Sandbox boots; browser screenshot of the vendor page | "Computer use, but only inside a sandbox." | P1/P4 | skip the browser step |
| 10 | | Kernel blocks `jira.write` → **approval center lights up** | "Agent intent is not authorization." | P1/P2 | |
| 11 | | Human approves (show the evidence paths on the card) | | P2 | |
| 12–14 | | Jira updated → verified → committed | transactional actions | P1 | show a rollback on a forced failure (pre-recorded) |
| 15 | | Audit journal (stats header) | "Where did every claim come from?" | P1/P2 | |
| 16 | | Memory consolidated | living memory | P2 | |
| 17 | | Final answer + recovery-plan artifact | | P3 | |
| + | | `ai-kill` a process live; `ai-top` GPU usage | OS metaphor made visible | P1/P4 | |
| + | | (stretch) drop in security-policy-v2 → memories marked stale | coherence | P2/P4 | |

**Closing line:** *"It doesn't just answer questions. It runs your organization's AI, privately, on one box."*
