import { Command, Args } from '@oclif/core';

export default class Publish extends Command {
  static description = 'Pack and upload a skill from skill.toml';
  static args = { path: Args.string({ description: 'Path to skill directory', default: '.' }) };

  async run(): Promise<void> {
    this.log('Not yet implemented: publish');
  }
}
