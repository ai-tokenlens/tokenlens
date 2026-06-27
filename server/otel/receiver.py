from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from server.config import settings
from server.database import get_db
from server.models.usage_event import UsageEvent
from server.otel.genai_mapper import (
    extract_usage_events_from_metrics,
    extract_usage_events_from_traces,
)

router = APIRouter(tags=["otel"])


def _verify_token(request: Request) -> None:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer ") or auth[7:] != settings.ingest_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid ingest token")


def _persist_events(event_dicts: list[dict], db: Session) -> int:
    """Persist UsageEvent records; skip duplicates by trace_id. Returns count inserted."""
    if not event_dicts:
        return 0

    deduped_trace_ids = {e["trace_id"] for e in event_dicts if e.get("trace_id")}
    existing: set[str] = set()
    if deduped_trace_ids:
        existing = {
            row[0]
            for row in db.query(UsageEvent.trace_id)
            .filter(UsageEvent.trace_id.in_(deduped_trace_ids))
            .all()
        }

    inserted = 0
    for ev in event_dicts:
        tid = ev.get("trace_id")
        if tid and tid in existing:
            continue
        db.add(UsageEvent(**ev))
        if tid:
            existing.add(tid)
        inserted += 1

    db.commit()
    return inserted


@router.post("/v1/traces", status_code=status.HTTP_200_OK)
async def ingest_traces(request: Request, db: Session = Depends(get_db)):
    _verify_token(request)
    payload = await request.json()
    count = _persist_events(extract_usage_events_from_traces(payload), db)
    return {"accepted": count}


@router.post("/v1/metrics", status_code=status.HTTP_200_OK)
async def ingest_metrics(request: Request, db: Session = Depends(get_db)):
    _verify_token(request)
    payload = await request.json()
    count = _persist_events(extract_usage_events_from_metrics(payload), db)
    return {"accepted": count}
