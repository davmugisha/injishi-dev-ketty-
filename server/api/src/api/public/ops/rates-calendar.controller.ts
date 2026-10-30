import { type RatesCalendar, RatesDaysUpdate, type RatesSpecialDates, RatesTermsUpdate } from '@injishi/contracts';
import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';

import { RatesCalendarService } from '../../../modules/platform/property/application/rates-calendar.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { SessionGuard } from '../../../shared/auth/session.guard';
import { CurrentWorkspace, RequirePermission, WorkspaceGuard } from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Prices and availability → /api/v1/ops/rates (2026-10-29), under `listing.manage`: the calendar, a run
 * of days' price, closing and shortest stay, and a room type's own price, stay bounds and long stay
 * discounts. Each write answers the calendar as it now stands.
 */
@Controller({ path: 'ops/rates', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequirePermission('listing.manage')
export class OpsRatesCalendarController {
  constructor(private readonly rates: RatesCalendarService) {}

  @Get('calendar')
  calendar(
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<RatesCalendar> {
    return this.rates.calendar(workspace, { from, to });
  }

  @Get('special-dates')
  specialDates(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<RatesSpecialDates> {
    return this.rates.specialDates(workspace);
  }

  @Put('days')
  days(
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @Body(new ZodValidationPipe(RatesDaysUpdate)) body: RatesDaysUpdate,
  ): Promise<RatesCalendar> {
    return this.rates.writeDays(workspace, body);
  }

  @Put('terms')
  terms(
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @Body(new ZodValidationPipe(RatesTermsUpdate)) body: RatesTermsUpdate,
  ): Promise<RatesCalendar> {
    return this.rates.writeTerms(workspace, body);
  }
}
