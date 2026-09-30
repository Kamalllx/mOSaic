"""ctx.narrate (contract 0.10.0): the real context satisfies AgentContext and publishes the three agent-told events."""
import pytest
from mosaic_contracts.errors import MosaicError
from mosaic_contracts.interfaces.kernel import AgentContext
from mosaic_contracts.schema import AgentPlanned, AgentThought, TaskStatus, TaskUnderstood, ToolQuery
from mosaic_kernel.testing import done, manifest, run, start_task


def test_the_real_context_satisfies_the_agent_context_protocol(make_kernel):
    seen = {}

    async def planner(goal, ctx):
        seen["ctx"] = ctx
        return done(ctx)

    k = make_kernel({"planner-agent": planner}, [manifest("planner-agent")])

    async def go():
        await k.boot()
        await k.tasks.wait_terminal(await start_task(k))
        await k.shutdown()

    run(go)
    assert isinstance(seen["ctx"], AgentContext)  # runtime_checkable: every protocol member, narrate included


def test_narrate_publishes_the_story_with_the_kernels_pid(make_kernel):
    errors = []

    async def planner(goal, ctx):
        await ctx.narrate(TaskUnderstood(intent="investigate", entities=["Project Apollo"], plan_summary="two agents"))
        await ctx.narrate(AgentPlanned(role="finance-agent", why="budget", scope=["/org/finance"]))
        await ctx.narrate(AgentThought(pid=999, step="plan", text="Planning 2 steps."))
        with pytest.raises(MosaicError) as e:  # tool.query is the kernel's to emit
            await ctx.narrate(ToolQuery(pid=ctx.pid, tool="db.query", query="select 1", rows=1, ms=1))
        errors.append(e.value.code)
        return done(ctx)

    k = make_kernel({"planner-agent": planner}, [manifest("planner-agent")])

    async def go():
        await k.boot()
        t = await k.tasks.wait_terminal(await start_task(k))
        await k.shutdown()
        return t

    t = run(go)
    assert t.status == TaskStatus.COMPLETED and errors == ["BAD_REQUEST"]
    understood, planned, thought = (k.bus.of_type(x) for x in ("task.understood", "agent.planned", "agent.thought"))
    assert understood[0].payload["entities"] == ["Project Apollo"] and understood[0].task_id == t.task_id
    assert planned[0].payload == {"role": "finance-agent", "why": "budget", "scope": ["/org/finance"], "capabilities": []}
    pid = understood[0].pid
    assert thought[0].pid == pid and thought[0].payload["pid"] == pid != 999  # an agent cannot speak for another pid
    assert not k.bus.of_type("tool.query")
