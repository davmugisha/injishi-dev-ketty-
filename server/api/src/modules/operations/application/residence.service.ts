import type {
  AdvanceLeaseRequest,
  AdvanceTicketRequest,
  LeaseStatus,
  MaintenanceStatus,
  RaiseTicketRequest,
  OperatorContractFiling,
  OperatorDeposit,
  OperatorLease,
  OperatorRentCharge,
  OperatorTicket,
  RecordRentRequest,
  ReturnDepositRequest,
  WorkspaceAccess,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { assertOwned } from '../../../shared/auth/assert-owned';
import { firstRentCharge, kigaliToday } from './first-rent-charge';
import {
  type ContractFilingRow,
  type DepositRow,
  type LeaseRow,
  type RentChargeRow,
  type TicketRow,
  ResidenceRepository,
} from '../infrastructure/residence.repository';

/**
 * Which lease states may follow which, and nothing else (ADR-012 step 5).
 *
 * Written as a table rather than as a chain of `if`s so the whole machine is
 * readable in one glance and an illegal jump — `draft` straight to `ended`, a
 * `cancelled` lease coming back to life — is refused by construction rather
 * than by whichever branch happened to be written first.
 *
 * `cancelled` and `ended` are terminal on purpose. A lease that ended and then
 * moved again would break the `leases_active_room_uk` promise that one room has
 * at most one active lease.
 */
const LEASE_NEXT: Record<LeaseStatus, readonly LeaseStatus[]> = {
  draft: ['pending_signature', 'cancelled'],
  pending_signature: ['active', 'cancelled'],
  active: ['ending'],
  ending: ['ended'],
  ended: [],
  cancelled: [],
};

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

  /** The clock, as a method so a test can pin the day rent falls due. */
  protected now(): Date {
    return new Date();
  }

  // --- Leases --------------------------------------------------------------

  async listLeases(ws: WorkspaceAccess): Promise<OperatorLease[]> {
    const rows = await this.residence.listLeases(ws.workspaceId);
    return rows.map((row) => this.presentLease(row));
  }

  /**
   * Move a lease one step.
   *
   * The caller names the state it means to reach. A bare "next" would be
   * shorter and is the wrong shape: a double click would then be
   * indistinguishable from a genuine second step, and the second click would
   * quietly end a lease that was only meant to go active.
   *
   * Going active is gated on both signatures, and that gate lives here rather
   * than in the screen because a screen is an affordance. A one sided lease
   * that reached `active` is a contract nobody agreed to.
   */
  async advanceLease(
    ws: WorkspaceAccess,
    leaseId: string,
    body: AdvanceLeaseRequest,
  ): Promise<OperatorLease> {
    const lease = assertOwned(await this.residence.findLease(leaseId), ws);

    if (lease.status === body.to) return this.presentLease(lease);

    const allowed = LEASE_NEXT[lease.status];
    if (!allowed.includes(body.to)) {
      throw new ConflictException(
        allowed.length === 0
          ? `This lease is ${lease.status} and cannot move again.`
          : `A ${lease.status} lease can only move to ${allowed.join(' or ')}.`,
      );
    }

    if (body.to === 'active' && !(lease.landlordSignedAt && lease.tenantSignedAt)) {
      throw new ConflictException(
        'Both sides have to sign before a lease can go active.',
      );
    }

    // Going active raises the first month of rent in the same write, so the
    // tenancy is on the rent roll the moment it is live.
    const firstCharge =
      body.to === 'active' ? firstRentCharge(lease, kigaliToday(this.now())) : null;
    const moved = await this.residence.advanceLease(
      lease.id,
      lease.status,
      body.to,
      firstCharge,
    );
    if (!moved) {
      throw new ConflictException(
        'This lease was just changed by someone else. Refresh to see where it stands.',
      );
    }

    return this.presentLease(await this.reread(leaseId));
  }

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

  // --- Rent ----------------------------------------------------------------

  async listRentRoll(ws: WorkspaceAccess): Promise<OperatorRentCharge[]> {
    const rows = await this.residence.listRentCharges(ws.workspaceId);
    return rows.map((row) => this.presentRentCharge(row));
  }

  /**
   * Record a rent payment (AC-14).
   *
   * The retry check comes FIRST, before the charge is even looked up. A retry
   * must answer with what the first call decided even if the world has moved
   * since — the month is now paid, the lease may have ended — because the
   * caller is asking "did my payment land", not "may I pay again".
   *
   * The ownership check still runs on the retry path. A key is not a
   * credential: someone else's key must not become a way to read someone else's
   * rent.
   */
  async recordRent(
    ws: WorkspaceAccess,
    leaseId: string,
    body: RecordRentRequest,
    idempotencyKey: string,
  ): Promise<OperatorRentCharge> {
    const already = await this.residence.findRentChargeByKey(idempotencyKey);
    if (already) {
      const owned = assertOwned(already, ws);
      if (owned.leaseId !== leaseId) {
        throw new ConflictException(
          'That Idempotency-Key was already used for a different lease.',
        );
      }
      return this.presentRentCharge(owned);
    }

    const lease = assertOwned(await this.residence.findLease(leaseId), ws);
    const charge = await this.residence.findRentCharge(lease.id, body.periodMonth);
    if (!charge) {
      throw new BadRequestException(
        `No rent is charged on this lease for ${body.periodMonth}.`,
      );
    }
    if (charge.status === 'paid') {
      throw new ConflictException('That month is already settled.');
    }

    const paid = (charge.paidAmountRwf ?? 0) + body.amountRwf;
    const owed = charge.amountRwf ?? 0;
    if (paid > owed) {
      // Refused rather than accepted and flagged. An overpayment is either a
      // typo or a credit, and a credit has nowhere to live in this schema, so
      // silently storing more than was owed would be a number nobody can
      // reconcile later.
      throw new BadRequestException(
        `That is more than is owed for ${body.periodMonth}. Outstanding: ${owed - (charge.paidAmountRwf ?? 0)} RWF.`,
      );
    }

    const written = await this.residence.recordRent({
      chargeId: charge.id,
      paidAmountRwf: paid,
      fullyPaid: paid >= owed,
      idempotencyKey,
    });
    if (!written) {
      throw new ConflictException(
        'This month was just recorded by someone else. Refresh to see it.',
      );
    }

    const updated = await this.residence.findRentCharge(lease.id, body.periodMonth);
    if (!updated) throw this.vanished();
    return this.presentRentCharge(updated);
  }

  // --- Contract filings ----------------------------------------------------

  /**
   * Every lease and the filing of its contract (F-R10).
   *
   * Ordered so the rows that need a person come first: a refused filing, then
   * one whose fifteen days have run out, then the rest newest tenancy first.
   * A landlord opens this lens to find out what is wrong, and a list that
   * buries the one refusal under nine successes has answered a different
   * question.
   */
  async listContractFilings(ws: WorkspaceAccess): Promise<OperatorContractFiling[]> {
    const rows = await this.residence.listContractFilings(ws.workspaceId);
    const now = this.now();
    const urgency = (row: ContractFilingRow): number => {
      if (row.status === 'failed') return 0;
      if (row.status === 'pending' && row.dueBy && row.dueBy < now) return 1;
      if (row.status === 'pending') return 2;
      // A live lease with no filing at all is a gap, not a success.
      if (row.status === null && row.leaseStatus !== 'cancelled') return 3;
      return 4;
    };
    return rows
      .map((row, i) => ({ row, i }))
      .sort((a, b) => urgency(a.row) - urgency(b.row) || a.i - b.i)
      .map(({ row }) => this.presentContractFiling(row));
  }

  private presentContractFiling(row: ContractFilingRow): OperatorContractFiling {
    return {
      leaseId: row.leaseId,
      unitLabel: row.unitLabel,
      tenantName: row.tenantName,
      leaseStatus: row.leaseStatus,
      status: row.status,
      clockStartAt: row.clockStartAt?.toISOString() ?? null,
      dueBy: row.dueBy?.toISOString() ?? null,
      attempts: row.attempts ?? 0,
      failureReason: row.failureReason,
      adapterMode: row.adapterMode,
      signedAt: row.signedAt?.toISOString() ?? null,
    };
  }

  // --- Deposits ------------------------------------------------------------

  async listDeposits(ws: WorkspaceAccess): Promise<OperatorDeposit[]> {
    const rows = await this.residence.listDeposits(ws.workspaceId);
    return rows.map((row) => this.presentDeposit(row));
  }

  /**
   * Return a caution deposit, in whole or in part (AC-14).
   *
   * The two halves must add up to what was held, and that is checked here
   * rather than trusted. A settlement whose parts do not equal the whole is
   * money that vanished, and it is the exact figure a tenant will dispute.
   */
  async returnDeposit(
    ws: WorkspaceAccess,
    holdId: string,
    body: ReturnDepositRequest,
    idempotencyKey: string,
  ): Promise<OperatorDeposit> {
    const already = await this.residence.findDepositByKey(idempotencyKey);
    if (already) {
      const owned = assertOwned(already, ws);
      if (owned.id !== holdId) {
        throw new ConflictException(
          'That Idempotency-Key was already used for a different deposit.',
        );
      }
      return this.presentDeposit(owned);
    }

    const hold = assertOwned(await this.residence.findDeposit(holdId), ws);
    if (hold.status !== 'held') {
      throw new ConflictException('This deposit has already been settled.');
    }

    const held = hold.amountRwf ?? 0;
    const split = body.refundedRwf + body.forfeitedRwf;
    if (split !== held) {
      throw new BadRequestException(
        `The refund and the amount kept have to add up to the ${held} RWF held. You sent ${split}.`,
      );
    }

    const settled = await this.residence.returnDeposit({
      holdId: hold.id,
      leaseId: hold.leaseId,
      escrowId: hold.escrowId,
      refundedRwf: body.refundedRwf,
      forfeitedRwf: body.forfeitedRwf,
      reason: body.reason ?? null,
      idempotencyKey,
    });
    if (!settled) {
      throw new ConflictException(
        'This deposit was just settled by someone else. Refresh to see it.',
      );
    }

    const updated = await this.residence.findDeposit(holdId);
    if (!updated) throw this.vanished();
    return this.presentDeposit(updated);
  }

  // --- Presentation --------------------------------------------------------

  private async reread(leaseId: string): Promise<LeaseRow> {
    const row = await this.residence.findLease(leaseId);
    if (!row) throw this.vanished();
    return row;
  }

  private presentLease(row: LeaseRow): OperatorLease {
    return {
      id: row.id,
      roomId: row.roomId,
      unitLabel: row.unitLabel,
      tenantName: row.tenantName,
      monthlyRentRwf: row.monthlyRentRwf,
      cautionRwf: row.cautionRwf,
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
      landlordSignedAt: row.landlordSignedAt?.toISOString() ?? null,
      tenantSignedAt: row.tenantSignedAt?.toISOString() ?? null,
    };
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

  private presentRentCharge(row: RentChargeRow): OperatorRentCharge {
    return {
      id: row.id,
      leaseId: row.leaseId,
      unitLabel: row.unitLabel,
      tenantName: row.tenantName,
      periodMonth: row.periodMonth,
      amountRwf: row.amountRwf,
      paidAmountRwf: row.paidAmountRwf,
      status: row.status,
      dueDate: row.dueDate,
      paidAt: row.paidAt?.toISOString() ?? null,
    };
  }

  private presentDeposit(row: DepositRow): OperatorDeposit {
    return {
      id: row.id,
      leaseId: row.leaseId,
      unitLabel: row.unitLabel,
      tenantName: row.tenantName,
      amountRwf: row.amountRwf,
      status: row.status,
      heldAt: row.heldAt.toISOString(),
      settlement: row.settledAt
        ? {
            refundedRwf: row.refundedRwf,
            forfeitedRwf: row.forfeitedRwf,
            reason: row.settlementReason,
            settledAt: row.settledAt.toISOString(),
          }
        : null,
    };
  }

  private vanished(): BadRequestException {
    return new BadRequestException(
      'That record changed while we were writing it. Refresh and try again.',
    );
  }
}
