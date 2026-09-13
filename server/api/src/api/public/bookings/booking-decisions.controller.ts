import type {
  BookingApprovalResult,
  WorkspaceAccess,
} from '@injishi/contracts';
import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { BookingApprovalService } from '../../../modules/booking/application/booking-approval.service';
import { SessionGuard } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';

/**
 * The host's two decisions on a request to book → `/api/v1/bookings/:id/approve`
 * and `/decline` (F-B06, ADR-049 AC-A5).
 *
 * ITS OWN CONTROLLER, because its guards are not the guest's. `BookingsController`
 * is the guest's side of a stay and runs `SessionGuard` plus the per person
 * throttle: a guest holds no workspace, so there is nothing for `WorkspaceGuard`
 * to resolve on `POST /bookings`. A host deciding a booking acts FOR a business,
 * so these two run `SessionGuard` then `WorkspaceGuard` and declare
 * `reservation.approve`, the permission `/ops/reservations` declares for the same
 * decision. A receptionist may decide through both doors, and a business that
 * is not `active` holds no permissions and decides through neither.
 *
 * The caller names the workspace with the `x-workspace-id` header the operator
 * app already sends. Whether the booking sits in that workspace is the
 * service's check, answered 404 rather than 403.
 */
@Controller({ path: 'bookings', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class BookingDecisionsController {
  constructor(private readonly approvals: BookingApprovalService) {}

  @Post(':id/approve')
  @RequirePermission('reservation.approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<BookingApprovalResult> {
    return this.approvals.approve(id, workspace);
  }

  /** The same permission as approve: one decision with two answers. */
  @Post(':id/decline')
  @RequirePermission('reservation.approve')
  decline(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<BookingApprovalResult> {
    return this.approvals.decline(id, workspace);
  }
}
