import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ApiClient } from "../apiClient.js";
import { suggestSkillHandler } from "../prompts/suggestSkill.js";

function mockClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    endpoint: "http://localhost:8080",
    get: vi.fn(),
    post: vi.fn(),
    getStream: vi.fn(),
    ...overrides,
  } as unknown as ApiClient;
}

describe("suggestSkillHandler", () => {
  beforeEach(() => {
    process.env.TOKENLENS_USER = "dev@example.com";
  });

  it("returns top 3 filtered by language tag", async () => {
    const recs = [
      { skill_id: "py-fmt", skill_name: "Python Formatter", estimated_savings_tokens: 800, tags: ["python"] },
      { skill_id: "ts-lint", skill_name: "TS Linter", estimated_savings_tokens: 500, tags: ["typescript"] },
      { skill_id: "py-doc", skill_name: "Python Docstring", estimated_savings_tokens: 600, tags: ["python"] },
      { skill_id: "py-test", skill_name: "Python Test Gen", estimated_savings_tokens: 400, tags: ["python"] },
    ];
    const client = mockClient({ get: vi.fn().mockResolvedValue(recs) });
    const text = await suggestSkillHandler(client, { language: "python", task_description: "format code" });
    expect(text).toContain("py-fmt");
    expect(text).toContain("py-doc");
    expect(text).toContain("py-test");
    expect(text).not.toContain("ts-lint");
    // at most 3 numbered entries
    const numbered = (text.match(/^\d+\./gm) ?? []).length;
    expect(numbered).toBeLessThanOrEqual(3);
  });

  it("returns no-match message when no skills match language", async () => {
    const client = mockClient({ get: vi.fn().mockResolvedValue([
      { skill_id: "ts-fmt", skill_name: "TS Formatter", estimated_savings_tokens: 300, tags: ["typescript"] },
    ]) });
    const text = await suggestSkillHandler(client, { language: "rust", task_description: "anything" });
    expect(text).toContain("No skill suggestions found");
    expect(text).toContain("rust");
  });

  it("includes estimated savings in output", async () => {
    const client = mockClient({ get: vi.fn().mockResolvedValue([
      { skill_id: "py-x", skill_name: "PY X", estimated_savings_tokens: 1200, tags: ["python"] },
    ]) });
    const text = await suggestSkillHandler(client, { language: "python", task_description: "test" });
    expect(text).toContain("1,200");
  });
});
