from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from server.config import settings
from server.database import get_db
from server.main import app
from server.models.base import Base
from server.models.usage_event import UsageEvent
from server.models.user import User
import server.models  # noqa: F401

VALID_KEY = settings.ingest_token
HEADERS = {"X-API-Key": VALID_KEY}

BASE_EVENT = {
    "user_id": "alice",
    "tool": "claude-code",
    "model": "claude-sonnet-4-6",
    "input_tokens": 100,
    "output_tokens": 50,
    "timestamp": "2026-01-01T00:00:00Z",
}


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as s:
        yield s
    Base.metadata.drop_all(engine)


@pytest.fixture()
def client(db: Session):
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_ingest_single_ok(client: TestClient, db: Session):
    resp = client.post("/api/v1/events", json=BASE_EVENT, headers=HEADERS)
    assert resp.status_code == 201
    assert resp.json()["accepted"] == 1
    ev = db.query(UsageEvent).first()
    assert ev is not None
    assert ev.source == "session-file"
    assert ev.input_tokens == 100
    assert ev.total_tokens == 150
    assert ev.user_id == "alice"
    user = db.get(User, "alice")
    assert user is not None


def test_ingest_single_auto_creates_user(client: TestClient, db: Session):
    assert db.query(User).count() == 0
    client.post("/api/v1/events", json={**BASE_EVENT, "user_id": "newuser"}, headers=HEADERS)
    assert db.get(User, "newuser") is not None


def test_ingest_batch_ok(client: TestClient, db: Session):
    events = [
        {**BASE_EVENT, "user_id": f"u{i}", "input_tokens": i * 10, "output_tokens": i * 5}
        for i in range(1, 6)
    ]
    resp = client.post("/api/v1/events/batch", json={"events": events}, headers=HEADERS)
    assert resp.status_code == 201
    assert resp.json()["accepted"] == 5
    assert db.query(UsageEvent).count() == 5


def test_ingest_batch_over_100_returns_422(client: TestClient):
    events = [BASE_EVENT] * 101
    resp = client.post("/api/v1/events/batch", json={"events": events}, headers=HEADERS)
    assert resp.status_code == 422


def test_missing_token_returns_401(client: TestClient):
    resp = client.post("/api/v1/events", json=BASE_EVENT)
    assert resp.status_code == 401


def test_wrong_token_returns_401(client: TestClient):
    resp = client.post("/api/v1/events", json=BASE_EVENT, headers={"X-API-Key": "bad-token"})
    assert resp.status_code == 401


def test_bearer_token_also_accepted(client: TestClient, db: Session):
    resp = client.post(
        "/api/v1/events",
        json=BASE_EVENT,
        headers={"Authorization": f"Bearer {VALID_KEY}"},
    )
    assert resp.status_code == 201
