import {
  IdentityScanRequest,
  type IdentityScanResult,
  type IdentityStatus,
  NationalIdCheckRequest,
  TypedIdentityRequest,
} from '@injishi/contracts';
import { Body, Controller, Delete, Get, HttpCode, Post, Put, UseGuards } from '@nestjs/common';
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
 * The caller's own identity → /api/v1/me/identity (ADR-060, ADR-075 A1).
 *
 * Signed in and throttled per PERSON throughout. The scan is the tightest: ten
 * tries in ten minutes is room for bad light and a retake, and every try keeps
 * two photos. No route here sends a code to any phone (AC-4), and no response
 * carries a photo's object key (D-n).
 */
@Controller({ path: 'me/identity', version: '1' })
@UseGuards(SessionGuard, UserThrottlerGuard)
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  /** Where the caller stands, their latest scan, and whether a machine reads the ID here. */
  @Get()
  @Throttle({ money: { limit: 60, ttl: 60_000 } })
  status(@CurrentUser() user: SessionUser): Promise<IdentityStatus> {
    return this.identity.status(user.id);
  }

  /** The front of the card or the photo page, then a selfie, both uploaded first as `id_photo`. */
  @Post('scan')
  @HttpCode(200)
  @Throttle({ money: { limit: 10, ttl: 600_000 } })
  scan(
    @Body(new ZodValidationPipe(IdentityScanRequest)) body: IdentityScanRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<IdentityScanResult> {
    return this.identity.scan(user.id, body);
  }

  /**
   * A National ID checked by its number against the population register
   * (NIDA, through GTBank), with a selfie uploaded first as `id_photo`.
   * Throttled with the scan: both keep a photo, and both count as a try.
   */
  @Post('national-id')
  @HttpCode(200)
  @Throttle({ money: { limit: 10, ttl: 600_000 } })
  nationalId(
    @Body(new ZodValidationPipe(NationalIdCheckRequest)) body: NationalIdCheckRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<IdentityScanResult> {
    return this.identity.checkNationalId(user.id, body);
  }

  /** The details as printed, after a scan that read nothing or after the tries ran out. */
  @Put('document')
  @Throttle({ money: { limit: 10, ttl: 600_000 } })
  document(
    @Body(new ZodValidationPipe(TypedIdentityRequest)) body: TypedIdentityRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<IdentityStatus> {
    return this.identity.putTyped(user.id, body);
  }

  /**
   * "Use a different ID": drop the identity on file, so another one can be
   * checked. Refused once a business or broker record stands on it.
   */
  @Delete()
  @Throttle({ money: { limit: 10, ttl: 600_000 } })
  clear(@CurrentUser() user: SessionUser): Promise<IdentityStatus> {
    return this.identity.clear(user.id);
  }
}
