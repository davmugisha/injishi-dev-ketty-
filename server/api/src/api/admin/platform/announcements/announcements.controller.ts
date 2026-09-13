import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AdminAnnouncementResponse } from '@injishi/contracts';

import { SessionGuard } from '../../../../shared/auth/session.guard';
import { RequireStaffPermission } from '../../../../shared/auth/require-staff-permission.decorator';
import { StaffGuard } from '../../../../shared/auth/staff.guard';
import { AdminAnnouncementsService } from './announcements.service';

/**
 * Announcements → `GET /api/v1/admin/announcements` (INTERFACE.md §12).
 *
 * `admin.announcement.view` on the read (ADR-053), held by `super_admin` and
 * `ops`. The list carries unpublished drafts, so the read is still narrower than
 * every staffer; publishing keeps `admin.announcement.publish`. It used to
 * borrow the publish permission because no view permission existed.
 */
@Controller({ path: 'admin/announcements', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminAnnouncementsController {
  constructor(private readonly announcements: AdminAnnouncementsService) {}

  @Get()
  @RequireStaffPermission('admin.announcement.view')
  list(): Promise<AdminAnnouncementResponse> {
    return this.announcements.list();
  }
}
