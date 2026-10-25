import {
  AcceptContractRequest,
  type BrokerRegistrationSummary,
  CreateBrokerRegistrationRequest,
  CreateRegistrationRequest,
  type OversightGrant,
  PassGateRequest,
  RegistrationBusinessType,
  type RegistrationFeeQuote,
  type RegistrationSummary,
  RejectRegistrationRequest,
  TinCheckRequest,
  type TinCheckResult,
} from '@injishi/contracts';
import { Throttle } from '@nestjs/throttler';
import {
  BadRequestException,
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

import { BrokerRegistrationService } from '../../../modules/organization/application/broker-registration.service';
import { RegistrationService } from '../../../modules/organization/application/registration.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentOversight,
  OversightGuard,
  RequireOversight,
} from '../../../shared/auth/oversight.guard';
import { UserThrottlerGuard } from '../../../shared/http/user-throttler.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Business registration → /api/v1/registrations (F-S03 / FL01).
 *
 * Guarded throughout except the fee quote: a business belongs to the person who
 * registers it, so every write resolves an identity first. The quote is public
 * because a price nobody can see before signing in is a price nobody trusts.
 *
 * The route shape follows the pipeline rather than the tables: you create a
 * registration, you pay it, you read where it got to. `POST /:id/pay` is the
 * only way into `submitted`, which is what makes "no one registers without
 * paying" true at the seam rather than in a comment (D23).
 */
@Controller({ path: 'registrations', version: '1' })
export class RegistrationsController {
  constructor(
    private readonly registrations: RegistrationService,
    private readonly brokerRegistrations: BrokerRegistrationService,
  ) {}

  /** What a registration of this kind costs right now. */
  @Get('fee')
  fee(
    @Query('businessType') businessType: string,
  ): Promise<RegistrationFeeQuote> {
    const parsed = RegistrationBusinessType.safeParse(businessType);
    if (!parsed.success) {
      throw new BadRequestException(
        'businessType must be hospitality, residence or broker.',
      );
    }
    return this.registrations.quote(parsed.data);
  }

