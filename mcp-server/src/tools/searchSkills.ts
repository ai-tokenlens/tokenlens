import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../apiClient.js";

export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  tags: string[];
  avg_rating: number | null;
  download_count: number;
}

export async function searchSkillsHandler(
  client: ApiClient,
  params: { query: string; tag?: string; sort?: "new" | "popular" | "rating" },
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const qs = new URLSearchParams({ search: params.query });
  if (params.tag) qs.set("tag", params.tag);
  if (params.sort) qs.set("sort", params.sort);
  const skills = await client.get<SkillSummary[]>(`/api/v1/skills?${qs}`);
  if (skills.length === 0) return { content: [{ type: "text", text: "No skills found." }] };
  const lines = skills.map(
    (s) =>
      `• ${s.id} — ${s.name}\n  ${s.description}\n  tags: ${s.tags.join(", ") || "—"}  rating: ${s.avg_rating?.toFixed(1) ?? "—"}  downloads: ${s.download_count}`,
  );
  return { content: [{ type: "text", text: lines.join("\n\n") }] };
}

export function registerSearchSkills(server: McpServer, client: ApiClient): void {
  server.tool(
    "search_skills",
    "Search the TokenLens skill registry",
    {
      query: z.string().describe("Free-text search query"),
      tag: z.string().optional().describe("Filter by tag slug"),
      sort: z
        .enum(["new", "popular", "rating"])
        .optional()
        .describe("Sort order (default: new)"),
    },
    (params) => searchSkillsHandler(client, params),
  );
}
