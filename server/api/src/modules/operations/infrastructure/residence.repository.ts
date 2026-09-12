import type {
  LeaseStatus,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  RaiseTicketRequest,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import {
  cautionHolds,
  cautionSettlements,
  escrows,
  leases,
  maintenanceEvents,
  maintenanceTickets,
  rentCharges,
  rooms,
  users,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/** The same `rooms` table, joined a second time through the lease. */
const leaseRooms = alias(rooms, 'lease_rooms');

export interface LeaseRow {
  id: string;
  workspaceId: string;
  roomId: string;
  unitLabel: string | null;
  tenantName: string | null;
  monthlyRentRwf: number | null;
  cautionRwf: number | null;
  startDate: string | null;
  endDate: string | null;
  status: LeaseStatus;
  landlordSignedAt: Date | null;
  tenantSignedAt: Date | null;
}

export interface TicketRow {
  id: string;
  /** Null on a hospitality ticket. A hotel has no lease (ADR-016 D16). */
  leaseId: string | null;
  /** Null on a residence ticket raised against the lease rather than a room. */
  roomId: string | null;
  /** On the ticket itself since migration phase 8, not read through the lease. */
  workspaceId: string;
  unitLabel: string | null;
  raisedByName: string | null;
  title: string;
  description: string | null;
  category: MaintenanceCategory | null;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  resolvedAt: Date | null;
  createdAt: Date;
}

export interface RentChargeRow {
  id: string;
  leaseId: string;
  workspaceId: string;
  unitLabel: string | null;
  tenantName: string | null;
  periodMonth: string;
  amountRwf: number | null;
  paidAmountRwf: number | null;
  status: 'paid' | 'due' | 'overdue';
  dueDate: string | null;
  paidAt: Date | null;
  idempotencyKey: string | null;
}

export interface DepositRow {
  id: string;
  leaseId: string;
  workspaceId: string;
  unitLabel: string | null;
  tenantName: string | null;
  amountRwf: number | null;
  status: 'held' | 'refunded' | 'forfeited';
  escrowId: string | null;
  heldAt: Date;
  refundedRwf: number | null;
  forfeitedRwf: number | null;
  settlementReason: string | null;
  settledAt: Date | null;
}

/**
 * Residence operations for the landlord workspace (ADR-012 step 5).
 *
 * One thing shapes every query in this file: **`maintenance_tickets`,
 * `rent_charges`, `caution_holds` and `caution_settlements` carry no
 * `workspace_id` of their own.** They all hang off `leases`, which does carry
 * one. So each read joins through the lease and each single row read returns
 * the lease's `workspace_id` alongside, which is what `assertOwned` compares.
 *
 * The alternative — filtering by lease id and trusting the caller — is the hole
 * `assertOwned` exists to close, and it would be invisible in review because
 * the query would look complete.
 */
@Injectable()
export class ResidenceRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- Leases --------------------------------------------------------------

  async listLeases(workspaceId: string): Promise<LeaseRow[]> {
    return this.findLeases(eq(leases.workspaceId, workspaceId));
  }

  async findLease(leaseId: string): Promise<LeaseRow | null> {
    const [row] = await this.findLeases(eq(leases.id, leaseId));
    return row ?? null;
  }

  /**
   * Move a lease to a named state, only from the state the caller expected.
   *
   * Guarded on `from`, so two clicks cannot walk a lease two steps: the second
   * finds the row already moved and writes nothing.
   */
  async advanceLease(
    leaseId: string,
    from: LeaseStatus,
    to: LeaseStatus,
  ): Promise<boolean> {
    const [updated] = await this.db
      .update(leases)
      .set({ status: to, updatedAt: new Date() })
      .where(and(eq(leases.id, leaseId), eq(leases.status, from)))
      .returning({ id: leases.id });

    return Boolean(updated);
  }

  // --- Tickets -------------------------------------------------------------

  /**
   * Every work order in this workspace, on BOTH surfaces (ADR-016 D16, AC-11).
   *
   * Scoped on `maintenance_tickets.workspace_id`, which migration phase 8 made
   * NOT NULL. It used to scope on the LEASE's workspace through an inner join,
   * and that join was the residence only bug in person: a hotel ticket has no
   * lease, so it would have been filtered out of its own list.
   */
  async listTickets(workspaceId: string): Promise<TicketRow[]> {
    return this.findTickets(eq(maintenanceTickets.workspaceId, workspaceId));
  }

  async findTicket(ticketId: string): Promise<TicketRow | null> {
    const [row] = await this.findTickets(eq(maintenanceTickets.id, ticketId));
    return row ?? null;
  }

  async countTicketNotes(ticketIds: string[]): Promise<Map<string, number>> {
    const found = new Map<string, number>();
    if (ticketIds.length === 0) return found;

    const rows = await this.db
      .select({
        ticketId: maintenanceEvents.ticketId,
        n: sql<number>`count(*)::int`,
      })
      .from(maintenanceEvents)
      .where(inArray(maintenanceEvents.ticketId, ticketIds))
      .groupBy(maintenanceEvents.ticketId);

    for (const row of rows) found.set(row.ticketId, row.n);
    return found;
  }

  /**
   * Resolve a ticket and record WHY, in one transaction.
   *
   * The note is not optional decoration: `maintenance_events` is the only place
   * that says what was done, and a ticket that closed for no stated reason is
   * the one a tenant reopens next week.
   */
  async advanceTicket(input: {
    ticketId: string;
    from: MaintenanceStatus;
    to: MaintenanceStatus;
    note: string;
    authorUserId: string;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(maintenanceTickets)
        .set({
          status: input.to,
          resolvedAt:
            input.to === 'resolved' || input.to === 'closed' ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(maintenanceTickets.id, input.ticketId),
            eq(maintenanceTickets.status, input.from),
          ),
        )
        .returning({ id: maintenanceTickets.id });

      if (!updated) return false;

      await tx.insert(maintenanceEvents).values({
        ticketId: input.ticketId,
        authorUserId: input.authorUserId,
        note: input.note,
      });

      return true;
    });
  }

  /**
   * Raise a work order on either surface (AC-11).
   *
   * The property, the org and the Engineering department are all derived from
   * whichever subject the request named, in the insert itself, so a caller
   * cannot get them wrong and there is no read-then-write race between them.
   *
   * `department_id` stays null when the property has no Engineering department
   * yet. A ticket raised before the department exists is still a real ticket,
   * and losing the report is worse than losing the attribution.
   */
  /**
   * The room a hospitality ticket names, read unscoped so the service can prove
   * it belongs to the caller and answer 404 rather than 403.
   */
  async findRoomForTicket(
    roomId: string,
  ): Promise<{ id: string; workspaceId: string } | null> {
    const [row] = await this.db
      .select({ id: rooms.id, workspaceId: rooms.workspaceId })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);
    return row ?? null;
  }

  async raiseTicket(input: {
    workspaceId: string;
    request: RaiseTicketRequest;
    raisedByUserId: string;
  }): Promise<string | null> {
    const r = input.request;
    const roomId = r.roomId ?? null;
    const leaseId = r.leaseId ?? null;
    const propertyOf = sql`COALESCE(
      (SELECT rm."property_id" FROM "rooms" rm WHERE rm."id" = ${roomId}),
      (SELECT rm."property_id" FROM "leases" l
         JOIN "rooms" rm ON rm."id" = l."room_id" WHERE l."id" = ${leaseId})
    )`;

    const [row] = await this.db
      .insert(maintenanceTickets)
      .values({
        workspaceId: input.workspaceId,
        leaseId,
        roomId,
        raisedByUserId: input.raisedByUserId,
        raisedByRole: leaseId ? 'tenant' : 'staff',
        title: r.title,
        description: r.description ?? null,
        category: r.category ?? null,
        priority: r.priority ?? 'normal',
        propertyId: propertyOf,
        orgId: sql`(SELECT p."org_id" FROM "properties" p WHERE p."id" = ${propertyOf})`,
        departmentId: sql`(
          SELECT d."id" FROM "departments" d
          WHERE d."department_category" = 'engineering'
            AND d."property_id" = ${propertyOf}
          LIMIT 1
        )`,
      })
      .returning({ id: maintenanceTickets.id });
    return row?.id ?? null;
  }

  // --- Rent ----------------------------------------------------------------

  async listRentCharges(workspaceId: string): Promise<RentChargeRow[]> {
    return this.findRentCharges(eq(leases.workspaceId, workspaceId));
  }

  async findRentCharge(
    leaseId: string,
    periodMonth: string,
  ): Promise<RentChargeRow | null> {
    const [row] = await this.findRentCharges(
      and(
        eq(rentCharges.leaseId, leaseId),
        eq(rentCharges.periodMonth, periodMonth),
      ) as SQL,
    );
    return row ?? null;
  }

  /** A charge already written under this key, if the caller is retrying. */
  async findRentChargeByKey(key: string): Promise<RentChargeRow | null> {
    const [row] = await this.findRentCharges(
      eq(rentCharges.idempotencyKey, key),
    );
    return row ?? null;
  }

  /**
   * Record a payment against one month of one lease.
   *
   * The key is written in the SAME statement that moves the money, and the
   * `where` demands the row still carries no key. So a retry updates nothing
   * and the caller is handed the first result: exactly once, enforced by the
   * database rather than by a check that could race.
   *
   * Fully paid closes the month. A part payment leaves it open, because a
   * tenant who paid half has not paid.
   */
  async recordRent(input: {
    chargeId: string;
    paidAmountRwf: number;
    fullyPaid: boolean;
    idempotencyKey: string;
  }): Promise<boolean> {
    const [updated] = await this.db
      .update(rentCharges)
      .set({
        paidAmountRwf: input.paidAmountRwf,
        status: input.fullyPaid ? 'paid' : 'due',
        paidAt: input.fullyPaid ? new Date() : null,
        idempotencyKey: input.idempotencyKey,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(rentCharges.id, input.chargeId),
          sql`${rentCharges.idempotencyKey} is null`,
        ),
      )
      .returning({ id: rentCharges.id });

    return Boolean(updated);
  }

  // --- Deposits ------------------------------------------------------------

  async listDeposits(workspaceId: string): Promise<DepositRow[]> {
    return this.findDeposits(eq(leases.workspaceId, workspaceId));
  }

  async findDeposit(holdId: string): Promise<DepositRow | null> {
    const [row] = await this.findDeposits(eq(cautionHolds.id, holdId));
    return row ?? null;
  }

  async findDepositByKey(key: string): Promise<DepositRow | null> {
    const [row] = await this.findDeposits(
      eq(cautionSettlements.idempotencyKey, key),
    );
    return row ?? null;
  }

  /**
   * Settle a caution deposit: write the settlement, move the hold, and move the
   * escrow behind it. ONE transaction, because three rows that disagree about
   * whether a tenant got their money back is the worst state this table can be
   * in.
   *
   * Guarded on the hold still being `held`, so a second call writes nothing
   * rather than settling twice under two different keys.
   */
  async returnDeposit(input: {
    holdId: string;
    leaseId: string;
    escrowId: string | null;
    refundedRwf: number;
    forfeitedRwf: number;
    reason: string | null;
    idempotencyKey: string;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [moved] = await tx
        .update(cautionHolds)
        .set({
          // Anything kept makes it a forfeiture on the hold, whatever the
          // split: `caution_status` has no "partly returned" and inventing one
          // in application code would make the column mean two things.
          status: input.forfeitedRwf > 0 ? 'forfeited' : 'refunded',
          updatedAt: new Date(),
        })
        .where(
          and(eq(cautionHolds.id, input.holdId), eq(cautionHolds.status, 'held')),
        )
        .returning({ id: cautionHolds.id });

      if (!moved) return false;

      await tx.insert(cautionSettlements).values({
        leaseId: input.leaseId,
        cautionHoldId: input.holdId,
        refundedRwf: input.refundedRwf,
        forfeitedRwf: input.forfeitedRwf,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
      });

      if (input.escrowId) {
        await tx
          .update(escrows)
          .set({
            status:
              input.forfeitedRwf === 0
                ? 'refunded_full'
                : input.refundedRwf === 0
                  ? 'forfeited'
                  : 'refunded_partial',
            updatedAt: new Date(),
          })
          .where(eq(escrows.id, input.escrowId));
      }

      return true;
    });
  }

  // --- Shared projections --------------------------------------------------
  //
  // Each one runs its query and returns rows, rather than handing back a half
  // built query whose Drizzle type nobody can write down. It also means a
  // caller cannot bolt on a second `where` that silently replaces the join
  // condition this projection depends on.

  private async findLeases(where: SQL): Promise<LeaseRow[]> {
    return this.db
      .select({
        id: leases.id,
        workspaceId: leases.workspaceId,
        roomId: leases.roomId,
        unitLabel: rooms.label,
        // The lease carries a typed name for a tenant with no account yet; the
        // account's own name wins when there is one.
        tenantName: sql<string | null>`coalesce(${users.name}, ${leases.tenantName})`,
        monthlyRentRwf: leases.monthlyRentRwf,
        cautionRwf: leases.cautionRwf,
        startDate: leases.startDate,
        endDate: leases.endDate,
        status: leases.status,
        landlordSignedAt: leases.landlordSignedAt,
        tenantSignedAt: leases.tenantSignedAt,
      })
      .from(leases)
      .leftJoin(rooms, eq(rooms.id, leases.roomId))
      .leftJoin(users, eq(users.id, leases.tenantUserId))
      .where(where)
      .orderBy(desc(leases.startDate));
  }

  private async findTickets(where: SQL): Promise<TicketRow[]> {
    return this.db
      .select({
        id: maintenanceTickets.id,
        leaseId: maintenanceTickets.leaseId,
        roomId: maintenanceTickets.roomId,
        workspaceId: maintenanceTickets.workspaceId,
        // The room the ticket names, or the leased unit when it names a lease.
        // One column, because a board shows one place per row.
        unitLabel: sql<
          string | null
        >`coalesce(${rooms.label}, ${leaseRooms.label})`,
        raisedByName: users.name,
        title: maintenanceTickets.title,
        description: maintenanceTickets.description,
        category: maintenanceTickets.category,
        priority: maintenanceTickets.priority,
        status: maintenanceTickets.status,
        resolvedAt: maintenanceTickets.resolvedAt,
        createdAt: maintenanceTickets.createdAt,
      })
      .from(maintenanceTickets)
      // LEFT, not INNER. An inner join on the lease is exactly what made this
      // list residence only: a hotel ticket has no lease and would vanish.
      .leftJoin(leases, eq(leases.id, maintenanceTickets.leaseId))
      .leftJoin(rooms, eq(rooms.id, maintenanceTickets.roomId))
      .leftJoin(leaseRooms, eq(leaseRooms.id, leases.roomId))
      .leftJoin(users, eq(users.id, maintenanceTickets.raisedByUserId))
      .where(where)
      .orderBy(asc(maintenanceTickets.status), desc(maintenanceTickets.createdAt));
  }

  private async findRentCharges(where: SQL): Promise<RentChargeRow[]> {
    return this.db
      .select({
        id: rentCharges.id,
        leaseId: rentCharges.leaseId,
        workspaceId: leases.workspaceId,
        unitLabel: rooms.label,
        tenantName: sql<string | null>`coalesce(${users.name}, ${leases.tenantName})`,
        periodMonth: rentCharges.periodMonth,
        amountRwf: rentCharges.amountRwf,
        paidAmountRwf: rentCharges.paidAmountRwf,
        status: rentCharges.status,
        dueDate: rentCharges.dueDate,
        paidAt: rentCharges.paidAt,
        idempotencyKey: rentCharges.idempotencyKey,
      })
      .from(rentCharges)
      .innerJoin(leases, eq(leases.id, rentCharges.leaseId))
      .leftJoin(rooms, eq(rooms.id, leases.roomId))
      .leftJoin(users, eq(users.id, leases.tenantUserId))
      .where(where)
      .orderBy(desc(rentCharges.periodMonth));
  }

  private async findDeposits(where: SQL): Promise<DepositRow[]> {
    return this.db
      .select({
        id: cautionHolds.id,
        leaseId: cautionHolds.leaseId,
        workspaceId: leases.workspaceId,
        unitLabel: rooms.label,
        tenantName: sql<string | null>`coalesce(${users.name}, ${leases.tenantName})`,
        amountRwf: cautionHolds.amountRwf,
        status: cautionHolds.status,
        escrowId: cautionHolds.escrowId,
        heldAt: cautionHolds.heldAt,
        refundedRwf: cautionSettlements.refundedRwf,
        forfeitedRwf: cautionSettlements.forfeitedRwf,
        settlementReason: cautionSettlements.reason,
        settledAt: cautionSettlements.settledAt,
      })
      .from(cautionHolds)
      .innerJoin(leases, eq(leases.id, cautionHolds.leaseId))
      .leftJoin(rooms, eq(rooms.id, leases.roomId))
      .leftJoin(users, eq(users.id, leases.tenantUserId))
      .leftJoin(
        cautionSettlements,
        eq(cautionSettlements.cautionHoldId, cautionHolds.id),
      )
      .where(where)
      .orderBy(desc(cautionHolds.heldAt));
  }
}
