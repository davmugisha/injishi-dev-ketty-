import { isProduction } from './security.config';

/**
 * Web's public origin, for a mail the API sends that links to a page on web
 * (ADR-053, AC-R14). The owner claim invitation is the first; a staff invitation
 * will be the next, which is why this is an origin and not a claim template.
 *
 * Read in one place. The API had no other source for it: `NEXT_PUBLIC_WEB_URL`
 * is set only on the frontends, and `CORS_ORIGINS` lists web, apex and admin in
 * no promised order. Each deployed stack sets it from the same `WEB_HOST` its
 * frontends' `NEXT_PUBLIC_WEB_URL` uses; `infra/docker/DOKPLOY.md` owns the
 * values.
 *
 * Production refuses to boot without it, as it does without `SMTP_URL`: an API
 * that mails a link to `localhost` from production has sent every owner a dead
 * end while reporting itself healthy.
 */

/** Web on a laptop, which is what every link points at outside production. */
export const DEV_WEB_URL = 'http://localhost:3000';

export interface WebUrlEnv {
  webUrl?: string;
  nodeEnv?: string;
}

/**
 * Validate `WEB_URL` into an origin with no trailing slash, or throw naming the
 * variable. An absolute `http` or `https` URL with no path, query or fragment:
 * a path would be silently doubled by every link built on it.
 */
export function resolveWebUrl(env: WebUrlEnv): string {
  const raw = env.webUrl?.trim();
  if (!raw) {
    if (isProduction(env.nodeEnv)) {
      throw new Error(
        'WEB_URL is required when NODE_ENV=production: without it a mail cannot ' +
          'link to a page on web. Set it to web\'s public origin, e.g. ' +
          'https://www.injishi.com.',
      );
    }
    return DEV_WEB_URL;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      'WEB_URL is not a valid URL (expected an origin such as https://www.injishi.com).',
    );
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`WEB_URL must use http:// or https://, got "${url.protocol}//".`);
  }
  if ((url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
    throw new Error(
      'WEB_URL must be an origin with no path, query or fragment (e.g. https://www.injishi.com).',
    );
  }
  if (url.username || url.password) {
    throw new Error('WEB_URL may not carry credentials.');
  }
  return url.origin;
}
