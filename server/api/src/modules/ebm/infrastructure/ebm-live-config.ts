import type { EbmApiConfig } from './ebm-api.client';
import { TokenCipher } from './token-cipher';

/**
 * Everything live invoicing needs from the environment, checked at boot.
 *
 * `VSDC_ADAPTER_MODE=live` is a claim that this deployment certifies sales with
 * RRA. A deployment that makes the claim and cannot keep it — no client
 * credentials, no key to open the stored tokens with — must fail when it
 * starts, not at the first checkout, because by the first checkout it has
 * already told every host that their invoicing is on (the same reasoning
 * `ebm.module.ts` gives for refusing a live mode with no client registered).
 *
 * All missing keys are reported at once. Fixing a deployment one refusal at a
 * time is how a Friday evening goes.
 */
export interface EbmLiveConfig {
  api: EbmApiConfig;
  cipher: TokenCipher;
  /**
   * Where the taxpayer's browser lands after the consent round trip: the
   * operator app's EBM settings screen. The API adds `?ebm=connected` or
   * `?ebm=error&reason=…` so the screen can say what happened.
   */
  connectReturnUrl: string;
  /**
   * The first instant whose sales are declared to RRA. The reconcile sweep
   * certifies any confirmed sale from this instant on that has no emission row;
   * nothing before it is ever sent. Required, because it is a fiscal decision:
   * "switch live on" must never quietly mean "and backfill every demo-era
   * booking into a taxpayer's RRA record".
   */
  liveSince: Date;
}

export const EBM_ENV_KEYS = [
  'EBM_API_BASE_URL',
  'EBM_OAUTH_CLIENT_ID',
  'EBM_OAUTH_CLIENT_SECRET',
  'EBM_OAUTH_REDIRECT_URI',
  'EBM_TOKEN_ENCRYPTION_KEY',
  'EBM_CONNECT_RETURN_URL',
  'EBM_LIVE_SINCE',
] as const;

const DEFAULT_TIMEOUT_MS = 20_000;

/** Plain http is tolerated only against this machine, for a local provider. */
function isLoopback(url: URL): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

function mustBeUrl(name: string, value: string, problems: string[]): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback(url))) {
      // The bearer tokens and the client secret ride these requests. Sending
      // them in clear text to anything but this machine is a leak by design.
      problems.push(`${name} must be https (http is allowed only for localhost), got ${url.protocol}//${url.host}`);
      return null;
    }
    return url;
  } catch {
    problems.push(`${name} is not a URL`);
    return null;
  }
}

export function resolveEbmLiveConfig(
  env: Record<string, string | undefined> = process.env,
): EbmLiveConfig {
  const value = (key: string): string => env[key]?.trim() ?? '';
  const missing = EBM_ENV_KEYS.filter((key) => !value(key));
  if (missing.length > 0) {
    throw new Error(
      `VSDC_ADAPTER_MODE=live needs ${missing.join(', ')}. ` +
        'See server/api/.env.example and ADR-041.',
    );
  }

  const problems: string[] = [];
  const base = mustBeUrl('EBM_API_BASE_URL', value('EBM_API_BASE_URL'), problems);
  mustBeUrl('EBM_OAUTH_REDIRECT_URI', value('EBM_OAUTH_REDIRECT_URI'), problems);
  mustBeUrl('EBM_CONNECT_RETURN_URL', value('EBM_CONNECT_RETURN_URL'), problems);

  const rawTimeout = value('EBM_API_TIMEOUT_MS');
  const timeoutMs = rawTimeout ? Number(rawTimeout) : DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    problems.push('EBM_API_TIMEOUT_MS must be an integer between 1000 and 120000');
  }

  const liveSince = new Date(value('EBM_LIVE_SINCE'));
  if (Number.isNaN(liveSince.getTime()) || !/^\d{4}-\d{2}-\d{2}/.test(value('EBM_LIVE_SINCE'))) {
    problems.push('EBM_LIVE_SINCE must be an ISO date or instant, e.g. 2026-09-11T00:00:00+02:00');
  }

  let cipher: TokenCipher | null = null;
  try {
    cipher = TokenCipher.fromEnv(value('EBM_TOKEN_ENCRYPTION_KEY'));
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }

  if (problems.length > 0 || !base || !cipher) {
    throw new Error(`EBM live configuration is invalid: ${problems.join('; ')}`);
  }

  return {
    api: {
      baseUrl: base.toString().replace(/\/+$/, ''),
      clientId: value('EBM_OAUTH_CLIENT_ID'),
      clientSecret: value('EBM_OAUTH_CLIENT_SECRET'),
      redirectUri: value('EBM_OAUTH_REDIRECT_URI'),
      timeoutMs,
    },
    cipher,
    connectReturnUrl: value('EBM_CONNECT_RETURN_URL'),
    liveSince,
  };
}
