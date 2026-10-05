import { Injectable, type ExecutionContext } from '@nestjs/common';
import {
  ThrottlerException,
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerOptions,
} from '@nestjs/throttler';

/**
 * Rate limits for the kiosk routes (ADR-058, 058-time AC-TM10).
 *
 * - `kiosk-punch`: 30 PIN attempts a minute PER KIOSK, keyed on the kiosk the
 *   device cookie resolved (`KioskGuard` runs first). It is what stops a
 *   person at a tablet walking the employee numbers with a guessed PIN; the
 *   per person lock stops the guessing of one person's PIN.
 * - `kiosk-pair`: 10 pairing attempts in 10 minutes per ADDRESS. A pairing
 *   code is 8 digits and lives ten minutes, so ten tries leave a guesser one
 *   chance in ten million.
 *
 * Their own buckets, not `ThrottlerModule.forRoot`, for the reason
 * `UploadThrottlerGuard` records: that list is shared with every controller
 * opting into a throttler guard. Each route skips the bucket that is not its
 * own. Storage is the throttler's default, in process memory, so each API
 * instance counts on its own.
 */

export const KIOSK_PUNCHES_PER_MINUTE = 30;
export const KIOSK_PAIRS_PER_WINDOW = 10;

interface RawRequest {
  kiosk?: { id?: string };
  ip?: string;
}

function keyFor(_context: ExecutionContext, tracker: string, name: string): string {
  return `${name}:${tracker}`;
}

export const KIOSK_THROTTLERS: ThrottlerOptions[] = [
  {
    name: 'kiosk-punch',
    limit: KIOSK_PUNCHES_PER_MINUTE,
    ttl: 60_000,
    getTracker: (req: RawRequest) => (req.kiosk?.id ? `kiosk:${req.kiosk.id}` : `ip:${req.ip || 'unknown'}`),
    generateKey: keyFor,
  },
  {
    name: 'kiosk-pair',
    limit: KIOSK_PAIRS_PER_WINDOW,
    ttl: 10 * 60_000,
    getTracker: (req: RawRequest) => `ip:${req.ip || 'unknown'}`,
    generateKey: keyFor,
  },
];

@Injectable()
export class KioskThrottlerGuard extends ThrottlerGuard {
  override async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = KIOSK_THROTTLERS;
  }

  protected override async throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const seconds = Math.max(1, Math.ceil(detail.timeToBlockExpire));
    throw new ThrottlerException(`Too many tries on this kiosk. Wait ${seconds} second${seconds === 1 ? '' : 's'} and try again.`);
  }
}
