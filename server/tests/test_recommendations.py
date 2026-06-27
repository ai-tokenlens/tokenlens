from __future__ import annotations

import datetime
import json
import uuid

import pytest

from server.models.skill import Skill
from server.models.usage_event import UsageEvent
from server.services.recommendation_engine import (
    rule_context_bloat,
    rule_efficient_swap,
    rule_skill_gap,
)

NOW = datetime.datetime.utcnow()
RECENT = NOW - datetime.timedelta(days=10)
OLD = NOW - datetime.timedelta(days=60)


def _ev(
    user_id: str,
    total_tokens: int,
    input_tokens: int = 0,
    language: str | None = None,
    skill_id: str | None = None,
    timestamp: datetime.datetime | None = None,
) -> UsageEvent:
    ctx = json.dumps({"language": language}) if language else None
    return UsageEvent(
        id=str(uuid.uuid4()),
        user_id=user_id,
        tool="claude-code",
        model="claude-sonnet-4-6",
        input_tokens=input_tokens,
        output_tokens=0,
        cache_read_tokens=0,
        cache_write_tokens=0,
        total_tokens=total_tokens,
        skill_id=skill_id,
        source="session-file",
        context=ctx,
        timestamp=timestamp or RECENT,
    )


def _skill(name: str, avg_tokens: int, tags: list[str]) -> Skill:
    return Skill(
        id=str(uuid.uuid4()),
        name=name,
        summary=name,
        tags=json.dumps(tags),
        origin="local",
        latest_version="1.0.0",
        avg_tokens=avg_tokens,
        use_count=0,
        rating_avg=0.0,
        rating_count=0,
    )


# ── Rule 1: Skill Gap ─────────────────────────────────────────────────────────

@pytest.fixture()
def skill_gap_data(session):
    skill = _skill("Python Explainer", avg_tokens=200, tags=["python"])
    session.add(skill)
    # 6 python events without skill_id → triggers rule
    for _ in range(6):
        session.add(_ev("alice", total_tokens=500, language="python"))
    session.commit()
    return session, skill


def test_rule_skill_gap_triggers(skill_gap_data):
    session, skill = skill_gap_data
    recs = rule_skill_gap(session, "alice")
    assert len(recs) == 1
    r = recs[0]
    assert r["type"] == "skill_gap"
    assert r["skill_id"] == skill.id
    assert r["potential_savings_tokens"] == 500 - 200
    assert r["potential_savings_pct"] == pytest.approx(60.0)


def test_rule_skill_gap_no_trigger_under_threshold(session):
    skill = _skill("Python Explainer", avg_tokens=200, tags=["python"])
    session.add(skill)
    # Only 5 events — rule needs >5
    for _ in range(5):
        session.add(_ev("alice", total_tokens=500, language="python"))
    session.commit()
    recs = rule_skill_gap(session, "alice")
    assert recs == []


def test_rule_skill_gap_no_trigger_when_skill_not_cheaper(session):
    # Skill is more expensive than user avg → no saving
    skill = _skill("Python Explainer", avg_tokens=600, tags=["python"])
    session.add(skill)
    for _ in range(6):
        session.add(_ev("alice", total_tokens=500, language="python"))
    session.commit()
    recs = rule_skill_gap(session, "alice")
    assert recs == []


# ── Rule 2: Context Bloat ─────────────────────────────────────────────────────

@pytest.fixture()
def bloat_data(session):
    # alice: high input tokens (recent)
    for _ in range(5):
        session.add(_ev("alice", total_tokens=1000, input_tokens=1500, timestamp=RECENT))
    # bob + carol: low input tokens (recent) — keeps team avg low
    for _ in range(10):
        session.add(_ev("bob", total_tokens=300, input_tokens=200, timestamp=RECENT))
    for _ in range(10):
        session.add(_ev("carol", total_tokens=300, input_tokens=200, timestamp=RECENT))
    session.commit()
    return session


def test_rule_context_bloat_triggers(bloat_data):
    recs = rule_context_bloat(bloat_data, "alice")
    assert len(recs) == 1
    r = recs[0]
    assert r["type"] == "context_bloat"
    assert r["skill_id"] is None
    assert r["potential_savings_tokens"] > 0


def test_rule_context_bloat_no_trigger_within_threshold(session):
    # alice and everyone else have similar input tokens
    for _ in range(5):
        session.add(_ev("alice", total_tokens=500, input_tokens=400, timestamp=RECENT))
    for _ in range(5):
        session.add(_ev("bob", total_tokens=500, input_tokens=350, timestamp=RECENT))
    session.commit()
    recs = rule_context_bloat(session, "alice")
    assert recs == []


def test_rule_context_bloat_ignores_old_events(session):
    # alice has high input tokens but only OLD events (>30 days)
    for _ in range(5):
        session.add(_ev("alice", total_tokens=1000, input_tokens=2000, timestamp=OLD))
    for _ in range(5):
        session.add(_ev("bob", total_tokens=300, input_tokens=200, timestamp=OLD))
    # No recent events at all → user_avg scalar is None
    session.commit()
    recs = rule_context_bloat(session, "alice")
    assert recs == []


# ── Rule 3: Efficient Swap ────────────────────────────────────────────────────

@pytest.fixture()
def swap_data(session):
    # alice: manual python sessions averaging 1000 tokens
    for _ in range(3):
        session.add(_ev("alice", total_tokens=1000, language="python"))
    # skill for python averaging 600 tokens → 60% of user avg, below 70% threshold
    skill = _skill("Lean Python", avg_tokens=600, tags=["python"])
    session.add(skill)
    session.commit()
    return session, skill


def test_rule_efficient_swap_triggers(swap_data):
    session, skill = swap_data
    recs = rule_efficient_swap(session, "alice")
    assert len(recs) == 1
    r = recs[0]
    assert r["type"] == "efficient_swap"
    assert r["skill_id"] == skill.id
    assert r["potential_savings_tokens"] == 1000 - 600
    assert r["potential_savings_pct"] == pytest.approx(40.0)


def test_rule_efficient_swap_no_trigger_when_skill_above_70pct(session):
    # Skill avg = 750 = 75% of 1000 → above 70% threshold, no swap
    skill = _skill("Lean Python", avg_tokens=750, tags=["python"])
    session.add(skill)
    for _ in range(3):
        session.add(_ev("alice", total_tokens=1000, language="python"))
    session.commit()
    recs = rule_efficient_swap(session, "alice")
    assert recs == []


def test_rule_efficient_swap_events_with_skill_excluded(session):
    # Events that already have a skill_id don't count as "manual"
    skill = _skill("Lean Python", avg_tokens=300, tags=["python"])
    session.add(skill)
    # All alice events already have skill_id → no manual avg → no swap
    for _ in range(3):
        session.add(_ev("alice", total_tokens=1000, language="python", skill_id=skill.id))
    session.commit()
    recs = rule_efficient_swap(session, "alice")
    assert recs == []
