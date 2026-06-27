import { Command, Args, Flags } from '@oclif/core';
import { ApiClient, formatApiError } from '../lib/apiClient';

interface RatingRead {
  id: string;
  stars: number;
  comment?: string;
}

export default class Rate extends Command {
  static description = 'Rate a skill';
  static args = { skillId: Args.string({ description: 'Skill ID', required: true }) };
  static flags = {
    stars: Flags.integer({ description: 'Rating (1-5)', required: true, min: 1, max: 5 }),
    comment: Flags.string({ description: 'Optional comment' }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Rate);
    const client = new ApiClient();

    let rating: RatingRead;
    try {
      rating = await client.post<RatingRead>(`/api/v1/skills/${args.skillId}/ratings`, {
        stars: flags.stars,
        comment: flags.comment ?? null,
      });
    } catch (err) {
      this.error(formatApiError(err));
    }

    const stars = '★'.repeat(rating.stars) + '☆'.repeat(5 - rating.stars);
    this.log(`Rated ${args.skillId}: ${stars} (${rating.stars}/5)`);
    if (rating.comment) this.log(`Comment: ${rating.comment}`);
  }
}
