from __future__ import annotations

import datetime
import json
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from server.models.skill import Skill
from server.models.usage_event import UsageEvent


def _extract_language(context_json: Optional[str]) -> Optional[str]:
    if not context_json:
        return None
    try:
        return json.loads(context_json).get("language")
    except (json.JSONDecodeError, AttributeError):
        return None


def _active_skills(session: Session) -> List[Skill]:
    return session.query(Skill).filter(Skill.deleted_at.is_(None)).all()


def _skill_tags(skill: Skill) -> List[str]:
    try:
        return [t.lower() for t in json.loads(skill.tags or "[]")]
    except (json.JSONDecodeError, TypeError):
        return []


def rule_skill_gap(session: Session, user_id: str) -> List[dict]:
    events = (
        session.query(UsageEvent)
        .filter(UsageEvent.user_id == user_id, UsageEvent.skill_id.is_(None))
        .all()
    )
    lang_tokens: dict[str, list[int]] = {}
    for ev in events:
        lang = _extract_language(ev.context)
        if lang:
            lang_tokens.setdefault(lang, []).append(ev.total_tokens)

    skills = _active_skills(session)
    recs = []
    for lang, token_list in lang_tokens.items():
        if len(token_list) <= 5:
            continue
        user_avg = sum(token_list) / len(token_list)
        candidates = [s for s in skills if s.avg_tokens > 0 and lang.lower() in _skill_tags(s)]
        if not candidates:
            continue
        best = min(candidates, key=lambda s: s.avg_tokens)
        savings = int(user_avg - best.avg_tokens)
        if savings <= 0:
            continue
        recs.append({
            "type": "skill_gap",
            "skill_id": best.id,
            "reason": (
                f"You have {len(token_list)} {lang} sessions without a skill. "
                f"'{best.name}' averages {best.avg_tokens} tokens vs your {int(user_avg)}."
            ),
            "potential_savings_tokens": savings,
            "potential_savings_pct": round(savings / user_avg * 100, 1),
        })
    return recs


def rule_context_bloat(session: Session, user_id: str) -> List[dict]:
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=30)

    user_avg = session.query(func.avg(UsageEvent.input_tokens)).filter(
        UsageEvent.user_id == user_id, UsageEvent.timestamp >= cutoff
    ).scalar()
    if not user_avg:
        return []
    user_avg = float(user_avg)

    team_avg = session.query(func.avg(UsageEvent.input_tokens)).filter(
        UsageEvent.timestamp >= cutoff
    ).scalar()
    if not team_avg:
        return []
    team_avg = float(team_avg)

    if team_avg == 0 or user_avg <= 1.5 * team_avg:
        return []

    excess_pct = round((user_avg / team_avg - 1) * 100, 1)
    savings = int(user_avg - team_avg)
    return [{
        "type": "context_bloat",
        "skill_id": None,
        "reason": (
            f"Your avg input context ({int(user_avg)} tokens) is {excess_pct}% above "
            f"the team average ({int(team_avg)} tokens). Consider reducing context size."
        ),
        "potential_savings_tokens": savings,
        "potential_savings_pct": round(savings / user_avg * 100, 1),
    }]


def rule_efficient_swap(session: Session, user_id: str) -> List[dict]:
    events = (
        session.query(UsageEvent)
        .filter(UsageEvent.user_id == user_id, UsageEvent.skill_id.is_(None))
        .all()
    )
    lang_tokens: dict[str, list[int]] = {}
    for ev in events:
        lang = _extract_language(ev.context)
        if lang:
            lang_tokens.setdefault(lang, []).append(ev.total_tokens)

    skills = _active_skills(session)
    recs = []
    seen: set[str] = set()
    for lang, token_list in lang_tokens.items():
        if not token_list:
            continue
        user_avg = sum(token_list) / len(token_list)
        threshold = user_avg * 0.7
        candidates = [
            s for s in skills
            if s.avg_tokens > 0
            and s.avg_tokens < threshold
            and lang.lower() in _skill_tags(s)
            and s.id not in seen
        ]
        if not candidates:
            continue
        best = min(candidates, key=lambda s: s.avg_tokens)
        seen.add(best.id)
        savings = int(user_avg - best.avg_tokens)
        savings_pct = round(savings / user_avg * 100, 1)
        recs.append({
            "type": "efficient_swap",
            "skill_id": best.id,
            "reason": (
                f"'{best.name}' uses {best.avg_tokens} tokens avg — {savings_pct}% less "
                f"than your manual {lang} sessions ({int(user_avg)} tokens avg)."
            ),
            "potential_savings_tokens": savings,
            "potential_savings_pct": savings_pct,
        })
    return recs


def get_recommendations(session: Session, user_id: str) -> List[dict]:
    return [
        *rule_skill_gap(session, user_id),
        *rule_context_bloat(session, user_id),
        *rule_efficient_swap(session, user_id),
    ]
