#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}✔${RESET}  $*"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $*"; }
fail() { echo -e "${RED}✖${RESET}  $*"; exit 1; }

echo ""
echo "  TokenLens — Configurazione nuovo utente"
echo "  ────────────────────────────────────────"
echo ""

# ── Prompt: URL server ───────────────────────────────────────────────────────
read -r -p "  URL del server TokenLens [http://localhost:8080]: " SERVER_URL
SERVER_URL="${SERVER_URL:-http://localhost:8080}"

# ── Prompt: API key ──────────────────────────────────────────────────────────
read -r -p "  API key (INGEST_TOKEN fornita dall'amministratore): " API_KEY
if [[ -z "$API_KEY" ]]; then
  fail "API key obbligatoria."
fi

echo ""

# ── a. Verifica Node >= 20 ───────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  fail "Node.js non trovato. Installa Node 20+: https://nodejs.org/en/download/"
fi
NODE_VER=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [[ "$NODE_VER" -lt 20 ]]; then
  fail "Node $(node --version) trovato, ma Node 20+ è richiesto. Aggiorna: https://nodejs.org/en/download/"
fi
ok "Node $(node --version)"

# ── b. Installa tklens CLI ───────────────────────────────────────────────────
if command -v tklens &>/dev/null; then
  ok "tklens già nel PATH — skip npm install"
elif [[ -f "tklens-cli/bin/run.js" ]]; then
  ok "Modalità sviluppo locale — uso tklens-cli/bin/run.js"
  TKLENS_BIN="node tklens-cli/bin/run.js"
else
  echo "Installazione @tokenlens/cli..."
  npm install -g @tokenlens/cli
  ok "tklens CLI installato"
fi
TKLENS_BIN="${TKLENS_BIN:-tklens}"

# ── c. Login ─────────────────────────────────────────────────────────────────
echo "Verifica credenziali..."
$TKLENS_BIN login --endpoint="${SERVER_URL}" --api-key="${API_KEY}"
ok "Login completato"

# ── d. Dry-run collect ───────────────────────────────────────────────────────
echo "Test raccolta eventi (dry-run)..."
COLLECT_OUT=$($TKLENS_BIN collect --output=json 2>&1 | head -5 || true)
EVENT_COUNT=$(echo "$COLLECT_OUT" | grep -c '"event"' || echo "0")

# ── e. Riepilogo ─────────────────────────────────────────────────────────────
echo ""
ok "tklens configurato per ${SERVER_URL}"
ok "${EVENT_COUNT} eventi token trovati in locale (pronti per tklens collect)"
echo ""
echo "  Prossimo passo: aggiungi \`tklens collect\` al tuo crontab/Task Scheduler"
echo "  oppure usa \`tklens collect --daemon\` (disponibile dopo AGENT-22)."
echo ""
