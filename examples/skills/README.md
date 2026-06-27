# TokenLens Example Skills

Reference implementations of the canonical skill format defined in SPEC.md §5.2.

## Directory layout

```
examples/skills/
├── {skill-id}/
│   ├── skill.toml                        # canonical manifest
│   └── payload/
│       ├── claude-code/
│       │   └── SKILL.md                  # frontmatter + prompt template
│       └── copilot/
│           └── {skill-id}.instructions.md
```

## `skill.toml` fields

| Field | Required | Description |
|---|---|---|
| `skill.id` | yes | kebab-case unique identifier |
| `skill.name` | yes | Human-readable title |
| `skill.summary` | yes | One-line description (shown in search results) |
| `skill.version` | yes | Semver string |
| `skill.tags` | yes | Array of lowercase strings |
| `skill.author` | yes | Email or GitHub login |
| `usage.instructions` | yes | Multiline usage guidance (Markdown) |
| `targets.claude-code.type` | yes | Always `"SKILL.md"` |
| `targets.claude-code.entry` | yes | Relative path to the SKILL.md file |
| `targets.copilot.type` | yes | Always `"instructions"` |
| `targets.copilot.entry` | yes | Relative path to the .instructions.md file |

## `payload/claude-code/SKILL.md` frontmatter

```yaml
---
skill_id: {skill-id}
version: "{semver}"
target: claude-code
trigger: "when the user asks to ..."
---
```

The body is a prompt template consumed by Claude Code. It should include:
- Role statement
- Numbered analysis steps
- Output format with an example
- Constraints (what NOT to do)

## `payload/copilot/*.instructions.md` frontmatter

```yaml
---
applyTo: "{glob pattern for relevant files}"
---
```

The body is a numbered rule list, concise enough to fit in a Copilot
custom instructions context window (~500 tokens target).

## Contributing a new skill

1. Pick a kebab-case `id` that does not already exist in the registry.
2. Copy an existing skill folder as a template.
3. Fill in `skill.toml`; bump `version` to `"1.0.0"`.
4. Write `payload/claude-code/SKILL.md` — include trigger, steps, format, constraints.
5. Write `payload/copilot/{id}.instructions.md` — keep it under 500 tokens.
6. Publish: `tklens publish examples/skills/{skill-id}/`

## Included examples

| Skill | Description |
|---|---|
| `mulesoft-api-doc-generator` | Markdown docs from RAML/OAS spec |
| `java-unit-test-generator` | JUnit 5 + Mockito tests from a Java class |
| `git-commit-message` | Conventional Commits message from a git diff |
