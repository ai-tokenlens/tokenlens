import { Command, Args, Flags } from '@oclif/core';

export default class Add extends Command {
  static description = 'Download and materialize a skill into cwd';
  static args = { skillId: Args.string({ description: 'Skill ID', required: true }) };
  static flags = {
    target: Flags.string({ description: 'Target tool', options: ['auto', 'claude-code', 'copilot'], default: 'auto' }),
  };

  async run(): Promise<void> {
    this.log('Not yet implemented: add');
  }
}
