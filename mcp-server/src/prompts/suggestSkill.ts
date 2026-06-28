import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../apiClient.js";

interface Recommendation {
  skill_id: string;
  skill_name: string;
  estimated_savings_tokens: number | null;
  tags: string[];
}

export async function suggestSkillHandler(
  client: ApiClient,
  params: { language: string; task_description: string },
): Promise<string> {
  const userId = process.env.TOKENLENS_USER ?? "";
  const recs = await client.get<Recommendation[]>(
    `/api/v1/recommendations/${encodeURIComponent(userId)}`,
  );
  const filtered = recs
    .filter((r) => r.tags.some((t) => t.toLowerCase() === params.language.toLowerCase()))
    .slice(0, 3);

  if (filtered.length === 0) {
    return `No skill suggestions found for language "${params.language}" and task: ${params.task_description}.`;
  }

  const lines = [
    `Here are the top ${filtered.length} TokenLens skill(s) that may help with: ${params.task_description}`,
    "",
    ...filtered.map((r, i) => {
      const savings =
        r.estimated_savings_tokens != null
          ? ` (est. ${r.estimated_savings_tokens.toLocaleString("en-US")} tokens saved)`
          : "";
      return `${i + 1}. **${r.skill_name}** (\`${r.skill_id}\`)${savings}`;
    }),
    "",
    "Use `add_skill_to_workspace` to install any of these skills.",
  ];
  return lines.join("\n");
}

export function registerSuggestSkill(server: McpServer, client: ApiClient): void {
  server.prompt(
    "suggest_skill_for_context",
    "Suggest relevant TokenLens skills for a given programming language and task",
    {
      language: z.string().describe("Programming language (e.g. python, typescript)"),
      task_description: z.string().describe("Brief description of what you are trying to do"),
    },
    async (params) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: await suggestSkillHandler(client, params),
          },
        },
      ],
    }),
  );
}
