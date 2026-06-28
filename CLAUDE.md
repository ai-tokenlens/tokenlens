# TokenLens — Agent Working Agreement

You are implementing TokenLens. The authoritative design is in `SPEC.md`. Read the
relevant section of SPEC.md for your current task; do NOT re-read the whole file
every turn.

## Golden rules
- Follow SPEC.md's project structure, data models, and API contracts EXACTLY. Do not invent new endpoints or rename fields.
- Production-quality code, not stubs. Every business-logic unit gets a unit test.
- If a decision isn't covered by the spec, pick the simplest reasonable option and leave a `# TODO(spec):` comment. Do not ask me unless truly blocked.
- Only touch files in the module you were assigned. Do not refactor other modules.
- **AGENTS.md is append-only.** NEVER edit or rewrite existing agent prompts. If a task evolves or supersedes a previous agent, add a new AGENT-N entry that references the old one. Existing agents are historical record — immutable.

## Token-efficiency rules (IMPORTANT)
- Do NOT print large files back to me. Edit in place and summarize what changed in ≤3 lines.
- Do NOT read files you don't need. Prefer targeted reads over whole-directory scans.
- Do NOT paste full file contents in your responses; reference paths and line ranges.
- Keep explanations short. I want code and a 2-3 line summary, not essays.
- When a task is done, stop. Do not pre-emptively start the next task.
- Reuse existing code; check before creating a new helper.

## Tech baseline
- server: Python 3.11, FastAPI, SQLAlchemy 2.x, Alembic, pytest
- tklens-cli: Node 20, TypeScript, oclif
- frontend: React 18, Vite, Tailwind, Recharts, React Query
- DB: SQLite in dev. One `docker compose up` must bring up server + frontend.

## Definition of done for any task
1. Code compiles / app boots.
2. Tests for the new logic pass.
3. A ≤3 line summary of what changed and any TODO left behind.
