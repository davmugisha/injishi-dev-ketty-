import type { BranchArchiveReason } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';

import {
  bookings,
  folios,
  guestStays,
  listings,
  orgMembershipBranches,
  orgMemberships,
  orgs,
  properties,
  roomTypes,
  rooms,
  users,
} from '../../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../../shared/database/database.module';
import { recordBranchEvent } from './branch-audit';
import type { Tx } from './insert-property';

/** What a branch move found, for the service to turn into an answer. */
export type BranchMoveResult =
  | { kind: 'done' }
  | { kind: 'missing' }
  | { kind: 'archived' }
  | { kind: 'not_archived' }
  | { kind: 'not_hospitality' }
  | { kind: 'refused'; reasons: BranchArchiveReason[] };

interface LockedBranch {
  id: string;
  orgId: string;
  districtId: number | null;
  isHeadOffice: boolean;
  archivedAt: Date | null;
  timezone: string;
}

/**
 * The branch lifecycle writes of ADR-054: archive, restore, and moving the head
 * office.
 *
 * ## Every move locks the ORG row first
 *
 * Three moves touch the same two facts (which branch is the head office, which
 * branches are archived), and the database can refuse a bad end state (the
 * partial unique index, the check that a head office is not archived) but not
 * word it. Serialising every move on the org row means the second of two
 * concurrent moves reads the first one's result instead of tripping a
 * constraint halfway through, so two head office changes at once leave exactly
 * one head office and the loser is simply applied second (AC-M5).
 *
 * Containment (the branch belongs to the caller's workspace) is the service's
 * check, made before any of these run.
 */
