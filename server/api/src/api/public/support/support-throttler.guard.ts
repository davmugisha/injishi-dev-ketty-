import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerOptions } from '@nestjs/throttler';

/**
 * Rate limits for the public support intake, on the existing throttler.
 *
 * A write anybody can call with no session is a cannon aimed at the admin
 * moderation queue, so it is limited on TWO keys at once and a request must be
 * under both:
 *
 * - PER CLIENT (address): 10 an hour. Stops one machine rotating through
 *   invented email addresses. Ten rather than three because a hotel lobby or a
 *   campus sits behind one shared address, and several real people there may
 *   need help in the same hour.
 * - PER EMAIL: 3 an hour. Stops a flood that rotates addresses (a botnet, a
 *   proxy list) but writes as one person, or targets one person's name. Three
 *   covers someone who sends, spots a mistake and sends again, and a follow-up.
 *
 * Together they cap one source at 240 tickets a day and one address at 72.
 * They do NOT stop a flood that rotates both at once; that needs a challenge
 * (captcha) and is not built.
 *
 * WHY NOT `ThrottlerModule.forRoot`: that list is shared with every controller
 * that opts into a throttler guard, so a bucket added there would silently
 * throttle `POST /bookings` too, and the existing `money` bucket (5 a minute)
 * would apply here, where it means nothing. This guard swaps in its own two
 * buckets after the base class has initialised, and keeps everything else the
 * mechanism does: the same storage, the same 429, the same headers.
 *
 * Two caveats a deploy must know about:
 * - The address is `req.ip`, which the adapter resolves through `TRUST_PROXY`
 *   (`shared/config/trust-proxy.ts`). Behind a reverse proxy with that unset,
 *   every visitor shares the proxy's address and the per-client bucket becomes
 *   ONE bucket for everybody; each deploy compose file sets it for its chain.
 * - Storage is the throttler's default, in process memory, so each API
 *   instance counts on its own. Two instances double both limits.
 */

const HOUR_MS = 60 * 60_000;

/** The part of the request the trackers read. Guards run before pipes, so the body is raw. */
interface RawRequest {
  ip?: string;
  body?: unknown;
}

function clientOf(req: RawRequest): string {
  return req.ip ?? 'unknown';
}

/**
 * The key one mailbox is counted under.
 *
 * Lower-cased and trimmed to match what the contract stores, and a `+tag`
 * is dropped, because `a+1@x.rw`, `a+2@x.rw`, … all deliver to one inbox and
 * would otherwise be a fresh bucket each. The stored address keeps its tag —
 * this normalises the COUNT, not the reply address.
 *
 * A body with no usable email is counted against the client instead: it will
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

export const SUPPORT_THROTTLERS: ThrottlerOptions[] = [
  {
    name: 'support-client',
    limit: 10,
    ttl: HOUR_MS,
    getTracker: (req) => clientOf(req),
  },
  {
    name: 'support-email',
    limit: 3,
    ttl: HOUR_MS,
    getTracker: (req) => mailboxOf(req),
  },
];

@Injectable()
export class SupportThrottlerGuard extends ThrottlerGuard {
  override async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = SUPPORT_THROTTLERS;
  }
}
