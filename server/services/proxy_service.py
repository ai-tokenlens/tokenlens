from __future__ import annotations

import hashlib
import io
import json
import tarfile
import uuid
from pathlib import Path

import httpx
import toml
from sqlalchemy import select
from sqlalchemy.orm import Session

from server.config import settings
from server.models.skill import Skill
from server.models.skill_version import SkillVersion


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _extract_skill_toml(tarball: bytes) -> dict:
    with tarfile.open(fileobj=io.BytesIO(tarball), mode="r:*") as tf:
        for member in tf.getmembers():
            if member.name.endswith("skill.toml"):
                f = tf.extractfile(member)
                if f:
                    return toml.loads(f.read().decode())
    raise ValueError("skill.toml not found in tarball")


def fetch_and_cache(db: Session, origin_url: str) -> str:
    stmt = select(Skill).where(Skill.origin_url == origin_url, Skill.deleted_at.is_(None))
    existing = db.execute(stmt).scalar_one_or_none()
    if existing:
        return existing.id

    with httpx.Client(follow_redirects=True, timeout=30) as client:
        resp = client.get(origin_url)
        resp.raise_for_status()
    tarball = resp.content
    checksum = _sha256(tarball)

    manifest = _extract_skill_toml(tarball)
    skill_section = manifest.get("skill", {})
    usage_section = manifest.get("usage", {})

    skill_id = skill_section.get("id") or str(uuid.uuid4())
    tags = skill_section.get("tags", [])
    version = skill_section.get("version", "1.0.0")

    blob_dir = Path(settings.blob_dir)
    blob_dir.mkdir(parents=True, exist_ok=True)
    payload_path = blob_dir / f"{skill_id}-{version}.tar.gz"
    payload_path.write_bytes(tarball)

    skill = Skill(
        id=skill_id,
        name=skill_section.get("name", skill_id),
        summary=skill_section.get("summary", ""),
        usage=usage_section.get("instructions"),
        tags=json.dumps(tags),
        author=skill_section.get("author"),
        origin="remote",
        origin_url=origin_url,
        latest_version=version,
    )
    db.add(skill)

    sv = SkillVersion(
        id=str(uuid.uuid4()),
        skill_id=skill_id,
        version=version,
        manifest_toml=toml.dumps(manifest),
        payload_uri=str(payload_path),
        checksum=checksum,
    )
    db.add(sv)
    db.commit()
    return skill_id
