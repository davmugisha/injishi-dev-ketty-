import {
  type IdentityStatus,
  NationalIdConfirmRequest,
  NationalIdLookupRequest,
  type NationalIdLookupResult,
  PassportVerifyRequest,
  type PassportVerifyResult,
  type VerifiedPerson,
} from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { IdentityService } from '../../../modules/user/application/identity.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { UserThrottlerGuard } from '../../../shared/http/user-throttler.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The caller's own identity verification → /api/v1/me/identity (ADR-060).
 *
 * Signed in and throttled per PERSON throughout. The lookup is the tightest:
 * five National IDs in ten minutes is room for a typo and a retry, and far too
 * few to walk the register, and every one of them costs an SMS to somebody.
 * It reveals nobody anyway (see `IdentityService`); the throttle bounds the
 * texts, not the data.
 */
@Controller({ path: 'me/identity', version: '1' })
@UseGuards(SessionGuard, UserThrottlerGuard)
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  /** Where the caller stands, and which checks this deployment can run. */
  @Get()
  @Throttle({ money: { limit: 60, ttl: 60_000 } })
  status(@CurrentUser() user: SessionUser): Promise<IdentityStatus> {
    return this.identity.status(user.id);
  }

  /** Send a code to the phone the register holds for this National ID. */
  @Post('national-id/lookup')
  @HttpCode(200)
  @Throttle({ money: { limit: 5, ttl: 600_000 } })
  lookup(
    @Body(new ZodValidationPipe(NationalIdLookupRequest)) body: NationalIdLookupRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<NationalIdLookupResult> {
    return this.identity.lookupNationalId(user.id, body.documentNumber);
  }

  /** The code back, and the person revealed and recorded as verified. */
  @Post('national-id/confirm')
  @HttpCode(200)
  @Throttle({ money: { limit: 10, ttl: 600_000 } })
  confirm(
    @Body(new ZodValidationPipe(NationalIdConfirmRequest)) body: NationalIdConfirmRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<VerifiedPerson> {
    return this.identity.confirmNationalId(user.id, body.challengeId, body.code);
  }

  /** A passport page and a selfie, both uploaded first as `id_photo`. */
  @Post('passport')
  @HttpCode(200)
  @Throttle({ money: { limit: 5, ttl: 600_000 } })
  passport(
    @Body(new ZodValidationPipe(PassportVerifyRequest)) body: PassportVerifyRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<PassportVerifyResult> {
    return this.identity.verifyPassport(user.id, body);
  }
}
