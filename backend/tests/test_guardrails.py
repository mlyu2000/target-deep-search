from app.simulation.engine import check_guardrails


def test_check_guardrails_flags_predatory_language():
    report = {"recommended_actions": [
        "Boycott the new entrant to protect share",
        "Invest in R&D to stay ahead",
        "Acquire to neutralize the competitor",
    ]}
    flags = check_guardrails(report)
    reasons = " ".join(f["reason"] for f in flags)
    assert any("boycott" in f["action"].lower() for f in flags)
    assert any("acquire to neutralize" in f["action"].lower() for f in flags)
    assert "boycott" in reasons or "anti-competitive" in reasons
    # safe action not flagged
    assert not any("invest in r&d" in f["action"].lower() for f in flags)


def test_check_guardrails_empty_when_clean():
    report = {"recommended_actions": ["Diversify supply chain", "Accelerate roadmap"]}
    assert check_guardrails(report) == []
