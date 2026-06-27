from __future__ import annotations

import io
import tarfile
from unittest.mock import MagicMock, patch

import pytest
import toml
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from server.models.base import Base
import server.models  # noqa: F401


def _make_tarball(skill_id: str = "test-skill", version: str = "1.0.0") -> bytes:
    manifest = {
        "skill": {
            "id": skill_id,
            "name": "Test Skill",
            "summary": "A test skill summary",
            "version": version,
            "tags": ["test", "proxy"],
            "author": "test@example.com",
        },
        "usage": {"instructions": "Run the skill."},
    }
    toml_bytes = toml.dumps(manifest).encode()
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tf:
        info = tarfile.TarInfo(name="skill.toml")
        info.size = len(toml_bytes)
        tf.addfile(info, io.BytesIO(toml_bytes))
    return buf.getvalue()


def _mock_httpx(tarball: bytes):
    mock_resp = MagicMock()
    mock_resp.content = tarball
    mock_resp.raise_for_status = MagicMock()

    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get = MagicMock(return_value=mock_resp)
    return mock_client


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    with Session(engine) as s:
        yield s
    Base.metadata.drop_all(engine)


# ---------------------------------------------------------------------------
# proxy_service
# ---------------------------------------------------------------------------

def test_fetch_and_cache_stores_skill(db, tmp_path, monkeypatch):
    import server.config as cfg
    monkeypatch.setattr(cfg.settings, "blob_dir", str(tmp_path))

    tarball = _make_tarball()
    mock_client = _mock_httpx(tarball)

    with patch("server.services.proxy_service.httpx.Client", return_value=mock_client):
        from server.services import proxy_service
        skill_id = proxy_service.fetch_and_cache(db, "http://example.com/skill.tar.gz")

    assert skill_id == "test-skill"
    stored = list(tmp_path.glob("*.tar.gz"))
    assert len(stored) == 1


def test_fetch_and_cache_cache_hit_no_second_download(db, tmp_path, monkeypatch):
    import server.config as cfg
    monkeypatch.setattr(cfg.settings, "blob_dir", str(tmp_path))

    tarball = _make_tarball()
    mock_client = _mock_httpx(tarball)

    with patch("server.services.proxy_service.httpx.Client", return_value=mock_client):
        from server.services import proxy_service
        id1 = proxy_service.fetch_and_cache(db, "http://example.com/skill.tar.gz")
        id2 = proxy_service.fetch_and_cache(db, "http://example.com/skill.tar.gz")

    assert id1 == id2
    assert mock_client.get.call_count == 1


# ---------------------------------------------------------------------------
# adapters
# ---------------------------------------------------------------------------

def _seed_skill(db, tmp_path, monkeypatch) -> str:
    import server.config as cfg
    monkeypatch.setattr(cfg.settings, "blob_dir", str(tmp_path))
    tarball = _make_tarball()
    mock_client = _mock_httpx(tarball)
    with patch("server.services.proxy_service.httpx.Client", return_value=mock_client):
        from server.services import proxy_service
        return proxy_service.fetch_and_cache(db, "http://example.com/skill.tar.gz")


def test_claude_code_adapter_produces_correct_path(db, tmp_path, monkeypatch):
    skill_id = _seed_skill(db, tmp_path, monkeypatch)

    from server.services import registry_service
    skill = registry_service.get_skill(db, skill_id)

    from server.adapters import claude_code_adapter
    result = claude_code_adapter.build_tarball(skill)

    with tarfile.open(fileobj=io.BytesIO(result), mode="r:gz") as tf:
        names = tf.getnames()

    assert f"skill/{skill_id}/SKILL.md" in names


def test_copilot_adapter_produces_correct_path(db, tmp_path, monkeypatch):
    skill_id = _seed_skill(db, tmp_path, monkeypatch)

    from server.services import registry_service
    skill = registry_service.get_skill(db, skill_id)

    from server.adapters import copilot_adapter
    result = copilot_adapter.build_tarball(skill)

    with tarfile.open(fileobj=io.BytesIO(result), mode="r:gz") as tf:
        names = tf.getnames()

    assert f".copilot/prompts/{skill_id}.instructions.md" in names


def test_adapter_service_unknown_target_raises(db, tmp_path, monkeypatch):
    skill_id = _seed_skill(db, tmp_path, monkeypatch)

    from server.services import registry_service, adapter_service
    skill = registry_service.get_skill(db, skill_id)

    with pytest.raises(ValueError, match="Unknown target"):
        adapter_service.build_tarball(skill, "unknown-tool")
