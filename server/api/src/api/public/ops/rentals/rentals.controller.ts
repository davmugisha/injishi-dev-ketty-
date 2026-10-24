import {
  LeaseDefaultsRequest,
  SignatoryRequest,
  type LandlordProfileView,
  type RentalsSetupView,
} from '@injishi/contracts';
import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import { RentalsProfileService } from '../../../../modules/rentals/application/rentals-profile.service';
import type { ScopedWorkspace } from '../../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  WorkspaceGuard,
} from '../../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../../shared/validation/zod-validation.pipe';

/**
 * The landlord's rentals profile and setup → /api/v1/ops/rentals (blueprint
 * 2.3, "Overview and settings"). Residence businesses only: any other answers
 * 404 from the service.
 *
 * The reads admit anyone who works the rentals side (the leases, the units,
 * the listing or the money); the lease defaults are `lease.manage`'s, and who
 * signs leases for the business is `lease.sign`'s, the owner's by default,
 * because the contract binds the business in that person's name.
 */
@Controller({ path: 'ops/rentals', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsRentalsController {
  constructor(private readonly profiles: RentalsProfileService) {}

  @Get('profile')
  @RequireAnyPermission('lease.manage', 'unit.manage', 'listing.manage', 'money.view', 'rent.record', 'deposit.return', 'payout.manage', 'lease.sign')
  profile(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<LandlordProfileView> {
    return this.profiles.profile(workspace);
  }

  @Put('profile/lease-defaults')
  @RequirePermission('lease.manage')
  leaseDefaults(
    @Body(new ZodValidationPipe(LeaseDefaultsRequest)) body: LeaseDefaultsRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<LandlordProfileView> {
    return this.profiles.setLeaseDefaults(workspace, body);
  }

  @Put('profile/signatory')
  @RequirePermission('lease.sign')
  signatory(
    @Body(new ZodValidationPipe(SignatoryRequest)) body: SignatoryRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LandlordProfileView> {
    return this.profiles.setSignatory(workspace, user.id, body);
  }

  @Get('setup')
  @RequireAnyPermission('lease.manage', 'unit.manage', 'listing.manage', 'money.view', 'rent.record', 'deposit.return', 'payout.manage', 'lease.sign')
  setup(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<RentalsSetupView> {
    return this.profiles.setup(workspace);
  }
}
