from __future__ import annotations

import datetime
import uuid

import pytest

from server.models.usage_event import UsageEvent
from server.services import analytics_service


def _ev(
    user_id: str,
    tool: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    total_tokens: int,
    timestamp: datetime.datetime,
    skill_id: str | None = None,
    cache_read_tokens: int = 0,
    cache_write_tokens: int = 0,
) -> UsageEvent:
    return UsageEvent(
        id=str(uuid.uuid4()),
        user_id=user_id,
        tool=tool,
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cache_read_tokens=cache_read_tokens,
        cache_write_tokens=cache_write_tokens,
        total_tokens=total_tokens,
        skill_id=skill_id,
        source="session-file",
        timestamp=timestamp,
    )


DAY1 = datetime.datetime(2026, 1, 10, 12, 0, 0)
DAY2 = datetime.datetime(2026, 1, 11, 12, 0, 0)
DAY3 = datetime.datetime(2026, 1, 12, 12, 0, 0)


@pytest.fixture()
def populated(session):
    events = [
        _ev("alice", "claude-code", "claude-sonnet-4-6", 100, 50, 150, DAY1, skill_id="skill-a"),
        _ev("alice", "claude-code", "claude-sonnet-4-6", 200, 80, 280, DAY2, skill_id="skill-a"),
        _ev("bob",   "copilot-cli", "gpt-4o",           300, 100, 400, DAY2),
        _ev("bob",   "copilot-cli", "gpt-4o",           50,  20,  70,  DAY3),
        _ev("carol", "claude-code", "claude-haiku-4-5-20251001", 80, 30, 110, DAY1, skill_id="skill-b"),
        _ev("carol", "claude-code", "claude-haiku-4-5-20251001", 60, 25,  85,  DAY3),
    ]
    for e in events:
        session.add(e)
    session.commit()
    return session


# ── summary totals ──────────────────────────────────────────────────────────

def test_summary_totals(populated):
    result = analytics_service.get_summary(populated)
    assert result.totals.total_tokens == 150 + 280 + 400 + 70 + 110 + 85
    assert result.totals.input_tokens == 100 + 200 + 300 + 50 + 80 + 60


def test_summary_filter_user(populated):
    result = analytics_service.get_summary(populated, user_id="alice")
    assert result.totals.total_tokens == 150 + 280


def test_summary_filter_tool(populated):
    result = analytics_service.get_summary(populated, tool="copilot-cli")
    assert result.totals.total_tokens == 400 + 70


def test_summary_filter_date_range(populated):
    result = analytics_service.get_summary(
        populated,
        from_=datetime.date(2026, 1, 11),
        to=datetime.date(2026, 1, 11),
    )
    # only DAY2 events: alice 280 + bob 400
    assert result.totals.total_tokens == 280 + 400


def test_summary_by_tool_keys(populated):
    result = analytics_service.get_summary(populated)
    tools = {item.key for item in result.by_tool}
    assert tools == {"claude-code", "copilot-cli"}


def test_summary_by_day_ordering(populated):
    result = analytics_service.get_summary(populated)
    dates = [d.date for d in result.by_day]
    assert dates == sorted(dates)


# ── top consumers ───────────────────────────────────────────────────────────

def test_top_consumers_order(populated):
    consumers = analytics_service.get_top_consumers(populated)
    totals = [c.total_tokens for c in consumers]
    assert totals == sorted(totals, reverse=True)


def test_top_consumers_limit(populated):
    consumers = analytics_service.get_top_consumers(populated, limit=2)
    assert len(consumers) <= 2


def test_top_consumers_event_count(populated):
    consumers = analytics_service.get_top_consumers(populated)
    by_user = {c.user_id: c for c in consumers}
    assert by_user["alice"].event_count == 2
    assert by_user["bob"].event_count == 2


# ── skill efficiency ────────────────────────────────────────────────────────

def test_skill_efficiency_excludes_no_skill(populated):
    skills = analytics_service.get_skill_efficiency(populated)
    skill_ids = {s.skill_id for s in skills}
    # bob's events have no skill_id → must not appear
    assert "None" not in skill_ids
    assert None not in skill_ids


def test_skill_efficiency_avg_ascending(populated):
    skills = analytics_service.get_skill_efficiency(populated)
    avgs = [s.avg_tokens for s in skills]
    assert avgs == sorted(avgs)


def test_skill_efficiency_values(populated):
    skills = analytics_service.get_skill_efficiency(populated)
    by_id = {s.skill_id: s for s in skills}
    # skill-a: avg of 150+280 / 2 = 215
    assert by_id["skill-a"].avg_tokens == pytest.approx(215.0)
    # skill-b: avg of 110 / 1 = 110
    assert by_id["skill-b"].avg_tokens == pytest.approx(110.0)


# ── by day ──────────────────────────────────────────────────────────────────

def test_by_day_grouping(populated):
    days = analytics_service.get_by_day(populated)
    assert len(days) == 3  # DAY1, DAY2, DAY3


def test_by_day_filter_user(populated):
    days = analytics_service.get_by_day(populated, user_id="bob")
    assert len(days) == 2
    total = sum(d.total_tokens for d in days)
    assert total == 400 + 70


def test_by_day_date_range(populated):
    days = analytics_service.get_by_day(
        populated,
        from_=datetime.date(2026, 1, 11),
        to=datetime.date(2026, 1, 12),
    )
    assert len(days) == 2
    dates = [d.date for d in days]
    assert "2026-01-10" not in dates
