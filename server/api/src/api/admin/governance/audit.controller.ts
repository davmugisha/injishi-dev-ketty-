import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  AdminAuditQuery,
  type AdminAccessLogResponse,
  type AdminAuditResponse,
} from '@injishi/contracts';

import { SessionGuard } from '../../../shared/auth/session.guard';
import { RequireStaffPermission } from '../../../shared/auth/require-staff-permission.decorator';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { AdminAuditService } from './audit.service';

/**
 * The audit trail -> `GET /api/v1/admin/audit` (INTERFACE.md §8).
 *
 * `@UseGuards(SessionGuard, StaffGuard)` in that order — `StaffGuard` throws a
 * 500 rather than treating the request as anonymous when the session guard did
 * not run first.
 *
 * READING THE TRAIL IS ITSELF A DISCLOSURE, which is why `admin.audit.read`
 * gates both routes and is not implied by any other admin permission: the log
 * names who looked at whom, and handing that to everyone with a console seat
 * would make the record of a leak into the leak.
 *
 * NO REASON GATE ON THESE ROUTES. `record_access_logs` is about reads of a
 * PERSON'S records; this route returns the log itself, whose rows are already
 * the accountability artefact. INTERFACE.md marks neither route PII and this
 * leaf does not add a gate the seam did not agree.
 */
@Controller({ path: 'admin/audit', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminAuditController {
  constructor(private readonly audit: AdminAuditService) {}

  /**
   * Who read whose record.
   *
   * DECLARED FIRST, before the event log and before any parameterised route.
   * Nest matches in declaration order, so a parameterised `:id` route sitting
   * above this would swallow `access-logs` as an id and answer the wrong
   * question with a 200. There is no such route here today; the ordering is
   * kept so adding one later cannot silently break this one.
   */
  @Get('access-logs')
  @RequireStaffPermission('admin.audit.read')
  listAccessLogs(): Promise<AdminAccessLogResponse> {
    return this.audit.listAccessLogs();
  }

  /** What the platform did, newest first. */
  @Get()
  @RequireStaffPermission('admin.audit.read')
  listEvents(
    @Query(new ZodValidationPipe(AdminAuditQuery)) query: AdminAuditQuery,
  ): Promise<AdminAuditResponse> {
    return this.audit.listEvents(query);
  }
}
