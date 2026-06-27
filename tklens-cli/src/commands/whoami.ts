import { Command } from '@oclif/core';
import { readConfig } from '../lib/config';

export default class Whoami extends Command {
  static description = 'Show current login info';

  async run(): Promise<void> {
    const config = readConfig();
    if (!config.endpoint) {
      this.log('Not logged in');
      return;
    }
    this.log(`endpoint: ${config.endpoint}`);
    if (config.userId) this.log(`userId:   ${config.userId}`);
  }
}
