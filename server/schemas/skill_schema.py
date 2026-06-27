"""Canonical schema aliases for AGENT-07 spec."""
from server.schemas.skill import (
    SkillCreate,
    SkillUpdate,
    SkillRead as SkillResponse,
    SkillRatingCreate as RatingCreate,
    SkillRatingRead as RatingResponse,
    SkillVersionRead,
)

__all__ = [
    "SkillCreate",
    "SkillUpdate",
    "SkillResponse",
    "RatingCreate",
    "RatingResponse",
    "SkillVersionRead",
]
