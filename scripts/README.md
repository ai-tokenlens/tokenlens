# TokenLens — Setup & Verify Scripts

## Which script to run

| OS | Command |
|----|---------|
| macOS | `bash scripts/setup-macos.sh` |
| Linux (Ubuntu/Debian/Fedora) | `bash scripts/setup-linux.sh` |
| Windows (PowerShell 5.1+) | `.\scripts\setup-windows.ps1` |

Run from the **repository root**.

---

## What each setup script does

1. Checks prerequisites — Docker, Docker Compose, Node 20+, Git
2. Copies `.env.example` → `.env` (skipped if `.env` already exists)
3. Generates a random `INGEST_TOKEN` in `.env` (skipped if already set)
4. Runs `docker compose up --build -d` to start server + frontend
5. Waits for `GET /health` on port 8080 to return 200
6. Installs the `tklens` CLI globally via npm
7. Runs `tklens login` to store endpoint + API key in `~/.tklens/config.json`
8. Writes OTel environment variables to your shell profile (or Windows User env)

---

## Verification

After setup (or after `docker compose up -d`):

```bash
# macOS / Linux
bash scripts/verify.sh

# Windows
.\scripts\verify.ps1
```

Checks performed:

- `server` container is running
- `frontend` container is running
- `GET http://localhost:8080/health` returns 200
- `http://localhost:3000` is reachable
- `tklens` CLI is installed
- `tklens whoami` shows a configured endpoint
- `OTEL_EXPORTER_OTLP_ENDPOINT` is set in the current shell

---

## Updating after `git pull`

```bash
git pull
docker compose up --build -d
```

No need to re-run the full setup script — your `.env` and CLI config are preserved.

---

## MCP server setup

To activate the MCP integration (Claude Code / Copilot):

```bash
# stdio — Claude Code (macOS / Linux)
bash scripts/mcp-setup.sh

# stdio — Claude Code (Windows)
.\scripts\mcp-setup.ps1

# HTTP/SSE — Copilot or remote agents (macOS / Linux)
bash scripts/mcp-setup.sh --transport=http

# HTTP/SSE — Copilot or remote agents (Windows)
.\scripts\mcp-setup.ps1 -Transport http
```

See [`docs/mcp-setup.md`](../docs/mcp-setup.md) for full details.

---

## Key ports

| Service | URL |
|---------|-----|
| API / OTel receiver | `http://localhost:8080` |
| Dashboard | `http://localhost:3000` |
| Health check | `http://localhost:8080/health` |
| MCP HTTP/SSE (optional) | `http://localhost:8082/sse` |
