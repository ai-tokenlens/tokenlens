import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../apiClient.js";

export async function publishSkillHandler(
  client: ApiClient,
  params: { skill_toml: string; payload_b64: string },
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const result = await client.post<{ id: string; name: string }>("/api/v1/skills", {
    skill_toml: params.skill_toml,
    payload_b64: params.payload_b64,
  });
  return {
    content: [
      { type: "text", text: `Skill published: ${result.name} (id: ${result.id})` },
    ],
  };
}

export function registerPublishSkill(server: McpServer, client: ApiClient): void {
  server.tool(
    "publish_skill",
    "Publish a new skill to the registry. Requires TOKENLENS_API_KEY.",
    {
      skill_toml: z.string().describe("Contents of skill.toml"),
      payload_b64: z.string().describe("Base64-encoded tarball of the skill files"),
    },
    (params) => publishSkillHandler(client, params),
  );
}
