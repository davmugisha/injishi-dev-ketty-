import { Module } from '@nestjs/common';

import { AuthModule } from '../../../modules/auth/auth.module';
import { GuestsModule } from '../../../modules/guests/guests.module';
import { RentalsModule } from '../../../modules/rentals/rentals.module';
import { TwoFactorService } from '../../../shared/auth/two-factor.service';
import { WorkspaceService } from '../../../shared/auth/workspace.service';
import { OpsGuestsController } from './landlord-guests.controller';
import { OversightGuestsController } from './leader-guests.controller';
import { GuestReferenceController, TenantGuestsController } from './tenant-guests.controller';

/**
 * The guest routes (P5): a tenant's guests (`/me/tenancies/:leaseId/guests`),
 * a landlord's own (`/ops/guests`), the local leader's console and reports
 * (`/oversight/guests`), and the form's reference lists (`/reference/*`).
 *
 * `AuthModule` for `SessionGuard`; `RentalsModule` for `TenancyGuard`'s
 * `TenanciesService`; `WorkspaceService` and `TwoFactorService`
 * for `WorkspaceGuard` and `OversightGuard`, provided here as
 * `PublicApiModule` provides them for its own controllers.
 */
@Module({
  imports: [AuthModule, GuestsModule, RentalsModule],
  controllers: [TenantGuestsController, OpsGuestsController, OversightGuestsController, GuestReferenceController],
  providers: [WorkspaceService, TwoFactorService],
})
export class GuestsPublicModule {}
