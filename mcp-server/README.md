# TokenLens MCP Server

Exposes the TokenLens skill registry to AI agents via the Model Context Protocol (MCP).  
Supports stdio (default) and HTTP/SSE transports.

## Quick start

### Claude Code (stdio)

Run `tklens mcp-setup` to auto-generate the snippet, or add manually to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tokenlens": {
      "command": "npx",
      "args": ["tokenlens-mcp"],
      "env": {
        "TOKENLENS_ENDPOINT": "http://localhost:8080",
        "TOKENLENS_API_KEY": "<your-key>",
        "TOKENLENS_USER": "<your-email>"
      }
    }
  }
}
```

### Copilot CLI (stdio)

```bash
tklens mcp-setup   # copy the .copilot/mcp.json snippet
```

Or manually add to `.copilot/mcp.json`:

```json
{
  "mcpServers": {
    "tokenlens": {
      "command": "npx",
      "args": ["tokenlens-mcp"],
      "env": {
        "TOKENLENS_ENDPOINT": "http://localhost:8080",
        "TOKENLENS_API_KEY": "<your-key>",
        "TOKENLENS_USER": "<your-email>"
      }
    }
  }
}
```

### HTTP/SSE mode (remote agents)

```bash
TOKENLENS_MCP_TRANSPORT=http npx tokenlens-mcp
# Listens on 0.0.0.0:8082/sse
```

Connect via:

```json
{
  "mcpServers": {
    "tokenlens": { "url": "http://localhost:8082/sse" }
  }
}
```

Via Docker Compose (profile disabled by default):

```bash
docker compose --profile mcp up
```

## Build

```bash
cd mcp-server
npm install
npm run build
npm test
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `TOKENLENS_ENDPOINT` | `http://localhost:8080` | TokenLens server URL |
| `TOKENLENS_API_KEY` | — | Bearer token (required for `rate_skill`, `publish_skill`) |
| `TOKENLENS_USER` | — | User email for analytics + recommendations |
| `TOKENLENS_MCP_TRANSPORT` | `stdio` | `stdio` or `http` |
| `TOKENLENS_MCP_PORT` | `8082` | Port for HTTP/SSE mode |
| `TOKENLENS_MCP_TRACK_USAGE` | `true` | Set `false` to disable token loop-back |

## Tools (6)

| Tool | Description | Auth required |
|---|---|---|
| `search_skills` | Search registry by query/tag/sort | No |
| `get_skill` | Full metadata + usage instructions | No |
| `add_skill_to_workspace` | Download + extract skill tarball | No |
| `rate_skill` | Submit 1–5 star rating | Yes |
| `get_my_usage` | Token usage summary for TOKENLENS_USER | No |
| `publish_skill` | Publish new skill from base64 tarball | Yes |

## Resources

Skills are MCP Resources at `skill://{id}` — agents can read them without tool calls.

## Prompts

`suggest_skill_for_context(language, task_description)` returns top 3 skill suggestions filtered by language with estimated token savings.
