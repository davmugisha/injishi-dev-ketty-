import { isProduction } from './security.config';
import { parseOrigin } from './web-url';

/**
 * The app's public origin (apps/app: app.injishi.com, :3002 on a laptop), for a
 * mail the API sends that opens a page in the app: a lease invitation, a
 * tenant's lease, a landlord's lease record (rentals, WP 1.5b). The app is
 * where people sign in and work; web (`WEB_URL`) is the marketing site.
 *
 * Each deployed stack sets it from the same `APP_HOST` the app is served on.
 * Production refuses to boot without it, as it does without `WEB_URL`: a mail
 * that links to `localhost` from production is a dead end for every tenant.
 */

/** The app on a laptop, which is what every link points at outside production. */
export const DEV_APP_URL = 'http://localhost:3002';

export interface AppUrlEnv {
  appUrl?: string;
  nodeEnv?: string;
}

/** Validate `APP_URL` into an origin with no trailing slash, or throw naming the variable. */
export function resolveAppUrl(env: AppUrlEnv): string {
  const raw = env.appUrl?.trim();
  if (!raw) {
    if (isProduction(env.nodeEnv)) {
      throw new Error(
        'APP_URL is required when NODE_ENV=production: without it a mail cannot ' +
          "link to a page in the app. Set it to the app's public origin, e.g. " +
          'https://app.injishi.com.',
      );
    }
    return DEV_APP_URL;
  }
  return parseOrigin('APP_URL', raw, 'https://app.injishi.com');
}
