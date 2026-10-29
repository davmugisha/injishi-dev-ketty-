import {
  FAULT_REOPEN_DAYS,
  FAULT_STATUS_LABEL,
  OPEN_TICKET_STATUSES,
  faultReopenUntil,
  ticketMayMove,
  type MaintenanceStatus,
  type WorkOrderEventKind,
} from '@injishi/contracts';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import type { Db } from '../infrastructure/room-events';

/** Who wrote a timeline row (`maintenance_raised_by_role`). */
export type TicketActorRole = 'tenant' | 'staff' | 'housekeeper' | 'guest';

/** A ticket as the lifecycle reads it, locked. */
export interface TicketState {
  id: string;
  status: MaintenanceStatus;
  leaseId: string | null;
  resolvedAt: Date | null;
  assignedToUserId: string | null;
  assignedContractor: string | null;
  assignedContractorPhone: string | null;
}

export interface TicketMove {
  ticketId: string;
  to: MaintenanceStatus;
  actorUserId: string | null;
  actorRole: TicketActorRole | null;
  /** What the person wrote. Required for `wont_fix`: it is the reason the tenant is told. */
  note?: string | null;
  /** Whether the tenant's timeline shows the row. Default: when the ticket is on a lease. */
  visibleToTenant?: boolean;
  /** The timeline kind, when a caller names its step (a hotel's `fixed` with the fix written). */
  eventKind?: WorkOrderEventKind;
  /**
   * The tenant's reopen: allowed only within `FAULT_REOPEN_DAYS` of the
   * ticket being settled, counted from `today` (a Kigali day).
   */
  tenantReopen?: { today: string };
}

export interface TicketMoveOutcome {
  moved: boolean;
  from: MaintenanceStatus;
  to: MaintenanceStatus;
  eventId: string | null;
  ticket: TicketState;
}

export type TicketAssignee =
  | { kind: 'member'; userId: string; name: string }
  | { kind: 'contractor'; name: string; phone: string | null };

export interface TicketAssignment {
  ticketId: string;
  assignee: TicketAssignee;
  actorUserId: string | null;
  actorRole: TicketActorRole | null;
  note?: string | null;
  visibleToTenant?: boolean;
  /** The states a ticket may still be handed over in. Default: any but closed, won't fix and cancelled. */
  allowedFrom?: readonly MaintenanceStatus[];
}

/** The timeline kind each move writes. `open` is only ever reached by a reopen. */
const KIND_OF: Readonly<Record<MaintenanceStatus, WorkOrderEventKind>> = {
  open: 'reopened',
  acknowledged: 'acknowledged',
  assigned: 'assigned',
  in_progress: 'started',
  resolved: 'fixed',
  closed: 'closed',
  wont_fix: 'wont_fix',
  cancelled: 'cancelled',
};

/** The words for a state in a refusal: "a fixed fault", "an in progress fault". */
function stateWords(status: MaintenanceStatus): string {
  const label = FAULT_STATUS_LABEL[status].toLowerCase();
  return `${/^[aeiou]/.test(label) ? 'an' : 'a'} ${label === "won't fix" ? '"won\'t fix"' : label}`;
}

/** The 409 for a move the chain does not allow, with where the ticket stands. */
export function illegalMove(from: MaintenanceStatus, to: MaintenanceStatus): ConflictException {
  return new ConflictException({
    code: 'ticket_move',
    current: from,
    currentLabel: FAULT_STATUS_LABEL[from],
    message: `This is ${stateWords(from)} fault, so it can't go to ${FAULT_STATUS_LABEL[to]}.`,
  });
}

