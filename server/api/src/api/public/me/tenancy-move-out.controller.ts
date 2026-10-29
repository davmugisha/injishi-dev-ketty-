import { DisputeDepositRequest, TenantNoticeRequest, type TenancyMoveOut } from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { DepositsService } from '../../../modules/rentals/application/deposits.service';
import { MoveOutsService } from '../../../modules/rentals/application/move-outs.service';
import type { TenancyRef } from '../../../modules/rentals/application/tenancies.service';
import { SessionGuard } from '../../../shared/auth/session.guard';
import { UserThrottlerGuard } from '../../../shared/http/user-throttler.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { CurrentTenancy, TenancyGuard } from './tenancy.guard';

/**
 * The tenant's moving out → /api/v1/me/tenancies/:leaseId (blueprint 2.4, WP 1.7).
 *
 * Session and the tenant's own lease (`TenancyGuard`, 404 for anyone else's):
 * what the Moving out page shows, giving notice (at least the lease's notice
 * days away, never after its last day), withdrawing it until the landlord
 * acknowledges it, and disputing a deposit settlement. Writes are throttled.
 */
@Controller({ path: 'me/tenancies', version: '1' })
@UseGuards(SessionGuard)
export class MeTenancyMoveOutController {
  constructor(
    private readonly moveOuts: MoveOutsService,
    private readonly deposits: DepositsService,
  ) {}

  @Get(':leaseId/move-out')
  @UseGuards(TenancyGuard)
  view(@CurrentTenancy() tenancy: TenancyRef): Promise<TenancyMoveOut> {
    return this.moveOuts.tenantView(tenancy);
  }

  @Post(':leaseId/notice')
  @HttpCode(200)
  @UseGuards(TenancyGuard, UserThrottlerGuard)
  @Throttle({ money: { limit: 10, ttl: 60_000 } })
  giveNotice(
    @CurrentTenancy() tenancy: TenancyRef,
    @Body(new ZodValidationPipe(TenantNoticeRequest)) body: TenantNoticeRequest,
  ): Promise<TenancyMoveOut> {
    return this.moveOuts.giveNotice(tenancy, body);
  }

  @Post(':leaseId/notice/withdraw')
  @HttpCode(200)
  @UseGuards(TenancyGuard, UserThrottlerGuard)
  @Throttle({ money: { limit: 10, ttl: 60_000 } })
  withdraw(@CurrentTenancy() tenancy: TenancyRef): Promise<TenancyMoveOut> {
    return this.moveOuts.withdrawNotice(tenancy);
  }

  @Post(':leaseId/deposit/dispute')
  @HttpCode(200)
  @UseGuards(TenancyGuard, UserThrottlerGuard)
  @Throttle({ money: { limit: 5, ttl: 60_000 } })
  async dispute(
    @CurrentTenancy() tenancy: TenancyRef,
    @Body(new ZodValidationPipe(DisputeDepositRequest)) body: DisputeDepositRequest,
  ): Promise<TenancyMoveOut> {
    await this.deposits.dispute(tenancy, body);
    return this.moveOuts.tenantView(tenancy);
  }
}
