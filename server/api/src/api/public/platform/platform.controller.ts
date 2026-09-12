import { Controller, Get, Header, Inject } from '@nestjs/common';
import { PlatformInfo } from '@injishi/contracts';

import { databaseIdentity } from '../../../database/drizzle/schema';
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
 * nothing to read and it is null.
 */
@Controller('platform')
export class PlatformController {
  constructor(
    @Inject(PLATFORM) private readonly platform: Platform,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  async read(): Promise<PlatformInfo> {
    const seededAt = this.platform.sampleData ? await this.seededAt() : null;
    return PlatformInfo.parse({
      environment: this.platform.environment,
      sampleData: this.platform.sampleData,
      seededAt: seededAt?.toISOString() ?? null,
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
