from __future__ import annotations

import logging
import re
import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, Request

from server.config import settings
from server.routers.events import _verify_token

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth"])

# Patchable in tests
ENV_PATH = Path(".env")


@router.get("/auth/verify")
def verify_token(_: None = Depends(_verify_token)) -> dict:
    return {"valid": True, "user": "service"}


@router.post("/admin/rotate-key")
def rotate_key(_: None = Depends(_verify_token)) -> dict:
    new_token = secrets.token_urlsafe(32)
    settings.ingest_token = new_token
    _update_env_token(new_token)
    logger.info("INGEST_TOKEN rotated")
    return {"token": new_token}


def _update_env_token(token: str) -> None:
    new_line = f"INGEST_TOKEN={token}"
    if ENV_PATH.exists():
        text = ENV_PATH.read_text(encoding="utf-8")
        if re.search(r"^INGEST_TOKEN=", text, re.MULTILINE):
            text = re.sub(r"^INGEST_TOKEN=.*", new_line, text, flags=re.MULTILINE)
        else:
            text = text.rstrip("\n") + "\n" + new_line + "\n"
        ENV_PATH.write_text(text, encoding="utf-8")
    else:
        ENV_PATH.write_text(new_line + "\n", encoding="utf-8")
