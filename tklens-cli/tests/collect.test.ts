import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as FsType from 'fs';

// --- fs mock -----------------------------------------------------------
// vi.mock is hoisted, so mocks must be created with vi.hoisted() to be
// available before their first reference inside the factory.
const { mockExistsSync, mockReaddirSync, mockReadFileSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockReadFileSync: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  readdirSync: mockReaddirSync,
  readFileSync: mockReadFileSync,
}));

// --- os mock -----------------------------------------------------------
vi.mock('os', () => ({
  homedir: () => '/home/test',
  userInfo: () => ({ username: 'testuser' }),
  platform: 'linux',
}));

// --- cli-progress mock -------------------------------------------------
vi.mock('cli-progress', () => ({
  SingleBar: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), increment: vi.fn() })),
  Presets: { shades_classic: {} },
}));

// --- config mock -------------------------------------------------------
vi.mock('../src/lib/config', () => ({
  readConfig: vi.fn(() => ({})),
  writeConfig: vi.fn(),
}));

// Imports after mocks
import {
  parseCopilotFiles,
  parseClaudeCodeFiles,
  filterBySince,
  type EventPayload,
} from '../src/commands/collect';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDirent(name: string, isDir: boolean): FsType.Dirent {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    isSymbolicLink: () => false,
    path: '',
    parentPath: '',
  } as unknown as FsType.Dirent;
}

const COPILOT_JSON = JSON.stringify({
  sessions: [
    {
      inputTokens: 120,
      outputTokens: 80,
      model: 'gpt-4o',
      timestamp: '2026-06-01T10:00:00Z',
    },
    {
      // zero-token entry — must be skipped
      inputTokens: 0,
      outputTokens: 0,
    },
  ],
});

