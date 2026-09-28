"""Unit tests for P3's agents on FakeAgentContext (fixtures in shared/fixtures/okf, canned LLM replies)."""
import asyncio

import yaml
from mosaic_agents.library.engineering import EngineeringAgent
from mosaic_agents.library.finance import FinanceAgent
from mosaic_contracts.schema import AgentManifest, MemoryKind
from mosaic_contracts.testing.fakes import FakeAgentContext
from mosaic_contracts.wiring import REPO_ROOT


def manifest(name: str) -> AgentManifest:
    return AgentManifest.model_validate(yaml.safe_load((REPO_ROOT / "agents" / "manifests" / f"{name}.yaml").read_text()))


def ctx_for(name: str, responses: dict | None = None, **kw) -> FakeAgentContext:
    return FakeAgentContext(manifest=manifest(name), ppid=100, responses=responses or {}, **kw)


FINANCE_REPLY = {"overrun_lakh": 6.2, "overrun_pct": 31.0, "summary": "Apollo is 31% over budget",
                 "drivers": [{"item": "cloud", "delta": "+4.1L", "cause": "dual-run", "evidence": ["/org/finance/apollo-budget"]}]}
ENG_REPLY = {"slip_weeks": 3, "summary": "3 weeks slip",
             "blockers": [{"issue": "APOLLO-12", "cause": "backfill failed", "evidence": ["/org/engineering/apollo-status"]}]}


def test_finance_and_engineering_remember_their_findings():
    for agent, name, reply, key in ((FinanceAgent(), "finance-agent", FINANCE_REPLY, "financial analysis"),
                                    (EngineeringAgent(), "engineering-agent", ENG_REPLY, "engineering analysis")):
        ctx = ctx_for(name, {key: reply})
        asyncio.run(agent.run("Why is Apollo over budget and late?", ctx))
        [mem] = ctx.memory.records.values()
        assert mem.owner == name and mem.kind == MemoryKind.EPISODIC and mem.importance >= 0.5
        assert mem.content == reply["summary"]
        assert mem.derived_from == [reply["drivers" if "drivers" in reply else "blockers"][0]["evidence"][0]]
