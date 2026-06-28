import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../apiClient.js";

export interface UsageSummary {
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number | null;
  skill_count: number;
  event_count: number;
}

export async function getMyUsageHandler(
  client: ApiClient,
  params: { from?: string; to?: string },
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const userId = process.env.TOKENLENS_USER ?? "";
  const qs = new URLSearchParams({ user_id: userId });
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  const summary = await client.get<UsageSummary>(`/api/v1/analytics/summary?${qs}`);
  const lines = [
    `User: ${userId || "(not set)"}`,
    `Events: ${summary.event_count}  Skills used: ${summary.skill_count}`,
    `Input tokens:  ${summary.total_input_tokens.toLocaleString("en-US")}`,
    `Output tokens: ${summary.total_output_tokens.toLocaleString("en-US")}`,
    ...(summary.total_cost_usd != null
      ? [`Estimated cost: $${summary.total_cost_usd.toFixed(4)}`]
      : []),
  ];
  return { content: [{ type: "text", text: lines.join("\n") }] };
}

export function registerGetMyUsage(server: McpServer, client: ApiClient): void {
  server.tool(
    "get_my_usage",
    "Get token usage summary for the configured user (TOKENLENS_USER)",
    {
      from: z.string().optional().describe("ISO 8601 start date (inclusive)"),
      to: z.string().optional().describe("ISO 8601 end date (inclusive)"),
    },
    (params) => getMyUsageHandler(client, params),
  );
}
