from __future__ import annotations

from typing import Optional, List
import datetime

from sqlalchemy import String, Integer, Float, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from server.models.base import Base


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    summary: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    usage: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[str]] = mapped_column(Text, nullable=True)       # JSON array
    author: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    origin: Mapped[str] = mapped_column(String, nullable=False)            # "local" | "remote"
    origin_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    latest_version: Mapped[str] = mapped_column(String, nullable=False, default="1.0.0")
    avg_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    use_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rating_avg: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    rating_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    deleted_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    versions: Mapped[List["SkillVersion"]] = relationship("SkillVersion", back_populates="skill", cascade="all, delete-orphan")
    ratings: Mapped[List["SkillRating"]] = relationship("SkillRating", back_populates="skill", cascade="all, delete-orphan")
