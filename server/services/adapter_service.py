from __future__ import annotations

from server.adapters import claude_code_adapter, copilot_adapter
from server.models.skill import Skill

_ADAPTERS = {
    "claude-code": claude_code_adapter,
    "copilot": copilot_adapter,
}


def build_tarball(skill: Skill, target: str) -> bytes:
    adapter = _ADAPTERS.get(target)
    if adapter is None:
        raise ValueError(f"Unknown target {target!r}. Valid: {list(_ADAPTERS)}")
    return adapter.build_tarball(skill)
