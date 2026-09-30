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
import re
from typing import Any

from mosaic_contracts.errors import MosaicError
from mosaic_contracts.schema import AgentPlanned, AgentResult, AgentResultStatus, ErrorInfo, TaskUnderstood

from mosaic_agents.prompts import PlanOut, PlanStep, RootCausesOut, SynthesisOut
from mosaic_agents.sdk import (
    DEFAULT_PROJECT,
    MosaicAgent,
    ask_json,
    cite,
    gather_evidence,
    keep_retrieved,
    narrate,
    plural,
    project_of,
    think,
    think_flagged,
    tracking_issue,
)

log = logging.getLogger("mosaic.agents.planner")


def default_plan(project: str) -> list[PlanStep]:
    """The plan used when the model's is unusable."""
    vendor = "Collect vendor SDK context" if project == DEFAULT_PROJECT else f"Collect vendor context for Project {project}"
    return [
        PlanStep(step_id="s1", agent="finance-agent", goal=f"Explain the {project} budget variance with evidence"),
        PlanStep(step_id="s2", agent="engineering-agent", goal="Identify engineering causes of the schedule slip"),
        PlanStep(step_id="s3", agent="research-agent", goal=vendor),
        PlanStep(step_id="s4", agent="action-agent", goal=f"Record root causes on {tracking_issue(project)}",
                 depends_on=["s1", "s2", "s3"]),
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
1. The three most important root causes (at most three), each citing at least one /org path from the evidence.
   Each must be a distinct cause, not a restatement of the symptoms in the goal (being over budget or late).
2. A recovery plan: a list of concrete steps, each addressing one of the root causes.
3. A summary of two or three sentences.

NEVER fabricate citations. Only cite /org paths that actually appeared in the evidence.
"""

ACTION_AGENT = "action-agent"

# The plan for each role (agent.planned, and the bounds it is spawned with): why it is on the plan, its /org scope and
# its capabilities. The kernel generates the agent from its role template within these bounds. Mirrors
# agents/manifests/*.yaml (a test keeps them equal): the planner reaches the templates only through ctx.spawn.
SPECIALIST_ROLES: dict[str, tuple[str, list[str], list[str]]] = {
    "finance-agent": ("Explains the budget variance and its cost drivers with evidence",
                      ["/org/finance", "/org/projects", "/org/policies"], ["knowledge.read", "knowledge.search", "jira.read"]),
    "engineering-agent": ("Finds the engineering blockers behind the schedule slip",
                          ["/org/engineering", "/org/projects", "/org/systems", "/org/decisions"],
                          ["knowledge.read", "knowledge.search", "jira.read"]),
    "research-agent": ("Brings in vendor context from the knowledge base and the vendor's docs",
                       ["/org"], ["knowledge.read", "knowledge.search", "browser.open"]),
    ACTION_AGENT: ("Records the root causes on the tracker once they are known; a person approves the write",
                   ["/org/projects"], ["knowledge.read", "knowledge.search", "jira.read", "jira.write", "fs.write"]),
    "analyst": ("Answers the question from cited evidence across /org", ["/org"],
                ["knowledge.read", "knowledge.search", "agent.spawn"]),
    "data-engineer": ("Finds the exact figures the question needs in finance and project records",
                      ["/org/finance", "/org/projects"], ["knowledge.read", "knowledge.search"]),
    "writer": ("Drafts the note the goal asks for from the findings; sending it needs a person",
               ["/org/projects", "/org/finance"], ["knowledge.read", "knowledge.search", "fs.write"]),
}

# The library specialists are always offered to the model; the other role templates only when the goal asks for what
# they do (their manifest handles; a test keeps these equal). So the planning prompt for Apollo and Zeus is exactly what
# it was before dynamic agents.
LIBRARY_ROLES = ("finance-agent", "engineering-agent", "research-agent", ACTION_AGENT)
EXTRA_HANDLES: dict[str, tuple[str, ...]] = {
    "analyst": ("analyst", "analyse", "analyze", "compare", "comparison", "trend"),
    "data-engineer": ("sql", "database", "query", "invoice", "invoices", "paid", "payments", "vendors", "spreadsheet"),
    "writer": ("draft", "note", "memo", "email", "letter"),
}


def offered_roles(goal: str, allowed: list[str]) -> list[str]:
    words = set(re.findall(r"[a-z]+", goal.lower()))
    return [a for a in allowed if a in LIBRARY_ROLES or words & set(EXTRA_HANDLES.get(a, ()))]


def _and(names: list[str]) -> str:
    return names[0] if len(names) == 1 else f"{', '.join(names[:-1])} and {names[-1]}"


def understood(goal: str, project: str, steps: list[PlanStep]) -> TaskUnderstood:
    """task.understood, written by code from the goal and the validated plan (never from the model's rationale)."""
    first = re.split(r"(?<=[.!?])\s", goal.strip(), maxsplit=1)[0]
    caps = dict.fromkeys(c for s in steps for c in SPECIALIST_ROLES.get(s.agent, ("", [], []))[2])
    specialists = [s.agent for s in steps if s.agent != ACTION_AGENT]
    summary = f"{_and(specialists)} investigate{'s' if len(specialists) == 1 else ' in parallel'}" if specialists else "No specialists"
    if any(s.agent == ACTION_AGENT for s in steps):
        summary += f"; {ACTION_AGENT} then records the root causes on {tracking_issue(project)}"
    return TaskUnderstood(intent=first[:240], entities=[f"Project {project}", tracking_issue(project)],
                          capabilities_needed=list(caps)[:20], plan_summary=f"{summary}."[:240])


def execution_order(steps: list[PlanStep]) -> list[PlanStep]:
    """The steps in the order run() spawns them: rounds of ready steps, each round in plan order."""
    done: set[str] = set()
    order: list[PlanStep] = []
    remaining = list(steps)
    while remaining:
        ready = [s for s in remaining if all(d in done for d in s.depends_on)] or remaining  # a cycle ends run() too
        order += ready
        done.update(s.step_id for s in ready)
        remaining = [s for s in remaining if s not in ready]
    return order


def planned(step: PlanStep) -> AgentPlanned:
    why, scope, caps = SPECIALIST_ROLES.get(step.agent, (f"Assigned by the plan as step {step.step_id}", [], []))
    return AgentPlanned(role=step.agent, why=why, scope=scope, capabilities=caps)
# What each library specialist's findings are in: research counts when it opened a page even if it listed no findings.
_FINDINGS_KEYS = ("drivers", "blockers", "findings", "urls_opened")


def _has_findings(output: Any) -> bool:
    """A specialist's output carries something to act on (for agents with other output shapes: anything at all)."""
    if not isinstance(output, dict) or not output:
        return False
    known = [k for k in _FINDINGS_KEYS if k in output]
    return any(output[k] for k in known) if known else True


MAX_ROOT_CAUSES = 3
PREFERRED_SOURCES = ("/org/finance/", "/org/engineering/")  # primary records; overviews like /org/projects/* rank lower
_CAUSAL = re.compile(r"\b(due|because|caus\w*|fail\w*|block\w*|driv\w*|result\w*|lead\w*|led)\b", re.I)
_STOP = frozenset("the and for with that this from are was were has have been its into over under why how what".split())


def _words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if len(w) > 2 and w not in _STOP}


def _overlap(a: set[str], b: set[str]) -> float:
    return len(a & b) / max(1, len(a | b))


def _gain(rc: dict[str, Any], picked: list[dict[str, Any]]) -> tuple[int, int, float, int, int]:
    """How much a root cause adds to those already picked: new primary documents, new documents, then dissimilarity."""
    covered = {p for k in picked for p in k["evidence"]}
    new = [p for p in rc["evidence"] if p not in covered]
    similar = max((_overlap(_words(rc["cause"]), _words(k["cause"])) for k in picked), default=0.0)
    primary = sum(p.startswith(PREFERRED_SOURCES) for p in rc["evidence"])
    return sum(p.startswith(PREFERRED_SOURCES) for p in new), len(new), -similar, primary, len(rc["evidence"])


def _usable_text(text: str, min_words: int) -> bool:
    return len(re.findall(r"[A-Za-z]{3,}", text)) >= min_words


class PlannerAgent(MosaicAgent):
    """Orchestrates a project investigation end-to-end."""

    async def run(self, goal: str, ctx: Any) -> AgentResult:
        await ctx.log("planner: starting", data={"goal": goal[:200]})
        project = project_of(goal, getattr(ctx, "inputs", None))
        await think(ctx, "search", f"Searching /org for evidence on Project {project}.")

        # 1. Gather evidence
        evidence = await gather_evidence(ctx, goal, scope=["/org"], top_k=8)
        evidence_text = cite(evidence)
        await ctx.log(f"planner: gathered {len(evidence.hits)} evidence hits")
        await think_flagged(ctx, evidence)

        if ctx.cancelled():
            return self.result(ctx, "cancelled before planning", status=AgentResultStatus.CANCELLED)

        # 2. Build plan via LLM
        allowed = offered_roles(goal, list(ctx.manifest.capabilities.agents))  # the kernel refuses any other spawn anyway
        agent_list = "\n".join(f"- {a}" for a in allowed)
        extra = [a for a in allowed if a not in LIBRARY_ROLES and a in SPECIALIST_ROLES]
        if extra:  # only for goals that ask for them: the Apollo and Zeus prompts are unchanged
            agent_list += "\n\nAlso available for this goal:\n" + "\n".join(f"- {a}: {SPECIALIST_ROLES[a][0]}" for a in extra)
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
            steps = await self._validate_steps(ctx, default_plan(project), allowed)

        # The default plan's specialists are the floor. The model sometimes drops one: a real Apollo run planned no
        # research step, so nobody read the vendor email or opened the vendor docs. A missing specialist is added back
        # before the action step; whether there is an action step at all stays the model's call.
        present = {s.agent for s in steps}
        missing = [d for d in default_plan(project) if d.agent != "action-agent" and d.agent in allowed and d.agent not in present]
        if missing:
            ids = {s.step_id for s in steps}
            for d in missing:
                while d.step_id in ids:
                    d.step_id += "b"
                ids.add(d.step_id)
            await ctx.log(f"planner: adding {', '.join(d.agent for d in missing)} to the plan (every specialist contributes findings)")
            specialists = [s for s in steps if s.agent != "action-agent"]
            steps = await self._validate_steps(ctx, specialists + missing + [s for s in steps if s.agent == "action-agent"], allowed)

        # The 7B's step goals are often generic ("Analyze the budget variance"), and a specialist's search is its step
        # goal: fine for Apollo, which dominates the bundle, but any other project would retrieve Apollo's documents.
        # Apollo's goals are left exactly as planned so the demo run's queries do not change.
        if project != DEFAULT_PROJECT:
            for s in steps:
                if project.lower() not in s.goal.lower():
                    s.goal = f"Project {project}: {s.goal}"

        await ctx.log(f"planner: executing {len(steps)} steps")
        await narrate(ctx, understood(goal, project, steps))
        for s in execution_order(steps):  # the order the kernel will create them in
            await narrate(ctx, planned(s))

        # 5 & 6. Execute steps respecting depends_on (parallel where possible)
        upstream: dict[str, Any] = {}
        step_pids: dict[str, int] = {}
        retrieved = {h.path for h in evidence.hits}  # every /org path this task really retrieved (planner + specialists)

        # Topological execution: spawn all steps whose deps are complete
        completed_steps: set[str] = set()
        remaining = list(steps)
        # Specialists that failed or came back empty, with why. The tracker is only updated from complete findings.
        incomplete: dict[str, str] = {}
        incomplete_codes: list[str] = []

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
                if step.agent == ACTION_AGENT and incomplete:
                    await ctx.log(f"planner: skipping tracker update: incomplete findings from {', '.join(incomplete)}",
                                  level="warning")
                    await think(ctx, "act", f"Skipping the tracker update: findings from {_and(list(incomplete))} are incomplete.")
                    completed_steps.add(step.step_id)
                    continue
                inputs = {"upstream": {k: upstream[k] for k in step.depends_on if k in upstream}, "project": project}
                bounds = planned(step)  # the kernel generates the agent from its role template within these bounds
                try:
                    pid = await ctx.spawn(step.agent, step.goal, inputs, capabilities=bounds.capabilities or None,
                                          scope=[f"{s.rstrip('/')}/**" for s in bounds.scope] or None, why=bounds.why)
                    step_pids[step.step_id] = pid
                    await ctx.log(f"planner: spawned {step.agent} (step {step.step_id}) as pid {pid}")
                except Exception as e:
                    await ctx.log(f"planner: failed to spawn {step.agent}: {e}", level="warning")
                    completed_steps.add(step.step_id)  # skip this step
                    if step.agent != ACTION_AGENT:
                        incomplete[step.agent] = f"{step.agent} could not be started: {e}"

            # Wait for all spawned steps that haven't been waited on yet
            for step in [s for s in steps if s.step_id in step_pids and s.step_id not in completed_steps]:
                if step.step_id not in {s.step_id for s in remaining}:
                    pid = step_pids[step.step_id]
                    try:
                        result = await ctx.wait(pid)
                        upstream[step.step_id] = result.output
                        retrieved.update(p for p in result.evidence if isinstance(p, str))
                        completed_steps.add(step.step_id)
                        if result.status == AgentResultStatus.COMPLETED:
                            await ctx.log(f"planner: step {step.step_id} ({step.agent}) completed: {result.status}")
                        else:  # the synthesis goes on without it: say so where the timeline highlights it
                            await ctx.log(f"planner: step {step.step_id} ({step.agent}) {result.status.value}: "
                                          f"{result.summary[:300]}; continuing without its findings", level="warning")
                        if step.agent != ACTION_AGENT:
                            if result.status != AgentResultStatus.COMPLETED:
                                incomplete[step.agent] = result.summary[:300] or f"{step.agent} {result.status.value}"
                                if result.error is not None:
                                    incomplete_codes.append(result.error.code)
                            elif not _has_findings(result.output):
                                incomplete[step.agent] = f"{step.agent} returned no usable findings"
                                await ctx.log(f"planner: step {step.step_id} ({step.agent}) returned no usable findings",
                                              level="warning")
                    except Exception as e:
                        await ctx.log(f"planner: wait for step {step.step_id} failed: {e}", level="warning")
                        upstream[step.step_id] = {}
                        completed_steps.add(step.step_id)
                        if step.agent != ACTION_AGENT:
                            incomplete[step.agent] = f"{step.agent}: {e}"

        # 7. Synthesize
        if ctx.cancelled():
            return self.result(ctx, "cancelled before synthesis", status=AgentResultStatus.CANCELLED)

        synthesis_prompt = (
            f"Goal: {goal}\n\n"
            f"Evidence from knowledge base:\n{evidence_text}\n\n"
            f"Specialist findings:\n{self._format_upstream(upstream)}\n\n"
            "Synthesize into: root_causes (at most three, list of {cause, evidence: [/org paths]}), "
            "recovery_plan (list of steps), summary (two or three sentences)."
        )

        partial = f"Partial: {', '.join(incomplete)} failed; tracker not updated." if incomplete else None
        synthesis = await self._ask(ctx, partial, SYNTHESIS_SYSTEM, synthesis_prompt, SynthesisOut, max_tokens=2000)
        synthesis = synthesis or SynthesisOut()
        synthesis.root_causes = await self._backed(ctx, synthesis.root_causes, retrieved)
        if not synthesis.root_causes:
            # Small models often fail the full schema: retry once with just the root causes and compact findings
            await ctx.log("planner: synthesis had no cited root causes; retrying with a simpler schema", level="warning")
            retry = await self._ask(ctx, partial, SYNTHESIS_SYSTEM, (
                f"Goal: {goal}\n\nSpecialist findings (with their /org evidence):\n{self._findings_text(upstream)}\n\n"
                "List the root causes as JSON: root_causes (list of {cause, evidence: [/org paths from the findings]})."),
                RootCausesOut, max_tokens=800)
            if retry:
                synthesis.root_causes = await self._backed(ctx, [rc.model_dump() for rc in retry.root_causes], retrieved)
        if not synthesis.root_causes:
            await ctx.log("planner: building root causes from the specialists' structured findings", level="warning")
            synthesis.root_causes = self._root_causes_from_findings(upstream)
        found = len(synthesis.root_causes)
        synthesis.root_causes = self._top_root_causes(goal, synthesis.root_causes)
        if len(synthesis.root_causes) < found:
            await ctx.log(f"planner: kept the top {len(synthesis.root_causes)} of {found} root causes")
        steps = [s.strip() for s in synthesis.recovery_plan if _usable_text(s, 2)]
        if not steps:
            if synthesis.recovery_plan:
                await ctx.log("planner: the recovery plan was unusable; building it from the root causes", level="warning")
            steps = [f"Address: {rc['cause']}" for rc in synthesis.root_causes]
        synthesis.recovery_plan = steps
        if not self._usable_summary(synthesis.summary):
            synthesis.summary = (
                f"{len(synthesis.root_causes)} root causes: " + "; ".join(rc["cause"] for rc in synthesis.root_causes)
                if synthesis.root_causes else f"Investigation complete for: {goal[:100]}")
        await ctx.log(f"planner: synthesis complete ({len(synthesis.root_causes)} root causes)")

        await think(ctx, "synthesize", f"Combined the findings into {plural(len(synthesis.root_causes), 'cited root cause')} "
                                       "and a recovery plan.")

        # 8. Write artifact
        recovery_md = self._make_recovery_md(goal, synthesis, upstream, partial)
        artifact_ref = await ctx.put_artifact("recovery-plan.md", recovery_md.encode(), "text/markdown")
        await ctx.log(f"planner: wrote artifact {artifact_ref}")

        if partial:
            # The plan is written, but the run is not a success: end the task as failed, naming the specialists.
            reasons = "; ".join(incomplete.values())
            return AgentResult(
                pid=ctx.pid, agent=ctx.manifest.name, status=AgentResultStatus.FAILED, summary=partial,
                error=ErrorInfo(code=incomplete_codes[0] if incomplete_codes else "INTERNAL",
                                message=f"incomplete findings from {', '.join(incomplete)}: {reasons}"[:1000], retriable=False),
                output={"root_causes": synthesis.root_causes, "recovery_plan": self._numbered(synthesis.recovery_plan),
                        "artifact": artifact_ref, "partial": True, "incomplete": list(incomplete)},
                evidence=sorted(p for p in retrieved if p.startswith("/org")), artifacts=[artifact_ref])

        # 9. Return result
        root_causes = synthesis.root_causes
        recovery_text = self._numbered(synthesis.recovery_plan)
        summary = synthesis.summary

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
    def _top_root_causes(goal: str, root_causes: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """At most MAX_ROOT_CAUSES distinct causes, kept in the model's order. Drops restatements of the goal's symptoms
        ("31% over budget and six weeks late") and merges near-duplicates, then picks greedily: the cause that adds the
        most primary (finance/engineering) documents not already cited, ties going to the one least like those picked."""
        goal_words = _words(goal)
        causes = [{**rc, "evidence": list(dict.fromkeys(rc.get("evidence", [])))} for rc in root_causes]

        def restates_goal(rc: dict[str, Any]) -> bool:
            words = _words(rc["cause"])
            return bool(words) and len(words & goal_words) / len(words) >= 0.5 and not _CAUSAL.search(rc["cause"])

        if any(not restates_goal(rc) for rc in causes):
            causes = [rc for rc in causes if not restates_goal(rc)]

        kept: list[dict[str, Any]] = []
        for rc in causes:
            words, ev = _words(rc["cause"]), set(rc["evidence"])
            twin = next((k for k in kept if _overlap(words, _words(k["cause"])) >= 0.5
                         and (ev <= set(k["evidence"]) or set(k["evidence"]) <= ev)), None)
            if twin is None:
                kept.append(rc)
            else:
                if len(ev) > len(twin["evidence"]):
                    twin["cause"] = rc["cause"]
                twin["evidence"] = list(dict.fromkeys([*twin["evidence"], *rc["evidence"]]))

        picked: list[dict[str, Any]] = []
        pool = list(kept)
        while pool and len(picked) < MAX_ROOT_CAUSES:
            best = max(pool, key=lambda rc: _gain(rc, picked))  # ties go to the earlier cause
            picked.append(best)
            pool.remove(best)
        return [rc for rc in kept if any(rc is p for p in picked)]

    @staticmethod
    def _usable_summary(summary: str) -> bool:
        """A summary, not a heading: "Recovery Plan for Project Apollo" came back from the 7B once."""
        s = summary.strip()
        return not s.startswith("#") and _usable_text(s, 8)

    @staticmethod
    def _numbered(steps: list[str]) -> str:
        return "\n".join(f"{i}. {s}" for i, s in enumerate(steps, 1))

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

    async def _ask(self, ctx: Any, partial: str | None, *args: Any, **kw: Any) -> Any:
        """ask_json; when findings are already incomplete, a failing model (often the reason they are) must not cost
        the partial plan too, so its error is logged and the plan is built from the structured findings instead."""
        if not partial:
            return await ask_json(ctx, *args, **kw)
        try:
            return await ask_json(ctx, *args, **kw)
        except MosaicError as e:
            await ctx.log(f"planner: synthesis unavailable ({e.message}); writing the partial plan from the findings",
                          level="warning")
            return None

    def _make_recovery_md(self, goal: str, synthesis: SynthesisOut | None, upstream: dict, partial: str | None = None) -> str:
        parts = [f"# Recovery Plan\n\n**{partial}**\n" if partial else "# Recovery Plan\n", f"**Goal:** {goal}\n"]

        parts.append("\n## Root Causes\n")
        for i, rc in enumerate(synthesis.root_causes if synthesis else [], 1):
            parts.append(f"{i}. **{rc['cause']}** — Evidence: {', '.join(rc['evidence'])}")
        if not synthesis or not synthesis.root_causes:
            parts.append("No root cause could be backed by a retrieved document; see the specialist findings below.")

        if synthesis and synthesis.recovery_plan:
            parts.append(f"\n## Recovery Steps\n\n{self._numbered(synthesis.recovery_plan)}")

        parts.append("\n## Specialist Findings Summary\n")
        for step_id, out in upstream.items():
            if isinstance(out, dict) and out:
                parts.append(f"\n### Step {step_id}\n")
                parts.append(str(out)[:500])

        return "\n".join(parts)
