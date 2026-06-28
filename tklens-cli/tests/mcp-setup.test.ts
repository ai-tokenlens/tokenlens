import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- hoisted mocks -----------------------------------------------------------
const { mockExistsSync, mockReadFileSync, mockWriteFileSync, mockCopyFileSync, mockMkdirSync } =
  vi.hoisted(() => ({
    mockExistsSync: vi.fn(),
    mockReadFileSync: vi.fn(),
    mockWriteFileSync: vi.fn(),
    mockCopyFileSync: vi.fn(),
    mockMkdirSync: vi.fn(),
  }));

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  copyFileSync: mockCopyFileSync,
  mkdirSync: mockMkdirSync,
}));

vi.mock('node:os', () => ({ homedir: () => '/home/test' }));

vi.mock('../src/lib/config', () => ({
  readConfig: vi.fn(() => ({
    endpoint: 'http://localhost:8080',
    apiKey: 'key123',
    userId: 'user@example.com',
  })),
}));

// ---------------------------------------------------------------------------

import McpSetup from '../src/commands/mcp-setup';

describe('mcp-setup — stdio (default)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('prints correct stdio snippet', async () => {
    const logs: string[] = [];
    vi.spyOn(McpSetup.prototype, 'log').mockImplementation((msg = '') => {
      logs.push(msg);
    });

    await McpSetup.run([]);

    const combined = logs.join('\n');
    const jsonStart = combined.indexOf('{');
    const parsed = JSON.parse(combined.slice(jsonStart)) as {
      mcpServers: { tokenlens: { command: string; args: string[]; env: Record<string, string> } };
    };

    expect(parsed.mcpServers.tokenlens.command).toBe('npx');
    expect(parsed.mcpServers.tokenlens.args).toEqual(['@tokenlens/mcp']);
    expect(parsed.mcpServers.tokenlens.env.TOKENLENS_ENDPOINT).toBe('http://localhost:8080');
    expect(parsed.mcpServers.tokenlens.env.TOKENLENS_API_KEY).toBe('key123');
    expect(parsed.mcpServers.tokenlens.env.TOKENLENS_USER).toBe('user@example.com');
  });

  it('--apply writes merged JSON to claude config path', async () => {
    mockExistsSync.mockReturnValue(false);

    const logs: string[] = [];
    vi.spyOn(McpSetup.prototype, 'log').mockImplementation((msg = '') => logs.push(msg));

    await McpSetup.run(['--apply']);

    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const [dest, content] = mockWriteFileSync.mock.calls[0] as [string, string];
    expect(dest).toContain('claude_desktop_config.json');
    const written = JSON.parse(content) as {
      mcpServers: { tokenlens: { command: string; args: string[] } };
    };
    expect(written.mcpServers.tokenlens.command).toBe('npx');
    expect(written.mcpServers.tokenlens.args).toEqual(['@tokenlens/mcp']);
  });

  it('--apply creates backup when destination exists', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{}');

    vi.spyOn(McpSetup.prototype, 'log').mockImplementation(() => {});
    await McpSetup.run(['--apply']);

    expect(mockCopyFileSync).toHaveBeenCalledOnce();
    const [src, bak] = mockCopyFileSync.mock.calls[0] as [string, string];
    expect(bak).toBe(`${src}.bak`);
  });

  it('--show-current prints file contents when it exists', async () => {
    const existing = { mcpServers: { tokenlens: { command: 'npx' } } };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(existing));

    const logs: string[] = [];
    vi.spyOn(McpSetup.prototype, 'log').mockImplementation((msg = '') => logs.push(msg));

    await McpSetup.run(['--show-current']);

    const combined = logs.join('\n');
    expect(combined).toContain('claude_desktop_config.json');
    expect(combined).toContain('"command"');
  });

  it('--show-current reports missing file', async () => {
    mockExistsSync.mockReturnValue(false);
    const logs: string[] = [];
    vi.spyOn(McpSetup.prototype, 'log').mockImplementation((msg = '') => logs.push(msg));

    await McpSetup.run(['--show-current']);

    expect(logs.join('\n')).toContain('No config found');
  });
});

describe('mcp-setup — http transport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('prints correct http snippet with :8082/sse URL', async () => {
    const logs: string[] = [];
    vi.spyOn(McpSetup.prototype, 'log').mockImplementation((msg = '') => logs.push(msg));

    await McpSetup.run(['--transport=http']);

    const combined = logs.join('\n');
    const jsonStart = combined.indexOf('{');
    const parsed = JSON.parse(combined.slice(jsonStart)) as {
      mcpServers: { tokenlens: { url: string } };
    };

    expect(parsed.mcpServers.tokenlens.url).toBe('http://localhost:8082/sse');
  });

  it('--apply writes to .copilot/mcp.json', async () => {
    mockExistsSync.mockReturnValue(false);
    vi.spyOn(McpSetup.prototype, 'log').mockImplementation(() => {});

    await McpSetup.run(['--transport=http', '--apply']);

    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const [dest, content] = mockWriteFileSync.mock.calls[0] as [string, string];
    expect(dest).toContain('.copilot');
    expect(dest).toContain('mcp.json');
    const written = JSON.parse(content) as { mcpServers: { tokenlens: { url: string } } };
    expect(written.mcpServers.tokenlens.url).toBe('http://localhost:8082/sse');
  });

  it('--apply merges with existing copilot config', async () => {
    const existing = { mcpServers: { other: { url: 'http://other:9000/sse' } } };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(existing));
    vi.spyOn(McpSetup.prototype, 'log').mockImplementation(() => {});

    await McpSetup.run(['--transport=http', '--apply']);

    const [, content] = mockWriteFileSync.mock.calls[0] as [string, string];
    const written = JSON.parse(content) as {
      mcpServers: { other: unknown; tokenlens: { url: string } };
    };
    expect(written.mcpServers.other).toBeDefined();
    expect(written.mcpServers.tokenlens.url).toBe('http://localhost:8082/sse');
  });
});
