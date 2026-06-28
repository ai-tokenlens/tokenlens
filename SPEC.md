# TokenLens — Project Specification
> **Version:** 0.2.0
> **Status:** v0.2 Spec — Ready for Agent Delegation
> **License:** MIT
> **Target tools (MVP):** GitHub Copilot CLI, Claude Code

---

## 1. Vision

TokenLens is a self-hosted, open-source platform for engineering teams using AI coding assistants. It does two things, weighted equally:

1. **Token observability** — collects per-user token consumption across AI coding tools and aggregates it into monitoring dashboards.
2. **A self-hosted Skill Registry** — a "Nexus for AI skills": a local repository that proxies remote skill repos (pull-through cache), hosts team-authored skills, lets users browse/rate/comment, and recommends efficient skills to cut token waste.

The two halves reinforce each other: usage data feeds the recommendation engine, and the registry is where recommended skills are pulled from.

### Positioning vs. existing tools
There are existing tools focused purely on **token tracking** for Copilot (e.g. CLI session-file parsers, OTel exporters). TokenLens differentiates by pairing tracking with a **first-class skill registry + efficiency recommendation engine** — which no existing project provides. The tracking layer deliberately reuses open standards (OpenTelemetry) rather than reinventing collection.

---

## 2. Goals & Non-Goals

### MVP Goals (v0.1)
- [ ] Collect token usage from **Copilot CLI** (OTel) and **Claude Code** (OTel/session logs) into a unified store
- [ ] Aggregate usage per user / tool / model / day and serve a dashboard
- [ ] Self-hosted **Skill Registry** with: browse, search, star ratings, comments
- [ ] **Pull-through proxy**: fetch a skill from a remote repo once, cache locally, serve from cache thereafter
- [ ] **Publish** skills (team/community), via CLI — low-token, no LLM in the loop
- [ ] **`tklens` CLI** for search / add / publish / pull
- [ ] Neutral canonical skill format + adapters to materialize for Claude Code (`SKILL.md`) and Copilot (`.instructions.md`)
- [ ] **Recommendation engine**: suggest efficient skills based on real usage
- [ ] One-command install (`docker compose up`) — adoption is a primary objective

### Stretch (v0.1 if time permits)
- [ ] Optional **MCP server** exposing the registry to agents conversationally

### v0.2 Goals
- [ ] **MCP server — first-class**: both stdio and HTTP/SSE transports; full tool set + Resources + Prompts + token loop-back
- [ ] Frontend stability: SkillBrowser focus bug fixed; `isFetching` opacity feedback

### Non-Goals (v0.1 & v0.2)
- Multi-tenant SaaS hosting
- SSO; MVP auth is GitHub-token-based for collectors + API keys for publish
- Cursor / Continue.dev collectors (deferred to v0.3+)
- Real-time streaming analytics (batch/periodic is fine)

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         DEVELOPER MACHINE                      │
│                                                                │
│   ┌────────────────┐         ┌────────────────┐               │
│   │  Copilot CLI   │         │  Claude Code   │               │
│   │  (OTel export) │         │  (OTel / logs) │               │
│   └───────┬────────┘         └───────┬────────┘               │
│           │  OTLP/http (traces+metrics)│                       │
│           └──────────────┬─────────────┘                       │
│                          │                                     │
│   ┌──────────────────────▼──────────────────────┐             │
│   │            tklens CLI (Node, npx)            │             │
│   │   search · add · publish · pull · whoami     │             │
│   └──────────────────────┬──────────────────────┘             │
└──────────────────────────┼─────────────────────────────────────┘
                           │ HTTP (OTLP + REST)
