import type { AdminConfiguration, AdminFeeSchedule } from '@injishi/contracts';
import { Controller, Get, UseGuards } from '@nestjs/common';

import { SessionGuard } from '../../../shared/auth/session.guard';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import { RequireStaffPermission } from '../../../shared/auth/require-staff-permission.decorator';
import { ConfigurationAdminService } from './configuration.service';

/**
 * The admin console's Configuration section -> `/api/v1/admin/configuration`
 * (F-A10).
 *
 * `@UseGuards(SessionGuard, StaffGuard)`, in that order, for the reason stated
 * on `StaffGuard` itself: it throws a 500 rather than treating the request as
 * anonymous when the session guard did not run first, so a wiring mistake is
 * noisy instead of looking like a working control.
 *
 * TWO permissions, not one, because the two screens are two jobs:
 * `admin.config.edit` gates the platform settings and the flags,
 * `admin.fee.edit` gates the price catalog. `staff-authz.ts` grants them to
 * different role sets, and collapsing them here would hand whoever may flip a
 * feature flag the power to read what the platform charges.
 *
 * ROUTE ORDER IS LOAD BEARING. `fees` is declared FIRST. Nest matches in
 * declaration order, so a parameterised route added above it later — a
 * `:configType` handler is the obvious next one — would swallow `/fees` and
 * serve the fee screen a config entry whose id is the literal string "fees".
 * Keep every named route above every parameterised one.
 */
@Controller({ path: 'admin/configuration', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminConfigurationController {
  constructor(private readonly config: ConfigurationAdminService) {}

  /** The fee catalog: registration fees, subscription plans, placement totals. */
  @Get('fees')
  @RequireStaffPermission('admin.fee.edit')
  fees(): Promise<AdminFeeSchedule> {
    return this.config.fees();
  }

  /** Every versioned platform setting and every feature flag. */
  @Get()
  @RequireStaffPermission('admin.config.edit')
  configuration(): Promise<AdminConfiguration> {
    return this.config.configuration();
  }
}
