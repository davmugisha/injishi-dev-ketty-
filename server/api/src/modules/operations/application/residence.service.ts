import type {
  AdvanceTicketRequest,
  RaiseTicketRequest,
  OperatorTicket,
  WorkspaceAccess,
} from '@injishi/contracts';
import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';

import { assertOwned } from '../../../shared/auth/assert-owned';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import {
  type TicketRow,
  ResidenceRepository,
} from '../infrastructure/residence.repository';
import { TicketLifecycle } from '../../pms/application/ticket-lifecycle';

/*
 * What is left of the first residence service: the tickets board, which hotel
 * work orders share (ADR-016 D16). Its lease, rent roll, filing and deposit
 * commands went with the rentals rebuild (migrations 0073 to 0080, blueprint
 * section 4); the rentals module replaces them. Its ticket rules moved to the
 * shared `TicketLifecycle` (blueprint WP 4.1): this board, the hotel's work
 * orders and the rentals faults all move a ticket the one way.
 */

@Injectable()
export class ResidenceService {
  constructor(
    private readonly residence: ResidenceRepository,
    private readonly lifecycle: TicketLifecycle,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

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
   * Move a ticket, with the note that says why, through the shared ticket
   * lifecycle (`TICKET_MOVES`; 409 for a move the chain refuses). `to` is
   * `resolved` when absent. Already there is not an error: a second tap, or
   * an offline phone that retried, answers where the ticket stands.
   */
  async advanceTicket(
    ws: WorkspaceAccess,
    ticketId: string,
    body: AdvanceTicketRequest,
    authorUserId: string,
  ): Promise<OperatorTicket> {
    const ticket = assertOwned(await this.residence.findTicket(ticketId), ws);
    const to = body.to ?? 'resolved';
    await this.db.transaction((tx) =>
      this.lifecycle.move(tx, {
        ticketId: ticket.id,
        to,
        actorUserId: authorUserId,
        actorRole: 'staff',
        note: body.note,
        visibleToTenant: ticket.leaseId !== null,
      }),
    );
    const updated = await this.residence.findTicket(ticketId);
    if (!updated) throw this.vanished();
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
