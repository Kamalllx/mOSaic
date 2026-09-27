"""Source converters: raw organizational material -> OKF drafts (blueprint §15, "Parse / Clean / Classify / Generate").

Owner: P4 — Platform, Data & Demo (SourceConverters). P2 calls them from kfs.ingest()
Interface: mosaic_contracts.interfaces.SourceConverter  ·  Output: list[OKFDraft]
Converters are PURE: no file writes, no DB, no events. P2's ingest pipeline writes, validates, indexes.

TODO:
  - [ ] converters/markdown.py   — .md with or without frontmatter (fill type/title/description when missing)
  - [ ] converters/jira_json.py  — Jira JSON export -> one OKF file per epic/project + status summaries
  - [ ] converters/slack.py      — Slack export (channel/date json) -> one OKF "note" per thread/day, tagged
  - [ ] converters/csv_table.py  — CSV (budgets, rosters) -> OKF file with a Markdown table
  - [ ] converters/document.py   — pdf/docx via markitdown (optional extra `ingest`)
  - [ ] factory.build_converters() returns them in priority order
  - [ ] a sample file per converter in knowledge/tests/samples/ + SourceConverterContract test per converter
"""
