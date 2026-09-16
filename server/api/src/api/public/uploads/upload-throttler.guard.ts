import { Injectable, type ExecutionContext } from '@nestjs/common';
import {
  ThrottlerException,
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerOptions,
} from '@nestjs/throttler';

/**
 * Rate limits for the three upload routes (`POST /uploads`,
 * `/uploads/certificate`, `/uploads/property-photo`).
 *
 * Each accepts up to 8 to 10 MB from anyone holding a session, straight into
 * object storage, and before this guard nothing counted them. One scripted
 * account could fill the bucket and the disk behind it.
 *
 * KEYED ON THE PERSON, like `UserThrottlerGuard`: the routes sit behind
 * `SessionGuard`, which runs first, so a user id is always there. A hotel
 * lobby's shared address is not one bucket, and changing networks does not
 * reset anybody's count. The address is only the fallback for a route that
 * forgot the session guard, which should not exist.
 *
 * TWO BUCKETS, and a request must be under both:
 *
 * - `uploads-user`: 30 in 10 minutes ACROSS ALL THREE ROUTES. One budget, not
 *   thirty per route, so a flood cannot triple itself by alternating routes.
 *   Thirty covers the heaviest honest burst: an operator adding a property's
 *   photo gallery in one sitting, or a phone flushing an offline queue of fault
 *   and check-in photographs after regaining signal.
 * - `uploads-certificate`: 10 in 10 minutes on the certificate route only. A
 *   business registers with one or two documents, and a person who picks the
 *   wrong file and replaces it a few times is still far under ten. Property
 *   photos get NO lower cap of their own: a gallery is exactly the burst the
 *   shared budget is sized for, and a lower one would refuse it.
 *
 * Once over, the bucket stays blocked for its whole window (the throttler's
 * default block duration is the ttl), and `Retry-After` says for how long.
 *
 * ITS OWN BUCKETS, not `ThrottlerModule.forRoot`, for the reason
 * `SupportThrottlerGuard` records: that list is shared with every controller
 * opting into a throttler guard, and the `money` bucket would apply here.
 *
 * Storage is the throttler's default, in process memory, so each API instance
 * counts on its own. Two instances double both limits.
 */

const TEN_MINUTES_MS = 10 * 60_000;

export const UPLOAD_LIMIT_PER_WINDOW = 30;
export const CERTIFICATE_LIMIT_PER_WINDOW = 10;
export const UPLOAD_WINDOW_MS = TEN_MINUTES_MS;

interface RawRequest {
  user?: { id?: string };
  ip?: string;
}

function uploaderOf(req: RawRequest): string {
  if (req.user?.id) return `user:${req.user.id}`;
  return `ip:${req.ip || 'unknown'}`;
}

/**
 * The storage key for one bucket and one person. The base class prefixes the
 * controller and handler names, which would give every route its own count;
 * leaving them out is what makes `uploads-user` one budget across the routes.
 * The bucket name stays in, because the storage blocks a KEY, and two buckets
 * sharing one would block each other.
 */
function keyFor(_context: ExecutionContext, tracker: string, name: string): string {
  return `${name}:${tracker}`;
}

export const UPLOAD_THROTTLERS: ThrottlerOptions[] = [
  {
    name: 'uploads-user',
    limit: UPLOAD_LIMIT_PER_WINDOW,
    ttl: UPLOAD_WINDOW_MS,
    getTracker: (req) => uploaderOf(req),
    generateKey: keyFor,
  },
  {
    // Skipped on the two other routes with `@SkipThrottle`, so a new upload
    // route that forgets to say which caps apply gets the stricter one.
    name: 'uploads-certificate',
    limit: CERTIFICATE_LIMIT_PER_WINDOW,
    ttl: UPLOAD_WINDOW_MS,
    getTracker: (req) => uploaderOf(req),
    generateKey: keyFor,
  },
];

/** What a refused upload says. Readable, and names when to try again. */
export function uploadRefusalMessage(secondsLeft: number): string {
  const minutes = Math.max(1, Math.ceil(secondsLeft / 60));
  return `Too many uploads in a short time. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

@Injectable()
export class UploadThrottlerGuard extends ThrottlerGuard {
  override async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = UPLOAD_THROTTLERS;
  }

  protected override async throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new ThrottlerException(uploadRefusalMessage(detail.timeToBlockExpire));
  }
}
