import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AdminEnvironments } from '@injishi/contracts';

import { SessionGuard } from '../../../../shared/auth/session.guard';
import { RequireStaffPermission } from '../../../../shared/auth/require-staff-permission.decorator';
import { StaffGuard } from '../../../../shared/auth/staff.guard';
import { AdminEnvironmentsService } from './environments.service';

/**
 * Environments & adapters → `GET /api/v1/admin/environments` (INTERFACE.md §10).
 *
 * `admin.environment.view` on the read (ADR-053), held by `super_admin` and
 * `ops`. Flipping a seam keeps `admin.environment.manage`, `super_admin` alone.
 * It used to borrow the manage permission because no view permission existed.
 */
@Controller({ path: 'admin/environments', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminEnvironmentsController {
  constructor(private readonly environments: AdminEnvironmentsService) {}

  @Get()
  @RequireStaffPermission('admin.environment.view')
  read(): Promise<AdminEnvironments> {
    return this.environments.read();
  }
}
