import {
  IdentityScanRequest,
  type IdentityScanResult,
  type IdentityStatus,
  TypedIdentityRequest,
} from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Post, Put, UseGuards } from '@nestjs/common';
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

  /** The details as printed, after a scan that read nothing or after the tries ran out. */
  @Put('document')
  @Throttle({ money: { limit: 10, ttl: 600_000 } })
  document(
    @Body(new ZodValidationPipe(TypedIdentityRequest)) body: TypedIdentityRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<IdentityStatus> {
    return this.identity.putTyped(user.id, body);
  }
}
