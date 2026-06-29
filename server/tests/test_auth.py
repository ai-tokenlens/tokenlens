from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import server.routers.auth as auth_module
from server.config import settings
from server.database import get_db
from server.main import app
from server.models.base import Base
import server.models  # noqa: F401

VALID_KEY = settings.ingest_token
VALID_HEADERS = {"Authorization": f"Bearer {VALID_KEY}"}


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


# --- /auth/verify ---

def test_verify_valid_token(client: TestClient):
    resp = client.get("/api/v1/auth/verify", headers=VALID_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["valid"] is True
    assert body["user"] == "service"


def test_verify_invalid_token(client: TestClient):
    resp = client.get("/api/v1/auth/verify", headers={"Authorization": "Bearer wrong-token"})
    assert resp.status_code == 401


def test_verify_missing_token(client: TestClient):
    resp = client.get("/api/v1/auth/verify")
    assert resp.status_code == 401


# --- /admin/rotate-key ---

def test_rotate_key_updates_settings_and_env(client: TestClient, tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text(f"INGEST_TOKEN={VALID_KEY}\nOTHER=value\n", encoding="utf-8")
    monkeypatch.setattr(auth_module, "ENV_PATH", env_file)
    # Restore settings.ingest_token after test
    original_token = settings.ingest_token
    try:
        resp = client.post("/api/v1/admin/rotate-key", headers=VALID_HEADERS)
        assert resp.status_code == 200
        new_token = resp.json()["token"]
        assert new_token != original_token
        # In-memory updated
        assert settings.ingest_token == new_token
        # .env updated
        content = env_file.read_text(encoding="utf-8")
        assert f"INGEST_TOKEN={new_token}" in content
        assert "OTHER=value" in content
    finally:
        settings.ingest_token = original_token


def test_rotate_key_creates_env_if_missing(client: TestClient, tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    monkeypatch.setattr(auth_module, "ENV_PATH", env_file)
    original_token = settings.ingest_token
    try:
        resp = client.post("/api/v1/admin/rotate-key", headers=VALID_HEADERS)
        assert resp.status_code == 200
        new_token = resp.json()["token"]
        content = env_file.read_text(encoding="utf-8")
        assert f"INGEST_TOKEN={new_token}" in content
    finally:
        settings.ingest_token = original_token


def test_rotate_key_wrong_token_returns_401(client: TestClient):
    resp = client.post("/api/v1/admin/rotate-key", headers={"Authorization": "Bearer bad"})
    assert resp.status_code == 401
