# Demo script: Project Apollo (owner P4, content from everyone)

Target length is about 7 minutes. Rehearse it 3× at M3, and record one clean full run as the backup video.

## Setup (T-30 min)
1. The RTX node is on AC power and on the venue network. Its lid may stay closed.
2. On the node, run `bash /opt/mosaic/scripts/preflight.sh`. **It must print "all green".** It checks:
   - services and `/system/status` ready, all components `real`;
   - the GPU inside the ollama container, models pulled **and warmed**;
   - sandbox images and the browser smoke test;
   - bundle validity and search.
3. Projector laptop (a thin client on Tailscale):
   - console `http://<node>:3000/` fullscreen;
   - a terminal beside it, SSH'd into the node, running `watch -n1 ai-ps` (switch to `ai-top` for the GPU moment);
   - the backup video open and paused on a second screen or tab.
4. Phone: the mobile approve app is open (stretch), or the console approval page on the phone browser.
5. Paste the prompt into the composer but **do not submit** yet.

**Models** (must match `models/models.yaml`; preflight checks them): `ollama pull qwen2.5:7b-instruct llama3.2:3b qwen2.5-coder:7b llava:7b nomic-embed-text`
(one name per `ollama pull` on older Ollama versions). Planning, reasoning and extraction use qwen2.5:7b-instruct; the demo must run on it: on llama3.2:3b alone the root causes still appear (built from the specialists' findings) but the prose is weaker.

**Console URLs** (gateway `http://<node>:8080`, console `http://<node>:3000`):

| Screen | URL |
|---|---|
| Composer + recent tasks | `/` |
| Live run (timeline, process tree, result, recovery plan) | `/tasks/<task_id>` |
| Approval center (also the drawer on every page) | `/approvals` |
| Audit journal | `/audit/<task_id>` |
| Knowledge explorer (the vendor email) | `/knowledge?path=/org/inbox/vendor-email-2026-09-12` |
| System monitor (modes, GPU, sandbox screenshot) | `/system` |

For the invalidation demo (last row of the run sheet) start mosaicd with `MOSAIC_KNOWLEDGE_WATCH=true` (in `.env`).

**Prompt (paste exactly):**
> Investigate why Project Apollo is over budget and six weeks behind schedule. Identify root causes, update the tracker, and prepare a recovery plan.

## Run sheet
| # | ~time | Do / what the audience sees | Talking point | Owner | Fallback |
|---|---|---|---|---|---|
| 0 | 0:00 | Show the node: a closed laptop, `ai-ps` empty, `ai-top` showing the GPU | "This laptop *is* the company's AI server. Nothing leaves it." | P4 | CLI won't start: show `/system` in the console (all components `real`, GPU gauge) |
| 1 | 0:20 | Submit the prompt from the projector laptop (a thin client) | "My laptop is only a terminal; the work happens on our box." | P2 | Mock gateway: `uv run mosaic-mock-gateway --speed 2` on the projector laptop, console pointed at it |
| 2 | 0:30 | Planner PID 101 appears in the tree and in `ai-ps` | "Agents are processes: PID, state, quota, capabilities." | P1/P3 | Keep going; the tree catches up from events |
| 3 | 0:45 | Finance, engineering and research PIDs spawn | "The planner delegates, just like `fork`." | P3 | A specialist missing after 30 s: point at the planner's "spawned …" lines in the timeline; the run continues with the others |
| 4–5 | 1:00 | Knowledge panel: hits with scores and provenance. **The vendor email is flagged `instruction_like`** | "Documents are evidence, never instructions. This email tries to make the agent delete a table; the firewall catches it." | P2/P4 | Open `/org/inbox/vendor-email-2026-09-12` in the explorer and show the flag |
| 6 | 1:30 | Working set / memory loaded | "The context window is RAM; memory is paged in." | P2 | Nothing to show yet: say it over the knowledge hits and move on |
| 7 | 1:45 | A2A message engineering → planner (backfill root cause) | "Agents talk over kernel IPC, not by sharing prompts." | P3 | No IPC line: show `ai-audit <task_id>` in the node terminal (IPC entries), or skip |
| 8–9 | 2:00 | Sandbox boots; **screenshot of the PayCo status page** (GA 2026-10-20) | "Computer use, but only inside a sandbox on an internal network with no internet." | P1/P4 | `MOSAIC_MODE_BROWSER=fake` (fake page), or show `.data/smoke/vendor.png` from preflight |
| 10 | 2:40 | Kernel blocks `jira.write` → **the approval center lights up** | "Agent intent is not authorization. Writes to the outside world are syscalls, and policy says this one needs a human." | P1/P2 | Drawer didn't open: go to `/approvals`. No approval 60 s after the action agent spawned: switch to the mock gateway replay (it pauses at the approval) |
| 11 | 3:00 | **Approve from the phone**; show the evidence paths on the card first | "The approver sees exactly which documents justify the change." | P2 (+P4 mobile) | Approve in the console |
| 12–14 | 3:20 | Jira updated → verified → committed | "Transactional actions: execute, verify, commit, or roll back." | P1 | Pre-recorded rollback clip for a forced failure |
| 15 | 3:50 | Audit journal with the stats header | "Every claim and every action is traceable." | P1/P2 | Page errors: `ai-audit <task_id>` in the node terminal |
| 16 | 4:10 | Memory consolidated | "It learns from the run." | P2 | No `memory.consolidated` line: open `http://<node>:8080/memory?task_id=<task_id>` (finance/engineering findings with their source documents) |
| 17 | 4:30 | Final answer + recovery-plan artifact. Read the three root causes aloud: dual-run cloud cost, duplicate-recon-id backfill failure, PayCo certification + emergency contract | "Every root cause is backed by at least two documents." | P3 | Open the artifact from the last rehearsal |
| + | 5:30 | `ai-kill` a leftover process live; `ai-top` shows GPU load during a run | "The OS metaphor, made visible." | P1/P4 | `ai-kill` fails: use the kill button on the node in the process tree |
| + | 6:00 | (stretch) Edit a document the finance agent's memory came from → its memories go stale; the console toasts "N memories stale" and names finance-agent. Steps below | "Knowledge changes, so the memories that depended on it are invalidated." | P2/P4 | No toast: open `/memory?task_id=<task_id>` and show `stale: true`; else skip |

### Invalidation demo (stretch step)
Needs mosaicd started with `MOSAIC_KNOWLEDGE_WATCH=true`, after a completed run (the finance and engineering agents store their findings, derived from the documents they cited).
1. Check which documents the memories derive from: `curl -s http://<node>:8080/memory?task_id=<task_id> | jq '.[] | {owner, derived_from}'`. `/org/finance/cloud-bill-2026-09` is the usual one for finance-agent; `/org/projects/apollo` often appears for both agents.
2. On the node, edit that file, e.g. append a line to `data/okf/finance/cloud-bill-2026-09.md`: `Correction (live demo): the September dual-run line was re-billed.`
3. Within ~1 s the console shows the invalidation toast naming the affected agents; the file is reindexed (the explorer shows the new line without a reload).
4. Reset afterwards: `git checkout data/okf/finance/cloud-bill-2026-09.md` (the watcher reindexes the original).

Not with the security policy yet: no agent searches `/org/policies`, so no memory derives from `policies/security.md` and copying `data/demo-assets/security-policy-v2.md` over it invalidates nothing (it does reindex; the explorer shows v2). If the team wants the policy story, the finance agent must consult the policies (P3 decision). Reset: `git checkout data/okf/policies/security.md`.

**Closing line:** *"It doesn't just answer questions. It runs your organization's AI, privately, on one box."*

## If things go wrong
| Symptom | Action |
|---|---|
| Projector laptop can't reach the node | Check `tailscale status` on both. Venue Wi-Fi blocking UDP makes Tailscale relay via DERP; wait 10 s. Last resort: everyone joins the phone hotspot |
| Gateway down | `ssh node sudo systemctl restart mosaicd` (≈ 20 s), then continue |
| A model answers slowly or times out | Re-run the preflight warm-up. Check `ollama ps` shows `100% GPU` |
| The run stalls > 30 s on one step | Say "this is the live system"; if it's still stuck, switch to the mock gateway replay |
| Anything else | Play the backup video from the matching timestamp and narrate over it |

## QA checklist before each rehearsal
- [ ] `scripts/preflight.sh` all green
- [ ] `uv run python scripts/check_okf.py` OK, and `data/okf` has been reindexed after its last edit (`POST /knowledge/reindex`)
- [ ] One throwaway task run end to end (warms caches; clears first-run surprises)
- [ ] Mock-Jira reset to the seed state (restart `mock-jira`)
- [ ] Phone and projector laptop logged into Tailscale; console and app open
- [ ] Backup video file present locally (not streamed)
