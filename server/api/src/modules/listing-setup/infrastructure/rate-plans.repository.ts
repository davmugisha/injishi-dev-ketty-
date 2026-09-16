import type {
  CreateRatePlanRequest,
  UpdateRatePlanRequest,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { inBranchScope, type BranchScope } from '../../../shared/auth/branch-scope';
import { ratePlans, roomTypes } from '../../../database/drizzle/schema';

/** One rate plan row, joined to the room type it prices. */
export interface RatePlanRow {
  id: string;
  roomTypeId: string;
  roomTypeName: string | null;
  /** Through the room type: the branch this plan prices (ADR-054). */
  propertyId: string | null;
  /** Present on a single read, so containment can be checked. Absent on a list. */
  workspaceId?: string;
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

  /**
   * Create a plan on a room type (ADR-053, AC-I2).
   *
   * **A new default MOVES the flag rather than failing.** An operator changing
   * which plan sells by default is an ordinary act, and
   * `rate_plans_one_default_per_room_type_uk` would otherwise turn it into a
   * unique violation the screen has to explain. Cleared first, in the same
   * transaction, so the index is never transiently violated.
   */
  async create(input: {
    roomTypeId: string;
    workspaceId: string;
    request: CreateRatePlanRequest;
  }): Promise<string> {
    const r = input.request;
    return this.db.transaction(async (tx) => {
      if (r.isDefault === true) {
        await tx
          .update(ratePlans)
          .set({ isDefault: false })
          .where(
            and(
              eq(ratePlans.roomTypeId, input.roomTypeId),
              eq(ratePlans.isDefault, true),
            ),
          );
      }

      const [plan] = await tx
        .insert(ratePlans)
        .values({
          roomTypeId: input.roomTypeId,
          workspaceId: input.workspaceId,
          name: r.name,
          isDefault: r.isDefault ?? false,
          basePriceRwf: r.basePriceRwf,
          baseOccupancy: r.baseOccupancy ?? null,
          cancellationTier: r.cancellationTier ?? null,
          nonRefundable: r.nonRefundable ?? false,
          bookingMode: r.bookingMode ?? null,
        })
        .returning({ id: ratePlans.id });
      if (!plan) throw new Error('Rate plan insert returned no row.');
      return plan.id;
    });
  }

  /** Edit a plan, moving the default flag the same way a create does. */
  async update(input: {
    ratePlanId: string;
    roomTypeId: string;
    request: UpdateRatePlanRequest;
  }): Promise<void> {
    const r = input.request;
    await this.db.transaction(async (tx) => {
      if (r.isDefault === true) {
        await tx
          .update(ratePlans)
          .set({ isDefault: false })
          .where(
            and(
              eq(ratePlans.roomTypeId, input.roomTypeId),
              eq(ratePlans.isDefault, true),
              sql`${ratePlans.id} <> ${input.ratePlanId}`,
            ),
          );
      }

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (r.name !== undefined) patch.name = r.name;
      if (r.basePriceRwf !== undefined) patch.basePriceRwf = r.basePriceRwf;
      if (r.baseOccupancy !== undefined) patch.baseOccupancy = r.baseOccupancy;
      if (r.cancellationTier !== undefined) {
        patch.cancellationTier = r.cancellationTier;
      }
      if (r.nonRefundable !== undefined) patch.nonRefundable = r.nonRefundable;
      if (r.bookingMode !== undefined) patch.bookingMode = r.bookingMode;
      if (r.isDefault !== undefined) patch.isDefault = r.isDefault;
      if (r.status !== undefined) {
        patch.status = r.status;
        patch.archivedAt = r.status === 'archived' ? new Date() : null;
      }

      await tx
        .update(ratePlans)
        .set(patch)
        .where(eq(ratePlans.id, input.ratePlanId));
    });
  }

  /** One plan, unscoped, so the service can tell "not yours" from "not there". */
  async find(ratePlanId: string): Promise<RatePlanRow | null> {
    const [row] = await this.db
      .select({
        id: ratePlans.id,
        roomTypeId: ratePlans.roomTypeId,
        roomTypeName: roomTypes.name,
        propertyId: roomTypes.propertyId,
        workspaceId: ratePlans.workspaceId,
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
      .where(eq(ratePlans.id, ratePlanId))
      .limit(1);
    return row ?? null;
  }

  async listForWorkspace(workspaceId: string, scope: BranchScope): Promise<RatePlanRow[]> {
    const rows = await this.db
      .select({
        id: ratePlans.id,
        roomTypeId: ratePlans.roomTypeId,
        roomTypeName: roomTypes.name,
        propertyId: roomTypes.propertyId,
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
      .where(and(eq(ratePlans.workspaceId, workspaceId), inBranchScope(roomTypes.propertyId, scope)))
      // Room type first, so a reader meets each room's plans together.
      .orderBy(asc(roomTypes.name), asc(ratePlans.name));

    return rows;
  }
}
