import { Command, Args } from '@oclif/core';
import { ApiClient, formatApiError } from '../lib/apiClient';

interface SkillRead {
  id: string;
  name: string;
  summary: string;
  description?: string;
  usage?: string;
  tags?: string[];
  author?: string;
  origin: string;
  origin_url?: string;
  latest_version: string;
  avg_tokens: number;
  use_count: number;
  rating_avg: number;
  rating_count: number;
  created_at: string;
}

interface SkillVersionRead {
  id: string;
  version: string;
  checksum: string;
  created_at: string;
}

export default class Info extends Command {
  static description = 'Show details for a skill';
  static args = { skillId: Args.string({ description: 'Skill ID', required: true }) };

  async run(): Promise<void> {
    const { args } = await this.parse(Info);
    const client = new ApiClient();

    let skill: SkillRead;
    let versions: SkillVersionRead[];
    try {
      [skill, versions] = await Promise.all([
        client.get<SkillRead>(`/api/v1/skills/${args.skillId}`),
        client.get<SkillVersionRead[]>(`/api/v1/skills/${args.skillId}/versions`),
      ]);
    } catch (err) {
      this.error(formatApiError(err));
    }

    const sep = '─'.repeat(60);
    this.log(sep);
    this.log(`${skill.name}  (${skill.id})`);
    this.log(sep);
    this.log(`Summary    : ${skill.summary}`);
    this.log(`Version    : ${skill.latest_version}`);
    this.log(`Author     : ${skill.author ?? '-'}`);
    this.log(`Tags       : ${skill.tags?.join(', ') ?? '-'}`);
    this.log(`Origin     : ${skill.origin}${skill.origin_url ? ` (${skill.origin_url})` : ''}`);
    this.log(`Rating     : ${skill.rating_avg > 0 ? skill.rating_avg.toFixed(1) : '-'} (${skill.rating_count} ratings)`);
    this.log(`Avg tokens : ${skill.avg_tokens > 0 ? skill.avg_tokens : '-'}`);
    this.log(`Use count  : ${skill.use_count}`);
    this.log(`Created    : ${new Date(skill.created_at).toLocaleDateString()}`);

    if (skill.description) {
      this.log('');
      this.log('Description:');
      this.log(skill.description);
    }

    if (skill.usage) {
      this.log('');
      this.log('Usage Instructions:');
      this.log(skill.usage);
    }

    if (versions.length > 0) {
      this.log('');
      this.log('Versions:');
      for (const v of versions) {
        this.log(`  ${v.version}  (${new Date(v.created_at).toLocaleDateString()})  sha256:${v.checksum.slice(0, 12)}...`);
      }
    }

    this.log(sep);
  }
}
