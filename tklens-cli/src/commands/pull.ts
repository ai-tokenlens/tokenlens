import { Command, Args } from '@oclif/core';
import { ApiClient, formatApiError } from '../lib/apiClient';

export default class Pull extends Command {
  static description = 'Trigger pull-through proxy resolve for a skill origin URL';
  static args = { originUrl: Args.string({ description: 'Origin URL', required: true }) };

  async run(): Promise<void> {
    const { args } = await this.parse(Pull);
    const client = new ApiClient();

    this.log(`Resolving ${args.originUrl}...`);

    let result: { skill_id: string };
    try {
      result = await client.post<{ skill_id: string }>('/api/v1/proxy/resolve', {
        origin_url: args.originUrl,
      });
    } catch (err) {
      this.error(formatApiError(err));
    }

    this.log(`Skill ID : ${result.skill_id}`);
    this.log('Cached locally.');
  }
}