/**
 * The one ticket lifecycle (blueprint 1.3, WP 4.1), shared by the hotel's work
 * orders, the old tickets board and the rentals faults: every status change of
 * a `maintenance_tickets` row goes through `move`, and every hand over through
 * `assign`, inside the caller's transaction with the ticket locked.
 *
 * The rule is `TICKET_MOVES` in contracts, so the screens and the API agree:
 * open (Reported) > acknowledged (Seen) > assigned > in progress > resolved
 * (Fixed) > closed, skipping forward allowed, one step back inside the open
 * states, `wont_fix` (with its reason) and `cancelled` from any open state,
 * and back to open from fixed, closed or won't fix. The tenant's reopen is
 * also held to 14 days from when the ticket was settled (`resolved_at`, set
 * on fixed and on won't fix, kept on close, cleared on reopen).
 *
 * Staying where it is is not a move: answered `moved: false`, so a retried
 * press is harmless. Every real move writes one timeline row with where it
 * went from and to, who did it, and whether the tenant sees it.
 *
 * Stateless, so the operations and rentals modules each provide one.
 */
@Injectable()
export class TicketLifecycle {
  /** The ticket, locked for the rest of the caller's transaction, or null. */
  async lock(tx: Db, ticketId: string): Promise<TicketState | null> {
    const found = await tx.execute<{
      id: string;
      status: MaintenanceStatus;
      lease_id: string | null;
      resolved_at: Date | null;
      assigned_to_user_id: string | null;
      assigned_contractor: string | null;
      assigned_contractor_phone: string | null;
    }>(sql`
      select id, status, lease_id, resolved_at, assigned_to_user_id, assigned_contractor, assigned_contractor_phone
        from maintenance_tickets where id = ${ticketId} for update
    `);
    const r = found.rows[0];
    if (!r) return null;
    return {
      id: r.id,
      status: r.status,
      leaseId: r.lease_id,
      resolvedAt: r.resolved_at ? new Date(r.resolved_at) : null,
      assignedToUserId: r.assigned_to_user_id,
      assignedContractor: r.assigned_contractor,
      assignedContractorPhone: r.assigned_contractor_phone,
    };
  }

  /** Move a ticket, or refuse with a 409 that says where it stands. */
  async move(tx: Db, input: TicketMove): Promise<TicketMoveOutcome> {
    const ticket = await this.lock(tx, input.ticketId);
    if (!ticket) throw new NotFoundException('Fault not found.');
    const from = ticket.status;
    const note = input.note?.trim() ? input.note.trim() : null;
    if (from === input.to) return { moved: false, from, to: from, eventId: null, ticket };
    if (!ticketMayMove(from, input.to)) throw illegalMove(from, input.to);
    if (input.to === 'wont_fix' && (!note || note.length < 3)) {
      throw new BadRequestException({
        message: "Say why it won't be fixed. The tenant is told.",
        issues: [{ path: ['note'], message: "Say why it won't be fixed. The tenant is told." }],
      });
    }
    if (input.tenantReopen) {
      if (input.to !== 'open') throw illegalMove(from, input.to);
      if (!faultReopenUntil(from, ticket.resolvedAt, input.tenantReopen.today)) {
        throw new ConflictException({
          code: 'reopen_window',
          current: from,
          currentLabel: FAULT_STATUS_LABEL[from],
          message: `A fault can be reopened within ${FAULT_REOPEN_DAYS} days of being settled. Report it again as a new fault.`,
        });
      }
    }

    await tx.execute(sql`
      update maintenance_tickets
         set status = ${input.to}::maintenance_status,
             acknowledged_at = case when ${input.to} = 'acknowledged' then coalesce(acknowledged_at, now()) else acknowledged_at end,
             resolved_at = case
               when ${input.to} in ('resolved', 'wont_fix') then now()
               when ${input.to} = 'closed' then coalesce(resolved_at, now())
               when ${input.to} = 'open' then null
               else resolved_at end,
             wont_fix_reason = case when ${input.to} = 'wont_fix' then ${note} else null end,
             reopened_count = reopened_count + case when ${input.to} = 'open' then 1 else 0 end,
             updated_at = now()
       where id = ${ticket.id}
    `);
    const eventId = await this.event(tx, {
      ticketId: ticket.id,
      kind: input.eventKind ?? KIND_OF[input.to],
      from,
      to: input.to,
      note,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      visibleToTenant: input.visibleToTenant ?? ticket.leaseId !== null,
    });
    const after = (await this.lock(tx, ticket.id)) as TicketState;
    return { moved: true, from, to: input.to, eventId, ticket: after };
  }