const CLAUDE_JSONL = [
  JSON.stringify({
    usage: {
      input_tokens: 200,
      output_tokens: 150,
      cache_read_input_tokens: 30,
      cache_creation_input_tokens: 10,
    },
    model: 'claude-sonnet-4-6',
    timestamp: '2026-06-10T08:00:00Z',
  }),
  JSON.stringify({
    usage: {
      input_tokens: 50,
      output_tokens: 25,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
    model: 'claude-haiku-4-5',
    timestamp: '2026-05-01T08:00:00Z',
  }),
  '', // empty line — must be ignored
].join('\n');

// ---------------------------------------------------------------------------
// parseCopilotFiles
// ---------------------------------------------------------------------------

describe('parseCopilotFiles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('extracts tokens and skips zero-token entries', () => {
    mockReadFileSync.mockReturnValue(COPILOT_JSON);

    const events = parseCopilotFiles(['/fake/file.json']);

    expect(events).toHaveLength(1);
    expect(events[0].input_tokens).toBe(120);
    expect(events[0].output_tokens).toBe(80);
    expect(events[0].total_tokens).toBe(200);
    expect(events[0].tool).toBe('copilot-cli');
    expect(events[0].model).toBe('gpt-4o');
    expect(events[0].timestamp).toBe('2026-06-01T10:00:00Z');
  });

  it('skips files that fail to parse', () => {
    mockReadFileSync.mockReturnValue('not valid json{{{{');
    const events = parseCopilotFiles(['/bad.json']);
    expect(events).toHaveLength(0);
  });

  it('calls tick once per file', () => {
    mockReadFileSync.mockReturnValue(COPILOT_JSON);
    const tick = vi.fn();

    parseCopilotFiles(['/a.json', '/b.json'], tick);

    expect(tick).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// parseClaudeCodeFiles
// ---------------------------------------------------------------------------

describe('parseClaudeCodeFiles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('extracts tokens from JSONL including cache fields', () => {
    mockReadFileSync.mockReturnValue(CLAUDE_JSONL);

    const events = parseClaudeCodeFiles(['/home/test/.claude/session.jsonl']);

    expect(events).toHaveLength(2);

    const first = events[0];
    expect(first.input_tokens).toBe(200);
    expect(first.output_tokens).toBe(150);
    expect(first.cache_read_tokens).toBe(30);
    expect(first.cache_write_tokens).toBe(10);
    expect(first.total_tokens).toBe(390); // 200+150+30+10
    expect(first.tool).toBe('claude-code');
    expect(first.model).toBe('claude-sonnet-4-6');
    expect(first.timestamp).toBe('2026-06-10T08:00:00Z');
  });

  it('skips lines without usage object', () => {
    mockReadFileSync.mockReturnValue(
      [
        JSON.stringify({ event: 'start' }),
        JSON.stringify({ usage: { input_tokens: 10, output_tokens: 5 } }),
      ].join('\n'),
    );

    const events = parseClaudeCodeFiles(['/f.jsonl']);
    expect(events).toHaveLength(1);
  });

  it('calls tick once per file', () => {
    mockReadFileSync.mockReturnValue(CLAUDE_JSONL);
    const tick = vi.fn();

    parseClaudeCodeFiles(['/a.jsonl', '/b.jsonl'], tick);

    expect(tick).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// filterBySince
// ---------------------------------------------------------------------------

describe('filterBySince', () => {
  const base: EventPayload = {
    user_id: 'u',
    tool: 'claude-code',
    input_tokens: 1,
    output_tokens: 1,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    total_tokens: 2,
    timestamp: '',
  };

  const events: EventPayload[] = [
    { ...base, timestamp: '2026-05-01T00:00:00Z' },
    { ...base, timestamp: '2026-06-01T00:00:00Z' },
    { ...base, timestamp: '2026-07-01T00:00:00Z' },
  ];

  it('keeps events on or after since date', () => {
    const result = filterBySince(events, new Date('2026-06-01T00:00:00Z'));
    expect(result).toHaveLength(2);
    expect(result[0].timestamp).toBe('2026-06-01T00:00:00Z');
    expect(result[1].timestamp).toBe('2026-07-01T00:00:00Z');
  });

  it('returns empty array when all events are before since', () => {
    const result = filterBySince(events, new Date('2027-01-01T00:00:00Z'));
    expect(result).toHaveLength(0);
  });

  it('returns all events when since is very old', () => {
    const result = filterBySince(events, new Date('2020-01-01T00:00:00Z'));
    expect(result).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Batch POST integration (fetch mock)
// ---------------------------------------------------------------------------

// Normalize path separators so tests work on Windows and Unix alike.
const norm = (p: string) => p.replace(/\\/g, '/');

describe('Collect command — batch POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockExistsSync.mockImplementation((p: string) =>
      norm(p).endsWith('/home/test/.claude'),
    );

    mockReaddirSync.mockImplementation((p: string) => {
      if (norm(p).endsWith('/home/test/.claude')) return [makeDirent('session.jsonl', false)];
      return [];
    });

    mockReadFileSync.mockImplementation((p: string) => {
      if (norm(p).endsWith('session.jsonl')) return CLAUDE_JSONL;
      return '';
    });

    // Stub global fetch
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ accepted: 2 }),
      }),
    );
  });

  it('POSTs extracted events with correct token values', async () => {
    const Collect = (await import('../src/commands/collect')).default;
    await Collect.run(['--tool', 'claude-code']);

    const fetchMock = vi.mocked(fetch);
    const batchCall = fetchMock.mock.calls.find(
      ([url]) => typeof url === 'string' && url.includes('/api/v1/events/batch'),
    );
    expect(batchCall).toBeDefined();

    const body = JSON.parse(batchCall![1]!.body as string) as { events: EventPayload[] };
    expect(body.events).toHaveLength(2);

    const ev = body.events[0];
    expect(ev.input_tokens).toBe(200);
    expect(ev.output_tokens).toBe(150);
    expect(ev.cache_read_tokens).toBe(30);
    expect(ev.cache_write_tokens).toBe(10);
    expect(ev.total_tokens).toBe(390);
    expect(ev.tool).toBe('claude-code');
    expect(ev.user_id).toBe('testuser');
  });

  it('--output=json prints events and skips POST', async () => {
    const Collect = (await import('../src/commands/collect')).default;
    await Collect.run(['--tool', 'claude-code', '--output=json']);

    const fetchMock = vi.mocked(fetch);
    const batchCall = fetchMock.mock.calls.find(
      ([url]) => typeof url === 'string' && url.includes('/api/v1/events/batch'),
    );
    expect(batchCall).toBeUndefined();
  });

  it('--since filters events before sending', async () => {
    const Collect = (await import('../src/commands/collect')).default;
    // Only the event from 2026-06-10 passes; the one from 2026-05-01 is filtered
    await Collect.run(['--tool', 'claude-code', '--since=2026-06-01T00:00:00Z']);

    const fetchMock = vi.mocked(fetch);
    const batchCall = fetchMock.mock.calls.find(
      ([url]) => typeof url === 'string' && url.includes('/api/v1/events/batch'),
    );
    expect(batchCall).toBeDefined();

    const body = JSON.parse(batchCall![1]!.body as string) as { events: EventPayload[] };
    expect(body.events).toHaveLength(1);
    expect(body.events[0].timestamp).toBe('2026-06-10T08:00:00Z');
  });
});
