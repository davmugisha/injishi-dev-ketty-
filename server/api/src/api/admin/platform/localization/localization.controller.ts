import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AdminLocalization } from '@injishi/contracts';

import { SessionGuard } from '../../../../shared/auth/session.guard';
import { RequireStaffPermission } from '../../../../shared/auth/require-staff-permission.decorator';
import { StaffGuard } from '../../../../shared/auth/staff.guard';
import { AdminLocalizationService } from './localization.service';

/**
 * Localization → `GET /api/v1/admin/localization` (INTERFACE.md §14).
 *
 * `admin.localization.view` on the read (ADR-049), held by `super_admin`, `ops`
 * and `compliance`. Editing keeps `admin.localization.edit`. It used to borrow
 * the edit permission because no view permission existed.
 */
@Controller({ path: 'admin/localization', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminLocalizationController {
  constructor(private readonly localization: AdminLocalizationService) {}

  @Get()
  @RequireStaffPermission('admin.localization.view')
  read(): Promise<AdminLocalization> {
    return this.localization.read();
  }
}
