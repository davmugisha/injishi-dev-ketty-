import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerOptions } from '@nestjs/throttler';

/**
 * Rate limit for an applicant's progress page (058-talent): 30 requests in 10 minutes per ADDRESS,
 * on the routes nobody signed in reaches. A code is six digits and allows five tries before it must
 * be sent again, so this bucket is what stops one address walking codes across many links.
 *
 * Its own bucket, not `ThrottlerModule.forRoot`, for the reason `KioskThrottlerGuard` records.
 */
const APPLICATION_THROTTLERS: ThrottlerOptions[] = [
  {
    name: 'application',
    limit: 30,
    ttl: 10 * 60_000,
    getTracker: (req: { ip?: string }) => `ip:${req.ip || 'unknown'}`,
    generateKey: (_context, tracker, name) => `${name}:${tracker}`,
  },
];

@Injectable()
export class ApplicationThrottlerGuard extends ThrottlerGuard {
  override async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = APPLICATION_THROTTLERS;
  }
}
