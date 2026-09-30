# Demo script: Project Apollo (owner P4, content from everyone)

Target length is about 7 minutes. Rehearse it 3× at M3, and record one clean full run as the backup video.

## On the Windows demo laptop (the laptop is the node)
Machine-specific ports go in `scripts/win/local.ps1` (git-ignored), e.g. `$env:MOSAIC_PG_PORT = "5434"`.

| When | Run (PowerShell, repo root) |
|---|---|
| Start everything and open the console full screen | `scripts\win\mosaic-boot.ps1` (Docker, Postgres/Redis/vendor-docs, Ollama with the 7B loaded, mosaicd, the console, then `/boot` in Edge kiosk mode; Alt+F4 leaves it) |
| Before each rehearsal | `scripts\win\reset-demo.ps1` (restarts mosaicd, which resets the mock Jira; empties memories and working sets; runs the preflight) |
| Preflight only | `uv run python scripts/preflight.py --gateway http://127.0.0.1:8089` (must print "all green"; checks the 7B generates at >= 25 tok/s and is fully on the GPU) |
| A run feels slow | `scripts\win\restart-ollama.ps1` (stops leftover model runners that hold VRAM, reloads the 7B, prints tok/s) |
| Throwaway run, then score | `uv run python scripts/demo_run.py run --auto-approve --gateway http://127.0.0.1:8089` (prints 8/8) |
| Score the live run | `uv run python scripts/demo_run.py check <task_id> --gateway http://127.0.0.1:8089` |
| Phone access (optional) | `scripts\win\phone-access.ps1` as administrator: prints the LAN URL and a QR code, opens ports for the Private network only. Afterwards: `scripts\win\phone-access.ps1 -Remove` |
| Record the backup video | `scripts\win\reset-demo.ps1 -SkipPreflight`, then `uv run python scripts/record_demo.py` (a real run through the console with captions, 1080p, invalidation included; writes `.data/video/*.mp4`) |
| Stop | `scripts\win\mosaic-shutdown.ps1` (`-All` also stops Ollama and the containers) |

## Setup (T-30 min, Linux appliance)
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
4. Phone (optional): on the laptop's Mobile hotspot, run `scripts\win\phone-access.ps1` and open the printed URL (`/approvals`). The console finds the gateway on the same host by itself. There is no login in the MVP: use your own hotspot only, and run `phone-access.ps1 -Remove` after the demo.
5. Paste the prompt into the composer but **do not submit** yet.

