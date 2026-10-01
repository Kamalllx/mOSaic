# apps/mobile: mOSaic on the phone

An Expo (SDK 57, React Native 0.86) app for using mOSaic away from the desk: sign in, see what is running, decide
what agents may do, and start work. Types come from `@mosaic/contracts` (`shared/ts`); `metro.config.js` watches that
folder.

## What it does

| Screen | |
|---|---|
| Sign in | The server address (checked with `/health` and `/auth/config`), then: one of the demo org's people in dev mode (Alice owner, Priya approver, Sam viewer), any email in dev mode, or a one-time code from the console, which also works when the org uses Google accounts. |
| Home | A greeting, the org and your role, a live/reconnecting dot, what needs you, running tasks with thinking orbs, recent tasks. Pull to refresh. |
| Task | The goal and status, the agents on it as faces (they hop while working, look around while waiting, doze when done), the story of the run from the audit journal, and the answer with its evidence. Stop the task if your role allows. |
| Approvals | Each waiting action: which agent, the capability and target, risk, the policy that paused it, the justification, the arguments, the evidence. Approve or reject with a comment. A role without `approval.resolve` sees the request but not the buttons. |
| Ask | A goal in plain words, a priority and the demo prompts. Hidden behind a notice for roles without `task.create`. |
| Knowledge | Hybrid search over /org, with firewall flags. |
| Me | Who you are, the org, what your role lets you do, the server, notifications, sign out. |

Live data comes from the gateway's event stream (`/ws/events?token=`), with an 8-second poll behind it. When a new
approval appears or a task you were watching finishes, the phone shows a notification (while the app is open or
recently backgrounded; there is no push server). Tapping it opens the approval or the task.

## Signing in

- **Dev mode** (`MOSAIC_AUTH=dev`, the default): pick a person or type any email. Addresses at `@acme.example` join
  the demo org; Priya and Sam are invited ahead, so they sign in with their roles.
- **With a code** (both modes): in the console, open your name in the menu bar, then **Sign in on your phone**. Type the
  eight characters within five minutes. The phone gets a session of its own for the same person.

## Server address

| Where the phone is | Address |
|---|---|
| Android emulator on the same computer | `http://10.0.2.2:8089` (the default) |
| A phone on the laptop's hotspot or Wi-Fi | `http://<laptop IP>:8089`; `scripts\win\phone-access.ps1` (as administrator) opens the firewall and prints it |
| Over Tailscale | `https://<node>.<tailnet>.ts.net:8443` (see `infra/appliance/README.md`) |

The release build allows plain HTTP (`usesCleartextTraffic`) so it can reach a gateway on the local network.

## Develop

```bash
cd apps/mobile
npm ci
npm run typecheck
npx expo start          # Expo Go, or press a for the emulator
```

Against the mock gateway: `uv run mosaic-mock-gateway --port 8089` on the laptop.

## Build the APK

```powershell
powershell -File apps\mobile\scripts\build-apk.ps1                  # arm64 phones and the x86_64 emulator
powershell -File apps\mobile\scripts\build-apk.ps1 -Abis arm64-v8a  # phones only, smaller
```

The script uses Android Studio's JDK and SDK (`%LOCALAPPDATA%\Android\Sdk`), runs `expo prebuild` and
`gradlew assembleRelease`, and copies the result to `apps/mobile/dist/mosaic-<version>.apk`. The first build compiles
native code and takes a while; later ones are quick. The APK is signed with the debug key, which is fine for
sideloading and the demo but not for the Play Store. For the Play Store, make your own keystore and keep it out of the
repo (`*.jks` and `*.keystore` are ignored).

Install it on the running emulator or a phone with USB debugging:

```powershell
adb install -r apps\mobile\dist\mosaic-1.1.0.apk
```

`android/` is generated and ignored; `app.json` is the source of truth. The icons are drawn by
`scripts/make-icons.py` from the mOSaic mark.
