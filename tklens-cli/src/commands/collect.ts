import { Command, Flags } from '@oclif/core';

export default class Collect extends Command {
  static description = 'Fallback session-file collector';
  static flags = {
    tool: Flags.string({ description: 'Tool to collect from', options: ['copilot-cli', 'claude-code'] }),
  };

  async run(): Promise<void> {
    this.log('Not yet implemented: collect');
  }
}
