from __future__ import annotations

import io
import tarfile

from server.models.skill import Skill


def _build_instructions_md(skill: Skill) -> str:
    lines = [f"# {skill.name}", "", skill.summary]
    if skill.description:
        lines += ["", skill.description]
    if skill.usage:
        lines += ["", "## Usage Instructions", "", skill.usage]
    return "\n".join(lines) + "\n"


def build_tarball(skill: Skill) -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tf:
        content = _build_instructions_md(skill).encode()
        info = tarfile.TarInfo(name=f".copilot/prompts/{skill.id}.instructions.md")
        info.size = len(content)
        tf.addfile(info, io.BytesIO(content))
    return buf.getvalue()
