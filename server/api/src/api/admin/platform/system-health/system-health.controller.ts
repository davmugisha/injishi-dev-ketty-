import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AdminSystemHealth } from '@injishi/contracts';

import { SessionGuard } from '../../../../shared/auth/session.guard';
import { RequireStaffPermission } from '../../../../shared/auth/require-staff-permission.decorator';
import { StaffGuard } from '../../../../shared/auth/staff.guard';
import { AdminSystemHealthService } from './system-health.service';

/**
 * System health → `GET /api/v1/admin/system-health` (INTERFACE.md §9).
 *
 * Guarded, unlike `GET /api/v1/health`. Queue depths, adapter error rates and
 * migration counts are a map of where the platform is weak, and the public
 * probe stays a bare "the process is up" precisely so this route can say more.
 */
@Controller({ path: 'admin/system-health', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminSystemHealthController {
  constructor(private readonly health: AdminSystemHealthService) {}

  @Get()
  @RequireStaffPermission('admin.system.view')
  read(): Promise<AdminSystemHealth> {
    return this.health.read();
  }
}
