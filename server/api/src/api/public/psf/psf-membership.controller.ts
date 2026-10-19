import {
  CreatePsfApplicationRequest,
  PayPsfMembershipRequest,
  PsfApproveRequest,
  PsfBusinessesQuery,
  PsfDeclineRequest,
  PsfQueueQuery,
  type OversightGrant,
  type PsfBusinessesPage,
  type PsfCatalogue,
  type PsfMembershipOverview,
  type PsfOfficerApplication,
  type PsfQueuePage,
  type PsfRegisterSummary,
  type PsfTier,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { PsfMembershipService } from '../../../modules/organization/application/psf-membership.service';
import {
  CurrentOversight,
  OversightGuard,
  RequireOversight,
} from '../../../shared/auth/oversight.guard';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { UserThrottlerGuard } from '../../../shared/http/user-throttler.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * PSF membership (ADR-056, widened by the PSF path), in four controllers
 * because they answer four different callers: anyone reading PSF's price list
 * and sectors, a business's applicant, a PSF membership officer working the
 * queue, and the same officer reading the register of their region.
 */

/**
 * PSF's tiers and sectors. Public, like the registration fee quote: a price
 * nobody can see before signing in is a price nobody trusts, and the PSF page
 * shows both to a visitor deciding whether to register.
 */
@Controller({ path: 'psf', version: '1' })
export class PsfTiersController {
  constructor(private readonly psf: PsfMembershipService) {}

  @Get('tiers')
  tiers(): Promise<PsfTier[]> {
    return this.psf.tiers();
  }

  @Get('catalogue')
  catalogue(): Promise<PsfCatalogue> {
    return this.psf.catalogue();
  }
}

/**
 * A business's PSF membership (AC-15 to AC-17). Guarded by the session and the
 * applicant rule the service applies, NOT by `WorkspaceGuard`: a business in
 * the registration pipeline holds no permission, and this must work there.
 */
@Controller({ path: 'orgs/:orgId', version: '1' })
@UseGuards(SessionGuard)
export class PsfMembershipController {
  constructor(private readonly psf: PsfMembershipService) {}

  @Get('psf-membership')
  overview(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<PsfMembershipOverview> {
    return this.psf.overview(orgId, user.id);
  }

  /** Throttled per person, like every write that reaches another party. */
  @Post('psf-applications')
  @HttpCode(201)
  @UseGuards(UserThrottlerGuard)
  apply(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body(new ZodValidationPipe(CreatePsfApplicationRequest))
    body: CreatePsfApplicationRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<PsfMembershipOverview> {
    return this.psf.apply(orgId, user.id, body);
  }

  @Post('psf-applications/:applicationId/withdraw')
  @HttpCode(200)
  withdraw(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<PsfMembershipOverview> {
    return this.psf.withdraw(orgId, user.id, applicationId);
  }

  /**
   * Pay an approved application's fee by mobile money (the PSF path). Money,
   * so throttled on the money bucket, like the TIN check that also reaches a
   * third party. Idempotent on the application: a second press finds the
   * first charge.
   */
  @Post('psf-applications/:applicationId/pay')
  @HttpCode(200)
  @UseGuards(UserThrottlerGuard)
  @Throttle({ money: { limit: 10, ttl: 60_000 } })
  pay(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body(new ZodValidationPipe(PayPsfMembershipRequest)) body: PayPsfMembershipRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<PsfMembershipOverview> {
    return this.psf.pay(orgId, user.id, applicationId, body);
  }
}

/**
 * The Membership console's queue (AC-10 to AC-14). Bounded by the officer's
 * region: a district officer reads their district's applications, a country
 * officer every one.
 */
@Controller({ path: 'oversight/psf-applications', version: '1' })
@UseGuards(SessionGuard, OversightGuard)
@RequireOversight('psf_membership_officer')
export class OversightPsfController {
  constructor(private readonly psf: PsfMembershipService) {}

  @Get()
  queue(
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Query(new ZodValidationPipe(PsfQueueQuery)) query: PsfQueueQuery,
  ): Promise<PsfQueuePage> {
    return this.psf.queue(user.id, grants, query.cursor);
  }

  @Get(':applicationId')
  application(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<PsfOfficerApplication> {
    return this.psf.officerApplication(user.id, grants, applicationId);
  }

  @Post(':applicationId/approve')
  @HttpCode(200)
  approve(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body(new ZodValidationPipe(PsfApproveRequest)) body: PsfApproveRequest,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<PsfOfficerApplication> {
    return this.psf.approve(user.id, grants, applicationId, body);
  }

  @Post(':applicationId/decline')
  @HttpCode(200)
  decline(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body(new ZodValidationPipe(PsfDeclineRequest)) body: PsfDeclineRequest,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<PsfOfficerApplication> {
    return this.psf.decline(user.id, grants, applicationId, body);
  }
}

/**
 * The officer's register of businesses (the PSF path): every business in their
 * region, what kind it is, and how it stands with PSF, with a summary to read
 * the region at a glance.
 */
@Controller({ path: 'oversight/psf', version: '1' })
@UseGuards(SessionGuard, OversightGuard)
@RequireOversight('psf_membership_officer')
export class OversightPsfRegisterController {
  constructor(private readonly psf: PsfMembershipService) {}

  @Get('businesses')
  businesses(
    @CurrentOversight() grants: OversightGrant[],
    @Query(new ZodValidationPipe(PsfBusinessesQuery)) query: PsfBusinessesQuery,
  ): Promise<PsfBusinessesPage> {
    return this.psf.register(grants, query);
  }

  @Get('summary')
  summary(@CurrentOversight() grants: OversightGrant[]): Promise<PsfRegisterSummary> {
    return this.psf.registerSummary(grants);
  }
}
