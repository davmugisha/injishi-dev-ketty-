import { Module } from '@nestjs/common';

import { FinanceAdminModule } from './finance/finance-admin.module';
import { OrgsAdminModule } from './orgs/orgs-admin.module';
import { PlatformAdminModule } from './platform/platform-admin.module';
import { TrainingAdminModule } from './training/training-admin.module';
import { UsersAdminModule } from './users/users-admin.module';
import { WaitlistAdminModule } from './waitlist/waitlist-admin.module';

/**
 * Admin API. May cross module boundaries, but only through application
 * services - never by importing a domain module's internals. Every mutation
 * writes an audit event; every PII read is reason-gated and logged.
 *
 * This was an empty `@Module({})` for the whole life of the admin console,
 * which is why that console rendered every screen from a fixture file and made
 * exactly one network call in the entire app. The four modules below are the
 * 30 routes behind its 14 sections.
 *
 * They are split by area rather than by table because the console is navigated
 * by area, and because four modules can be built and verified independently.
 * Each one owns its controllers and services and imports `AdminSharedModule`
 * for the two things every guarded admin route needs.
 *
 * WHAT IS STILL TRUE OF THIS SURFACE, AND MUST STAY TRUE:
 *
 *   - Every WRITE writes an audit event. Six routes mutate — suspend and
 *     reinstate a business, retry a TIN check, suspend a broker, revoke a
 *     user's sessions, re-issue a claim code — and each commits exactly one
 *     `audit_events` row in the same transaction as its change, so there is no
 *     change without a record and no record without a change. The one
 *     exception is the TIN re-check, which goes through
 *     `RegistrationService.runTinCheck` and commits on its own connection; it
 *     writes its audit row only after a new evidence row appears. A new `@Post`
 *     here owes the same, and `injishi/require-permission-on-guarded-route`
 *     refuses one that declares no staff permission.
 *   - Role grants and money overrides are NOT here and must not be added as
 *     single-signer routes: ADR-012 requires a second super_admin for both.
 *   - Every PII read is reason-gated. `GET /admin/users` and
 *     `GET /admin/orgs/obo` refuse without a written reason and write a
 *     `record_access_logs` row. A new route that returns identity data owes
 *     both, and no lint rule enforces it today
 *     (`tools/eslint-rules/require-permission-on-guarded-route.mjs` keys on a
 *     guard name that does not exist — see its header).
 *   - `StaffGuard` is the boundary. Nav hiding in the console is an
 *     affordance; this is the control.
 */
@Module({
  imports: [
    OrgsAdminModule,
    UsersAdminModule,
    FinanceAdminModule,
    PlatformAdminModule,
    // ADR-048, deleted whole at launch.
    WaitlistAdminModule,
    // ADR-049. The first area whose routes a NON-platform staff role reaches:
    // `trainer` holds `training.*` and no `admin.*` power at all.
    TrainingAdminModule,
  ],
})
export class AdminApiModule {}
