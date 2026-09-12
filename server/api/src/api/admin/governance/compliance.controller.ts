import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AdminCompliance } from '@injishi/contracts';

import { SessionGuard } from '../../../shared/auth/session.guard';
import { RequireStaffPermission } from '../../../shared/auth/require-staff-permission.decorator';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import { AdminComplianceService } from './compliance.service';

/**
 * The NCSA posture and the data subject queue -> `GET /api/v1/admin/compliance`
 * (INTERFACE.md §7).
 *
 * `@UseGuards(SessionGuard, StaffGuard)` in that order — `StaffGuard` throws a
 * 500 rather than treating the request as anonymous when the session guard did
 * not run first.
 *
 * `subjectUserId` on a request row is an id and nothing else: no name, no
 * email. Whose request it is can be resolved on the user screen by somebody
 * holding `admin.user.view`, with a reason recorded. A compliance officer
 * working the queue needs to know a request EXISTS and how old it is, which is
 * not the same as needing to know who filed it.
 */
@Controller({ path: 'admin/compliance', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminComplianceController {
  constructor(private readonly compliance: AdminComplianceService) {}

  @Get()
  @RequireStaffPermission('admin.compliance.view')
  read(): Promise<AdminCompliance> {
    return this.compliance.read();
  }
}
