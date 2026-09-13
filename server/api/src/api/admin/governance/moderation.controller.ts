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
 * GATED ON `admin.moderation.view` (ADR-053), which `super_admin`, `ops` and
 * `compliance` hold. It used to borrow `admin.moderation.act` for the read
 * because no view permission existed, so only the roles that act could look.
 * The act keeps its own permission.
 */
@Controller({ path: 'admin/moderation', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminModerationController {
  constructor(private readonly moderation: AdminModerationService) {}

  @Get()
  @RequireStaffPermission('admin.moderation.view')
  read(): Promise<AdminModeration> {
    return this.moderation.read();
  }
}
