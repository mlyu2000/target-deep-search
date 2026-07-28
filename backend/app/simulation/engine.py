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
    "You are role-playing a real business entity in a 'what-if' panel simulation. You are a "
    "STRATEGIC ACTOR, not a narrator. Your job is to REACT to the scenario with a positioned "
    "response and a concrete move — not to describe your products. Stay in character. "
    "Respond with ONLY valid JSON."
)

ROUND_USER = """SCENARIO (the business shock being tested):
{scenario}

THE TARGET ENTITY at the center of the scenario: {target}
YOUR RELATIONSHIP TO THE TARGET (from the graph): {relation}

YOUR STRATEGIC ACTOR BRIEF:
{persona}

YOUR CURRENT STANCE: {stance}

WHAT OTHERS SAID LAST ROUND (respond to / build on this):
{others}

React to the scenario THIS round. You MUST:
- Take a clear position: support / oppose / neutral / observe.
- State the CONCRETE ACTION you would take if this scenario became real, and WHY (reference your dependencies / red lines / interests).
- State how your move affects THE TARGET and the other participants.
- Reference the scenario directly. Do NOT list or promote your products. Do NOT give a generic biography.

Output JSON:
{{
  "reaction": "support" | "oppose" | "neutral" | "observe",
  "statement": "your in-character reaction: position + concrete action + impact on target/others (2-3 sentences, <= 80 words)",
  "new_stance": "support" | "oppose" | "neutral" | "observe"
}}
"""

REPORT_SYSTEM = (
    "You are a senior strategy analyst writing a confidential MEMO for the leadership of the "
    "TARGET company about a 'what-if' scenario. The memo must be strategic and decision-oriented, "
    "not a factual recap of who supports or opposes. Synthesize the panel transcript into implications, "
    "market reshaping, risks (with severity), opportunities, and concrete recommended actions for the "
    "target. Respond with ONLY valid JSON."
)

REPORT_USER = """SCENARIO:
{scenario}

TARGET COMPANY: {target}

PANEL TRANSCRIPT (per round, per agent):
{transcript}

AGENT FINAL POSTURES (agent: stance — the move they would make):
{positions}

Write a strategy memo as JSON:
{{
  "implications_for_target": "2-3 sentence headline: what this scenario means for the target's business, concretely",
  "how_market_reshapes": "which agents gain or lose, and how the competitive balance shifts",
  "strategic_postures": [{{"agent": "name", "stance": "support|oppose|neutral|observe", "move": "the concrete move this agent would make"}}],
  "risks": [{{"risk": "knock-on risk or threat", "severity": "high|medium|low"}}],
  "opportunities": ["opportunities this scenario opens for the target or others"],
  "recommended_actions": ["2-3 concrete moves the target should make now to prepare / respond"],
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
    llm, persona: AgentPersona, scenario: str, others: str, target: str, relation: str, emit
) -> AgentStatement:
    user = ROUND_USER.format(
        scenario=scenario,
        target=target,
        relation=relation or "(no direct relationship recorded)",
        persona=persona.persona,
        stance=persona.stance,
        others=others or "(this is the first round)",
    )
    try:
        data = await llm.chat_json(ROUND_SYSTEM, user, temperature=0.4, max_tokens=512)
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
    target: str = "",
    graph: dict | None = None,
    emit=None,
) -> SimulationResult:
    rounds = max(1, min(5, int(rounds)))
    result = SimulationResult(scenario=scenario, agents=[p.to_dict() for p in personas])

    # relationship lookup: agent -> relation text to the target (by name)
    def relation_to_target(p: AgentPersona) -> str:
        if not graph:
            return ""
        name_by = {n.get("id"): n.get("name", n.get("id")) for n in graph.get("nodes", [])}
        target_name = target or graph.get("target", "")
        rels = []
        for e in graph.get("edges", []):
            s_name = name_by.get(e.get("source"), e.get("source"))
            t_name = name_by.get(e.get("target"), e.get("target"))
            if s_name == p.name and t_name == target_name:
                rels.append(f"you -> {e.get('type', 'related')} -> {target_name}")
            elif t_name == p.name and s_name == target_name:
                rels.append(f"{target_name} -> {e.get('type', 'related')} -> you")
        return "; ".join(rels) if rels else ""

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

        async def _one(p: AgentPersona):
            others = "\n".join(
                f"- {s['agent_name']}: {s['statement']}" for s in prev_round_statements if s["agent_id"] != p.id
            )
            st = await _agent_round(llm, p, scenario, others, target, relation_to_target(p), emit)
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
        shifted = sum(
            1 for aid, st in cur_stances.items()
            if _stance_shift(prev_stances.get(aid, str(st)), str(st))
        )
        prev_stances = cur_stances

        if until_stable and r >= 2 and shifted == 0:
            break
        r += 1

    if emit:
        await emit("simulating", "Synthesizing report from transcript...", r)
    transcript = "\n".join(transcript_lines)
    # strategic postures: stance + the agent's last-round move
    last_statements = {s["agent_id"]: s["statement"] for s in (result.rounds[-1]["statements"] if result.rounds else [])}
    positions = "\n".join(
        f"- {p.name}: {prev_stances.get(p.id, p.stance)} — {last_statements.get(p.id, '')}" for p in personas
    )
    report_user = REPORT_USER.format(scenario=scenario, target=target or "the target", transcript=transcript, positions=positions)
    try:
        report = await llm.chat_json(REPORT_SYSTEM, report_user, temperature=0.3, max_tokens=1400)
    except Exception:
        report = {
            "implications_for_target": "Simulation completed but report synthesis failed.",
            "strategic_postures": [{"agent": p.name, "stance": prev_stances.get(p.id, p.stance), "move": last_statements.get(p.id, "")} for p in personas],
            "risks": [],
            "opportunities": [],
            "recommended_actions": [],
            "overall_outcome": "uncertain",
        }
    result.report = report
    return result
