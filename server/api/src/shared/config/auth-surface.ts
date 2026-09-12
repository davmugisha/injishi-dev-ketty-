/**
 * Which TRUST BOUNDARY a request belongs to (ADR-018, D-o).
 *
 * This used to be the second of two axes read from the request host. The first,
 * the platform environment, is now fixed per process (ADR-043,
 * `shared/config/platform.ts`), so the surface is the only thing a host still
 * decides. `AUTH_REGISTRY` builds an instance per surface.
 *
 * WHY A SURFACE RATHER THAN AN ENVIRONMENT. Environments separate DATA:
 * production and demo hold different rows in different databases. Surfaces
 * separate SESSIONS: the oversight console reads the same rows as everything
 * else, through the same guards, and what must not cross is the cookie. A
 * government officer reviewing an operator must not be holding a session that
 * operator's marketplace could have minted.
 *
 * ALLOWLIST ONLY, IN ONE DIRECTION. A host that matches the oversight list is
 * the oversight surface; everything else is the marketplace, exactly as today.
 * So an oversight instance can never be reached by accident, and no host that
 * works today changes meaning. The alternative, throwing on an unknown host,
 * was considered and rejected in D-o: it changes behaviour on a live path and
 * buys nothing once the console side is allowlist only.
 */
export type AuthSurface = 'marketplace' | 'oversight';

/** Strip the port and lowercase, so `oversight.injishi.rw:443` matches `oversight.injishi.rw`. */
export function normaliseHost(host: string | undefined | null): string {
  if (!host) return '';
  const trimmed = host.trim().toLowerCase();
  // IPv6 literals keep their brackets; everything else loses `:port`.
  if (trimmed.startsWith('[')) {
    const close = trimmed.indexOf(']');
    return close === -1 ? trimmed : trimmed.slice(0, close + 1);
  }
  const colon = trimmed.lastIndexOf(':');
  return colon === -1 ? trimmed : trimmed.slice(0, colon);
}

/** Pull the Host header off a raw request, tolerating the array form. */
export function hostFromHeaders(
  headers: Record<string, string | string[] | undefined> | undefined,
): string {
  const raw = headers?.host;
  return Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
}

export interface AuthSurfaceEnv {
  /** Comma separated hostnames the government console's API is served on. */
  oversightHostnames?: string;
}

/**
 * The hosts that resolve to the oversight surface.
 *
 * Empty means the console is unreachable, which is the correct posture when
 * nobody configured one. There is no default and there must not be: a default
 * here would make some ordinary host mint console sessions.
 */
export function resolveOversightHosts(env: AuthSurfaceEnv): string[] {
  return (env.oversightHostnames ?? '')
    .split(',')
    .map((host) => normaliseHost(host))
    .filter(Boolean);
}

/** Resolve one request's surface. Anything unlisted is the marketplace. */
export function resolveAuthSurface(
  host: string | undefined | null,
  oversightHosts: readonly string[],
): AuthSurface {
  if (oversightHosts.length === 0) return 'marketplace';
  return oversightHosts.includes(normaliseHost(host))
    ? 'oversight'
    : 'marketplace';
}

/**
 * Refuse to boot when the two surfaces would share a signing secret.
 *
 * THE FAILURE THIS PREVENTS IS SILENT. Equal secrets mean a marketplace cookie
 * verifies at the console and the reverse, so the whole boundary disappears and
 * nothing anywhere reports an error: every screen still loads, every queue still
 * renders, and an operator's own session opens the console that reviews them.
 * There is no test that fails and no log line that appears. So the check is at
 * boot, and it is fatal.
 *
 * It is one `.env` copy paste away, which is why it is not a comment.
 */
export function assertSurfaceSecretsDiffer(
  marketplaceSecret: string,
  oversightSecret: string,
): void {
  if (marketplaceSecret.trim() === oversightSecret.trim()) {
    throw new Error(
      'OVERSIGHT_AUTH_SECRET must differ from BETTER_AUTH_SECRET. ' +
        'Equal secrets let a marketplace session open the government console, ' +
        'and nothing else would report it (ADR-018, D-i).',
    );
  }
}
