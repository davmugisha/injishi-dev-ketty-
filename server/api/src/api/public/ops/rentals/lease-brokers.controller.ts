import {
  BrokerFeeStatusRequest,
  BrokerPickQuery,
  BrokerRatingRequest,
  type BrokerPickList,
  type LandlordPlacementList,
  type LeaseBrokerView,
} from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';

import { LeaseBrokersService } from '../../../../modules/rentals/application/lease-brokers.service';
import type { ScopedWorkspace } from '../../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../../shared/auth/session.guard';
import { CurrentWorkspace, RequireAnyPermission, RequirePermission, WorkspaceGuard } from '../../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../../shared/validation/zod-validation.pipe';

/**
 * Brokers on the landlord's side (2026-10-25). Residence businesses only.
 *
 * `GET /ops/rentals/placements`: the brokers who said they have a tenant for a
 * unit, with the lease and fee each became (`lease.manage` or `message.send`).
 * `GET /ops/rentals/brokers?q=`: the active brokers a lease can name
 * (`lease.manage`). On a lease (`lease.manage`): mark the broker fee paid or
 * owed (a record: the money moves outside Injishi), and rate the broker once
 * the tenancy has started.
 */
@Controller({ version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsLeaseBrokersController {
  constructor(private readonly brokers: LeaseBrokersService) {}

  @Get('ops/rentals/placements')
  @RequireAnyPermission('lease.manage', 'message.send')
  placements(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<LandlordPlacementList> {
    return this.brokers.placements(workspace);
  }

  @Get('ops/rentals/brokers')
  @RequirePermission('lease.manage')
  pick(
    @Query(new ZodValidationPipe(BrokerPickQuery)) query: BrokerPickQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<BrokerPickList> {
    return this.brokers.pick(workspace, query.q);
  }

  @Put('ops/leases/:id/broker-fee')
  @RequirePermission('lease.manage')
  feeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(BrokerFeeStatusRequest)) body: BrokerFeeStatusRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaseBrokerView> {
    return this.brokers.setFeePaid(workspace, user.id, id, body.paid);
  }

  @Post('ops/leases/:id/broker-rating')
  @HttpCode(200)
  @RequirePermission('lease.manage')
  rate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(BrokerRatingRequest)) body: BrokerRatingRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaseBrokerView> {
    return this.brokers.rateAsLandlord(workspace, user.id, id, body);
  }
}
