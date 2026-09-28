"""PlannerAgent — decomposes goals, delegates to specialists, synthesizes the final answer.

Owner: P3 — Agents & Models

Flow:
  1. Gather evidence via ctx.search
  2. Build a structured plan via ctx.llm (ask_json → PlanOut)
  3. Validate/filter plan steps (agents in manifest.capabilities.agents only)
  4. Fallback plan if LLM output is unusable
  5. Spawn specialists respecting depends_on (parallel where possible)
  6. Wait for specialists and collect results
  7. Synthesize via ctx.llm (ask_json → SynthesisOut)
  8. Write recovery-plan artifact via ctx.put_artifact
  9. Return AgentResult with structured output
"""
from __future__ import annotations

import logging
from typing import Any

from mosaic_contracts.schema import AgentResult, AgentResultStatus

from mosaic_agents.prompts import PlanOut, PlanStep, SynthesisOut
from mosaic_agents.sdk import MosaicAgent, ask_json, cite, gather_evidence

log = logging.getLogger("mosaic.agents.planner")

ALLOWED_AGENTS = ["finance-agent", "engineering-agent", "research-agent", "action-agent"]

DEFAULT_PLAN = [
    PlanStep(step_id="s1", agent="finance-agent", goal="Explain the Apollo budget variance with evidence"),
    PlanStep(step_id="s2", agent="engineering-agent", goal="Identify engineering causes of the schedule slip"),
    PlanStep(step_id="s3", agent="research-agent", goal="Collect vendor SDK context"),
    PlanStep(step_id="s4", agent="action-agent", goal="Record root causes on APOLLO-12", depends_on=["s1", "s2", "s3"]),
]

PLANNER_SYSTEM = """You are the Planner agent in mOSaic. Your job is to decompose a user goal into
a sequence of subtasks, each delegated to a specialist agent.

Available agents and their capabilities:
- finance-agent: analyzes budget, costs and variance using finance/project knowledge
- engineering-agent: identifies engineering blockers, schedule slips and technical root causes
- research-agent: gathers evidence from the knowledge base and (sandboxed) web pages
- action-agent: turns an approved plan into concrete tool actions (tracker updates, reports)

Rules:
1. Only use the agents listed above.
2. action-agent must depend on any agents whose output it needs.
3. Keep steps focused and concrete.
4. Every step must have a clear, measurable goal.
"""

SYNTHESIS_SYSTEM = """You are the Planner synthesizing findings from specialist agents.
Produce:
1. A list of root causes, each citing at least one /org path from the evidence.
2. A numbered recovery plan referencing the root causes.

NEVER fabricate citations. Only cite /org paths that actually appeared in the evidence.
"""


