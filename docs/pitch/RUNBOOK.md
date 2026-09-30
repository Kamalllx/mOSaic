# Pitch day runbook (Person A)

Everything for the judging slot:
- setup before you walk up;
- the timed talk track (deck + live demo);
- the fallback ladder with backup-video timestamps;
- answers to the questions judges are likely to ask.

The run sheet with every demo step is `docs/DEMO_SCRIPT.md`. This page is the short version for the day.

| What | Where |
|---|---|
| Deck (11 slides, arrow keys, F for full screen) | `docs/pitch/deck.html` (open the file in Edge; works offline apart from the fonts) |
| Backup video (1080p, 1:44, captioned, real run) | `.data/video/mosaic-demo-take1.mp4` on the laptop; copy it to a USB stick and a phone too |
| Re-record the backup video | `scripts\win\reset-demo.ps1 -SkipPreflight`, then `uv run python scripts/record_demo.py` |
| Score a run | `uv run python scripts/demo_run.py check <task_id> --gateway http://127.0.0.1:8089` |

---

## 1. Setup

### T-60 min
- [ ] Laptop on AC power. Windows: power mode "Best performance"; notifications off (Focus); sleep and lid-close set to "Do nothing".
- [ ] Close heavy apps (browsers with many tabs, games, other GPU users). The 7B needs about 6 GB of the 8 GB of VRAM.
- [ ] Run `scripts\win\mosaic-boot.ps1`. The console opens on `/boot` in kiosk mode. Alt+F4 leaves kiosk.
- [ ] Run `uv run python scripts/preflight.py --gateway http://127.0.0.1:8089`. It must say **all green**, with the 7B at ≥ 25 tok/s (57 on this laptop) and fully on the GPU. If it's slow, run `scripts\win\restart-ollama.ps1`.

### T-30 min
- [ ] One throwaway run: `uv run python scripts/demo_run.py run --auto-approve --gateway http://127.0.0.1:8089`. It must print **8/8**.
- [ ] `scripts\win\reset-demo.ps1`. This empties memories (so the invalidation count is clean), resets the mock Jira and runs the preflight again.
- [ ] Phone (optional): turn on the laptop's Mobile hotspot, connect the phone, run `scripts\win\phone-access.ps1` as administrator, and open the printed URL at `/approvals`.
- [ ] Have these tabs ready:
  1. the deck;
  2. the console Home (`http://localhost:3000/`);
  3. `http://localhost:3000/memory`;
  4. the backup video paused at 0:00.
- [ ] Open `data/okf/finance/cloud-bill-2026-09.md` in an editor with the line ready to paste:
  `Correction (live demo): the September dual-run line was re-billed at the committed-use rate.`

### T-5 min
- [ ] Projector mirrored at 1920×1080 (Win+P → Duplicate). Check the console text is readable from the back.
- [ ] Deck on slide 1, full screen. Composer prompt **not** submitted yet.

---

## 2. Talk track (about 5 minutes; cut to 3 with the notes in brackets)

