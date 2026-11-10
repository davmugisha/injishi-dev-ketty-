import {
  type AssetLoan,
  type AssetLoanList,
  CreateAssetLoanRequest,
  type HrTicket,
  type HrTicketList,
  ReplyHrTicketRequest,
  ReturnAssetLoanRequest,
} from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';

import { HrFeatureOn } from '../../../modules/hr/application/hr-feature.guard';
import { HrDeskService } from '../../../modules/hr/application/hr-desk.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { CurrentWorkspace, RequirePermission, RequireProduct, WorkspaceGuard } from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The staff help desk -> /api/v1/ops/hr-tickets (058-staff-services). A question can be about pay
 * or health, so it is read and answered with `people.manage` only, within the branches covered.
 */
@Controller({ path: 'ops/hr-tickets', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('hr')
export class OpsHrTicketsController {
  constructor(private readonly desk: HrDeskService) {}

  @Get()
  @RequirePermission('people.manage')
  list(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<HrTicketList> {
    return this.desk.tickets(workspace);
  }

  @HrFeatureOn('helpDesk')
  @Post(':id/reply')
  @HttpCode(200)
  @RequirePermission('people.manage')
  reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ReplyHrTicketRequest)) body: ReplyHrTicketRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<HrTicket> {
    return this.desk.reply(workspace, user.id, id, body);
  }

  @HrFeatureOn('helpDesk')
  @Post(':id/close')
  @HttpCode(200)
  @RequirePermission('people.manage')
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<HrTicket> {
    return this.desk.close(workspace, user.id, id);
  }
}

/**
 * Things lent to staff -> /api/v1/ops/asset-loans (058-staff-services): keys, uniforms, phones,
 * laptops and tools, from the day they go out to the day they come back.
 */
@Controller({ path: 'ops/asset-loans', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('hr')
export class OpsAssetLoansController {
  constructor(private readonly desk: HrDeskService) {}

  @Get()
  @RequirePermission('people.manage')
  list(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<AssetLoanList> {
    return this.desk.loans(workspace);
  }

  @HrFeatureOn('assets')
  @Post()
  @RequirePermission('people.manage')
  lend(
    @Body(new ZodValidationPipe(CreateAssetLoanRequest)) body: CreateAssetLoanRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<AssetLoan> {
    return this.desk.lend(workspace, user.id, body);
  }

  @HrFeatureOn('assets')
  @Post(':id/return')
  @HttpCode(200)
  @RequirePermission('people.manage')
  giveBack(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ReturnAssetLoanRequest)) body: ReturnAssetLoanRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<AssetLoan> {
    return this.desk.giveBack(workspace, user.id, id, body);
  }
}
