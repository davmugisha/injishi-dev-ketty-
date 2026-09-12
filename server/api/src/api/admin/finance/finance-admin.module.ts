import { Module } from '@nestjs/common';

import { AdminSharedModule } from '../admin-shared.module';
import { AdminConfigurationController } from '../configuration/configuration.controller';
import { ConfigurationAdminService } from '../configuration/configuration.service';
import { AdminFinanceController } from './finance.controller';
import { FinanceAdminService } from './finance.service';

/**
 * Finance AND Configuration — one module for two sections, on purpose.
 *
 * `admin-api.module.ts` imports exactly one name per area, so an area that
 * exported two modules would need that file edited twice by two different
 * pieces of work. It is written once and imports four names; this is the one
 * for this area, and it carries the configuration controller with it because
 * the fee catalog and the ledger are read by the same finance staffer from the
 * same screen group. `FinanceAdminModule` is therefore the name, and the
 * directory it lives in is the one the branch was told to look in.
 *
 * `AuthModule` is imported so `SessionGuard` can resolve `AUTH_INSTANCE` — a
 * guard with no auth instance fails at request time, not at boot, which is the
 * worst moment to find out. `WorkspaceService` is provided because `StaffGuard`
 * depends on it: it is the ONE reader of `admin_users`, the same one
 * `/api/v1/me/staff` calls, and its `isNull(revokedAt)` predicate is exactly
 * the clause a second copy would forget. `DatabaseModule` is `@Global`, so
 * `DRIZZLE` resolves in both services without being imported here.
 */
@Module({
  imports: [AdminSharedModule],
  controllers: [AdminFinanceController, AdminConfigurationController],
  providers: [FinanceAdminService, ConfigurationAdminService],
})
export class FinanceAdminModule {}
