"""What-if simulation engine (MiroFish-adapted, local).

Runs a panel-debate style simulation: each agent reacts to the user scenario
over a variable number of rounds. Each round, every agent sees its persona, the
scenario, and the previous round's statements from the OTHER agents, then emits
a reaction (support / oppose / neutral / observe) plus a statement. Stance shifts
and a consensus/risk signal are tracked across rounds. A final LLM call
synthesizes a structured report.

No external social platforms, Zep, or subprocess IPC — just an asyncio LLM loop
against the project's local vLLM.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any, Optional

from app.simulation.persona import AgentPersona

ROUND_SYSTEM = (
    "You are role-playing a real entity in a business 'what-if' panel discussion. "
    "Stay strictly in character based on your persona. React to the scenario and to "
    "what other participants said in the previous round. Respond with ONLY valid JSON."
)

ROUND_USER = """SCENARIO:
{scenario}

YOUR PERSONA:
{persona}

YOUR CURRENT STANCE: {stance}

WHAT OTHERS SAID LAST ROUND (you should respond to / build on this):
{others}

React to the scenario this round. Output JSON:
{{
  "reaction": "support" | "oppose" | "neutral" | "observe",
  "statement": "your in-character reaction (1-3 sentences, <= 70 words)",
  "new_stance": "support" | "oppose" | "neutral" | "observe"
}}
"""

REPORT_SYSTEM = (
    "You are a strategy analyst. Given a what-if scenario and a multi-agent panel "
    "transcript, produce a concise, structured prediction report. Respond with ONLY valid JSON."
)

REPORT_USER = """SCENARIO:
{scenario}

PANEL TRANSCRIPT (per round, per agent):
{transcript}

AGENT POSITIONS (final):
{positions}

Produce a structured report as JSON:
{{
  "summary": "2-3 sentence overall outcome",
  "positions": [{{"agent": "name", "final_stance": "support|oppose|neutral|observe", "key_point": "short"}}],
  "agreement": ["points of consensus"],
  "conflict": ["points of disagreement / tension"],
  "risks": ["key risks or knock-on effects"],
  "overall_outcome": "support|oppose|contested|uncertain"
}}
"""


@dataclass
class AgentStatement:
    round: int
    agent_id: str
    agent_name: str
    reaction: str
    statement: str
    stance: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "round": self.round,
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "reaction": self.reaction,
            "statement": self.statement,
            "stance": self.stance,
        }


@dataclass
class SimulationResult:
    scenario: str
    agents: list[dict[str, Any]] = field(default_factory=list)
    rounds: list[dict[str, Any]] = field(default_factory=list)
    report: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "scenario": self.scenario,
            "agents": self.agents,
            "rounds": self.rounds,
            "report": self.report,
        }


def _stance_shift(prev: str, new: str) -> bool:
    return prev != new


async def _agent_round(
    llm, persona: AgentPersona, scenario: str, others: str, emit
) -> AgentStatement:
    user = ROUND_USER.format(
        scenario=scenario,
        persona=persona.persona,
        stance=persona.stance,
        others=others or "(this is the first round)",
    )
    try:
        data = await llm.chat_json(ROUND_SYSTEM, user, temperature=0.7, max_tokens=512)
        reaction = str(data.get("reaction", "observe")).lower()
        if reaction not in ("support", "oppose", "neutral", "observe"):
            reaction = "observe"
        new_stance = str(data.get("new_stance", persona.stance)).lower()
        if new_stance not in ("support", "oppose", "neutral", "observe"):
            new_stance = persona.stance
        return AgentStatement(
            round=0,  # set by caller
            agent_id=persona.id,
            agent_name=persona.name,
            reaction=reaction,
            statement=str(data.get("statement", ""))[:400],
            stance=new_stance,
        )
    except Exception:
        return AgentStatement(
            round=0,
            agent_id=persona.id,
            agent_name=persona.name,
            reaction="observe",
            statement=f"{persona.name} observes the scenario without committing.",
            stance=persona.stance,
        )


async def run_simulation(
    personas: list[AgentPersona],
    scenario: str,
    llm,
    rounds: int = 3,
    until_stable: bool = False,
    emit=None,
) -> SimulationResult:
    rounds = max(1, min(5, int(rounds)))
    result = SimulationResult(scenario=scenario, agents=[p.to_dict() for p in personas])

    # Per-agent stance tracker for stability detection.
    prev_stances = {p.id: p.stance for p in personas}
    transcript_lines: list[str] = []

    max_rounds = 5 if until_stable else rounds
    r = 1
    while r <= max_rounds:
        if emit:
            await emit("simulating", f"Round {r}/{max_rounds}: agents reacting...", r)

        # Build "others" context per agent from the previous round's statements.
        prev_round_statements = result.rounds[-1]["statements"] if result.rounds else []
        by_agent = {s["agent_id"]: s for s in prev_round_statements}

        async def _one(p: AgentPersona):
            others = "\n".join(
                f"- {s['agent_name']}: {s['statement']}" for s in prev_round_statements if s["agent_id"] != p.id
            )
            st = await _agent_round(llm, p, scenario, others, emit)
            st.round = r
            return st

        statements = await asyncio.gather(*[_one(p) for p in personas])

        round_block = {
            "round": r,
            "statements": [s.to_dict() for s in statements],
        }
        result.rounds.append(round_block)
        for s in statements:
            transcript_lines.append(f"[R{r}] {s.agent_name} ({s.reaction}): {s.statement}")

        # Update stances + stability check.
        cur_stances = {s.agent_id: s.stance for s in statements}
        shifted = sum(1 for aid, st in cur_stances.items() if _stance_shift(prev_stances.get(aid, st), st))
        prev_stances = cur_stances

        if until_stable and r >= 2 and shifted == 0:
            break
        r += 1

    if emit:
        await emit("simulating", "Synthesizing report from transcript...", r)
    transcript = "\n".join(transcript_lines)
    positions = "\n".join(
        f"- {p.name}: {prev_stances.get(p.id, p.stance)}" for p in personas
    )
    report_user = REPORT_USER.format(scenario=scenario, transcript=transcript, positions=positions)
    try:
        report = await llm.chat_json(REPORT_SYSTEM, report_user, temperature=0.3, max_tokens=1024)
    except Exception:
        report = {
            "summary": "Simulation completed but report synthesis failed.",
            "positions": [{"agent": p.name, "final_stance": prev_stances.get(p.id, p.stance), "key_point": ""} for p in personas],
            "agreement": [],
            "conflict": [],
            "risks": [],
            "overall_outcome": "uncertain",
        }
    result.report = report
    return result
