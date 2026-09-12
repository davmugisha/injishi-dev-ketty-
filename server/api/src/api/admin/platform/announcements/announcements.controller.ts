import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AdminAnnouncementResponse } from '@injishi/contracts';

import { SessionGuard } from '../../../../shared/auth/session.guard';
import { RequireStaffPermission } from '../../../../shared/auth/require-staff-permission.decorator';
import { StaffGuard } from '../../../../shared/auth/staff.guard';
import { AdminAnnouncementsService } from './announcements.service';

/**
 * Announcements → `GET /api/v1/admin/announcements` (INTERFACE.md §12).
 *
 * `admin.announcement.publish` on a read, deliberately. The list carries
 * unpublished drafts — text nobody has decided to say yet — so the people who
 * may see it are exactly the people who may publish it. There is no separate
 * view permission in `staff-authz.ts` and inventing one here would be a new
 * entry in a model this file does not own.
 */
@Controller({ path: 'admin/announcements', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminAnnouncementsController {
  constructor(private readonly announcements: AdminAnnouncementsService) {}

  @Get()
  @RequireStaffPermission('admin.announcement.publish')
  list(): Promise<AdminAnnouncementResponse> {
    return this.announcements.list();
  }
}
