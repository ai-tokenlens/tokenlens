# Skill Format Reference

Skills are stored in a **canonical neutral format**: a directory containing `skill.toml` plus payload files. At download time, a server-side adapter renders the payload for the requested target tool.

---

## Directory layout

```
<skill-id>/
├── skill.toml                          # required — metadata + target declarations
└── payload/
    ├── claude-code/
    │   └── SKILL.md                    # rendered by claude-code adapter
    └── copilot/
        └── <skill-id>.instructions.md  # rendered by copilot adapter
```

You only need payload files for the targets you intend to support. If a payload file is missing, `tklens add --target=<that-target>` will fail with a 404.

---

## skill.toml specification

### `[skill]` — required

```toml
[skill]
id      = "git-commit-message"          # string, kebab-case, globally unique in registry
name    = "Git Commit Message Generator" # human-readable display name
summary = "One-line description"         # shown in search results
version = "1.0.0"                        # semver string
tags    = ["git", "dx", "changelog"]     # string array, used for filtering
author  = "you@example.com"             # optional; email or GitHub handle
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | kebab-case; used as URL slug in all API endpoints |
| `name` | string | yes | max ~80 chars; shown in `tklens search` output |
| `summary` | string | yes | single line; shown in search results and `tklens info` |
| `version` | string | yes | semver; stored as `latest_version` in DB |
| `tags` | string[] | no | inline TOML array; drives `--tag` filter in search |
| `author` | string | no | stored as-is; no validation |

### `[usage]` — optional but recommended

```toml
[usage]
instructions = """
Multi-line instructions for how to invoke this skill.
Paste your git diff, then run the skill.
"""
```

The `instructions` value is stored as the skill's `usage` field and rendered in both adapter outputs under a `## Usage` / `## Usage Instructions` heading.

### `[targets.<target-name>]` — one per supported tool

```toml
[targets.claude-code]
type  = "SKILL.md"
entry = "payload/claude-code/SKILL.md"

[targets.copilot]
type  = "instructions"
entry = "payload/copilot/git-commit-message.instructions.md"
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `type` | string | yes | `"SKILL.md"` for Claude Code; `"instructions"` for Copilot |
| `entry` | string | yes | relative path to the payload file inside the skill directory |

Valid `type` values:

| Value | Target | Output path in tarball |
|-------|--------|------------------------|
| `SKILL.md` | `claude-code` | `skill/<id>/SKILL.md` |
| `instructions` | `copilot` | `.copilot/prompts/<id>.instructions.md` |

---

## Payload file formats

### Claude Code — `SKILL.md`

Extracted to `skill/<id>/SKILL.md` in the project root. Must include YAML front matter:

```markdown
---
id: git-commit-message
name: Git Commit Message Generator
version: 1.0.0
author: you@example.com      # optional
tags: [git, dx]               # optional
---

# Git Commit Message Generator

One-line description.

## Usage

Step-by-step instructions.
```

The `claude-code` adapter (`server/adapters/claude_code_adapter.py`) generates this automatically from DB fields when a skill is downloaded via API. If you include a hand-crafted `payload/claude-code/SKILL.md`, it is used as-is during `tklens publish` but **ignored at download time** — the adapter always re-renders from DB fields.

### Copilot — `.instructions.md`

Extracted to `.copilot/prompts/<id>.instructions.md`. Plain Markdown, no front matter:

```markdown
# Git Commit Message Generator

One-line description.

## Usage Instructions

Step-by-step instructions.
```

The `copilot` adapter (`server/adapters/copilot_adapter.py`) generates this from DB fields. Same caveat as above: hand-crafted payload files are used by the example directory but re-rendered at download time.

---

## Adapters

Adapters live in `server/adapters/`. Each adapter exposes one function:

```python
def build_tarball(skill: Skill) -> bytes:
    ...
```

It receives a `Skill` ORM object and returns a `.tar.gz` blob. The router at `server/routers/skills.py` calls `AdapterService.build(skill, target)` which dispatches to the right adapter based on the `target` query parameter.

### Adding an adapter for a new tool

1. Create `server/adapters/<tool_name>_adapter.py`.
2. Implement `build_tarball(skill: Skill) -> bytes` — choose a tarball entry path that matches where the tool expects to find the file.
3. Register the adapter in `server/services/adapter_service.py` under the tool's `target` string key.
4. Declare the new `type` value in `skill.toml` under `[targets.<tool-name>]`.
5. Add a payload file to `examples/skills/*/payload/<tool-name>/`.

---

## Complete example

```toml
[skill]
id      = "mulesoft-api-doc-generator"
name    = "MuleSoft API Documentation Generator"
summary = "Generate structured Markdown docs from a MuleSoft RAML/OAS spec"
version = "1.0.0"
tags    = ["mulesoft", "documentation", "raml", "oas", "api"]
author  = "giuseppe@example.com"

[usage]
instructions = """
Place a RAML (.raml) or OpenAPI (.yaml/.json) spec file in your working
directory, then invoke this skill. It produces a structured Markdown document
covering: endpoints, request/response schemas, authentication, error codes,
and examples.
"""

[targets.claude-code]
type  = "SKILL.md"
entry = "payload/claude-code/SKILL.md"

[targets.copilot]
type  = "instructions"
entry = "payload/copilot/mulesoft-api-doc.instructions.md"
```

See `examples/skills/` for the full directory including payload files.
