import { BrokerRatingRequest, type TenancyBrokerView } from '@injishi/contracts';
import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { LeaseBrokersService } from '../../../modules/rentals/application/lease-brokers.service';
import type { TenancyRef } from '../../../modules/rentals/application/tenancies.service';
import { SessionGuard } from '../../../shared/auth/session.guard';
import { UserThrottlerGuard } from '../../../shared/http/user-throttler.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { CurrentTenancy, TenancyGuard } from './tenancy.guard';

/**
 * The tenant rates the broker who found them the home → POST
 * /api/v1/me/tenancies/:leaseId/broker-rating (2026-10-25). Session plus
 * `TenancyGuard`: the caller's own lease, 404 for any other. Only once the
 * tenancy has started; rating again replaces the first.
 */
@Controller({ path: 'me/tenancies', version: '1' })
@UseGuards(SessionGuard)
export class MeTenancyBrokerController {
  constructor(private readonly brokers: LeaseBrokersService) {}

  @Post(':leaseId/broker-rating')
  @HttpCode(200)
  @UseGuards(TenancyGuard, UserThrottlerGuard)
  @Throttle({ money: { limit: 10, ttl: 60_000 } })
  rate(
    @CurrentTenancy() tenancy: TenancyRef,
    @Body(new ZodValidationPipe(BrokerRatingRequest)) body: BrokerRatingRequest,
  ): Promise<TenancyBrokerView> {
    return this.brokers.rateAsTenant(tenancy, body);
  }
}
