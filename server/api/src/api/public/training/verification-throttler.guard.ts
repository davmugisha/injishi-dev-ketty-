import { Inject, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerOptions } from '@nestjs/throttler';

import {
  TRAINING_CONFIG,
  type TrainingConfig,
} from '../../../modules/training/domain/training-config';

/**
 * The per-IP limit on public certificate verification (AC-16).
 *
 * WHY THIS ENDPOINT NEEDS ONE AT ALL. It is the only route in the feature that
 * takes no session, and it answers a question about a secret: whether a token
 * names a real certificate. The token carries 160 bits, so guessing is
 * hopeless, and a limiter is what keeps it hopeless CHEAPLY rather than by
 * making the database absorb the guesses. The uniform response shape stops the
 * endpoint being an oracle; this stops it being a free one.
 *
 * KEYED ON THE ADDRESS, not on a person, because there is no person. That is
 * the opposite choice from `UserThrottlerGuard`, which keys on the user id
 * precisely so a shared office address is not one bucket, and the only reason
 * it differs here is that there is no id to key on.
 *
 * ITS OWN BUCKET, not one added to `ThrottlerModule.forRoot`. That list is
 * shared with every controller opting into a throttler guard, so a bucket added
 * there would silently apply to `POST /bookings` too. This is the pattern
 * `SupportThrottlerGuard` established next door, for the same reason.
 *
 * WHY THE CONFIG ARRIVES BY PROPERTY INJECTION, against this project's usual
 * preference for the constructor. `ThrottlerGuard`'s constructor signature
 * belongs to `@nestjs/throttler` and takes three of its own dependencies. To
 * add one through the constructor this class would have to re-declare all
 * three and forward them, which couples it to a library's internal shape and
 * breaks silently, at boot, the next time that library adds a parameter.
 * `@Inject` on a field asks Nest for one thing and leaves the base class's
 * wiring alone. `onModuleInit` runs after fields are populated, which is why
 * reading it there is safe.
 *
 * TWO CAVEATS A DEPLOY MUST KNOW, both inherited and both already recorded on
 * the support guard:
 *
 * - The address is `req.ip`, and the Fastify adapter is built without
 *   `trustProxy`. Behind a reverse proxy every visitor shares the proxy's
 *   address and this becomes ONE bucket for everybody, which would refuse real
 *   scans. Set `trustProxy` for the real proxy before this sits behind one.
 * - Storage is the throttler's default, in this process's memory, so each API
 *   instance counts on its own and two instances double the limit.
 */
@Injectable()
export class VerificationThrottlerGuard extends ThrottlerGuard {
  @Inject(TRAINING_CONFIG)
  private readonly training!: TrainingConfig;

  override async onModuleInit(): Promise<void> {
    await super.onModuleInit();

    const throttlers: ThrottlerOptions[] = [
      {
        name: 'training-verify',
        // From configuration, so the limit the ADR names
        // (`TRAINING_VERIFY_RATE_LIMIT`, default 30) is read in one place and
        // cannot be 30 here and something else in a comment.
        limit: this.training.verifyRateLimit,
        ttl: 60_000,
        getTracker: (req: { ip?: string }) => req.ip ?? 'unknown',
      },
    ];

    this.throttlers = throttlers;
  }
}
