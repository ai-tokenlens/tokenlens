import { z } from "zod";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { x as tarExtract } from "tar";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../apiClient.js";
import { trackUsage } from "../loopback.js";

export async function addSkillToWorkspaceHandler(
  client: ApiClient,
  params: { id: string; target?: string; workspace_path?: string },
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const dest = path.resolve(params.workspace_path ?? params.target ?? process.cwd());
  const qs = params.target ? `?target=${encodeURIComponent(params.target)}` : "";
  const res = await client.getStream(
    `/api/v1/skills/${encodeURIComponent(params.id)}/download${qs}`,
  );
  if (!res.body) throw new Error("Empty response body from download endpoint");
  await pipeline(
    res.body as unknown as NodeJS.ReadableStream,
    tarExtract({ cwd: dest, strip: 1 }),
  );
  await trackUsage(client, params.id);
  return { content: [{ type: "text", text: `Skill "${params.id}" extracted to ${dest}` }] };
}

export function registerAddSkillToWorkspace(server: McpServer, client: ApiClient): void {
  server.tool(
    "add_skill_to_workspace",
    "Download and extract a skill tarball into the working directory",
    {
      id: z.string().describe("Skill ID"),
      target: z.string().optional().describe("Target sub-directory within workspace_path"),
      workspace_path: z
        .string()
        .optional()
        .describe("Destination directory (default: current working directory)"),
    },
    (params) => addSkillToWorkspaceHandler(client, params),
  );
}
