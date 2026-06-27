from __future__ import annotations

from typing import Optional
import datetime

from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from server.models.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # email or github login
    display_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    github_login: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    team: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
