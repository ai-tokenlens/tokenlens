from __future__ import annotations

from typing import Optional, Any
import datetime

from pydantic import BaseModel, field_validator
import json


class UsageEventCreate(BaseModel):
    id: str
    user_id: str
    tool: str
    model: Optional[str] = None
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    total_tokens: int = 0
    skill_id: Optional[str] = None
    source: str
    context: Optional[Any] = None   # dict → stored as JSON string
    trace_id: Optional[str] = None
    timestamp: datetime.datetime

    @field_validator("context", mode="before")
    @classmethod
    def serialize_context(cls, v):
        if isinstance(v, dict):
            return json.dumps(v)
        return v


class UsageEventRead(BaseModel):
    id: str
    user_id: str
    tool: str
    model: Optional[str] = None
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int
    cache_write_tokens: int
    total_tokens: int
    skill_id: Optional[str] = None
    source: str
    context: Optional[Any] = None
    trace_id: Optional[str] = None
    timestamp: datetime.datetime
    created_at: datetime.datetime

    model_config = {"from_attributes": True}

    @field_validator("context", mode="before")
    @classmethod
    def deserialize_context(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (ValueError, TypeError):
                return v
        return v
