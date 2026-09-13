/**
 * How a public property photograph is addressed (ADR-053, owner ruling of
 * 2026-09-13).
 *
 * The bucket is private and an object key never leaves the API. A public read
 * carries this route's URL for each photograph instead, and the route answers
 * with a fresh short lived signed URL on every request, after checking the same
 * visibility rule the public read uses. So a page cached for hours never holds a
 * link that expires, and a suspension cuts every image on the next request.
 */

/** Where the route is mounted, under the API's own origin. */
export const PHOTO_ROUTE_PATH = '/api/v1/properties/photos';

/** How long the signed URL the route redirects to stays valid. */
export const PHOTO_SIGNED_URL_TTL_SECONDS = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether a path segment could be a photo id at all. */
export function isPhotoId(value: string): boolean {
  return UUID.test(value);
}

/**
 * The API's public origin, from `BETTER_AUTH_URL`.
 *
 * That variable is already the API's externally reachable address in every
 * environment (`https://api.injishi.com`, `https://api-demo.injishi.com`,
 * staging's `https://api.<domain>`), because Better Auth builds its own links on
 * it. Reading it here means a photo URL can never name a different host than the
 * one the API answers on. The fallback is the same one the auth module uses.
 */
export function apiPublicOrigin(env: {
  BETTER_AUTH_URL?: string;
  PORT?: string;
}): string {
  const configured = env.BETTER_AUTH_URL?.trim();
  const origin = configured || `http://localhost:${env.PORT ?? '8000'}`;
  return origin.replace(/\/+$/, '');
}

/** The stable public URL of one photograph. */
export function photoRouteUrl(origin: string, photoId: string): string {
  return `${origin}${PHOTO_ROUTE_PATH}/${photoId}`;
}
