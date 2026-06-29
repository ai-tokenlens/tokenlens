#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# TokenLens — MCP server setup (macOS / Linux)
#
# Usage:
#   bash scripts/mcp-setup.sh                   # stdio → Claude Code
#   bash scripts/mcp-setup.sh --transport=http  # HTTP/SSE → Copilot / remote agents
# ─────────────────────────────────────────────────────────────
set -uo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
BOLD='\033[1m'; RESET='\033[0m'

ok()   { echo -e "  ${GREEN}✔${RESET}  $*"; }
fail() { echo -e "  ${RED}✖${RESET}  $*"; exit 1; }
info() { echo -e "  ${YELLOW}→${RESET}  $*"; }

TRANSPORT="stdio"
for arg in "$@"; do
  case $arg in
    --transport=http)  TRANSPORT="http"  ;;
    --transport=stdio) TRANSPORT="stdio" ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MCP_DIR="$ROOT_DIR/mcp-server"
TKLENS_CONFIG="$HOME/.tklens/config.json"

echo -e "\n${BOLD}  TokenLens — MCP Server Setup (${TRANSPORT})${RESET}\n"

# Read a field from ~/.tklens/config.json via node
_cfg() {
  node -e "try{const c=require('fs').readFileSync('$TKLENS_CONFIG','utf-8');process.stdout.write(JSON.parse(c)['$1']||'')}catch{process.stdout.write('')}" 2>/dev/null || true
}

ENDPOINT=$(_cfg endpoint); ENDPOINT="${ENDPOINT:-http://localhost:8080}"
API_KEY=$(_cfg apiKey)
USER_ID=$(_cfg userId)

# ─── stdio (Claude Code) ───────────────────────────────────────
if [[ "$TRANSPORT" == "stdio" ]]; then
  info "Building mcp-server..."
  cd "$MCP_DIR"
  npm install --silent >/dev/null 2>&1
  npm run build >/dev/null 2>&1 || fail "mcp-server build failed — run 'npm run build' in mcp-server/ for details"
  ok "mcp-server built  →  $MCP_DIR/dist/index.js"

  CLAUDE_CONFIG="$HOME/.claude/claude_desktop_config.json"
  mkdir -p "$(dirname "$CLAUDE_CONFIG")"
  if [[ -f "$CLAUDE_CONFIG" ]]; then
    cp "$CLAUDE_CONFIG" "${CLAUDE_CONFIG}.bak"
    info "Backup: ${CLAUDE_CONFIG}.bak"
  fi

  node -e "
const fs = require('fs');
const p = '$CLAUDE_CONFIG';
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(p, 'utf-8')); } catch {}
cfg.mcpServers = cfg.mcpServers || {};
cfg.mcpServers.tokenlens = {
  command: 'node',
  args: ['$MCP_DIR/dist/index.js'],
  env: {
    TOKENLENS_ENDPOINT: '$ENDPOINT',
    TOKENLENS_API_KEY:  '$API_KEY',
    TOKENLENS_USER:     '$USER_ID',
    TOKENLENS_MCP_TRANSPORT: 'stdio'
  }
};
fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
" || fail "Failed to write $CLAUDE_CONFIG"

  ok "Scritto in $CLAUDE_CONFIG"
  echo ""
  echo -e "  ${BOLD}Prossimo passo:${RESET} riavvia Claude Code per caricare il server MCP."
  echo "  Verifica config: tklens mcp-setup --show-current"
  echo ""

# ─── http (Copilot / remote agents) ───────────────────────────
elif [[ "$TRANSPORT" == "http" ]]; then
  info "Avvio container MCP via Docker..."
  cd "$ROOT_DIR"
  docker compose --profile mcp up -d || fail "docker compose --profile mcp up -d fallito"
  ok "Container MCP avviato su porta ${TOKENLENS_MCP_PORT:-8082}"

  info "Scrittura .copilot/mcp.json nella directory corrente..."
  tklens mcp-setup --transport=http --apply || fail "'tklens mcp-setup --transport=http --apply' fallito"
  ok "Copilot config aggiornata (.copilot/mcp.json)"

  echo ""
  echo -e "  ${BOLD}MCP SSE endpoint:${RESET} http://localhost:${TOKENLENS_MCP_PORT:-8082}/sse"
  echo "  Test:  curl -sf http://localhost:${TOKENLENS_MCP_PORT:-8082}/sse | head -1"
  echo "  Per dettagli: docs/mcp-setup.md"
  echo ""
fi
