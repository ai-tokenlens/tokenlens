from __future__ import annotations

import io
import json
import tarfile

from server.models.skill import Skill


def _build_skill_md(skill: Skill) -> str:
    tags = json.loads(skill.tags or "[]")
    lines = [
        "---",
        f"id: {skill.id}",
        f"name: {skill.name}",
        f"version: {skill.latest_version}",
    ]
    if skill.author:
        lines.append(f"author: {skill.author}")
    if tags:
        lines.append(f"tags: [{', '.join(tags)}]")
    lines += ["---", "", f"# {skill.name}", "", skill.summary]
    if skill.description:
        lines += ["", skill.description]
    if skill.usage:
        lines += ["", "## Usage", "", skill.usage]
    return "\n".join(lines) + "\n"


def build_tarball(skill: Skill) -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tf:
        content = _build_skill_md(skill).encode()
        info = tarfile.TarInfo(name=f"skill/{skill.id}/SKILL.md")
        info.size = len(content)
        tf.addfile(info, io.BytesIO(content))
    return buf.getvalue()
