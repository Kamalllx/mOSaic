"""YAML policy engine over policies/*.yaml (PolicyDocument).

Owner: P1 — Kernel & Execution

TODO:
  - [x] deny by default; tools allow/deny globs via mosaic_contracts.util.capability_matches
  - [x] approval map: required / auto / never; risk >= high always requires approval
  - [x] network constraints -> PolicyDecision.constraints['network_allow']
  - [ ] watch policies/ and call reload() on change (reload() itself publishes policy.updated)
"""
