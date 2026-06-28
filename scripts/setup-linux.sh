#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# TokenLens — Setup script for Linux
# Tested on: Ubuntu 22.04 / 24.04, Debian 12, Fedora 40
# ─────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

ok()   { echo -e "${GREEN}✔${RESET}  $*"; }
info() { echo -e "${BLUE}ℹ${RESET}  $*"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $*"; }
fail() { echo -e "${RED}✖${RESET}  $*"; exit 1; }
step() { echo -e "\n${BOLD}── $* ──────────────────────────────${RESET}"; }

# ── Detect package manager ────────────────────────────────────
detect_pm() {
  command -v apt-get &>/dev/null && echo "apt" && return
  command -v dnf     &>/dev/null && echo "dnf" && return
  command -v yum     &>/dev/null && echo "yum" && return
  command -v pacman  &>/dev/null && echo "pacman" && return
  echo "unknown"
}
PM=$(detect_pm)

pkg_install() {
  case "$PM" in
    apt)    sudo apt-get install -y "$@" ;;
    dnf)    sudo dnf install -y "$@" ;;
    yum)    sudo yum install -y "$@" ;;
    pacman) sudo pacman -S --noconfirm "$@" ;;
    *)      fail "Unsupported package manager. Install $* manually." ;;
  esac
}

# ── Detect shell profile ──────────────────────────────────────
detect_profile() {
  [[ "$SHELL" == */zsh  ]] && echo "$HOME/.zshrc"   && return
  [[ "$SHELL" == */bash ]] && echo "$HOME/.bashrc"  && return
  echo "$HOME/.profile"
}
PROFILE=$(detect_profile)

# ── Banner ────────────────────────────────────────────────────
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║   TokenLens — Linux Setup            ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${RESET}"
echo "  Package manager detected: ${BOLD}${PM}${RESET}"
echo ""
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

# Git
if ! command -v git &>/dev/null; then
  info "Installing Git..."
  pkg_install git
fi
ok "Git $(git --version)"

# Docker
if ! command -v docker &>/dev/null; then
  info "Docker not found. Installing via official script..."
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  warn "You have been added to the 'docker' group."
  warn "Please log out and back in, then re-run this script."
  exit 0
fi
if ! docker info &>/dev/null 2>&1; then
  info "Starting Docker service..."
  sudo systemctl enable --now docker || fail "Could not start Docker. Run: sudo systemctl start docker"
fi
ok "Docker $(docker --version)"

# Docker Compose (v2 plugin)
if ! docker compose version &>/dev/null 2>&1; then
  info "Installing Docker Compose plugin..."
  if [[ "$PM" == "apt" ]]; then
    pkg_install docker-compose-plugin
  else
    # Manual install of latest v2 plugin
    COMPOSE_VERSION=$(curl -fsSL https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | sed 's/.*"v\([^"]*\)".*/\1/')
    sudo mkdir -p /usr/local/lib/docker/cli-plugins
    sudo curl -SL "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" \
      -o /usr/local/lib/docker/cli-plugins/docker-compose
    sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  fi
fi
ok "Docker Compose $(docker compose version)"

# Node 20+
if ! command -v node &>/dev/null || [[ "$(node -e 'process.stdout.write(process.versions.node.split(".")[0])')" -lt 20 ]]; then
  info "Installing Node.js 20 via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>/dev/null || \
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - 2>/dev/null || \
    fail "Could not install Node.js automatically. Visit https://nodejs.org and install Node 20 manually."
  pkg_install nodejs 2>/dev/null || pkg_install nodejs npm
fi
ok "Node $(node --version)"

# ══════════════════════════════════════════════════════════════
step "2 / 5 — Configuring TokenLens"
# ══════════════════════════════════════════════════════════════

if [[ ! -f "SPEC.md" ]]; then
  fail "Run this script from the root of the tokenlens repository.\nExample: cd ~/projects/tokenlens && bash scripts/setup-linux.sh"
fi

if [[ ! -f ".env" ]]; then
  cp .env.example .env
  ok "Created .env from .env.example"
else
  ok ".env already exists — skipping"
fi

echo ""
echo -e "${BOLD}  Let's configure your TokenLens instance.${RESET}"
echo ""
read -r -p "  Your email (used to identify you in the dashboard): " USER_EMAIL
USER_EMAIL="${USER_EMAIL:-user@example.com}"

CURRENT_TOKEN=$(grep INGEST_TOKEN .env | cut -d= -f2 | xargs 2>/dev/null || echo "change-me")
if [[ "$CURRENT_TOKEN" == "change-me" || -z "$CURRENT_TOKEN" ]]; then
  INGEST_TOKEN=$(cat /proc/sys/kernel/random/uuid | tr -d '-' | head -c 32)
  sed -i "s/INGEST_TOKEN=.*/INGEST_TOKEN=${INGEST_TOKEN}/" .env
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

info "Waiting for server to be ready..."
MAX_WAIT=60; WAITED=0
until curl -sf http://localhost:8080/health &>/dev/null; do
  sleep 2; WAITED=$((WAITED+2))
  [[ $WAITED -ge $MAX_WAIT ]] && fail "Server did not start within ${MAX_WAIT}s.\nCheck logs: docker compose logs server"
  echo -n "."
done
echo ""
ok "Server is up → http://localhost:8080"
ok "Dashboard    → http://localhost:3000"

# ══════════════════════════════════════════════════════════════
step "4 / 5 — Installing tklens CLI"
# ══════════════════════════════════════════════════════════════

sudo npm install -g @tokenlens/cli
tklens login --endpoint http://localhost:8080 --api-key "$INGEST_TOKEN"
ok "tklens CLI installed and logged in as ${USER_EMAIL}"

# ══════════════════════════════════════════════════════════════
step "5 / 5 — Configuring your AI tool"
# ══════════════════════════════════════════════════════════════

OTEL_BLOCK="
# ── TokenLens OTel integration ────────────────────────────────
export TOKENLENS_USER=\"${USER_EMAIL}\"
export OTEL_EXPORTER_OTLP_ENDPOINT=\"http://localhost:8080/otel\"
export OTEL_EXPORTER_OTLP_PROTOCOL=\"http/json\"
export OTEL_EXPORTER_OTLP_HEADERS=\"Authorization=Bearer ${INGEST_TOKEN}\"
export OTEL_RESOURCE_ATTRIBUTES=\"tokenlens.user=${USER_EMAIL}\"
export OTEL_SERVICE_NAME=\"copilot-cli\"
export CLAUDE_CODE_ENABLE_TELEMETRY=1
# ─────────────────────────────────────────────────────────────"

if grep -q "TokenLens OTel integration" "$PROFILE" 2>/dev/null; then
  warn "OTel variables already present in ${PROFILE} — skipping"
else
  echo "$OTEL_BLOCK" >> "$PROFILE"
  ok "OTel variables added to ${PROFILE}"
fi

eval "$OTEL_BLOCK" 2>/dev/null || true

# ══════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}${BOLD}  ✔  TokenLens setup complete!${RESET}"
echo ""
echo "  Dashboard  →  http://localhost:3000"
echo "  API        →  http://localhost:8080"
echo "  Your ID    →  ${USER_EMAIL}"
echo ""
echo "  Next steps:"
echo "  1. Open a new terminal (to load the OTel variables)"
echo "  2. Use Copilot CLI or Claude Code as usual"
echo "  3. Open the dashboard to see token usage appear"
echo "  4. Try:  tklens search mulesoft"
echo ""
echo "  To verify:  bash scripts/verify.sh"
echo ""