┌──────────────────────────▼─────────────────────────────────────┐
│                      TOKENLENS SERVER                          │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │ OTel Collector│ │  Registry    │  │  Analytics +       │   │
│  │  /v1/traces  │  │  + Proxy     │  │  Recommendations   │   │
│  │  /v1/metrics │  │  /api/skills │  │  /api/analytics    │   │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬──────────┘   │
│         │                 │                     │              │
│         └────────────┬────┴─────────────────────┘              │
│                 PostgreSQL / SQLite                            │
│                      + blob store (skill payloads)            │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │   MCP Server (v0.2, first-class)                      │    │
│  │   stdio | HTTP/SSE :8082                              │    │
│  │   tools · resources · prompts · loop-back             │    │
│  └──────────────────────────────────────────────────────┘    │
└───────────────────────────┬────────────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────────────┐
│                  FRONTEND (React SPA)                          │
│  Dashboard · Skill Browser (ratings/comments) · Recs · Users  │
└────────────────────────────────────────────────────────────────┘
```

### Component summary

| Component | Tech | Description |
|-----------|------|-------------|
| `server` | Python 3.11, FastAPI, SQLAlchemy 2.x, Alembic | OTel ingest + REST API (registry, analytics, recs) |
| `tklens-cli` | Node 20, TypeScript, oclif | Low-token CLI: search/add/publish/pull |
| `frontend` | React 18, Vite, Tailwind, Recharts, React Query | Dashboard + registry UI |
| `mcp-server` | Node 20, `@modelcontextprotocol/sdk` | Exposes registry + analytics to agents (v0.2, first-class) |
| `db` | SQLite (dev) / PostgreSQL (prod) | Persistence |
| `storage` | Local filesystem (dev) / S3-compatible (prod) | Skill payload blobs |
| infra | Docker Compose | One-command self-hosting |

---

## 4. Token Collection Design

### 4.1 Primary mechanism: OpenTelemetry (OTLP)

Both target tools can emit OTel GenAI traces/metrics. TokenLens runs an **OTLP/HTTP receiver** so the tools push directly — no fragile log scraping.

**Copilot CLI** activates OTel via environment variables (per GitHub docs). Required env (documented for end users in README):
```bash
export OTEL_EXPORTER_OTLP_ENDPOINT="http://<tokenlens-host>:8080/otel"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
export OTEL_SERVICE_NAME="copilot-cli"
export OTEL_RESOURCE_ATTRIBUTES="tokenlens.user=giuseppe@example.com"
```
Copilot CLI emits a span tree per agent interaction: an `invoke_agent` root span with `chat` (one per LLM request) and `execute_tool` children. Token counts arrive as GenAI semantic-convention attributes (`gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, plus cache read/write where present), and model name as `gen_ai.request.model`.

**Claude Code** likewise supports OTel export (`CLAUDE_CODE_ENABLE_TELEMETRY=1` + standard `OTEL_*` vars). Same receiver, same normalization.

### 4.2 Fallback mechanism: session-file parser

For environments where OTel is unavailable, a `tklens collect` subcommand parses local session files and POSTs normalized events to `/api/v1/events`. This reuses the well-known session-file locations (VS Code workspace/global storage for Copilot; `~/.claude/` for Claude Code). This is best-effort and clearly marked as estimates.

### 4.3 Normalization

Whether via OTel or fallback, everything is normalized to the `UsageEvent` model (§5). The OTel receiver maps GenAI attributes → `UsageEvent` fields. The `user_id` comes from `OTEL_RESOURCE_ATTRIBUTES` (`tokenlens.user`) or, for the fallback, from CLI config / GitHub identity.

### 4.4 Identity / auth for collection
- OTel push: a shared ingest token via header `Authorization: Bearer <ingest_token>`, plus `tokenlens.user` resource attribute.
- Fallback CLI: reuses the user's existing GitHub session (no separate API key needed) where possible; otherwise a `tklens login` stores a local token.

---

## 5. Data Models

