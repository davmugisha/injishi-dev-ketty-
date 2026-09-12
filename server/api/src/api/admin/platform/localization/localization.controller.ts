import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AdminLocalization } from '@injishi/contracts';

import { SessionGuard } from '../../../../shared/auth/session.guard';
import { RequireStaffPermission } from '../../../../shared/auth/require-staff-permission.decorator';
import { StaffGuard } from '../../../../shared/auth/staff.guard';
import { AdminLocalizationService } from './localization.service';

/**
 * Localization → `GET /api/v1/admin/localization` (INTERFACE.md §14).
 *
 * `admin.localization.edit` on a read for the same reason Announcements uses
 * its publish permission: `staff-authz.ts` defines one permission for this
 * section, and the people who may see the untranslated backlog are the people
 * who may fill it in. A second, narrower permission would be a new entry in a
 * model this file does not own.
 */
@Controller({ path: 'admin/localization', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminLocalizationController {
  constructor(private readonly localization: AdminLocalizationService) {}

  @Get()
  @RequireStaffPermission('admin.localization.edit')
  read(): Promise<AdminLocalization> {
    return this.localization.read();
  }
}
