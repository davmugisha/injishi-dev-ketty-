import { Injectable, Logger, type ExecutionContext } from '@nestjs/common';
import {
  ThrottlerException,
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerOptions,
} from '@nestjs/throttler';

/**
 * The public PSF path's own buckets (2026-10-19), by address, because nobody
 * on it is signed in. Its own list rather than `ThrottlerModule.forRoot`, for
 * the reason `UploadThrottlerGuard` records: that list is shared with every
 * controller opting into a throttler guard.
 *
 * The docID is a bearer key, so `psf-track` is what makes guessing one a
 * matter of years: 30 reads a minute per address against 2^40 docIDs.
 * Counts live in process memory, like every throttler here.
 */
interface RawRequest {
  ip?: string;
}
const clientOf = (req: RawRequest): string => `ip:${req.ip || 'unknown'}`;
const keyFor = (_context: ExecutionContext, tracker: string, name: string): string => `${name}:${tracker}`;

export const PSF_PUBLIC_THROTTLERS: ThrottlerOptions[] = [
  { name: 'psf-track', limit: 30, ttl: 60_000, getTracker: (req) => clientOf(req), generateKey: keyFor },
  { name: 'psf-form', limit: 30, ttl: 10 * 60_000, getTracker: (req) => clientOf(req), generateKey: keyFor },
  // A logo (2026-10-23): a file, so its own small budget rather than the form's.
  { name: 'psf-logo', limit: 10, ttl: 10 * 60_000, getTracker: (req) => clientOf(req), generateKey: keyFor },
];

/**
 * Development only: `PSF_PUBLIC_THROTTLE=off` lets one machine walk the form
 * and run the PSF verifiers as often as it likes. Ignored under
 * NODE_ENV=production, where these limits are what keep docIDs unguessable
 * and the ID check's SMS from being spent by a script.
 */
export function psfThrottleOff(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PSF_PUBLIC_THROTTLE === 'off' && env.NODE_ENV !== 'production';
}

@Injectable()
export class PsfPublicThrottlerGuard extends ThrottlerGuard {
  private readonly off = psfThrottleOff();

  override async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = PSF_PUBLIC_THROTTLERS;
    if (this.off) new Logger(PsfPublicThrottlerGuard.name).warn('PSF_PUBLIC_THROTTLE=off: the public PSF path is not rate limited (development only).');
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.off) return true;
    return super.canActivate(context);
  }

  protected override async throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const minutes = Math.max(1, Math.ceil(detail.timeToBlockExpire / 60));
    throw new ThrottlerException(`Too many tries in a short time. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
  }
}
