import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerOptions } from '@nestjs/throttler';

/**
 * Rate limits for the public waitlist intake (ADR-048 AC-13).
 *
 * Built on the shape `SupportThrottlerGuard` proved, with one deliberate
 * difference that matters more here than anywhere else in the app.
 *
 * - PER CLIENT (address): 5 an hour. A launch page is a single form; nobody
 *   legitimately joins a waitlist five times in an hour, and a shared address
 *   (a hotel lobby, a campus) still has room for a handful of real people.
 * - PER MAILBOX: 2 an hour. Caps how fast the "you are already on the list"
 *   reply can be used to probe whether an address signed up. ADR-048 takes
 *   that tradeoff knowingly: the throttle narrows the hole, it does not close
 *   it.
 *
 * THE CLIENT KEY IS THE FORWARDED HEADER, NOT `req.ip`, and that is the whole
 * point of this file existing rather than reusing support's guard. The Fastify
 * adapter is built without `trustProxy`, so deployed behind Traefik every
 * request on earth carries the proxy's address: a tracker keyed on `req.ip`
 * collapses every visitor into ONE bucket and caps the entire launch page at
 * five signups an hour. Reading the leftmost `X-Forwarded-For` entry counts
 * people instead of counting Traefik.
 *
 * What that costs, stated plainly: a caller can forge `X-Forwarded-For` and
 * mint themselves a fresh client bucket. The mailbox bucket still holds, and
 * the contract still refuses a malformed body. The real fix is `trustProxy` on
 * the adapter, which is a repo-wide change with its own security question
 * (trusting a forwarded header from a source that is not the proxy), so it is
 * enrolled as its own feature rather than smuggled in here. `support-throttler.guard.ts`
 * still keys on `req.ip` and still has the defect this one routes around.
 *
 * Storage is the throttler's default, in process memory, so each API instance
 * counts on its own. At pre-launch volume that does not matter; it is recorded
 * so nobody rediscovers it.
 */

const HOUR_MS = 60 * 60_000;

/** The part of the request the trackers read. Guards run before pipes, so the body is raw. */
interface RawRequest {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

/**
 * The address this request came from, as far as it can be known.
 *
 * `X-Forwarded-For` is a comma-separated chain appended to by each hop, so the
 * LEFTMOST entry is the original client. Taking the last one would name the
 * proxy, which is the bug this function exists to avoid.
 */
function clientOf(req: RawRequest): string {
  const raw = req.headers?.['x-forwarded-for'];
  const chain = Array.isArray(raw) ? raw[0] : raw;
  const first = chain?.split(',')[0]?.trim();
  if (first) return first;
  return req.ip ?? 'unknown';
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
