#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# TokenLens — Verify installation (macOS / Linux)
# ─────────────────────────────────────────────────────────────
set -uo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
BOLD='\033[1m'; RESET='\033[0m'

ok()   { echo -e "  ${GREEN}✔${RESET}  $*"; }
fail() { echo -e "  ${RED}✖${RESET}  $*"; ERRORS=$((ERRORS+1)); }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $*"; }

ERRORS=0

echo -e "\n${BOLD}  TokenLens — Verification${RESET}\n"

# Docker containers
if docker compose ps --status running 2>/dev/null | grep -q "server"; then
  ok "server container is running"
else
  fail "server container is NOT running  →  run: docker compose up -d"
fi

if docker compose ps --status running 2>/dev/null | grep -q "frontend"; then
  ok "frontend container is running"
else
  fail "frontend container is NOT running  →  run: docker compose up -d"
fi

# API health
if curl -sf http://localhost:8080/health &>/dev/null; then
  ok "API responds at http://localhost:8080/health"
else
  fail "API not responding at port 8080  →  check: docker compose logs server"
fi

# Frontend
if curl -sf http://localhost:3000 &>/dev/null; then
  ok "Dashboard accessible at http://localhost:3000"
else
  fail "Dashboard not responding at port 3000  →  check: docker compose logs frontend"
fi

# tklens CLI
if command -v tklens &>/dev/null; then
  ok "tklens CLI installed ($(tklens --version 2>/dev/null || echo 'version unknown'))"
else
  fail "tklens CLI not found  →  run: npm install -g @tokenlens/cli"
fi

# tklens login
WHOAMI=$(tklens whoami 2>/dev/null || echo "")
if echo "$WHOAMI" | grep -q "endpoint"; then
  ok "tklens is logged in"
else
  warn "tklens not logged in  →  run: tklens login --endpoint http://localhost:8080"
fi

# OTel env vars
if [[ -n "${OTEL_EXPORTER_OTLP_ENDPOINT:-}" ]]; then
  ok "OTel endpoint: $OTEL_EXPORTER_OTLP_ENDPOINT"
else
  warn "OTEL_EXPORTER_OTLP_ENDPOINT not set  →  open a new terminal or source your profile"
fi
if [[ "${OTEL_EXPORTER_OTLP_HEADERS:-}" == *"Authorization=Bearer "* ]]; then
  ok "OTel auth header present"
else
  fail "OTEL_EXPORTER_OTLP_HEADERS missing or lacks Bearer token  →  server returns 401 and drops all events"
fi
if [[ "${OTEL_EXPORTER_OTLP_PROTOCOL:-}" == "http/json" ]]; then
  ok "OTel protocol: http/json"
else
  warn "OTEL_EXPORTER_OTLP_PROTOCOL is '${OTEL_EXPORTER_OTLP_PROTOCOL:-unset}' (expected http/json)  →  server cannot parse protobuf"
fi

# MCP server (optional — only checked if the mcp profile container is running)
MCP_RUNNING=$(docker compose ps --status running 2>/dev/null | grep "mcp" || true)
if [[ -n "$MCP_RUNNING" ]]; then
  if curl -sf http://localhost:8082/sse &>/dev/null; then
    ok "MCP server responding at http://localhost:8082/sse"
  else
    fail "MCP container running but port 8082 not responding  →  check: docker compose logs mcp"
  fi
else
  warn "MCP server not started (optional)  →  run: bash scripts/mcp-setup.sh --transport=http"
fi

# Summary
echo ""
if [[ $ERRORS -eq 0 ]]; then
  echo -e "  ${GREEN}${BOLD}All checks passed. TokenLens is ready!${RESET}"
else
  echo -e "  ${RED}${BOLD}${ERRORS} check(s) failed. See messages above.${RESET}"
  exit 1
fi
echo ""
