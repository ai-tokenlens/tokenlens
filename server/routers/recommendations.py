from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from server.database import get_db
from server.services.recommendation_engine import get_recommendations

router = APIRouter(tags=["recommendations"])


class Recommendation(BaseModel):
    type: str
    skill_id: Optional[str] = None
    reason: str
    potential_savings_tokens: Optional[int] = None
    potential_savings_pct: Optional[float] = None


@router.get("/recommendations/{user_id}", response_model=List[Recommendation])
def recommendations(user_id: str, db: Session = Depends(get_db)):
    return get_recommendations(db, user_id)