**Models** (must match `models/models.yaml`; preflight checks them): `ollama pull qwen2.5:7b-instruct llama3.2:3b qwen2.5-coder:7b llava:7b nomic-embed-text`
(one name per `ollama pull` on older Ollama versions). Planning, reasoning and extraction use qwen2.5:7b-instruct; the demo must run on it: on llama3.2:3b alone the root causes still appear (built from the specialists' findings) but the prose is weaker.

**Console URLs** (gateway `http://<node>:8080`, console `http://<node>:3000`):

| Screen | URL |
|---|---|
| Boot checklist (open it first; it moves to Home when everything is up) | `/boot` |
| Composer, pending approvals, running tasks, GPU | `/` |
| Live run: timeline, process tree, inspector; **Result** tab when done | `/tasks/<task_id>` |
| Every task | `/tasks` |
| Approval center (the drawer opens by itself on the task page) | `/approvals` |
| Audit journal (index at `/audit`) | `/audit/<task_id>` |
| Knowledge explorer (the vendor email) | `/knowledge?path=/org/inbox/vendor-email-2026-09-12` |
| Memory: findings with sources; the invalidation demo | `/memory` |
| Agent registry and tools (read-only) | `/agents` |
| System monitor (modes, GPU, models, sandboxes, screenshot) | `/system` |

### Screen tour: where each demo moment lives
| Moment | Where to look |
|---|---|
| Agents as processes (steps 2–3) | Task page, **Live** tab: the process tree; click a node for the inspector (quota bars, capabilities, model) |
| Firewall (4–5) | Task timeline: the retrieval opens by itself with a red **UNTRUSTED** chip and "treated as data, not instructions"; the Knowledge panel on the right repeats it |
| Sandbox screenshot (8–9) | Right column of the task page (**Sandboxes**), later in the **Result** tab and on `/system` |
| Approval (10–11) | The drawer opens by itself: plain headline, risk, policy, arguments, evidence chips, Approve / Reject. Missed it? The amber "1 approval waiting" button in the task header, or `/approvals`. On a phone the card is full screen |
| Commit (12–14) | Timeline: green commit row; **Result** tab, "Actions committed" (verified, with the tracker change) |
| Audit (15) | The **Audit** button in the task header: stat tiles and "chain intact" |
| Result (17) | The **Result** tab opens by itself when the run ends: summary, 3 root causes with citation chips, recovery steps |
| Invalidation (18) | `/memory`: the amber "Source changed" banner, the stale rows tagged "source changed"; a toast shows on every page |

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
| 16 | 4:10 | Memory consolidated | "It learns from the run." | P2 | No `memory.consolidated` line: open `/memory` in the console (finance/engineering findings with their source documents) |
| 17 | 4:30 | Final answer + recovery-plan artifact. Read the three root causes aloud: dual-run cloud cost, duplicate-recon-id backfill failure, PayCo certification + emergency contract | "Every root cause is backed by at least two documents." | P3 | Open the artifact from the last rehearsal |
| + | 5:30 | `ai-kill` a leftover process live; `ai-top` shows GPU load during a run | "The OS metaphor, made visible." | P1/P4 | `ai-kill` fails: use the kill button on the node in the process tree |
| 18 | 6:00 | **Invalidation:** open `/memory`, then edit the cloud bill the finance agent cited → the amber banner "Source changed … N memories invalidated · Affected: finance-agent" appears, the finance rows are tagged "source changed"; a few seconds later the local model re-derives them from the new text (teal "re-derived" rows, toast); the explorer shows the new line. Steps below | "Knowledge changes, so the memories that depended on it are invalidated." | P2/P4 | No toast: open `/memory?task_id=<task_id>` and show `stale: true`; else skip |

### Invalidation demo (step 18)
Needs mosaicd started with `MOSAIC_KNOWLEDGE_WATCH=true`, after a completed run (the finance and engineering agents store their findings, derived from the documents they cited).
1. Check which documents the memories derive from: `curl -s http://<node>:8080/memory?task_id=<task_id> | jq '.[] | {owner, derived_from}'`. `/org/finance/cloud-bill-2026-09` is the usual one for finance-agent; `/org/projects/apollo` often appears for both agents.
2. On the node, edit that file, e.g. append a line to `data/okf/finance/cloud-bill-2026-09.md`: `Correction (live demo): the September dual-run line was re-billed.`
3. Within ~1 s the console shows the invalidation toast naming the affected agents; the file is reindexed (the explorer shows the new line without a reload).
4. Reset afterwards: `git checkout data/okf/finance/cloud-bill-2026-09.md` (the watcher reindexes the original).

**Optional: security policy v2.** The finance agent checks its drivers against `/org/policies` (v2 adds CFO sign-off for emergency vendor spend, the PayCo contract), so its memories derive from `policies/security.md`. After a completed run, open `/memory`, then `copy data\demo-assets\security-policy-v2.md data\okf\policies\security.md` (or `cp` on Linux): the banner names `/org/policies/security` and finance-agent only; engineering stays fresh, and the explorer shows v2. Reset: `git checkout data/okf/policies/security.md`.

### Known limits
- **Browser sandbox internet on Docker Desktop:** fixed. The browser runs on the internal network in both modes; on Docker Desktop a relay container publishes its port, so page subresources can't reach the internet either (`execution/tests/test_browser_live.py::test_browser_sandbox_has_no_internet`).

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
- [ ] Preflight all green: `scripts/preflight.sh` on the appliance, `uv run python scripts/preflight.py` anywhere else
- [ ] `uv run python scripts/check_okf.py` OK, and `data/okf` has been reindexed after its last edit (`POST /knowledge/reindex`)
- [ ] One throwaway task run end to end (warms caches; clears first-run surprises)
- [ ] Mock-Jira reset to the seed state (restart `mock-jira`)
- [ ] Memories reset **after the throwaway run** (on the laptop: `scripts\win\reset-demo.ps1` does it) (otherwise the step-18 toast counts memories from every earlier run): `docker compose -f infra/compose/docker-compose.yml exec postgres psql -U mosaic -d mosaic -c "TRUNCATE memories, working_sets;"`. For a different database, change `-d` (or run the same SQL against the database in `MOSAIC_DATABASE_URL`). No task should be running, since working sets are what a restarted task resumes from
- [ ] Phone and projector laptop logged into Tailscale; console and app open
- [ ] Backup video file present locally (not streamed)
