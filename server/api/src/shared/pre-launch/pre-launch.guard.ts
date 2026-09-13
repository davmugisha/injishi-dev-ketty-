import {
  Injectable,
  NotFoundException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';

/**
 * Close the unauthenticated catalogue on the production API before launch
 * (ADR-048 AC-23, AC-24).
 *
 * WHY THIS EXISTS AT ALL. `apps/web` puts a waitlist in front of the
 * marketplace, and a wall the website honours and the API does not is not a
 * wall: without this, the whole fixture catalogue stays readable as JSON at
 * `api.injishi.com/api/v1/properties/slug/<slug>` by anyone who guesses one
 * URL. A cross-check of the design found exactly that hole.
 *
 * IT ANSWERS 404, NOT 403. A 403 confirms the resource exists, which is the one
 * fact this guard is here to withhold. To a stranger the route simply is not
 * there yet, which is also the truth.
 *
 * IT IS SCOPED BY HOST, the same technique and the same properties as the web
 * gate, and for the same reason: no flag, no environment variable, nothing that
 * can be left half-switched on one replica. On `localhost`, on staging and on
 * the demo host these routes answer normally, so local development of the
 * property and booking flows is untouched.
 *
 * WHAT IT DOES NOT DO. This is three endpoints named one by one, not a hardened
 * API. Any new unauthenticated public read added before launch needs adding to
 * the three `@UseGuards(PreLaunchGuard)` lines by hand, and nothing mechanical
 * will remind you. `WAITLIST-REMOVAL.md` is the only place that is written down.
 */

/**
 * The hosts on which the public catalogue is closed.
 *
 * A plain constant, not configuration, which is what lets this feature exist
 * with no environment variable. Launch day deletes the guard rather than
 * emptying this list.
 */
export const PRE_LAUNCH_HOSTS = ['api.injishi.com'] as const;

/**
 * Lower-cased with any `:port` stripped, so `API.Injishi.com` and
 * `api.injishi.com:443` both match. An IPv6 literal keeps its brackets and its
 * colons, which is why the port is cut from the last colon only when there is
 * no bracket to protect.
 */
export function normalizeHost(raw: string | undefined): string {
  if (!raw) return '';
  const host = raw.trim().toLowerCase();
  if (host.startsWith('[')) {
    const close = host.indexOf(']');
    return close === -1 ? host : host.slice(0, close + 1);
  }
  const colon = host.lastIndexOf(':');
  return colon === -1 ? host : host.slice(0, colon);
}

/** Whether this host is one the catalogue is closed on. */
export function isPreLaunchHost(raw: string | undefined): boolean {
  const host = normalizeHost(raw);
  return (PRE_LAUNCH_HOSTS as readonly string[]).includes(host);
}

@Injectable()
export class PreLaunchGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const raw = request.headers?.host;
    const host = Array.isArray(raw) ? raw[0] : raw;

    if (isPreLaunchHost(host)) {
      throw new NotFoundException();
    }
    return true;
  }
}
