import {
  AcceptLeaseInvitationRequest,
  SignLeaseRequest,
  TenantPayRequest,
  type LeaseContractView,
  type LeaseEventList,
  type SigningCodeSent,
  type TenancyDetail,
  type TenancyList,
  type TenantChargeList,
  type TenantPaymentList,
  type TenantPaymentView,
} from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { LeaseInvitationsService } from '../../../modules/rentals/application/lease-invitations.service';
import { LeaseSigningService } from '../../../modules/rentals/application/lease-signing.service';
import { TenanciesService, type TenancyRef } from '../../../modules/rentals/application/tenancies.service';
import { TenantPaymentsService } from '../../../modules/rentals/application/tenant-payments.service';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { IdempotencyKey } from '../../../shared/http/idempotency-key';
import { UserThrottlerGuard } from '../../../shared/http/user-throttler.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { signingContext, type SigningRequest } from '../ops/rentals/signing-context';
import type { FileReply } from '../ops/pay-runs.controller';
import { CurrentTenancy, TenancyGuard } from './tenancy.guard';

/**
 * The tenant's own leases → /api/v1/me/tenancies (blueprint 2.4, WP 1.5b).
 *
 * Session only: a tenancy belongs to a person, not to a workspace they work
 * in. The list is the caller's; every `:leaseId` route goes through
 * `TenancyGuard`, which answers 404 for a draft or another person's lease.
 * Signing and paying are throttled per person. Paying (WP 1.6b): what is
 * owed, a payment by mobile money with an `Idempotency-Key`, polling it, the
 * history and the receipt PDF. Faults, guests and moving out join these
 * routes in later packages.
 */
@Controller({ path: 'me/tenancies', version: '1' })
@UseGuards(SessionGuard)
export class MeTenanciesController {
  constructor(
    private readonly tenancies: TenanciesService,
    private readonly signing: LeaseSigningService,
    private readonly paying: TenantPaymentsService,
  ) {}

  @Get()
  list(@CurrentUser() user: SessionUser): Promise<TenancyList> {
    return this.tenancies.list(user);
  }

  @Get(':leaseId')
  @UseGuards(TenancyGuard)
  detail(@CurrentTenancy() tenancy: TenancyRef): Promise<TenancyDetail> {
    return this.tenancies.detail(tenancy);
  }

  /** The tenancy's timeline: only what the tenant may see. */
  @Get(':leaseId/events')
  @UseGuards(TenancyGuard)
  events(@CurrentTenancy() tenancy: TenancyRef): Promise<LeaseEventList> {
    return this.tenancies.events(tenancy);
  }

  /** The contract as it stands, with the hash a signature repeats. */
  @Get(':leaseId/contract')
  @UseGuards(TenancyGuard)
  contract(@CurrentTenancy() tenancy: TenancyRef): Promise<LeaseContractView> {
    return this.tenancies.contract(tenancy);
  }

  /** The contract as a PDF: the signed copy once both have signed, a marked preview before. */
  @Get(':leaseId/contract/pdf')
  @UseGuards(TenancyGuard)
  async pdf(@CurrentTenancy() tenancy: TenancyRef, @Res({ passthrough: true }) reply: FileReply): Promise<void> {
    const file = await this.tenancies.pdf(tenancy);
    reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', `inline; filename="${file.filename}"`)
      .header('cache-control', 'no-store')
      .send(file.body);
  }

  /** Email the tenant a 6 digit code to sign with. A second ask within a minute sends nothing new. */
  @Post(':leaseId/sign/code')
  @HttpCode(200)
  @UseGuards(TenancyGuard, UserThrottlerGuard)
  @Throttle({ money: { limit: 6, ttl: 600_000 } })
  signingCode(@CurrentTenancy() tenancy: TenancyRef, @CurrentUser() user: SessionUser): Promise<SigningCodeSent> {
    return this.signing.tenantCode(tenancy, user);
  }

  /** Sign the lease the landlord signed: it becomes signed and the deposit is raised. */
  @Post(':leaseId/sign')
  @HttpCode(200)
  @UseGuards(TenancyGuard, UserThrottlerGuard)
  @Throttle({ money: { limit: 10, ttl: 60_000 } })
  sign(
    @CurrentTenancy() tenancy: TenancyRef,
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(SignLeaseRequest)) body: SignLeaseRequest,
    @Req() request: SigningRequest,
  ): Promise<TenancyDetail> {
    return this.signing.signAsTenant(tenancy, user, body, signingContext(request));
  }

  /** What the tenant owes: every charge, the credit held, and the most they may pay now. */
  @Get(':leaseId/charges')
  @UseGuards(TenancyGuard)
  charges(@CurrentTenancy() tenancy: TenancyRef): Promise<TenantChargeList> {
    return this.paying.charges(tenancy);
  }

  /** The tenant's payments, newest first: on Injishi and recorded by the landlord. */
  @Get(':leaseId/payments')
  @UseGuards(TenancyGuard)
  payments(@CurrentTenancy() tenancy: TenancyRef): Promise<TenantPaymentList> {
    return this.paying.list(tenancy);
  }

  /** Pay by MTN MoMo or Airtel Money: a prompt goes to the phone; the answer is the payment to poll. */
  @Post(':leaseId/payments')
  @HttpCode(200)
  @UseGuards(TenancyGuard, UserThrottlerGuard)
  @Throttle({ money: { limit: 6, ttl: 60_000 } })
  pay(
    @CurrentTenancy() tenancy: TenancyRef,
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(TenantPayRequest)) body: TenantPayRequest,
    @IdempotencyKey() key: string,
  ): Promise<TenantPaymentView> {
    return this.paying.pay(tenancy, user, key, body);
  }

  /** Where one payment stands: waiting, received, failed or expired, in plain words. */
  @Get(':leaseId/payments/:id')
  @UseGuards(TenancyGuard)
  payment(@CurrentTenancy() tenancy: TenancyRef, @Param('id', ParseUUIDPipe) id: string): Promise<TenantPaymentView> {
    return this.paying.poll(tenancy, id);
  }

  /** The receipt of a payment that was received, as a PDF. */
  @Get(':leaseId/payments/:id/receipt')
  @UseGuards(TenancyGuard)
  async receipt(@CurrentTenancy() tenancy: TenancyRef, @Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) reply: FileReply): Promise<void> {
    const file = await this.paying.receipt(tenancy, id);
    reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', `inline; filename="${file.filename}"`)
      .header('cache-control', 'no-store')
      .send(file.body);
  }
}

/**
 * Accepting a lease invitation → /api/v1/me/lease-invitations (blueprint 2.5).
 * The signed in email must be the invited one; accepting links the tenant
 * record to this account and answers the tenancy.
 */
@Controller({ path: 'me/lease-invitations', version: '1' })
@UseGuards(SessionGuard, UserThrottlerGuard)
export class MeLeaseInvitationsController {
  constructor(private readonly invitations: LeaseInvitationsService) {}

  @Post('accept')
  @HttpCode(200)
  @Throttle({ money: { limit: 10, ttl: 60_000 } })
  accept(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(AcceptLeaseInvitationRequest)) body: AcceptLeaseInvitationRequest,
  ): Promise<TenancyDetail> {
    return this.invitations.accept(user, body);
  }
}
