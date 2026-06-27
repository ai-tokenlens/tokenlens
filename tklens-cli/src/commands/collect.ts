import { Command, Flags } from '@oclif/core';
import * as cliProgress from 'cli-progress';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ApiClient } from '../lib/apiClient';
import { readConfig } from '../lib/config';

export interface EventPayload {
  user_id: string;
  tool: string;
  model?: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  total_tokens: number;
  timestamp: string;
}

export function findFiles(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const walk = (d: string) => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && exts.some(x => e.name.endsWith(x))) results.push(full);
    }
  };
  walk(dir);
  return results;
}

export function copilotStorageDirs(): string[] {
  const home = os.homedir();
  const plat = process.platform;
  let base: string;
  if (plat === 'darwin') {
    base = path.join(home, 'Library', 'Application Support', 'Code', 'User');
  } else if (plat === 'win32') {
    base = path.join(process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming'), 'Code', 'User');
  } else {
    base = path.join(home, '.config', 'Code', 'User');
  }
  return [
    path.join(base, 'workspaceStorage'),
    path.join(base, 'globalStorage'),
  ];
}

function extractTokensFromObject(obj: unknown): { input: number; output: number; model?: string } | null {
  if (typeof obj !== 'object' || obj === null) return null;
  const o = obj as Record<string, unknown>;

  const input = (o['inputTokens'] ?? o['input_tokens'] ?? o['promptTokens'] ?? o['prompt_tokens']) as number | undefined;
  const output = (o['outputTokens'] ?? o['output_tokens'] ?? o['completionTokens'] ?? o['completion_tokens']) as number | undefined;
  const model = (o['model'] ?? o['modelId'] ?? o['model_id']) as string | undefined;

  if (typeof input === 'number' || typeof output === 'number') {
    return { input: input ?? 0, output: output ?? 0, model };
  }
  return null;
}

function deepSearch(obj: unknown, depth = 0): Array<{ input: number; output: number; model?: string; timestamp?: string }> {
  if (depth > 6 || typeof obj !== 'object' || obj === null) return [];
  const results: Array<{ input: number; output: number; model?: string; timestamp?: string }> = [];
  const o = obj as Record<string, unknown>;

  const found = extractTokensFromObject(o);
  if (found) {
    const ts = (o['timestamp'] ?? o['createdAt'] ?? o['created_at']) as string | undefined;
    results.push({ ...found, timestamp: typeof ts === 'string' ? ts : undefined });
  }

  for (const v of Object.values(o)) {
    if (Array.isArray(v)) {
      for (const item of v) results.push(...deepSearch(item, depth + 1));
    } else if (typeof v === 'object') {
      results.push(...deepSearch(v, depth + 1));
    }
  }
  return results;
}

export function parseCopilotFiles(files: string[], tick?: () => void): EventPayload[] {
  const events: EventPayload[] = [];
  for (const f of files) {
    try {
      const raw: unknown = JSON.parse(fs.readFileSync(f, 'utf-8'));
      const hits = deepSearch(raw);
      for (const h of hits) {
        if (h.input === 0 && h.output === 0) continue;
        events.push({
          user_id: '',
          tool: 'copilot-cli',
          model: h.model,
          input_tokens: h.input,
          output_tokens: h.output,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          total_tokens: h.input + h.output,
          timestamp: h.timestamp ?? new Date().toISOString(),
        });
      }
    } catch { /* skip unreadable/unparseable files */ }
    tick?.();
  }
  return events;
}

export function parseClaudeCodeFiles(files: string[], tick?: () => void): EventPayload[] {
  const events: EventPayload[] = [];
  for (const f of files) {
    try {
      const lines = fs.readFileSync(f, 'utf-8').split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        let obj: unknown;
        try { obj = JSON.parse(line); } catch { continue; }
        if (typeof obj !== 'object' || obj === null) continue;
        const o = obj as Record<string, unknown>;

        const usage = o['usage'] as Record<string, number> | undefined;
        if (usage && typeof usage === 'object') {
          const input = usage['input_tokens'] ?? 0;
          const output = usage['output_tokens'] ?? 0;
          const cacheRead = usage['cache_read_input_tokens'] ?? 0;
          const cacheWrite = usage['cache_creation_input_tokens'] ?? 0;
          if (input > 0 || output > 0) {
            events.push({
              user_id: '',
              tool: 'claude-code',
              model: o['model'] as string | undefined,
              input_tokens: input,
              output_tokens: output,
              cache_read_tokens: cacheRead,
              cache_write_tokens: cacheWrite,
              total_tokens: input + output + cacheRead + cacheWrite,
              timestamp: (o['timestamp'] as string | undefined) ?? new Date().toISOString(),
            });
          }
        }
      }
    } catch { /* skip unreadable files */ }
    tick?.();
  }
  return events;
}

