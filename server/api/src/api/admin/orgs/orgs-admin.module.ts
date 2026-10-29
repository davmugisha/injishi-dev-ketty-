import { Module } from '@nestjs/common';

import { OrganizationModule } from '../../../modules/organization/organization.module';
import { AdminSharedModule } from '../admin-shared.module';
import { AdminBrokerActionsService } from '../brokers/broker-actions.service';
import { AdminBrokerPlansService } from '../brokers/broker-plans-admin.service';
import { AdminBrokersController } from '../brokers/brokers.controller';
import { AdminBrokersService } from '../brokers/brokers.service';
import { AdminOrgActionsService } from './org-actions.service';
import { AdminOrgsController } from './orgs.controller';
import { AdminOrgsService } from './orgs.service';

/**
 * Businesses and Brokers — sections 2 and 4 of the admin console.
 *
 * ONE module for two controllers because `admin-api.module.ts` imports exactly
 * one name per area, and the two belong to one area: a broker is how a
 * residence business finds a tenant, and staff move between the two screens
 * without changing what they are doing.
 *
 * `AdminSharedModule` supplies what the guard PAIR every controller here
 * declares needs — `AUTH_INSTANCE` for `SessionGuard`, `WorkspaceService` for
 * `StaffGuard`. Without either the whole area fails to boot rather than failing
 * open, which is the right way round for a missing security dependency.
 * `DatabaseModule` is `@Global`, so `DRIZZLE` resolves in every service here
 * without being imported.
 *
 * `OrganizationModule` is imported for ONE export, `RegistrationService`, which
 * the TIN re-check calls. That is the admin rule working as written: this area
 * may cross into a domain module through its application service and never
 * through its repository or its RRA adapter, neither of which that module
 * exports.
 *
 * The services are provided, not exported. Nothing outside this area should
 * read or change a business through the admin services — the domain modules own
 * that, and an admin service that grows a second caller stops being an admin
 * service.
 */
@Module({
  imports: [AdminSharedModule, OrganizationModule],
  controllers: [AdminOrgsController, AdminBrokersController],
  providers: [
    AdminOrgsService,
    AdminOrgActionsService,
    AdminBrokersService,
    AdminBrokerActionsService,
    AdminBrokerPlansService,
  ],
})
export class OrgsAdminModule {}
