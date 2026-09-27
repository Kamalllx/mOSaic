"""The agents themselves: planner, finance, engineering, research, action.

Owner: P3 — Agents & Models

TODO:
  - [ ] planner: goal -> Plan (json_schema), spawn per step respecting depends_on, wait, synthesize, recovery plan artifact
  - [ ] finance: variance analysis with citations; engineering: blockers/slip root causes
  - [ ] research: evidence gathering incl. sandboxed browser.open syscall
  - [ ] action: turn findings into jira.update_issue syscalls (approval path!) + write report via fs.write
"""
