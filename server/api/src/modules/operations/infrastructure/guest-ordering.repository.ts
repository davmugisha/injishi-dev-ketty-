import type {
  FulfillmentType,
  OrderingAccess,
  OutletKind,
  TaxCode,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm';

import {
  folios,
  guestStays,
  outlets,
  properties,
  serviceCategories,
  serviceItems,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/** Where a guest is staying right now, and the bill an order would post to. */
export interface InHouseStay {
  guestStayId: string;
  propertyId: string;
  roomId: string | null;
  /** The stay's latest bill that is still open, or null when it is signed. */
  folioId: string | null;
}

export interface OutletRow {
  id: string;
  name: string;
  outletKind: OutletKind;
  propertyId: string;
  propertyName: string;
  workspaceId: string;
  departmentId: string;
  taxEntityOrgId: string;
  orderingAccess: OrderingAccess;
  hours: unknown;
  status: 'active' | 'archived';
  /** Straight line kilometres from the point asked about, when one was. */
  distanceKm: number | null;
}

export interface MenuItemRow {
  id: string;
  name: string;
  description: string | null;
  priceRwf: number;
  prepTimeMinutes: number | null;
  categoryId: string;
  categoryName: string;
  categorySort: number;
  outletId: string;
  /** Never sent to a guest: an out of stock item is simply not listed. */
  stockQty: number | null;
  taxCode: TaxCode;
  departmentId: string;
  propertyId: string;
  fulfillmentType: FulfillmentType;
  options: unknown;
}

/** How far a walk in may be from an outlet and still be offered it (D-o). */
export const WALK_IN_RADIUS_KM = 5;

/**
 * The guest's side of ordering (ADR-050 D-o).
 *
 * Separate from `ServiceCatalogRepository` on purpose: every read here is keyed
 * on a PERSON or a PLACE, never on a workspace, because a guest holds no
 * workspace. The staff repository's reads are all workspace scoped, and
 * borrowing them for a guest is how one hotel's menu ends up answering another
 * hotel's guest.
 */
@Injectable()
export class GuestOrderingRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Every stay the caller is in house at.
   *
   * Resolved to a property THROUGH THE STAY'S FOLIO, which the catalog child's
   * value sourcing names: `guest_stays` has no `property_id`, and going through
   * `room_id` would miss a stay with no room assigned yet.
   */
  async inHouseStays(userId: string): Promise<InHouseStay[]> {
    const rows = await this.db
      .select({
        guestStayId: guestStays.id,
        propertyId: folios.propertyId,
        roomId: guestStays.roomId,
        folioId: folios.id,
        lockedAt: folios.lockedAt,
        folioStatus: folios.status,
        sequence: folios.folioSequence,
      })
      .from(guestStays)
      .innerJoin(folios, eq(folios.guestStayId, guestStays.id))
      .where(and(eq(guestStays.guestUserId, userId), eq(guestStays.lifecycle, 'open')))
      .orderBy(asc(guestStays.id), desc(folios.folioSequence));

    // One answer per stay: its highest sequence folio, which is the one a new
    // charge would post to. A signed or closed one offers no charge to room.
    const byStay = new Map<string, InHouseStay>();
    for (const row of rows) {
      if (byStay.has(row.guestStayId)) continue;
      byStay.set(row.guestStayId, {
        guestStayId: row.guestStayId,
        propertyId: row.propertyId,
        roomId: row.roomId,
        folioId: row.lockedAt || row.folioStatus === 'closed' ? null : row.folioId,
      });
    }
    return [...byStay.values()];
  }

  async outletsAt(propertyIds: string[]): Promise<OutletRow[]> {
    if (propertyIds.length === 0) return [];
    return this.selectOutlets(
      and(inArray(outlets.propertyId, propertyIds), eq(outlets.status, 'active'))!,
    );
  }

  /**
   * Walk in outlets within `WALK_IN_RADIUS_KM` of a point, nearest first
   * (D-o). Only `walk_in_only` and `both`: an `in_house_only` outlet is not
   * offered to someone passing by. Distance is the haversine over the
   * property's own coordinates; a property with none is never "near".
   */
  async walkInOutletsNear(lat: number, lng: number): Promise<OutletRow[]> {
    // A box around the point first, so the haversine runs over a handful of
    // rows rather than every walk in outlet in the country. 111 km a degree of
    // latitude; a degree of longitude shrinks with the cosine of the latitude.
    const dLat = WALK_IN_RADIUS_KM / 111;
    const dLng = WALK_IN_RADIUS_KM / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
    const rows = await this.selectOutlets(
      and(
        eq(outlets.status, 'active'),
        inArray(outlets.orderingAccess, ['walk_in_only', 'both']),
        isNotNull(properties.latitude),
        isNotNull(properties.longitude),
        sql`${properties.latitude}::float8 BETWEEN ${lat - dLat} AND ${lat + dLat}`,
        sql`${properties.longitude}::float8 BETWEEN ${lng - dLng} AND ${lng + dLng}`,
      )!,
      { lat, lng },
    );
    return rows
      .filter((r) => r.distanceKm !== null && r.distanceKm <= WALK_IN_RADIUS_KM)
      .sort((a, b) => a.distanceKm! - b.distanceKm!);
  }

  async findOutlet(id: string): Promise<OutletRow | null> {
    const [row] = await this.selectOutlets(eq(outlets.id, id));
    return row ?? null;
  }

  async outletsByIds(ids: string[]): Promise<OutletRow[]> {
    if (ids.length === 0) return [];
    return this.selectOutlets(inArray(outlets.id, ids));
  }

  /**
   * What each outlet sells a guest RIGHT NOW: a visible category, an active and
   * guest orderable item, stock left or no stock count at all (null means
   * unlimited), and EVERY RRA value, because an item that cannot be declared is
   * not listed to be refused later (ADR-050 D-m, amended). An item belongs to an
   * outlet when it names the outlet or its category does.
   */
  async menuFor(outletIds: string[]): Promise<MenuItemRow[]> {
    if (outletIds.length === 0) return [];
    const rows = await this.db
      .select({
        id: serviceItems.id,
        name: serviceItems.name,
        description: serviceItems.description,
        priceRwf: serviceItems.priceRwf,
        prepTimeMinutes: serviceItems.prepTimeMinutes,
        stockQty: serviceItems.stockQty,
        taxCode: serviceItems.taxCode,
        departmentId: serviceItems.departmentId,
        propertyId: serviceItems.propertyId,
        fulfillmentType: serviceItems.fulfillmentType,
        options: serviceItems.options,
        categoryId: serviceCategories.id,
        categoryName: serviceCategories.name,
        categorySort: serviceCategories.sortOrder,
        itemOutletId: serviceItems.outletId,
        categoryOutletId: serviceCategories.outletId,
      })
      .from(serviceItems)
      .innerJoin(serviceCategories, eq(serviceCategories.id, serviceItems.serviceCategoryId))
      .where(
        and(
          or(
            inArray(serviceItems.outletId, outletIds),
            and(isNull(serviceItems.outletId), inArray(serviceCategories.outletId, outletIds)),
          ),
          eq(serviceItems.status, 'active'),
          eq(serviceItems.guestOrderable, true),
          or(isNull(serviceItems.stockQty), gt(serviceItems.stockQty, 0)),
          isNotNull(serviceItems.rraItemClsCd),
          isNotNull(serviceItems.rraItemTyCd),
          isNotNull(serviceItems.rraItemCd),
          isNotNull(serviceItems.rraPkgUnitCd),
          isNotNull(serviceItems.rraQtyUnitCd),
          eq(serviceCategories.guestVisible, true),
          ne(serviceCategories.status, 'archived'),
        ),
      )
      .orderBy(asc(serviceCategories.sortOrder), asc(serviceItems.name));
    return rows.map(({ itemOutletId, categoryOutletId, ...row }) => ({
      ...row,
      outletId: (itemOutletId ?? categoryOutletId)!,
    }));
  }

  private async selectOutlets(
    where: ReturnType<typeof and>,
    from?: { lat: number; lng: number },
  ): Promise<OutletRow[]> {
    // Haversine, in kilometres. Null when either end has no coordinates.
    const distance = from
      ? sql<string | null>`(6371 * 2 * asin(sqrt(
          power(sin(radians((${properties.latitude}::float8 - ${from.lat}) / 2)), 2) +
          cos(radians(${from.lat})) * cos(radians(${properties.latitude}::float8)) *
          power(sin(radians((${properties.longitude}::float8 - ${from.lng}) / 2)), 2)
        )))`
      : sql<string | null>`null`;

    const rows = await this.db
      .select({
        id: outlets.id,
        name: outlets.name,
        outletKind: outlets.outletKind,
        // Never null here: the inner join below drops an outlet with no property.
        // A standalone restaurant (ADR-050 D-l) is therefore not offered through
        // this repository yet; it has no stay to charge to and no property to
        // measure a walk in from until its own address carries the pin.
        propertyId: sql<string>`${outlets.propertyId}`,
        propertyName: properties.name,
        workspaceId: outlets.workspaceId,
        departmentId: outlets.departmentId,
        taxEntityOrgId: outlets.taxEntityOrgId,
        orderingAccess: outlets.orderingAccess,
        hours: outlets.hours,
        status: outlets.status,
        distanceKm: distance,
      })
      .from(outlets)
      .innerJoin(properties, eq(properties.id, outlets.propertyId))
      .where(where)
      .orderBy(asc(outlets.sortOrder), asc(outlets.name));
    return rows.map((r) => ({
      ...r,
      distanceKm: r.distanceKm === null ? null : Math.round(Number(r.distanceKm) * 100) / 100,
    }));
  }
}
