import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../apiClient.js";

export async function rateSkillHandler(
  client: ApiClient,
  params: { id: string; stars: number; comment?: string },
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const body: Record<string, unknown> = { stars: params.stars };
  if (params.comment) body.comment = params.comment;
  const rating = await client.post<{ id: string; stars: number }>(
    `/api/v1/skills/${encodeURIComponent(params.id)}/ratings`,
    body,
  );
  return {
    content: [{ type: "text", text: `Rating submitted: ${rating.stars}★ for skill "${params.id}"` }],
  };
}

export function registerRateSkill(server: McpServer, client: ApiClient): void {
  server.tool(
    "rate_skill",
    "Submit a star rating (1–5) for a skill. Requires TOKENLENS_API_KEY.",
    {
      id: z.string().describe("Skill ID"),
      stars: z.number().int().min(1).max(5).describe("Star rating 1–5"),
      comment: z.string().optional().describe("Optional review comment"),
    },
    (params) => rateSkillHandler(client, params),
  );
}
