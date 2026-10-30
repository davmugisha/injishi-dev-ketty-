import { providerFetch } from './provider-http';

/**
 * GTBank's bearer token, fetched with client credentials and kept until a
 * minute before it expires. One per adapter: the NIDA gateway and the Payment
 * Hub sit behind the same token endpoint (`server/mock-apis` models it; the
 * real one is owed by GTBank's Integration Specifications, ADR-073).
 *
 * `invalidate()` is for a 401 on a call: the token is fetched again once, and
 * a second 401 is a configuration fault the caller reports.
 */
export interface GtbankCredentials {
  /** The bank's base, e.g. `http://localhost:8100/gtbank`. */
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  timeoutMs: number;
}

export class GtbankTokenSource {
  private token: { value: string; expiresAt: number } | null = null;
  private inFlight: Promise<string> | null = null;

  constructor(private readonly credentials: GtbankCredentials) {}

  async bearer(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;
    // Two calls arriving together share one token request.
    this.inFlight ??= this.fetchToken().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  invalidate(): void {
    this.token = null;
  }

  private async fetchToken(): Promise<string> {
    const basic = Buffer.from(`${this.credentials.clientId}:${this.credentials.clientSecret}`).toString('base64');
    const { body } = await providerFetch<{ access_token?: unknown; expires_in?: unknown }>({
      provider: 'gtbank',
      method: 'POST',
      url: `${this.credentials.baseUrl}/oauth/token`,
      headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
      timeoutMs: this.credentials.timeoutMs,
    });
    const value = typeof body?.access_token === 'string' ? body.access_token : null;
    if (!value) throw new Error('GTBank answered the token request without an access_token.');
    const ttlSeconds = typeof body.expires_in === 'number' && body.expires_in > 0 ? body.expires_in : 300;
    this.token = { value, expiresAt: Date.now() + Math.max(30, ttlSeconds - 60) * 1_000 };
    return value;
  }
}
