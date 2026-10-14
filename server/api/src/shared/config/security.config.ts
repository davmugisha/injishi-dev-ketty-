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

/** PIN pepper used when HR_PIN_PEPPER is unset outside a production platform. */
const DEV_PIN_PEPPER = 'dev-only-insecure-pin-pepper';

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
 * The server secret mixed into every kiosk PIN hash (ADR-058, 058-time
 * AC-TM11), so a leaked `employee_kiosk_pins` table alone cannot be brute
 * forced: a PIN is 4 to 6 digits, and without the pepper a million guesses
 * cover them all.
 *
 * Required only where real people's PINs live: a production process on the
 * production platform. The demo stack (its own platform, over a database that
 * was empty when it was marked sample, ADR-043) and a laptop fall back to a
 * fixed pepper, so neither needs one more secret to boot.
 */
export function resolvePinPepper(env: {
  nodeEnv?: string;
  environment: 'production' | 'demo';
  pinPepper?: string;
}): string {
  if (isProduction(env.nodeEnv) && env.environment === 'production') {
    return requireStrongSecret('HR_PIN_PEPPER', env.pinPepper);
  }
  return env.pinPepper?.trim() || DEV_PIN_PEPPER;
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
