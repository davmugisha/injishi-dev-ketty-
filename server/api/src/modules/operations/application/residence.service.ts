import type {
  AdvanceTicketRequest,
  MaintenanceStatus,
  RaiseTicketRequest,
  OperatorTicket,
  WorkspaceAccess,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { assertOwned } from '../../../shared/auth/assert-owned';
import {
  type TicketRow,
  ResidenceRepository,
} from '../infrastructure/residence.repository';

/*
 * What is left of the first residence service: the tickets board, which hotel
 * work orders share (ADR-016 D16). Its lease, rent roll, filing and deposit
 * commands went with the rentals rebuild (migrations 0073 to 0080, blueprint
 * section 4); the rentals module replaces them, and the shared ticket rules
 * replace this file (blueprint WP 4.1).
 */

/**
 * `open -> assigned -> in_progress -> resolved -> closed`, and `cancelled` from
 * anywhere before `resolved` (ADR-016 D16).
 *
 * Written out rather than compared by position, because `cancelled` is
 * reachable from three states and `resolved` can reopen when the tenant says
 * the tap still drips.
 */
const TICKET_TRANSITIONS: Readonly<
  Record<MaintenanceStatus, MaintenanceStatus[]>
> = {
  open: ['assigned', 'in_progress', 'resolved', 'cancelled'],
  assigned: ['in_progress', 'resolved', 'cancelled'],
  in_progress: ['resolved', 'cancelled'],
  resolved: ['closed', 'open'],
  closed: [],
  cancelled: [],
};

@Injectable()
export class ResidenceService {
  constructor(private readonly residence: ResidenceRepository) {}

  // --- Tickets -------------------------------------------------------------

  async listTickets(ws: WorkspaceAccess): Promise<OperatorTicket[]> {
    const rows = await this.residence.listTickets(ws.workspaceId);
    const notes = await this.residence.countTicketNotes(rows.map((r) => r.id));
    return rows.map((row) => ({
      ...this.presentTicket(row),
      noteCount: notes.get(row.id) ?? 0,
    }));
  }

  /**
   * Resolve a ticket, with the note that says what was done.
   *
   * `maintenance_status` holds only `open` and `resolved`, so "advance" has
   * exactly one destination. The operator app shows four ticket states; the
   * middle two are demo store fiction with no column behind them, and inventing
   * them here would put a state in the database that nothing can read back.
   */
  async advanceTicket(
    ws: WorkspaceAccess,
    ticketId: string,
    body: AdvanceTicketRequest,
    authorUserId: string,
  ): Promise<OperatorTicket> {
    const ticket = assertOwned(await this.residence.findTicket(ticketId), ws);
    const to = body.to ?? 'resolved';

    // Already there. A second tap is not an error, and refusing it would make
    // an offline phone that retried look broken.
    if (ticket.status === to) return this.withNotes(ticket);

    if (!TICKET_TRANSITIONS[ticket.status].includes(to)) {
      throw new ConflictException(
        `A ${ticket.status.replace('_', ' ')} ticket cannot go straight to ${to.replace('_', ' ')}.`,
      );
    }

    const moved = await this.residence.advanceTicket({
      ticketId: ticket.id,
      from: ticket.status,
      to,
      note: body.note,
      authorUserId,
    });

    const updated = await this.residence.findTicket(ticketId);
    if (!updated) throw this.vanished();
    // Somebody else moved it between our read and our write. Their move is as
    // valid as ours would have been, so report where it landed.
    if (!moved) return this.withNotes(updated);
    return this.withNotes(updated);
  }

  /**
   * Raise a work order, on either surface (AC-11).
   *
   * `maintenance_tickets.lease_id` used to be NOT NULL, so this command could
   * not exist for a hotel at all. Migration phases 6 to 8 made the lease
   * optional and gave the row a room instead.
   */
  async raiseTicket(
    ws: WorkspaceAccess,
    body: RaiseTicketRequest,
    raisedByUserId: string,
  ): Promise<OperatorTicket> {
    if (body.roomId) {
      assertOwned(await this.residence.findRoomForTicket(body.roomId), ws);
    }
    if (body.leaseId) {
      assertOwned(await this.residence.findLease(body.leaseId), ws);
    }

    const id = await this.residence.raiseTicket({
      workspaceId: ws.workspaceId,
      request: body,
      raisedByUserId,
    });
    if (!id) throw this.vanished();

    const created = await this.residence.findTicket(id);
    if (!created) throw this.vanished();
    return this.withNotes(created);
  }

  private async withNotes(row: TicketRow): Promise<OperatorTicket> {
    const notes = await this.residence.countTicketNotes([row.id]);
    return { ...this.presentTicket(row), noteCount: notes.get(row.id) ?? 0 };
  }

  private presentTicket(row: TicketRow): Omit<OperatorTicket, 'noteCount'> {
    return {
      id: row.id,
      leaseId: row.leaseId,
      roomId: row.roomId,
      unitLabel: row.unitLabel,
      raisedByName: row.raisedByName,
      title: row.title,
      description: row.description,
      category: row.category,
      priority: row.priority,
      status: row.status,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private vanished(): BadRequestException {
    return new BadRequestException(
      'That record changed while we were writing it. Refresh and try again.',
    );
  }
}
