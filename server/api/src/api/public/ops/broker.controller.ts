import {
  BrokerHomeDistrictRequest,
  BrokerHomesQuery,
  BrokerPlanChangeRequest,
  BrokerPlanCheckoutRequest,
  StartPlacementRequest,
  type BrokerEarnings,
  type BrokerHome,
  type BrokerHomes,
  type BrokerPlacement,
  type BrokerPlacementList,
  type BrokerPlanOverview,
  type BrokerPlanPayment,
  type BrokerReveal,
  type BrokerReviews,
  type BrokerSummary,
  type WorkspaceAccess,
} from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { BrokerHomesService } from '../../../modules/brokers/application/broker-homes.service';
import { BrokerPlansService } from '../../../modules/brokers/application/broker-plans.service';
import { SessionGuard } from '../../../shared/auth/session.guard';
import { CurrentWorkspace, WorkspaceGuard } from '../../../shared/auth/workspace.guard';
import { IdempotencyKey } from '../../../shared/http/idempotency-key';
import { UserThrottlerGuard } from '../../../shared/http/user-throttler.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The broker's own surface → /api/v1/ops/broker (2026-10-25).
 *
 * In the `ops/*` family because a broker workspace is a workspace. NO route
 * here declares a permission, and that is deliberate: `permissionsForWorkspace`
 * returns an empty array for every workspace that is not kind `business`, so
 * a broker holds none and any declaration would refuse the one person the
 * surface is for. The services refuse anything that is not an active broker's
 * own workspace, and read every unit through the plan's area and the
 * landlord's opt-in: a unit outside either answers 404. Every handler is named
 * in the API's `require-permission-on-guarded-route` allowlist.
 */
@Controller({ path: 'ops/broker', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsBrokerController {
  constructor(
    private readonly homes: BrokerHomesService,
    private readonly plans: BrokerPlansService,
  ) {}

  @Get('summary')
  summary(@CurrentWorkspace() workspace: WorkspaceAccess): Promise<BrokerSummary> {
    return this.homes.summary(workspace);
  }

  @Get('homes')
  list(
    @Query(new ZodValidationPipe(BrokerHomesQuery)) query: BrokerHomesQuery,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<BrokerHomes> {
    return this.homes.homes(workspace, query);
  }

  @Get('homes/:unitId')
  home(@Param('unitId', ParseUUIDPipe) unitId: string, @CurrentWorkspace() workspace: WorkspaceAccess): Promise<BrokerHome> {
    return this.homes.home(workspace, unitId);
  }

  /** Free; a second reveal of the same landlord shows what was revealed then. */
  @Post('homes/:unitId/reveal')
  @HttpCode(200)
  @UseGuards(UserThrottlerGuard)
  @Throttle({ money: { limit: 30, ttl: 60_000 } })
  reveal(@Param('unitId', ParseUUIDPipe) unitId: string, @CurrentWorkspace() workspace: WorkspaceAccess): Promise<BrokerReveal> {
    return this.homes.reveal(workspace, unitId);
  }

  @Post('homes/:unitId/placements')
  @HttpCode(200)
  startPlacement(
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Body(new ZodValidationPipe(StartPlacementRequest)) body: StartPlacementRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<BrokerPlacement> {
    return this.homes.startPlacement(workspace, unitId, body);
  }

  @Get('placements')
  placements(@CurrentWorkspace() workspace: WorkspaceAccess): Promise<BrokerPlacementList> {
    return this.homes.placements(workspace);
  }

  @Get('earnings')
  earnings(@CurrentWorkspace() workspace: WorkspaceAccess): Promise<BrokerEarnings> {
    return this.homes.earnings(workspace);
  }

  @Get('reviews')
  reviews(@CurrentWorkspace() workspace: WorkspaceAccess): Promise<BrokerReviews> {
    return this.homes.reviews(workspace);
  }

  @Get('plan')
  plan(@CurrentWorkspace() workspace: WorkspaceAccess): Promise<BrokerPlanOverview> {
    return this.plans.overview(workspace);
  }

  /** Pay for Province or Country, or a past-due month. The plan changes only when the money lands. */
  @Post('plan/checkout')
  @HttpCode(200)
  @UseGuards(UserThrottlerGuard)
  @Throttle({ money: { limit: 6, ttl: 60_000 } })
  checkout(
    @Body(new ZodValidationPipe(BrokerPlanCheckoutRequest)) body: BrokerPlanCheckoutRequest,
    @IdempotencyKey() key: string,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<BrokerPlanPayment> {
    return this.plans.checkout(workspace, body, key);
  }

  @Get('plan/payments/:id')
  payment(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() workspace: WorkspaceAccess): Promise<BrokerPlanPayment> {
    return this.plans.payment(workspace, id);
  }

  /** A cheaper plan from the month's end, keep the current one, or another province. Never takes money. */
  @Post('plan/change')
  @HttpCode(200)
  change(
    @Body(new ZodValidationPipe(BrokerPlanChangeRequest)) body: BrokerPlanChangeRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<BrokerPlanOverview> {
    return this.plans.change(workspace, body);
  }

  /** Back to District when the paid month ends. */
  @Post('plan/cancel')
  @HttpCode(200)
  cancel(@CurrentWorkspace() workspace: WorkspaceAccess): Promise<BrokerPlanOverview> {
    return this.plans.change(workspace, { plan: 'district' });
  }

  /** On the free plan, once per 30 days. */
  @Put('home-district')
  homeDistrict(
    @Body(new ZodValidationPipe(BrokerHomeDistrictRequest)) body: BrokerHomeDistrictRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<BrokerPlanOverview> {
    return this.plans.setHomeDistrict(workspace, body);
  }
}
