import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../apiClient.js";
import type { SkillDetail } from "../tools/getSkill.js";
import type { SkillSummary } from "../tools/searchSkills.js";

export function registerSkillResource(server: McpServer, client: ApiClient): void {
  server.resource(
    "skill",
    "skill://{id}",
    { description: "Read a TokenLens skill: manifest + usage instructions" },
    async (uri) => {
      const match = uri.href.match(/^skill:\/\/(.+)$/);
      if (!match) throw new Error(`Invalid skill URI: ${uri.href}`);
      const id = decodeURIComponent(match[1]);
      const s = await client.get<SkillDetail>(`/api/v1/skills/${encodeURIComponent(id)}`);
      const parts: string[] = [];
      if (s.manifest_toml) parts.push(s.manifest_toml);
      parts.push(s.description);
      if (s.usage_instructions) parts.push("\n\n" + s.usage_instructions);
      return {
        contents: [{ uri: uri.href, mimeType: "text/plain", text: parts.join("\n\n") }],
      };
    },
  );

  server.resource(
    "skills-list",
    "skill://",
    { description: "List all available skills in the registry" },
    async () => {
      const skills = await client.get<SkillSummary[]>("/api/v1/skills");
      const text = skills
        .map((s) => `skill://${s.id}  ${s.name}`)
        .join("\n");
      return {
        contents: [{ uri: "skill://", mimeType: "text/plain", text }],
      };
    },
  );
}