### 5.1 `UsageEvent`
```sql
CREATE TABLE usage_events (
    id                TEXT PRIMARY KEY,        -- UUID v4
    user_id           TEXT NOT NULL,
    tool              TEXT NOT NULL,           -- "copilot-cli" | "claude-code"
    model             TEXT,                    -- "gpt-4o" | "claude-sonnet-4-6" ...
    input_tokens      INTEGER NOT NULL DEFAULT 0,
    output_tokens     INTEGER NOT NULL DEFAULT 0,
    cache_read_tokens  INTEGER NOT NULL DEFAULT 0,
    cache_write_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens      INTEGER NOT NULL DEFAULT 0,
    skill_id          TEXT,                    -- FK → skills.id (nullable)
    source            TEXT NOT NULL,           -- "otel" | "session-file"
    context           TEXT,                    -- JSON: {language, file_ext, workspace, repo}
    trace_id          TEXT,                    -- OTel trace id when available
    timestamp         DATETIME NOT NULL,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_events_user_ts ON usage_events(user_id, timestamp);
CREATE INDEX idx_events_tool_ts ON usage_events(tool, timestamp);
```

### 5.2 `Skill` (canonical neutral format)
A skill is stored as metadata + a versioned payload. Canonical manifest is **`skill.toml`**; the payload is a tarball materialized per-tool by adapters at pull time.

```sql
CREATE TABLE skills (
    id            TEXT PRIMARY KEY,            -- "mulesoft-api-doc-generator"
    name          TEXT NOT NULL,
    summary       TEXT NOT NULL,              -- short one-line description
    description   TEXT,                       -- long form / usage guidance (Markdown)
    usage         TEXT,                       -- "how to use it" instructions (Markdown)
    tags          TEXT,                       -- JSON array
    author        TEXT,
    origin        TEXT NOT NULL,              -- "local" | "remote"
    origin_url    TEXT,                       -- source repo if proxied
    latest_version TEXT NOT NULL DEFAULT '1.0.0',
    avg_tokens    INTEGER DEFAULT 0,          -- computed efficiency metric
    use_count     INTEGER DEFAULT 0,
    rating_avg    REAL DEFAULT 0,             -- computed from ratings
    rating_count  INTEGER DEFAULT 0,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE skill_versions (
    id            TEXT PRIMARY KEY,           -- UUID
    skill_id      TEXT NOT NULL REFERENCES skills(id),
    version       TEXT NOT NULL,              -- semver
    manifest_toml TEXT NOT NULL,              -- the skill.toml content
    payload_uri   TEXT NOT NULL,              -- blob store location of tarball
    checksum      TEXT NOT NULL,              -- sha256 of payload
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(skill_id, version)
);

CREATE TABLE skill_ratings (
    id          TEXT PRIMARY KEY,
    skill_id    TEXT NOT NULL REFERENCES skills(id),
    user_id     TEXT NOT NULL,
    stars       INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),
    comment     TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(skill_id, user_id)               -- one rating per user per skill
);
```

#### `skill.toml` canonical manifest (example)
```toml
[skill]
id = "mulesoft-api-doc-generator"
name = "MuleSoft API Documentation Generator"
summary = "Generate Markdown docs from a MuleSoft RAML/OAS spec"
version = "1.2.0"
tags = ["mulesoft", "documentation", "raml"]
author = "giuseppe@example.com"

[usage]
instructions = """
Invoke with an API spec file in context. Produces a structured Markdown doc.
"""

# How this canonical skill maps onto each target tool.
[targets.claude-code]
type = "SKILL.md"          # adapter renders a SKILL.md + folder
entry = "skill/SKILL.md"

[targets.copilot]
type = "instructions"      # adapter renders a .instructions.md
entry = "copilot/api-doc.instructions.md"
```

