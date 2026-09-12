import type {
  CreatePropertyRequest,
  UpdatePropertyRequest,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import {
  districts,
  listings,
  properties,
  provinces,
  roomTypes,
  rooms,
  sectors,
} from '../../../database/drizzle/schema';
import { seedPropertyDepartments } from '../../operations/domain/usali-departments';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

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
  photoObjectKeys: unknown;
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
  photoObjectKeys: properties.photoObjectKeys,
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
          // F-S09 is unbuilt, so there is no source for a photo key. Written as
          // an empty array rather than left null, so a reader never has to tell
          // "no photos" from "we never looked" (ADR-009 AC-13).
          photoObjectKeys: [],
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
