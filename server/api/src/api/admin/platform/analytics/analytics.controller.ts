import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AdminAnalytics } from '@injishi/contracts';

import { SessionGuard } from '../../../../shared/auth/session.guard';
import { RequireStaffPermission } from '../../../../shared/auth/require-staff-permission.decorator';
import { StaffGuard } from '../../../../shared/auth/staff.guard';
import { AdminAnalyticsService } from './analytics.service';

/**
 * Analytics & insights → `GET /api/v1/admin/analytics` (INTERFACE.md §13).
 *
 * No PII trail on this route, and that is a property of the table rather than
 * an omission: `analytics_events` carries `opaque_actor_id`, never a user id,
 * so reading it is not reading a person's record. The moment a route here joins
 * an analytics row to `users`, it becomes a PII read and owes a
 * `record_access_logs` row and a required `reason` — the same rule the Users
 * and OBO routes follow.
 */
@Controller({ path: 'admin/analytics', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminAnalyticsController {
  constructor(private readonly analytics: AdminAnalyticsService) {}

  @Get()
  @RequireStaffPermission('admin.analytics.view')
  read(): Promise<AdminAnalytics> {
    return this.analytics.read();
  }
}
