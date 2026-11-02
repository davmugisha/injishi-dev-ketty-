import {
  DecideBrokerDealRequest,
  EndBrokerDealRequest,
  type BrokerCommissionList,
  type BrokerDeal,
  type BrokerDealList,
  type WorkspaceAccess,
} from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';

import { BrokerDealsService } from '../../../modules/brokers/application/broker-deals.service';
import { BrokerPayoutsService } from '../../../modules/brokers/application/broker-payouts.service';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { CurrentWorkspace, RequirePermission, WorkspaceGuard } from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The hotel's side of broker deals → /api/v1/ops/broker-deals (0124, 2026-11-02).
 *
 * Every route needs `payout.manage`: a deal decides what the hotel is paid for
 * the stays a broker brings, and only the owner holds it by default. Every deal
 * is read through the workspace's own org, so another hotel's deal is not found.
 */
@Controller({ path: 'ops/broker-deals', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsBrokerDealsController {
  constructor(
    private readonly deals: BrokerDealsService,
    private readonly payouts: BrokerPayoutsService,
  ) {}

  @Get()
  @RequirePermission('payout.manage')
  list(@CurrentWorkspace() workspace: WorkspaceAccess): Promise<BrokerDealList> {
    return this.deals.hotelDeals(workspace);
  }

  /** What the hotel owes its brokers in commission, and what came off its payouts (0127). */
  @Get('commissions')
  @RequirePermission('payout.manage')
  commissions(@CurrentWorkspace() workspace: WorkspaceAccess): Promise<BrokerCommissionList> {
    return this.payouts.hotelCommissions(workspace);
  }

  /** Accept or decline a broker's proposal. */
  @Post(':id/decision')
  @HttpCode(200)
  @RequirePermission('payout.manage')
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(DecideBrokerDealRequest)) body: DecideBrokerDealRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @CurrentUser() user: SessionUser,
  ): Promise<BrokerDeal> {
    return this.deals.decide(workspace, id, body, user.id);
  }

  /** End a running deal from the hotel's side. */
  @Post(':id/end')
  @HttpCode(200)
  @RequirePermission('payout.manage')
  end(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(EndBrokerDealRequest)) body: EndBrokerDealRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @CurrentUser() user: SessionUser,
  ): Promise<BrokerDeal> {
    return this.deals.endByHotel(workspace, id, body, user.id);
  }
}
