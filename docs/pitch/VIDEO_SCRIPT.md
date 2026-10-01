# mOSaic: the 3-minute demo video

The voice-over, what is on screen for each line, and how to record it. About 440 words: at a steady 150 words a
minute it runs 2:55 to 3:05. Each line's screen direction is in brackets above it. Record the screen first, then read
the voice-over against it, or the other way round; every section stands on its own if one needs a retake.

| Section | Time | Covers |
|---|---|---|
| Hook and problem | 0:00 to 0:30 | agents with API keys and no operating system; what mOSaic is |
| Core walkthrough | 0:30 to 1:15 | one real task end to end: agents, the story, the firewall, the sandbox, the approval on the phone, the cited answer |
| Supporting features | 1:15 to 2:00 | memory that notices, agents made for the task with SQL, people and roles, connected apps, your own files, mOSaic OS |
| Technical and scalability | 2:00 to 2:30 | the kernel, the governed syscall path, the knowledge filesystem, local models, one contract, how it grows |
| Summary and call to action | 2:30 to 3:00 | the one-line promise, the proof (4 scenarios at 8/8), the repo |

---

## 0:00 to 0:30 · Hook and problem

[Black, then the boot screen as the services tick in; it opens onto the desktop's mosaic floor.]

> Every company is plugging AI agents into its tools. But ask a simple question: who let that agent write to Jira?
> What did it read before it did? Can you undo it? Today, agents are scripts holding API keys. There is no process
> table, no permissions, no audit trail.

[The desktop: the greeting, the coloured tiles of /org, the rail.]

> mOSaic changes that. It is an operating system for your organization's AI. Agents run as processes, every action
> is a governed system call, and everything is audited, privately, on one laptop GPU.

## 0:30 to 1:15 · Core walkthrough: one real task, end to end

[Alt Space. Type or pick "Investigate Project Apollo's overrun". Run. The task docks left; the run stage fills the desktop.]

> I ask: why is Project Apollo over budget and six weeks late? The planner reads the goal and creates specialists for
> this task: finance, engineering, research. Each one is a process, with its own face, its own budget and its own
> permissions.

[Tiles light up on the floor as documents are read; the story shows "understood", "planned", "created", thoughts.]

> Every document they read lights up on the desktop, and the story tells you what each agent is thinking.

[Point at the red, untrusted vendor email under "Referred to".]

> One email hides a prompt injection. The firewall flags it, and the agents treat it as data, never as instructions.

[The sandbox screenshot of the vendor's status page.]

> Research opens the vendor's docs in a sandboxed browser with no internet access.

[The phone in hand: the notification "Needs your decision"; open it; the approval card; Approve.]

> Then the action agent wants to update the tracker. Policy pauses it until a person decides, and I approve from my
> phone.

[The result: 31%, 6.2 lakh, three cited causes, the recovery plan; the audit journal with "chain verified".]

> The answer: a 31% overrun, three root causes each with evidence, a recovery plan, and a tamper-evident audit chain.

## 1:15 to 2:00 · Supporting features

[Memory app open. Copy the policy v2 document over the old one; the "source changed" banner; then the "re-derived" chip.]

> Memory knows where it came from. Change a source document and the memories built on it go stale in a tenth of a
> second, then rebuild themselves in about three.

[Ask the vendors question. The data-engineer and writer faces appear; the SQL in the story; the data table; the approval.]

> Ask a question nobody scripted, and mOSaic makes agents for the job: a data engineer writes SQL that the kernel
> checks before it runs, and a writer files the note to finance, after approval.

[Sign-in screen; Organization's role matrix; Connections (Connect GitHub, Sync); Add knowledge (drop a file, mount a folder); Settings.]

> Teams sign in with Google, and roles decide who can start work, approve, or only look. Connect GitHub and Calendar,
> with tokens encrypted in a vault. Drop in files, or mount a folder from your laptop, and it is searchable in seconds.

[Windows Terminal, mosaic-os: `ls /org`, `head` a document, `ls "/org/.search/apollo overrun"`, `mosaic ask ...`.]

> And mOSaic OS turns it all into a Linux system, where your organization's knowledge is a real filesystem.

## 2:00 to 2:30 · Technical and scalability

[Settings: the stack in layers with live health; Models routing; then the Audit journal; then the Agents registry.]

> Under the hood is a real kernel: a process table, a scheduler, quotas and checkpoints. Kill the daemon mid-run, and
> the task resumes. Every action runs the same path: policy, approval, sandbox, verify, then commit or roll back.
> Knowledge lives in a typed filesystem with provenance and trust, searched with hybrid retrieval. Models run locally,
> routed by the kind of thinking. One shared contract ties the kernel, the desktop, the phone and the OS together. New
> agents are manifests, new tools are MCP servers, and the same stack runs on a laptop or a dedicated node.

## 2:30 to 3:00 · Summary and call to action

[Back to the desktop's mosaic floor; the phone beside it showing "Good morning, Alice"; then the GitHub page.]

> mOSaic doesn't just answer questions. It runs your organization's AI: governed, explainable, private, on hardware
> you own. Agents as processes. Actions as syscalls. Knowledge you can trust. Four scored scenarios pass eight out of
> eight, on a local seven-billion-parameter model. The code is open at github.com/Kamalllx/mOSaic. Bring your own
> documents and your own tools, and give your AI an operating system.

---

## Before recording

1. `scripts\win\reset-demo.ps1` (restarts mosaicd, empties memories, runs the preflight: it must print "all green").
2. `uv run python scripts/seed_demo_data.py` (the vendors run writes a note; this resets it).
3. Remove anything a rehearsal added to `/org`: `data/okf/uploads`, `data/okf/mnt`, `data/okf/github`,
   `data/okf/calendar` (all git-ignored), and disconnect GitHub in Connections. Synced and uploaded documents mention
   PayCo and could change what the Apollo run retrieves.
4. Open the desktop full screen (`http://localhost:3000`, or `scripts\win\mosaic-boot.ps1` for the boot screen).
5. Phone: the APK installed, signed in as Priya (approver) with a code from the desktop's user menu, notifications on.
   Over USB: `adb reverse tcp:8089 tcp:8089` and the server `http://localhost:8089`.
6. mOSaic OS: open `wsl -d mosaic-os` in Windows Terminal once beforehand, so `/org` is mounted when you record.
7. Rehearse the Apollo run once; it takes about 100 seconds. Speed up the waiting parts in editing, not the answer.

## Shot list

| # | Shot | Length in the cut |
|---|---|---|
| 1 | Boot screen to desktop | 6 s |
| 2 | Alt Space, the Apollo prompt, Run | 5 s |
| 3 | The run stage: faces, tiles lighting up, the story | 12 s (sped up) |
| 4 | The flagged email, then the sandbox screenshot | 8 s |
| 5 | Phone notification and Approve | 6 s |
| 6 | The result and the verified audit chain | 8 s |
| 7 | Memory: source changed, re-derived | 8 s |
| 8 | Vendors: generated agents, SQL, the table | 10 s |
| 9 | Sign-in, Organization, Connections, Add knowledge, Settings | 14 s (quick cuts) |
| 10 | mosaic-os terminal | 10 s |
| 11 | Settings stack, models, audit, agents | 25 s |
| 12 | Desktop and phone, the repo | 20 s |
