from __future__ import annotations

from typing import Optional
import datetime

from sqlalchemy import String, Integer, DateTime, Text, ForeignKey, UniqueConstraint, CheckConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from server.models.base import Base


class SkillRating(Base):
    __tablename__ = "skill_ratings"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    skill_id: Mapped[str] = mapped_column(String, ForeignKey("skills.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    stars: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    skill: Mapped["Skill"] = relationship("Skill", back_populates="ratings")

    __table_args__ = (
        UniqueConstraint("skill_id", "user_id", name="uq_rating_skill_user"),
        CheckConstraint("stars BETWEEN 1 AND 5", name="ck_stars_range"),
    )
