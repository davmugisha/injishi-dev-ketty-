import {
  CancelLeaseRequest,
  CreateLeaseRequest,
  EditLeaseRequest,
  LeaseListQuery,
  type LeaseContractView,
  type LeaseCounts,
  type LeaseDetail,
  type LeaseEventList,
  type LeaseListPage,
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
  Res,
  UseGuards,
} from '@nestjs/common';

import { LeaseContractService } from '../../../../modules/rentals/application/lease-contract.service';
import { LeaseDraftingService } from '../../../../modules/rentals/application/lease-drafting.service';
import { LeaseReadsService } from '../../../../modules/rentals/application/lease-reads.service';
import type { ScopedWorkspace } from '../../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  WorkspaceGuard,
} from '../../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../../shared/validation/zod-validation.pipe';
import type { FileReply } from '../pay-runs.controller';

/**
 * Leases → /api/v1/ops/leases (blueprint 2.3, WP 1.5a): the list by tab with
 * counts, the lease record, its timeline, its contract and the contract as a
 * PDF; drafting, editing before the tenant signs, and cancelling.
 *
 * Reads admit anyone who works the leases or the money (`lease.manage`,
 * `rent.record`, `money.view`, `deposit.return`); drafting is `lease.manage`.
 * Signing (`lease.sign`), the invitation, starting and moving out come in WP
 * 1.5b and 1.7.
 */
@Controller({ path: 'ops/leases', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsLeasesController {
  constructor(
    private readonly reads: LeaseReadsService,
    private readonly drafting: LeaseDraftingService,
    private readonly contracts: LeaseContractService,
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
    return this.drafting.cancel(workspace, user.id, id, body);
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
