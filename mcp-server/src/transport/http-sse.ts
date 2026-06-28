import http from "node:http";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export async function startHttpSse(server: McpServer): Promise<void> {
  const port = parseInt(process.env.TOKENLENS_MCP_PORT ?? "8082", 10);

  // One transport per SSE connection; sessions keyed by session ID
  const transports = new Map<string, SSEServerTransport>();

  const httpServer = http.createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/sse") {
        const transport = new SSEServerTransport("/message", res);
        transports.set(transport.sessionId, transport);
        transport.onclose = () => transports.delete(transport.sessionId);
        await server.connect(transport);
      } else if (req.method === "POST" && req.url?.startsWith("/message")) {
        const url = new URL(req.url, `http://localhost`);
        const sessionId = url.searchParams.get("sessionId") ?? "";
        const transport = transports.get(sessionId);
        if (!transport) {
          res.writeHead(404).end("Session not found");
          return;
        }
        await transport.handlePostMessage(req, res);
      } else {
        res.writeHead(404).end("Not found");
      }
    } catch (err) {
      process.stderr.write(`MCP HTTP error: ${String(err)}\n`);
      if (!res.headersSent) res.writeHead(500).end("Internal server error");
    }
  });

  await new Promise<void>((resolve) =>
    httpServer.listen(port, "0.0.0.0", () => {
      process.stderr.write(`TokenLens MCP HTTP/SSE listening on 0.0.0.0:${port}/sse\n`);
      resolve();
    }),
  );
}
