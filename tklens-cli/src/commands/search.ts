import { Command, Args, Flags } from '@oclif/core';

export default class Search extends Command {
  static description = 'Search the skill registry';
  static args = { query: Args.string({ description: 'Search query', required: true }) };
  static flags = {
    tag: Flags.string({ description: 'Filter by tag' }),
    sort: Flags.string({ description: 'Sort order', options: ['rating', 'efficiency', 'popular', 'new'] }),
  };

  async run(): Promise<void> {
    this.log('Not yet implemented: search');
  }
}
