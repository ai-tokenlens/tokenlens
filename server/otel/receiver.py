from fastapi import APIRouter

router = APIRouter(tags=["otel"])

# TODO(spec): implement POST /v1/traces and POST /v1/metrics (OTLP/HTTP) — AGENT-04
