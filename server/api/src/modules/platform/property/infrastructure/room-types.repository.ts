import type {
  CreateRoomTypeRequest,
  UpdateRoomTypeRequest,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';

import {
  orgs,
  properties,
  ratePlans,
  roomTypes,
  rooms,
} from '../../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../../shared/database/database.module';
import { insertRooms } from './rooms.repository';

/** One room type, with the counts and the default plan a caller needs. */
export interface RoomTypeRow {
  id: string;
  propertyId: string;
  workspaceId: string;
  name: string;
  domain: 'hospitality' | 'residence';
  status: 'active' | 'archived';
  maxGuests: number | null;
  basePriceRwf: number | null;
  bookingMode: string | null;
  cancellationTier: string | null;
  priceBasis: 'per_person' | 'per_unit' | 'per_item';
  roomCount: number;
  sellableRoomCount: number;
  defaultRatePlanId: string | null;
}

/**
 * The select shape both room type reads share.
 *
 * **`defaultRatePlanId` and `sellableRoomCount` are JOINED, not subqueried**, and
 * that is load bearing rather than a style choice. Drizzle qualifies a select list
 * with table names only when the query has joins: in a join-free query,
 * `where ${ratePlans.roomTypeId} = ${roomTypes.id}` renders as
 * `where "room_type_id" = "id"`, both names resolve inside `rate_plans`, and the
 * subquery silently returns nothing. `inventory.repository.ts` carries the full
 * account of that trap.
 *
 * The `rate_plans` join is safe against row multiplication because
 * `rate_plans_one_default_per_room_type_uk` allows exactly one default per room
 * type, so it contributes at most one row — which is what keeps
 * `count(rooms.id)` honest beside it.
 */
const ROOM_TYPE_COLUMNS = {
  id: roomTypes.id,
  propertyId: roomTypes.propertyId,
  workspaceId: roomTypes.workspaceId,
  name: roomTypes.name,
  domain: roomTypes.domain,
  status: roomTypes.status,
  maxGuests: roomTypes.maxGuests,
  basePriceRwf: roomTypes.basePriceRwf,
  bookingMode: roomTypes.bookingMode,
  cancellationTier: roomTypes.cancellationTier,
  priceBasis: roomTypes.priceBasis,
  roomCount: roomTypes.roomCount,
  sellableRoomCount: sql<number>`count(${rooms.id}) filter (where ${rooms.status} = 'available')`,
  defaultRatePlanId: ratePlans.id,
};

/** The group by every room type read needs, because of the `rooms` aggregate. */
const ROOM_TYPE_GROUP_BY = [
  roomTypes.id,
  roomTypes.propertyId,
  roomTypes.workspaceId,
  roomTypes.name,
  roomTypes.domain,
  roomTypes.status,
  roomTypes.maxGuests,
  roomTypes.basePriceRwf,
  roomTypes.bookingMode,
  roomTypes.cancellationTier,
  roomTypes.priceBasis,
  roomTypes.roomCount,
  ratePlans.id,
] as const;

/**
 * The room type write path (ADR-053, AC-I1).
 *
 * ## Both shapes, on purpose
 *
 * Every write here lands in TWO places: the deprecated pricing columns on
 * `room_types`, and a default `rate_plans` row. That is not belt and braces, it
 * is the deprecation being honest — every current reader (booking, pricing, the
 * public read) still reads the columns, and moving them is
 * [ADR-009](../../../../..)'s contract phase, which ADR-053 deliberately defers
 * rather than swallows. Writing one and not the other would leave a room type
 * that the operator can see and a guest cannot book.
 *
 * `createProperty` in `inventory.repository.ts` already did exactly this for the
 * property it creates; this is the same rule applied to the authoring path.
 */
@Injectable()
export class RoomTypesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Every room type on a property, archived ones included. */
  async listForProperty(propertyId: string): Promise<RoomTypeRow[]> {
    const rows = await this.db
      .select(ROOM_TYPE_COLUMNS)
      .from(roomTypes)
      .leftJoin(rooms, eq(rooms.roomTypeId, roomTypes.id))
      .leftJoin(
        ratePlans,
        and(eq(ratePlans.roomTypeId, roomTypes.id), eq(ratePlans.isDefault, true)),
      )
      .where(eq(roomTypes.propertyId, propertyId))
      .groupBy(...ROOM_TYPE_GROUP_BY)
      .orderBy(asc(roomTypes.name));
    return rows.map((r) => this.normalise(r));
  }

  /**
   * One room type, unfiltered by workspace.
   *
   * Deliberately not scoped here: the service needs to tell "does not exist" from
   * "not yours" so it can answer 404 to both, and a query that hid another
   * workspace's row would make that call for it.
   */
  async find(roomTypeId: string): Promise<RoomTypeRow | null> {
    const [row] = await this.db
      .select(ROOM_TYPE_COLUMNS)
      .from(roomTypes)
      .leftJoin(rooms, eq(rooms.roomTypeId, roomTypes.id))
      .leftJoin(
        ratePlans,
        and(eq(ratePlans.roomTypeId, roomTypes.id), eq(ratePlans.isDefault, true)),
      )
      .where(eq(roomTypes.id, roomTypeId))
      .groupBy(...ROOM_TYPE_GROUP_BY)
      .limit(1);
    return row ? this.normalise(row) : null;
  }

  /** The property a room type hangs on, for the containment check. */
  async propertyFor(
    roomTypeId: string,
  ): Promise<{ propertyId: string; workspaceId: string } | null> {
    const [row] = await this.db
      .select({
        propertyId: roomTypes.propertyId,
        workspaceId: roomTypes.workspaceId,
      })
      .from(roomTypes)
      .where(eq(roomTypes.id, roomTypeId))
      .limit(1);
    return row ?? null;
  }

  /**
   * Create a room type AND the plan it sells on, in one transaction.
   *
   * The default plan is not optional and not deferred. `rate_plans` is what a
   * quote is built from, so a room type with no plan is a room type that cannot
   * be sold, and creating one in that state would make publishing refuse for a
   * reason the operator did nothing to cause.
   */
  async create(input: {
    propertyId: string;
    workspaceId: string;
    domain: 'hospitality' | 'residence';
    request: CreateRoomTypeRequest;
    /**
     * The rooms this type starts with, already checked for collisions by the
     * service. Written in the same transaction, so a room type never commits
     * without the rooms that make it sellable.
     */
    roomLabels: readonly string[];
  }): Promise<string> {
    const r = input.request;
    const menuItem = r.priceBasis === 'per_item';
    return this.db.transaction(async (tx) => {
      const [roomType] = await tx
        .insert(roomTypes)
        .values({
          propertyId: input.propertyId,
          workspaceId: input.workspaceId,
          name: r.name,
          domain: input.domain,
          maxGuests: r.maxGuests,
          // The physical capacity, kept in step with `maxGuests`. The column
          // predates the four-way guest split and readers still use it.
          capacity: r.maxGuests,
          roomCount: r.roomCount ?? 1,
          // Deprecated, and written anyway: see the class comment.
          basePriceRwf: r.basePriceRwf,
          // Instant book is the default path to a chargeable listing. Null
          // booking mode published fine but the marketplace treats it as
          // unsellable ("can't be booked online"), so create never leaves it
          // blank for a stay. A menu item is never booked, so it has none.
          bookingMode: menuItem ? null : (r.bookingMode ?? 'instant_book'),
          cancellationTier: r.cancellationTier ?? 'flexible',
          priceBasis: r.priceBasis ?? 'per_person',
          // 0117: what the room is and who may sleep there.
          roomCategory: r.roomCategory ?? null,
          beds: r.beds ?? null,
          maxAdults: r.maxAdults ?? null,
          maxChildren: r.maxChildren ?? null,
          sizeM2: r.sizeM2 ?? null,
          bathroom: r.bathroom ?? null,
          singleGuestPriceRwf: r.singleGuestPriceRwf ?? null,
          extraBedsMax: r.extraBedsMax ?? null,
          extraBedPriceRwf: r.extraBedPriceRwf ?? null,
        })
        .returning({ id: roomTypes.id });
      if (!roomType) throw new Error('Room type insert returned no row.');

      await tx.insert(ratePlans).values({
        roomTypeId: roomType.id,
        workspaceId: input.workspaceId,
        // Named for what it is. An operator renames it when they add a second.
        name: 'Standard rate',
        isDefault: true,
        basePriceRwf: r.basePriceRwf,
        baseOccupancy: r.maxGuests,
        // The one guest price lives twice, like the base price: here is what the plan quotes.
        singleOccupancyPriceRwf: r.singleGuestPriceRwf ?? null,
        cancellationTier: r.cancellationTier ?? 'flexible',
        bookingMode: menuItem ? null : (r.bookingMode ?? 'instant_book'),
      });

      await insertRooms(tx, {
        roomTypeId: roomType.id,
        propertyId: input.propertyId,
        workspaceId: input.workspaceId,
        labels: input.roomLabels,
      });

      return roomType.id;
    });
  }

  /**
   * Edit a room type, and carry a price change through to its default plan.
   *
   * The price is the one field that exists twice, so it is the one field an edit
   * has to write twice. An edit that moved the column and left the plan behind
   * would quote the old price to a guest while showing the new one to the
   * operator, and the operator would have no way to see the disagreement.
   */
  async update(input: {
    roomTypeId: string;
    request: UpdateRoomTypeRequest;
  }): Promise<void> {
    const r = input.request;
    await this.db.transaction(async (tx) => {
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (r.name !== undefined) patch.name = r.name;
      if (r.maxGuests !== undefined) {
        patch.maxGuests = r.maxGuests;
        patch.capacity = r.maxGuests;
      }
      if (r.roomCount !== undefined) patch.roomCount = r.roomCount;
      if (r.basePriceRwf !== undefined) patch.basePriceRwf = r.basePriceRwf;
      for (const key of ['roomCategory', 'beds', 'maxAdults', 'maxChildren', 'sizeM2', 'bathroom', 'singleGuestPriceRwf', 'extraBedsMax', 'extraBedPriceRwf'] as const) {
        if (r[key] !== undefined) patch[key] = r[key];
      }
      if (r.bookingMode !== undefined) patch.bookingMode = r.bookingMode;
      if (r.cancellationTier !== undefined) {
        patch.cancellationTier = r.cancellationTier;
      }
      if (r.priceBasis !== undefined) {
        patch.priceBasis = r.priceBasis;
        // A menu item cannot be booked, so it keeps no booking mode.
        if (r.priceBasis === 'per_item') patch.bookingMode = null;
      }
      if (r.status !== undefined) {
        patch.status = r.status;
        // Archiving stamps the moment. Unarchiving clears it, so the column never
        // claims a room type was archived when it is live.
        patch.archivedAt = r.status === 'archived' ? new Date() : null;
      }

      await tx
        .update(roomTypes)
        .set(patch)
        .where(eq(roomTypes.id, input.roomTypeId));

      const planPatch: Record<string, unknown> = { updatedAt: new Date() };
      if (r.basePriceRwf !== undefined) planPatch.basePriceRwf = r.basePriceRwf;
      if (r.singleGuestPriceRwf !== undefined) planPatch.singleOccupancyPriceRwf = r.singleGuestPriceRwf;
      if (r.maxGuests !== undefined) planPatch.baseOccupancy = r.maxGuests;
      if (r.cancellationTier !== undefined) {
        planPatch.cancellationTier = r.cancellationTier;
      }
      if (r.bookingMode !== undefined) planPatch.bookingMode = r.bookingMode;
      if (r.priceBasis === 'per_item') planPatch.bookingMode = null;
      if (Object.keys(planPatch).length > 1) {
        await tx
          .update(ratePlans)
          .set(planPatch)
          .where(
            and(
              eq(ratePlans.roomTypeId, input.roomTypeId),
              eq(ratePlans.isDefault, true),
            ),
          );
      }
    });
  }

  /**
   * How many ACTIVE, PRICED room types a property has apart from this one.
   *
   * The question behind AC-I7: archiving the last priced room type on a published
   * property is refused, and "last" can only be answered by counting the others.
   */
  async otherPricedActiveCount(input: {
    propertyId: string;
    excludingRoomTypeId: string;
  }): Promise<number> {
    const [row] = await this.db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(roomTypes)
      .where(
        and(
          eq(roomTypes.propertyId, input.propertyId),
          eq(roomTypes.status, 'active'),
          sql`${roomTypes.id} <> ${input.excludingRoomTypeId}`,
          sql`exists (
            select 1 from ${ratePlans}
            where ${ratePlans.roomTypeId} = ${roomTypes.id}
              and ${ratePlans.isDefault}
              and ${ratePlans.basePriceRwf} is not null
          )`,
        ),
      );
    return Number(row?.count ?? 0);
  }

  /**
   * The domain a property sells in, so a room type inherits it rather than asking.
   *
   * Read from the OWNING ORG, which is where the domain is decided at
   * registration. Asking the operator again would let a hospitality business
   * create a residence room type and land rows in the wrong half of the product.
   */
  async domainForProperty(
    propertyId: string,
  ): Promise<'hospitality' | 'residence' | null> {
    const [row] = await this.db
      .select({ domain: orgs.domain })
      .from(properties)
      .innerJoin(orgs, eq(orgs.id, properties.orgId))
      .where(eq(properties.id, propertyId))
      .limit(1);
    // A PSF business lists nothing and has no property to hold a room type.
    const domain = row?.domain ?? null;
    return domain === 'enterprise' ? null : domain;
  }

  /**
   * The kind facts of the business behind a property, for `priceBasisFor`: a
   * room type created without a price basis takes its business's own.
   */
  async businessKindForProperty(propertyId: string): Promise<{
    domain: 'hospitality' | 'residence';
    accommodationClass: string | null;
    accommodationClassOther: string | null;
    entityGroup: string | null;
    businessKind: string | null;
  } | null> {
    const [row] = await this.db
      .select({
        domain: orgs.domain,
        accommodationClass: orgs.accommodationClass,
        accommodationClassOther: orgs.accommodationClassOther,
        entityGroup: orgs.rdbEntityGroup,
        businessKind: orgs.businessKind,
      })
      .from(properties)
      .innerJoin(orgs, eq(orgs.id, properties.orgId))
      .where(eq(properties.id, propertyId))
      .limit(1);
    if (!row || row.domain === 'enterprise') return null;
    return { ...row, domain: row.domain, businessKind: row.businessKind ?? null };
  }

  private normalise(row: {
    roomCount: number | null;
    sellableRoomCount: unknown;
    [k: string]: unknown;
  }): RoomTypeRow {
    return {
      ...(row as unknown as RoomTypeRow),
      roomCount: row.roomCount ?? 0,
      sellableRoomCount: Number(row.sellableRoomCount ?? 0),
    };
  }
}
