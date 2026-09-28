"""Structured output schemas for P3 agents.

These Pydantic models define the JSON contracts between agents.
They live in prompts/ because they are tightly coupled to the prompt templates.

Owner: P3 — Agents & Models
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PlanStep(BaseModel):
    """A single step in the planner's execution plan."""

    step_id: str
    agent: str
    goal: str
    depends_on: list[str] = Field(default_factory=list)


class PlanOut(BaseModel):
    """The planner's structured output from its planning call."""

    rationale: str = ""
    steps: list[PlanStep] = Field(default_factory=list)


class SynthesisOut(BaseModel):
    """The planner's structured synthesis output."""

    root_causes: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Each: {cause: str, evidence: [/org paths]}",
    )
    recovery_plan: str = Field(
        default="",
        description="Numbered recovery steps referencing the root causes",
    )
    summary: str = ""


class FinanceOut(BaseModel):
    """Finance agent structured output."""

    overrun_lakh: float = 0.0
    overrun_pct: float = 0.0
    drivers: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Each: {item, delta, cause, evidence: [/org paths]}",
    )
    summary: str = ""


class EngOut(BaseModel):
    """Engineering agent structured output."""

    slip_weeks: int = 0
    blockers: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Each: {issue, cause, evidence: [/org paths]}",
    )
    summary: str = ""


class ResearchOut(BaseModel):
    """Research agent structured output."""

    findings: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Each: {claim, source}",
    )
    urls_opened: list[str] = Field(default_factory=list)
    summary: str = ""


__all__ = ["PlanStep", "PlanOut", "SynthesisOut", "FinanceOut", "EngOut", "ResearchOut"]
