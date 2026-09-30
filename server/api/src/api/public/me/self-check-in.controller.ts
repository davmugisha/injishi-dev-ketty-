import {
  type SelfCheckInReceipt,
  SelfCheckInRequest,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { SelfCheckInService } from '../../../modules/operations/application/self-check-in.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { UserThrottlerGuard } from '../../../shared/http/user-throttler.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * A guest's own check-in before arrival → /api/v1/me/bookings/:id/check-in
 * (F-B09, ADR-038 child 5 AC-G8, ADR-060).
 *
 * The photo arrives first through `POST /api/v1/uploads` as `kind=id_photo`;
 * this takes its key, the document and an address, and keeps them against the
 * booking until the desk checks the guest in. Only the booking's own guest may
 * send it; anyone else is told the booking does not exist.
 */
@Controller({ path: 'me/bookings', version: '1' })
@UseGuards(SessionGuard, UserThrottlerGuard)
export class SelfCheckInController {
  constructor(private readonly selfCheckIn: SelfCheckInService) {}

  @Post(':id/check-in')
  @HttpCode(200)
  @Throttle({ money: { limit: 10, ttl: 600_000 } })
  submit(
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Body(new ZodValidationPipe(SelfCheckInRequest)) body: SelfCheckInRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<SelfCheckInReceipt> {
    return this.selfCheckIn.submit(user.id, bookingId, body);
  }
}
