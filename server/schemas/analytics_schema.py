from __future__ import annotations

from typing import List

from pydantic import BaseModel


class TokenTotals(BaseModel):
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int
    cache_write_tokens: int
    total_tokens: int


class ByKey(BaseModel):
    key: str
    total_tokens: int
    input_tokens: int
    output_tokens: int


class ByDay(BaseModel):
    date: str  # YYYY-MM-DD
    total_tokens: int
    input_tokens: int
    output_tokens: int


class SummaryResponse(BaseModel):
    totals: TokenTotals
    by_user: List[ByKey]
    by_tool: List[ByKey]
    by_model: List[ByKey]
    by_day: List[ByDay]


class TopConsumer(BaseModel):
    user_id: str
    total_tokens: int
    input_tokens: int
    output_tokens: int
    event_count: int


class TopConsumersResponse(BaseModel):
    consumers: List[TopConsumer]


class SkillEfficiency(BaseModel):
    skill_id: str
    avg_tokens: float
    total_tokens: int
    event_count: int


class SkillEfficiencyResponse(BaseModel):
    skills: List[SkillEfficiency]


class ByDayResponse(BaseModel):
    days: List[ByDay]
