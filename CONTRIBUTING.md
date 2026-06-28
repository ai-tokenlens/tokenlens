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
