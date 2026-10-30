import {
  CancelLeaseRequest,
  CreateLeaseRequest,
  EditLeaseRequest,
  LeaseListQuery,
  ResendInvitationRequest,
  SignLeaseRequest,
  type LeaseContractView,
  type LeaseCounts,
  type LeaseDetail,
  type LeaseEventList,
  type LeaseListPage,
  type SigningCodeSent,
} from '@injishi/contracts';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { LeaseContractService } from '../../../../modules/rentals/application/lease-contract.service';
import { LeaseDraftingService } from '../../../../modules/rentals/application/lease-drafting.service';
import { LeaseInvitationsService } from '../../../../modules/rentals/application/lease-invitations.service';
import { LeaseLifecycleService } from '../../../../modules/rentals/application/lease-lifecycle.service';
import { LeaseReadsService } from '../../../../modules/rentals/application/lease-reads.service';
import { LeaseSigningService } from '../../../../modules/rentals/application/lease-signing.service';
import type { ScopedWorkspace } from '../../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  WorkspaceGuard,
} from '../../../../shared/auth/workspace.guard';
import { UserThrottlerGuard } from '../../../../shared/http/user-throttler.guard';
import { ZodValidationPipe } from '../../../../shared/validation/zod-validation.pipe';
import type { FileReply } from '../pay-runs.controller';
import { signingContext, type SigningRequest } from './signing-context';

/**
 * Leases → /api/v1/ops/leases (blueprint 2.3, WP 1.5a and 1.5b): the list by
 * tab with counts, the lease record, its timeline, its contract and the
 * contract as a PDF; drafting, editing before the tenant signs; signing as the
 * landlord, the tenant's invitation, starting the tenancy and cancelling.
 *
 * Reads admit anyone who works the leases or the money (`lease.manage`,
 * `rent.record`, `money.view`, `deposit.return`); drafting, the invitation,
 * starting and cancelling are `lease.manage`; signing for the business is
 * `lease.sign`, the owner's by default. The signing and invitation routes are
 * throttled per person (`UserThrottlerGuard`, after the session). Notices and
 * moving out come in WP 1.7.
 */
@Controller({ path: 'ops/leases', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsLeasesController {
  constructor(
    private readonly reads: LeaseReadsService,
    private readonly drafting: LeaseDraftingService,
    private readonly contracts: LeaseContractService,
    private readonly signing: LeaseSigningService,
    private readonly invitations: LeaseInvitationsService,
    private readonly lifecycle: LeaseLifecycleService,
  ) {}

  @Get()
  @RequireAnyPermission('lease.manage', 'rent.record', 'money.view', 'deposit.return')
  list(
    @Query(new ZodValidationPipe(LeaseListQuery)) query: LeaseListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<LeaseListPage> {
    return this.reads.list(workspace, query);
  }

  @Get('counts')
  @RequireAnyPermission('lease.manage', 'rent.record', 'money.view', 'deposit.return')
  counts(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<LeaseCounts> {
    return this.reads.counts(workspace);
  }

  @Post()
  @RequirePermission('lease.manage')
  create(
    @Body(new ZodValidationPipe(CreateLeaseRequest)) body: CreateLeaseRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaseDetail> {
    return this.drafting.create(workspace, user.id, body);
  }

  @Get(':id')
  @RequireAnyPermission('lease.manage', 'rent.record', 'money.view', 'deposit.return')
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<LeaseDetail> {
    return this.reads.detail(workspace, id);
  }

  @Patch(':id')
  @RequirePermission('lease.manage')
  edit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(EditLeaseRequest)) body: EditLeaseRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaseDetail> {
    return this.drafting.edit(workspace, user.id, id, body);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission('lease.manage')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CancelLeaseRequest)) body: CancelLeaseRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaseDetail> {
    return this.lifecycle.cancel(workspace, user.id, id, body);
  }

  /** Email the signer a 6 digit code to sign this draft with. A second ask within a minute sends nothing new. */
  @Post(':id/sign/code')
  @HttpCode(200)
  @RequirePermission('lease.sign')
  @UseGuards(UserThrottlerGuard)
  @Throttle({ money: { limit: 6, ttl: 600_000 } })
  signingCode(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<SigningCodeSent> {
    return this.signing.landlordCode(workspace, user, id);
  }

  /** Sign the draft for the business: the lease goes out for signature and the tenant is invited. */
  @Post(':id/sign')
  @HttpCode(200)
  @RequirePermission('lease.sign')
  @UseGuards(UserThrottlerGuard)
  @Throttle({ money: { limit: 10, ttl: 60_000 } })
  sign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(SignLeaseRequest)) body: SignLeaseRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Req() request: SigningRequest,
  ): Promise<LeaseDetail> {
    return this.signing.signAsLandlord(workspace, user, id, body, signingContext(request));
  }

  /** Email the invitation again with a fresh link, or send it to a corrected address (which returns the lease to draft). */
  @Post(':id/invitation/resend')
  @HttpCode(200)
  @RequirePermission('lease.manage')
  @UseGuards(UserThrottlerGuard)
  @Throttle({ money: { limit: 5, ttl: 600_000 } })
  resendInvitation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ResendInvitationRequest)) body: ResendInvitationRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaseDetail> {
    return this.invitations.resend(workspace, user.id, id, body);
  }

  /** Start a signed tenancy, on or after its start date: the rent due within 7 days is raised. */
  @Post(':id/start')
  @HttpCode(200)
  @RequirePermission('lease.manage')
  start(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaseDetail> {
    return this.lifecycle.start(workspace, user.id, id);
  }

  @Get(':id/events')
  @RequireAnyPermission('lease.manage', 'rent.record', 'money.view', 'deposit.return')
  events(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<LeaseEventList> {
    return this.reads.events(workspace, id);
  }

  @Get(':id/contract')
  @RequireAnyPermission('lease.manage', 'rent.record', 'money.view', 'deposit.return')
  contract(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<LeaseContractView> {
    return this.reads.contract(workspace, id);
  }

  /** The contract as a PDF: the current version, or `?version=N`. A preview until both sides sign. */
  @Get(':id/contract/pdf')
  @RequireAnyPermission('lease.manage', 'rent.record', 'money.view', 'deposit.return')
  async pdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('version') version: string | undefined,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @Res({ passthrough: true }) reply: FileReply,
  ): Promise<void> {
    let versionNumber: number | undefined;
    if (version !== undefined && version !== '') {
      versionNumber = Number(version);
      if (!Number.isInteger(versionNumber) || versionNumber < 1) throw new BadRequestException('Pick a version number from 1.');
    }
    const file = await this.contracts.pdf(workspace, id, versionNumber);
    reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', `inline; filename="${file.filename}"`)
      .header('cache-control', 'no-store')
      .send(file.body);
  }
}