### 5.3 `User`
```sql
CREATE TABLE users (
    id           TEXT PRIMARY KEY,            -- email or github login
    display_name TEXT,
    github_login TEXT,
    team         TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Module Specifications

### 6.1 `server` (FastAPI)
**Port:** `8080` · **Entry:** `server/main.py`

#### 6.1.1 OTel ingest
```
POST /otel/v1/traces      # OTLP/HTTP protobuf or JSON
POST /otel/v1/metrics
```
- Parse OTLP payloads, extract GenAI spans, map to `UsageEvent`, persist.
- Reject if `Authorization` ingest token invalid.
- Must tolerate batched spans; idempotent on `trace_id`+span id.

#### 6.1.2 Fallback event ingest
```
POST /api/v1/events         # single
POST /api/v1/events/batch   # up to 100
```
(Schema = `UsageEvent` minus server-computed fields. `source="session-file"`.)

#### 6.1.3 Analytics
```
GET /api/v1/analytics/summary          ?user_id&from&to&tool
GET /api/v1/analytics/top-consumers    ?limit&from&to
GET /api/v1/analytics/skill-efficiency  # skills by avg_tokens asc
GET /api/v1/analytics/by-day           ?user_id&from&to
```
Summary response includes totals (input/output/cache/total), `by_user`, `by_tool`, `by_model`, `by_day`.

#### 6.1.4 Registry + proxy
```
GET    /api/v1/skills                 # list; ?tag &search &sort=(rating|efficiency|popular|new)
GET    /api/v1/skills/{id}            # detail incl. rating_avg, avg_tokens
GET    /api/v1/skills/{id}/versions
GET    /api/v1/skills/{id}/download   ?version&target=(claude-code|copilot)  # adapter materializes
POST   /api/v1/skills                 # publish new (auth)
PUT    /api/v1/skills/{id}            # new version (auth)
DELETE /api/v1/skills/{id}            # soft delete (auth)

# Ratings & comments
GET    /api/v1/skills/{id}/ratings
POST   /api/v1/skills/{id}/ratings    # {stars, comment} (auth, upsert)

# Pull-through proxy
POST   /api/v1/proxy/resolve          # {origin_url} → fetches, caches locally, returns skill id
```

**Pull-through behavior:** on `proxy/resolve`, if the skill isn't cached, fetch the remote payload, validate, store a local copy (`origin="remote"`, `origin_url` set), and serve all future requests from the local copy. Remote is never hit again unless an explicit refresh is requested.

**Adapter on download:** `/download?target=` runs the matching adapter to render the canonical payload into the tool-specific layout (`SKILL.md` tree for Claude Code; `.instructions.md` for Copilot) and streams a tarball.

#### 6.1.5 Recommendations
```
GET /api/v1/recommendations/{user_id}
```
Rules (MVP):
1. **Skill gap**: >5 events of a given `context.language` with no `skill_id` → suggest top-rated skill for that language; estimate savings from that skill's `avg_tokens` vs the user's manual average.
2. **Context bloat**: user avg `input_tokens` > 1.5× team average → suggest context-reduction skill/practice.
3. **Efficient swap**: a skill exists whose `avg_tokens` < 70% of the user's manual average for the same language → surface it.

#### 6.1.6 Structure
```
server/
├── main.py
├── config.py
├── database.py
├── otel/
│   ├── receiver.py            # OTLP parsing
│   └── genai_mapper.py        # GenAI attrs → UsageEvent
├── models/ (usage_event, skill, skill_version, skill_rating, user)
├── routers/ (events, analytics, skills, ratings, proxy, recommendations)
├── services/
│   ├── analytics_service.py
│   ├── registry_service.py
│   ├── proxy_service.py       # pull-through cache
│   ├── adapter_service.py     # canonical → tool-specific
│   └── recommendation_engine.py
├── adapters/
│   ├── claude_code_adapter.py
│   └── copilot_adapter.py
├── schemas/
├── migrations/                # Alembic
├── tests/
├── requirements.txt
└── Dockerfile
```

### 6.2 `tklens-cli` (Node + oclif)
Low-token interface — **no LLM calls**, pure REST. Installable via `npx @tokenlens/cli` or global install.

```
tklens login                              # store endpoint + token (reuses gh session if present)
tklens search <query> [--tag] [--sort]
tklens info <skill-id>
tklens add <skill-id> [--target=auto|claude-code|copilot]   # downloads + materializes into cwd
tklens publish [path]                     # reads skill.toml, packs, uploads
tklens pull <origin-url>                  # triggers pull-through proxy resolve
tklens rate <skill-id> --stars N [--comment "..."]
tklens collect [--tool=copilot-cli|claude-code]  # fallback session-file collector
tklens mcp-setup [--transport=stdio|http]         # generates MCP config snippet for Claude Code / Copilot
tklens whoami
```
- `--target=auto` detects the local tool (presence of `.copilot/` or `.claude/`) and materializes accordingly.
- Config at `~/.tklens/config.json`.

Structure:
```
tklens-cli/
├── src/
│   ├── commands/ (login, search, info, add, publish, pull, rate, collect, whoami)
│   ├── lib/ (apiClient.ts, config.ts, packer.ts, detectTarget.ts, sessionParser.ts)
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

