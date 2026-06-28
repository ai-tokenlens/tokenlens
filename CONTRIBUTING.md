# Contributing to TokenLens

## Clone & prerequisites

```bash
git clone https://github.com/<you>/tokenlens.git
cd tokenlens
```

- Python 3.11+
- Node 20+
- npm 9+

---

## Running without Docker

Each module is independently runnable. Start them in separate terminals.

### Server (FastAPI)

```bash
cd server
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows
.venv\Scripts\activate

pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload --port 8080
```

API available at `http://localhost:8080`. Interactive docs at `http://localhost:8080/docs`.

### Frontend (React + Vite)

```bash
cd frontend
npm install
VITE_API_BASE=http://localhost:8080 npm run dev
```

Dashboard at `http://localhost:5173`.

### tklens CLI

```bash
cd tklens-cli
npm install
npm run build
npm link          # makes `tklens` available globally in this shell
tklens login --endpoint http://localhost:8080 --api-key dev
```

---

## Running tests

```bash
# Server unit tests
cd server
pytest

# CLI tests
cd tklens-cli
npm test
```

---

## Running mcp-server locally

```bash
cd mcp-server
npm install
npm run build
```

**stdio** (default — used by Claude Code):
```bash
TOKENLENS_ENDPOINT=http://localhost:8080 node dist/index.js
```

**HTTP/SSE** (used by Copilot and remote agents):
```bash
TOKENLENS_MCP_TRANSPORT=http node dist/index.js
# Server binds to 0.0.0.0:8082, MCP SSE endpoint at /sse
```

Set `TOKENLENS_API_KEY` and `TOKENLENS_USER` to enable auth'd tools (`rate_skill`, `publish_skill`) and usage loop-back.

---

## Adding a new MCP tool

1. Create `mcp-server/src/tools/<toolName>.ts` — export a `definition` (MCP `Tool` schema) and a `handler(args, client)` async function.
2. Register in `mcp-server/src/server.ts`: import and add to the `tools` array passed to `server.setRequestHandler`.
3. If the tool needs auth, call `client.requireAuth()` (throws with a user-friendly message if `TOKENLENS_API_KEY` is unset).
4. Write a test in `mcp-server/src/tests/<toolName>.test.ts` that stubs `apiClient` and asserts the handler output shape.
5. Update the tools table in `README.md` and `docs/mcp-setup.md`.

---

## Adding a tool collector (new OTel source)

> Follow this when you want TokenLens to ingest data from a new AI coding tool (e.g., Cursor).

1. **OTel receiver** — no changes needed if the tool emits OTLP/HTTP on `POST /otel/v1/traces`. The receiver at `server/otel/receiver.py` accepts any OTLP payload.

2. **GenAI mapper** — open `server/otel/genai_mapper.py`. Add a branch in the span-normalisation logic that maps your tool's span attributes to the `UsageEvent` fields (`input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`, `model`, `user_id`). Use the existing Copilot/Claude Code branches as reference.

3. **Fallback collector** — add a parser function in `tklens-cli/src/commands/collect.ts`:
   - Export a `findFiles` call that locates your tool's session/storage files.
   - Export a `parse<ToolName>Files(files, tick?)` function that converts them to `EventPayload[]`.
   - Wire it into the `Collect.run()` method under a new `tools.push('your-tool')` detection branch.

4. **Tests** — add at least one unit test in `server/tests/test_otel_receiver.py` with a minimal OTLP fixture, and a parallel test in `tklens-cli/src/tests/collect.test.ts` for the session parser.

5. **Docs** — update the "Supported tools" table in `README.md` and add an env-var block to `docs/otel-setup.md`.

---

## Adding a skill to the registry

> Follow this when you want to contribute a new reusable skill.

1. Create a directory under `examples/skills/<skill-id>/`.

2. Write `skill.toml` — see [`docs/skill-format.md`](./docs/skill-format.md) for the full spec.

3. Create payload files for each target:
   - `payload/claude-code/SKILL.md` — rendered by the `claude-code` adapter; use YAML front matter (`id`, `name`, `version`, optional `author`/`tags`).
   - `payload/copilot/<skill-id>.instructions.md` — plain Markdown, no front matter.

4. Publish locally:
   ```bash
   cd examples/skills/<skill-id>
   tklens publish .
   ```

5. Verify:
   ```bash
   tklens info <skill-id>
   tklens add <skill-id> --target=claude-code
   ```

---

## Commit conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

| Type | When |
|------|------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `test` | Tests only |
| `refactor` | Refactor without behaviour change |
| `chore` | Build, deps, tooling |

Scope is the module: `server`, `cli`, `frontend`, `otel`, `registry`, `proxy`.

Examples:
```
feat(otel): add Cursor span normalisation
fix(cli): correct --target=auto detection on Windows
docs(contributing): add Cursor collector guide
```

Branch naming: `AGENT-<N>-<slug>` for planned agent tasks, `feat/<slug>` for ad-hoc contributions.
