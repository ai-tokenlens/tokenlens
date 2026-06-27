from __future__ import annotations

from typing import Optional, Any, List
import datetime
import json

from pydantic import BaseModel, Field, field_validator, model_validator


class EventIngest(BaseModel):
    user_id: str
    tool: str
    model: Optional[str] = None
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    total_tokens: int = 0
    skill_id: Optional[str] = None
    context: Optional[Any] = None
    trace_id: Optional[str] = None
    timestamp: datetime.datetime

    @field_validator("context", mode="before")
    @classmethod
    def serialize_context(cls, v: Any) -> Any:
        if isinstance(v, dict):
            return json.dumps(v)
        return v

    @model_validator(mode="after")
    def fill_total(self) -> "EventIngest":
        if self.total_tokens == 0:
            self.total_tokens = (
                self.input_tokens
                + self.output_tokens
                + self.cache_read_tokens
                + self.cache_write_tokens
            )
        return self


class BatchIngest(BaseModel):
    events: List[EventIngest] = Field(..., max_length=100)
