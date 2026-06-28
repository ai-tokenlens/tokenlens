#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# TokenLens — Setup script for macOS
# Tested on: macOS 13 Ventura, 14 Sonoma, 15 Sequoia
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colors ───────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

ok()   { echo -e "${GREEN}✔${RESET}  $*"; }
info() { echo -e "${BLUE}ℹ${RESET}  $*"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $*"; }
fail() { echo -e "${RED}✖${RESET}  $*"; exit 1; }
step() { echo -e "\n${BOLD}── $* ──────────────────────────────${RESET}"; }

# ── Detect shell profile ──────────────────────────────────────
detect_profile() {
  if [[ "$SHELL" == */zsh ]]; then
    echo "$HOME/.zshrc"
  elif [[ "$SHELL" == */bash ]]; then
    [[ -f "$HOME/.bash_profile" ]] && echo "$HOME/.bash_profile" || echo "$HOME/.bashrc"
  else
    echo "$HOME/.profile"
  fi
}
PROFILE=$(detect_profile)

# ── Banner ────────────────────────────────────────────────────
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║   TokenLens — macOS Setup            ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${RESET}"
echo "  This script will:"
echo "  1. Check prerequisites (Docker, Node, Git)"
echo "  2. Configure TokenLens environment"
echo "  3. Start the TokenLens server"
echo "  4. Install the tklens CLI"
echo "  5. Configure your AI tool (Copilot / Claude Code)"
echo ""
read -r -p "  Press Enter to continue, or Ctrl+C to cancel..."

# ══════════════════════════════════════════════════════════════
step "1 / 5 — Checking prerequisites"
# ══════════════════════════════════════════════════════════════

# Homebrew
if ! command -v brew &>/dev/null; then
  warn "Homebrew not found. Installing..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
ok "Homebrew $(brew --version | head -1)"

# Git
if ! command -v git &>/dev/null; then
  info "Installing Git via Homebrew..."
  brew install git
fi
ok "Git $(git --version)"

# Docker Desktop
if ! command -v docker &>/dev/null; then
  fail "Docker Desktop not found.\nPlease install it from https://www.docker.com/products/docker-desktop/ and re-run this script."
fi
if ! docker info &>/dev/null 2>&1; then
  fail "Docker is installed but not running. Please start Docker Desktop and re-run this script."
fi
ok "Docker $(docker --version)"

# Node 20+
if ! command -v node &>/dev/null; then
  info "Node.js not found. Installing Node 20 via Homebrew..."
  brew install node@20
  brew link --overwrite node@20
fi
NODE_VER=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [[ "$NODE_VER" -lt 20 ]]; then
  warn "Node $(node --version) found, but Node 20+ is required."
  info "Upgrading via Homebrew..."
  brew install node@20 && brew link --overwrite node@20
fi
ok "Node $(node --version)"

# ══════════════════════════════════════════════════════════════
step "2 / 5 — Configuring TokenLens"
# ══════════════════════════════════════════════════════════════

# Verify we're in the repo root
if [[ ! -f "SPEC.md" ]]; then
  fail "Run this script from the root of the tokenlens repository.\nExample: cd ~/projects/tokenlens && bash scripts/setup-macos.sh"
fi

# Create .env from example if missing
if [[ ! -f ".env" ]]; then
  cp .env.example .env
  ok "Created .env from .env.example"
else
  ok ".env already exists — skipping"
fi

# Prompt for required values
echo ""
echo -e "${BOLD}  Let's configure your TokenLens instance.${RESET}"
echo "  Press Enter to accept the default value shown in [brackets]."
echo ""

read -r -p "  Your email (used to identify you in the dashboard): " USER_EMAIL
USER_EMAIL="${USER_EMAIL:-user@example.com}"

CURRENT_TOKEN=$(grep INGEST_TOKEN .env | cut -d= -f2 | tr -d '"' | tr -d "'" | xargs)
if [[ "$CURRENT_TOKEN" == "change-me" || -z "$CURRENT_TOKEN" ]]; then
  INGEST_TOKEN=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32 || true)
  sed -i '' "s/INGEST_TOKEN=.*/INGEST_TOKEN=${INGEST_TOKEN}/" .env
  ok "Generated a secure INGEST_TOKEN"
else
  INGEST_TOKEN="$CURRENT_TOKEN"
  ok "Existing INGEST_TOKEN kept"
fi

# ══════════════════════════════════════════════════════════════
step "3 / 5 — Starting TokenLens server"
# ══════════════════════════════════════════════════════════════

info "Running docker compose up --build -d ..."
docker compose up --build -d

# Wait for server to be healthy
info "Waiting for server to be ready..."
MAX_WAIT=60; WAITED=0
until curl -sf http://localhost:8080/health &>/dev/null; do
  sleep 2; WAITED=$((WAITED+2))
  [[ $WAITED -ge $MAX_WAIT ]] && fail "Server did not start within ${MAX_WAIT}s.\nCheck logs with: docker compose logs server"
  echo -n "."
done
echo ""
ok "Server is up → http://localhost:8080"
ok "Dashboard    → http://localhost:3000"

# ══════════════════════════════════════════════════════════════
step "4 / 5 — Installing tklens CLI"
# ══════════════════════════════════════════════════════════════

npm install -g @tokenlens/cli 2>/dev/null || npm install -g @tokenlens/cli
tklens login --endpoint http://localhost:8080 --api-key "$INGEST_TOKEN"
ok "tklens CLI installed and logged in as ${USER_EMAIL}"

# ══════════════════════════════════════════════════════════════
step "5 / 5 — Configuring your AI tool"
# ══════════════════════════════════════════════════════════════

TOKENLENS_ENDPOINT="http://localhost:8080/otel"

# Write OTel variables to shell profile
OTEL_BLOCK="
# ── TokenLens OTel integration ────────────────────────────────
export TOKENLENS_USER=\"${USER_EMAIL}\"
export OTEL_EXPORTER_OTLP_ENDPOINT=\"${TOKENLENS_ENDPOINT}\"
export OTEL_EXPORTER_OTLP_PROTOCOL=\"http/protobuf\"
export OTEL_RESOURCE_ATTRIBUTES=\"tokenlens.user=${USER_EMAIL}\"

# GitHub Copilot CLI
export OTEL_SERVICE_NAME=\"copilot-cli\"

# Claude Code
export CLAUDE_CODE_ENABLE_TELEMETRY=1
# ─────────────────────────────────────────────────────────────"

if grep -q "TokenLens OTel integration" "$PROFILE" 2>/dev/null; then
  warn "OTel variables already present in ${PROFILE} — skipping"
else
  echo "$OTEL_BLOCK" >> "$PROFILE"
  ok "OTel variables added to ${PROFILE}"
fi

# Apply to current session
eval "$OTEL_BLOCK" 2>/dev/null || true

# ══════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}${BOLD}  ✔  TokenLens setup complete!${RESET}"
echo ""
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │  Dashboard  →  http://localhost:3000                │"
echo "  │  API        →  http://localhost:8080                │"
echo "  │  Your ID    →  ${USER_EMAIL}                        "
echo "  └─────────────────────────────────────────────────────┘"
echo ""
echo "  Next steps:"
echo "  1. Open a new terminal (to load the OTel variables)"
echo "  2. Use Copilot CLI or Claude Code as usual"
echo "  3. Open the dashboard to see token usage appear"
echo "  4. Try:  tklens search mulesoft"
echo ""
echo "  To verify everything is working:"
echo "  bash scripts/verify.sh"
echo ""
