# mOSaic appliance (P4, with P1 for boot/recovery)

The RTX laptop is the **mOSaic node**: every agent, model, sandbox and browser runs on it. Teammates' laptops and phones are thin clients. They open the console over Tailscale, send a goal, and watch or approve.
The node is stock Ubuntu 24.04 LTS, with mOSaic as the system authority in user space. **No custom Linux kernel.**

## 1. Install Ubuntu (manual)
- Use the latest **24.04.x** point-release ISO. It ships the HWE kernel, which new laptop Wi-Fi and iGPUs need.
- Manual partitioning: root ext4 (≥ 100 GB) plus a **separate ext4 partition of about 150 GB for `/sovereign-data`**. After install, add that partition to `/etc/fstab` by UUID:
  ```
  UUID=<uuid-from-blkid>  /sovereign-data  ext4  defaults,noatime  0 2
  ```
  systemd generates `sovereign-data.mount` from fstab. `mosaicd.service` requires that unit.
- Install the NVIDIA driver: see [`../gpu/README.md`](../gpu/README.md) §1.

## 2. Run the installer
```bash
git clone https://github.com/Kamalllx/mOSaic /tmp/mosaic
sudo bash /tmp/mosaic/infra/appliance/install.sh     # idempotent; re-run after fixing any failure
sudo tailscale up
# build + enable the web console once the node's Tailscale name is known (baked into the Next.js build)
sudo MOSAIC_PUBLIC_URL=http://<node>.<tailnet>.ts.net:8080 bash /opt/mosaic/infra/appliance/install.sh
bash /opt/mosaic/scripts/preflight.sh
```
The installer:
- installs Docker + the compose plugin and the NVIDIA Container Toolkit;
- creates the `mosaic` user and the `/sovereign-data/{okf,raw,indexes,memory,agents,runs,audit,policies,artifacts}` layout;
- sets up the repo and venv in `/opt/mosaic` and creates `.env` (`MOSAIC_DATA_DIR=/sovereign-data`, `MOSAIC_OKF_DIR=./data/okf`, `MOSAIC_DEFAULT_MODE=real`);
- starts the compose services, pulls the models and builds both sandbox images;
- builds the web console;
- installs and enables `mosaicd.service` + `mosaic-web.service`;
- applies laptop-as-server hardening, sets up Tailscale + ufw and installs the MOTD.

## 3. Boot sequence
`sovereign-data.mount` → `docker.service` → `mosaicd.service`
- ExecStartPre: `compose up -d --wait postgres redis ollama mock-jira vendor-docs`.
- ExecStart: mosaicd, which recovers state (P1) and publishes `system.ready`.

After that, `mosaic-web.service` starts the console on :3000.
**Acceptance:** after a cold boot with the lid closed, `curl http://<node>:8080/system/status` returns `ready: true`.

mosaicd runs on the host, not in the compose `appliance` profile, for three reasons:
- it needs the Docker socket for sandboxes;
- it needs `nvidia-smi` for the resource probe;
- it needs a route to sandbox container IPs on the internal `mosaic_sandbox` network.

## 4. Laptop-as-server
- Lid close is ignored (`/etc/systemd/logind.conf.d/mosaic.conf`). Sleep, suspend and hibernate are masked.
- The power profile is set to `performance`. Keep the charger plugged in.
- `unattended-upgrades` is disabled and NVIDIA packages are held for the event.

## 5. Network
- Clients reach the node only through Tailscale. ufw denies all incoming traffic except SSH and `tailscale0`.
- The console is on `http://<node>:3000` and the gateway on `http://<node>:8080`.
- Docker services publish on `127.0.0.1` only, because Docker-published ports bypass ufw.
- For HTTPS (needed by the mobile app, since iOS ATS and Android block cleartext), enable MagicDNS + HTTPS in the tailnet admin, then run:
  ```bash
  sudo tailscale serve --bg --https=443  http://127.0.0.1:3000
  sudo tailscale serve --bg --https=8443 http://127.0.0.1:8080
  ```
- If the venue Wi-Fi blocks Tailscale's UDP, Tailscale falls back to DERP relays (slower). The last resort is a phone hotspot shared by the node and the clients.
- Sandboxes attach to the internal `sandbox` network (`mosaic_sandbox`), which has no route to the internet. `vendor-docs` is only reachable from there.

## 6. Recovery sequence (implemented by P1 in `mosaic_kernel.persistence`)
`mount data → validate state → restore OKF/indexes → restore memory metadata → restore process metadata → recover pending tasks → start services → READY (system.ready)`
