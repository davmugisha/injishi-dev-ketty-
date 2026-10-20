import { isIP } from 'node:net';

/**
 * Which proxy hops the API believes about the client's address (`TRUST_PROXY`).
 *
 * Every rate limit keyed on an address reads `request.ip`. Fastify fills that
 * from the socket unless it is told which hops in front of it may speak for the
 * client through `X-Forwarded-For`. Deployed, the socket is always Traefik, so
 * with nothing trusted every visitor on earth shares Traefik's address and the
 * per-client buckets (support, certificate verification) collapse into
 * ONE bucket for everybody. Trust too much, and any caller mints a fresh bucket
 * per request by typing a header.
 *
 * ONE setting, three shapes, and nothing broader:
 *
 * - unset, empty, `false`, `off` or `0`: trust nothing. `request.ip` is the
 *   socket, exactly what the API did before this setting existed.
 * - a hop count, `1` to `MAX_TRUSTED_HOPS`: trust that many proxies counted
 *   from the socket inward. `1` means "the socket peer is my proxy, and the
 *   address it appended is the client". Entries further left are what the client
 *   itself sent and are never believed.
 * - a comma separated list of IPs and CIDRs: trust a hop only when its address
 *   is in the list, walking right to left and stopping at the first stranger.
 *
 * `true` (trust every hop) is REFUSED, because it makes the leftmost entry, which
 * the caller writes, the client's address. So is anything that does not parse:
 * a typo must fail the boot, not quietly fall back to off or to everything.
 *
 * THE DEFAULT IS OFF, in every environment. Off can only under count (everyone
 * shares one bucket, which fails closed on abuse and loud on real traffic); a
 * wrong trust silently hands the key to the caller. The API cannot see what sits
 * in front of it, so the deploy that knows states it: each compose file sets
 * `TRUST_PROXY` to its own proxy chain (DOKPLOY.md). A laptop talks to the API
 * directly and needs nothing.
 */

/** A chain deeper than this is a misconfiguration, not a topology. */
export const MAX_TRUSTED_HOPS = 5;

/** What Fastify's `trustProxy` option is given. */
export type TrustProxy = false | number | string[];

const OFF = new Set(['', 'false', 'off', '0', 'no']);

export function resolveTrustProxy(raw: string | undefined): TrustProxy {
  const value = (raw ?? '').trim();
  const lowered = value.toLowerCase();

  if (OFF.has(lowered)) return false;

  if (lowered === 'true' || lowered === 'on' || lowered === 'yes') {
    throw new Error(
      'TRUST_PROXY=true would trust every hop, which lets any caller choose its own address. Set the hop count (e.g. 1) or the proxy addresses instead.',
    );
  }

  if (/^\d+$/.test(value)) {
    const hops = Number(value);
    if (hops < 1 || hops > MAX_TRUSTED_HOPS) {
      throw new Error(
        `TRUST_PROXY hop count must be between 1 and ${MAX_TRUSTED_HOPS}, got ${value}.`,
      );
    }
    return hops;
  }

  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const entry of entries) {
    if (!isAddressOrCidr(entry)) {
      throw new Error(
        `TRUST_PROXY entry "${entry}" is neither a hop count nor an IP address or CIDR.`,
      );
    }
  }
  return entries;
}

function isAddressOrCidr(entry: string): boolean {
  const slash = entry.indexOf('/');
  if (slash === -1) return isIP(entry) !== 0;

  const address = entry.slice(0, slash);
  const prefix = entry.slice(slash + 1);
  const family = isIP(address);
  if (family === 0 || !/^\d+$/.test(prefix)) return false;
  return Number(prefix) <= (family === 4 ? 32 : 128);
}