class PlannerAgent(MosaicAgent):
    """Orchestrates the Apollo investigation end-to-end."""

    async def run(self, goal: str, ctx: Any) -> AgentResult:
        await ctx.log("planner: starting", data={"goal": goal[:200]})

        # 1. Gather evidence
        evidence = await gather_evidence(ctx, goal, scope=["/org"], top_k=8)
        evidence_text = cite(evidence)
        await ctx.log(f"planner: gathered {len(evidence.hits)} evidence hits")

        if ctx.cancelled():
            return self.result(ctx, "cancelled before planning", status=AgentResultStatus.CANCELLED)

        # 2. Build plan via LLM
        allowed = list(ctx.manifest.capabilities.agents) or ALLOWED_AGENTS
        agent_list = "\n".join(f"- {a}" for a in allowed)
        user_prompt = (
            f"Goal: {goal}\n\n"
            f"Evidence:\n{evidence_text}\n\n"
            f"Available agents:\n{agent_list}\n\n"
            "Produce a plan as JSON with fields: rationale (string), steps (array of step objects).\n"
            "Each step: step_id (string), agent (string from the list above), goal (string), "
            "depends_on (array of step_ids that must complete first)."
        )

        plan_out = await ask_json(ctx, PLANNER_SYSTEM, user_prompt, PlanOut, max_tokens=1500)
        await ctx.log("planner: plan generated", data={"steps": len(plan_out.steps) if plan_out else 0})

        # 3. Validate plan steps
        steps = self._validate_steps(plan_out, allowed)

        # 4. Fallback plan
        if not steps:
            await ctx.log("planner: using fallback plan (LLM output unusable)")
            steps = [s for s in DEFAULT_PLAN if s.agent in allowed]

        await ctx.log(f"planner: executing {len(steps)} steps")

        # 5 & 6. Execute steps respecting depends_on (parallel where possible)
        upstream: dict[str, Any] = {}
        step_pids: dict[str, int] = {}

        # Topological execution: spawn all steps whose deps are complete
        completed_steps: set[str] = set()
        remaining = list(steps)

        while remaining:
            if ctx.cancelled():
                return self.result(ctx, "cancelled during execution", status=AgentResultStatus.CANCELLED)

            ready = [s for s in remaining if all(dep in completed_steps for dep in s.depends_on)]
            if not ready:
                await ctx.log("planner: no ready steps, dependency cycle or all done", data={"remaining": [s.step_id for s in remaining]})
                break

            # Spawn all ready steps in parallel
            for step in ready:
                remaining.remove(step)
                inputs = {"upstream": {k: upstream[k] for k in step.depends_on if k in upstream}}
                try:
                    pid = await ctx.spawn(step.agent, step.goal, inputs)
                    step_pids[step.step_id] = pid
                    await ctx.log(f"planner: spawned {step.agent} (step {step.step_id}) as pid {pid}")
                except Exception as e:
                    await ctx.log(f"planner: failed to spawn {step.agent}: {e}", level="warning")
                    completed_steps.add(step.step_id)  # skip this step

            # Wait for all spawned steps that haven't been waited on yet
            for step in [s for s in steps if s.step_id in step_pids and s.step_id not in completed_steps]:
                if step.step_id not in {s.step_id for s in remaining}:
                    pid = step_pids[step.step_id]
                    try:
                        result = await ctx.wait(pid)
                        upstream[step.step_id] = result.output
                        completed_steps.add(step.step_id)
                        await ctx.log(f"planner: step {step.step_id} ({step.agent}) completed: {result.status}")
                    except Exception as e:
                        await ctx.log(f"planner: wait for step {step.step_id} failed: {e}", level="warning")
                        upstream[step.step_id] = {}
                        completed_steps.add(step.step_id)

        # 7. Synthesize
        if ctx.cancelled():
            return self.result(ctx, "cancelled before synthesis", status=AgentResultStatus.CANCELLED)

        synthesis_prompt = (
            f"Goal: {goal}\n\n"
            f"Evidence from knowledge base:\n{evidence_text}\n\n"
            f"Specialist findings:\n{self._format_upstream(upstream)}\n\n"
            "Synthesize into: root_causes (list of {cause, evidence: [/org paths]}), "
            "recovery_plan (numbered steps), summary (brief)."
        )

        synthesis = await ask_json(ctx, SYNTHESIS_SYSTEM, synthesis_prompt, SynthesisOut, max_tokens=2000)
        await ctx.log("planner: synthesis complete")

        # 8. Write artifact
        recovery_md = self._make_recovery_md(goal, synthesis, upstream)
        artifact_ref = await ctx.put_artifact("recovery-plan.md", recovery_md.encode(), "text/markdown")
        await ctx.log(f"planner: wrote artifact {artifact_ref}")

        # 9. Return result
        root_causes = synthesis.root_causes if synthesis else []
        recovery_text = synthesis.recovery_plan if synthesis else ""
        summary = synthesis.summary if synthesis and synthesis.summary else f"Investigation complete for: {goal[:100]}"

        all_evidence = [h.path for h in evidence.hits]
        for out in upstream.values():
            if isinstance(out, dict):
                for d in out.get("drivers", []):
                    all_evidence.extend(d.get("evidence", []))
                for b in out.get("blockers", []):
                    all_evidence.extend(b.get("evidence", []))

        return AgentResult(
            pid=ctx.pid,
            agent=ctx.manifest.name,
            status=AgentResultStatus.COMPLETED,
            summary=summary,
            output={
                "root_causes": root_causes,
                "recovery_plan": recovery_text,
                "artifact": artifact_ref,
                "steps_executed": len(completed_steps),
            },
            evidence=sorted(set(all_evidence)),
            artifacts=[artifact_ref],
        )

    def _validate_steps(self, plan_out: PlanOut | None, allowed: list[str]) -> list[PlanStep]:
        """Filter plan steps to only those using allowed agents."""
        if not plan_out or not plan_out.steps:
            return []
        valid = []
        for s in plan_out.steps:
            if s.agent not in allowed:
                log.warning("dropping step %s: agent %s not in allowed list", s.step_id, s.agent)
                continue
            valid.append(s)
        return valid

    def _format_upstream(self, upstream: dict[str, Any]) -> str:
        lines = []
        for step_id, out in upstream.items():
            if isinstance(out, dict):
                lines.append(f"\nStep {step_id}:")
                for k, v in out.items():
                    lines.append(f"  {k}: {str(v)[:300]}")
        return "\n".join(lines) or "(no specialist findings)"

    def _make_recovery_md(self, goal: str, synthesis: SynthesisOut | None, upstream: dict) -> str:
        parts = [f"# Recovery Plan\n\n**Goal:** {goal}\n"]

        if synthesis and synthesis.root_causes:
            parts.append("\n## Root Causes\n")
            for i, rc in enumerate(synthesis.root_causes, 1):
                cause = rc.get("cause", str(rc))
                evidence = rc.get("evidence", [])
                ev_str = ", ".join(evidence) if evidence else "(no citations)"
                parts.append(f"{i}. **{cause}** — Evidence: {ev_str}")

        if synthesis and synthesis.recovery_plan:
            parts.append(f"\n## Recovery Steps\n\n{synthesis.recovery_plan}")

        parts.append("\n## Specialist Findings Summary\n")
        for step_id, out in upstream.items():
            if isinstance(out, dict) and out:
                parts.append(f"\n### Step {step_id}\n")
                parts.append(str(out)[:500])

        return "\n".join(parts)
