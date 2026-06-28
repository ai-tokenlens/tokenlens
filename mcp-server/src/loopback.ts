import { ApiClient } from "./apiClient.js";

export async function trackUsage(client: ApiClient, skillId: string): Promise<void> {
  if (process.env.TOKENLENS_MCP_TRACK_USAGE === "false") return;
  const userId = process.env.TOKENLENS_USER ?? "";
  await client.post("/api/v1/events", {
    user_id: userId,
    tool: "mcp",
    skill_id: skillId,
    source: "mcp",
    input_tokens: 0,
    output_tokens: 0,
    timestamp: new Date().toISOString(),
  });
}
