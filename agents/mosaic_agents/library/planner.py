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

from mosaic_agents.prompts import PlanOut, PlanStep, RootCausesOut, SynthesisOut
from mosaic_agents.sdk import MosaicAgent, ask_json, cite, gather_evidence, keep_retrieved

log = logging.getLogger("mosaic.agents.planner")

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
        allowed = list(ctx.manifest.capabilities.agents)  # the kernel would refuse any other spawn anyway
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
        steps = await self._validate_steps(ctx, plan_out.steps if plan_out else [], allowed)

        # 4. Fallback plan
        if not steps:
            await ctx.log("planner: using fallback plan (LLM output unusable)")
            steps = await self._validate_steps(ctx, [s.model_copy(deep=True) for s in DEFAULT_PLAN], allowed)

        await ctx.log(f"planner: executing {len(steps)} steps")

        # 5 & 6. Execute steps respecting depends_on (parallel where possible)
        upstream: dict[str, Any] = {}
        step_pids: dict[str, int] = {}
        retrieved = {h.path for h in evidence.hits}  # every /org path this task really retrieved (planner + specialists)

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
                        retrieved.update(p for p in result.evidence if isinstance(p, str))
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
        synthesis = synthesis or SynthesisOut()
        synthesis.root_causes = await self._backed(ctx, synthesis.root_causes, retrieved)
        if not synthesis.root_causes:
            # Small models often fail the full schema: retry once with just the root causes and compact findings
            await ctx.log("planner: synthesis had no cited root causes; retrying with a simpler schema", level="warning")
            retry = await ask_json(ctx, SYNTHESIS_SYSTEM, (
                f"Goal: {goal}\n\nSpecialist findings (with their /org evidence):\n{self._findings_text(upstream)}\n\n"
                "List the root causes as JSON: root_causes (list of {cause, evidence: [/org paths from the findings]})."),
                RootCausesOut, max_tokens=800)
            if retry:
                synthesis.root_causes = await self._backed(ctx, [rc.model_dump() for rc in retry.root_causes], retrieved)
        if not synthesis.root_causes:
            await ctx.log("planner: building root causes from the specialists' structured findings", level="warning")
            synthesis.root_causes = self._root_causes_from_findings(upstream)
        if not synthesis.recovery_plan:
            synthesis.recovery_plan = "\n".join(f"{i}. Address: {rc['cause']}" for i, rc in enumerate(synthesis.root_causes, 1))
        await ctx.log(f"planner: synthesis complete ({len(synthesis.root_causes)} root causes)")

        # 8. Write artifact
        recovery_md = self._make_recovery_md(goal, synthesis, upstream)
        artifact_ref = await ctx.put_artifact("recovery-plan.md", recovery_md.encode(), "text/markdown")
        await ctx.log(f"planner: wrote artifact {artifact_ref}")

        # 9. Return result
        root_causes = synthesis.root_causes
        recovery_text = synthesis.recovery_plan
        summary = synthesis.summary or (
            f"{len(root_causes)} root causes: " + "; ".join(rc["cause"] for rc in root_causes) if root_causes
            else f"Investigation complete for: {goal[:100]}")

        all_evidence = [h.path for h in evidence.hits]
        for out in upstream.values():
            if isinstance(out, dict):
                for d in out.get("drivers", []):
                    all_evidence.extend(d.get("evidence", []))
                for b in out.get("blockers", []):
                    all_evidence.extend(b.get("evidence", []))
        all_evidence = [p for p in all_evidence if p in retrieved]

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

    async def _validate_steps(self, ctx: Any, planned: list[PlanStep], allowed: list[str]) -> list[PlanStep]:
        """Make the LLM's plan executable: allowed agents only, unique step ids, exactly one action-agent step (one
        governed change, so one approval), and dependencies that exist. The action step runs after every specialist,
        whose findings it acts on."""
        steps: list[PlanStep] = []
        seen: set[str] = set()
        action: PlanStep | None = None
        for s in planned:
            if s.agent not in allowed:
                await ctx.log(f"planner: dropping step {s.step_id}: agent {s.agent} is not allowed", level="warning")
            elif s.step_id in seen:
                await ctx.log(f"planner: dropping step {s.step_id}: duplicate step id", level="warning")
            elif s.agent == "action-agent" and action is not None:
                await ctx.log(f"planner: dropping step {s.step_id}: only one action-agent step per plan", level="warning")
            else:
                seen.add(s.step_id)
                steps.append(s)
                action = s if s.agent == "action-agent" else action
        earlier: set[str] = set()  # depending only on earlier specialist steps keeps the plan acyclic
        for s in steps:
            if s is action:
                s.depends_on = [x.step_id for x in steps if x is not action]
            else:
                s.depends_on = [d for d in dict.fromkeys(s.depends_on) if d in earlier]
                earlier.add(s.step_id)
        return steps

    @staticmethod
    async def _backed(ctx: Any, root_causes: list[Any], retrieved: set[str]) -> list[dict[str, Any]]:
        """Root causes whose citations survive the retrieved-paths check; the others are dropped."""
        backed = []
        for rc in root_causes:
            if isinstance(rc, dict) and isinstance(rc.get("cause"), str) and rc["cause"].strip():
                rc = {**rc, "evidence": await keep_retrieved(ctx, rc.get("evidence", []), retrieved, "root_causes")}
                if rc["evidence"]:
                    backed.append(rc)
        return backed

    @staticmethod
    def _specialist_items(upstream: dict[str, Any]) -> list[tuple[str, list[str]]]:
        """(cause, evidence) from the specialists' structured outputs; their citations are already checked."""
        items: list[tuple[str, list[str]]] = []
        for out in upstream.values():
            if not isinstance(out, dict):
                continue
            for d in out.get("drivers", []):
                if isinstance(d, dict):
                    items.append((f"{d.get('item', 'cost driver')}: {d.get('cause', '')}".strip(": "), d.get("evidence", [])))
            for b in out.get("blockers", []):
                if isinstance(b, dict):
                    items.append((f"{b.get('issue', 'blocker')}: {b.get('cause', '')}".strip(": "), b.get("evidence", [])))
        return [(c, [p for p in ev if isinstance(p, str)]) for c, ev in items]

    def _findings_text(self, upstream: dict[str, Any]) -> str:
        return "\n".join(f"- {c} (evidence: {', '.join(ev) or 'none'})" for c, ev in self._specialist_items(upstream)) \
            or "(no specialist findings)"

    def _root_causes_from_findings(self, upstream: dict[str, Any]) -> list[dict[str, Any]]:
        causes: dict[str, list[str]] = {}
        for cause, ev in self._specialist_items(upstream):
            if ev and cause:
                causes[cause] = list(dict.fromkeys([*causes.get(cause, []), *ev]))
        return [{"cause": c, "evidence": ev} for c, ev in causes.items()]

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

        parts.append("\n## Root Causes\n")
        for i, rc in enumerate(synthesis.root_causes if synthesis else [], 1):
            parts.append(f"{i}. **{rc['cause']}** — Evidence: {', '.join(rc['evidence'])}")
        if not synthesis or not synthesis.root_causes:
            parts.append("No root cause could be backed by a retrieved document; see the specialist findings below.")

        if synthesis and synthesis.recovery_plan:
            parts.append(f"\n## Recovery Steps\n\n{synthesis.recovery_plan}")

        parts.append("\n## Specialist Findings Summary\n")
        for step_id, out in upstream.items():
            if isinstance(out, dict) and out:
                parts.append(f"\n### Step {step_id}\n")
                parts.append(str(out)[:500])

        return "\n".join(parts)