export function filterBySince(events: EventPayload[], since: Date): EventPayload[] {
  return events.filter(e => new Date(e.timestamp) >= since);
}

export default class Collect extends Command {
  static description = 'Fallback session-file collector — posts token estimates to TokenLens';

  static flags = {
    tool: Flags.string({
      description: 'Tool to collect from (auto-detected if omitted)',
      options: ['copilot-cli', 'claude-code'],
    }),
    since: Flags.string({
      description: 'Only collect events after this ISO date, e.g. 2026-01-01T00:00:00Z',
    }),
    output: Flags.string({
      description: 'Output format instead of sending to API',
      options: ['json'],
    }),
    'dry-run': Flags.boolean({
      description: 'Print events without sending (deprecated: prefer --output=json)',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Collect);
    const config = readConfig();
    const userId = config.userId ?? os.userInfo().username;

    // Resolve which tools to collect from
    const tools: string[] = [];
    if (flags.tool) {
      tools.push(flags.tool);
    } else {
      const claudeDir = path.join(os.homedir(), '.claude');
      if (fs.existsSync(claudeDir)) tools.push('claude-code');
      const copilotDirs = copilotStorageDirs();
      if (copilotDirs.some(d => fs.existsSync(d))) tools.push('copilot-cli');
      if (tools.length === 0) {
        this.warn('No known tool directories found. Use --tool to specify one explicitly.');
        return;
      }
      this.log(`Auto-detected tool(s): ${tools.join(', ')}`);
    }

    // Enumerate all session files
    const copilotFiles: string[] = [];
    const claudeFiles: string[] = [];
    for (const tool of tools) {
      if (tool === 'copilot-cli') {
        for (const d of copilotStorageDirs()) copilotFiles.push(...findFiles(d, ['.json']));
      } else {
        claudeFiles.push(...findFiles(path.join(os.homedir(), '.claude'), ['.jsonl']));
      }
    }
    const totalFiles = copilotFiles.length + claudeFiles.length;
    this.log(`Found ${totalFiles} session file(s) to scan.`);

    // Progress bar (TTY only)
    const bar = process.stdout.isTTY && totalFiles > 0
      ? new cliProgress.SingleBar({ clearOnComplete: true }, cliProgress.Presets.shades_classic)
      : null;
    bar?.start(totalFiles, 0);

    let events: EventPayload[] = [
      ...parseCopilotFiles(copilotFiles, () => bar?.increment()),
      ...parseClaudeCodeFiles(claudeFiles, () => bar?.increment()),
    ];

    bar?.stop();

    // Filter by --since
    if (flags.since) {
      const sinceDate = new Date(flags.since);
      if (isNaN(sinceDate.getTime())) {
        this.error(`Invalid --since value: "${flags.since}". Use ISO format, e.g. 2026-01-01.`);
      }
      const before = events.length;
      events = filterBySince(events, sinceDate);
      this.log(`--since filter: ${before} → ${events.length} event(s).`);
    }

    // Stamp user_id
    for (const ev of events) ev.user_id = userId;

    this.log(`Extracted ${events.length} event(s) [source=session-file, estimates only].`);

    if (events.length === 0) {
      this.log('Nothing to send.');
      return;
    }

    if (flags.output === 'json' || flags['dry-run']) {
      this.log(JSON.stringify({ events }, null, 2));
      return;
    }

    const api = new ApiClient();
    let sent = 0;
    for (let i = 0; i < events.length; i += 100) {
      const batch = events.slice(i, i + 100);
      await api.post<{ accepted: number }>('/api/v1/events/batch', { events: batch });
      sent += batch.length;
    }
    this.log(`Sent ${sent} event(s) to TokenLens.`);
  }
}
