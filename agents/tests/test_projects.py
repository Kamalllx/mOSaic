"""The agents work for a project other than Apollo (the Zeus scenario), and Apollo's strings stay exactly as they were.
Fake context only: canned LLM replies, no Ollama."""
import asyncio

from mosaic_agents.library.action import ActionAgent
from mosaic_agents.library.engineering import EngineeringAgent
from mosaic_agents.library.finance import FinanceAgent
from mosaic_agents.library.planner import PlannerAgent
from mosaic_agents.library.research import ResearchAgent
from mosaic_agents.sdk import project_of, tracking_issue

from .test_agents_units import ENG_REPLY, FINANCE_REPLY, _planner_ctx, ctx_for

ZEUS = ("Prepare a steering-committee briefing on Project Zeus budget risk for Q4: identify the risk drivers with "
        "evidence, update the tracker, and propose mitigations.")
APOLLO = ("Investigate why Project Apollo is over budget and six weeks behind schedule. "
          "Identify root causes, update the tracker, and prepare a recovery plan.")
# What qwen2.5:7b really plans: step goals that never name the project.
GENERIC_PLAN = {"rationale": "r", "steps": [
    {"step_id": "s1", "agent": "finance-agent", "goal": "Analyze the budget variance and identify the specific cost drivers."},
    {"step_id": "s2", "agent": "engineering-agent", "goal": "Identify the technical issues and schedule slips."},
    {"step_id": "s3", "agent": "research-agent", "goal": "Gather evidence from the documents for Project Zeus."},
    {"step_id": "s4", "agent": "action-agent", "goal": "Update the project tracker.", "depends_on": ["s1", "s2", "s3"]},
]}


def _spawned(ctx) -> list[tuple[str, str]]:
    return [(agent, goal) for agent, goal, _ in ctx.spawned.values()]


def test_project_of_and_tracking_issue():
    assert project_of(ZEUS) == "Zeus" and project_of(APOLLO) == "Apollo"
    assert project_of("Why is Apollo late?") == "Apollo", "no 'Project <Name>': the default"
    assert project_of("Update the project tracker.", {"project": "Zeus"}) == "Zeus", "what the planner passed wins"
    assert tracking_issue("Apollo") == "APOLLO-12" and tracking_issue("Zeus") == "ZEUS-11" and tracking_issue("Iris") == "IRIS-1"


def test_planner_plans_the_zeus_goal_and_anchors_generic_steps_to_the_project():
    ctx, inputs = _planner_ctx(GENERIC_PLAN)
    result = asyncio.run(PlannerAgent().run(ZEUS, ctx))
    assert result.output["steps_executed"] == 4
    assert _spawned(ctx) == [
        ("finance-agent", "Project Zeus: Analyze the budget variance and identify the specific cost drivers."),
        ("engineering-agent", "Project Zeus: Identify the technical issues and schedule slips."),
        ("research-agent", "Gather evidence from the documents for Project Zeus."),  # already names it
        ("action-agent", "Project Zeus: Update the project tracker."),
    ]
    assert all(i["project"] == "Zeus" for _, i in inputs)


def test_planner_leaves_apollo_step_goals_untouched():
    ctx, inputs = _planner_ctx(GENERIC_PLAN)
    asyncio.run(PlannerAgent().run(APOLLO, ctx))
    assert [g for _, g in _spawned(ctx)] == [s["goal"] for s in GENERIC_PLAN["steps"]]
    assert all(i["project"] == "Apollo" for _, i in inputs)


def test_fallback_plan_names_the_project_and_its_tracking_issue():
    unusable = {"rationale": "r", "steps": []}
    ctx, _ = _planner_ctx(unusable)
    asyncio.run(PlannerAgent().run(ZEUS, ctx))
    goals = dict(_spawned(ctx))
    assert set(goals) == {"finance-agent", "engineering-agent", "research-agent", "action-agent"}
    assert "Zeus" in goals["finance-agent"] and "ZEUS-11" in goals["action-agent"]

    ctx, _ = _planner_ctx(unusable)
    asyncio.run(PlannerAgent().run(APOLLO, ctx))
    assert _spawned(ctx) == [
        ("finance-agent", "Explain the Apollo budget variance with evidence"),
        ("engineering-agent", "Identify engineering causes of the schedule slip"),
        ("research-agent", "Collect vendor SDK context"),
        ("action-agent", "Record root causes on APOLLO-12"),
    ], "the Apollo fallback plan is unchanged"


