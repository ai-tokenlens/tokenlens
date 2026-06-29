# TokenLens 🔍

> Self-hosted token observability **and** a Nexus-style skill registry for AI coding assistants.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status](https://img.shields.io/badge/status-MVP-orange.svg)]()

TokenLens helps engineering teams **see** how many tokens their AI coding tools burn — and **cut that cost** by sharing efficient, reusable skills from a local registry.

---

## Why TokenLens?

Token consumption of AI coding assistants (GitHub Copilot, Claude Code) is almost impossible to predict up front, and once you're on usage-based billing it becomes a real cost line. Existing tools can *track* tokens. **None of them pair tracking with a skill registry that actively recommends more efficient ways to work.** That pairing is what TokenLens is for.

Two halves, working together:

| Track | Reuse |
|-------|-------|
| Per-user token consumption across tools, aggregated into dashboards | A "Nexus for AI skills": browse, rate, comment, publish, and pull skills from one local registry |

Usage data feeds a **recommendation engine** that points you at the registry skills most likely to reduce your token burn.

---

## Features (MVP)

- 📊 **Unified token dashboard** — per user, tool, model, and day
- 🔌 **Standards-based collection** — tools push usage via OpenTelemetry (no fragile log scraping); session-file fallback included
- 📦 **Skill Registry** — canonical neutral format, materialized per tool on download (`SKILL.md` for Claude Code, `.instructions.md` for Copilot)
- 🪞 **Pull-through proxy** — fetch a remote skill once, cache it locally, serve from cache forever after (just like a Maven/Nexus proxy)
- ⭐ **Ratings & comments** — community signal on every skill
- 🧮 **Efficiency recommendations** — usage-driven suggestions to lower token cost
- ⌨️ **`tklens` CLI** — low-token, no-LLM interface for search / add / publish / pull
- 🐳 **One-command install** — `docker compose up`

> Not a token-tracker clone: tracking reuses open standards on purpose. The differentiator is the **registry + recommendation engine**.

---

## Supported tools

| Tool | Collection | Status |
|------|-----------|--------|
| GitHub Copilot CLI | OpenTelemetry (primary), session-file (fallback) | ✅ MVP |
| Claude Code | OpenTelemetry (primary), logs (fallback) | ✅ MVP |
| Cursor | — | 🔜 v0.2 |
| Continue.dev | — | 🔜 v0.2 |

---

## Quickstart (5 minutes)

### 1. Run the server + dashboard
```bash
git clone https://github.com/<you>/tokenlens.git
cd tokenlens
bash scripts/generate-key.sh   # genera INGEST_TOKEN in .env (oppure scripts/generate-key.ps1 su Windows)
bash scripts/start-server.sh   # avvia Docker Compose + health check (oppure scripts/start-server.ps1)
```
- Dashboard → http://localhost:3000
- API → http://localhost:8080

### 2. Point your AI tool at TokenLens (OpenTelemetry)

**GitHub Copilot CLI**
```bash
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:8080/otel"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/json"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <your-ingest-token>"
export OTEL_SERVICE_NAME="copilot-cli"
export OTEL_RESOURCE_ATTRIBUTES="tokenlens.user=you@example.com"
# then use copilot as usual
```

**Claude Code**
```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:8080/otel"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/json"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <your-ingest-token>"
export OTEL_RESOURCE_ATTRIBUTES="tokenlens.user=you@example.com"
# then use claude as usual
```

> Full per-OS setup (bash/zsh profile, macOS, Linux) in [`docs/otel-setup.md`](./docs/otel-setup.md).

### 3. Install the CLI
```bash
npm install -g @tokenlens/cli
tklens login --endpoint http://localhost:8080 --api-key <your-key>
# login verifica la chiave contro il server; in caso di server offline salva comunque con avviso
tklens search mulesoft
tklens add mulesoft-api-doc-generator --target=auto
```

> For a full step-by-step guide, see [GETTING_STARTED.md](./GETTING_STARTED.md) · [GETTING_STARTED_EN.md](./GETTING_STARTED_EN.md)

### 4. Enable MCP (optional)

Expose the TokenLens registry and analytics to AI agents (Claude Code, Copilot, custom HTTP agents) via the MCP server.

**Claude Code (stdio)**
```bash
tklens mcp-setup --apply
# Writes the mcp entry to ~/.claude/claude_desktop_config.json
tklens whoami   # verify credentials are picked up
```

**Copilot / remote HTTP agents (HTTP/SSE)**
```bash
tklens mcp-setup --transport=http --apply
# Writes .copilot/mcp.json in the current workspace
# Then start the MCP service:
docker compose --profile mcp up
```

> Full setup guide (env vars, resources, prompts) in [`docs/mcp-setup.md`](./docs/mcp-setup.md).

---

## OTel setup verificato

Variables confirmed against AGENT-04 implementation (`server/otel/receiver.py`, `server/otel/genai_mapper.py`):

**GitHub Copilot CLI**
| Variable | Value | Notes |
|----------|-------|-------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:8080/otel` | TokenLens receiver |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `http/json` | server parses JSON; protobuf not supported |
| `OTEL_EXPORTER_OTLP_HEADERS` | `Authorization=Bearer <token>` | INGEST_TOKEN dal .env |
| `OTEL_SERVICE_NAME` | `copilot-cli` | identifies tool in dashboard |
| `OTEL_RESOURCE_ATTRIBUTES` | `tokenlens.user=you@example.com` | maps to `user_id` in DB |

**Claude Code**
| Variable | Value | Notes |
|----------|-------|-------|
| `CLAUDE_CODE_ENABLE_TELEMETRY` | `1` | activates OTel export |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:8080/otel` | TokenLens receiver |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `http/json` | server parses JSON; protobuf not supported |
| `OTEL_EXPORTER_OTLP_HEADERS` | `Authorization=Bearer <token>` | INGEST_TOKEN dal .env |
| `OTEL_RESOURCE_ATTRIBUTES` | `tokenlens.user=you@example.com` | maps to `user_id` in DB |

GenAI semantic convention attributes read by the mapper: `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.request.model`. See [`docs/otel-setup.md`](./docs/otel-setup.md) for shell rc snippets.

---

## tklens CLI reference

| Command | Arguments | Flags | Description |
|---------|-----------|-------|-------------|
| `tklens login` | — | `--endpoint URL` `--api-key KEY` | Save server credentials to `~/.tklens/config.json` |
| `tklens whoami` | — | — | Print current user and endpoint |
| `tklens search <query>` | `query` | `--tag TAG` `--sort rating\|efficiency\|popular\|new` | Search skill registry |
| `tklens info <skillId>` | `skillId` | — | Show skill details and version history |
| `tklens add <skillId>` | `skillId` | `--target auto\|claude-code\|copilot` | Download and materialize skill into cwd |
| `tklens publish [path]` | `path` (default `.`) | — | Pack and upload skill from `skill.toml` |
| `tklens pull <originUrl>` | `originUrl` | — | Pull-through proxy: fetch remote skill URL, cache locally |
| `tklens rate <skillId>` | `skillId` | `--stars 1-5` `--comment TEXT` | Rate a skill |
| `tklens collect` | — | `--tool copilot-cli\|claude-code` `--since ISO` `--output json` `--dry-run` | Fallback session-file collector (no OTel) |
| `tklens collect` | — | `--daemon` `--interval=MIN` | Avvia il collector in background (ogni 15 min di default) |
| `tklens collect` | — | `--status` | Verifica se il daemon è attivo |
| `tklens collect` | — | `--stop` | Ferma il daemon in background |
| `tklens collect-schedule` | — | — | Aggiunge crontab entry (macOS/Linux) o Task Scheduler task (Windows) |
| `tklens collect-schedule` | — | `--unschedule` | Rimuove la schedulazione |

`add --target=auto` detects target from cwd: `.claude/` → `claude-code`, `.copilot/` → `copilot`, default `claude-code`.

### Modalità daemon

```bash
tklens collect --daemon            # avvia in background, ogni 15 minuti
tklens collect --daemon --interval=30
tklens collect --status            # verifica se il daemon è attivo
tklens collect --stop              # ferma il daemon
```

Il daemon scrive:
- `~/.tklens/collect.pid` — PID del processo; rimosso all'arresto
- `~/.tklens/last-collect.json` — `{"timestamp": "<ISO>", "sent": <N>}` aggiornato ogni ciclo
- `~/.tklens/collect.log` — errori di rete/auth (il daemon non crasha, riprende al ciclo successivo)

### Schedulazione automatica

```bash
tklens collect-schedule            # aggiunge crontab entry (macOS/Linux)
                                   # o Task Scheduler task (Windows, nome: TokenLens-Collect)
tklens collect-schedule --unschedule
```

Su Windows lo script usa `schtasks.exe`; su macOS/Linux modifica il crontab dell'utente corrente.

---

## Authentication

### Login e verifica chiave

`tklens login --endpoint <URL> --api-key <key>` verifica la chiave contro il server prima di salvarla (`GET /api/v1/auth/verify`). Se il server non è raggiungibile, la chiave viene salvata con avviso "server non raggiungibile".

```bash
tklens login --endpoint http://localhost:8080 --api-key <your-key>
# ✔ Autenticato su http://localhost:8080.
```

### Rotazione della chiave (amministratori)

```http
POST /api/v1/admin/rotate-key
Authorization: Bearer <vecchio-token>

→ 200 {"token": "<nuovo-token>"}
```

Il nuovo token è attivo immediatamente in memoria; viene anche scritto nella riga `INGEST_TOKEN` del file `.env` per sopravvivere ai riavvii. Dopo la rotazione aggiorna la CLI:

```bash
tklens login --endpoint http://localhost:8080 --api-key <nuovo-token>
```

### Health-check autenticazione

```http
GET /api/v1/auth/verify
Authorization: Bearer <token>

→ 200 {"valid": true, "user": "service"}
→ 401 {"detail": "Invalid or missing token"}
```

---

## Ops scripts

| Script | Piattaforma | Scopo |
|--------|-------------|-------|
| `scripts/generate-key.sh` / `.ps1` | bash / PowerShell | Genera `INGEST_TOKEN` sicuro e lo scrive in `.env`; chiede conferma se la chiave esiste già |
| `scripts/start-server.sh` / `.ps1` | bash / PowerShell | Verifica prerequisiti, avvia Docker Compose, poll health ogni 2s (max 30 tentativi) |
| `scripts/new-user-setup.sh` / `.ps1` | bash / PowerShell | Setup interattivo per un nuovo utente senza accesso al server Docker (installa CLI, login, dry-run collect) |

---

## Dashboard

La dashboard principale (`/`) mostra token trends, top consumers e breakdown per tool/modello.

### Filtro per utente

Il dropdown **Utente** in alto a destra filtra tutti i grafici (TokenTrendChart, ToolBreakdownPie, AnalyticsSummary) per un singolo utente. Selezionare "Tutti" riporta alla vista globale.

Le barre di **TopConsumersChart** sono cliccabili: cliccando su un utente si naviga direttamente a `/users/<userId>`.

### Pagina utente (`/users/:userId`)

La pagina `UserDetail` mostra tre sezioni:

| Sezione | Contenuto |
|---------|-----------|
| **Consumi** | TokenTrendChart degli ultimi 30 giorni, filtrato per questo utente |
| **Top tool usati** | BarChart orizzontale dei tool di questo utente (da `by_tool`) |
| **Riepilogo** | KPI cards: `total_tokens`, `input_tokens`, `output_tokens`, `cache_read_tokens` (ultimi 30 giorni e all-time) |

Un link "← Dashboard" in alto riporta alla vista globale.

---

## How the skill registry works

```
   tklens pull <remote-url>
            │
            ▼
   ┌─────────────────┐   not cached?   ┌──────────────┐
   │ TokenLens proxy │ ──────────────► │ remote repo  │
   └─────────────────┘                 └──────────────┘
            │  cache locally (copy)
            ▼
   ┌─────────────────┐
   │  local registry │  ◄── all future pulls served from here
   └─────────────────┘
            │  tklens add <id> --target=auto
            ▼
   adapter materializes → SKILL.md (Claude Code) or .instructions.md (Copilot)
```

Skills are stored in a **canonical neutral format** (`skill.toml` + payload). At download time, an adapter renders the right layout for your tool. The same skill therefore serves both Claude Code and Copilot users.

---

## Architecture

```
Copilot CLI / Claude Code ──OTLP──► TokenLens Server ──► PostgreSQL/SQLite + blob store
        │                                  │
   tklens CLI ──REST──────────────────────┤
                                           ▼
                                    React dashboard
```

| Component | Tech | Notes |
|-----------|------|-------|
| Server | Python · FastAPI · SQLAlchemy | REST API + OTel receiver · port 8080 |
| CLI | Node · TypeScript · oclif | `tklens` binary |
| Frontend | React · Vite · Tailwind · Recharts | Dashboard · port 3000 |
| MCP Server | Node · `@modelcontextprotocol/sdk` | stdio + HTTP/SSE · port 8082 |
| Storage | SQLite/Postgres + filesystem/S3 | |

Full design in [`SPEC.md`](./SPEC.md).

---

## Tools available via MCP

| Tool | Description | Auth required |
|------|-------------|---------------|
| `search_skills(query, tag?, sort?)` | Search the skill registry | No |
| `get_skill(id)` | Full skill metadata + usage instructions | No |
| `add_skill_to_workspace(id, target?, workspace_path?)` | Download + extract skill; records a UsageEvent | No |
| `rate_skill(id, stars, comment?)` | Rate a skill | Yes |
| `get_my_usage(from?, to?)` | Token totals for the configured user | No |
| `publish_skill(skill_toml, payload_b64)` | Publish a new skill from agent context | Yes |

---

## Project status & roadmap

MVP in active development. Next up:

- v0.2 — Cursor & Continue.dev collectors; first-class MCP server
- v0.3 — Slack/Teams digests; per-user budget thresholds
- v0.4 — Skill dependency graph
- v0.5 — AI-assisted skill authoring
- v1.0 — Opt-in public community registry

---

## Contributing

Contributions welcome — see [`CONTRIBUTING.md`](./CONTRIBUTING.md). The project is structured for parallel development; each module (`server`, `tklens-cli`, `frontend`) is independently buildable.

## License

MIT © TokenLens contributors
