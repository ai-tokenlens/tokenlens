from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from server.database import get_db
from server.schemas.skill import SkillRatingCreate, SkillRatingRead
from server.services import registry_service

router = APIRouter(tags=["ratings"])


def _require_auth(authorization: Optional[str] = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    return authorization.removeprefix("Bearer ").strip()


@router.get("/skills/{skill_id}/ratings", response_model=List[SkillRatingRead])
def list_ratings(skill_id: str, db: Session = Depends(get_db)):
    if registry_service.get_skill(db, skill_id) is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    return registry_service.list_ratings(db, skill_id)


@router.post("/skills/{skill_id}/ratings", response_model=SkillRatingRead, status_code=201)
def upsert_rating(
    skill_id: str,
    data: SkillRatingCreate,
    db: Session = Depends(get_db),
    token: str = Depends(_require_auth),
):
    rating = registry_service.upsert_rating(db, skill_id, user_id=token, data=data)
    if rating is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    return rating
