import fetch from "node-fetch";
import type { Response } from "node-fetch";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClientConfig {
  endpoint: string;
  apiKey?: string;
}

export class ApiClient {
  readonly endpoint: string;
  private readonly apiKey: string | undefined;

  constructor(config?: Partial<ApiClientConfig>) {
    this.endpoint = (
      config?.endpoint ??
      process.env.TOKENLENS_ENDPOINT ??
      "http://localhost:8080"
    ).replace(/\/$/, "");
    this.apiKey = config?.apiKey ?? process.env.TOKENLENS_API_KEY;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) h["Authorization"] = `Bearer ${this.apiKey}`;
    return h;
  }

  private async check(res: Response, path: string): Promise<void> {
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = (await res.json()) as { detail?: string };
        if (body.detail) detail = body.detail;
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, `${path} → ${res.status}: ${detail}`);
    }
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.endpoint}${path}`, {
      headers: this.headers(),
    });
    await this.check(res, path);
    return res.json() as Promise<T>;
  }

  async getStream(path: string): Promise<import("node-fetch").Response> {
    const h: Record<string, string> = {};
    if (this.apiKey) h["Authorization"] = `Bearer ${this.apiKey}`;
    const res = await fetch(`${this.endpoint}${path}`, { headers: h });
    await this.check(res, path);
    return res;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.endpoint}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    await this.check(res, path);
    return res.json() as Promise<T>;
  }
}

export function defaultClient(): ApiClient {
  return new ApiClient();
}
