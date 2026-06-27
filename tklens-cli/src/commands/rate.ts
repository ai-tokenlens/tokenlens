import { Command, Args, Flags } from '@oclif/core';

export default class Rate extends Command {
  static description = 'Rate a skill';
  static args = { skillId: Args.string({ description: 'Skill ID', required: true }) };
  static flags = {
    stars: Flags.integer({ description: 'Rating (1-5)', required: true, min: 1, max: 5 }),
    comment: Flags.string({ description: 'Optional comment' }),
  };

  async run(): Promise<void> {
    this.log('Not yet implemented: rate');
  }
}
