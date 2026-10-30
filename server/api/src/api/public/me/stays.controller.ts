import type {
  ClaimStayResult,
  GuestOfferList,
  MyStays,
  OpenDepartmentResult,
  RedeemOfferResult,
  StayDepartments,
  StayRefundQuote,
  StayRefundRequestList,
  StayRefundRequestView,
} from '@injishi/contracts';
import {
  ClaimStayRequest,
  OpenDepartmentRequest,
  RaiseStayRefundRequest,
  RedeemOfferRequest,
  StayRefundReason,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { MessagingService } from '../../../modules/operations/application/messaging.service';
import { OffersService } from '../../../modules/pms/application/offers.service';
import { StayClaimService } from '../../../modules/pms/application/stay-claim.service';
import { StayRefundService } from '../../../modules/pms/application/stay-refund.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { UserThrottlerGuard } from '../../../shared/http/user-throttler.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * THE IN-HOUSE GUEST'S OWN SURFACE — `/api/v1/me/stays*` (§6.8).
 *
 * The four things a guest does with a stay a front desk typed for them, in the
 * order they do them: claim it, talk to a department, ask for money back, take
 * an offer.
 *
 * ## `SessionGuard` alone, and no `@RequirePermission`
 *
 * Deliberate, and the same decision `/me/threads` records. `WorkspaceGuard`
 * cannot speak for a guest: a stay's `workspace_id` is the PROPERTY's, and a
 * guest holds no workspace at all. Ownership is the guard here, and it is
 * proved once at the top of every route — `StayClaimService.mine()` resolves
 * the stay through `guest_stays.guest_user_id` and answers 404 for anything
 * that is not this person's. 404 and never 403, so a probe cannot learn that an
 * id is real.
 *
 * ## The claim route is throttled and the rest are not
 *
 * A claim code is a bearer credential over a space of about 3.3 billion, which
 * is not enough against somebody who can guess without limit. Five attempts a
 * minute per ACCOUNT — `UserThrottlerGuard` keys on the user id, so a hotel
 * lobby's shared NAT does not throttle every guest at once and one account
 * cannot dodge the limit by changing networks.
 */
@Controller({ path: 'me/stays', version: '1' })
@UseGuards(SessionGuard, UserThrottlerGuard)
export class MeStaysController {
  constructor(
    private readonly stays: StayClaimService,
    private readonly messaging: MessagingService,
    private readonly refunds: StayRefundService,
    private readonly offers: OffersService,
  ) {}

  /** Every stay on this account, newest arrival first. */
  @Get()
  list(@CurrentUser() user: SessionUser): Promise<MyStays> {
    return this.stays.listMine(user.id);
  }

  /**
   * Bind a desk-registered stay to this account by its claim code.
   *
   * Declared BEFORE `:id/...` so `claim` is matched as a literal segment rather
   * than as a stay whose id happens to be that word.
   *
   * The `money` bucket, at 5 a minute. It moves no money, but it is the one
   * route on this surface where guessing is worth something, and that bucket is
   * the one this API already registers.
   */
  @Post('claim')
  @Throttle({ money: { limit: 5, ttl: 60_000 } })
  claim(
    @Body(new ZodValidationPipe(ClaimStayRequest)) body: ClaimStayRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<ClaimStayResult> {
    return this.stays.claim(user.id, body.code);
  }

  /** Every request for money back this person has ever raised. */
  @Get('refund-requests')
  myRefundRequests(
    @CurrentUser() user: SessionUser,
  ): Promise<StayRefundRequestList> {
    return this.refunds.listMine(user.id);
  }

  /** Change your mind about one that has not been answered yet. */
  @Post('refund-requests/:id/withdraw')
  withdrawRefundRequest(
    @Param('id', new ParseUUIDPipe()) requestId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<StayRefundRequestView> {
    return this.refunds.withdraw(user.id, requestId);
  }

  /**
   * The desks at this stay's property a guest may write to.
   *
   * Only the departments the property marked `guest_requestable` — its own
   * control over which of its internal desks take messages from guests, which
   * had existed since ADR-016 with nothing reading it.
   */
  @Get(':id/departments')
  async departments(
    @Param('id', new ParseUUIDPipe()) stayId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<StayDepartments> {
    const stay = await this.stays.mine(user.id, stayId);
    return this.messaging.departmentsForStay(user.id, stay);
  }

  /**
   * Say something to one desk, opening the conversation if it is the first
   * time.
   *
   * ONE CALL, and the first message is required. A thread with nothing in it is
   * a row the desk reads as a guest who wanted something and did not say what.
   */
  @Post(':id/requests')
  async openRequest(
    @Param('id', new ParseUUIDPipe()) stayId: string,
    @Body(new ZodValidationPipe(OpenDepartmentRequest))
    body: OpenDepartmentRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<OpenDepartmentResult> {
    const stay = await this.stays.mine(user.id, stayId);
    return this.messaging.openDepartmentRequest(user.id, stay, body);
  }

  /**
   * What the rules of the accommodation would allow, before anything is sent.
   *
   * Quoted on the server, from the same function the property's queue reads, so
   * a guest is never shown one figure and answered with another.
   */
  @Get(':id/refund-quote')
  async refundQuote(
    @Param('id', new ParseUUIDPipe()) stayId: string,
    @Query('reason', new ZodValidationPipe(StayRefundReason))
    reason: StayRefundReason,
    @CurrentUser() user: SessionUser,
  ): Promise<StayRefundQuote> {
    const stay = await this.stays.mine(user.id, stayId);
    return this.refunds.quote(stay, reason);
  }

  /** Ask for money back. The property answers, and a refusal names its rule. */
  @Post(':id/refund-requests')
  async raiseRefundRequest(
    @Param('id', new ParseUUIDPipe()) stayId: string,
    @Body(new ZodValidationPipe(RaiseStayRefundRequest))
    body: RaiseStayRefundRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<StayRefundRequestView> {
    const stay = await this.stays.mine(user.id, stayId);
    return this.refunds.raise(user.id, stay, body);
  }

  /**
   * What this guest could take off this bill right now.
   *
   * Each card carries its own verdict, resolved on the server against this
   * stay: a card that says "2 nights minimum" and lets you tap it is a card
   * that produces a refusal.
   */
  @Get(':id/offers')
  async offersForStay(
    @Param('id', new ParseUUIDPipe()) stayId: string,
    @Query('code') code: string | undefined,
    @CurrentUser() user: SessionUser,
  ): Promise<GuestOfferList> {
    const stay = await this.stays.mine(user.id, stayId);
    return this.offers.forGuest({ stay, code });
  }

  /** Take one. The credit posts to the bill as a negative discount line. */
  @Post(':id/offers/:offerId/redeem')
  async redeemOffer(
    @Param('id', new ParseUUIDPipe()) stayId: string,
    @Param('offerId', new ParseUUIDPipe()) offerId: string,
    @Body(new ZodValidationPipe(RedeemOfferRequest)) body: RedeemOfferRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<RedeemOfferResult> {
    const stay = await this.stays.mine(user.id, stayId);
    return this.offers.redeem(user.id, stay, offerId, body);
  }
}
