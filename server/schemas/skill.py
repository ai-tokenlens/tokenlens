from __future__ import annotations

from typing import Optional, List, Any
import datetime
import json

from pydantic import BaseModel, field_validator


class SkillCreate(BaseModel):
    id: str
    name: str
    summary: str
    description: Optional[str] = None
    usage: Optional[str] = None
    tags: Optional[List[str]] = None
    author: Optional[str] = None
    origin: str
    origin_url: Optional[str] = None
    latest_version: str = "1.0.0"

    @field_validator("tags", mode="before")
    @classmethod
    def parse_tags(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v


class SkillRead(BaseModel):
    id: str
    name: str
    summary: str
    description: Optional[str] = None
    usage: Optional[str] = None
    tags: Optional[List[str]] = None
    author: Optional[str] = None
    origin: str
    origin_url: Optional[str] = None
    latest_version: str
    avg_tokens: int
    use_count: int
    rating_avg: float
    rating_count: int
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = {"from_attributes": True}

    @field_validator("tags", mode="before")
    @classmethod
    def parse_tags(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (ValueError, TypeError):
                return []
        return v


class SkillUpdate(BaseModel):
    name: Optional[str] = None
    summary: Optional[str] = None
    description: Optional[str] = None
    usage: Optional[str] = None
    tags: Optional[List[str]] = None
    author: Optional[str] = None
    manifest_toml: Optional[str] = None
    payload_uri: Optional[str] = None
    checksum: Optional[str] = None

    @field_validator("tags", mode="before")
    @classmethod
    def parse_tags(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v


class SkillVersionRead(BaseModel):
    id: str
    skill_id: str
    version: str
    manifest_toml: str
    payload_uri: str
    checksum: str
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


class SkillRatingCreate(BaseModel):
    stars: int
    comment: Optional[str] = None


class SkillRatingRead(BaseModel):
    id: str
    skill_id: str
    user_id: str
    stars: int
    comment: Optional[str] = None
    created_at: datetime.datetime

    model_config = {"from_attributes": True}
