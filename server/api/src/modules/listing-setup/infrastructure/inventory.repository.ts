import type {
  CreatePropertyRequest,
  UpdatePropertyRequest,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';

import {
  districts,
  listings,
  properties,
  propertyPhotos,
  provinces,
  ratePlans,
  roomTypes,
  rooms,
  sectors,
} from '../../../database/drizzle/schema';
import {
  randomSlugSuffix,
  slugCandidates,
  slugStemFor,
} from '../domain/slug';
import type { PublishFacts } from '../domain/publish-eligibility';
import { seedPropertyDepartments } from '../../operations/domain/usali-departments';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

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
  addressText: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  houseRules: string | null;
  locationPrivacy: boolean;
  timezone: string;
  slug: string | null;
  listingStatus: 'draft' | 'published';
  publishedAt: Date | null;
}

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
  addressText: properties.addressText,
  checkInTime: properties.checkInTime,
  checkOutTime: properties.checkOutTime,
  houseRules: properties.houseRules,
  locationPrivacy: properties.locationPrivacy,
  timezone: properties.timezone,
  slug: properties.slug,
  listingStatus: listings.status,
  publishedAt: listings.publishedAt,
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
   * The two are one act. `listings_property_uk` already says a property has at
   * most one listing; this makes it exactly one, from the first moment, so no
   * later code has to handle a property whose listing does not exist yet.
   */
  async createProperty(input: {
    orgId: string;
    workspaceId: string;
    districtId: number;
    request: CreatePropertyRequest;
  }): Promise<string> {
    const r = input.request;
    return this.db.transaction(async (tx) => {
      const [property] = await tx
        .insert(properties)
        .values({
          orgId: input.orgId,
          workspaceId: input.workspaceId,
          name: r.name,
          description: r.description ?? null,
          sectorId: r.sectorId,
          districtId: input.districtId,
          addressText: r.street ?? null,
          checkInTime: r.checkInTime ?? null,
          checkOutTime: r.checkOutTime ?? null,
          houseRules: r.houseRules ?? null,
          locationPrivacy: r.locationPrivacy ?? false,
          // No photo column any more. ADR-049 moved photographs into
          // `property_photos`, so a property is created with none and the
          // attach route adds them; "no photos" is now the absence of rows.
        })
        .returning({ id: properties.id });
      if (!property) throw new Error('Property insert returned no row.');

      await tx.insert(listings).values({
        propertyId: property.id,
        workspaceId: input.workspaceId,
        status: 'draft',
      });

      // ADR-016 AC-14. A property gets its USALI departments in the SAME
      // transaction that creates it, so a room charge is attributable the first
      // time one posts. A property with no Rooms department cannot take one at
      // all, and a second call after commit is a second chance to fail.
      //
      // `seedPropertyDepartments` is pure data plus a function that takes this
      // transaction handle. It is NOT a service reach-in across modules: there
      // is nothing injected and nothing stateful in it.
      await seedPropertyDepartments(tx, {
        orgId: input.orgId,
        propertyId: property.id,
        workspaceId: input.workspaceId,
      });

      return property.id;
    });
  }

  /**
   * Update only the fields that were sent.
   *
   * `district_id` travels with `sector_id` whenever the sector changes, so an
   * edit can never leave the derived district pointing at the old place.
   */
  async updateProperty(input: {
    propertyId: string;
    districtId: number | null;
    request: UpdatePropertyRequest;
  }): Promise<void> {
    const r = input.request;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (r.name !== undefined) patch.name = r.name;
    if (r.description !== undefined) patch.description = r.description;
    if (r.street !== undefined) patch.addressText = r.street;
    if (r.checkInTime !== undefined) patch.checkInTime = r.checkInTime;
    if (r.checkOutTime !== undefined) patch.checkOutTime = r.checkOutTime;
    if (r.houseRules !== undefined) patch.houseRules = r.houseRules;
    if (r.locationPrivacy !== undefined) {
      patch.locationPrivacy = r.locationPrivacy;
    }
    if (r.sectorId !== undefined) {
      patch.sectorId = r.sectorId;
      patch.districtId = input.districtId;
    }

    await this.db
      .update(properties)
      .set(patch)
      .where(eq(properties.id, input.propertyId));
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
      .leftJoin(districts, eq(districts.id, properties.districtId))
      .leftJoin(provinces, eq(provinces.id, districts.provinceId))
      .where(eq(properties.id, propertyId))
      .limit(1);
    return row ? this.normalise(row) : null;
  }

  /** Every property in one workspace, newest last so a list reads as a history. */
  async findPropertiesInWorkspace(
    workspaceId: string,
  ): Promise<PropertyRow[]> {
    const rows = await this.db
      .select(PROPERTY_COLUMNS)
      .from(properties)
      .leftJoin(listings, eq(listings.propertyId, properties.id))
      .leftJoin(sectors, eq(sectors.id, properties.sectorId))
      .leftJoin(districts, eq(districts.id, properties.districtId))
      .leftJoin(provinces, eq(provinces.id, districts.provinceId))
      .where(eq(properties.workspaceId, workspaceId))
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
      sellableRoomCount: number;
    }[]
  > {
    const rows = await this.db
      .select({
        id: roomTypes.id,
        name: roomTypes.name,
        domain: roomTypes.domain,
        status: roomTypes.status,
        basePriceRwf: roomTypes.basePriceRwf,
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
      )
      .orderBy(roomTypes.name);

    return rows.map((r) => ({
      ...r,
      basePriceRwf: r.basePriceRwf ?? null,
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
   * The three facts publishing is decided on (ADR-049, AC-I4).
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
   * Publish, behind a row lock, idempotently (ADR-049, AC-I5, AC-I10).
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
   * Back to draft, KEEPING the slug (ADR-049, AC-I6).
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
   * The three publish facts, on the pool or on a transaction handle.
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
      .select({ sectorId: properties.sectorId })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);
    if (!property) return null;

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
      sectorId: property.sectorId,
      activeRoomTypeCount: Number(active?.count ?? 0),
      pricedRoomTypeCount: Number(priced?.count ?? 0),
      photoCount: Number(photos?.count ?? 0),
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
