import type {
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  RaiseTicketRequest,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import {
  accountName,
  leases,
  maintenanceEvents,
  maintenanceTickets,
  rooms,
  users,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/*
 * The tickets board's reads and writes (shared with hotel work orders). The
 * first residence screens' lease, rent roll, filing and deposit queries went
 * with the rentals rebuild (migrations 0073 to 0080, blueprint section 4).
 */

/** The same `rooms` table, joined a second time through the lease. */
const leaseRooms = alias(rooms, 'lease_rooms');

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

@Injectable()
export class ResidenceRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The lease a residence ticket names, read unscoped so the service can answer 404. */
  async findLease(leaseId: string): Promise<{ id: string; workspaceId: string } | null> {
    const [row] = await this.db
      .select({ id: leases.id, workspaceId: leases.workspaceId })
      .from(leases)
      .where(eq(leases.id, leaseId))
      .limit(1);
    return row ?? null;
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
    // A lease names its building and unit itself since the rentals rebuild (0076).
    const propertyOf = sql`COALESCE(
      (SELECT rm."property_id" FROM "rooms" rm WHERE rm."id" = ${roomId}),
      (SELECT l."property_id" FROM "leases" l WHERE l."id" = ${leaseId})
    )`;

    const [row] = await this.db
      .insert(maintenanceTickets)
      .values({
        workspaceId: input.workspaceId,
        leaseId,
        roomId,
        unitId: leaseId ? sql`(SELECT l."unit_id" FROM "leases" l WHERE l."id" = ${leaseId})` : null,
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

  // --- Shared projections --------------------------------------------------
  //
  // Each one runs its query and returns rows, rather than handing back a half
  // built query whose Drizzle type nobody can write down.

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
        raisedByName: accountName,
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
}
