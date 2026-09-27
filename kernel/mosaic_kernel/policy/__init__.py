"""YAML policy engine over policies/*.yaml (PolicyDocument).

Owner: P1 — Kernel & Execution

TODO:
  - [ ] deny by default; tools allow/deny globs via mosaic_contracts.util.capability_matches
  - [ ] approval map: required / auto / never; risk >= high always requires approval
  - [ ] network constraints -> PolicyDecision.constraints['network_allow']
  - [ ] reload() on file change -> policy.updated
"""
