import { readConfig } from './config';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

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
    if (this.apiKey) h['Authorization'] = `Bearer ${this.apiKey}`;
    return h;
  }

  private async checkResponse(res: Response, urlPath: string, method: string): Promise<void> {
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json() as { detail?: string };
        if (body.detail) detail = body.detail;
      } catch { /* ignore */ }
      throw new ApiError(res.status, `${method} ${urlPath} → ${res.status}: ${detail}`);
    }
  }

  async get<T>(urlPath: string): Promise<T> {
    const res = await fetch(`${this.endpoint}${urlPath}`, { headers: this.headers() });
    await this.checkResponse(res, urlPath, 'GET');
    return res.json() as Promise<T>;
  }

  async getBuffer(urlPath: string): Promise<Buffer> {
    const h: Record<string, string> = {};
    if (this.apiKey) h['Authorization'] = `Bearer ${this.apiKey}`;
    const res = await fetch(`${this.endpoint}${urlPath}`, { headers: h });
    await this.checkResponse(res, urlPath, 'GET');
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  async post<T>(urlPath: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.endpoint}${urlPath}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    await this.checkResponse(res, urlPath, 'POST');
    return res.json() as Promise<T>;
  }
}

export function formatApiError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Authentication failed. Run `tklens login` to set your API key.';
    if (err.status === 404) return 'Not found.';
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}
