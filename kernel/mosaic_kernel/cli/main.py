"""ai-ps, ai-tree, ai-top, ai-kill, ai-audit, ai-checkpoint, ai-resume, ai-mount.

Talk to the gateway (MOSAIC_URL, default http://localhost:8080) — works against the mock gateway today.
Owner: P1.
"""
import os

import typer

app = typer.Typer(help="mOSaic process & knowledge CLI")
URL = os.getenv("MOSAIC_URL", "http://localhost:8080")


def _todo(name: str) -> None:
    typer.echo(f"{name}: not implemented yet (P1). Gateway: {URL}")
    raise typer.Exit(1)


@app.command("ps")
def ps_cmd(task_id: str | None = None) -> None:
    """PID  AGENT  STATE  TOKENS  GPU — GET /agents"""
    _todo("ai-ps")


@app.command("tree")
def tree_cmd(task_id: str | None = None) -> None:
    """Process tree — GET /agents/tree"""
    _todo("ai-tree")


@app.command("top")
def top_cmd() -> None:
    """Live resources — GET /system/resources + /ws/events (process.usage)"""
    _todo("ai-top")


@app.command("kill")
def kill_cmd(pid: int) -> None:
    _todo("ai-kill")


@app.command("audit")
def audit_cmd(task_id: str) -> None:
    _todo("ai-audit")


@app.command("checkpoint")
def checkpoint_cmd(pid: int) -> None:
    _todo("ai-checkpoint")


@app.command("resume")
def resume_cmd(pid: int) -> None:
    _todo("ai-resume")


@app.command("mount")
def mount_cmd(path: str = "/org") -> None:
    """Browse the knowledge filesystem — GET /knowledge/tree"""
    _todo("ai-mount")


def _single(cmd):
    def run() -> None:
        typer.run(cmd)
    return run


ps, tree, top, kill = _single(ps_cmd), _single(tree_cmd), _single(top_cmd), _single(kill_cmd)
audit, checkpoint, resume, mount = _single(audit_cmd), _single(checkpoint_cmd), _single(resume_cmd), _single(mount_cmd)
