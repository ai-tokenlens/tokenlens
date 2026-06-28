import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ApiClient } from "../apiClient.js";
import { searchSkillsHandler } from "../tools/searchSkills.js";
import { getSkillHandler } from "../tools/getSkill.js";
import { rateSkillHandler } from "../tools/rateSkill.js";
import { getMyUsageHandler } from "../tools/getMyUsage.js";
import { publishSkillHandler } from "../tools/publishSkill.js";

function mockClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    endpoint: "http://localhost:8080",
    get: vi.fn(),
    post: vi.fn(),
    getStream: vi.fn(),
    ...overrides,
  } as unknown as ApiClient;
}

// ── search_skills ──────────────────────────────────────────────────────────

describe("searchSkillsHandler", () => {
  it("returns formatted skill list", async () => {
    const client = mockClient({
      get: vi.fn().mockResolvedValue([
        { id: "python-docstring", name: "Python Docstring", description: "Generates docstrings", tags: ["python"], avg_rating: 4.5, download_count: 100 },
      ]),
    });
    const result = await searchSkillsHandler(client, { query: "docstring" });
    expect(result.content[0].text).toContain("python-docstring");
    expect(result.content[0].text).toContain("4.5");
  });

  it("returns no-results message when empty", async () => {
    const client = mockClient({ get: vi.fn().mockResolvedValue([]) });
    const result = await searchSkillsHandler(client, { query: "nonexistent" });
    expect(result.content[0].text).toBe("No skills found.");
  });
});

// ── get_skill ──────────────────────────────────────────────────────────────

describe("getSkillHandler", () => {
  const skillDetail = {
    id: "ts-util",
    name: "TS Utilities",
    description: "Handy TypeScript utils",
    tags: ["typescript"],
    latest_version: "1.2.0",
    avg_rating: 4.0,
    download_count: 50,
    usage_instructions: "Run `tklens add ts-util`",
    manifest_toml: null,
    created_at: "2024-01-01T00:00:00Z",
  };

  it("formats skill detail with usage instructions", async () => {
    const client = mockClient({ get: vi.fn().mockResolvedValue(skillDetail) });
    const result = await getSkillHandler(client, { id: "ts-util" });
    expect(result.content[0].text).toContain("TS Utilities");
    expect(result.content[0].text).toContain("## Usage");
    expect(result.content[0].text).toContain("tklens add ts-util");
  });

  it("throws on API error", async () => {
    const err = new Error("API 404: Not found");
    const client = mockClient({ get: vi.fn().mockRejectedValue(err) });
    await expect(getSkillHandler(client, { id: "missing" })).rejects.toThrow("404");
  });
});

// ── rate_skill ─────────────────────────────────────────────────────────────

describe("rateSkillHandler", () => {
  it("returns confirmation with star count", async () => {
    const client = mockClient({
      post: vi.fn().mockResolvedValue({ id: "r1", stars: 5 }),
    });
    const result = await rateSkillHandler(client, { id: "ts-util", stars: 5, comment: "Great!" });
    expect(result.content[0].text).toContain("5★");
    expect(result.content[0].text).toContain("ts-util");
  });

  it("throws on auth error", async () => {
    const err = new Error("API 401: Unauthorized");
    const client = mockClient({ post: vi.fn().mockRejectedValue(err) });
    await expect(rateSkillHandler(client, { id: "ts-util", stars: 3 })).rejects.toThrow("401");
  });
});

// ── get_my_usage ───────────────────────────────────────────────────────────

describe("getMyUsageHandler", () => {
  beforeEach(() => {
    process.env.TOKENLENS_USER = "user@example.com";
  });

  it("returns formatted usage summary", async () => {
    const client = mockClient({
      get: vi.fn().mockResolvedValue({
        total_input_tokens: 12000,
        total_output_tokens: 3000,
        total_cost_usd: 0.045,
        skill_count: 5,
        event_count: 20,
      }),
    });
    const result = await getMyUsageHandler(client, {});
    expect(result.content[0].text).toContain("12,000");
    expect(result.content[0].text).toContain("$0.0450");
    expect(result.content[0].text).toContain("user@example.com");
  });

  it("throws on server error", async () => {
    const client = mockClient({ get: vi.fn().mockRejectedValue(new Error("API 500")) });
    await expect(getMyUsageHandler(client, {})).rejects.toThrow("500");
  });
});

// ── publish_skill ──────────────────────────────────────────────────────────

describe("publishSkillHandler", () => {
  it("returns published skill info", async () => {
    const client = mockClient({
      post: vi.fn().mockResolvedValue({ id: "new-skill", name: "New Skill" }),
    });
    const result = await publishSkillHandler(client, {
      skill_toml: '[skill]\nid = "new-skill"',
      payload_b64: "dGVzdA==",
    });
    expect(result.content[0].text).toContain("New Skill");
    expect(result.content[0].text).toContain("new-skill");
  });

  it("throws on auth error", async () => {
    const client = mockClient({ post: vi.fn().mockRejectedValue(new Error("API 401")) });
    await expect(
      publishSkillHandler(client, { skill_toml: "", payload_b64: "" }),
    ).rejects.toThrow("401");
  });
});
