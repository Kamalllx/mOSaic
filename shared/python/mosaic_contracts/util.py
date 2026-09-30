"""Shared semantics that MUST behave identically in every component.

Kernel policy (P1), knowledge scope filtering (P2) and the UI all decide "is X allowed" —
they use these helpers so the answer is the same everywhere.
"""
from __future__ import annotations

import re
from functools import lru_cache

from .schema.common import PRIVACY_ORDER, PrivacyLevel


@lru_cache(maxsize=1024)
def _glob_to_regex(glob: str) -> re.Pattern[str]:
    # "**" = any number of segments, "*" = within one segment
    out, i = [], 0
    while i < len(glob):
        if glob.startswith("/**", i):
            out.append(r"(/.*)?")
            i += 3
        elif glob.startswith("**", i):
            out.append(r".*")
            i += 2
        elif glob[i] == "*":
            out.append(r"[^/]*")
            i += 1
        else:
            out.append(re.escape(glob[i]))
            i += 1
    return re.compile("^" + "".join(out) + "/?$")


def path_matches(path: str, glob: str) -> bool:
    """path_matches("/org/finance/q3", "/org/finance/**") -> True. A bare prefix also matches its subtree."""
    if _glob_to_regex(glob).match(path):
        return True
    if "*" not in glob:
        base = glob.rstrip("/")
        return path == base or path.startswith(base + "/")
    return False


def path_allowed(path: str, allow: list[str], deny: list[str] | None = None) -> bool:
    """Deny wins over allow."""
    if deny and any(path_matches(path, g) for g in deny):
        return False
    return any(path_matches(path, g) for g in allow)


def capability_matches(capability: str, granted: str) -> bool:
    """capability_matches("jira.write", "jira.*") -> True; "*" alone grants everything (system only)."""
    if granted == "*":
        return True
    c, g = capability.split("."), granted.split(".")
    for i, seg in enumerate(g):
        if seg == "*":
            return i < len(c)
        if i >= len(c) or c[i] != seg:
            return False
    return len(c) == len(g)


# Capabilities whose catalog default is `approval: required` (shared/catalogs/capabilities.yaml; a test keeps them equal).
# A generated agent's policy requires approval for these whatever the org policy says: writes always need a person.
APPROVAL_REQUIRED: frozenset[str] = frozenset({
    "knowledge.write", "agent.retry", "jira.write", "browser.click", "browser.type", "sandbox.exec", "database.write",
    "external.email", "mcp.call",
})


def has_capability(capability: str, granted: list[str]) -> bool:
    return any(capability_matches(capability, g) for g in granted)


def privacy_allows(object_level: PrivacyLevel, principal_max: PrivacyLevel) -> bool:
    return PRIVACY_ORDER.index(object_level) <= PRIVACY_ORDER.index(principal_max)


def org_path_to_okf_file(path: str) -> str:
    """/org/projects/apollo -> projects/apollo.md ; /org/projects -> projects/index.md ; /org -> index.md

    Directory-vs-file ambiguity is resolved by the knowledge service; this is the canonical guess.
    """
    rel = path.removeprefix("/org").strip("/")
    return f"{rel}.md" if rel else "index.md"


def okf_file_to_org_path(okf_file: str) -> str:
    """projects/apollo.md -> /org/projects/apollo ; projects/index.md -> /org/projects"""
    rel = okf_file.replace("\\", "/").removesuffix(".md")
    if rel == "index":
        return "/org"
    rel = rel.removesuffix("/index")
    return f"/org/{rel}"


def estimate_tokens(text: str) -> int:
    """Cheap, model-agnostic estimate (≈4 chars/token). Use the same one everywhere for budgets."""
    return max(1, len(text) // 4)
