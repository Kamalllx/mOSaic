# mOSaic OS: a Linux where /org is the organization's knowledge

The console is mOSaic as a desktop in the browser. **mOSaic OS** is mOSaic as an operating system you log into: a WSL
distro (Ubuntu 24.04) called `mosaic-os` on the same Windows machine as mosaicd. In it:

- `/org` is a real filesystem, served live by the gateway (FUSE). Every folder and document the agents see is there,
  as Markdown files with their frontmatter (trust, owner, source, version).
- `cp` a file into any folder under `/org` and it is converted, indexed and searchable by agents within seconds.
  Existing documents are read-only: knowledge changes through governed paths (uploads, mounts, connector sync), never by
  editing files in place.
- `mosaic mount ~/notes` keeps a folder of the machine in `/org/mnt/notes`: edits are re-ingested as you save, deleted
  files leave. It works for folders inside the distro (Windows reads them through `\\wsl.localhost\mosaic-os\...` and
  polls them) and for Windows folders (`/mnt/c/...`).
- `mosaic ask "..."` starts a task and prints the run as it happens: agents spawned, documents retrieved, tool calls,
  the approval it is waiting for, then the answer and its evidence.

It is separate from every other WSL distro on the machine; installing, re-provisioning or removing it touches only
`mosaic-os`.

## Install

```powershell
powershell -File scripts\wsl\install-mosaic-os.ps1              # create, or re-provision an existing one
powershell -File scripts\wsl\install-mosaic-os.ps1 -Reinstall   # delete mosaic-os and start over
```

The installer:
1. Downloads the Ubuntu 24.04 WSL root filesystem (about 350 MB, cached in `.data/wsl`) and checks its SHA-256.
2. Imports it as `mosaic-os` into `%LOCALAPPDATA%\mOSaic\wsl\mosaic-os`.
3. Runs `scripts/wsl/mosaic-os/provision.sh` as root. This installs `fuse3` and `python3-fusepy`, creates the user
   `mosaic`, installs `/opt/mosaic` (the gateway client and the filesystem), `/usr/local/bin/mosaic`, the
   `mosaic-orgfs` systemd service and the login banner. It also sets the hostname, systemd and the default user in
   `/etc/wsl.conf`.
4. Restarts the distro so `wsl.conf` applies.

apt's downloads go through `scripts/wsl/apt-proxy.py`, a relay on Windows that listens only on the WSL host address
while provisioning runs. Some networks (VPNs, phone hotspots) drop large packets on WSL's NAT path: connections open,
then big responses and TLS handshakes stall. Windows itself downloads fine, so apt goes through it. Changing the MTU
instead would affect every WSL distro, because they share one network.

## Use

```bash
wsl -d mosaic-os                      # or pick "mosaic-os" in Windows Terminal
```

```text
 ████  mOSaic OS  kernel 0.1.0 · contract 0.11.0
 ████  Alice · owner · Acme Corp  (dev headers)
       gateway http://172.19.208.1:8089 · /org is your organization's knowledge · `mosaic help`
```

| Command | What it does |
|---|---|
| `ls /org`, `cat /org/finance/apollo-budget.md` | Browse and read knowledge |
| `ls "/org/.search/apollo overrun"` | Hybrid search; the hits are links to the documents |
| `cat /org/.mosaic/status`, `cat /org/.mosaic/whoami` | The kernel's components; who this machine is signed in as |
| `cp notes.md /org/uploads/` | Add a document (any folder under /org works; `uploads` is always there) |
| `mosaic` | The banner: kernel, contract, who you are, the gateway |
| `mosaic login K7QM-4ZPD` | Sign in with a code from the console (user menu > Sign in on your phone) |
| `mosaic login --as priya@acme.example` | Dev sign-in |
| `mosaic ask "Why is Apollo over budget?"` | Start a task and watch it |
| `mosaic tasks`, `mosaic ps`, `mosaic approvals` | Recent tasks, the process table, what is waiting |
| `mosaic approve APR-…`, `mosaic reject APR-… -m "why"` | Decide (needs the approver role) |
| `mosaic search "PayCo contract"` | Search from the shell |
| `mosaic mount ~/notes [name]`, `mosaic mounts`, `mosaic unmount name` | Folders of this machine in /org/mnt |
| `mosaic upload a.pdf b.docx --to /org/uploads` | Upload without the filesystem |

Without `mosaic login`, requests carry the dev headers (alice), which the gateway accepts only when `MOSAIC_AUTH=dev`.
With `MOSAIC_AUTH=google`, sign in with a code first.

## How it finds the gateway

In order: `$MOSAIC_URL`, `MOSAIC_URL=` in `/etc/mosaic/env`, the address that worked last time
(`~/.config/mosaic/url`), `localhost:8089` and `:8080` (mirrored networking), then the Windows host (the WSL default
route) on the same ports. mosaicd listens on all interfaces, so the default NAT network reaches it. If the gateway is
down, `ls /org` fails with "Host is down" and the banner says how to start it.

## Files

| Path in the repo | Installed as |
|---|---|
| `scripts/wsl/install-mosaic-os.ps1` | (Windows) creates and provisions the distro |
| `scripts/wsl/apt-proxy.py` | (Windows) the relay for apt while provisioning |
| `scripts/wsl/mosaic-os/provision.sh` | run once per install, idempotent |
| `scripts/wsl/mosaic-os/mosaicos.py` | `/opt/mosaic/mosaicos.py`: the gateway client (standard library only) |
| `scripts/wsl/mosaic-os/orgfs.py` | `/opt/mosaic/orgfs.py`: the /org filesystem |
| `scripts/wsl/mosaic-os/mosaic` | `/usr/local/bin/mosaic` |
| `scripts/wsl/mosaic-os/mosaic-orgfs.service` | `/etc/systemd/system/`: mounts /org at boot, as root, files owned by `mosaic` |
| `scripts/wsl/mosaic-os/profile.sh` | `/etc/profile.d/zz-mosaic.sh`: the prompt and the banner |

To change the OS, edit these and run the installer again; it re-provisions in place.
