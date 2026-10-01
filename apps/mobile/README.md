# apps/mobile: mOSaic on the phone

Expo SDK 57 app with Expo Router. The phone is a thin client: every task, agent and model runs on the mOSaic server. The phone signs in, starts tasks, watches them live, and approves what the kernel is blocking.

## Screens
| Tab | What it does | Gateway calls |
|---|---|---|
| Home | Running and recent tasks, live status | `GET /tasks` (3 s poll) |
| Approvals | Risk, capability, arguments, evidence paths, policy. Big Approve / Reject buttons at the bottom of each card, shown only if the role may resolve approvals | `GET /approvals?status=pending`, `POST /approvals/{id}/approve\|reject` |
| Compose | Prompt and priority; opens the task when it starts | `POST /tasks` |
| Knowledge | Hybrid search with scores, provenance, trust, and firewall flags | `GET /knowledge/search` |
| Settings | Server URL, account and permissions, org switcher, notifications, sign out | none |
| Task detail | Status, process tree (one avatar per agent), live timeline, result, cancel | `GET /tasks/{id}`, `GET /agents?task_id`, `WS /ws/events?task_id` |

Other behaviour:
- **Connection banner:** an offline or reconnecting banner comes from `/health`.
- **Polling:** it pauses in the background and refreshes as soon as the app returns.
- **Notifications:** a local notification fires for every new approval while the app is open or recently used (`expo-notifications`). Push notifications are not used.
- **Theme:** the light theme tokens live in `src/theme.ts`. Kamal's re-skin only changes values there.

## Sign-in and roles
- **Dev sign-in**, for `MOSAIC_AUTH=dev` and the mock gateway. You enter a user, an org and a role. Requests carry `X-Mosaic-User`, `X-Mosaic-Org` and `X-Mosaic-Roles`.
- **Google sign-in** (`@react-native-google-signin/google-signin`):
  1. The app gets a Google ID token.
  2. It exchanges the token at Person C's `POST /auth/google`.
  3. It then uses `Authorization: Bearer <token>`, reads `GET /auth/me`, and passes the token to the WebSocket as `?token=`.

  The button appears only in the APK or a development build (it is native code, so not in Expo Go), and only when this is set at build time:
  ```
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<the WEB OAuth client ID>
  ```
  Use the **web** client ID: it is the audience the gateway verifies. The **Android** client ID must also exist in the same Google Cloud project, registered with the package `com.mosaic.mobile` and the SHA-1 of the signing key (`cd android && ./gradlew signingReport`). Person C creates both IDs (`docs/AUTH.md`). For iOS, add the plugin to `app.json` with `iosUrlScheme`.
- **Roles:** `src/rbac.ts` mirrors the role table (owner, admin, approver, member, viewer) and hides actions the role cannot use. The server stays the authority. When `/auth/me` returns explicit permissions, those win.

## Run it
```bash
cd apps/mobile
npm ci
npm run typecheck
uv run mosaic-mock-gateway --port 8080        # from the repo root: a full Apollo run, no GPU needed
```
| Where | Command | Server URL in the app |
|---|---|---|
| Web (quick check) | `npx expo start --web` | `http://localhost:8080` |
| Expo Go on a phone | `npx expo start`, scan the QR code | `http://<laptop-ip>:8080` |
| Android emulator | `npx expo run:android` (needs Android Studio and an AVD) | `http://10.0.2.2:8080`, the host machine as seen from the emulator (the default) |
| Real phone over USB | enable USB debugging, then `npx expo run:android --device` | `http://<laptop-ip>:8089` on hotspot or LAN |
| Over Tailscale | phone on the tailnet | `https://<node>.<tailnet>.ts.net:8443` (see `infra/appliance/README.md`) |

On Windows, `scripts\win\phone-access.ps1` opens the firewall for hotspot use. The release build allows cleartext HTTP (`expo-build-properties`, `usesCleartextTraffic`), so LAN and hotspot URLs work without TLS.

## Build the APK
```bash
cd apps/mobile
npx expo prebuild --platform android --clean     # generates android/ (git-ignored)
echo "sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk" > android/local.properties   # if ANDROID_HOME is unset
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64
# -> android/app/build/outputs/apk/release/app-release.apk; copy it to mosaic-<version>.apk
```
- Build with JDK 17 or 21 and the Android SDK from Android Studio.
- **Windows pitfalls** (all hit on a team laptop):
  - **Don't build inside OneDrive.** The native step fails with `ninja: error: manifest 'build.ninja' still dirty after 100 tries`, because OneDrive rewrites file timestamps. Copy `apps/mobile` and `shared/ts` to a short local path (for example `C:\mb\apps\mobile` and `C:\mb\shared\ts`), run `npm ci` there, and build there.
  - **NDK error** `[CXX1101] NDK at ...\ndk\27.1.12297006 did not have a source.properties file`: that NDK install is incomplete. Reinstall it in Android Studio's SDK Manager, or add `ext { ndkVersion = "<installed version>" }` at the top of `buildscript` in `android/build.gradle`.
  - **Gradle download times out in Java while `curl` works:** set `JAVA_TOOL_OPTIONS=-Djava.net.preferIPv4Stack=true`.
  - **Low RAM:** add `--max-workers=2 "-Dorg.gradle.jvmargs=-Xmx2048m"` to the Gradle command. A first build takes about 18 minutes.
- **Install on a phone over USB:** `adb install -r mosaic-1.0.0.apk`. To reach a gateway on the laptop without Wi-Fi, run `adb reverse tcp:8081 tcp:8081` and use `http://localhost:8081` in the app. Tested on a moto g54 5G running Android 15: sign-in, live task timeline over the WebSocket, the approval notification, and approve from the phone.
- **Architectures:** `arm64-v8a` covers modern phones and `x86_64` covers the emulator. Leaving out 32-bit halves the build time.
- **Signing:** as generated, the release APK is signed with the debug keystore. That is fine for side-loading at a hackathon, but not for the Play Store. For a real release key:
  1. Create a keystore **outside the repo**, for example `%USERPROFILE%\.mosaic\mosaic-release.jks`, with `keytool -genkeypair -v -keystore mosaic-release.jks -alias mosaic -keyalg RSA -keysize 2048 -validity 10000`.
  2. Put `MOSAIC_UPLOAD_STORE_FILE`, `MOSAIC_UPLOAD_KEY_ALIAS` and the two passwords in `%USERPROFILE%\.gradle\gradle.properties`.
  3. Point `signingConfigs.release` in `android/app/build.gradle` at them.

  Never commit the keystore or passwords.
- **Alternative:** EAS Build (`eas build -p android --profile preview`), if the team has an Expo account.

## Checks before a commit
`npm run typecheck`, then `npx expo-doctor` (expected 21/21), then `npx expo export --platform android` to confirm Metro bundles.
