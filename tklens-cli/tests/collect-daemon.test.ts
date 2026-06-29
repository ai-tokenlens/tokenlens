import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as FsType from 'fs';

// --- fs mock (hoisted so factory can reference them) -----------------------
const {
  mockReadFileSync,
  mockWriteFileSync,
  mockAppendFileSync,
  mockMkdirSync,
  mockUnlinkSync,
  mockExistsSync,
  mockReaddirSync,
} = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockAppendFileSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockUnlinkSync: vi.fn(),
  mockExistsSync: vi.fn(),
  mockReaddirSync: vi.fn(),
}));

vi.mock('fs', () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  appendFileSync: mockAppendFileSync,
  mkdirSync: mockMkdirSync,
  unlinkSync: mockUnlinkSync,
  existsSync: mockExistsSync,
  readdirSync: mockReaddirSync,
}));

vi.mock('os', () => ({
  homedir: () => '/home/test',
  userInfo: () => ({ username: 'testuser' }),
  tmpdir: () => '/tmp',
}));

vi.mock('cli-progress', () => ({
  SingleBar: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), increment: vi.fn() })),
  Presets: { shades_classic: {} },
}));

vi.mock('../src/lib/config', () => ({
  readConfig: vi.fn(() => ({})),
  writeConfig: vi.fn(),
}));

const mockApiPost = vi.fn();

vi.mock('../src/lib/apiClient', () => ({
  ApiClient: vi.fn().mockImplementation(() => ({ post: mockApiPost })),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) { super(message); }
  },
  formatApiError: (err: unknown) => String(err),
}));

import {
  runOneCycle,
  runDaemonLoop,
} from '../src/commands/collect';
import type { ApiClient } from '../src/lib/apiClient';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeApi(): ApiClient {
  return { post: mockApiPost } as unknown as ApiClient;
}

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

const CLAUDE_JSONL = [
  JSON.stringify({
    usage: { input_tokens: 100, output_tokens: 50 },
    timestamp: '2026-06-01T10:00:00Z',
  }),
].join('\n');

// Far-future timestamp: always passes filterBySince even after last-collect is written
const FUTURE_JSONL = [
  JSON.stringify({
    usage: { input_tokens: 100, output_tokens: 50 },
    timestamp: '2099-01-01T00:00:00Z',
  }),
].join('\n');

// ---------------------------------------------------------------------------
// Daemon cycle — cumulative sent tracking
// ---------------------------------------------------------------------------

