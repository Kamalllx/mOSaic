"""OKF bundle I/O: parse/serialize Markdown + YAML frontmatter, resolve links, map /org paths <-> files.

Owner: P2 — Knowledge, Memory & Console

TODO:
  - [ ] loader over settings.okf_dir using mosaic_contracts.util.okf_file_to_org_path
  - [ ] writer that preserves unknown frontmatter keys (OKF is extensible)
  - [ ] git-backed versioning: content_hash + version, diffable changes
"""
