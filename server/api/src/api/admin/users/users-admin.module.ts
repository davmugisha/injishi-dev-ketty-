import { Module } from '@nestjs/common';

import { AdminSharedModule } from '../admin-shared.module';
import { AdminGovernanceRepository } from '../governance/admin-governance.repository';
import { AdminAuditController } from '../governance/audit.controller';
import { AdminAuditService } from '../governance/audit.service';
import { AdminComplianceController } from '../governance/compliance.controller';
import { AdminComplianceService } from '../governance/compliance.service';
import { AdminGovernmentBodiesController } from '../governance/government-bodies.controller';
import { GovernmentBodiesService } from '../governance/government-bodies.service';
import { AdminModerationController } from '../governance/moderation.controller';
import { AdminModerationService } from '../governance/moderation.service';
import { GuestsModule } from '../../../modules/guests/guests.module';
import { AdminUsersRepository } from './admin-users.repository';
import { AdminUsersService } from './admin-users.service';
import { AdminLocalLeadersController } from './local-leaders.controller';
import { LocalLeadersRepository } from './local-leaders.repository';
import { LocalLeadersService } from './local-leaders.service';
import { OversightGrantsService } from './oversight-grants.service';
import { RecordAccessService } from './record-access.service';
import { AdminUserActionsService } from './user-actions.service';
import { AdminUsersController } from './users.controller';

/**
 * Users, Compliance, Audit and Moderation of the admin API.
 *
 * ONE MODULE FOR FOUR CONTROLLERS ACROSS TWO FOLDERS, and the name says
 * `Users` because that is the name `admin-api.module.ts` imports. The fan-out
 * contract gives each area leaf exactly one exported module name so that four
 * leaves working at once never edit the same file; a second export from this
 * area would mean editing the branch-owned module to pick it up.
 *
 * The four sections belong together for a real reason and not just for the
 * wiring: the directory is where an identity is read, and Compliance, Audit and
 * Moderation are the three records of that reading being justified, logged and
 * acted on. `RecordAccessService` writes the rows `AdminAuditService` reads
 * back, so splitting them would put the two halves of one accountability loop
 * in modules that cannot see each other.
 *
 * `AuthModule` is imported because `SessionGuard` resolves `AUTH_INSTANCE` from
 * it, and `WorkspaceService` is provided because `StaffGuard` depends on it —
 * it is the ONE reader of `admin_users`, the same one `/api/v1/me/staff` calls,
 * so the console and the API can never be told different things about who is
 * staff. `DatabaseModule` is `@Global`, so `DRIZZLE` resolves without an import
 * here.
 *
 * NOT PROVIDED, AND RECORDED RATHER THAN HIDDEN: `TwoFactorService`.
 * `StaffGuard` does not yet call `assertSatisfied`, so nothing here needs it —
 * but `admin_users.two_factor_enrolled` exists precisely so staff can be held
 * to the same step-up rule operators and officers already are. When that guard
 * grows the check, this module has to provide the service or the API will fail
 * to boot. That is owed work, not done work.
 */
@Module({
  // GuestsModule: appointing a local leader hands them the guests waiting in
  // their area, and ending one hands current guests on (P5).
  imports: [AdminSharedModule, GuestsModule],
  controllers: [
    AdminUsersController,
    AdminComplianceController,
    AdminAuditController,
    AdminModerationController,
    // The government body catalogue (ADR-053, AC-G4). Here, beside the grants
    // that choose a body, because a retired body is refused at grant time.
    AdminGovernmentBodiesController,
    // Local leaders and officers (P5): every appointment, by email and area,
    // the guests waiting for a leader, and the coverage report.
    AdminLocalLeadersController,
  ],
  providers: [
    AdminUsersRepository,
    AdminUsersService,
    // The two Users writes (revoke sessions, reissue a claim code). Separate
    // from the PII reader so each successful write's audit row lives in one
    // short file rather than among the reads.
    AdminUserActionsService,
    // The oversight grant and revoke writes (ADR-053). Its own service rather
    // than a third method on `AdminUserActionsService`, because the two scope
    // conflict rules it enforces are the longest reasoning in this area and do
    // not belong among the session and claim-code writes.
    OversightGrantsService,
    LocalLeadersRepository,
    LocalLeadersService,
    RecordAccessService,
    AdminGovernanceRepository,
    AdminComplianceService,
    AdminAuditService,
    AdminModerationService,
    GovernmentBodiesService,
  ],
})
export class UsersAdminModule {}
