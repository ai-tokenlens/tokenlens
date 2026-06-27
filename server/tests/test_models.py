import datetime
import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from server.models.base import Base
import server.models  # noqa: F401
from server.models.user import User
from server.models.usage_event import UsageEvent
from server.models.skill import Skill
from server.models.skill_version import SkillVersion
from server.models.skill_rating import SkillRating


@pytest.fixture(scope="function")
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    with Session(engine) as s:
        yield s
    Base.metadata.drop_all(engine)


def _uid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime.datetime:
    return datetime.datetime.utcnow()


class TestUser:
    def test_create(self, db):
        db.add(User(id="alice@example.com", display_name="Alice"))
        db.commit()
        assert db.get(User, "alice@example.com").display_name == "Alice"

    def test_optional_fields_null(self, db):
        db.add(User(id="bob@example.com"))
        db.commit()
        u = db.get(User, "bob@example.com")
        assert u.github_login is None
        assert u.team is None


class TestUsageEvent:
    def test_create_minimal(self, db):
        e = UsageEvent(
            id=_uid(),
            user_id="alice@example.com",
            tool="claude-code",
            input_tokens=100,
            output_tokens=200,
            total_tokens=300,
            source="otel",
            timestamp=_now(),
        )
        db.add(e)
        db.commit()
        loaded = db.get(UsageEvent, e.id)
        assert loaded.total_tokens == 300
        assert loaded.cache_read_tokens == 0

    def test_indexes_exist(self, db):
        from sqlalchemy import text
        rows = db.execute(text("SELECT name FROM sqlite_master WHERE type='index'")).fetchall()
        ix_names = {r[0] for r in rows}
        assert "idx_events_user_ts" in ix_names
        assert "idx_events_tool_ts" in ix_names


class TestSkill:
    def _make_skill(self, db, skill_id="test-skill"):
        s = Skill(id=skill_id, name="Test", summary="A test skill", origin="local")
        db.add(s)
        db.flush()
        return s

    def test_create(self, db):
        s = self._make_skill(db)
        db.commit()
        loaded = db.get(Skill, "test-skill")
        assert loaded.rating_avg == 0.0
        assert loaded.use_count == 0

    def test_version_relationship(self, db):
        s = self._make_skill(db)
        v = SkillVersion(
            id=_uid(),
            skill_id=s.id,
            version="1.0.0",
            manifest_toml='[skill]\nid="test-skill"',
            payload_uri="blobs/test.tar.gz",
            checksum="abc123",
        )
        db.add(v)
        db.commit()
        assert len(db.get(Skill, "test-skill").versions) == 1

    def test_version_unique_constraint(self, db):
        s = self._make_skill(db)
        for _ in range(2):
            db.add(SkillVersion(
                id=_uid(), skill_id=s.id, version="1.0.0",
                manifest_toml="x", payload_uri="y", checksum="z",
            ))
        with pytest.raises(IntegrityError):
            db.commit()

    def test_rating_upsert_unique(self, db):
        s = self._make_skill(db, "skill-r")
        db.add(SkillRating(id=_uid(), skill_id="skill-r", user_id="u1", stars=4))
        db.commit()
        db.add(SkillRating(id=_uid(), skill_id="skill-r", user_id="u1", stars=5))
        with pytest.raises(IntegrityError):
            db.commit()

    def test_rating_stars_check(self, db):
        s = self._make_skill(db, "skill-c")
        db.add(SkillRating(id=_uid(), skill_id="skill-c", user_id="u2", stars=0))
        with pytest.raises(IntegrityError):
            db.commit()

    def test_cascade_delete_versions(self, db):
        s = self._make_skill(db, "skill-d")
        db.add(SkillVersion(
            id=_uid(), skill_id=s.id, version="1.0.0",
            manifest_toml="x", payload_uri="y", checksum="z",
        ))
        db.commit()
        db.delete(s)
        db.commit()
        from sqlalchemy import select
        assert db.execute(select(SkillVersion)).scalars().all() == []
