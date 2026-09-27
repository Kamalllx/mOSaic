# apps/mobile: phone thin client (P4 stretch S1; lives in P2's `apps/`)

Expo (SDK 57) app with three tabs:
- **Approvals:** polls `GET /approvals?status=pending` every 2 s. Each card shows the capability, arguments, evidence paths and policy, with Approve / Reject buttons (`POST /approvals/{id}/approve|reject`).
- **Compose:** `POST /tasks`, prefilled with the Apollo demo prompt.
- **Settings:** gateway URL and user/org headers, stored on the device.

Types and header names come from `@mosaic/contracts` (`shared/ts`). `metro.config.js` watches that folder.

```bash
cd apps/mobile
npm ci
npx expo start                  # scan the QR code with Expo Go (phone must be on Tailscale)
npm run typecheck
```

- **Develop without the node:** run `uv run mosaic-mock-gateway` on your laptop, then set the gateway URL to `http://<laptop-ip>:8080`. Plain HTTP works in Expo Go during development.
- **Demo:** use the node's Tailscale HTTPS URL, for example `https://<node>.<tailnet>.ts.net:8443`. See `infra/appliance/README.md` §5. Release builds block cleartext HTTP (iOS ATS, Android).