| Time | On screen | Say (in your own words) |
|---|---|---|
| 0:00 | Slide 1 | "mOSaic is an operating system for a company's AI. Knowledge is a filesystem, agents are processes, and every action they take is a system call the kernel can stop. It all runs on this laptop." |
| 0:20 | Slide 2 | "Companies want AI that acts on private data. Today that means sending the data out, letting agents act unchecked, or getting answers nobody can trace. Operating systems solved the same problems for programs." |
| 0:45 | Slide 3 [skip in 3 min] | Walk the table quickly: process = agent, syscall = governed action, kernel log = audit, cache coherence = memory. |
| 1:05 | Slide 4, then switch to the console | Press **Alt Space**, pick "Investigate Project Apollo's overrun", read it aloud, press **Run**. The task drops to the left. |
| 1:15 | The run stage | "The task tells its story on the left. On the right, every agent is a process: its own face, PID, token count, and what it's doing right now." |
| 1:35 | Stage: the red "untrusted" chip, and the red node on the desktop | "One of the documents it found is a vendor email that tries to give the agents orders. The firewall marks it as data. Nothing it asks for will happen." |
| 1:50 | Stage: "Opened in a sandbox" | "Research opened the vendor's docs in a browser sandbox with no internet access." |
| 2:00 | The approval drawer opens | "Now the agent wants to write to Jira. That's a syscall, and policy says a human decides. The kernel has blocked it. I can see the exact change, the policy and the evidence." Approve (from the phone if it's set up). |
| 2:20 | Story: "Executed, verified and committed"; then Alt Enter for the Result tab | "Executed, verified, committed. Three root causes, each citing the documents behind it, and a recovery plan: 6.2 lakh, 31% over." |
| 2:45 | Audit button | "Every decision is in a hash-chained journal, and the kernel verifies the chain." |
| 3:00 | `/memory`, then paste the line into the cloud bill and save | "The agents remember what they learned and where it came from. Watch what happens when finance corrects the bill." Toast and stale chips: "Finance memories are stale; engineering's aren't, because they never read that bill." A few seconds later the teal chips appear: "and the local model has re-derived them from the new text." |
| 3:40 | Slide 8 | "All measured on this laptop: under a minute, 8 of 8 checks every run, 57 tokens a second on an 8 GB GPU." |
| 4:05 | Slide 9 [skip in 3 min] | "Agent frameworks are libraries. mOSaic is the runtime underneath them, and it runs their agents as governed processes." |
| 4:30 | Slide 11 | "It doesn't just answer questions. It runs your organization's AI, privately, on one box." |

After the demo, reset the file: `git checkout data/okf/finance/cloud-bill-2026-09.md`.

---

## 3. When something goes wrong

Go down the ladder; don't debug on stage.

| Symptom | Do this | Say |
|---|---|---|
| No planner node 15 s after Run | Refresh the task page once. If nothing appears, go to the backup video at **0:10** | "Let me show you a recorded run from this same laptop." |
| Stuck on one step > 30 s | Keep talking over the timeline for 15 s, then use the backup video (timestamps below) | "This is a live 7B model; here's the same run recorded an hour ago." |
| The approval drawer doesn't open | The amber "1 approval waiting" button in the task header, or `/approvals` | |
| No stale toast after saving the bill | Open `/memory`: the chips update without a reload. Otherwise video **1:20** | |
| The gateway is down | `scripts\win\reset-demo.ps1 -SkipPreflight` (about 20 s) while you present slides 5–7 | |
| Anything else | Backup video | |

**Backup video timestamps** (take 1):

| Time | Moment |
|---|---|
| 0:00 | Home |
| 0:05 | Prompt |
| 0:10 | Agents spawn |
| 0:19 | Retrieval |
| 0:27 | Firewall flag |
| 0:36 | Approval |
| 0:44 | Approved |
| 0:50 | Result |
| 1:00 | Audit |
| 1:08 | Vendor email |
| 1:15 | Memory |
| 1:20 | Cloud bill edited, memories stale |
| 1:26 | Re-derived |
| 1:32 | System |
| 1:39 | End card |

**The mock replay** (no models at all): `uv run mosaic-mock-gateway --speed 2 --port 8080`, then open the dev console that points at it (`http://localhost:3002`).

---

## 4. Judge Q&A

**How is this different from LangChain, CrewAI or AutoGen?**
Those are libraries for writing agents. mOSaic is the runtime the agents run inside:
- a process table with quotas;
- a kernel that mediates every action;
- policy and human approval;
- sandboxes, transactions and an audit chain.

Agents written with other frameworks can run on it through adapters. We built a NOOA adapter that runs object-style agents as governed processes.

**What stops a prompt injection?**
Three layers:
1. Retrieved text is screened by a firewall: pattern rules always, and an optional local classifier that catches reworded attacks.
2. Flagged text is shown to agents as data, never instructions.
3. The important one: even if a model were fooled, it can't *do* anything by itself. Every world-changing action is a syscall that policy checks, and writes need a human.

In the demo, the malicious email is found and flagged, and no agent acts on it. The kernel only saw `jira.read`, `browser.open`, one approved `jira.write` and `fs.write`.

**What if the model makes up a root cause?**
The planner only keeps root causes backed by retrieved documents. Each one cites at least one source, most cite two, and the UI shows the citations as clickable chips. The scoring script fails a run if any root cause is uncited.

**Why a 7B model? Isn't that too weak?**
The heavy lifting is structure: retrieval, per-specialist evidence, and synthesis with citations. The model routes by task class, so planning and reasoning use qwen2.5 7B and embeddings use nomic. On bigger hardware you change one YAML file to use bigger models. The point is that it runs on a laptop GPU at 57 tokens a second.

**Does any data leave the machine?**
No. Models run on Ollama locally, and data marked restricted is never routed to a remote model, even if one is configured. The browser sandbox sits on an internal Docker network with no internet access, which a test proves.

**What happens if the server crashes mid-run?**
Processes checkpoint their working state. We killed mosaicd 25 seconds into a run, restarted it, and the task resumed from its checkpoint and finished, with a single Jira write and no duplicate.

**How does the audit chain work?**
Every event (decision, syscall, approval, commit) is appended with a hash of the previous entry. The kernel re-checks the chain when you open the audit page. The last run had 78 entries, verified.

**What is real and what is mocked in the demo?**
Real:
- the kernel, agents, models, retrieval, firewall, memory, sandboxes, policy, approvals and audit.

Stand-ins:
- Jira is an in-process mock with the same API shape;
- the vendor documentation site is a local container;
- the company data (Project Apollo) is a realistic but fictional bundle of 60 documents: Slack, email, tickets, budgets and ADRs.

**How does it scale beyond one box?**
Today it runs on one node: the appliance story, a box in the server room. The kernel's process table and event bus sit in Postgres and Redis, so scheduling agents across nodes is the next step. Isolation can move from Docker to microVMs.

**Who buys this?**
Organizations that can't send data to a cloud AI and can't let agents act unchecked: finance, healthcare, the public sector, and mid-size companies that want one appliance instead of a cloud AI bill.

**What did you build, and how is it tested?**
- About 305 automated tests against shared contracts, so four people could build the kernel, knowledge, agents and platform in parallel.
- A 10-question retrieval test (10/10).
- A scored end-to-end demo run (8/8 every time).
- A preflight that checks the whole stack, including GPU speed, before a demo.

**Why "memory re-derivation"? Isn't a vector store enough?**
A vector store finds text. It doesn't know that a conclusion an agent reached last week depended on a document that just changed. Our memories record `derived_from`. When the watcher sees a source change, only the dependent memories go stale, in about 0.1 s, and the local model rewrites them from the new text in about 3.5 s.

**What would you do with more time?**
- SSO and per-team approver roles;
- more connectors through MCP;
- microVM sandboxes;
- a multi-node scheduler;
- the dedicated appliance image.
