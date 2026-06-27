from __future__ import annotations

import datetime
import json
import uuid
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from server.models.skill import Skill
from server.models.skill_rating import SkillRating
from server.models.skill_version import SkillVersion
from server.schemas.skill import SkillCreate, SkillRatingCreate, SkillUpdate


def create_skill(db: Session, data: SkillCreate) -> Skill:
    tags_json = json.dumps(data.tags) if data.tags is not None else None
    skill = Skill(
        id=data.id,
        name=data.name,
        summary=data.summary,
        description=data.description,
        usage=data.usage,
        tags=tags_json,
        author=data.author,
        origin=data.origin,
        origin_url=data.origin_url,
        latest_version=data.latest_version,
    )
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


def get_skill(db: Session, skill_id: str) -> Optional[Skill]:
    stmt = select(Skill).where(Skill.id == skill_id, Skill.deleted_at.is_(None))
    return db.execute(stmt).scalar_one_or_none()


def list_skills(
    db: Session,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    sort: str = "new",
) -> List[Skill]:
    stmt = select(Skill).where(Skill.deleted_at.is_(None))

    if tag:
        stmt = stmt.where(Skill.tags.like(f'%"{tag}"%'))

    if search:
        term = f"%{search}%"
        stmt = stmt.where(
            (Skill.name.ilike(term))
            | (Skill.summary.ilike(term))
            | (Skill.tags.ilike(term))
        )

    if sort == "rating":
        stmt = stmt.order_by(Skill.rating_avg.desc())
    elif sort == "efficiency":
        stmt = stmt.order_by(Skill.avg_tokens.asc())
    elif sort == "popular":
        stmt = stmt.order_by(Skill.use_count.desc())
    else:
        stmt = stmt.order_by(Skill.created_at.desc())

    return list(db.execute(stmt).scalars().all())


def _bump_patch(version: str) -> str:
    parts = version.split(".")
    try:
        parts[-1] = str(int(parts[-1]) + 1)
    except (ValueError, IndexError):
        parts.append("1")
    return ".".join(parts)


def update_skill(db: Session, skill_id: str, data: SkillUpdate) -> Optional[Skill]:
    skill = get_skill(db, skill_id)
    if skill is None:
        return None

    if data.name is not None:
        skill.name = data.name
    if data.summary is not None:
        skill.summary = data.summary
    if data.description is not None:
        skill.description = data.description
    if data.usage is not None:
        skill.usage = data.usage
    if data.tags is not None:
        skill.tags = json.dumps(data.tags)
    if data.author is not None:
        skill.author = data.author

    new_version = _bump_patch(skill.latest_version)
    skill.latest_version = new_version
    skill.updated_at = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

    sv = SkillVersion(
        id=str(uuid.uuid4()),
        skill_id=skill.id,
        version=new_version,
        manifest_toml=data.manifest_toml or "",
        payload_uri=data.payload_uri or "",
        checksum=data.checksum or "",
    )
    db.add(sv)
    db.commit()
    db.refresh(skill)
    return skill


def soft_delete_skill(db: Session, skill_id: str) -> bool:
    skill = get_skill(db, skill_id)
    if skill is None:
        return False
    skill.deleted_at = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    db.commit()
    return True


def _recompute_rating(db: Session, skill_id: str) -> None:
    result = db.execute(
        select(func.avg(SkillRating.stars), func.count(SkillRating.id)).where(
            SkillRating.skill_id == skill_id
        )
    ).one()
    avg, count = result
    skill = db.get(Skill, skill_id)
    if skill:
        skill.rating_avg = round(float(avg or 0), 2)
        skill.rating_count = count or 0
        db.commit()


def upsert_rating(
    db: Session, skill_id: str, user_id: str, data: SkillRatingCreate
) -> Optional[SkillRating]:
    if get_skill(db, skill_id) is None:
        return None

    stmt = select(SkillRating).where(
        SkillRating.skill_id == skill_id, SkillRating.user_id == user_id
    )
    rating = db.execute(stmt).scalar_one_or_none()

    if rating is None:
        rating = SkillRating(
            id=str(uuid.uuid4()),
            skill_id=skill_id,
            user_id=user_id,
            stars=data.stars,
            comment=data.comment,
        )
        db.add(rating)
    else:
        rating.stars = data.stars
        rating.comment = data.comment

    db.commit()
    db.refresh(rating)
    _recompute_rating(db, skill_id)
    return rating


def list_ratings(db: Session, skill_id: str) -> List[SkillRating]:
    stmt = select(SkillRating).where(SkillRating.skill_id == skill_id)
    return list(db.execute(stmt).scalars().all())


def list_versions(db: Session, skill_id: str) -> List[SkillVersion]:
    stmt = select(SkillVersion).where(SkillVersion.skill_id == skill_id)
    return list(db.execute(stmt).scalars().all())