  /**
   * Check a TIN at the Business step, before anything is created or billed
   * (registration Phase 0). Writes nothing.
   *
   * Signed in and throttled per person: whether a TIN is already on Injishi is
   * something `POST /registrations` would tell a caller anyway, but not twenty
   * times a minute.
   */
  @Post('tin-check')
  @HttpCode(200)
  @UseGuards(SessionGuard, UserThrottlerGuard)
  @Throttle({ money: { limit: 20, ttl: 60_000 } })
  checkTin(
    @Body(new ZodValidationPipe(TinCheckRequest)) body: TinCheckRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<TinCheckResult> {
    // The caller, because "are you one of its directors?" is asked of them.
    return this.registrations.checkTin(body.tin, user.id);
  }

  /** Create the registration at `pending_payment`, with its bill. */
  @Post()
  @UseGuards(SessionGuard)
  create(
    @Body(new ZodValidationPipe(CreateRegistrationRequest))
    body: CreateRegistrationRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<RegistrationSummary> {
    return this.registrations.create(body, user.id);
  }

  /**
   * Register the caller as a broker (F-R09, ADR-026 assumption 2).
   *
   * Its own route rather than a branch of `POST /registrations`, because it
   * returns a different thing: a broker has no org, no invoice and no
   * registration status, so `RegistrationSummary` could only describe one by
   * nulling six fields and showing a status it can never hold.
   *
   * The registration fee (2026-10-25) is paid first, by mobile money, on
   * `POST /registrations/broker/fee` (`RegistrationBrokerFeeController`); this
   * call names the paid payment and the district the broker works in.
   */
  @Post('broker')
  @UseGuards(SessionGuard)
  registerBroker(
    @Body(new ZodValidationPipe(CreateBrokerRegistrationRequest))
    body: CreateBrokerRegistrationRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<BrokerRegistrationSummary> {
    return this.brokerRegistrations.register(body, user.id);
  }

  /**
   * Accept the operator contract, after creating and before paying (ADR-053,
   * AC-R8).
   *
   * Its own call because the contract quotes the registration reference and
   * the invoiced amount, and neither exists until the business does. The wizard
   * puts the step between create and pay; `/pay` refusing without it is the
   * control. Membership and the refusal order are the service's.
   */
  @Post(':id/contract')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  acceptContract(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AcceptContractRequest))
    body: AcceptContractRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<RegistrationSummary> {
    return this.registrations.acceptContract(id, user.id, body.contractVersion);
  }

  /**
   * Settle the registration fee, which is what enqueues the RRA check.
   *
   * A stand-in for the payment provider callback until F-S08 lands a real one.
   * It is idempotent by construction: the repository's conditional update means
   * a second call advances nothing and bills nothing.
   *
   * Refused with 409 `contract_not_accepted` while the operator contract is
   * open (ADR-053, AC-R13). Settling is the only door into `submitted`, so this
   * is what keeps a business without an accepted contract out of every
   * officer's queue.
   */
  @Post(':id/pay')
  @UseGuards(SessionGuard)
  async pay(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<RegistrationSummary> {
    // Ownership, not just a session. Settling is idempotent, so a stranger
    // could not double-charge anyone — but they could confirm that a given
    // registration exists, and that is not theirs to learn.
    await this.registrations.assertOwns(id, user.id);
    return this.registrations.settleFeeAndVerify(id, user.id);
  }

  /**
   * Correct a rejection and go round again: `rejected → submitted` (D23).
   *
   * Never back to `pending_payment`. The fee bought the registration and the
   * review, not the outcome, and it is charged once per org ever.
   */
  @Post(':id/resubmit')
  @UseGuards(SessionGuard)
  resubmit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<RegistrationSummary> {
    return this.registrations.resubmit(id, user.id);
  }

  /**
   * The field verifier's gate → `field_verified` (Decision B, D25).
   *
   * Two guards in order: a session, then an active assignment for THIS
   * function. Region is checked in the service against the business itself.
   */
  @Post(':id/field-verify')
  @UseGuards(SessionGuard, OversightGuard)
  @RequireOversight('business_field_verifier')
  fieldVerify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(PassGateRequest)) body: PassGateRequest,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<RegistrationSummary> {
    return this.registrations.fieldVerify(
      id,
      user.id,
      grants,
      body.notes ?? null,
    );
  }

  /**
   * The approver's gate → `approved`, and on to `active` in the same
   * transaction unless an OBO owner has yet to claim (D21, D23, F-S03 §8).
   */
  @Post(':id/approve')
  @UseGuards(SessionGuard, OversightGuard)
  @RequireOversight('business_approver')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(PassGateRequest)) body: PassGateRequest,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<RegistrationSummary> {
    return this.registrations.approve(id, user.id, grants, body.notes ?? null);
  }

  /**
   * Refuse at the field verification gate, with a reason the registrant can act
   * on. The approver's refusal is the sibling route below — two routes rather
   * than one, because the guard has to name a single function.
   */
  @Post(':id/field-reject')
  @UseGuards(SessionGuard, OversightGuard)
  @RequireOversight('business_field_verifier')
  fieldReject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(RejectRegistrationRequest))
    body: RejectRegistrationRequest,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<RegistrationSummary> {
    return this.registrations.reject(
      id,
      user.id,
      grants,
      body.reasonCode,
      body.notes ?? null,
    );
  }

  /** Refuse at the approval gate. */
  @Post(':id/reject')
  @UseGuards(SessionGuard, OversightGuard)
  @RequireOversight('business_approver')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(RejectRegistrationRequest))
    body: RejectRegistrationRequest,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<RegistrationSummary> {
    return this.registrations.reject(
      id,
      user.id,
      grants,
      body.reasonCode,
      body.notes ?? null,
    );
  }

  /** Where this registration got to — what the pending workspace renders. */
  @Get(':id')
  @UseGuards(SessionGuard)
  async summary(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<RegistrationSummary> {
    await this.registrations.assertOwns(id, user.id);
    return this.registrations.summary(id);
  }
}
