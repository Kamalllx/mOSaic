"""`github` tool backend: read repos/issues/PRs, create issues and comments.

Tokens are stored in the token vault (vault.py) per-org, never logged or sent to agents.
github_token="inprocess" runs the mock in dev mode.
"""
from __future__ import annotations

from typing import Any

import httpx
from mosaic_contracts.errors import MosaicError
from mosaic_contracts.schema import (
    Risk,
    ToolInvocation,
    ToolOperation,
    ToolResult,
    ToolResultStatus,
    ToolSpec,
    ToolTransport,
    VerificationCheck,
    VerificationResult,
)

from ..tools.base import err, ok, require, status_check, token

SPEC = ToolSpec(
    name="github",
    description="GitHub REST API (repos, issues, PRs, comments). "
                "github.read is read-only; github.write creates issues and comments and requires approval.",
    transport=ToolTransport.HTTP,
    operations=[
        ToolOperation(
            name="list_repos",
            capability="github.read",
            description="List repositories for the authenticated user or org",
            input_schema={"type": "object", "properties": {"org": {"type": "string"}}},
        ),
        ToolOperation(
            name="get_issue",
            capability="github.read",
            description="Read a GitHub issue",
            input_schema={
                "type": "object",
                "required": ["owner", "repo", "number"],
                "properties": {
                    "owner": {"type": "string"},
                    "repo": {"type": "string"},
                    "number": {"type": "integer"},
                },
            },
        ),
        ToolOperation(
            name="list_issues",
            capability="github.read",
            description="List issues for a repository",
            input_schema={
                "type": "object",
                "required": ["owner", "repo"],
                "properties": {
                    "owner": {"type": "string"},
                    "repo": {"type": "string"},
                    "state": {"type": "string", "enum": ["open", "closed", "all"]},
                },
            },
        ),
        ToolOperation(
            name="get_file",
            capability="github.read",
            description="Read a file from a repository",
            input_schema={
                "type": "object",
                "required": ["owner", "repo", "path"],
                "properties": {
                    "owner": {"type": "string"},
                    "repo": {"type": "string"},
                    "path": {"type": "string"},
                    "ref": {"type": "string"},
                },
            },
        ),
        ToolOperation(
            name="create_issue",
            capability="github.write",
            description="Create a new issue",
            input_schema={
                "type": "object",
                "required": ["owner", "repo", "title"],
                "properties": {
                    "owner": {"type": "string"},
                    "repo": {"type": "string"},
                    "title": {"type": "string"},
                    "body": {"type": "string"},
                    "labels": {"type": "array", "items": {"type": "string"}},
                },
            },
            risk=Risk.MEDIUM,
            reversible=False,
        ),
        ToolOperation(
            name="create_comment",
            capability="github.write",
            description="Add a comment to an issue or PR",
            input_schema={
                "type": "object",
                "required": ["owner", "repo", "number", "body"],
                "properties": {
                    "owner": {"type": "string"},
                    "repo": {"type": "string"},
                    "number": {"type": "integer"},
                    "body": {"type": "string"},
                },
            },
            risk=Risk.MEDIUM,
            reversible=True,
        ),
    ],
)


