"""Docker SandboxManager (blueprint §30).

Owner: P1 — Kernel & Execution

TODO:
  - [ ] docker SDK: image mosaic/sandbox-base, cpu/memory limits, read-only root, no-new-privileges, seccomp default
  - [ ] network none by default; allowlist via egress proxy container; GPU via device_requests when spec.gpu
  - [ ] mount only the task workspace; timeout + guaranteed destroy; publish sandbox.started/destroyed
  - [ ] stretch: OpenShell / microVM backend behind the same interface
"""
