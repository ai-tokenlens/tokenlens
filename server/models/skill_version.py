from __future__ import annotations

import datetime

from sqlalchemy import String, DateTime, Text, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from server.models.base import Base


class SkillVersion(Base):
    __tablename__ = "skill_versions"

    id: Mapped[str] = mapped_column(String, primary_key=True)          # UUID
    skill_id: Mapped[str] = mapped_column(String, ForeignKey("skills.id"), nullable=False)
    version: Mapped[str] = mapped_column(String, nullable=False)        # semver
    manifest_toml: Mapped[str] = mapped_column(Text, nullable=False)
    payload_uri: Mapped[str] = mapped_column(String, nullable=False)    # blob store location
    checksum: Mapped[str] = mapped_column(String, nullable=False)       # sha256
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    skill: Mapped["Skill"] = relationship("Skill", back_populates="versions")

    __table_args__ = (UniqueConstraint("skill_id", "version", name="uq_skill_version"),)
