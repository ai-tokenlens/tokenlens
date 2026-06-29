#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}✔${RESET}  $*"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $*"; }
fail() { echo -e "${RED}✖${RESET}  $*"; exit 1; }

# ── Check Docker ─────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  fail "docker non trovato. Installa Docker Desktop: https://www.docker.com/products/docker-desktop/"
fi
if ! docker compose version &>/dev/null 2>&1; then
  fail "docker compose non trovato (richiede Docker Compose v2+). Aggiorna Docker Desktop."
fi
if ! docker info &>/dev/null 2>&1; then
  fail "Docker installato ma non in esecuzione. Avvia Docker Desktop e riprova."
fi

# ── Check .env ───────────────────────────────────────────────────────────────
if [[ ! -f ".env" ]]; then
  if [[ ! -f ".env.example" ]]; then
    fail ".env.example non trovato. Assicurati di essere nella root del repository."
  fi
  cp .env.example .env
  warn "Configura INGEST_TOKEN in .env prima di continuare."
  exit 1
fi

# ── Check INGEST_TOKEN ───────────────────────────────────────────────────────
INGEST_TOKEN=$(grep -E '^INGEST_TOKEN=' .env | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs || true)
if [[ -z "$INGEST_TOKEN" || "$INGEST_TOKEN" == "change-me" ]]; then
  fail "Esegui scripts/generate-key.sh prima di avviare."
fi

# ── Start ────────────────────────────────────────────────────────────────────
echo "Avvio docker compose..."
docker compose up -d --build

# ── Health polling ───────────────────────────────────────────────────────────
MAX=30; ATTEMPT=0
echo -n "Attesa server"
until curl -sf http://localhost:8080/health &>/dev/null; do
  sleep 2
  ATTEMPT=$((ATTEMPT + 1))
  echo -n "."
  if [[ $ATTEMPT -ge $MAX ]]; then
    echo ""
    fail "Server non risponde dopo $((MAX * 2))s. Log:\n$(docker compose logs server 2>&1 | tail -30)"
  fi
done
echo ""

# ── Done ─────────────────────────────────────────────────────────────────────
MASKED="${INGEST_TOKEN:0:6}…"
ok "TokenLens server attivo su http://localhost:8080"
echo "   INGEST_TOKEN: ${MASKED}"
