import {
  AdvanceTicketRequest,
  RaiseTicketRequest,
  type OperatorTicket,
  type OperatorTicketList,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { ResidenceService } from '../../../modules/operations/application/residence.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequirePermission,
  RequireAnyProduct,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

// The old residence controllers that lived here (ops/leases, ops/rent-roll,
// ops/filings, ops/deposits) went with the rentals rebuild's migrations 0073 to
// 0080 (blueprint section 4): their tables were reshaped into one charge, one
// payment and one deposit record, and the rentals module replaces them. The
// tickets board stays, shared with hotel work orders, until the shared ticket
// rules land (blueprint WP 4.1).

/**
 * Maintenance tickets → /api/v1/ops/tickets (ADR-012 step 5).
 *
 * Both surfaces: a hotel work order names a room, a residence repair names a
 * lease or a room (ADR-016 D16 made `maintenance_tickets.lease_id` nullable).
 * So it is on wherever PMS or Residence is (ADR-076 slice G): a route two
 * products share declares both, never one of them.
 */
@Controller({ path: 'ops/tickets', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireAnyProduct('pms', 'residence')
export class OpsTicketsController {
  constructor(private readonly residence: ResidenceService) {}

  // The Maintenance leaf, on both navs, is behind `ticket.advance`.
  @Get()
  @RequirePermission('ticket.advance')
  async list(
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorTicketList> {
    return { tickets: await this.residence.listTickets(workspace) };
  }

  /**
   * Resolve a ticket, with the note that says what was done.
   *
   * `to` is optional and defaults to `resolved`, which is what every caller
   * meant while `maintenance_status` held only two values. ADR-016 widened it
   * to six, so a ticket can now be picked up and worked before it closes.
   *
   * The note stays required: `maintenance_events` is the only record of WHY a
   * ticket moved, and one that closed for no stated reason is the one a tenant
   * reopens next week.
   */
  @Post(':id/advance')
  @RequirePermission('ticket.advance')
  advance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AdvanceTicketRequest))
    body: AdvanceTicketRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<OperatorTicket> {
    return this.residence.advanceTicket(workspace, id, body, user.id);
  }

  /**
   * Raise a work order (ADR-016 slice 6, AC-11).
   *
   * New here, and it could not have existed before: `lease_id` was NOT NULL, so
   * a hotel had no way to make one. Name a room for a hospitality ticket or a
   * lease for a residence one; the database refuses a ticket that names
   * neither, because a work order nobody can locate is worse than none.
   *
   * `ticket.advance` rather than a new permission. It is the same board and the
   * same people, and a housekeeper who can close a ticket can raise one.
   */
  @Post()
  @RequirePermission('ticket.advance')
  raise(
    @Body(new ZodValidationPipe(RaiseTicketRequest)) body: RaiseTicketRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<OperatorTicket> {
    return this.residence.raiseTicket(workspace, body, user.id);
  }
}
