from __future__ import annotations

import datetime
from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from server.database import get_db
from server.models.usage_event import UsageEvent
from server.models.user import User

router = APIRouter(prefix="/users", tags=["users"])


class UserOut(BaseModel):
    id: str
    created_at: datetime.datetime
    event_count: int

    model_config = {"from_attributes": True}


@router.get("", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db)):
    rows = (
        db.query(User, func.count(UsageEvent.id).label("event_count"))
        .outerjoin(UsageEvent, UsageEvent.user_id == User.id)
        .group_by(User.id)
        .order_by(func.count(UsageEvent.id).desc())
        .all()
    )
    return [
        UserOut(id=u.id, created_at=u.created_at, event_count=cnt)
        for u, cnt in rows
    ]
