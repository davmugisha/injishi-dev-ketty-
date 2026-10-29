import type {
  CreatePropertyRequest,
  UpdatePropertyRequest,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';

import {
  cells,
  districts,
  listings,
  orgs,
  properties,
  propertyPhotos,
  provinces,
  ratePlans,
  roomTypes,
  rooms,
  sectors,
  villages,
} from '../../../database/drizzle/schema';
import {
  randomSlugSuffix,
  slugCandidates,
  slugStemFor,
} from '../domain/slug';
import type { PublishFacts } from '../domain/publish-eligibility';
import { diffOf, recordBranchEvent } from './branch-audit';
import { insertPropertyWithListing } from './insert-property';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import { inBranchScope, type BranchScope } from '../../../shared/auth/branch-scope';

/**
 * Postgres `unique_violation`. Narrowed here rather than inline, so a caller
 * cannot accidentally swallow a different error while retrying a slug.
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

/**
 * Whether a failed write broke the named unique constraint. Drizzle may wrap the
 * driver's error, so the Postgres fields are looked for on its `cause` too.
 */
function violates(error: unknown, constraint: string): boolean {
  let e: unknown = error;
  while (e && typeof e === 'object') {
    const pg = e as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (pg.code === '23505' && pg.constraint === constraint) return true;
    e = pg.cause;
  }
  return false;
}

/** The shape the service reads back, before it is parsed into a contract. */
export interface PropertyRow {
  id: string;
  workspaceId: string;
  orgId: string;
  name: string;
  description: string | null;
  provinceId: number | null;
  provinceName: string | null;
  districtId: number | null;
  districtName: string | null;
  sectorId: number | null;
  sectorName: string | null;
  cellId: number | null;
  cellName: string | null;
  villageId: number | null;
  villageName: string | null;
  addressText: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  houseRules: string | null;
  // 0117: the check-in window's end, the front desk, languages and the house rules as choices.
  checkInUntil: string | null;
  frontDesk: string | null;
  frontDeskOpens: string | null;
  frontDeskCloses: string | null;
  languages: string[];
  whatsapp: string | null;
  directions: string | null;
  minCheckInAge: number | null;
  childrenPolicy: string | null;
  petsPolicy: string | null;
  smokingPolicy: string | null;
  partiesPolicy: string | null;
  quietFrom: string | null;
  quietUntil: string | null;
  internet: string | null;
  parking: string | null;
  locationPrivacy: boolean;
  timezone: string;
  contactPhone: string | null;
  contactEmail: string | null;
  latitude: string | null;
  longitude: string | null;
  slug: string | null;
  listingStatus: 'draft' | 'published';
  publishedAt: Date | null;
  isHeadOffice: boolean;
  rraBranchId: string | null;
  branchCode: string | null;
  archivedAt: Date | null;
}

/** 0117: the policy columns, read and written under the contract's own names (`propertyPolicyFields`). */
const POLICY_COLUMNS = {
  checkInUntil: properties.checkInUntil,
  frontDesk: properties.frontDesk,
  frontDeskOpens: properties.frontDeskOpens,
  frontDeskCloses: properties.frontDeskCloses,
  languages: properties.languages,
  whatsapp: properties.whatsapp,
  directions: properties.directions,
  minCheckInAge: properties.minCheckInAge,
  childrenPolicy: properties.childrenPolicy,
  petsPolicy: properties.petsPolicy,
  smokingPolicy: properties.smokingPolicy,
  partiesPolicy: properties.partiesPolicy,
  quietFrom: properties.quietFrom,
  quietUntil: properties.quietUntil,
  internet: properties.internet,
  parking: properties.parking,
};
const POLICY_KEYS = Object.keys(POLICY_COLUMNS) as (keyof typeof POLICY_COLUMNS)[];

/**
 * The select shape both property reads share. A module constant rather than a
 * method: these are column references, identical on every call, so building
 * them again per query buys nothing.
 */
const PROPERTY_COLUMNS = {
  id: properties.id,
  workspaceId: properties.workspaceId,
  orgId: properties.orgId,
  name: properties.name,
  description: properties.description,
  provinceId: provinces.id,
  provinceName: provinces.name,
  districtId: properties.districtId,
  districtName: districts.name,
  sectorId: properties.sectorId,
  sectorName: sectors.name,
  cellId: cells.id,
  cellName: cells.name,
  villageId: properties.villageId,
  villageName: villages.name,
  addressText: properties.addressText,
  checkInTime: properties.checkInTime,
  checkOutTime: properties.checkOutTime,
  houseRules: properties.houseRules,
  ...POLICY_COLUMNS,
  locationPrivacy: properties.locationPrivacy,
  timezone: properties.timezone,
  contactPhone: properties.contactPhone,
  contactEmail: properties.contactEmail,
  latitude: properties.latitude,
  longitude: properties.longitude,
  slug: properties.slug,
  listingStatus: listings.status,
  publishedAt: listings.publishedAt,
  isHeadOffice: properties.isHeadOffice,
  rraBranchId: properties.rraBranchId,
  branchCode: properties.branchCode,
  archivedAt: properties.archivedAt,
};

/**
 * The only place that touches Drizzle for inventory authoring.
 *
 * The public read path has its own repository in `ListingModule` and answers a
 * guest's question. This one answers an operator's, which is a different query
 * against the same tables: it must return a DRAFT, and it must return the
 * workspace so the service can check containment.
 */
@Injectable()
export class InventoryRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * The district a sector sits in.
   *
   * `district_id` is DERIVED, never asked twice (D24, ADR-009 Value sourcing).
   * Returns null when the sector does not exist, which the caller turns into a
   * 422 rather than writing a property with a dangling address.
   */
  /** The sector a village sits in, through its cell; null when there is no such village. */
  async sectorForVillage(villageId: number): Promise<number | null> {
    const [row] = await this.db
      .select({ sectorId: cells.sectorId })
      .from(villages)
      .innerJoin(cells, eq(cells.id, villages.cellId))
      .where(eq(villages.id, villageId))
      .limit(1);
    return row?.sectorId ?? null;
  }

  async districtForSector(sectorId: number): Promise<number | null> {
    const [row] = await this.db
      .select({ districtId: sectors.districtId })
      .from(sectors)
      .where(eq(sectors.id, sectorId))
      .limit(1);
    return row?.districtId ?? null;
  }

  /**
   * Create the property AND its draft listing, in one transaction.
   *
   * The insert itself is `insertPropertyWithListing`, which registration also
   * calls inside its own transaction (ADR-054), so both doors create the same
   * thing.
   *
   * A hospitality org with no active head office gets this property as its
   * head office. That is only a business registered before branches existed
   * and holding no property yet; everyone else already has one, and the
   * partial unique index refuses a second.
   */
  async createProperty(input: {
    orgId: string;
    workspaceId: string;
    districtId: number;
    actorUserId: string;
    request: CreatePropertyRequest;
  }): Promise<string> {
    const r = input.request;
    return this.db.transaction(async (tx) => {
      const [needsHeadOffice] = await tx
        .select({ id: orgs.id })
        .from(orgs)
        .where(
          and(
            eq(orgs.id, input.orgId),
            eq(orgs.domain, 'hospitality'),
            sql`NOT EXISTS (SELECT 1 FROM ${properties} WHERE ${properties.orgId} = ${orgs.id} AND ${properties.isHeadOffice} AND ${properties.archivedAt} IS NULL)`,
          ),
        )
        .limit(1);

      const isHeadOffice = needsHeadOffice !== undefined;
      const propertyId = await insertPropertyWithListing(tx, {
        orgId: input.orgId,
        workspaceId: input.workspaceId,
        name: r.name,
        sectorId: r.sectorId,
        districtId: input.districtId,
        villageId: r.villageId ?? null,
        street: r.street ?? null,
        isHeadOffice,
        description: r.description ?? null,
        checkInTime: r.checkInTime ?? null,
        checkOutTime: r.checkOutTime ?? null,
        houseRules: r.houseRules ?? null,
        locationPrivacy: r.locationPrivacy ?? false,
        contactPhone: r.contactPhone ?? null,
        contactEmail: r.contactEmail ?? null,
      });

      // ADR-054 AC-A1: a branch created after approval is recorded in the same
      // transaction, so a branch nobody can account for cannot exist.
      await recordBranchEvent(tx, {
        actorUserId: input.actorUserId,
        propertyId,
        districtId: input.districtId,
        eventType: 'branch.created',
        diff: {
          name: { from: null, to: r.name },
          sectorId: { from: null, to: r.sectorId },
          addressText: { from: null, to: r.street ?? null },
          isHeadOffice: { from: null, to: isHeadOffice },
        },
      });
      return propertyId;
    });
  }

  /**
   * Update only the fields that were sent, and record what moved.
   *
   * `district_id` travels with `sector_id` whenever the sector changes, so an
   * edit can never leave the derived district pointing at the old place.
   *
   * The row is read under lock before the write, so the audit row's `from`
   * values are the ones this edit replaced rather than whatever a concurrent
   * edit left (ADR-054 AC-A1). An edit that changes nothing writes no row.
   *
   * Returns `rra_taken` when the unique index refuses the RRA branch id. The
   * service checks first; this covers the edit that raced that check.
   */
  async updateProperty(input: {
    propertyId: string;
    districtId: number | null;
    actorUserId: string;
    request: UpdatePropertyRequest;
  }): Promise<'done' | 'rra_taken'> {
    const r = input.request;
    const patch: Record<string, unknown> = {};
    if (r.name !== undefined) patch.name = r.name;
    if (r.description !== undefined) patch.description = r.description;
    if (r.street !== undefined) patch.addressText = r.street;
    if (r.checkInTime !== undefined) patch.checkInTime = r.checkInTime;
    if (r.checkOutTime !== undefined) patch.checkOutTime = r.checkOutTime;
    if (r.houseRules !== undefined) patch.houseRules = r.houseRules;
    for (const key of POLICY_KEYS) if (r[key] !== undefined) patch[key] = r[key];
    if (r.locationPrivacy !== undefined) {
      patch.locationPrivacy = r.locationPrivacy;
    }
    if (r.contactPhone !== undefined) patch.contactPhone = r.contactPhone;
    if (r.contactEmail !== undefined) patch.contactEmail = r.contactEmail;
    if (r.rraBranchId !== undefined) patch.rraBranchId = r.rraBranchId;
    if (r.sectorId !== undefined) {
      patch.sectorId = r.sectorId;
      patch.districtId = input.districtId;
    }
    // A village belongs to one sector, so a new sector without a village clears
    // the old one rather than leaving it filed somewhere it is not.
    if (r.villageId !== undefined) patch.villageId = r.villageId;
    // The map point, both halves together (numeric columns take strings).
    if (r.latitude !== undefined && r.longitude !== undefined) {
      patch.latitude = r.latitude === null ? null : String(r.latitude);
      patch.longitude = r.longitude === null ? null : String(r.longitude);
    }
    else if (r.sectorId !== undefined) patch.villageId = null;

    try {
      await this.db.transaction(async (tx) => {
        const [before] = await tx
          .select({
            name: properties.name,
            description: properties.description,
            addressText: properties.addressText,
            checkInTime: properties.checkInTime,
            checkOutTime: properties.checkOutTime,
            houseRules: properties.houseRules,
            ...POLICY_COLUMNS,
            locationPrivacy: properties.locationPrivacy,
            contactPhone: properties.contactPhone,
            contactEmail: properties.contactEmail,
            rraBranchId: properties.rraBranchId,
            sectorId: properties.sectorId,
            districtId: properties.districtId,
          })
          .from(properties)
          .where(eq(properties.id, input.propertyId))
          .for('update')
          .limit(1);
        if (!before) return;

        const diff = diffOf(before as Record<string, unknown>, patch);
        if (Object.keys(diff).length === 0) return;

        await tx
          .update(properties)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(properties.id, input.propertyId));

        await recordBranchEvent(tx, {
          actorUserId: input.actorUserId,
          propertyId: input.propertyId,
          districtId:
            (patch.districtId as number | undefined) ?? before.districtId,
          eventType:
            'rraBranchId' in diff
              ? 'branch.rra_branch_id_changed'
              : 'branch.updated',
          diff,
        });
      });
    } catch (error) {
      if (violates(error, 'properties_org_rra_branch_uk')) return 'rra_taken';
      throw error;
    }
    return 'done';
  }

  /**
   * One property, with its address resolved upward and its listing state.
   *
   * Returns the workspace so the caller can check containment. Deliberately NOT
   * filtered by workspace here: a repository that silently returns null for
   * another workspace's row hides the difference between "does not exist" and
   * "not yours", and the service needs to make that call, not the query.
   */
  async findProperty(propertyId: string): Promise<PropertyRow | null> {
    const [row] = await this.db
      .select(PROPERTY_COLUMNS)
      .from(properties)
      .leftJoin(listings, eq(listings.propertyId, properties.id))
      .leftJoin(sectors, eq(sectors.id, properties.sectorId))
      .leftJoin(villages, eq(villages.id, properties.villageId))
      .leftJoin(cells, eq(cells.id, villages.cellId))
      .leftJoin(districts, eq(districts.id, properties.districtId))
      .leftJoin(provinces, eq(provinces.id, districts.provinceId))
      .where(eq(properties.id, propertyId))
      .limit(1);
    return row ? this.normalise(row) : null;
  }

  /**
   * Every property in one workspace, oldest first so a list reads as a history.
   *
   * Archived branches are left out unless asked for (ADR-054): Setup, Inventory
   * and the property picker work on the branches that still trade, and only the
   * Branches screen needs the rest.
   */
  async findPropertiesInWorkspace(
    workspaceId: string,
    scope: BranchScope,
    includeArchived = false,
  ): Promise<PropertyRow[]> {
    const rows = await this.db
      .select(PROPERTY_COLUMNS)
      .from(properties)
      .leftJoin(listings, eq(listings.propertyId, properties.id))
      .leftJoin(sectors, eq(sectors.id, properties.sectorId))
      .leftJoin(villages, eq(villages.id, properties.villageId))
      .leftJoin(cells, eq(cells.id, villages.cellId))
      .leftJoin(districts, eq(districts.id, properties.districtId))
      .leftJoin(provinces, eq(provinces.id, districts.provinceId))
      .where(
        and(
          eq(properties.workspaceId, workspaceId),
          // A property IS a branch, so the scope filters it directly (ADR-054).
          inBranchScope(properties.id, scope),
          includeArchived ? undefined : isNull(properties.archivedAt),
        ),
      )
      .orderBy(properties.createdAt);
    return rows.map((r) => this.normalise(r));
  }

  /**
   * The active room types on a property, with their sellable room counts.
   *
   * Empty until feature 2 builds the room type write path, and correct the
   * moment it does: the count comes from `rooms`, which is the inventory truth,
   * not from the deprecated `room_types.room_count`.
   */
  async findRoomTypeSummaries(propertyId: string): Promise<
    {
      id: string;
      name: string;
      domain: 'hospitality' | 'residence';
      status: 'active' | 'archived';
      basePriceRwf: number | null;
      priceBasis: 'per_person' | 'per_unit' | 'per_item';
      sellableRoomCount: number;
      // 0117: what the room is and who may sleep there.
      maxGuests: number | null;
      maxAdults: number | null;
      maxChildren: number | null;
      roomCategory: string | null;
      beds: { type: string; count: number }[] | null;
      sizeM2: number | null;
      bathroom: 'private' | 'shared' | null;
      singleGuestPriceRwf: number | null;
    }[]
  > {
    const rows = await this.db
      .select({
        id: roomTypes.id,
        name: roomTypes.name,
        domain: roomTypes.domain,
        status: roomTypes.status,
        basePriceRwf: roomTypes.basePriceRwf,
        priceBasis: roomTypes.priceBasis,
        maxGuests: roomTypes.maxGuests,
        maxAdults: roomTypes.maxAdults,
        maxChildren: roomTypes.maxChildren,
        roomCategory: roomTypes.roomCategory,
        beds: roomTypes.beds,
        sizeM2: roomTypes.sizeM2,
        bathroom: roomTypes.bathroom,
        singleGuestPriceRwf: roomTypes.singleGuestPriceRwf,
        sellableRoomCount: sql<number>`count(${rooms.id}) filter (where ${rooms.status} = 'available')`,
      })
      .from(roomTypes)
      .leftJoin(rooms, eq(rooms.roomTypeId, roomTypes.id))
      .where(
        and(
          eq(roomTypes.propertyId, propertyId),
          eq(roomTypes.status, 'active'),
        ),
      )
      .groupBy(
        roomTypes.id,
        roomTypes.name,
        roomTypes.domain,
        roomTypes.status,
        roomTypes.basePriceRwf,
        roomTypes.priceBasis,
      )
      .orderBy(roomTypes.name);
    // Grouped by the primary key, so every other room type column is functionally dependent on it.

    // `room_types.domain` shares `domain_kind`, but a PSF business (`enterprise`)
    // never has a room type; the guard only narrows the type to say so.
    return rows
      .filter((r): r is typeof r & { domain: 'hospitality' | 'residence' } => r.domain !== 'enterprise')
      .map((r) => ({
        ...r,
        basePriceRwf: r.basePriceRwf ?? null,
        singleGuestPriceRwf: r.singleGuestPriceRwf ?? null,
        // The column's CHECK constraint holds it to these two.
        bathroom: (r.bathroom as 'private' | 'shared' | null) ?? null,
        sellableRoomCount: Number(r.sellableRoomCount),
      }));
  }

  /** Room type and sellable room counts for a whole workspace, in one query. */
  async countsForWorkspace(
    workspaceId: string,
  ): Promise<Map<string, { roomTypeCount: number; sellableRoomCount: number }>> {
    const rows = await this.db
      .select({
        propertyId: roomTypes.propertyId,
        roomTypeCount: sql<number>`count(distinct ${roomTypes.id})`,
        sellableRoomCount: sql<number>`count(${rooms.id}) filter (where ${rooms.status} = 'available')`,
      })
      .from(roomTypes)
      .leftJoin(rooms, eq(rooms.roomTypeId, roomTypes.id))
      .where(
        and(
          eq(roomTypes.workspaceId, workspaceId),
          eq(roomTypes.status, 'active'),
        ),
      )
      .groupBy(roomTypes.propertyId);

    return new Map(
      rows.map((r) => [
        r.propertyId,
        {
          roomTypeCount: Number(r.roomTypeCount),
          sellableRoomCount: Number(r.sellableRoomCount),
        },
      ]),
    );
  }

  /**
   * The three facts publishing is decided on (ADR-053, AC-I4).
   *
   * One round trip rather than three, and counted in the database rather than by
   * loading rows, because the only thing the caller needs is whether each count
   * is zero.
   *
   * "Priced" means the room type's DEFAULT rate plan carries a price. Not any
   * plan: the default is the one a guest is quoted, so a priced non-default plan
   * on an otherwise free room type is not a sellable listing.
   */
  async publishFactsFor(propertyId: string): Promise<PublishFacts | null> {
    return this.readPublishFacts(this.db, propertyId);
  }

  /**
   * Publish, behind a row lock, idempotently (ADR-053, AC-I5, AC-I10).
   *
   * The lock is on the LISTING row, and it is what makes a double press safe:
   * the second press blocks until the first commits, then finds the listing
   * already `published` and returns without minting a second slug or moving
   * `published_at`. One press and two presses are indistinguishable to the
   * caller, which is the same idempotency shape `POST /bookings` already uses.
   *
   * The eligibility facts are re-read INSIDE the lock by the callback, so a
   * property that lost its last photograph between the check and the write is
   * refused rather than published on a stale answer.
   *
   * Returns the blockers when it refused, so the service can name the condition
   * without a second round trip.
   */
  async publish(
    propertyId: string,
    blockersFor: (facts: PublishFacts) => string[],
  ): Promise<{ published: boolean; blockers: string[] }> {
    return this.db.transaction(async (tx) => {
      const [listing] = await tx
        .select({ id: listings.id, status: listings.status })
        .from(listings)
        .where(eq(listings.propertyId, propertyId))
        .for('update')
        .limit(1);
      if (!listing) return { published: false, blockers: [] };

      // Already live. Not an error and not a second publish: the caller asked for
      // this property to be published and it is.
      if (listing.status === 'published') {
        return { published: true, blockers: [] };
      }

      const facts = await this.readPublishFacts(tx, propertyId);
      if (!facts) return { published: false, blockers: [] };
      const blockers = blockersFor(facts);
      if (blockers.length > 0) return { published: false, blockers };

      await this.mintSlugWithin(tx, propertyId);
      await tx
        .update(listings)
        .set({
          status: 'published',
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(listings.id, listing.id));

      return { published: true, blockers: [] };
    });
  }

  /**
   * Back to draft, KEEPING the slug (ADR-053, AC-I6).
   *
   * The address survives on purpose. An operator who pauses for a week and
   * republishes keeps every bookmark, every inbound link and every search result
   * that already points at them; freeing the slug would rot all of it to save a
   * row in a unique index.
   *
   * `published_at` is left alone too: it records the most recent publish, which
   * is still true.
   */
  async unpublish(propertyId: string): Promise<boolean> {
    const rows = await this.db
      .update(listings)
      .set({ status: 'draft', updatedAt: new Date() })
      .where(eq(listings.propertyId, propertyId))
      .returning({ id: listings.id });
    return rows.length > 0;
  }

  /**
   * The publish facts, on the pool or on a transaction handle.
   *
   * ## Four small queries, and NOT one with correlated subqueries
   *
   * The obvious shape for this is one `select` over `properties` with three
   * `select count(*)` subqueries in the select list. **That shape is silently
   * wrong in Drizzle and it cost a debugging session**, so it is written down
   * here rather than rediscovered:
   *
   * Drizzle qualifies the select list with table names only when the query has
   * JOINS. A single-table query renders bare column names, so
   * `where ${roomTypes.propertyId} = ${properties.id}` comes out as
   * `where "property_id" = "id"` — and inside `select … from "room_types"` both
   * names resolve to `room_types`' own columns. It compares a row to itself,
   * matches nothing, and returns zero without error. Publishing then refuses a
   * property that has four priced room types.
   *
   * The same idiom IS correct in `api/admin/orgs/orgs.service.ts`, because that
   * query carries joins. It is correct in a `where` clause too, which is always
   * qualified. It is only the select list of a join-free query that bites.
   *
   * Four typed queries cannot express the bug at all, and a publish happens once
   * per listing.
   */
  private async readPublishFacts(
    handle: Database,
    propertyId: string,
  ): Promise<PublishFacts | null> {
    const [property] = await handle
      .select({
        sectorId: properties.sectorId,
        registrationStatus: orgs.registrationStatus,
        rdbEntityGroup: orgs.rdbEntityGroup,
        checkInTime: properties.checkInTime,
        frontDesk: properties.frontDesk,
        languages: properties.languages,
      })
      .from(properties)
      .innerJoin(orgs, eq(orgs.id, properties.orgId))
      .where(eq(properties.id, propertyId))
      .limit(1);
    if (!property) return null;

    // 0117: a stay's room type says its beds and who may sleep there before a guest can book it.
    const [unfurnished] = await handle
      .select({ count: sql<number>`count(*)` })
      .from(roomTypes)
      .where(
        and(
          eq(roomTypes.propertyId, propertyId),
          eq(roomTypes.status, 'active'),
          sql`(${roomTypes.beds} is null or jsonb_array_length(${roomTypes.beds}) = 0 or ${roomTypes.maxAdults} is null)`,
        ),
      );

    const [active] = await handle
      .select({ count: sql<number>`count(*)` })
      .from(roomTypes)
      .where(
        and(
          eq(roomTypes.propertyId, propertyId),
          eq(roomTypes.status, 'active'),
        ),
      );

    // "Priced" means the DEFAULT plan carries a price. Not any plan: the default
    // is the one a guest is quoted, so a priced non-default plan on an otherwise
    // free room type is not a sellable listing. The `exists` sits in a WHERE
    // clause, which Drizzle qualifies correctly.
    const [priced] = await handle
      .select({ count: sql<number>`count(*)` })
      .from(roomTypes)
      .where(
        and(
          eq(roomTypes.propertyId, propertyId),
          eq(roomTypes.status, 'active'),
          sql`exists (
            select 1 from ${ratePlans}
            where ${ratePlans.roomTypeId} = ${roomTypes.id}
              and ${ratePlans.isDefault}
              and ${ratePlans.basePriceRwf} is not null
          )`,
        ),
      );

    const [photos] = await handle
      .select({ count: sql<number>`count(*)` })
      .from(propertyPhotos)
      .where(eq(propertyPhotos.propertyId, propertyId));

    return {
      orgActive: property.registrationStatus === 'active',
      sectorId: property.sectorId,
      activeRoomTypeCount: Number(active?.count ?? 0),
      pricedRoomTypeCount: Number(priced?.count ?? 0),
      photoCount: Number(photos?.count ?? 0),
      // A bar or coffee shop is listed, not booked: it has no desk, check-in or beds to declare.
      isStay: property.rdbEntityGroup !== 'restaurant_bar_nightclub',
      hasCheckInTime: property.checkInTime !== null,
      hasFrontDesk: property.frontDesk !== null,
      languageCount: property.languages.length,
      roomTypesWithoutBeds: Number(unfurnished?.count ?? 0),
    };
  }

  /**
   * Give the property an address, once.
   *
   * A property that already has a slug keeps it — that is what makes a republish
   * return to the same public address.
   *
   * The candidates are probed in one query and then written. A concurrent publish
   * of a DIFFERENT property can still take the chosen slug between the probe and
   * the write (our lock is on our own listing row, not on the unique index), so
   * the write is attempted inside a savepoint and a unique violation falls
   * through to the next candidate rather than failing the publish.
   */
  private async mintSlugWithin(tx: Database, propertyId: string): Promise<void> {
    const [row] = await tx
      .select({ id: properties.id, name: properties.name, slug: properties.slug })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);
    if (!row || row.slug !== null) return;

    const stem = slugStemFor({ name: row.name, id: row.id });
    const candidates = slugCandidates(stem);

    const taken = new Set(
      (
        await tx
          .select({ slug: properties.slug })
          .from(properties)
          .where(
            and(isNotNull(properties.slug), inArray(properties.slug, candidates)),
          )
      ).map((r) => r.slug),
    );

    const free = candidates.filter((c) => !taken.has(c));
    // Past ten collisions, stop counting and start guessing: a linear search is
    // unbounded work for a property named "Hotel", and a six character suffix is
    // one probe instead of n.
    const attempts = [
      ...free,
      ...Array.from({ length: 5 }, () => `${stem}-${randomSlugSuffix()}`),
    ];

    for (const candidate of attempts) {
      try {
        await tx.transaction(async (savepoint) => {
          await savepoint
            .update(properties)
            .set({ slug: candidate, updatedAt: new Date() })
            .where(eq(properties.id, propertyId));
        });
        return;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }

    throw new Error(
      `Could not mint a unique slug for property ${propertyId} from stem "${stem}".`,
    );
  }

  /**
   * A property always has a listing (they are created together), but the LEFT
   * JOIN types it as nullable. Defaulting to `draft` keeps the caller free of a
   * null check for a state that cannot occur.
   */
  private normalise(row: {
    listingStatus: 'draft' | 'published' | null;
    [k: string]: unknown;
  }): PropertyRow {
    return {
      ...(row as unknown as PropertyRow),
      listingStatus: row.listingStatus ?? 'draft',
    };
  }
}
