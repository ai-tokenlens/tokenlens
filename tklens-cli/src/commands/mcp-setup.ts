import { Command, Flags } from '@oclif/core';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { readConfig } from '../lib/config.js';

function claudeConfigPath(): string {
  return path.join(os.homedir(), '.claude', 'claude_desktop_config.json');
}

function copilotConfigPath(): string {
  return path.join(process.cwd(), '.copilot', 'mcp.json');
}

function mcpHttpUrl(endpoint: string): string {
  try {
    const u = new URL(endpoint);
    u.port = '8082';
    u.pathname = '/sse';
    return u.toString();
  } catch {
    return 'http://localhost:8082/sse';
  }
}

function buildStdioSnippet(endpoint: string, apiKey: string, userId: string): object {
  const env: Record<string, string> = { TOKENLENS_ENDPOINT: endpoint };
  if (apiKey) env.TOKENLENS_API_KEY = apiKey;
  if (userId) env.TOKENLENS_USER = userId;
  return { mcpServers: { tokenlens: { command: 'npx', args: ['@tokenlens/mcp'], env } } };
}

function buildHttpSnippet(endpoint: string): object {
  return { mcpServers: { tokenlens: { url: mcpHttpUrl(endpoint) } } };
}

function readJsonFile(filePath: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function applySnippet(filePath: string, snippet: object): void {
  const existing = readJsonFile(filePath);
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, `${filePath}.bak`);
  }
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const merged = {
    ...existing,
    mcpServers: {
      ...(existing.mcpServers as Record<string, unknown> | undefined),
      ...(snippet as { mcpServers: Record<string, unknown> }).mcpServers,
    },
  };
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
}

export default class McpSetup extends Command {
  static description = 'Generate MCP config snippet for Claude Code or Copilot CLI';

  static flags = {
    transport: Flags.string({
      description: 'Transport mode',
      options: ['stdio', 'http'],
      default: 'stdio',
    }),
    apply: Flags.boolean({
      description: 'Write config directly to destination file (creates .bak backup)',
      default: false,
    }),
    'show-current': Flags.boolean({
      description: 'Show existing MCP config for the selected transport',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(McpSetup);
    const config = readConfig();
    const endpoint = config.endpoint ?? 'http://localhost:8080';
    const apiKey = config.apiKey ?? '';
    const userId = config.userId ?? '';
    const isHttp = flags.transport === 'http';

    const destPath = isHttp ? copilotConfigPath() : claudeConfigPath();

    if (flags['show-current']) {
      if (!fs.existsSync(destPath)) {
        this.log(`No config found at ${destPath}`);
        return;
      }
      this.log(`Current config at ${destPath}:`);
      this.log(JSON.stringify(readJsonFile(destPath), null, 2));
      return;
    }

    const snippet = isHttp
      ? buildHttpSnippet(endpoint)
      : buildStdioSnippet(endpoint, apiKey, userId);

    if (flags.apply) {
      applySnippet(destPath, snippet);
      this.log(`Written to ${destPath} (backup: ${destPath}.bak)`);
      return;
    }

    const label = isHttp ? '.copilot/mcp.json' : destPath;
    this.log(`Add to ${label}:`);
    this.log(JSON.stringify(snippet, null, 2));
  }
}
