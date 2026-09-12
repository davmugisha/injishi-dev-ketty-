import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { ratePlans, roomTypes } from '../../../database/drizzle/schema';

/** One rate plan row, joined to the room type it prices. */
export interface RatePlanRow {
  id: string;
  roomTypeId: string;
  roomTypeName: string | null;
  name: string;
  status: 'active' | 'archived';
  isDefault: boolean;
  basePriceRwf: number | null;
  cautionRwf: number | null;
  baseOccupancy: number | null;
  singleOccupancyPriceRwf: number | null;
  cancellationTier: string | null;
  nonRefundable: boolean;
  bookingMode: string | null;
  minStay: number | null;
  maxStay: number | null;
  parentRatePlanId: string | null;
  derivationKind: string | null;
  derivationValue: string | null;
}

/**
 * Rate plans (ADR-035, wave 2 follow-up).
 *
 * **`rate_plans` is one of the richest tables in the schema and nothing read
 * it.** No contract, no repository, no route — so the Rate plans lens stayed a
 * placeholder while every column it needed already existed.
 *
 * THE PARENT NAME IS RESOLVED IN THE SERVICE, not by a self join here. Every
 * plan in the workspace comes back in one array and a parent is always one of
 * them, so naming it is a lookup over rows already in hand rather than a second
 * pass over the same table. A derived plan matters — non refundable is flexible
 * minus ten percent and MOVES when flexible moves (F-L03) — but the join to
 * prove it is not worth paying for twice.
 *
 * ARCHIVED PLANS ARE RETURNED. A plan is archived rather than deleted because
 * bookings already sold on it keep pointing at it, and a list that hid them
 * would make a past booking's terms unreadable.
 */
@Injectable()
export class RatePlansRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listForWorkspace(workspaceId: string): Promise<RatePlanRow[]> {
    const rows = await this.db
      .select({
        id: ratePlans.id,
        roomTypeId: ratePlans.roomTypeId,
        roomTypeName: roomTypes.name,
        name: ratePlans.name,
        status: ratePlans.status,
        isDefault: ratePlans.isDefault,
        basePriceRwf: ratePlans.basePriceRwf,
        cautionRwf: ratePlans.cautionRwf,
        baseOccupancy: ratePlans.baseOccupancy,
        singleOccupancyPriceRwf: ratePlans.singleOccupancyPriceRwf,
        cancellationTier: ratePlans.cancellationTier,
        nonRefundable: ratePlans.nonRefundable,
        bookingMode: ratePlans.bookingMode,
        minStay: ratePlans.minStay,
        maxStay: ratePlans.maxStay,
        parentRatePlanId: ratePlans.parentRatePlanId,
        derivationKind: ratePlans.derivationKind,
        derivationValue: ratePlans.derivationValue,
      })
      .from(ratePlans)
      .leftJoin(roomTypes, eq(roomTypes.id, ratePlans.roomTypeId))
      // Scoped in the QUERY. A list has no single subject to hand to
      // `assertOwned`, so the workspace is part of the read or a caller sees
      // another property's pricing.
      .where(eq(ratePlans.workspaceId, workspaceId))
      // Room type first, so a reader meets each room's plans together.
      .orderBy(asc(roomTypes.name), asc(ratePlans.name));

    return rows;
  }
}
