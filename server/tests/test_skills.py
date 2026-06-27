from __future__ import annotations

import pytest

from server.models.skill import Skill
from server.schemas.skill import SkillCreate, SkillRatingCreate, SkillUpdate
from server.services import registry_service


def _make_skill(
    skill_id: str = "test-skill",
    name: str = "Test Skill",
    summary: str = "A test skill",
    tags: list | None = None,
    origin: str = "local",
) -> SkillCreate:
    return SkillCreate(
        id=skill_id,
        name=name,
        summary=summary,
        tags=tags or ["python"],
        origin=origin,
    )


# ── CRUD ─────────────────────────────────────────────────────────────────────

def test_create_skill(session):
    skill = registry_service.create_skill(session, _make_skill())
    assert skill.id == "test-skill"
    assert skill.latest_version == "1.0.0"
    assert skill.rating_avg == 0.0


def test_get_skill(session):
    registry_service.create_skill(session, _make_skill())
    skill = registry_service.get_skill(session, "test-skill")
    assert skill is not None
    assert skill.name == "Test Skill"


def test_get_skill_missing(session):
    assert registry_service.get_skill(session, "nonexistent") is None


def test_list_skills_empty(session):
    assert registry_service.list_skills(session) == []


def test_list_skills_returns_created(session):
    registry_service.create_skill(session, _make_skill("s1", "Alpha", "summary a", ["ai"]))
    registry_service.create_skill(session, _make_skill("s2", "Beta", "summary b", ["ml"]))
    results = registry_service.list_skills(session)
    assert len(results) == 2


# ── Versioning ────────────────────────────────────────────────────────────────

def test_update_creates_version_record(session):
    registry_service.create_skill(session, _make_skill())
    updated = registry_service.update_skill(
        session, "test-skill", SkillUpdate(name="Updated Name")
    )
    assert updated is not None
    assert updated.name == "Updated Name"
    assert updated.latest_version == "1.0.1"

    versions = registry_service.list_versions(session, "test-skill")
    assert len(versions) == 1
    assert versions[0].version == "1.0.1"


def test_update_bumps_version_incrementally(session):
    registry_service.create_skill(session, _make_skill())
    registry_service.update_skill(session, "test-skill", SkillUpdate(summary="v2"))
    registry_service.update_skill(session, "test-skill", SkillUpdate(summary="v3"))
    skill = registry_service.get_skill(session, "test-skill")
    assert skill.latest_version == "1.0.2"
    versions = registry_service.list_versions(session, "test-skill")
    assert len(versions) == 2


def test_update_nonexistent_returns_none(session):
    result = registry_service.update_skill(
        session, "ghost", SkillUpdate(name="x")
    )
    assert result is None


# ── Soft delete ───────────────────────────────────────────────────────────────

def test_soft_delete_hides_from_get(session):
    registry_service.create_skill(session, _make_skill())
    assert registry_service.soft_delete_skill(session, "test-skill") is True
    assert registry_service.get_skill(session, "test-skill") is None


def test_soft_delete_hides_from_list(session):
    registry_service.create_skill(session, _make_skill())
    registry_service.soft_delete_skill(session, "test-skill")
    assert registry_service.list_skills(session) == []


def test_soft_delete_nonexistent_returns_false(session):
    assert registry_service.soft_delete_skill(session, "ghost") is False


# ── Ratings ───────────────────────────────────────────────────────────────────

def test_upsert_rating_creates(session):
    registry_service.create_skill(session, _make_skill())
    rating = registry_service.upsert_rating(
        session, "test-skill", "alice", SkillRatingCreate(stars=4)
    )
    assert rating.stars == 4
    assert rating.user_id == "alice"


def test_upsert_rating_updates_existing(session):
    registry_service.create_skill(session, _make_skill())
    registry_service.upsert_rating(session, "test-skill", "alice", SkillRatingCreate(stars=3))
    registry_service.upsert_rating(session, "test-skill", "alice", SkillRatingCreate(stars=5, comment="great"))
    ratings = registry_service.list_ratings(session, "test-skill")
    assert len(ratings) == 1
    assert ratings[0].stars == 5
    assert ratings[0].comment == "great"


def test_rating_recomputes_avg(session):
    registry_service.create_skill(session, _make_skill())
    registry_service.upsert_rating(session, "test-skill", "alice", SkillRatingCreate(stars=4))
    registry_service.upsert_rating(session, "test-skill", "bob", SkillRatingCreate(stars=2))
    skill = registry_service.get_skill(session, "test-skill")
    assert skill.rating_count == 2
    assert abs(skill.rating_avg - 3.0) < 0.01


def test_rating_count_after_upsert(session):
    registry_service.create_skill(session, _make_skill())
    registry_service.upsert_rating(session, "test-skill", "alice", SkillRatingCreate(stars=5))
    registry_service.upsert_rating(session, "test-skill", "alice", SkillRatingCreate(stars=3))
    skill = registry_service.get_skill(session, "test-skill")
    assert skill.rating_count == 1
    assert abs(skill.rating_avg - 3.0) < 0.01


def test_upsert_rating_nonexistent_skill(session):
    result = registry_service.upsert_rating(
        session, "ghost", "alice", SkillRatingCreate(stars=5)
    )
    assert result is None


# ── Filter / Sort ─────────────────────────────────────────────────────────────

def test_filter_by_tag(session):
    registry_service.create_skill(session, _make_skill("s1", tags=["python", "ai"]))
    registry_service.create_skill(session, _make_skill("s2", name="Other", summary="x", tags=["ml"]))
    results = registry_service.list_skills(session, tag="python")
    assert len(results) == 1
    assert results[0].id == "s1"


def test_search_by_name(session):
    registry_service.create_skill(session, _make_skill("s1", name="MuleSoft Docs", summary="gen docs"))
    registry_service.create_skill(session, _make_skill("s2", name="Python Helper", summary="helps"))
    results = registry_service.list_skills(session, search="MuleSoft")
    assert len(results) == 1
    assert results[0].id == "s1"


def test_search_by_summary(session):
    registry_service.create_skill(session, _make_skill("s1", summary="generate raml docs"))
    registry_service.create_skill(session, _make_skill("s2", name="Other", summary="something else"))
    results = registry_service.list_skills(session, search="raml")
    assert len(results) == 1


def test_sort_by_rating(session):
    registry_service.create_skill(session, _make_skill("s1"))
    registry_service.create_skill(session, _make_skill("s2", name="B", summary="b"))
    registry_service.upsert_rating(session, "s2", "user1", SkillRatingCreate(stars=5))
    results = registry_service.list_skills(session, sort="rating")
    assert results[0].id == "s2"


def test_sort_by_popular(session):
    registry_service.create_skill(session, _make_skill("s1"))
    registry_service.create_skill(session, _make_skill("s2", name="Pop", summary="pop"))
    # Manually set use_count to simulate popularity
    s2 = registry_service.get_skill(session, "s2")
    s2.use_count = 10
    session.commit()
    results = registry_service.list_skills(session, sort="popular")
    assert results[0].id == "s2"
