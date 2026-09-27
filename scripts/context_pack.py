"""Build a single Markdown "context pack" for a team member's coding assistant.

For members WITHOUT Claude Code: paste/upload the generated file into ChatGPT / Gemini / Copilot Chat / Cursor
as the first message, then ask for one module at a time. (Claude Code users don't need this: CLAUDE.md +
CLAUDE.local.md load the same context automatically.)

    uv run python scripts/context_pack.py P3            # -> .context/P3-context.md
    uv run python scripts/context_pack.py P4 --lite     # smaller: skips full fakes/contracts source

Owner: P4 (keep the file lists below in sync when docs or interfaces move).
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
C = "shared/python/mosaic_contracts"

COMMON = [
    "AGENTS.md",
    "docs/MASTER_PLAN.md",
    "shared/README.md",
    f"{C}/schema/common.py",
    f"{C}/errors.py",
    f"{C}/util.py",
    f"{C}/wiring.py",
]

# "path" = whole file; "path::Header" = only the fakes.py section whose "# ====" header contains Header
PACKS: dict[str, list[str]] = {
    "P1": [
        "docs/team/P1-kernel-execution.md", "shared/services/P1-kernel-execution.md",
        *[f"{C}/interfaces/{m}.py" for m in ("kernel", "execution", "agents", "knowledge", "inference", "system")],
        *[f"{C}/schema/{m}.py" for m in ("task", "process", "syscall", "tools", "events", "audit", "policy", "system",
                                         "agents", "ipc", "inference", "knowledge", "memory")],
        f"{C}/api/mock_gateway.py", f"{C}/testing/contracts.py", f"{C}/testing/fakes.py",
        "shared/catalogs/events.yaml", "shared/catalogs/capabilities.yaml", "shared/catalogs/errors.yaml",
        "policies/default.yaml", "policies/project-updates-v1.yaml", "mosaicd/mosaicd/wiring.py",
        "kernel/mosaic_kernel/factory.py", "execution/mosaic_execution/factory.py", "tests/integration/test_e2e_apollo.py",
    ],
    "P2": [
        "docs/team/P2-knowledge-console.md", "shared/services/P2-knowledge-console.md",
        *[f"{C}/interfaces/{m}.py" for m in ("knowledge", "inference", "ingestion", "kernel")],
        *[f"{C}/schema/{m}.py" for m in ("knowledge", "memory", "events", "inference", "task", "process", "syscall", "audit")],
        f"{C}/testing/fakes.py::P2", f"{C}/testing/contracts.py", f"{C}/api/mock_gateway.py",
        "shared/catalogs/events.yaml", "shared/ts/src/constants.ts", "apps/web/lib/mosaic-client.ts",
        "knowledge/mosaic_knowledge/factory.py",
    ],
    "P3": [
        "docs/team/P3-agents-models.md", "shared/services/P3-agents-models.md",
        *[f"{C}/interfaces/{m}.py" for m in ("kernel", "agents", "inference")],
        *[f"{C}/schema/{m}.py" for m in ("agents", "inference", "syscall", "tools", "knowledge", "memory", "ipc", "process")],
        f"{C}/testing/fakes.py::P3", f"{C}/testing/fakes.py::AgentContext fake", f"{C}/testing/contracts.py",
        "agents/manifests/planner-agent.yaml", "agents/manifests/finance-agent.yaml", "agents/manifests/action-agent.yaml",
        "models/models.yaml", "shared/fixtures/okf/projects/apollo.md", "shared/fixtures/okf/finance/apollo-budget.md",
        "shared/fixtures/okf/engineering/apollo-status.md", "agents/mosaic_agents/factory.py", "models/mosaic_models/factory.py",
    ],
    "P4": [
        "docs/team/P4-platform-data-demo.md", "shared/services/P4-platform-data-demo.md",
        f"{C}/interfaces/ingestion.py", f"{C}/interfaces/execution.py", f"{C}/interfaces/system.py",
        f"{C}/schema/knowledge.py", f"{C}/schema/tools.py", f"{C}/schema/system.py",
        f"{C}/testing/fakes.py::P4: converters", "knowledge/tests/test_ingestion_contract.py", "execution/tests/test_browser_contract.py",
        "models/tests/test_probe_contract.py", "shared/fixtures/okf/projects/apollo.md", "shared/fixtures/okf/finance/apollo-budget.md",
        "infra/compose/docker-compose.yml", "infra/gpu/README.md", "infra/appliance/README.md", "data/okf/README.md",
        "docs/DEMO_SCRIPT.md",
    ],
}
LITE_SKIP = ("testing/contracts.py", "testing/fakes.py", "api/mock_gateway.py", "docs/MASTER_PLAN.md")


def _section(text: str, header: str) -> str:
    parts = re.split(r"(?m)^(# =+ .*)$", text)
    for i in range(1, len(parts), 2):
        if header in parts[i]:
            return parts[i] + parts[i + 1]
    raise SystemExit(f"section {header!r} not found")


def build(person: str, lite: bool) -> Path:
    out = [f"# mOSaic context pack for {person}\n",
           "Use this as the FIRST message to your coding assistant. Rules in AGENTS.md are hard constraints.\n"]
    for spec in COMMON + PACKS[person]:
        path, _, section = spec.partition("::")
        if lite and path.endswith(LITE_SKIP):
            continue
        f = ROOT / path
        if not f.exists():
            out.append(f"\n<!-- missing: {path} -->\n")
            continue
        text = f.read_text(encoding="utf-8")
        if section:
            text = _section(text, section)
        lang = {".py": "python", ".ts": "ts", ".yaml": "yaml", ".yml": "yaml", ".md": "markdown"}.get(f.suffix, "")
        label = f"{path} (section: {section})" if section else path
        out.append(f"\n---\n\n## FILE: {label}\n\n````{lang}\n{text.rstrip()}\n````\n")
    dest = ROOT / ".context" / f"{person}-context{'-lite' if lite else ''}.md"
    dest.parent.mkdir(exist_ok=True)
    dest.write_text("".join(out), encoding="utf-8", newline="\n")
    return dest


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("person", choices=sorted(PACKS))
    ap.add_argument("--lite", action="store_true", help="skip large reference files (for tools with small context)")
    a = ap.parse_args()
    dest = build(a.person, a.lite)
    size = dest.stat().st_size
    print(f"{dest.relative_to(ROOT)}  {size / 1024:.0f} KB  (~{size // 4 // 1000}k tokens)")


if __name__ == "__main__":
    main()