def _action(project: str | None):
    inputs = {"upstream": {"f": {"drivers": [{"item": "cloud", "evidence": ["/org/finance/apollo-budget"]}]}}}
    if project:
        inputs["project"] = project
    ctx = ctx_for("action-agent", inputs=inputs)
    asyncio.run(ActionAgent().run("Update the project tracker.", ctx))
    return {req.capability: req for req, _ in ctx.syscalls}


def test_action_agent_writes_to_the_projects_own_tracking_issue():
    zeus = _action("Zeus")
    assert zeus["jira.write"].arguments["key"] == "ZEUS-11" and zeus["jira.write"].resource == "ZEUS-11"
    assert zeus["fs.write"].arguments["path"] == "reports/zeus-recovery.md"
    assert zeus["fs.write"].arguments["content"].startswith("# Zeus Recovery Plan\n")
    assert "APOLLO" not in str(zeus["jira.write"].arguments) and "Apollo" not in zeus["jira.write"].justification

    apollo = _action(None)
    assert apollo["jira.write"].arguments["key"] == "APOLLO-12" and apollo["jira.write"].resource == "APOLLO-12"
    assert apollo["jira.write"].justification.startswith("Update Apollo tracking issue with root causes: ")
    assert apollo["fs.write"].arguments["path"] == "reports/apollo-recovery.md"
    assert apollo["fs.write"].arguments["content"].startswith("# Apollo Recovery Plan\n")


def test_engineering_searches_the_projects_issues_and_tags_its_memory():
    for project, key in (("Zeus", "ZEUS"), (None, "APOLLO")):
        ctx = ctx_for("engineering-agent", {"engineering analysis": ENG_REPLY}, inputs={"project": project} if project else {})
        asyncio.run(EngineeringAgent().run("Identify the technical issues and schedule slips.", ctx))
        [jira] = [req for req, _ in ctx.syscalls if req.capability == "jira.read"]
        assert jira.arguments == {"project": key}
        assert jira.justification == f"Retrieve {key} project issues for engineering analysis"
        [mem] = ctx.memory.records.values()
        assert mem.tags == ["engineering", key.lower()]


def test_finance_tags_its_memory_with_the_project():
    ctx = ctx_for("finance-agent", {"financial analysis": FINANCE_REPLY}, inputs={"project": "Zeus"})
    asyncio.run(FinanceAgent().run("Analyze the budget variance.", ctx))
    [mem] = ctx.memory.records.values()
    assert mem.tags == ["finance", "zeus"]


def test_research_opens_the_projects_vendor_page():
    for project, url in (("Zeus", "http://vendor-docs/warehouse-pricing.html"), (None, "http://vendor-docs/sdk-v5.html")):
        ctx = ctx_for("research-agent", inputs={"project": project} if project else {})
        result = asyncio.run(ResearchAgent().run("Gather evidence.", ctx))
        [browser] = [req for req, _ in ctx.syscalls if req.capability == "browser.open"]
        assert browser.arguments == {"url": url}
        assert result.output["urls_opened"] == [url]
    assert browser.justification == "Retrieve vendor SDK v5 documentation for research", "Apollo's wording is unchanged"


def test_planner_warns_when_it_continues_without_a_failed_specialist():
    from mosaic_contracts.schema import AgentResult, AgentResultStatus, ErrorInfo

    from .test_agents_units import manifest

    async def child(agent, goal, inputs):
        if agent == "engineering-agent":
            return AgentResult(pid=1, agent=agent, status=AgentResultStatus.FAILED, error=ErrorInfo(code="TIMEOUT", message="t"),
                               summary="engineering-agent failed: ollama qwen2.5:7b-instruct: no answer within 180s (ReadTimeout)")
        return AgentResult(pid=1, agent=agent, status=AgentResultStatus.COMPLETED, summary="ok")

    from mosaic_contracts.testing.fakes import FakeAgentContext

    ctx = FakeAgentContext(manifest=manifest("planner-agent"), responses={"produce a plan": GENERIC_PLAN}, child_runner=child)
    asyncio.run(PlannerAgent().run(APOLLO, ctx))
    warnings = [m for level, m, _ in ctx.logs if level == "warning" and "continuing without" in m]
    assert warnings == ["planner: step s2 (engineering-agent) failed: engineering-agent failed: ollama qwen2.5:7b-instruct: "
                        "no answer within 180s (ReadTimeout); continuing without its findings"]
    assert not any("s1 (finance-agent) completed" in m for level, m, _ in ctx.logs if level == "warning")
