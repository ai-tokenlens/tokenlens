import { Command, Args, Flags } from '@oclif/core';
import { ApiClient, formatApiError } from '../lib/apiClient';

interface SkillRead {
  id: string;
  name: string;
  summary: string;
  rating_avg: number;
  avg_tokens: number;
}

export default class Search extends Command {
  static description = 'Search the skill registry';
  static args = { query: Args.string({ description: 'Search query', required: true }) };
  static flags = {
    tag: Flags.string({ description: 'Filter by tag' }),
    sort: Flags.string({ description: 'Sort order', options: ['rating', 'efficiency', 'popular', 'new'] }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Search);
    const client = new ApiClient();

    const params = new URLSearchParams({ search: args.query });
    if (flags.tag) params.set('tag', flags.tag);
    if (flags.sort) params.set('sort', flags.sort);

    let skills: SkillRead[];
    try {
      skills = await client.get<SkillRead[]>(`/api/v1/skills?${params}`);
    } catch (err) {
      this.error(formatApiError(err));
    }

    if (skills.length === 0) {
      this.log('No skills found.');
      return;
    }

    const W = [38, 40, 8, 10];
    const header =
      'ID'.padEnd(W[0]) +
      'NAME'.padEnd(W[1]) +
      'RATING'.padEnd(W[2]) +
      'AVG_TOKENS';
    this.log(header);
    this.log('-'.repeat(W[0] + W[1] + W[2] + W[3]));

    for (const s of skills) {
      const rating = s.rating_avg > 0 ? s.rating_avg.toFixed(1) : '-';
      const tokens = s.avg_tokens > 0 ? String(s.avg_tokens) : '-';
      this.log(
        s.id.slice(0, W[0] - 1).padEnd(W[0]) +
        s.name.slice(0, W[1] - 1).padEnd(W[1]) +
        rating.padEnd(W[2]) +
        tokens
      );
    }
  }
}
