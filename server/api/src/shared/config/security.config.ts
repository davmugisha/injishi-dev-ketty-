/**
 * Security-critical configuration, resolved in one place.
 *
 * The invariant: in production, a missing or weak security value is a startup
 * error - never a permissive default. Development keeps working defaults so the
 * stack runs from a clean checkout, but those defaults can never survive a
 * production boot.
 */

/** Origins the dev stack runs on (web :3000, admin :3001). */
const DEV_ORIGINS = [
  'http://localhost:3000', // web
  'http://localhost:3001', // admin
  'http://localhost:3002', // pms
];

/** Cookie signing secret used when COOKIE_SECRET is unset outside production. */
const DEV_COOKIE_SECRET = 'dev-only-insecure-cookie-secret';

/** Shortest secret accepted in production (32 bytes ~ `openssl rand -base64 32`). */
export const MIN_SECRET_LENGTH = 32;

export interface SecurityEnv {
  nodeEnv?: string;
  corsOrigins?: string;
  cookieSecret?: string;
}

export const isProduction = (nodeEnv?: string): boolean =>
  nodeEnv === 'production';

/**
 * The one allowlist of origins that may call this API with credentials. It
 * feeds both Fastify CORS and Better Auth's `trustedOrigins`, so the browser's
 * cross-origin check and the auth server's CSRF check can never disagree.
 *
 * Production demands an explicit list. Falling back to "reflect whatever Origin
 * you sent me" while `credentials: true` would let any website issue
 * authenticated requests against this API on a signed-in user's behalf.
 */
export function resolveAllowedOrigins(env: SecurityEnv): string[] {
  const origins = (env.corsOrigins ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length > 0) return origins;

  if (isProduction(env.nodeEnv)) {
    throw new Error(
      'CORS_ORIGINS is required in production - refusing to boot with a credentialed CORS policy that accepts any origin.',
    );
  }
  return [...DEV_ORIGINS];
}

/** Fastify's cookie signing secret. Production must supply a strong one. */
export function resolveCookieSecret(env: SecurityEnv): string {
  if (!isProduction(env.nodeEnv)) {
    return env.cookieSecret?.trim() || DEV_COOKIE_SECRET;
  }
  return requireStrongSecret('COOKIE_SECRET', env.cookieSecret);
}

/**
 * A secret strong enough to sign production sessions and cookies with. The
 * length floor is what rejects the short placeholders `.env.example` ships
 * (e.g. `dev-only-secret`) when someone copies it into a real deployment.
 */
export function requireStrongSecret(
  name: string,
  value: string | undefined,
): string {
  const secret = value?.trim() ?? '';
  if (!secret) {
    throw new Error(`${name} is required in production.`);
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${name} must be at least ${MIN_SECRET_LENGTH} characters in production - generate one with \`openssl rand -base64 32\`.`,
    );
  }
  return secret;
}
