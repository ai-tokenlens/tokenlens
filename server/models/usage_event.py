from __future__ import annotations

from typing import Optional
import datetime

from sqlalchemy import String, Integer, DateTime, Text, Index, func
from sqlalchemy.orm import Mapped, mapped_column

from server.models.base import Base


class UsageEvent(Base):
    __tablename__ = "usage_events"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # UUID v4
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    tool: Mapped[str] = mapped_column(String, nullable=False)   # "copilot-cli" | "claude-code"
    model: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cache_read_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cache_write_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    skill_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    source: Mapped[str] = mapped_column(String, nullable=False)  # "otel" | "session-file"
    context: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    trace_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    timestamp: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_events_user_ts", "user_id", "timestamp"),
        Index("idx_events_tool_ts", "tool", "timestamp"),
    )
