# MCP Server Setup

TokenLens ships an MCP server (`mcp-server/`) that exposes the skill registry and analytics to AI agents via the [Model Context Protocol](https://modelcontextprotocol.io).

**What the server exposes:**
- **6 Tools** — search, inspect, install, rate, use, and publish skills
- **Resources** — read any skill as `skill://<id>` without a tool call
- **Prompts** — `suggest_skill_for_context` for proactive skill recommendations

Both stdio and HTTP/SSE transports are supported and share identical tool/resource/prompt definitions.

---

## stdio (Claude Code)

stdio is the default transport. The MCP server reads from stdin and writes to stdout — Claude Code manages the process lifecycle.

### Automatic setup (recommended)

```bash
tklens mcp-setup --apply
```

This writes the following entry into `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tokenlens": {
      "command": "npx",
      "args": ["@tokenlens/mcp"],
      "env": {
        "TOKENLENS_ENDPOINT": "http://localhost:8080",
        "TOKENLENS_API_KEY": "<your-api-key>",
        "TOKENLENS_USER": "<your-email>"
      }
    }
  }
}
```

### Manual setup

If you prefer not to use `--apply`, run `tklens mcp-setup` (without the flag) to print the JSON snippet, then paste it into `~/.claude/claude_desktop_config.json` yourself.

### Verify

```bash
tklens whoami
# Should print your email and endpoint — confirms credentials are correct.
```

Restart Claude Code after editing the config file.

---

## HTTP/SSE (Copilot, remote agents)

HTTP/SSE mode binds to `0.0.0.0:8082` and exposes the standard MCP SSE endpoint at `/sse`.

### Start via Docker Compose

```bash
docker compose --profile mcp up
```

The `mcp` profile starts the `mcp-server` service alongside the main server and frontend. The MCP server is **not** started by default (`docker compose up` without `--profile mcp` leaves it off).

### Configure Copilot

```bash
tklens mcp-setup --transport=http --apply
```

This writes `.copilot/mcp.json` in the current workspace:

```json
{
  "servers": {
    "tokenlens": {
      "url": "http://localhost:8082/sse",
      "headers": {
        "Authorization": "Bearer <your-api-key>"
      }
    }
  }
}
```

For remote deployments, replace `localhost:8082` with your server's public address.

---

## MCP Resources

Skills are exposed as MCP Resources, so agents can read them directly without calling a tool:

```
skill://<id>
```

Returns: `text/plain` — the skill's `skill.toml` content followed by its usage instructions in Markdown.

Agents can call `resources/list` to get all available skill IDs, then `resources/read` with a `skill://` URI to fetch the content.

---

## MCP Prompts

### `suggest_skill_for_context(language, task_description)`

Calls `GET /api/v1/recommendations/<TOKENLENS_USER>`, filters by language and task similarity, and returns a formatted prompt fragment listing the top 3 skill suggestions with estimated token savings.

**Usage in Claude Code:**

Open the slash-command palette and type `/mcp tokenlens suggest_skill_for_context`. Claude Code will prompt you for `language` and `task_description`, then inject the skill suggestions into the conversation context.

---

## Token loop-back

Every call to `add_skill_to_workspace` automatically records skill adoption:

1. The MCP server POSTs to `POST /api/v1/events` with:
   - `user_id` = `TOKENLENS_USER`
   - `tool` = `"mcp"`, `source` = `"mcp"`
   - `skill_id` = the installed skill's ID
   - `input_tokens` / `output_tokens` = 0 (no LLM involved)
2. The event appears immediately in the dashboard under the configured user.

This closes the observability loop: you can see which skills agents are actually adopting, not just which ones humans browse. Disable with `TOKENLENS_MCP_TRACK_USAGE=false`.

---

## Env vars reference

| Variable | Default | Description |
|----------|---------|-------------|
| `TOKENLENS_ENDPOINT` | `http://localhost:8080` | TokenLens server base URL |
| `TOKENLENS_API_KEY` | — | API key; required for `rate_skill` and `publish_skill` |
| `TOKENLENS_USER` | — | User email; used for usage loop-back and `get_my_usage` |
| `TOKENLENS_MCP_TRANSPORT` | `stdio` | `stdio` or `http` |
| `TOKENLENS_MCP_TRACK_USAGE` | `true` | Set `false` to disable UsageEvent loop-back |
