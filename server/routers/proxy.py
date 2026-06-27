from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from server.database import get_db
from server.services import proxy_service

router = APIRouter(tags=["proxy"])


class ResolveRequest(BaseModel):
    origin_url: str


@router.post("/proxy/resolve")
def resolve_proxy(body: ResolveRequest, db: Session = Depends(get_db)):
    try:
        skill_id = proxy_service.fetch_and_cache(db, body.origin_url)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return {"skill_id": skill_id}
