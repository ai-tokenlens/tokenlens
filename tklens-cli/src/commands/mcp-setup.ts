import { Command, Flags } from '@oclif/core';
import * as os from 'node:os';
import * as path from 'node:path';
import { readConfig } from '../lib/config.js';

export default class McpSetup extends Command {
  static description = 'Generate MCP config snippet for Claude Code or Copilot CLI';

  static flags = {
    transport: Flags.string({
      description: 'Transport mode',
      options: ['stdio', 'http'],
      default: 'stdio',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(McpSetup);
    const config = readConfig();
    const endpoint = config.endpoint ?? 'http://localhost:8080';
    const apiKey = config.apiKey ?? '';
    const userId = config.userId ?? '';

    const env: Record<string, string> = {
      TOKENLENS_ENDPOINT: endpoint,
      ...(apiKey ? { TOKENLENS_API_KEY: apiKey } : {}),
      ...(userId ? { TOKENLENS_USER: userId } : {}),
    };

    if (flags.transport === 'http') {
      const snippet = {
        mcpServers: {
          tokenlens: {
            url: 'http://localhost:8082/sse',
          },
        },
      };
      this.log('Add to .copilot/mcp.json:');
      this.log(JSON.stringify(snippet, null, 2));
      this.log('');
      this.log('Then start the MCP server:');
      this.log(`  TOKENLENS_MCP_TRANSPORT=http npx tokenlens-mcp`);
    } else {
      const claudeConfigPath = path.join(os.homedir(), '.claude', 'claude_desktop_config.json');
      const snippet = {
        mcpServers: {
          tokenlens: {
            command: 'npx',
            args: ['tokenlens-mcp'],
            env,
          },
        },
      };
      this.log(`Add to ${claudeConfigPath}:`);
      this.log(JSON.stringify(snippet, null, 2));
      this.log('');
      this.log('Or for Copilot CLI, add to .copilot/mcp.json:');
      const copilotSnippet = {
        mcpServers: {
          tokenlens: {
            command: 'npx',
            args: ['tokenlens-mcp'],
            env,
          },
        },
      };
      this.log(JSON.stringify(copilotSnippet, null, 2));
    }
  }
}
