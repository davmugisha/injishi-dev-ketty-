import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AdminModeration } from '@injishi/contracts';

import { SessionGuard } from '../../../shared/auth/session.guard';
import { RequireStaffPermission } from '../../../shared/auth/require-staff-permission.decorator';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import { AdminModerationService } from './moderation.service';

/**
 * The moderation desk -> `GET /api/v1/admin/moderation` (INTERFACE.md §11).
 *
 * `@UseGuards(SessionGuard, StaffGuard)` in that order — `StaffGuard` throws a
 * 500 rather than treating the request as anonymous when the session guard did
 * not run first.
 *
 * GATED ON `admin.moderation.act` FOR A READ, which looks stricter than it
 * needs to be and is not. The queue is a list of complaints about named people
 * and the words they wrote; the only reason to open it is to act on it, and
 * `staff-authz.ts` defines no separate view permission for this section. Using
 * the act permission for the read follows the seam rather than inventing a
 * `admin.moderation.view` that the one permission model does not have.
 */
@Controller({ path: 'admin/moderation', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminModerationController {
  constructor(private readonly moderation: AdminModerationService) {}

  @Get()
  @RequireStaffPermission('admin.moderation.act')
  read(): Promise<AdminModeration> {
    return this.moderation.read();
  }
}
