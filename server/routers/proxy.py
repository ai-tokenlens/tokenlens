from fastapi import APIRouter

router = APIRouter(tags=["proxy"])

# TODO(spec): implement POST /proxy/resolve (pull-through cache) — AGENT-08