### 6.3 `frontend` (React)
**Port:** `3000`

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `Dashboard` | token trends (line, per tool), top consumers (bar), tool/model split (pie) |
| `/users/:id` | `UserDetail` | per-user history + `RecommendationPanel` |
| `/skills` | `SkillBrowser` | card grid; filter by tag; sort by rating/efficiency/popular/new |
| `/skills/:id` | `SkillDetail` | manifest, usage, versions, **star rating + comments**, avg_tokens badge |
| `/skills/new` | `SkillEditor` | publish form (also possible via CLI) |

Structure:
```
frontend/
├── src/
│   ├── main.jsx · App.jsx
│   ├── api/client.js
│   ├── pages/ (Dashboard, UserDetail, SkillBrowser, SkillDetail, SkillEditor)
│   ├── components/
│   │   ├── charts/ (TokenTrendChart, TopConsumersChart, ToolBreakdownPie)
│   │   ├── SkillCard.jsx · RatingStars.jsx · CommentList.jsx
│   │   ├── RecommendationPanel.jsx
│   │   └── layout/ (Sidebar, Header)
│   └── utils/formatters.js
├── index.html · vite.config.js · tailwind.config.js · Dockerfile
```

### 6.4 `mcp-server` (v0.2 — first-class)

Exposes the full TokenLens registry and analytics to AI agents conversationally.
Built on `@modelcontextprotocol/sdk`, talks to the same REST API as the CLI.

**v0.2 is NOT a stretch goal** — it is a required deliverable with the same quality bar as any other module.

#### Transports

| Mode | Activation | Port |
|------|-----------|------|
| `stdio` (default) | `npx @tokenlens/mcp` or `node dist/index.js` | — |
| `http/sse` | `TOKENLENS_MCP_TRANSPORT=http` | `8082` |

HTTP/SSE mode binds to `0.0.0.0:8082` and exposes the standard MCP SSE endpoint at `/sse`. Both transports share the same tool/resource/prompt definitions.

#### Configuration (env vars)
```
TOKENLENS_ENDPOINT=http://localhost:8080    # TokenLens server
TOKENLENS_API_KEY=<key>                    # API key for auth'd operations
TOKENLENS_USER=<email>                     # user identity for loop-back events
TOKENLENS_MCP_TRANSPORT=stdio|http         # default: stdio
TOKENLENS_MCP_TRACK_USAGE=true|false       # default: true — enable loop-back
```

#### MCP Tools (6 total)

| Tool | Description | Auth required |
|------|-------------|---------------|
| `search_skills(query, tag?, sort?)` | `GET /api/v1/skills` — returns formatted list | No |
| `get_skill(id)` | `GET /api/v1/skills/{id}` — full metadata + usage instructions | No |
| `add_skill_to_workspace(id, target?, workspace_path?)` | Downloads + extracts tarball into `workspace_path` (default: cwd). **Records UsageEvent with `skill_id` if `TOKENLENS_MCP_TRACK_USAGE=true`** | No |
| `rate_skill(id, stars, comment?)` | `POST /api/v1/skills/{id}/ratings` | Yes |
| `get_my_usage(from?, to?)` | `GET /api/v1/analytics/summary?user_id=<TOKENLENS_USER>&from=&to=` — returns token totals for the configured user | No |
| `publish_skill(skill_toml, payload_b64)` | `POST /api/v1/skills` — publish a new skill from agent context; `payload_b64` is a base64-encoded tarball | Yes |

#### MCP Resources

