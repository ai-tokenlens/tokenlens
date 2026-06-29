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

export interface LastCollect {
  timestamp: string;
  sent: number;
}

export function getTklensDir(): string {
  return path.join(os.homedir(), '.tklens');
}

export function readLastCollect(dir: string): LastCollect | null {
  try {
    const raw = fs.readFileSync(path.join(dir, 'last-collect.json'), 'utf-8');
    return JSON.parse(raw) as LastCollect;
  } catch {
    return null;
  }
}

export function writeLastCollect(dir: string, data: LastCollect): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'last-collect.json'), JSON.stringify(data, null, 2));
}

export function readPid(dir: string): number | null {
  try {
    const raw = fs.readFileSync(path.join(dir, 'collect.pid'), 'utf-8').trim();
    const n = parseInt(raw, 10);
    return isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

export function writePid(dir: string, pid: number): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'collect.pid'), String(pid));
}

export function removePid(dir: string): void {
  try { fs.unlinkSync(path.join(dir, 'collect.pid')); } catch { /* already gone */ }
}

export function appendLog(dir: string, msg: string): void {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'collect.log'), `[${new Date().toISOString()}] ${msg}\n`);
  } catch { /* best-effort */ }
}

export function isProcessAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
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

        // Claude Code JSONL: usage lives at message.usage; top-level usage is a fallback
        const msg = (typeof o['message'] === 'object' && o['message'] !== null)
          ? o['message'] as Record<string, unknown>
          : null;
        const usage = (msg?.['usage'] ?? o['usage']) as Record<string, number> | undefined;
        if (usage && typeof usage === 'object') {
          const input = usage['input_tokens'] ?? 0;
          const output = usage['output_tokens'] ?? 0;
          const cacheRead = usage['cache_read_input_tokens'] ?? 0;
          const cacheWrite = usage['cache_creation_input_tokens'] ?? 0;
          if (input > 0 || output > 0) {
            events.push({
              user_id: '',
              tool: 'claude-code',
              model: (msg?.['model'] ?? o['model']) as string | undefined,
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

export function collectEvents(tools: string[], userId: string, since?: Date): EventPayload[] {
  const copilotFiles: string[] = [];
  const claudeFiles: string[] = [];
  for (const tool of tools) {
    if (tool === 'copilot-cli') {
      for (const d of copilotStorageDirs()) copilotFiles.push(...findFiles(d, ['.json']));
    } else {
      claudeFiles.push(...findFiles(path.join(os.homedir(), '.claude'), ['.jsonl']));
    }
  }
  let events: EventPayload[] = [
    ...parseCopilotFiles(copilotFiles),
    ...parseClaudeCodeFiles(claudeFiles),
  ];
  if (since) events = filterBySince(events, since);
  for (const ev of events) ev.user_id = userId;
  return events;
}

export async function runOneCycle(
  api: ApiClient,
  tools: string[],
  userId: string,
  dir: string,
  log: (msg: string) => void,
): Promise<{ sent: number; timestamp: string }> {
  const last = readLastCollect(dir);
  const since = last ? new Date(last.timestamp) : undefined;
  const events = collectEvents(tools, userId, since);

  let sent = 0;
  if (events.length > 0) {
    for (let i = 0; i < events.length; i += 100) {
      const batch = events.slice(i, i + 100);
      await api.post<{ accepted: number }>('/api/v1/events/batch', { events: batch });
      sent += batch.length;
    }
  }

  const timestamp = new Date().toISOString();
  const totalSent = (last?.sent ?? 0) + sent;
  writeLastCollect(dir, { timestamp, sent: totalSent });
  log(`cycle: sent=${sent} total=${totalSent}`);
  return { sent, timestamp };
}

export async function runDaemonLoop(
  api: ApiClient,
  tools: string[],
  userId: string,
  intervalMs: number,
  dir: string,
  log: (msg: string) => void,
  shouldStop: () => boolean,
  sleepFn: (ms: number) => Promise<void> = (ms) => new Promise(r => setTimeout(r, ms)),
): Promise<void> {
  while (!shouldStop()) {
    try {
      await runOneCycle(api, tools, userId, dir, log);
    } catch (err) {
      log(`cycle error: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!shouldStop()) await sleepFn(intervalMs);
  }
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
    daemon: Flags.boolean({
      description: 'Run as a background daemon, polling on --interval',
    }),
    interval: Flags.integer({
      description: 'Polling interval in minutes (only with --daemon; default 15, min 5)',
      default: 15,
    }),
    stop: Flags.boolean({
      description: 'Stop a running daemon (reads ~/.tklens/collect.pid)',
    }),
    status: Flags.boolean({
      description: 'Show daemon status and last collection stats',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Collect);
    const config = readConfig();
    const userId = config.userId ?? os.userInfo().username;
    const tklensDir = getTklensDir();

    // --stop
    if (flags.stop) {
      const pid = readPid(tklensDir);
      if (pid === null) {
        this.warn('No PID file found. Daemon may not be running.');
        return;
      }
      try {
        process.kill(pid, 'SIGTERM');
        removePid(tklensDir);
        this.log(`Sent SIGTERM to daemon (PID ${pid}).`);
      } catch {
        this.warn(`Could not signal PID ${pid}. Process may have already exited.`);
        removePid(tklensDir);
      }
      return;
    }

    // --status
    if (flags.status) {
      const pid = readPid(tklensDir);
      if (pid !== null && isProcessAlive(pid)) {
        this.log(`Daemon running (PID ${pid}).`);
      } else {
        this.log('Daemon not running.');
      }
      const last = readLastCollect(tklensDir);
      if (last) {
        this.log(`Last run: ${last.timestamp}  Total events sent: ${last.sent}`);
      } else {
        this.log('No collection history found.');
      }
      return;
    }

    // --daemon
    if (flags.daemon) {
      const intervalMinutes = flags.interval ?? 15;
      if (intervalMinutes < 5) this.error('--interval minimum is 5 minutes.');

      const tools: string[] = [];
      if (flags.tool) {
        tools.push(flags.tool);
      } else {
        if (fs.existsSync(path.join(os.homedir(), '.claude'))) tools.push('claude-code');
        if (copilotStorageDirs().some(d => fs.existsSync(d))) tools.push('copilot-cli');
        if (tools.length === 0) this.error('No known tool directories found. Use --tool to specify one.');
      }

      writePid(tklensDir, process.pid);
      const log = (msg: string) => appendLog(tklensDir, msg);

      let stopping = false;
      const cleanup = () => {
        stopping = true;
        removePid(tklensDir);
        process.exit(0);
      };
      process.once('SIGTERM', cleanup);
      process.once('SIGINT', cleanup);

      this.log(`Daemon started (PID ${process.pid}). Interval: ${intervalMinutes}m. Logs: ${path.join(tklensDir, 'collect.log')}`);
      log(`Daemon started. interval=${intervalMinutes}m tools=${tools.join(',')}`);

      const api = new ApiClient();
      await runDaemonLoop(
        api,
        tools,
        userId,
        intervalMinutes * 60 * 1000,
        tklensDir,
        log,
        () => stopping,
      );
      return;
    }

    // one-shot (original behavior)
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

    const bar = process.stdout.isTTY && totalFiles > 0
      ? new cliProgress.SingleBar({ clearOnComplete: true }, cliProgress.Presets.shades_classic)
      : null;
    bar?.start(totalFiles, 0);

    let events: EventPayload[] = [
      ...parseCopilotFiles(copilotFiles, () => bar?.increment()),
      ...parseClaudeCodeFiles(claudeFiles, () => bar?.increment()),
    ];

    bar?.stop();

    if (flags.since) {
      const sinceDate = new Date(flags.since);
      if (isNaN(sinceDate.getTime())) {
        this.error(`Invalid --since value: "${flags.since}". Use ISO format, e.g. 2026-01-01.`);
      }
      const before = events.length;
      events = filterBySince(events, sinceDate);
      this.log(`--since filter: ${before} → ${events.length} event(s).`);
    }

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
