import { Command, Args } from '@oclif/core';

export default class Pull extends Command {
  static description = 'Trigger pull-through proxy resolve for a skill origin URL';
  static args = { originUrl: Args.string({ description: 'Origin URL', required: true }) };

  async run(): Promise<void> {
    this.log('Not yet implemented: pull');
  }
}