class GitHubBackend:
    name = "github"

    def __init__(self, token_or_mode: str = "inprocess") -> None:
        if token_or_mode == "inprocess":
            # Dev mode: use a mock transport that returns plausible data
            transport = _MockTransport()
            base_url = "https://api.github.com"
        else:
            transport = None
            base_url = "https://api.github.com"
        self.client = httpx.AsyncClient(
            base_url=base_url,
            transport=transport,
            headers={"Authorization": f"Bearer {token_or_mode}", "Accept": "application/vnd.github+json"},
            timeout=15,
        )
        self._undo: dict[str, dict[str, Any]] = {}

    def spec(self) -> ToolSpec:
        return SPEC

    async def execute(self, inv: ToolInvocation) -> ToolResult:
        a = inv.arguments
        try:
            if inv.operation == "list_repos":
                org = a.get("org")
                path = f"/orgs/{org}/repos" if org else "/user/repos"
                r = await self.client.get(path, params={"per_page": 20})
                r.raise_for_status()
                repos = [{"name": rp["name"], "full_name": rp["full_name"], "description": rp.get("description"),
                          "open_issues": rp.get("open_issues_count", 0)} for rp in r.json()]
                return ok(inv, {"repos": repos})

            if inv.operation == "get_issue":
                require(a, "owner", "repo", "number")
                r = await self.client.get(f"/repos/{a['owner']}/{a['repo']}/issues/{a['number']}")
                if r.status_code == 404:
                    raise MosaicError("NOT_FOUND", f"issue #{a['number']}")
                r.raise_for_status()
                return ok(inv, _flatten_issue(r.json()))

            if inv.operation == "list_issues":
                require(a, "owner", "repo")
                r = await self.client.get(f"/repos/{a['owner']}/{a['repo']}/issues",
                                          params={"state": a.get("state", "open"), "per_page": 20})
                r.raise_for_status()
                return ok(inv, {"issues": [_flatten_issue(i) for i in r.json()]})

            if inv.operation == "get_file":
                require(a, "owner", "repo", "path")
                params = {"ref": a["ref"]} if a.get("ref") else {}
                r = await self.client.get(f"/repos/{a['owner']}/{a['repo']}/contents/{a['path']}", params=params)
                if r.status_code == 404:
                    raise MosaicError("NOT_FOUND", f"{a['path']}")
                r.raise_for_status()
                body = r.json()
                import base64
                content = base64.b64decode(body.get("content", "")).decode("utf-8", errors="replace") if body.get("encoding") == "base64" else ""
                return ok(inv, {"path": body["path"], "sha": body["sha"], "content": content})

            if inv.operation == "create_issue":
                require(a, "owner", "repo", "title")
                payload: dict[str, Any] = {"title": a["title"]}
                if a.get("body"):
                    payload["body"] = a["body"]
                if a.get("labels"):
                    payload["labels"] = a["labels"]
                r = await self.client.post(f"/repos/{a['owner']}/{a['repo']}/issues", json=payload)
                r.raise_for_status()
                return ok(inv, _flatten_issue(r.json()))

            if inv.operation == "create_comment":
                require(a, "owner", "repo", "number", "body")
                r = await self.client.post(f"/repos/{a['owner']}/{a['repo']}/issues/{a['number']}/comments",
                                           json={"body": a["body"]})
                r.raise_for_status()
                comment = r.json()
                rb = token()
                self._undo[rb] = {"owner": a["owner"], "repo": a["repo"], "comment_id": comment["id"]}
                return ok(inv, {"id": comment["id"], "body": comment["body"]}, rollback_token=rb)

            return err(inv, "NOT_FOUND", f"unknown github operation {inv.operation}")
        except MosaicError as e:
            return err(inv, e.code, e.message)
        except httpx.HTTPError as e:
            return err(inv, "TOOL_FAILED", f"github request failed: {e}")

    async def verify(self, inv: ToolInvocation, result: ToolResult) -> VerificationResult:
        if result.status != ToolResultStatus.SUCCESS or inv.operation != "create_comment":
            return status_check(inv, result)
        # Re-read the comment to verify it exists
        undo = self._undo.get(result.rollback_token or "")
        if not undo:
            return status_check(inv, result)
        try:
            r = await self.client.get(f"/repos/{undo['owner']}/{undo['repo']}/issues/comments/{undo['comment_id']}")
            exists = r.status_code == 200
            return status_check(inv, result, [VerificationCheck(name="comment_exists", passed=exists)])
        except httpx.HTTPError as e:
            return status_check(inv, result, [VerificationCheck(name="comment_exists", passed=False, detail=str(e))])

    async def rollback(self, inv: ToolInvocation, result: ToolResult) -> bool:
        undo = self._undo.pop(result.rollback_token or "", None)
        if undo is None:
            return False
        try:
            r = await self.client.delete(f"/repos/{undo['owner']}/{undo['repo']}/issues/comments/{undo['comment_id']}")
            return r.status_code in (204, 404)
        except httpx.HTTPError:
            return False


def _flatten_issue(i: dict[str, Any]) -> dict[str, Any]:
    return {
        "number": i["number"],
        "title": i["title"],
        "state": i["state"],
        "body": i.get("body"),
        "html_url": i.get("html_url"),
        "labels": [lb["name"] for lb in i.get("labels", [])],
        "assignee": (i.get("assignee") or {}).get("login"),
        "created_at": i.get("created_at"),
    }


class _MockTransport(httpx.AsyncBaseTransport):
    """In-process mock for dev/demo: returns plausible data without hitting GitHub."""

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        import json as _json
        path = request.url.path
        if "/repos/" in path and path.endswith("/issues"):
            return httpx.Response(200, json=[
                {"number": 1, "title": "Demo issue", "state": "open", "body": "Created by mOSaic demo.",
                 "html_url": "https://github.com/demo/repo/issues/1", "labels": [], "assignee": None,
                 "created_at": "2024-03-01T00:00:00Z"},
            ])
        if "/repos" in path and "/issues/" in path and request.method == "POST" and "comments" not in path:
            return httpx.Response(201, json={"number": 99, "title": "New issue", "state": "open", "body": "",
                                             "html_url": "https://github.com/demo/repo/issues/99", "labels": [],
                                             "assignee": None, "created_at": "2024-03-01T00:00:00Z"})
        if "comments" in path and request.method == "POST":
            return httpx.Response(201, json={"id": 12345, "body": _json.loads(request.content).get("body", "")})
        if "comments" in path and request.method == "DELETE":
            return httpx.Response(204)
        if "/user/repos" in path or "/orgs/" in path and "repos" in path:
            return httpx.Response(200, json=[
                {"name": "demo-repo", "full_name": "demo-org/demo-repo",
                 "description": "The mOSaic demo repository", "open_issues_count": 3},
            ])
        if "/contents/" in path:
            import base64 as _b64
            content = _b64.b64encode(b"# Mock file\n\nThis is a mock file from the dev transport.").decode()
            return httpx.Response(200, json={"path": path.split("/contents/")[-1], "sha": "abc123",
                                             "encoding": "base64", "content": content})
        return httpx.Response(404, json={"message": "Not Found"})
