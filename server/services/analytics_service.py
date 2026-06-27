from __future__ import annotations

import datetime
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from server.models.usage_event import UsageEvent
from server.schemas.analytics_schema import (
    ByDay,
    ByKey,
    SkillEfficiency,
    SummaryResponse,
    TokenTotals,
    TopConsumer,
)


def _apply_filters(
    q,
    user_id: Optional[str],
    from_: Optional[datetime.date],
    to: Optional[datetime.date],
    tool: Optional[str],
):
    if user_id:
        q = q.filter(UsageEvent.user_id == user_id)
    if tool:
        q = q.filter(UsageEvent.tool == tool)
    if from_:
        q = q.filter(UsageEvent.timestamp >= datetime.datetime.combine(from_, datetime.time.min))
    if to:
        q = q.filter(UsageEvent.timestamp <= datetime.datetime.combine(to, datetime.time.max))
    return q


def _group_by_col(q, col) -> List[ByKey]:
    rows = (
        q.with_entities(
            col,
            func.coalesce(func.sum(UsageEvent.total_tokens), 0),
            func.coalesce(func.sum(UsageEvent.input_tokens), 0),
            func.coalesce(func.sum(UsageEvent.output_tokens), 0),
        )
        .group_by(col)
        .order_by(func.sum(UsageEvent.total_tokens).desc())
        .all()
    )
    return [
        ByKey(key=str(r[0] or "unknown"), total_tokens=r[1], input_tokens=r[2], output_tokens=r[3])
        for r in rows
    ]


def get_summary(
    session: Session,
    user_id: Optional[str] = None,
    from_: Optional[datetime.date] = None,
    to: Optional[datetime.date] = None,
    tool: Optional[str] = None,
) -> SummaryResponse:
    q = _apply_filters(session.query(UsageEvent), user_id, from_, to, tool)

    row = q.with_entities(
        func.coalesce(func.sum(UsageEvent.input_tokens), 0),
        func.coalesce(func.sum(UsageEvent.output_tokens), 0),
        func.coalesce(func.sum(UsageEvent.cache_read_tokens), 0),
        func.coalesce(func.sum(UsageEvent.cache_write_tokens), 0),
        func.coalesce(func.sum(UsageEvent.total_tokens), 0),
    ).one()

    totals = TokenTotals(
        input_tokens=row[0],
        output_tokens=row[1],
        cache_read_tokens=row[2],
        cache_write_tokens=row[3],
        total_tokens=row[4],
    )

    by_user = _group_by_col(q, UsageEvent.user_id)
    by_tool = _group_by_col(q, UsageEvent.tool)
    by_model = _group_by_col(q, UsageEvent.model)

    day_rows = (
        q.with_entities(
            func.strftime("%Y-%m-%d", UsageEvent.timestamp).label("day"),
            func.coalesce(func.sum(UsageEvent.total_tokens), 0),
            func.coalesce(func.sum(UsageEvent.input_tokens), 0),
            func.coalesce(func.sum(UsageEvent.output_tokens), 0),
        )
        .group_by("day")
        .order_by("day")
        .all()
    )
    by_day = [ByDay(date=r[0], total_tokens=r[1], input_tokens=r[2], output_tokens=r[3]) for r in day_rows]

    return SummaryResponse(totals=totals, by_user=by_user, by_tool=by_tool, by_model=by_model, by_day=by_day)


def get_top_consumers(
    session: Session,
    from_: Optional[datetime.date] = None,
    to: Optional[datetime.date] = None,
    limit: int = 10,
) -> List[TopConsumer]:
    q = _apply_filters(session.query(UsageEvent), None, from_, to, None)
    rows = (
        q.with_entities(
            UsageEvent.user_id,
            func.coalesce(func.sum(UsageEvent.total_tokens), 0),
            func.coalesce(func.sum(UsageEvent.input_tokens), 0),
            func.coalesce(func.sum(UsageEvent.output_tokens), 0),
            func.count(UsageEvent.id),
        )
        .group_by(UsageEvent.user_id)
        .order_by(func.sum(UsageEvent.total_tokens).desc())
        .limit(limit)
        .all()
    )
    return [
        TopConsumer(user_id=r[0], total_tokens=r[1], input_tokens=r[2], output_tokens=r[3], event_count=r[4])
        for r in rows
    ]


def get_skill_efficiency(session: Session) -> List[SkillEfficiency]:
    rows = (
        session.query(UsageEvent)
        .filter(UsageEvent.skill_id.isnot(None))
        .with_entities(
            UsageEvent.skill_id,
            func.avg(UsageEvent.total_tokens).label("avg_tokens"),
            func.coalesce(func.sum(UsageEvent.total_tokens), 0),
            func.count(UsageEvent.id),
        )
        .group_by(UsageEvent.skill_id)
        .order_by(func.avg(UsageEvent.total_tokens).asc())
        .all()
    )
    return [
        SkillEfficiency(skill_id=r[0], avg_tokens=float(r[1]), total_tokens=r[2], event_count=r[3])
        for r in rows
    ]


def get_by_day(
    session: Session,
    user_id: Optional[str] = None,
    from_: Optional[datetime.date] = None,
    to: Optional[datetime.date] = None,
) -> List[ByDay]:
    q = _apply_filters(session.query(UsageEvent), user_id, from_, to, None)
    rows = (
        q.with_entities(
            func.strftime("%Y-%m-%d", UsageEvent.timestamp).label("day"),
            func.coalesce(func.sum(UsageEvent.total_tokens), 0),
            func.coalesce(func.sum(UsageEvent.input_tokens), 0),
            func.coalesce(func.sum(UsageEvent.output_tokens), 0),
        )
        .group_by("day")
        .order_by("day")
        .all()
    )
    return [ByDay(date=r[0], total_tokens=r[1], input_tokens=r[2], output_tokens=r[3]) for r in rows]
