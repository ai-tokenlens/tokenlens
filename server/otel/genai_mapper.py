from __future__ import annotations

import datetime
import uuid
from typing import Any, Optional


def _attr_value(attr: dict) -> Any:
    v = attr.get("value", {})
    if "intValue" in v:
        return int(v["intValue"])  # OTLP JSON may encode int64 as string
    if "doubleValue" in v:
        return float(v["doubleValue"])
    if "stringValue" in v:
        return v["stringValue"]
    if "boolValue" in v:
        return v["boolValue"]
    return None


def _attrs_to_dict(attributes: list[dict]) -> dict[str, Any]:
    return {a["key"]: _attr_value(a) for a in attributes if "key" in a}


def _derive_tool(span_attrs: dict, resource_attrs: dict) -> str:
    system = (
        span_attrs.get("gen_ai.system")
        or resource_attrs.get("gen_ai.system")
        or resource_attrs.get("tokenlens.tool", "")
    )
    s = str(system).lower()
    if "copilot" in s:
        return "copilot-cli"
    if "anthropic" in s or "claude" in s:
        return "claude-code"
    return str(system) if system else "otel"


def _ns_to_dt(start_ns: Any) -> datetime.datetime:
    try:
        return datetime.datetime.utcfromtimestamp(int(start_ns) / 1e9)
    except (ValueError, TypeError, OSError):
        return datetime.datetime.utcnow()


def map_span_to_usage_event(
    span: dict,
    resource_attrs: dict[str, Any],
) -> Optional[dict]:
    """Map a single OTLP span to a UsageEvent dict; returns None if not a GenAI span."""
    span_attrs = _attrs_to_dict(span.get("attributes", []))

    input_tokens = span_attrs.get("gen_ai.usage.input_tokens")
    output_tokens = span_attrs.get("gen_ai.usage.output_tokens")
    if input_tokens is None and output_tokens is None:
        return None

    inp = int(input_tokens or 0)
    out = int(output_tokens or 0)
    cr = int(span_attrs.get("gen_ai.usage.cache_read_input_tokens") or 0)
    cw = int(span_attrs.get("gen_ai.usage.cache_creation_input_tokens") or 0)

    trace_id = span.get("traceId", "")
    span_id = span.get("spanId", "")

    return {
        "id": str(uuid.uuid4()),
        "user_id": resource_attrs.get("tokenlens.user", "unknown"),
        "tool": _derive_tool(span_attrs, resource_attrs),
        "model": span_attrs.get("gen_ai.request.model"),
        "input_tokens": inp,
        "output_tokens": out,
        "cache_read_tokens": cr,
        "cache_write_tokens": cw,
        "total_tokens": inp + out + cr + cw,
        "skill_id": None,
        "source": "otel",
        "context": None,
        "trace_id": f"{trace_id}:{span_id}",
        "timestamp": _ns_to_dt(span.get("startTimeUnixNano", 0)),
    }


def extract_usage_events_from_traces(payload: dict) -> list[dict]:
    """Extract all UsageEvent dicts from an OTLP traces payload."""
    events: list[dict] = []
    for resource_span in payload.get("resourceSpans", []):
        resource_attrs = _attrs_to_dict(
            resource_span.get("resource", {}).get("attributes", [])
        )
        for scope_span in resource_span.get("scopeSpans", []):
            for span in scope_span.get("spans", []):
                ev = map_span_to_usage_event(span, resource_attrs)
                if ev:
                    events.append(ev)
    return events


def extract_usage_events_from_metrics(payload: dict) -> list[dict]:
    """Extract UsageEvent dicts from an OTLP metrics payload (gen_ai token metrics)."""
    events: list[dict] = []
    for resource_metric in payload.get("resourceMetrics", []):
        resource_attrs = _attrs_to_dict(
            resource_metric.get("resource", {}).get("attributes", [])
        )
        user_id = resource_attrs.get("tokenlens.user", "unknown")
        tool = _derive_tool({}, resource_attrs)

        for scope_metric in resource_metric.get("scopeMetrics", []):
            for metric in scope_metric.get("metrics", []):
                if "token" not in metric.get("name", "").lower():
                    continue
                for container_key in ("sum", "gauge"):
                    for dp in metric.get(container_key, {}).get("dataPoints", []):
                        dp_attrs = _attrs_to_dict(dp.get("attributes", []))
                        token_type = dp_attrs.get("gen_ai.token.type", "")
                        value = int(dp.get("asInt") or dp.get("asDouble") or 0)
                        if value == 0:
                            continue
                        inp = value if token_type == "input" else 0
                        out = value if token_type == "output" else 0
                        events.append({
                            "id": str(uuid.uuid4()),
                            "user_id": user_id,
                            "tool": tool,
                            "model": dp_attrs.get("gen_ai.request.model"),
                            "input_tokens": inp,
                            "output_tokens": out,
                            "cache_read_tokens": 0,
                            "cache_write_tokens": 0,
                            "total_tokens": inp + out,
                            "skill_id": None,
                            "source": "otel",
                            "context": None,
                            "trace_id": None,
                            "timestamp": _ns_to_dt(dp.get("startTimeUnixNano", 0)),
                        })
    return events