Skills are exposed as MCP Resources so agents can read them without tool calls:

```
skill://{id}           → text/plain: skill.toml content + usage instructions (Markdown)
```

The server must implement `resources/list` (returns all non-deleted skill IDs) and `resources/read`.

#### MCP Prompts

```
suggest_skill_for_context(language, task_description)
```
Calls `GET /api/v1/recommendations/<TOKENLENS_USER>`, filters by language + task_description similarity, and returns a formatted prompt fragment listing the top 3 skill suggestions with estimated token savings.

#### Token loop-back

When `add_skill_to_workspace` is called with `TOKENLENS_MCP_TRACK_USAGE=true`:
1. POST to `POST /api/v1/events` with:
   - `user_id` = `TOKENLENS_USER`
   - `tool` = `"mcp"`
   - `skill_id` = the requested skill id
   - `source` = `"mcp"`
   - `input_tokens` / `output_tokens` = 0 (no LLM in loop; usage tracked at tool level)
   - `timestamp` = now
2. This closes the observability loop: skill adoption is visible in the dashboard.

#### Distribution
- `npx @tokenlens/mcp` — zero-install for Claude Code users
- Optional service in `docker-compose.yml` (disabled by default, enabled via `--profile mcp`)
- `tklens mcp-setup` command: auto-generates config snippets for Claude Code (`~/.claude/claude_desktop_config.json`) and Copilot (`.copilot/mcp.json`)

#### Structure
```
mcp-server/
├── src/
│   ├── index.ts           # entry: stdio or http/sse based on env
│   ├── server.ts          # MCP server definition (tools, resources, prompts)
│   ├── transport/
│   │   ├── stdio.ts
│   │   └── http-sse.ts
│   ├── tools/
│   │   ├── searchSkills.ts
│   │   ├── getSkill.ts
│   │   ├── addSkillToWorkspace.ts
│   │   ├── rateSkill.ts
│   │   ├── getMyUsage.ts
│   │   └── publishSkill.ts
│   ├── resources/
│   │   └── skillResource.ts
│   ├── prompts/
│   │   └── suggestSkill.ts
│   ├── loopback.ts        # token event POST
│   └── apiClient.ts       # thin wrapper around TOKENLENS_ENDPOINT
├── package.json           # bin: { "tokenlens-mcp": "./dist/index.js" }
├── tsconfig.json
└── README.md              # setup for Claude Code + Copilot CLI
```

---

## 7. Infrastructure

### `docker-compose.yml`
```yaml
services:
  server:
    build: ./server
    ports: ["8080:8080"]
    environment:
      DATABASE_URL: "sqlite:///./data/tokenlens.db"
      INGEST_TOKEN: "change-me"
      BLOB_DIR: "/app/data/skills"
    volumes: ["./data:/app/data"]

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      VITE_API_BASE_URL: "http://localhost:8080/api/v1"
    depends_on: [server]
```
`docker-compose.prod.yml` swaps SQLite→Postgres and local blob dir→S3-compatible.

### Repo layout
```
tokenlens/
├── server/
├── tklens-cli/
├── frontend/
├── mcp-server/                 # stretch
├── examples/skills/            # 3 seed skills in canonical format
├── docker-compose.yml
├── docker-compose.prod.yml
├── SPEC.md · README.md · CONTRIBUTING.md
└── .github/workflows/ (server-ci.yml, cli-ci.yml, frontend-ci.yml)
```

---

## 8. Agent Delegation Plan

Prompt template for every agent:
```
You are implementing AGENT-[N] of the TokenLens project.
Full spec: [paste SPEC.md]
Your task: [paste the relevant row below]
Rules:
- Production-quality code, not stubs. Unit tests for all business logic.
- Follow the exact project structure and API/data contracts in the spec; do not deviate.
- If a decision isn't covered, pick the simplest reasonable option and leave a TODO.
- Only reference files your task creates or that already exist per the spec.
```

