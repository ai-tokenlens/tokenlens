import { Command, Args } from '@oclif/core';

export default class Info extends Command {
  static description = 'Show details for a skill';
  static args = { skillId: Args.string({ description: 'Skill ID', required: true }) };

  async run(): Promise<void> {
    this.log('Not yet implemented: info');
  }
}
