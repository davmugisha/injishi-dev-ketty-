import { BrokerFeeCheckoutRequest, type BrokerFeePayment, type BrokerFeeQuote } from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { BrokerRegistrationFeeService } from '../../../modules/brokers/application/broker-registration-fee.service';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { IdempotencyKey } from '../../../shared/http/idempotency-key';
import { UserThrottlerGuard } from '../../../shared/http/user-throttler.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The broker registration fee → /api/v1/registrations/broker/fee (2026-10-25).
 *
 * Session only: the registrant has no workspace yet. What it costs (and a
 * payment already made), a prompt to the payer's phone (Idempotency-Key, so a
 * retried press is the same payment), and where that payment stands, polled
 * while the prompt waits. Another person's payment is not found.
 */
@Controller({ path: 'registrations/broker/fee', version: '1' })
@UseGuards(SessionGuard)
export class RegistrationBrokerFeeController {
  constructor(private readonly fees: BrokerRegistrationFeeService) {}

  @Get()
  quote(@CurrentUser() user: SessionUser): Promise<BrokerFeeQuote> {
    return this.fees.quote(user.id);
  }

  @Post()
  @HttpCode(200)
  @UseGuards(UserThrottlerGuard)
  @Throttle({ money: { limit: 6, ttl: 60_000 } })
  checkout(
    @Body(new ZodValidationPipe(BrokerFeeCheckoutRequest)) body: BrokerFeeCheckoutRequest,
    @IdempotencyKey() key: string,
    @CurrentUser() user: SessionUser,
  ): Promise<BrokerFeePayment> {
    return this.fees.checkout(user.id, body, key);
  }

  @Get(':id')
  payment(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SessionUser): Promise<BrokerFeePayment> {
    return this.fees.payment(user.id, id);
  }
}
