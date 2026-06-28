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
  ok "OTel env vars loaded (endpoint: $OTEL_EXPORTER_OTLP_ENDPOINT)"
else
  warn "OTel env vars not set in this shell  →  open a new terminal or run: source ~/.zshrc"
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
