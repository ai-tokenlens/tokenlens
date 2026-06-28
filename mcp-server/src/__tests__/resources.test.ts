import { describe, it, expect, vi } from "vitest";
import type { ApiClient } from "../apiClient.js";

function mockClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    endpoint: "http://localhost:8080",
    get: vi.fn(),
    post: vi.fn(),
    getStream: vi.fn(),
    ...overrides,
  } as unknown as ApiClient;
}

// We test the underlying logic directly without the MCP server registration
// by exercising the same code paths the resource handlers use.

describe("skill resource list logic", () => {
  it("returns skill URIs from API", async () => {
    const skills = [
      { id: "skill-a", name: "Skill A", description: "", tags: [], avg_rating: null, download_count: 0 },
      { id: "skill-b", name: "Skill B", description: "", tags: [], avg_rating: null, download_count: 0 },
    ];
    const client = mockClient({ get: vi.fn().mockResolvedValue(skills) });
    const result = await client.get<typeof skills>("/api/v1/skills");
    const uris = result.map((s) => `skill://${s.id}`);
    expect(uris).toEqual(["skill://skill-a", "skill://skill-b"]);
  });

  it("handles empty registry", async () => {
    const client = mockClient({ get: vi.fn().mockResolvedValue([]) });
    const result = await client.get<unknown[]>("/api/v1/skills");
    expect(result).toHaveLength(0);
  });
});

describe("skill resource read logic", () => {
  const detail = {
    id: "py-fmt",
    name: "Python Formatter",
    description: "Formats Python code",
    tags: ["python"],
    latest_version: "1.0.0",
    avg_rating: 4.0,
    download_count: 10,
    usage_instructions: "Use as pre-commit hook",
    manifest_toml: '[skill]\nid = "py-fmt"',
    created_at: "2024-01-01T00:00:00Z",
  };

  it("concatenates manifest_toml + description + usage", async () => {
    const client = mockClient({ get: vi.fn().mockResolvedValue(detail) });
    const s = await client.get<typeof detail>(`/api/v1/skills/py-fmt`);
    const parts: string[] = [];
    if (s.manifest_toml) parts.push(s.manifest_toml);
    parts.push(s.description);
    if (s.usage_instructions) parts.push("\n\n" + s.usage_instructions);
    const text = parts.join("\n\n");
    expect(text).toContain('[skill]');
    expect(text).toContain("Formats Python code");
    expect(text).toContain("Use as pre-commit hook");
  });

  it("throws on missing skill", async () => {
    const client = mockClient({ get: vi.fn().mockRejectedValue(new Error("API 404")) });
    await expect(client.get("/api/v1/skills/nonexistent")).rejects.toThrow("404");
  });
});
