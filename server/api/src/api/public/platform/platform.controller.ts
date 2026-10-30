import { Controller, Get, Header, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformInfo } from '@injishi/contracts';

import { databaseIdentity } from '../../../database/drizzle/schema';
import { googleCredentials } from '../../../modules/auth/auth.module';
import { CARD_PAYMENTS, PaymentSeam } from '../../../modules/pay/domain/payment-seam';
import { PLATFORM, type Platform } from '../../../shared/config/platform';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';

/**
 * `GET /api/v1/platform` (ADR-043, AC-16): which platform this deployment is.
 *
 * Public, like `/health`, because every client asks it before anyone signs in:
 * whether to show the demo code, the persona picker and the last reset time,
 * and whether a fixture money action may make up a `DEMO-` reference. It says
 * nothing a visitor to the demo could not already see.
 *
 * `environment` and `sampleData` are the boot values from `PLATFORM`.
 * `seededAt` is read per request (one primary key lookup), so a reseed run by
 * hand shows without a restart; a real database has no marker row, so there is
 * nothing to read and it is null. `googleSignIn` says whether the Google
 * provider is mounted, from the same rule the auth instance uses.
 * `integrations` and `paymentRules` tell a payment screen whether money is
 * real, off, or a test, and what to refuse before the payer presses pay
 * (073-gtbank-payments AC-2, AC-17, AC-23).
 */
@Controller('platform')
export class PlatformController {
  constructor(
    @Inject(PLATFORM) private readonly platform: Platform,
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly config: ConfigService,
    private readonly payments: PaymentSeam,
  ) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  async read(): Promise<PlatformInfo> {
    const seededAt = this.platform.sampleData ? await this.seededAt() : null;
    return PlatformInfo.parse({
      environment: this.platform.environment,
      sampleData: this.platform.sampleData,
      seededAt: seededAt?.toISOString() ?? null,
      // Always sent, null included: a client reads a missing key as "an API too
      // old to say" and a null as "a process that was never stamped", and those
      // are different answers to "which commit am I talking to?".
      commit: this.platform.commit,
      googleSignIn: googleCredentials(this.config) !== undefined,
      // Every client facing seam's effective mode (ADR-073 AC-5), from the one
      // reader of the payment settings until ADR-073's runtime exists
      // (073-gtbank-payments interim record). No card provider is chosen, so
      // card is off everywhere (AC-24).
      // `sandbox` is a test to a client, as `mock` is: GTBank's wire against
      // Injishi Mock APIs, with invented money.
      integrations: {
        payments: this.payments.mode === 'sandbox' ? 'mock' : this.payments.mode,
        card_payments: CARD_PAYMENTS,
      },
      paymentRules: this.payments.rules(),
    });
  }

  private async seededAt(): Promise<Date | null> {
    const [row] = await this.db
      .select({ seededAt: databaseIdentity.seededAt })
      .from(databaseIdentity)
      .limit(1);
    return row?.seededAt ?? null;
  }
}
