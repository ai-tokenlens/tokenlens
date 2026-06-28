import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { startStdio } from "./stdio.js";
import { startHttpSse } from "./http-sse.js";

export async function connectTransport(server: McpServer): Promise<void> {
  if (process.env.TOKENLENS_MCP_TRANSPORT === "http") {
    await startHttpSse(server);
  } else {
    await startStdio(server);
  }
}
