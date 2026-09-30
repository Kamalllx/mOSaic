# apps/mobile: phone thin client

Expo (SDK 57) app with three tabs:
- **Approvals:** polls `GET /approvals?status=pending` every 2 s while the app is in the foreground. Pauses when the app goes into background and resumes immediately on return to foreground. Each card shows the capability, risk badge, arguments (horizontally scrollable), evidence paths and policy, with Approve / Reject buttons (`POST /approvals/{id}/approve|reject`).
- **Compose:** `POST /tasks`, prefilled with the Apollo demo prompt. Keyboard avoidance ensures the input is not covered on small phones.
- **Settings:** gateway URL and user/org headers, stored on device.

Types and header names come from `@mosaic/contracts` (`shared/ts`). `metro.config.js` watches that folder.

```bash
cd apps/mobile
npm ci
npx expo start                  # scan the QR code with Expo Go
npm run typecheck
```

- **Develop without the node:** run `uv run mosaic-mock-gateway` on your laptop, then set the gateway URL to `http://<laptop-ip>:8080`. Plain HTTP works in Expo Go during development. The default URL is `http://localhost:8080`.
- **Real gateway over Tailscale:** use `https://<node>.<tailnet>.ts.net:8443`. See `infra/appliance/README.md` §5.
- **Hotspot (Windows):** run `scripts\win\phone-access.ps1` (as administrator) on the laptop to open the firewall. The Settings tab shows a hint with the right URL format. Remove the rule afterwards with `-Remove`.

## Device testing

`npm run typecheck` passes against contract 0.7.0.

A real-device test on iOS or Android was not performed in this environment. The app was validated by:
- TypeScript type check (`npm run typecheck`) — clean.
- Code review against the Expo SDK 57 API (SafeAreaView, AppState, KeyboardAvoidingView, Pressable).
- Static review of safe area, keyboard avoidance, touch target sizes (minHeight 44/50 px), and background-polling behavior.

When a real device is available: use Expo Go, connect to the mock gateway (`--port 8080`), navigate to Settings and enter `http://<laptop-ip>:8080`, then Compose → submit the Apollo task → switch to Approvals → approve.

## Changes from the original

| Area | Change |
|---|---|
| Safe areas | Replaced `View` with `SafeAreaView` for the root and loading screen |
| Keyboard | Added `KeyboardAvoidingView` (platform-aware behavior) to Compose and Settings |
| Background polling | Polls only when `AppState === "active"`; re-polls immediately on foreground |
| Touch targets | Buttons: `minHeight 44–50 px`; tabs: `minHeight 44 px` |
| Long arguments | `ScrollView horizontal` wrapper around the JSON arguments block |
| Error states | Error shown in a styled card with a Retry button; Compose errors shown distinctly |
| Empty state | Descriptive text explaining that approvals appear when an agent acts |
| Loading state | Shows spinner with gateway URL while the first fetch runs |
| Risk badge | Colour-coded badge (critical/high/medium/low) on each approval card |
| Default URL | Changed from Tailscale URL to `http://localhost:8080` for local development |
| Accessibility | `accessibilityRole`, `accessibilityLabel`, `accessibilityState` on all interactive elements |
