/**
 * Where a seam's `sandbox` mode sends its requests: Injishi Mock APIs
 * (`server/mock-apis`), the one server that stands in for GTBank, RRA and
 * Smile ID with seeded registers.
 *
 * A seam in `sandbox` runs the SAME HTTP adapter it will run under `live`;
 * only the base URL and the credentials differ. That is what makes going live
 * a configuration change plus whatever the provider's real document corrects
 * in the adapter's mapping, rather than a new adapter written on the day.
 *
 * Two settings, read by every sandbox adapter:
 * - `MOCK_APIS_URL`, default `http://localhost:8100`.
 * - `MOCK_APIS_SECRET`, from which every provider's sandbox credential is
 *   derived, default the public dev secret.
 *
 * `DEFAULT_SECRET` and `sandboxCredentials` are copies of the same names in
 * `server/mock-apis/src/config.ts`. The two never import each other; they meet
 * over HTTP only. Change both.
 *
 * Who may run `sandbox` is each seam's own rule, and every one of them refuses
 * it over a database without the sample marker: the mock invents people,
 * companies and money, and none of it may land on a real account.
 */

export const DEFAULT_MOCK_APIS_URL = 'http://localhost:8100';
const DEFAULT_SECRET = 'injishi-mock-apis-dev-secret';

export interface SandboxCredentials {
  gtbank: { clientId: string; clientSecret: string; webhookSecret: string };
  rra: { apiKey: string };
  smileId: { partnerId: string; apiKey: string };
}

export interface MockApisEndpoint {
  /** Without a trailing slash. */
  url: string;
  credentials: SandboxCredentials;
}

export function sandboxCredentials(secret: string): SandboxCredentials {
  return {
    gtbank: { clientId: 'injishi-sandbox', clientSecret: secret, webhookSecret: secret },
    rra: { apiKey: secret },
    smileId: { partnerId: '1001', apiKey: secret },
  };
}

/** The mock server's address and credentials, checked. Throws at boot on anything unreadable. */
export function resolveMockApis(env: NodeJS.ProcessEnv = process.env): MockApisEndpoint {
  // An empty value is unset: a compose file passes `${VAR:-}` as an empty string.
  const raw = ((env.MOCK_APIS_URL ?? '').trim() || DEFAULT_MOCK_APIS_URL).replace(/\/+$/, '');
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`MOCK_APIS_URL must be a URL, got "${raw}".`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`MOCK_APIS_URL must be http or https, got "${raw}".`);
  }
  const secret = (env.MOCK_APIS_SECRET ?? '').trim() || DEFAULT_SECRET;
  if (secret.length < 16) {
    throw new Error('MOCK_APIS_SECRET must be at least 16 characters.');
  }
  return { url: raw, credentials: sandboxCredentials(secret) };
}

/**
 * The refusal every seam gives `sandbox` over a real database, worded once.
 * `variable` is the seam's own mode setting.
 */
export function sandboxRefusedOverRealData(variable: string): Error {
  return new Error(
    `${variable}=sandbox is refused over a database without the sample marker: Injishi Mock APIs ` +
      'answers from invented registers. Run "off" or "live" over a real database.',
  );
}
