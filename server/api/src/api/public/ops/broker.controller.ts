import {
  BrokerHomeDistrictRequest,
  BrokerHomesQuery,
  BrokerPlanChangeRequest,
  BrokerPlanCheckoutRequest,
  BrokerRoomsQuery,
  CreateBrokerBookingRequest,
  SetBrokerPayoutAccountRequest,
  EndBrokerDealRequest,
  ProposeBrokerDealRequest,
  StartPlacementRequest,
  type BrokerBookingGroup,
  type BrokerBookingList,
  type BrokerCommissionList,
  type BrokerPayoutAccount,
  type BrokerDeal,
  type BrokerDealList,
  type BrokerHotels,
  type BrokerEarnings,
  type BrokerHome,
  type BrokerHomes,
  type BrokerPlacement,
  type BrokerPlacementList,
  type BrokerPlanOverview,
  type BrokerPlanPayment,
  type BrokerRoomOffer,
  type BrokerReveal,
  type BrokerReviews,
  type BrokerSummary,
  type WorkspaceAccess,
} from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { BrokerBookingsService } from '../../../modules/brokers/application/broker-bookings.service';
import { BrokerDealsService } from '../../../modules/brokers/application/broker-deals.service';
import { BrokerPayoutsService } from '../../../modules/brokers/application/broker-payouts.service';
import { BrokerHomesService } from '../../../modules/brokers/application/broker-homes.service';
import { BrokerPlansService } from '../../../modules/brokers/application/broker-plans.service';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
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
    private readonly deals: BrokerDealsService,
    private readonly bookings: BrokerBookingsService,
    private readonly brokerPayouts: BrokerPayoutsService,
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

  // --- Hotels (0125): commission deals with hotels inside the plan's area ------------------------

  @Get('hotels')
  hotels(@CurrentWorkspace() workspace: WorkspaceAccess): Promise<BrokerHotels> {
    return this.deals.hotels(workspace);
  }

  @Get('deals')
  brokerDeals(@CurrentWorkspace() workspace: WorkspaceAccess): Promise<BrokerDealList> {
    return this.deals.brokerDeals(workspace);
  }

  /** Propose commission terms to a hotel. One proposed or running deal per hotel at a time. */
  @Post('hotels/:orgId/deals')
  @HttpCode(200)
  @UseGuards(UserThrottlerGuard)
  @Throttle({ money: { limit: 20, ttl: 60_000 } })
  proposeDeal(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body(new ZodValidationPipe(ProposeBrokerDealRequest)) body: ProposeBrokerDealRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @CurrentUser() user: SessionUser,
  ): Promise<BrokerDeal> {
    return this.deals.propose(workspace, orgId, body, user.id);
  }

  /** Take back a proposal the hotel has not answered. */
  @Post('deals/:id/withdraw')
  @HttpCode(200)
  withdrawDeal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(EndBrokerDealRequest)) body: EndBrokerDealRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @CurrentUser() user: SessionUser,
  ): Promise<BrokerDeal> {
    return this.deals.withdraw(workspace, id, body, user.id);
  }

  /** End a running deal from the broker's side. */
  @Post('deals/:id/end')
  @HttpCode(200)
  endDeal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(EndBrokerDealRequest)) body: EndBrokerDealRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @CurrentUser() user: SessionUser,
  ): Promise<BrokerDeal> {
    return this.deals.endByBroker(workspace, id, body, user.id);
  }

  // --- Bookings (0126): rooms booked for clients under a running deal --------------------------------

  /** The hotel's rooms for these dates, at their rates, with how many are free. Needs a running deal. */
  @Get('hotels/:orgId/rooms')
  rooms(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Query(new ZodValidationPipe(BrokerRoomsQuery)) query: BrokerRoomsQuery,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<BrokerRoomOffer> {
    return this.bookings.rooms(workspace, orgId, query.checkIn, query.checkOut);
  }

  /** Book one room or many, paid at the hotel or by one MoMo payment for the group. */
  @Post('hotels/:orgId/bookings')
  @HttpCode(200)
  @UseGuards(UserThrottlerGuard)
  @Throttle({ money: { limit: 10, ttl: 60_000 } })
  createBooking(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body(new ZodValidationPipe(CreateBrokerBookingRequest)) body: CreateBrokerBookingRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<BrokerBookingGroup> {
    return this.bookings.create(workspace, orgId, body);
  }

  @Get('bookings')
  brokerBookings(@CurrentWorkspace() workspace: WorkspaceAccess): Promise<BrokerBookingList> {
    return this.bookings.list(workspace);
  }

  /** One booking; while its MoMo prompt is out, this is the poll. */
  @Get('bookings/:id')
  brokerBooking(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() workspace: WorkspaceAccess): Promise<BrokerBookingGroup> {
    return this.bookings.get(workspace, id);
  }

  // --- Commission (0128): earned on hotel stays, paid to the broker's MoMo number ----------------------

  @Get('commissions')
  commissions(@CurrentWorkspace() workspace: WorkspaceAccess): Promise<BrokerCommissionList> {
    return this.brokerPayouts.brokerCommissions(workspace);
  }

  @Get('payout-account')
  payoutAccount(@CurrentWorkspace() workspace: WorkspaceAccess): Promise<BrokerPayoutAccount | null> {
    return this.brokerPayouts.account(workspace);
  }

  /** Where the broker's share is paid. A share that waited for a number is sent to it at once. */
  @Put('payout-account')
  @UseGuards(UserThrottlerGuard)
  @Throttle({ money: { limit: 10, ttl: 60_000 } })
  setPayoutAccount(
    @Body(new ZodValidationPipe(SetBrokerPayoutAccountRequest)) body: SetBrokerPayoutAccountRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<BrokerPayoutAccount> {
    return this.brokerPayouts.setAccount(workspace, body);
  }
}
