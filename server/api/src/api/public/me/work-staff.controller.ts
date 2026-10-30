import { type LeaveApproverList, LeaveApproversQuery, type MyDocumentList, type NextPublicHoliday } from '@injishi/contracts';
import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';

import { MyStaffService } from '../../../modules/hr/application/my-staff.service';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The staff phone's own reads -> /api/v1/me/work/:employeeId (real-data 1.3.3): the person's papers,
 * who will decide their leave and the next public holiday. `SessionGuard` only, as every `me/work` route: ownership is the
 * guard, and an id that is not the caller's answers 404.
 */
@Controller({ path: 'me/work', version: '1' })
@UseGuards(SessionGuard)
export class MeWorkStaffController {
  constructor(private readonly staff: MyStaffService) {}

  @Get(':employeeId/documents')
  documents(@Param('employeeId', ParseUUIDPipe) employeeId: string, @CurrentUser() user: SessionUser): Promise<MyDocumentList> {
    return this.staff.documents(user.id, employeeId);
  }

  @Get(':employeeId/leave/approvers')
  approvers(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query(new ZodValidationPipe(LeaveApproversQuery)) query: LeaveApproversQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveApproverList> {
    return this.staff.leaveApprovers(user.id, employeeId, query.leaveTypeId ?? null);
  }

  @Get(':employeeId/holidays/next')
  nextHoliday(@Param('employeeId', ParseUUIDPipe) employeeId: string, @CurrentUser() user: SessionUser): Promise<NextPublicHoliday> {
    return this.staff.nextHoliday(user.id, employeeId);
  }
}
