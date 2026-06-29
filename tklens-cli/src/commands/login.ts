import { Command, Flags } from '@oclif/core';
import { readConfig, writeConfig } from '../lib/config';
import { ApiClient, ApiError } from '../lib/apiClient';

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

    try {
      const client = new ApiClient(flags.endpoint, flags['api-key']);
      await client.get<{ valid: boolean }>('/api/v1/auth/verify');
      this.log(`Autenticato su ${flags.endpoint}.`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        const cfg = readConfig();
        delete cfg.apiKey;
        writeConfig(cfg);
        this.error('API key non valida. Controlla INGEST_TOKEN sul server.');
      } else {
        this.warn('Server non raggiungibile — chiave salvata ma non verificata.');
      }
    }
  }
}
