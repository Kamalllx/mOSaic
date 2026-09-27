"""FinanceAgent — analyzes budget variance and financial drivers.

Owner: P3 — Agents & Models

Framework: nooa (listed in manifest), but we implement as a standard MosaicAgent.
The Runtime falls back to running it as custom when the NOOA adapter is not installed.
"""
from __future__ import annotations

import logging
from typing import Any

from mosaic_contracts.schema import AgentResult, AgentResultStatus, MessageType
from mosaic_contracts.schema.common import new_id
from mosaic_contracts.schema.ipc import A2AMessage

from mosaic_agents.prompts import FinanceOut
from mosaic_agents.sdk import MosaicAgent, ask_json, cite, gather_evidence

log = logging.getLogger("mosaic.agents.finance")

FINANCE_SYSTEM = """You are the Finance Agent in mOSaic. Analyze budget variance and financial drivers.

Rules:
- Only cite /org paths that actually appeared in the evidence.
- Never fabricate numbers; if the evidence doesn't have a number, say "unknown".
- Be precise: give the overrun in lakh (₹100,000 units) and as a percentage.
- For each driver, identify the item, the delta (change), the cause, and the supporting /org paths.
"""


class FinanceAgent(MosaicAgent):
    """Analyzes financial/budget information using knowledge base evidence."""

    async def run(self, goal: str, ctx: Any) -> AgentResult:
        await ctx.log("finance-agent: starting", data={"goal": goal[:200]})

        # Gather financial evidence
        evidence = await gather_evidence(
            ctx,
            goal,
            scope=["/org/finance", "/org/projects", "/org/decisions"],
            top_k=8,
        )
        evidence_text = cite(evidence)
        await ctx.log(f"finance-agent: gathered {len(evidence.hits)} evidence hits")

        if ctx.cancelled():
            return self.result(ctx, "cancelled", status=AgentResultStatus.CANCELLED)

        # Analyze with structured output
        user_prompt = (
            f"Task: {goal}\n\n"
            f"Evidence from knowledge base:\n{evidence_text}\n\n"
            "Based ONLY on the evidence above, produce a financial analysis as JSON:\n"
            "- overrun_lakh: total budget overrun in lakh (float)\n"
            "- overrun_pct: overrun as percentage (float)\n"
            "- drivers: list of {item, delta, cause, evidence: [/org paths]}\n"
            "- summary: brief text summary\n"
            "Only cite /org paths that appear in the evidence above."
        )

        finance_out = await ask_json(ctx, FINANCE_SYSTEM, user_prompt, FinanceOut, max_tokens=1200)

        # Fallback if LLM output is unusable
        if finance_out is None:
            await ctx.log("finance-agent: LLM output unusable, using fallback", level="warning")
            finance_out = FinanceOut(
                overrun_lakh=0.0,
                overrun_pct=0.0,
                drivers=[],
                summary="Unable to extract financial data from evidence. Manual review required.",
            )

        await ctx.log(f"finance-agent: analysis complete — overrun {finance_out.overrun_lakh}L ({finance_out.overrun_pct}%)")

        # Send evidence to parent if we have one
        if ctx.ppid:
            try:
                ev_paths = [h.path for h in evidence.hits]
                await ctx.send(
                    A2AMessage(
                        message_id=new_id("MSG"),
                        task_id=ctx.task_id,
                        sender_pid=ctx.pid,
                        receiver_pid=ctx.ppid,
                        sender=ctx.manifest.name,
                        receiver="",
                        type=MessageType.EVIDENCE,
                        content=finance_out.summary[:500],
                        provenance=ev_paths,
                    )
                )
            except Exception as e:
                await ctx.log(f"finance-agent: failed to send evidence to parent: {e}", level="warning")

        output = {
            "overrun_lakh": finance_out.overrun_lakh,
            "overrun_pct": finance_out.overrun_pct,
            "drivers": finance_out.drivers,
            "summary": finance_out.summary,
        }

        return AgentResult(
            pid=ctx.pid,
            agent=ctx.manifest.name,
            status=AgentResultStatus.COMPLETED,
            summary=finance_out.summary or f"Financial analysis complete: {finance_out.overrun_lakh}L overrun ({finance_out.overrun_pct}%)",
            output=output,
            evidence=[h.path for h in evidence.hits],
        )
