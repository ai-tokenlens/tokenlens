from __future__ import annotations

from typing import Optional
import datetime

from pydantic import BaseModel


class UserCreate(BaseModel):
    id: str
    display_name: Optional[str] = None
    github_login: Optional[str] = None
    team: Optional[str] = None


class UserRead(UserCreate):
    created_at: datetime.datetime

    model_config = {"from_attributes": True}
