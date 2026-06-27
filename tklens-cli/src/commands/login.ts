import { Command, Flags } from '@oclif/core';
import { readConfig, writeConfig } from '../lib/config';

export default class Login extends Command {
  static description = 'Authenticate with a TokenLens server';

  static flags = {
    endpoint: Flags.string({
      description: 'Server base URL',
      required: true,
      default: 'http://localhost:8080',
    }),
    'api-key': Flags.string({
      description: 'API key',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Login);
    const config = readConfig();
    config.endpoint = flags.endpoint;
    config.apiKey = flags['api-key'];
    writeConfig(config);
    this.log(`Logged in to ${flags.endpoint}`);
  }
}
