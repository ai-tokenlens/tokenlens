from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from server.config import settings
from server.database import get_db
from server.models.usage_event import UsageEvent
from server.models.user import User
from server.schemas.event_schema import BatchIngest, EventIngest

router = APIRouter(tags=["events"])


def _verify_token(request: Request) -> None:
    api_key = request.headers.get("X-API-Key", "")
    if api_key == settings.ingest_token:
        return
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer ") and auth[7:] == settings.ingest_token:
        return
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid ingest token")


def _upsert_user(db: Session, user_id: str) -> None:
    if not db.get(User, user_id):
        db.add(User(id=user_id))
        db.flush()


def _build_event(ev: EventIngest) -> UsageEvent:
    data = ev.model_dump()
    return UsageEvent(id=str(uuid4()), source="session-file", **data)


@router.post("/events", status_code=status.HTTP_201_CREATED)
def ingest_event(
    event: EventIngest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    _verify_token(request)
    _upsert_user(db, event.user_id)
    db.add(_build_event(event))
    db.commit()
    return {"accepted": 1}


@router.post("/events/batch", status_code=status.HTTP_201_CREATED)
def ingest_batch(
    payload: BatchIngest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    _verify_token(request)
    for uid in {e.user_id for e in payload.events}:
        _upsert_user(db, uid)
    for ev in payload.events:
        db.add(_build_event(ev))
    db.commit()
    return {"accepted": len(payload.events)}
