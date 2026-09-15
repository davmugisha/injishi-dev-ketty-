import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerOptions } from '@nestjs/throttler';

/**
 * Rate limits for the public waitlist intake (ADR-048 AC-13).
 *
 * Built on the shape `SupportThrottlerGuard` proved.
 *
 * - PER CLIENT (address): 5 an hour. A launch page is a single form; nobody
 *   legitimately joins a waitlist five times in an hour, and a shared address
 *   (a hotel lobby, a campus) still has room for a handful of real people.
 * - PER MAILBOX: 2 an hour. Caps how fast the "you are already on the list"
 *   reply can be used to probe whether an address signed up. ADR-048 takes
 *   that tradeoff knowingly: the throttle narrows the hole, it does not close
 *   it.
 *
 * THE CLIENT KEY IS `req.ip`, and nothing here reads `X-Forwarded-For` by hand.
 * This guard used to take the LEFTMOST forwarded entry, because the adapter
 * trusted no proxy and behind Traefik every visitor shared one address. The
 * leftmost entry is the one the CALLER writes, so any client could mint itself
 * a fresh bucket per request. The adapter now resolves `req.ip` through
 * `TRUST_PROXY` (`shared/config/trust-proxy.ts`), which believes only the hops
 * the deploy names, so the address here is the one Traefik saw.
 *
 * Storage is the throttler's default, in process memory, so each API instance
 * counts on its own. At pre-launch volume that does not matter; it is recorded
 * so nobody rediscovers it.
 */

const HOUR_MS = 60 * 60_000;

/** The part of the request the trackers read. Guards run before pipes, so the body is raw. */
interface RawRequest {
  ip?: string;
  body?: unknown;
}

/**
 * The address this request came from, as Fastify resolved it under
 * `TRUST_PROXY`. Never re-derived from the forwarded header here: that would
 * undo the trust decision the adapter made.
 */
function clientOf(req: RawRequest): string {
  return req.ip || 'unknown';
}

/**
 * The key one mailbox is counted under.
 *
 * Lower-cased and trimmed to match what the contract stores, and a `+tag` is
 * dropped, because `a+1@x.rw`, `a+2@x.rw`, … all deliver to one inbox and
 * would otherwise be a fresh bucket each. The stored address keeps its tag:
 * this normalises the COUNT, not the address.
 *
 * A body with no usable email is counted against the client instead. It will
 * fail validation anyway, and a loop sending garbage is still a loop.
 */
function mailboxOf(req: RawRequest): string {
  const body = req.body;
  const raw =
    body && typeof body === 'object' && 'email' in body
      ? (body as { email?: unknown }).email
      : undefined;
  if (typeof raw !== 'string') return `no-email:${clientOf(req)}`;

  const email = raw.trim().toLowerCase().slice(0, 254);
  const at = email.lastIndexOf('@');
  if (at <= 0) return `no-email:${clientOf(req)}`;
  const local = email.slice(0, at).split('+')[0];
  return `email:${local}@${email.slice(at + 1)}`;
}

export const WAITLIST_THROTTLERS: ThrottlerOptions[] = [
  {
    name: 'waitlist-client',
    limit: 5,
    ttl: HOUR_MS,
    getTracker: (req) => clientOf(req),
  },
  {
    name: 'waitlist-email',
    limit: 2,
    ttl: HOUR_MS,
    getTracker: (req) => mailboxOf(req),
  },
];

@Injectable()
export class WaitlistThrottlerGuard extends ThrottlerGuard {
  override async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = WAITLIST_THROTTLERS;
  }
}