  /**
   * Hand a ticket to someone on the team or to an outside fixer. A ticket
   * still waiting (open or seen) moves to assigned; one already being worked
   * keeps its state and changes hands. The same person again is no change.
   */
  async assign(tx: Db, input: TicketAssignment): Promise<TicketMoveOutcome> {
    const ticket = await this.lock(tx, input.ticketId);
    if (!ticket) throw new NotFoundException('Fault not found.');
    const from = ticket.status;
    const allowed = input.allowedFrom ?? (['open', 'acknowledged', 'assigned', 'in_progress', 'resolved'] as const);
    if (!allowed.includes(from)) {
      throw new ConflictException({
        code: 'ticket_move',
        current: from,
        currentLabel: FAULT_STATUS_LABEL[from],
        message: `This is ${stateWords(from)} fault, so it can't be handed to anyone. Reopen it first.`,
      });
    }
    const a = input.assignee;
    const same =
      a.kind === 'member'
        ? ticket.assignedToUserId === a.userId
        : ticket.assignedContractor === a.name && (ticket.assignedContractorPhone ?? null) === (a.phone ?? null);
    if (same) return { moved: false, from, to: from, eventId: null, ticket };
    const to: MaintenanceStatus = from === 'open' || from === 'acknowledged' ? 'assigned' : from;
    await tx.execute(sql`
      update maintenance_tickets
         set assignee_kind = ${a.kind}::maintenance_assignee_kind,
             assigned_to_user_id = ${a.kind === 'member' ? a.userId : null},
             assigned_contractor = ${a.kind === 'contractor' ? a.name : null},
             assigned_contractor_phone = ${a.kind === 'contractor' ? a.phone : null},
             status = ${to}::maintenance_status,
             updated_at = now()
       where id = ${ticket.id}
    `);
    const note = input.note?.trim() ? input.note.trim() : null;
    const eventId = await this.event(tx, {
      ticketId: ticket.id,
      kind: 'assigned',
      from,
      to,
      note: note ? `Assigned to ${a.name}. ${note}` : `Assigned to ${a.name}.`,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      visibleToTenant: input.visibleToTenant ?? ticket.leaseId !== null,
    });
    const after = (await this.lock(tx, ticket.id)) as TicketState;
    return { moved: from !== to, from, to, eventId, ticket: after };
  }

  /** A timeline row that is not a move: a note, a message, a payment. */
  async event(
    tx: Db,
    input: {
      ticketId: string;
      kind: WorkOrderEventKind;
      from?: MaintenanceStatus | null;
      to?: MaintenanceStatus | null;
      note: string | null;
      actorUserId: string | null;
      actorRole: TicketActorRole | null;
      visibleToTenant: boolean;
    },
  ): Promise<string> {
    const inserted = await tx.execute<{ id: string }>(sql`
      insert into maintenance_events
        (ticket_id, author_user_id, author_role, kind, note, from_status, to_status, visible_to_tenant, created_at)
      values (${input.ticketId}, ${input.actorUserId}, ${input.actorRole}::maintenance_raised_by_role,
              ${input.kind}::maintenance_event_kind, ${input.note},
              ${input.from ?? null}::maintenance_status, ${input.to ?? null}::maintenance_status,
              ${input.visibleToTenant}, clock_timestamp())
      returning id
    `);
    return inserted.rows[0]?.id as string;
  }
}

/** Is this ticket still being worked? (`OPEN_TICKET_STATUSES`) */
export function stillOpen(status: MaintenanceStatus): boolean {
  return OPEN_TICKET_STATUSES.includes(status);
}
