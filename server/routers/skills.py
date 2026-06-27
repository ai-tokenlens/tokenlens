from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from server.database import get_db
from server.schemas.skill import (
    SkillCreate,
    SkillRead,
    SkillUpdate,
    SkillVersionRead,
)
from server.services import registry_service

router = APIRouter(tags=["skills"])


def _require_auth(authorization: Optional[str] = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    return authorization.removeprefix("Bearer ").strip()


@router.get("/skills", response_model=List[SkillRead])
def list_skills(
    tag: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    sort: str = Query(default="new"),
    db: Session = Depends(get_db),
):
    return registry_service.list_skills(db, tag=tag, search=search, sort=sort)


@router.get("/skills/{skill_id}", response_model=SkillRead)
def get_skill(skill_id: str, db: Session = Depends(get_db)):
    skill = registry_service.get_skill(db, skill_id)
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


@router.get("/skills/{skill_id}/versions", response_model=List[SkillVersionRead])
def list_versions(skill_id: str, db: Session = Depends(get_db)):
    if registry_service.get_skill(db, skill_id) is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    return registry_service.list_versions(db, skill_id)


@router.post("/skills", response_model=SkillRead, status_code=201)
def create_skill(
    data: SkillCreate,
    db: Session = Depends(get_db),
    _token: str = Depends(_require_auth),
):
    return registry_service.create_skill(db, data)


@router.put("/skills/{skill_id}", response_model=SkillRead)
def update_skill(
    skill_id: str,
    data: SkillUpdate,
    db: Session = Depends(get_db),
    _token: str = Depends(_require_auth),
):
    skill = registry_service.update_skill(db, skill_id, data)
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


@router.delete("/skills/{skill_id}", status_code=204)
def delete_skill(
    skill_id: str,
    db: Session = Depends(get_db),
    _token: str = Depends(_require_auth),
):
    if not registry_service.soft_delete_skill(db, skill_id):
        raise HTTPException(status_code=404, detail="Skill not found")
