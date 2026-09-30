# Phase 2 brief: Person D, the mobile app and the Settings centre (no GPU needed)

## Kickoff prompt (paste into Claude Code in the repo root)

```
You are Person D on the mOSaic hackathon team (phase 2). mOSaic is a self-hosted AI operating system: knowledge is a
filesystem, agents are processes, world actions are governed syscalls, everything is audited. Your area: the mobile app
(remote use of mOSaic from a phone: sign in, approvals, prompts, live tasks; Android emulator now, an APK to ship) and a
Settings / configuration centre in the desktop console that shows the models, agents, tools, policies and the whole stack.
You do not have a GPU, and you do not need one: use the mock gateway and fake-mode mosaicd.

First: git fetch; git checkout -b d/settings origin/ui/desktop. Create a git-ignored CLAUDE.local.md in the repo root
containing the single line @docs/team/PHASE2-D-mobile-settings.md. Read, in order: docs/PROJECT_CONTEXT.md (all of it,
especially section 4 on adding desktop apps and section 8 on the interfaces), AGENTS.md, apps/mobile/README.md,
apps/mobile/App.tsx, apps/web/components/apps/monitor.tsx, apps/web/components/apps/programs.tsx, and this brief.

Setup: uv sync --all-packages --all-extras; npm --prefix apps/web ci; npm --prefix apps/mobile ci. Backend without a GPU:
MOSAIC_DEFAULT_MODE=fake uv run mosaicd (real kernel and API, fake models), or uv run mosaic-mock-gateway --port 8080
(replays a full run). Install Android Studio with an emulator (Pixel, recent Android) for the mobile work.

Work through the tasks in docs/team/PHASE2-D-mobile-settings.md in order. Before each commit: uv run pytest -q and
uvx ruff check . if you touched Python; npm --prefix apps/web run lint/test/build for the console;
npm --prefix apps/mobile run typecheck for the app. One logical change per commit with an area prefix (ui:, mobile:, p1:).
Contract changes go on their own contract/<topic> branch with a version bump and regenerated artifacts. Signing keys,
keystores and OAuth secrets never go into the repo. Push your branch and tell Kamal; he merges into ui/desktop. Never push
to main or ui/desktop, never force-push, never skip hooks. If the same error beats you three times, stop and ask.
Start with task D1.
```

## Your area
`apps/mobile/`, the Settings app in `apps/web/components/apps/`, and a read-only config endpoint in the gateway (`kernel/mosaic_kernel/gateway/`), with the contract for it. Person C owns sign-in and RBAC: use `MOSAIC_AUTH=dev` and a stub login until their `/auth/google` lands. Kamal owns the desktop's look, so follow its tokens and components.

## Tasks (in order)

### D1. `GET /system/config` (contract and gateway, fake mode is fine)
- **One read-only document describing the running system:**
  - the stack: component name, `fake`/`real` mode, implementation, version, health;
  - the contract version and Python/Node versions;
  - models, and routing from `models.yaml` (task class → model, local or remote, context window, availability);
  - agents and templates (capabilities, mounts, quotas);
  - tools and connectors;
  - policies (name, priority, which actions need approval);
  - firewall settings (regex on, LLM classifier on or off);
  - feature flags;
  - ports and URLs.
- **Redact** anything secret: keys, tokens, DSN passwords.
- **Permission:** `config.read`, once Person C's RBAC lands.
- Add it to the mock gateway too. Test that nothing secret-looking (`password`, `secret`, `token`, `key=`) appears in the output.

### D2. The Settings centre (desktop app)
- **Add the app:** a "Settings" desktop app, following `docs/PROJECT_CONTEXT.md` §4.
- **Sections:** Overview, Models, Agents, Tools & connectors, Policies, Security, Stack.
- **Make it genuinely impressive:**
  - a live architecture map of the stack, with each component's health from `/system/status`;
  - the model routing drawn as a flow from task class to model, with local badges and the GPU and VRAM each model uses;
  - agents shown as cards with their capability sets;
  - policies with a "what needs a human" summary;
  - search across everything.
- Read-only first. Then safe toggles behind `config.manage` (for example the LLM firewall classifier), each change audited. Coordinate the endpoint with Person C.

### D3. The mobile app, rebuilt for remote use
- **Structure:** Expo Router (or React Navigation) with tabs:
  - **Home:** running tasks with live progress and orbs (`thinking-orbs` has a React Native port) or `bot-avatars`, which Kamal is using on the desktop;
  - **Approvals:** evidence, arguments, policy; Approve and Reject gated by role;
  - **Compose:** prompt and priority;
  - **Task detail:** timeline, processes, result;
  - **Knowledge search;**
  - **Settings:** server URL, account, org.
- **Sign-in:** Google sign-in (`@react-native-google-signin/google-signin` or `expo-auth-session`) exchanged at Person C's `POST /auth/google`. Until that lands, a dev login sends the `X-Mosaic-User` headers. Include an org switcher, and hide actions the role doesn't allow.
- **Remote:** the server URL works over the laptop's hotspot, LAN or Tailscale HTTPS. Handle offline and reconnect states clearly.
- **Notifications:** a local notification when an approval arrives (`expo-notifications`, driven by polling or the WebSocket while the app is open).
- **Design:** follow Kamal's new light, colourful, Mac-like desktop (ask him for the token values). Large touch targets; one-handed approve.

### D4. Android emulator, then an APK
- Run in the Android Studio emulator (`npx expo run:android`), then on a real phone via USB debugging.
- **APK:** `npx expo prebuild`, then `cd android && ./gradlew assembleRelease`, or EAS Build if the team has an account. The signing keystore stays out of the repo; document where it lives. Output `mosaic-<version>.apk`.
- Document all of it in `apps/mobile/README.md`: emulator, device, the APK build, the Google sign-in client IDs (from Person C), and pointing it at a server.

## Useful facts
- **App today:** `apps/mobile/App.tsx` is a single file (three tabs, AsyncStorage settings, polling, safe areas). The API client is `apps/mobile/src/client.ts`, and it uses `@mosaic/contracts` types.
- **Mock gateway:** `uv run mosaic-mock-gateway --port 8080` replays an Apollo run, including the approval, so the approval flow works without a GPU. On the emulator the host machine is `10.0.2.2`.
- **Console data you can reuse** for Settings: `/system/status`, `/models`, `/registry/agents`, `/registry/tools`, `/policies`, `/sandboxes`.
