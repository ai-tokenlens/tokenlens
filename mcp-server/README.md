# tokenlens-mcp

MCP server that exposes the [TokenLens](../README.md) skill registry to AI agents (Claude Code, GitHub Copilot, etc.).

## Tools

| Tool | Description |
|------|-------------|
| `search_skills` | Full-text search across registry skills |
| `get_skill` | Fetch metadata + usage instructions for a skill |
| `add_skill_to_workspace` | Download + extract a skill tarball into your working directory |
| `rate_skill` | Submit a 1–5 star rating with an optional comment |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TOKENLENS_ENDPOINT` | `http://localhost:8000` | Base URL of the TokenLens server |
| `TOKENLENS_API_KEY` | _(empty)_ | Bearer token (required if server has auth enabled) |

## Build

```bash
cd mcp-server
npm install
npm run build
```

## Configure in Claude Code (`claude_desktop_config.json`)

Add the following to `~/.config/Claude/claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "tokenlens": {
      "command": "node",
      "args": ["/absolute/path/to/tokenlens/mcp-server/dist/index.js"],
      "env": {
        "TOKENLENS_ENDPOINT": "http://localhost:8000",
        "TOKENLENS_API_KEY": "your-api-key"
      }
    }
  }
}
```

Or, if you install the package globally (`npm install -g .` from `mcp-server/`):

```json
{
  "mcpServers": {
    "tokenlens": {
      "command": "tokenlens-mcp",
      "env": {
        "TOKENLENS_ENDPOINT": "http://localhost:8000",
        "TOKENLENS_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Configure in GitHub Copilot CLI (`copilot mcp add`)

```bash
copilot mcp add tokenlens \
  --command "node /absolute/path/to/tokenlens/mcp-server/dist/index.js" \
  --env TOKENLENS_ENDPOINT=http://localhost:8000 \
  --env TOKENLENS_API_KEY=your-api-key
```

Or with the global binary:

```bash
copilot mcp add tokenlens \
  --command tokenlens-mcp \
  --env TOKENLENS_ENDPOINT=http://localhost:8000 \
  --env TOKENLENS_API_KEY=your-api-key
```

## Usage example (Claude Code)

Once configured, ask Claude:

```
Search for "summarize" skills in the registry, then add the best one to my workspace.
```

Claude will call `search_skills`, present the results, then invoke `add_skill_to_workspace` to extract the tarball into your project directory.
