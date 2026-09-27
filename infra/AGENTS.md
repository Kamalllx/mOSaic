# infra/ — owner P4 (Platform). Brief: docs/team/P4-platform-data-demo.md
- compose/: service definitions; each block's comment names who owns the service logic. Keep dev (host mosaicd) and appliance (profile) paths working.
- Never bake secrets into images or compose files; use .env (gitignored).
