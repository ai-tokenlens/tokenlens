import { readConfig } from './config';

export class ApiClient {
  private endpoint: string;
  private apiKey: string | undefined;

  constructor(endpoint?: string, apiKey?: string) {
    const config = readConfig();
    this.endpoint = endpoint ?? config.endpoint ?? 'http://localhost:8080';
    this.apiKey = apiKey ?? config.apiKey;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) h['X-API-Key'] = this.apiKey;
    return h;
  }

  async get<T>(urlPath: string): Promise<T> {
    const res = await fetch(`${this.endpoint}${urlPath}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`GET ${urlPath} → ${res.status} ${res.statusText}`);
    return res.json() as Promise<T>;
  }

  async post<T>(urlPath: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.endpoint}${urlPath}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${urlPath} → ${res.status} ${res.statusText}`);
    return res.json() as Promise<T>;
  }
}
