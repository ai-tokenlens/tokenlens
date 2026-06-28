import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../apiClient.js";

export interface SkillDetail {
  id: string;
  name: string;
  description: string;
  tags: string[];
  latest_version: string | null;
  avg_rating: number | null;
  download_count: number;
  usage_instructions: string | null;
  manifest_toml: string | null;
  created_at: string;
}

export async function getSkillHandler(
  client: ApiClient,
  params: { id: string },
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const s = await client.get<SkillDetail>(`/api/v1/skills/${encodeURIComponent(params.id)}`);
  const lines = [
    `**${s.name}** (${s.id})`,
    `Version: ${s.latest_version ?? "—"}`,
    `Tags: ${s.tags.join(", ") || "—"}`,
    `Rating: ${s.avg_rating?.toFixed(1) ?? "—"}  Downloads: ${s.download_count}`,
    `Created: ${s.created_at}`,
    "",
    s.description,
    ...(s.usage_instructions ? ["", "## Usage", s.usage_instructions] : []),
  ];
  return { content: [{ type: "text", text: lines.join("\n") }] };
}

export function registerGetSkill(server: McpServer, client: ApiClient): void {
  server.tool(
    "get_skill",
    "Get full metadata and usage instructions for a skill",
    { id: z.string().describe("Skill ID") },
    (params) => getSkillHandler(client, params),
  );
}
