import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AdminEnvironments } from '@injishi/contracts';

import { SessionGuard } from '../../../../shared/auth/session.guard';
import { RequireStaffPermission } from '../../../../shared/auth/require-staff-permission.decorator';
import { StaffGuard } from '../../../../shared/auth/staff.guard';
import { AdminEnvironmentsService } from './environments.service';

/**
 * Environments & adapters → `GET /api/v1/admin/environments` (INTERFACE.md §10).
 *
 * `admin.environment.manage` guards a route that only READS. The permission is
 * named for the section rather than the verb, and this is the section a
 * super-admin uses to decide whether to flip a seam to live — knowing which
 * modes are set is itself the sensitive half of that. `staff-authz.ts` grants
 * it to `super_admin` alone; a wider `.view` permission does not exist and must
 * not be invented here.
 */
@Controller({ path: 'admin/environments', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminEnvironmentsController {
  constructor(private readonly environments: AdminEnvironmentsService) {}

  @Get()
  @RequireStaffPermission('admin.environment.manage')
  read(): Promise<AdminEnvironments> {
    return this.environments.read();
  }
}
