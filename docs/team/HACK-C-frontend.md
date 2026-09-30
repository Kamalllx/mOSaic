# Hack brief: Person C, frontend, mobile and README

## Kickoff prompt (paste into Claude Code in the repo root)

```
You are joining the mOSaic hackathon team as Person C (frontend, mobile, README). mOSaic is a self-hosted AI operating
system: knowledge is a filesystem, agents are processes, world actions are governed syscalls, everything is audited. The
console (apps/web, Next.js 16 + Tailwind v4) is what judges see.

First, create a git-ignored CLAUDE.local.md in the repo root containing the single line @docs/team/HACK-C-frontend.md
(check .gitignore covers it). Then read, in order: docs/PROJECT_CONTEXT.md (all of it), AGENTS.md, apps/web/AGENTS.md if
present, docs/ui-revamp/README.md, and this brief. Look at the screenshots in docs/ui-revamp/after/ to learn the visual
language before changing anything.

Setup: git pull; git checkout -b c/polish; uv sync --all-packages --all-extras; npm --prefix apps/web ci. Run the UI
against the mock gateway (no GPU needed):
  uv run mosaic-mock-gateway --speed 4 --port 8080
  cd apps/web && NEXT_PUBLIC_MOSAIC_URL=http://localhost:8080 npx next dev -p 3002
Check every page at desktop width and at 390 px, in light and dark themes, with a browser tool if you have one.

Work through the tasks in docs/team/HACK-C-frontend.md in order. Before each commit: npm --prefix apps/web run lint,
npm --prefix apps/web test, npm --prefix apps/web run build, and uv run pytest -q if you touched anything outside
apps/web. One logical change per commit, prefixed ui: / docs: / mobile:. Push your branch and tell me; Kamal merges into
main after checking the demo laptop. Never push to main, never force-push, never skip hooks. Do not edit shared/ (Person B
owns contracts; ask them for any new field or event). README: no emojis. If the same error beats you three times, stop and
ask me. Start with task C1.
```

## Your area
`apps/web/`, `apps/mobile/`, `README.md`, `docs/readme/`, `docs/ui-revamp/`. Types come from `@mosaic/contracts` (`shared/ts`), which is generated, so never edit it. If you need data the API doesn't give you, ask Person B.

**Design rules:**
- use the tokens in `apps/web/app/globals.css`, the components in `components/ui/`, and `lib/tones.ts` for status colours;
- Geist and JetBrains Mono fonts;
- both themes (`data-theme`);
- phone widths down to 360 px with a 16 px gutter and no horizontal scroll;
- calm, dense, professional: this is an operating-system console, not a landing page;
- keep the existing layout of the task page, which is what the demo video and the judges' walk-through use; polish it, don't restructure it.

## Tasks (in order)

### C1. README refresh
`README.md` is public and linked from the website (`mosaic-os-black.vercel.app`) and the demo video. It already has:
- a hero, the OS analogy, the architecture, the syscall pipeline;
- real screenshots in `docs/readme/screens/`;
- the video and site links.

Add what landed since, in the same voice:
- **re-derivation**: stale memories are rebuilt from the changed document in about 3.5 s;
- the **LLM firewall classifier**, opt-in; reworded injections the regex misses;
- the **NOOA adapter**: object-style agents run as governed processes;
- **phone and mobile** approvals, plus the Expo app;
- **kiosk boot** (`/boot`, `mosaic-boot.ps1`), `preflight.py`, and the `demo_run.py` 8/8 gate;
- contract 0.7.0;
- a short "Run it" section pointing to `docs/PROJECT_CONTEXT.md` §6.

Keep it scannable: tables, short paragraphs, no emojis, no marketing fluff. Check that every link and image path resolves.

### C2. Console polish for judges
Go page by page:
- `/boot`, `/`, `/tasks`, `/tasks/[id]`, `/approvals`, `/audit`, `/audit/[taskId]`, `/knowledge`, `/memory`, `/agents`, `/system`.

For each page check:
- the **empty** state (fresh DB, nothing run yet): a helpful sentence and the next action, not a blank area;
- the **loading** state (skeletons, not layout jumps);
- the **error** state (gateway down: a clear message and a retry, and `/boot` still works);
- keyboard focus and `aria` labels on icon-only buttons;
- 390 px width in both themes.

Then:
- **Firewall visibility:** in the task timeline and knowledge panel, make an `instruction_like` hit unmistakable: a red chip, the offending text, and "treated as data, not instructions". Person B may add a flag telling the LLM classifier apart from the regex (B1); show "caught by classifier" when it arrives.
- **Memory page, re-derivation moment:** the stale → re-derived transition should read clearly on a projector. Show the old memory greyed with "source changed", and the new one with the teal "re-derived" chip and "replaces MEM-…" (`components/global-events.tsx`, `app/memory/page.tsx`). Consider grouping each new memory next to the one it replaces.
- Take before and after screenshots of anything you change.

### C3. Expo Go on a real phone
- `apps/mobile`: `npm ci`, `npx expo start`, scan with Expo Go.
- Use the mock gateway on your laptop first (`http://<your-laptop-ip>:8080`, same Wi-Fi). Then use Kamal's laptop gateway (`http://<laptop-ip>:8089` after he runs `phone-access.ps1`).
- Fix anything that breaks on a real device: safe areas, keyboard covering the composer, polling when backgrounded, long approval arguments.
- Update the "Tested" section of `apps/mobile/README.md` with the device and OS version.

### C4. Screenshots and docs
- Refresh `docs/ui-revamp/after/` and `docs/readme/screens/` from a real run. Ask Kamal for a laptop session, or use the mock.
- Include the Memory re-derived chip and the firewall chip.
- Keep file names stable so README links don't break.

### Stretch
- A presenter mode on the task page: a toggle that enlarges the timeline font and highlights the current step, for the projector.
- `/system`: a small live tok/s readout if the API exposes it. Ask B; it's `model.invoked` events or `/system/resources`.

## Useful facts
- **Gateway URL:** `lib/gateway-url.ts` works it out from the page host at runtime, so phones on the laptop's hotspot work without a rebuild. `NEXT_PUBLIC_MOSAIC_URL` overrides it.
- **Events:**
  - `components/global-events.tsx` holds the app-wide subscription (approvals, knowledge, memory);
  - `lib/use-task-events.ts` handles per-task events;
  - `lib/events.ts` has the helpers `str` and `strList`;
  - event types are in `shared/catalogs/events.yaml`.
- **API client:** `lib/mosaic-client.ts`, wrapped in React Query (`app/providers.tsx`). Query keys in use include `approvals`, `memory`, `knowledge-object`, `knowledge-tree`, `knowledge-search`, `knowledge-graph`.
- **Mock gateway limits:** `uv run mosaic-mock-gateway` replays one Apollo run. It won't emit re-derivation (`memory.consolidated` from `memory.reconsolidate`) or LLM-classifier flags. To see those, use the laptop, or temporarily fake the data in a local-only branch (don't commit fakes).
- **Tests:** vitest (`npm test`); layout logic has tests in `lib/*.test.ts`. Add a test for any non-trivial pure function you write.
