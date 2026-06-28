import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "./apiClient.js";
import { registerSearchSkills } from "./tools/searchSkills.js";
import { registerGetSkill } from "./tools/getSkill.js";
import { registerAddSkillToWorkspace } from "./tools/addSkillToWorkspace.js";
import { registerRateSkill } from "./tools/rateSkill.js";
import { registerGetMyUsage } from "./tools/getMyUsage.js";
import { registerPublishSkill } from "./tools/publishSkill.js";
import { registerSkillResource } from "./resources/skillResource.js";
import { registerSuggestSkill } from "./prompts/suggestSkill.js";

export function createServer(): { server: McpServer; client: ApiClient } {
  const client = new ApiClient();
  const server = new McpServer({ name: "tokenlens", version: "1.0.0" });

  registerSearchSkills(server, client);
  registerGetSkill(server, client);
  registerAddSkillToWorkspace(server, client);
  registerRateSkill(server, client);
  registerGetMyUsage(server, client);
  registerPublishSkill(server, client);
  registerSkillResource(server, client);
  registerSuggestSkill(server, client);

  return { server, client };
}