### Phase 1 — Foundation (parallel)
| Task | Scope | Deliverable |
|------|-------|-------------|
| AGENT-01 | `server` scaffold + all models + Alembic | FastAPI boots, migrations create full schema |
| AGENT-02 | `frontend` scaffold | Vite+React+Tailwind+ReactQuery wired to mock API |
| AGENT-03 | `tklens-cli` scaffold | oclif app, `login`/`whoami`/`config` working against mock |

### Phase 2 — Collection & Registry core
| Task | Scope | Depends | Deliverable |
|------|-------|---------|-------------|
| AGENT-04 | OTel receiver + GenAI mapper + `/otel/*` | 01 | Copilot/Claude OTLP → UsageEvent, with tests |
| AGENT-05 | Fallback `/api/v1/events*` + session parsers | 01 | Single/batch ingest + Copilot/Claude session parsing |
| AGENT-06 | Analytics endpoints | 01 | `/analytics/*` aggregations + tests |
| AGENT-07 | Registry CRUD + versioning + ratings | 01 | `/skills*`, `/ratings` + tests |
| AGENT-08 | Pull-through proxy + adapters | 07 | `/proxy/resolve`, `/download?target=`, both adapters |

### Phase 3 — CLI, UI, intelligence
| Task | Scope | Depends | Deliverable |
|------|-------|---------|-------------|
| AGENT-09 | CLI: search/info/add/publish/pull/rate | 03,07,08 | Full registry CLI against real API |
| AGENT-10 | CLI: `collect` fallback | 03,05 | Session-file collector subcommand |
| AGENT-11 | Dashboard charts | 02,06 | Trend/consumers/breakdown wired to real API |
| AGENT-12 | Skill Browser + Detail + ratings UI | 02,07 | Browse/search/sort + stars/comments |
| AGENT-13 | Recommendation engine + panel | 06,07 | `/recommendations` (3 rules) + UI panel |

### Phase 4 — Packaging & docs
| Task | Scope | Depends | Deliverable |
|------|-------|---------|-------------|
| AGENT-14 | Docker Compose (dev+prod) + CI | all | One-command up; 3 GH Actions workflows |
| AGENT-15 | 3 seed skills in canonical format | 08 | `examples/skills/*` incl. one MuleSoft doc skill |
| AGENT-16 | README + CONTRIBUTING + setup docs | all | 5-min quickstart, OTel env setup for both tools, arch diagram |
| AGENT-17 | MCP server (stretch) | 07 | Optional registry MCP tools |

---

## 9. Acceptance Criteria (MVP)
- [ ] `docker compose up` brings up server + frontend with zero manual steps
- [ ] Copilot CLI configured with OTel env vars produces visible token events in the dashboard
- [ ] Claude Code via OTel does the same
- [ ] Dashboard shows a 7-day token trend for ≥1 user, split by tool and model
- [ ] Registry: publish via `tklens publish`, browse in UI, rate with stars + comment
- [ ] `tklens add <id> --target=auto` materializes a skill correctly for the detected tool
- [ ] Pull-through proxy: `tklens pull <remote-url>` caches locally; second pull hits cache only
- [ ] Recommendation engine returns ≥1 suggestion for a user with >10 events
- [ ] Backend ≥80% test coverage
- [ ] README: 5-minute quickstart + OTel setup for both tools

---

## 10. Roadmap
| Version | Feature | Status |
|---------|---------|--------|
| v0.1 | Core: OTel ingest, registry CRUD, CLI, dashboard | MVP |
| v0.2 | MCP server first-class (stdio + HTTP/SSE, 6 tools, Resources, Prompts, loop-back) | **Current** |
| v0.2 | Frontend stability (SkillBrowser focus fix) | **Current** |
| v0.3 | Cursor + Continue.dev collectors | Planned |
| v0.3 | Slack/Teams daily digest + budget thresholds | Planned |
| v0.3 | Per-user budget limits | Planned |
| v0.4 | Skill dependency graph | Planned |
| v0.5 | AI-assisted skill authoring ("describe → generate canonical skill") | Planned |
| v1.0 | Public hosted community registry (opt-in federation) | Planned |
