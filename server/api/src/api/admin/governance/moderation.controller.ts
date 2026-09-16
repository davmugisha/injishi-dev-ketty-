import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import {
  type AdminModeration,
  AdminReasonQuery,
  type AdminSupportTicketDetail,
} from '@injishi/contracts';

import { CurrentUser, SessionGuard } from '../../../shared/auth/session.guard';
import type { SessionUser } from '../../../shared/auth/session.guard';
import { RequireStaffPermission } from '../../../shared/auth/require-staff-permission.decorator';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
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

  /**
   * One support ticket with the message and the contact details (demo-comms,
   * 2026-09-14) — the reason-gated ticket read `progress-tracker.md` recorded
   * as owed.
   *
   * `reason` rides on the query, as it does on every other reason-bearing read,
   * and is REQUIRED: `AdminReasonQuery` floors it at four characters and a
   * missing one is 400 before the service runs. The same view permission as the
   * list, because reading a ticket is how the desk answers it; what the reason
   * adds is the access log row naming this staffer and this ticket.
   */
  @Get('tickets/:ticketId')
  @RequireStaffPermission('admin.moderation.view')
  readTicket(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Query(new ZodValidationPipe(AdminReasonQuery)) stated: AdminReasonQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<AdminSupportTicketDetail> {
    return this.moderation.readTicket(ticketId, user.id, stated.reason);
  }
}
