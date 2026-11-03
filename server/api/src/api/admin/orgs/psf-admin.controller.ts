import {
  PsfBusinessesQuery,
  type PsfBusinessDetail,
  type PsfBusinessesPage,
  type PsfRegisterSummary,
} from '@injishi/contracts';
import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';

import { PsfMembershipService } from '../../../modules/organization/application/psf-membership.service';
import { SessionGuard } from '../../../shared/auth/session.guard';
import { RequireStaffPermission } from '../../../shared/auth/require-staff-permission.decorator';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * PSF memberships across Rwanda, for Injishi staff (2026-11-02): the same
 * register PSF's officers read in their region, over the whole country, with
 * each membership's end date, what is due for renewal, what lapsed, and what
 * was renewed. Read only: deciding stays with PSF's District Managers.
 */
@Controller({ path: 'admin/psf', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminPsfController {
  constructor(private readonly psf: PsfMembershipService) {}

  @Get('summary')
  @RequireStaffPermission('admin.business.view')
  summary(): Promise<PsfRegisterSummary> {
    return this.psf.summaryAcrossRwanda();
  }

  @Get('businesses')
  @RequireStaffPermission('admin.business.view')
  businesses(@Query(new ZodValidationPipe(PsfBusinessesQuery)) query: PsfBusinessesQuery): Promise<PsfBusinessesPage> {
    return this.psf.registerAcrossRwanda(query);
  }

  /** One business: its memberships, applications, payments and renewals. */
  @Get('businesses/:orgId')
  @RequireStaffPermission('admin.business.view')
  business(@Param('orgId', ParseUUIDPipe) orgId: string): Promise<PsfBusinessDetail> {
    return this.psf.businessAcrossRwanda(orgId);
  }
}