@Injectable()
export class BranchesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Archive a branch, or say every reason it cannot be (AC-M3).
   *
   * The reasons are read INSIDE the lock, so a guest checked in between the
   * screen's look and the press is still a refusal. On success the listing goes
   * back to draft with its slug kept, which is what takes the branch off the
   * marketplace and out of new bookings: a guest books only a published listing.
   */
  async archive(propertyId: string, actorUserId: string): Promise<BranchMoveResult> {
    return this.db.transaction(async (tx) => {
      const branch = await this.lockBranch(tx, propertyId);
      if (!branch) return { kind: 'missing' };
      if (branch.archivedAt) return { kind: 'archived' };

      const reasons = await this.archiveBlockers(tx, branch);
      if (reasons.length > 0) return { kind: 'refused', reasons };

      const now = new Date();
      await tx
        .update(properties)
        .set({ archivedAt: now, archivedByUserId: actorUserId, updatedAt: now })
        .where(eq(properties.id, propertyId));
      const [listing] = await tx
        .select({ status: listings.status })
        .from(listings)
        .where(eq(listings.propertyId, propertyId))
        .limit(1);
      await tx
        .update(listings)
        .set({ status: 'draft', updatedAt: now })
        .where(eq(listings.propertyId, propertyId));

      await recordBranchEvent(tx, {
        actorUserId,
        propertyId,
        districtId: branch.districtId,
        eventType: 'branch.archived',
        diff: {
          archivedAt: { from: null, to: now.toISOString() },
          listingStatus: { from: listing?.status ?? null, to: 'draft' },
        },
      });
      return { kind: 'done' };
    });
  }

  /** Bring an archived branch back, its listing left at draft (AC-M4). */
  async restore(propertyId: string, actorUserId: string): Promise<BranchMoveResult> {
    return this.db.transaction(async (tx) => {
      const branch = await this.lockBranch(tx, propertyId);
      if (!branch) return { kind: 'missing' };
      if (!branch.archivedAt) return { kind: 'not_archived' };

      await tx
        .update(properties)
        .set({ archivedAt: null, archivedByUserId: null, updatedAt: new Date() })
        .where(eq(properties.id, propertyId));

      await recordBranchEvent(tx, {
        actorUserId,
        propertyId,
        districtId: branch.districtId,
        eventType: 'branch.restored',
        diff: { archivedAt: { from: branch.archivedAt.toISOString(), to: null } },
      });
      return { kind: 'done' };
    });
  }

  /**
   * Make an active branch the head office, taking the flag off the current one
   * in the same transaction (AC-M5).
   *
   * The old flag is cleared BEFORE the new one is set, because the partial
   * unique index is not deferrable and would refuse two head offices even for
   * the instant between the statements. Asking for the branch that already is
   * the head office is not an error and writes no audit row: nothing moved.
   */
  async makeHeadOffice(
    propertyId: string,
    actorUserId: string,
  ): Promise<BranchMoveResult> {
    return this.db.transaction(async (tx) => {
      const branch = await this.lockBranch(tx, propertyId);
      if (!branch) return { kind: 'missing' };
      if (branch.archivedAt) return { kind: 'archived' };
      if (branch.isHeadOffice) return { kind: 'done' };

      const [org] = await tx
        .select({ domain: orgs.domain })
        .from(orgs)
        .where(eq(orgs.id, branch.orgId))
        .limit(1);
      if (org?.domain !== 'hospitality') return { kind: 'not_hospitality' };

      const [previous] = await tx
        .select({ id: properties.id })
        .from(properties)
        .where(
          and(
            eq(properties.orgId, branch.orgId),
            eq(properties.isHeadOffice, true),
            isNull(properties.archivedAt),
          ),
        )
        .for('update')
        .limit(1);

      const now = new Date();
      if (previous) {
        await tx
          .update(properties)
          .set({ isHeadOffice: false, updatedAt: now })
          .where(eq(properties.id, previous.id));
      }
      await tx
        .update(properties)
        .set({ isHeadOffice: true, updatedAt: now })
        .where(eq(properties.id, propertyId));

      await recordBranchEvent(tx, {
        actorUserId,
        propertyId,
        districtId: branch.districtId,
        eventType: 'branch.head_office_changed',
        diff: { headOffice: { from: previous?.id ?? null, to: propertyId } },
      });
      return { kind: 'done' };
    });
  }

  /**
   * Lock the org, then the branch, and read the branch as it stands under both
   * locks. Null when there is no such branch.
   */
  private async lockBranch(tx: Tx, propertyId: string): Promise<LockedBranch | null> {
    const [owner] = await tx
      .select({ orgId: properties.orgId })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);
    if (!owner?.orgId) return null;

    await tx
      .select({ id: orgs.id })
      .from(orgs)
      .where(eq(orgs.id, owner.orgId))
      .for('update');

    const [row] = await tx
      .select({
        id: properties.id,
        orgId: properties.orgId,
        districtId: properties.districtId,
        isHeadOffice: properties.isHeadOffice,
        archivedAt: properties.archivedAt,
        timezone: properties.timezone,
      })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .for('update')
      .limit(1);
    return row ? { ...row, orgId: row.orgId as string } : null;
  }

  /**
   * Every reason this branch cannot be archived, in the order the screen lists
   * them (ADR-054 Value sourcing, archive reasons).
   *
   * Each check is a query with a JOIN or a plain WHERE, never a correlated
   * subquery in a join free select list, which Drizzle renders unqualified (see
   * `InventoryRepository.readPublishFacts`).
   */
  private async archiveBlockers(
    tx: Tx,
    branch: LockedBranch,
  ): Promise<BranchArchiveReason[]> {
    const reasons: BranchArchiveReason[] = [];
    if (branch.isHeadOffice) reasons.push({ code: 'head_office' });

    // In house: a stay in one of this branch's rooms that nobody checked out.
    const [inHouse] = await tx
      .select({ id: guestStays.id })
      .from(guestStays)
      .innerJoin(rooms, eq(rooms.id, guestStays.roomId))
      .where(and(eq(rooms.propertyId, branch.id), isNull(guestStays.actualExitAt)))
      .limit(1);
    if (inHouse) reasons.push({ code: 'guest_in_house' });

    // Upcoming: a live booking arriving today or later, where "today" is the
    // branch's own calendar day, not the server's. Declined and no show
    // bookings will not arrive, so only a pending or confirmed one counts.
    const [upcoming] = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .innerJoin(roomTypes, eq(roomTypes.id, bookings.roomTypeId))
      .where(
        and(
          eq(roomTypes.propertyId, branch.id),
          inArray(bookings.status, ['pending_approval', 'confirmed']),
          sql`${bookings.checkIn} >= (now() at time zone ${branch.timezone})::date`,
        ),
      )
      .limit(1);
    if (upcoming) reasons.push({ code: 'upcoming_booking' });

    const [openFolio] = await tx
      .select({ id: folios.id })
      .from(folios)
      .where(and(eq(folios.propertyId, branch.id), eq(folios.status, 'open')))
      .limit(1);
    if (openFolio) reasons.push({ code: 'open_folio' });

    // The members limited to this branch who would cover no active branch
    // without it. Named, because "some of your team" sends the owner hunting.
    const stranded = await tx
      .select({ name: users.name, email: users.email })
      .from(orgMembershipBranches)
      .innerJoin(
        orgMemberships,
        eq(orgMemberships.id, orgMembershipBranches.orgMembershipId),
      )
      .innerJoin(users, eq(users.id, orgMemberships.userId))
      .where(
        and(
          eq(orgMembershipBranches.propertyId, branch.id),
          eq(orgMemberships.status, 'active'),
          sql`not exists (
            select 1 from ${orgMembershipBranches} ob
            join ${properties} op on op.id = ob.property_id
            where ob.org_membership_id = ${orgMemberships.id}
              and op.id <> ${branch.id}
              and op.archived_at is null
          )`,
        ),
      );
    if (stranded.length > 0) {
      reasons.push({
        code: 'last_branch_of_member',
        members: stranded.map((m) => m.name ?? m.email),
      });
    }

    return reasons;
  }

  /**
   * Whether another branch of the org, archived ones included, already holds
   * this RRA branch id (AC-M2). Invariant 3: a retired id is never reused.
   */
  async rraBranchIdTaken(
    orgId: string,
    rraBranchId: string,
    exceptPropertyId: string,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ id: properties.id })
      .from(properties)
      .where(
        and(
          eq(properties.orgId, orgId),
          eq(properties.rraBranchId, rraBranchId),
          ne(properties.id, exceptPropertyId),
        ),
      )
      .limit(1);
    return row !== undefined;
  }
}
