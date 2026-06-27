from __future__ import annotations

import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from server.database import get_db
from server.schemas.analytics_schema import (
    ByDayResponse,
    SkillEfficiencyResponse,
    SummaryResponse,
    TopConsumersResponse,
)
from server.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary", response_model=SummaryResponse)
def summary(
    user_id: Optional[str] = Query(None),
    from_: Optional[datetime.date] = Query(None, alias="from"),
    to: Optional[datetime.date] = Query(None),
    tool: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return analytics_service.get_summary(db, user_id=user_id, from_=from_, to=to, tool=tool)


@router.get("/top-consumers", response_model=TopConsumersResponse)
def top_consumers(
    limit: int = Query(10, ge=1, le=100),
    from_: Optional[datetime.date] = Query(None, alias="from"),
    to: Optional[datetime.date] = Query(None),
    db: Session = Depends(get_db),
):
    consumers = analytics_service.get_top_consumers(db, from_=from_, to=to, limit=limit)
    return TopConsumersResponse(consumers=consumers)


@router.get("/skill-efficiency", response_model=SkillEfficiencyResponse)
def skill_efficiency(db: Session = Depends(get_db)):
    skills = analytics_service.get_skill_efficiency(db)
    return SkillEfficiencyResponse(skills=skills)


@router.get("/by-day", response_model=ByDayResponse)
def by_day(
    user_id: Optional[str] = Query(None),
    from_: Optional[datetime.date] = Query(None, alias="from"),
    to: Optional[datetime.date] = Query(None),
    db: Session = Depends(get_db),
):
    days = analytics_service.get_by_day(db, user_id=user_id, from_=from_, to=to)
    return ByDayResponse(days=days)
