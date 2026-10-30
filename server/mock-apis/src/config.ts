import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Everything the mock server reads from its environment, read once at boot.
 *
 * CREDENTIALS. Each provider authenticates the way the real one is expected
 * to (GTBank a client credentials token, RRA an API key, Smile ID a signed
 * request), so the API's sandbox adapters exercise the same code a live
 * provider will. All of them derive from ONE shared secret,
 * `MOCK_APIS_SECRET`, which the API reads under the same name: two variables
 * (`MOCK_APIS_URL` and the secret) are the whole of a laptop's sandbox setup.
 * The defaults are public on purpose. Nothing behind them is real.
 *
 * The API holds a copy of `DEFAULT_SECRET` and of `sandboxCredentials` in
 * `server/api/src/shared/config/mock-apis.ts`. The two never import each
 * other (they meet over HTTP only), so a change here is a change there.
 */

export const SERVICE_NAME = 'injishi-mock-apis';
export const DEFAULT_PORT = 8100;
export const DEFAULT_SECRET = 'injishi-mock-apis-dev-secret';

export interface ProviderCredentials {
  gtbank: { clientId: string; clientSecret: string; webhookSecret: string };
  rra: { apiKey: string };
  smileId: { partnerId: string; apiKey: string };
}

/** The credentials every provider expects, from the one shared secret. */
export function sandboxCredentials(secret: string): ProviderCredentials {
  return {
    gtbank: { clientId: 'injishi-sandbox', clientSecret: secret, webhookSecret: secret },
    rra: { apiKey: secret },
    smileId: { partnerId: '1001', apiKey: secret },
  };
}

export interface Timing {
  /** How long a default wallet takes to approve a Request to Pay. */
  momoApprovalMs: number;
  /** A `1111` wallet: pending this long, then paid. */
  slowMs: number;
  /** A `7777` wallet: paid, then reversed this long after. */
  reversalAfterMs: number;
  /** A `9999` wallet: approves only after this long, past the prompt window. */
  lateApprovalMs: number;
  /** An `8888` wallet: the request is held this long before any answer. */
  hangMs: number;
  /** How long a Smile ID job takes to complete. */
  smileJobMs: number;
}

export interface MockApisConfig {
  host: string;
  port: number;
  /** Where clients reach this server: the upload URL Smile ID hands back is built on it. */
  publicUrl: string;
  /** Where runtime state and added register rows are kept; null keeps them in memory only. */
  dataDir: string | null;
  secret: string;
  credentials: ProviderCredentials;
  timing: Timing;
}

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function whole(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a whole number of milliseconds or a port, got "${raw}".`);
  }
  return value;
}

/** Read and check the environment. Throws on anything unreadable, as the API's seams do. */
export function readConfig(env: NodeJS.ProcessEnv = process.env): MockApisConfig {
  // An empty value is unset: a compose file passes `${VAR:-}` as an empty string.
  const host = (env.MOCK_APIS_HOST ?? '').trim() || '127.0.0.1';
  const port = whole(env, 'MOCK_APIS_PORT', DEFAULT_PORT);
  const secret = (env.MOCK_APIS_SECRET ?? '').trim() || DEFAULT_SECRET;
  if (secret.length < 16) {
    throw new Error('MOCK_APIS_SECRET must be at least 16 characters.');
  }
  const publicUrl = ((env.MOCK_APIS_PUBLIC_URL ?? '').trim() || `http://localhost:${port}`).replace(/\/+$/, '');
  const dataSetting = (env.MOCK_APIS_DATA_DIR ?? '').trim();
  const dataDir =
    dataSetting.toLowerCase() === 'memory'
      ? null
      : dataSetting === ''
        ? path.join(PACKAGE_ROOT, '.data')
        : path.resolve(dataSetting);
  return {
    host,
    port,
    publicUrl,
    dataDir,
    secret,
    credentials: sandboxCredentials(secret),
    timing: {
      momoApprovalMs: whole(env, 'MOCK_MOMO_APPROVAL_MS', 6_000),
      slowMs: whole(env, 'MOCK_MOMO_SLOW_MS', 60_000),
      reversalAfterMs: whole(env, 'MOCK_MOMO_REVERSAL_MS', 120_000),
      // The API's prompt window (PAYMENT_PROMPT_TTL_SECONDS, 180) plus 20 s,
      // the in-process mock's figure under the same variable name.
      lateApprovalMs: whole(env, 'MOCK_MOMO_LATE_APPROVAL_MS', 200_000),
      hangMs: whole(env, 'MOCK_MOMO_HANG_MS', 30_000),
      smileJobMs: whole(env, 'MOCK_SMILE_JOB_MS', 1_500),
    },
  };
}
