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
import server.models  # noqa: F401

VALID_TOKEN = settings.ingest_token  # use config default; no patching needed
HEADERS = {"Authorization": f"Bearer {VALID_TOKEN}"}


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


# --- helpers ---

def _int_attr(key: str, value: int) -> dict:
    return {"key": key, "value": {"intValue": value}}


def _str_attr(key: str, value: str) -> dict:
    return {"key": key, "value": {"stringValue": value}}


def _span(trace_id: str, span_id: str, int_attrs: dict, str_attrs: dict | None = None) -> dict:
    attributes = [_int_attr(k, v) for k, v in int_attrs.items()]
    for k, v in (str_attrs or {}).items():
        attributes.append(_str_attr(k, v))
    return {
        "traceId": trace_id,
        "spanId": span_id,
        "startTimeUnixNano": "1700000000000000000",
        "attributes": attributes,
    }


def _traces_payload(*spans: dict, user: str = "alice", system: str = "anthropic") -> dict:
    return {
        "resourceSpans": [{
            "resource": {"attributes": [
                _str_attr("tokenlens.user", user),
                _str_attr("gen_ai.system", system),
            ]},
            "scopeSpans": [{"spans": list(spans)}],
        }]
    }


# --- test cases ---

def test_full_span_all_fields(client: TestClient, db: Session):
    """Span with all GenAI fields maps to correct UsageEvent."""
    payload = _traces_payload(_span(
        "trace1", "span1",
        {
            "gen_ai.usage.input_tokens": 100,
            "gen_ai.usage.output_tokens": 50,
            "gen_ai.usage.cache_read_input_tokens": 20,
            "gen_ai.usage.cache_creation_input_tokens": 10,
        },
        {"gen_ai.request.model": "claude-3-5-sonnet"},
    ))
    resp = client.post("/otel/v1/traces", json=payload, headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["accepted"] == 1

    ev = db.query(UsageEvent).first()
    assert ev.input_tokens == 100
    assert ev.output_tokens == 50
    assert ev.cache_read_tokens == 20
    assert ev.cache_write_tokens == 10
    assert ev.total_tokens == 180
    assert ev.model == "claude-3-5-sonnet"
    assert ev.source == "otel"
    assert ev.user_id == "alice"
    assert ev.tool == "claude-code"
    assert ev.trace_id == "trace1:span1"


def test_span_without_cache_tokens(client: TestClient, db: Session):
    """Span missing cache attrs → cache fields default to 0."""
    payload = _traces_payload(_span(
        "trace2", "span2",
        {"gen_ai.usage.input_tokens": 200, "gen_ai.usage.output_tokens": 80},
        {"gen_ai.request.model": "gpt-4o"},
    ), system="openai")
    resp = client.post("/otel/v1/traces", json=payload, headers=HEADERS)
    assert resp.status_code == 200

    ev = db.query(UsageEvent).first()
    assert ev.cache_read_tokens == 0
    assert ev.cache_write_tokens == 0
    assert ev.total_tokens == 280


def test_span_without_model(client: TestClient, db: Session):
    """Span missing gen_ai.request.model → model is None."""
    payload = _traces_payload(_span(
        "trace3", "span3",
        {"gen_ai.usage.input_tokens": 50, "gen_ai.usage.output_tokens": 30},
    ))
    resp = client.post("/otel/v1/traces", json=payload, headers=HEADERS)
    assert resp.status_code == 200

    ev = db.query(UsageEvent).first()
    assert ev.model is None


def test_batch_of_three_spans(client: TestClient, db: Session):
    """Batch of 3 spans → all 3 persisted."""
    spans = [
        _span("traceA", "spanA1", {"gen_ai.usage.input_tokens": 10, "gen_ai.usage.output_tokens": 5}),
        _span("traceA", "spanA2", {"gen_ai.usage.input_tokens": 20, "gen_ai.usage.output_tokens": 10}),
        _span("traceA", "spanA3", {"gen_ai.usage.input_tokens": 30, "gen_ai.usage.output_tokens": 15}),
    ]
    resp = client.post("/otel/v1/traces", json=_traces_payload(*spans), headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["accepted"] == 3
    assert db.query(UsageEvent).count() == 3


def test_invalid_ingest_token_returns_401(client: TestClient):
    """Wrong Bearer token → 401."""
    payload = _traces_payload(_span(
        "trace9", "span9",
        {"gen_ai.usage.input_tokens": 10, "gen_ai.usage.output_tokens": 5},
    ))
    resp = client.post("/otel/v1/traces", json=payload, headers={"Authorization": "Bearer wrong"})
    assert resp.status_code == 401


def test_idempotency_same_trace_span(client: TestClient, db: Session):
    """Sending the same trace_id+span_id twice → only 1 record stored."""
    payload = _traces_payload(_span(
        "traceX", "spanX",
        {"gen_ai.usage.input_tokens": 10, "gen_ai.usage.output_tokens": 5},
    ))
    r1 = client.post("/otel/v1/traces", json=payload, headers=HEADERS)
    r2 = client.post("/otel/v1/traces", json=payload, headers=HEADERS)
    assert r1.json()["accepted"] == 1
    assert r2.json()["accepted"] == 0
    assert db.query(UsageEvent).count() == 1
