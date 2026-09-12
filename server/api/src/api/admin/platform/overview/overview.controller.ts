import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AdminOverview } from '@injishi/contracts';

import { SessionGuard } from '../../../../shared/auth/session.guard';
import { RequireStaffPermission } from '../../../../shared/auth/require-staff-permission.decorator';
import { StaffGuard } from '../../../../shared/auth/staff.guard';
import { AdminOverviewService } from './overview.service';

/**
 * Overview → `GET /api/v1/admin/overview` (INTERFACE.md §1).
 *
 * `SessionGuard` BEFORE `StaffGuard`, always. The order is the contract:
 * `StaffGuard` throws a 500 rather than treating an unauthenticated request as
 * anonymous, so reversing them turns a security control into a loud crash
 * instead of a quiet pass — which is the point, but only if the order is right
 * here in the first place.
 *
 * One route, one round trip. The landing screen shows six panels and could
 * have been six requests; it is one because a console whose KPI strip, work
 * queue and adapter table arrive at different moments shows six different
 * instants of the platform side by side, and a reader compares them.
 */
@Controller({ path: 'admin/overview', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminOverviewController {
  constructor(private readonly overview: AdminOverviewService) {}

  @Get()
  @RequireStaffPermission('admin.overview.view')
  read(): Promise<AdminOverview> {
    return this.overview.read();
  }
}