describe('runOneCycle — cumulative sent tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiPost.mockResolvedValue({ accepted: 1 });
    // ~/.claude exists with one session file
    mockExistsSync.mockImplementation((p: unknown) =>
      (p as string).replace(/\\/g, '/').endsWith('/.claude'),
    );
    mockReaddirSync.mockImplementation((p: unknown) => {
      if ((p as string).replace(/\\/g, '/').endsWith('/.claude'))
        return [makeDirent('session.jsonl', false)];
      return [];
    });
  });

  it('cycle 1: no prior state → sends 1 event, writes last-collect.json with sent=1', async () => {
    mockReadFileSync.mockImplementation((p: unknown) => {
      if ((p as string).endsWith('session.jsonl')) return CLAUDE_JSONL;
      const e = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      throw e;
    });

    const result = await runOneCycle(makeApi(), ['claude-code'], 'testuser', '/tmp/tklens', () => {});

    expect(result.sent).toBe(1);
    expect(mockApiPost).toHaveBeenCalledOnce();

    const writeCall = mockWriteFileSync.mock.calls.find(
      ([p]: unknown[]) => (p as string).endsWith('last-collect.json'),
    );
    expect(writeCall).toBeDefined();
    const written = JSON.parse(writeCall![1] as string) as { sent: number; timestamp: string };
    expect(written.sent).toBe(1);
    expect(written.timestamp).toBeTruthy();
  });

  it('cycle 2: accumulates sent from prior state (sent 5 + 1 = 6)', async () => {
    mockReadFileSync.mockImplementation((p: unknown) => {
      if ((p as string).endsWith('last-collect.json'))
        return JSON.stringify({ timestamp: '2026-01-01T00:00:00Z', sent: 5 });
      if ((p as string).endsWith('session.jsonl')) return CLAUDE_JSONL;
      const e = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      throw e;
    });

    const result = await runOneCycle(makeApi(), ['claude-code'], 'testuser', '/tmp/tklens', () => {});

    expect(result.sent).toBe(1);

    const writeCall = mockWriteFileSync.mock.calls.find(
      ([p]: unknown[]) => (p as string).endsWith('last-collect.json'),
    );
    const written = JSON.parse(writeCall![1] as string) as { sent: number };
    expect(written.sent).toBe(6);
  });

  it('N simulated cycles accumulate total correctly', async () => {
    let storedSent = 0;
    let storedTs = '2026-01-01T00:00:00Z';

    mockReadFileSync.mockImplementation((p: unknown) => {
      if ((p as string).endsWith('last-collect.json'))
        return JSON.stringify({ timestamp: storedTs, sent: storedSent });
      // Use far-future timestamp so the event always passes filterBySince
      if ((p as string).endsWith('session.jsonl')) return FUTURE_JSONL;
      const e = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      throw e;
    });
    mockWriteFileSync.mockImplementation((p: unknown, content: unknown) => {
      if ((p as string).endsWith('last-collect.json')) {
        const d = JSON.parse(content as string) as { sent: number; timestamp: string };
        storedSent = d.sent;
        storedTs = d.timestamp;
      }
    });

    for (let i = 0; i < 3; i++) {
      await runOneCycle(makeApi(), ['claude-code'], 'testuser', '/tmp/tklens', () => {});
    }

    expect(storedSent).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// --stop flag
// ---------------------------------------------------------------------------

describe('--stop flag', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends SIGTERM to PID in collect.pid and removes PID file', async () => {
    mockReadFileSync.mockImplementation((p: unknown) => {
      if ((p as string).endsWith('collect.pid')) return '99999';
      const e = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      throw e;
    });
    mockExistsSync.mockReturnValue(false);

    const killSpy = vi.spyOn(process, 'kill').mockReturnValue(true);

    const { default: Collect } = await import('../src/commands/collect');
    await Collect.run(['--stop']);

    expect(killSpy).toHaveBeenCalledWith(99999, 'SIGTERM');
    const unlinkedPaths = mockUnlinkSync.mock.calls.map(([p]: unknown[]) => p as string);
    expect(unlinkedPaths.some(p => p.endsWith('collect.pid'))).toBe(true);

    killSpy.mockRestore();
  });

  it('warns and cleans up PID file when process does not exist', async () => {
    mockReadFileSync.mockImplementation((p: unknown) => {
      if ((p as string).endsWith('collect.pid')) return '00001';
      const e = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      throw e;
    });
    mockExistsSync.mockReturnValue(false);

    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
    });

    const { default: Collect } = await import('../src/commands/collect');
    await Collect.run(['--stop']);

    // PID file still cleaned up despite kill failure
    const unlinkedPaths = mockUnlinkSync.mock.calls.map(([p]: unknown[]) => p as string);
    expect(unlinkedPaths.some(p => p.endsWith('collect.pid'))).toBe(true);

    killSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Daemon error resilience
// ---------------------------------------------------------------------------

describe('runDaemonLoop — error resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockImplementation((p: unknown) =>
      (p as string).replace(/\\/g, '/').endsWith('/.claude'),
    );
    mockReaddirSync.mockImplementation((p: unknown) => {
      if ((p as string).replace(/\\/g, '/').endsWith('/.claude'))
        return [makeDirent('session.jsonl', false)];
      return [];
    });
    mockReadFileSync.mockImplementation((p: unknown) => {
      if ((p as string).endsWith('session.jsonl')) return CLAUDE_JSONL;
      const e = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      throw e;
    });
  });

  it('network error does not throw — loop continues and logs error', async () => {
    mockApiPost.mockRejectedValue(new Error('Network timeout'));

    const logs: string[] = [];
    let callCount = 0;
    // Run exactly one iteration
    const shouldStop = () => callCount++ >= 1;
    const noop = () => Promise.resolve();

    await expect(
      runDaemonLoop(
        makeApi(),
        ['claude-code'],
        'testuser',
        0,
        '/tmp/tklens',
        msg => logs.push(msg),
        shouldStop,
        noop,
      ),
    ).resolves.toBeUndefined();

    expect(logs.some(l => l.includes('Network timeout'))).toBe(true);
  });

  it('successful cycle followed by error cycle — both complete without crash', async () => {
    // Use future-timestamped events so the event passes filterBySince on cycle 2 too
    mockReadFileSync.mockImplementation((p: unknown) => {
      if ((p as string).endsWith('session.jsonl')) return FUTURE_JSONL;
      const e = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      throw e;
    });
    // Persist last-collect between cycles
    let stored = '';
    mockWriteFileSync.mockImplementation((p: unknown, content: unknown) => {
      if ((p as string).endsWith('last-collect.json')) stored = content as string;
    });
    mockReadFileSync.mockImplementation((p: unknown) => {
      if ((p as string).endsWith('last-collect.json')) {
        if (stored) return stored;
        const e = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        throw e;
      }
      if ((p as string).endsWith('session.jsonl')) return FUTURE_JSONL;
      const e = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      throw e;
    });

    mockApiPost
      .mockResolvedValueOnce({ accepted: 1 })
      .mockRejectedValueOnce(new Error('Upstream 503'));

    const logs: string[] = [];
    let callCount = 0;
    // runDaemonLoop calls shouldStop twice per iteration (top + mid-loop sleep check)
    // so >= 3 allows exactly 2 full iterations
    const shouldStop = () => callCount++ >= 3;
    const noop = () => Promise.resolve();

    await expect(
      runDaemonLoop(
        makeApi(),
        ['claude-code'],
        'testuser',
        0,
        '/tmp/tklens',
        msg => logs.push(msg),
        shouldStop,
        noop,
      ),
    ).resolves.toBeUndefined();

    expect(logs.some(l => l.includes('cycle:'))).toBe(true);
    expect(logs.some(l => l.includes('Upstream 503'))).toBe(true);
  });
});
