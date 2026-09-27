import {
  CreatePsfApplicationRequest,
  PsfDeclineRequest,
  PsfMemberDecisionRequest,
  PsfQueueQuery,
  type OversightGrant,
  type PsfMembershipOverview,
  type PsfOfficerApplication,
  type PsfQueuePage,
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
 * PSF membership (ADR-056), in three controllers because they answer three
 * different callers: anyone signed in reading the tiers, a business's
 * applicant, and a PSF membership officer.
 */

/** The tiers the apply form offers. Signed in, like the wizard that reads it. */
@Controller({ path: 'psf', version: '1' })
@UseGuards(SessionGuard)
export class PsfTiersController {
  constructor(private readonly psf: PsfMembershipService) {}

  @Get('tiers')
  tiers(): Promise<PsfTier[]> {
    return this.psf.tiers();
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
}

/**
 * The Membership console's API (AC-10 to AC-14). Country scope by the posting
 * rule, so there is no region filter: every PSF membership officer reads one
 * national queue.
 */
@Controller({ path: 'oversight/psf-applications', version: '1' })
@UseGuards(SessionGuard, OversightGuard)
@RequireOversight('psf_membership_officer')
export class OversightPsfController {
  constructor(private readonly psf: PsfMembershipService) {}

  @Get()
  queue(
    @CurrentUser() user: SessionUser,
    @Query(new ZodValidationPipe(PsfQueueQuery)) query: PsfQueueQuery,
  ): Promise<PsfQueuePage> {
    return this.psf.queue(user.id, query.cursor);
  }

  @Get(':applicationId')
  application(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<PsfOfficerApplication> {
    return this.psf.officerApplication(user.id, applicationId);
  }

  @Post(':applicationId/member')
  @HttpCode(200)
  member(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body(new ZodValidationPipe(PsfMemberDecisionRequest)) body: PsfMemberDecisionRequest,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<PsfOfficerApplication> {
    return this.psf.member(user.id, grants, applicationId, body);
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
