# mOSaic appliance (P4, with P1 for boot/recovery)

The blueprint's §4–5 as a checklist. Stock Ubuntu 24.04 LTS with mOSaic as the system authority in user space. **No custom Linux kernel.**

## Boot & persistence
- [ ] Ubuntu 24.04 autoinstall (`autoinstall.yaml`) with a separate ext4 partition mounted at `/sovereign-data` (`sovereign-data.mount`)
- [ ] Layout created at first boot: `okf/ raw/ indexes/ memory/ agents/ runs/ audit/ policies/ artifacts/`
- [ ] NVIDIA driver + NVIDIA Container Toolkit (see `../gpu/README.md`)
- [ ] Docker + compose; `mosaicd.service` enabled (see `../systemd/`)
- [ ] Boot splash / MOTD showing `ai-ps` and the gateway URL (nice demo touch)

## Recovery sequence (implemented by P1 in `mosaic_kernel.persistence`)
`mount data → validate state → restore OKF/indexes → restore memory metadata → restore process metadata → recover pending tasks → start services → READY (system.ready)`

## Network
- LAN/VPN only (Tailscale recommended); gateway on :8080
- Sandboxes on the internal `sandbox` network; egress only through the allowlist proxy
