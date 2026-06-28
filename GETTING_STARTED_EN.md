# Getting Started with TokenLens

This guide takes you from zero to a running TokenLens in under 10 minutes, step by step. Nothing is assumed.

> **Version:** compatible with macOS 13+, Ubuntu 22.04+, Debian 12+, Windows 10/11  
> **Estimated time:** 5–10 minutes (excluding Docker download if not already installed)

---

## Before you begin — What you need

| Requirement | Why | How to check |
|-------------|-----|--------------|
| **Docker Desktop** | Starts the server and dashboard with a single command | `docker --version` |
| **Node.js 20+** | Required for the `tklens` CLI | `node --version` |
| **Git** | To download the code | `git --version` |
| **GitHub Copilot CLI** and/or **Claude Code** | The AI tools whose tokens we track | — |

Don't worry if something is missing: the setup script installs it for you.

---

## Step 1 — Download TokenLens

Open a terminal (on Windows: use **PowerShell**, not Command Prompt).

```bash
git clone https://github.com/<owner>/tokenlens.git
cd tokenlens
```

You should be in a folder containing `SPEC.md`, `docker-compose.yml`, and the `scripts/` folder.

---

## Step 2 — Run the automatic setup script

Choose the command for your operating system.

### macOS

```bash
bash scripts/setup-macos.sh
```

### Linux (Ubuntu, Debian, Fedora…)

```bash
bash scripts/setup-linux.sh
```

### Windows (PowerShell)

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
.\scripts\setup-windows.ps1
```

> **Note on Windows:** the `Set-ExecutionPolicy` command is only needed once and allows running local PowerShell scripts. It does not lower system security.

---

The script will automatically do the following:

```
[OK] Check that Docker, Node, and Git are installed (and installs them if missing)
[OK] Create the .env file with a randomly generated secure key
[OK] Ask only for your email address
[OK] Start the server and dashboard with Docker
[OK] Install the tklens CLI
[OK] Add environment variables for Copilot CLI and Claude Code
```

When the script finishes you will see:

```
  ✔  TokenLens setup complete!

  Dashboard  →  http://localhost:3000
  API        →  http://localhost:8080
```

---

## Step 3 — Open a new terminal

> ⚠️ **Important.** The environment variables for token collection are loaded into your shell profile. For them to take effect, you must open a **new** terminal (or a new PowerShell window on Windows).

On macOS/Linux you can also run:
```bash
source ~/.zshrc   # or: source ~/.bashrc
```

---

## Step 4 — Verify everything works

```bash
bash scripts/verify.sh      # macOS and Linux
.\scripts\verify.ps1        # Windows
```

The expected output is:

```
  ✔  server container is running
  ✔  frontend container is running
  ✔  API responds at http://localhost:8080/health
  ✔  Dashboard accessible at http://localhost:3000
  ✔  tklens CLI installed
  ✔  tklens is logged in
  ✔  OTel env vars loaded

  All checks passed. TokenLens is ready!
```

If any item shows `[XX]`, the message tells you exactly what to do.

---

## Step 5 — Use your AI tools as usual

From this point on **you don't need to change anything** in your workflow.

- Use **GitHub Copilot CLI** normally: tokens are tracked automatically via OpenTelemetry.
- Use **Claude Code** normally: same thing.

After a few interactions, open your browser at [http://localhost:3000](http://localhost:3000) and you will see data appear in the dashboard.

---

## Step 6 — Explore the skill registry

The registry already includes three ready-to-use skills:

| ID | Description |
|----|-------------|
| `mulesoft-api-doc-generator` | Generates API documentation from MuleSoft specs |
| `java-unit-test-generator` | Generates JUnit tests from Java classes |
| `git-commit-message` | Produces conventional commit messages |

```bash
# Search available skills
tklens search mulesoft

# Skill details
tklens info mulesoft-api-doc-generator

# Add a skill to the current project (auto-detects your tool)
tklens add mulesoft-api-doc-generator --target=auto

# Other examples with seed skills
tklens add java-unit-test-generator --target=auto
tklens add git-commit-message --target=auto
```

`--target=auto` detects whether you are using Claude Code (looks for `.claude/`) or Copilot (looks for `.copilot/`) and materializes the skill in the correct format.

---

## Step 7 — Publish your own skill

If you have a prompt or custom instruction that works well, share it with the team:

1. Create a folder with a `skill.toml` file (see `examples/skills/` for examples)
2. Run:

```bash
tklens publish ./my-skill/
```

The skill will immediately be available in the local registry for all team members.

---

## Updating TokenLens

When a new version is released:

```bash
git pull
docker compose up --build -d
npm update -g @tokenlens/cli
```

---

## Stopping and restarting the server

```bash
# Stop
docker compose down

# Restart (data is preserved in the ./data volume)
docker compose up -d
```

---

## Common troubleshooting

### The dashboard shows no tokens after using the AI tool

1. Verify that the OTel variables are loaded in the terminal where you use the tool:
   ```bash
   echo $OTEL_EXPORTER_OTLP_ENDPOINT   # should print http://localhost:8080/otel
   ```
2. If empty, open a new terminal and try again.
3. Check the server logs to see if requests are arriving:
   ```bash
   docker compose logs -f server
   ```

### `docker compose up` fails with "port already in use"

Something else is using port 8080 or 3000. You can change ports in the `.env` file:
```
SERVER_PORT=8081
FRONTEND_PORT=3001
```
Then relaunch `docker compose up -d`.

### Windows: "Execution of scripts is disabled"

Run this command once in PowerShell as administrator:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### `tklens: command not found` after installation

The global npm path is not in PATH. Add:
```bash
# macOS / Linux
export PATH="$(npm config get prefix)/bin:$PATH"
```
On Windows, restart PowerShell after installation.

---

## Advanced configuration

### Pointing to a remote TokenLens server

If the server runs on a different machine, edit `.env` in the project folder:

```
TOKENLENS_ENDPOINT=http://192.168.1.50:8080
```

Then re-run the CLI login:

```bash
tklens login --endpoint http://192.168.1.50:8080 --api-key <your-key>
```

### Using PostgreSQL instead of SQLite

For production environments or teams with multiple users, use `docker-compose.prod.yml` which configures PostgreSQL:

```bash
docker compose -f docker-compose.prod.yml up -d
```

See [`docker-compose.prod.yml`](./docker-compose.prod.yml) for connection parameters (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`).

### Exposing the server on the local network

To make the server accessible to other devices on the same network, set `HOST` in `.env`:

```
HOST=0.0.0.0
```

Then relaunch:

```bash
docker compose up -d
```

The server will be reachable at your machine's IP address on the configured port (default 8080).

---

## Where to go from here

- **Dashboard** → [http://localhost:3000](http://localhost:3000)
- **API docs** → [http://localhost:8080/docs](http://localhost:8080/docs) (FastAPI's automatic Swagger UI)
- **Architecture & spec** → [`SPEC.md`](./SPEC.md)
- **How to contribute** → [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- **Skill format** → [`docs/skill-format.md`](./docs/skill-format.md)
