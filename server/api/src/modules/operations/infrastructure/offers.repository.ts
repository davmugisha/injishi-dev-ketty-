import type {
  OfferAudience,
  OfferDiscountKind,
  OfferScope,
  OfferStatus,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm';

import {
  departments,
  offerRedemptions,
  offers,
  properties,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

export interface OfferRow {
  id: string;
  orgId: string;
  workspaceId: string;
  propertyId: string;
  propertyName: string | null;
  name: string;
  description: string | null;
  discountKind: OfferDiscountKind;
  discountValue: number;
  scope: OfferScope;
  departmentId: string | null;
  departmentName: string | null;
  code: string | null;
  audience: OfferAudience;
  startsOn: string;
  endsOn: string | null;
  minNights: number | null;
  minSpendRwf: number | null;
  maxRedemptions: number | null;
  status: OfferStatus;
  createdAt: Date;
}

/** Was this a collision on the one-redemption-per-offer-per-stay index? */
export function isRedemptionCollision(error: unknown): boolean {
  const e = error as { code?: string; constraint?: string; cause?: unknown };
  const inner = e?.code === '23505' ? e : (e?.cause as typeof e | undefined);
  return (
    inner?.code === '23505' &&
    inner.constraint === 'offer_redemptions_offer_stay_uk'
  );
}

/** Was this a collision on the one-live-code-per-property index? */
export function isOfferCodeCollision(error: unknown): boolean {
  const e = error as { code?: string; constraint?: string; cause?: unknown };
  const inner = e?.code === '23505' ? e : (e?.cause as typeof e | undefined);
  return inner?.code === '23505' && inner.constraint === 'offers_property_code_uk';
}

/**
 * OFFERS AND WHO HAS TAKEN THEM (§6.8).
 *
 * The property's reads are workspace scoped; the guest's are keyed on a
 * PROPERTY, because a guest holds no workspace. Same split as
 * `GuestOrderingRepository`, and for the same reason: borrowing a workspace
 * scoped query for a guest is how one hotel's offers answer another hotel's
 * guest.
 */
@Injectable()
export class OffersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Every offer this property has ever written, newest first. */
  async listForWorkspace(
    workspaceId: string,
    propertyId?: string,
  ): Promise<OfferRow[]> {
    return this.rows(
      propertyId
        ? and(
            eq(offers.workspaceId, workspaceId),
            eq(offers.propertyId, propertyId),
          )
        : eq(offers.workspaceId, workspaceId),
    );
  }

  /** Unscoped, so the service can hand it to `assertOwned` and answer 404. */
  async find(id: string): Promise<OfferRow | null> {
    const [row] = await this.rows(eq(offers.id, id));
    return row ?? null;
  }

  /**
   * Every offer a guest could be shown at these properties.
   *
   * `active` only. A draft is the property still writing it and an archived one
   * is retired; either showing on a guest's screen would be a price the
   * business did not mean to publish.
   */
  async activeAt(propertyIds: string[]): Promise<OfferRow[]> {
    if (propertyIds.length === 0) return [];
    return this.rows(
      and(inArray(offers.propertyId, propertyIds), eq(offers.status, 'active')),
    );
  }

  /**
   * An offer by its CODE at one property, whatever its status.
   *
   * Whatever its status on purpose: a guest typing the code of a paused offer
   * has to be told the offer is not running, and a lookup that filtered by
   * status would tell them the code does not exist — which sends them back to
   * the desk arguing about a code they are holding and reading correctly.
   */
  async findByCode(propertyId: string, code: string): Promise<OfferRow | null> {
    const [row] = await this.rows(
      and(
        eq(offers.propertyId, propertyId),
        sql`upper(${offers.code}) = ${code.trim().toUpperCase()}`,
      ),
    );
    return row ?? null;
  }

  /** How many times each offer has been taken, by anybody. */
  async redemptionCounts(offerIds: string[]): Promise<Map<string, number>> {
    const found = new Map<string, number>();
    if (offerIds.length === 0) return found;

    const rows = await this.db
      .select({
        offerId: offerRedemptions.offerId,
        count: sql<number>`count(*)::int`,
      })
      .from(offerRedemptions)
      .where(inArray(offerRedemptions.offerId, offerIds))
      .groupBy(offerRedemptions.offerId);

    for (const row of rows) found.set(row.offerId, row.count);
    return found;
  }

  /** Which offers this stay has already taken. */
  async redeemedBy(guestStayId: string): Promise<Set<string>> {
    const rows = await this.db
      .select({ offerId: offerRedemptions.offerId })
      .from(offerRedemptions)
      .where(eq(offerRedemptions.guestStayId, guestStayId));
    return new Set(rows.map((r) => r.offerId));
  }

  async create(input: {
    orgId: string;
    workspaceId: string;
    propertyId: string;
    name: string;
    description: string | null;
    discountKind: OfferDiscountKind;
    discountValue: number;
    scope: OfferScope;
    departmentId: string | null;
    code: string | null;
    audience: OfferAudience;
    startsOn: string;
    endsOn: string | null;
    minNights: number | null;
    minSpendRwf: number | null;
    maxRedemptions: number | null;
    status: OfferStatus;
    createdByUserId: string;
  }): Promise<string | null> {
    const [row] = await this.db
      .insert(offers)
      .values(input)
      .returning({ id: offers.id });
    return row?.id ?? null;
  }

  /** Only the fields that were sent. An absent field is left alone, never nulled. */
  async update(
    id: string,
    patch: Partial<{
      name: string;
      description: string | null;
      discountKind: OfferDiscountKind;
      discountValue: number;
      audience: OfferAudience;
      code: string | null;
      startsOn: string;
      endsOn: string | null;
      minNights: number | null;
      minSpendRwf: number | null;
      maxRedemptions: number | null;
      status: OfferStatus;
    }>,
  ): Promise<void> {
    if (Object.keys(patch).length === 0) return;
    await this.db
      .update(offers)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(offers.id, id));
  }

  /**
   * RESERVE THE REDEMPTION.
   *
   * Written BEFORE the folio line, and that order is the whole concurrency
   * story. `offer_redemptions_offer_stay_uk` is the only thing that actually
   * stops a guest tapping Apply four times and taking 15% off the same bill
   * four times — the service's "have you already taken this" check is exactly
   * what four simultaneous taps all pass. Inserting here first means the losers
   * take a 23505 before any money has moved; inserting after the charge would
   * mean four credits posted and three rows refused.
   *
   * Null is returned on that collision, and the service answers with the
   * redemption that already exists rather than with an error.
   */
  async reserve(input: {
    offerId: string;
    guestStayId: string;
    folioId: string;
    userId: string | null;
    amountRwf: number;
  }): Promise<string | null> {
    try {
      const [row] = await this.db
        .insert(offerRedemptions)
        .values(input)
        .returning({ id: offerRedemptions.id });
      return row?.id ?? null;
    } catch (error) {
      if (isRedemptionCollision(error)) return null;
      throw error;
    }
  }

  /** Name the folio line the reservation became. */
  async attachCharge(redemptionId: string, folioChargeId: string): Promise<void> {
    await this.db
      .update(offerRedemptions)
      .set({ folioChargeId })
      .where(eq(offerRedemptions.id, redemptionId));
  }

  /**
   * Give the reservation back.
   *
   * Called only when the folio line could not be posted after the slot was
   * taken. Without it a failed post would burn the guest's one redemption of
   * that offer and leave them holding a discount they never received — and the
   * unique index would then refuse the retry.
   */
  async release(redemptionId: string): Promise<void> {
    await this.db
      .delete(offerRedemptions)
      .where(eq(offerRedemptions.id, redemptionId));
  }

  /**
   * Does this workspace own this property?
   *
   * Asked before an offer is hung off one. Without it a caller could attach an
   * offer to a competitor's property and `WorkspaceGuard` would see nothing
   * wrong, because the workspace they named really is theirs — the same check
   * check in makes on a room, for the same reason.
   */
  async findPropertyOwner(
    propertyId: string,
  ): Promise<{ id: string; workspaceId: string; orgId: string } | null> {
    const [row] = await this.db
      .select({
        id: properties.id,
        workspaceId: properties.workspaceId,
        orgId: properties.orgId,
      })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);
    return row ?? null;
  }

  /** The one projection, so every read of an offer is the same shape. */
  private async rows(
    where: SQL | undefined,
  ): Promise<OfferRow[]> {
    return this.db
      .select({
        id: offers.id,
        orgId: offers.orgId,
        workspaceId: offers.workspaceId,
        propertyId: offers.propertyId,
        propertyName: properties.name,
        name: offers.name,
        description: offers.description,
        discountKind: offers.discountKind,
        discountValue: offers.discountValue,
        scope: offers.scope,
        departmentId: offers.departmentId,
        departmentName: departments.name,
        code: offers.code,
        audience: offers.audience,
        startsOn: offers.startsOn,
        endsOn: offers.endsOn,
        minNights: offers.minNights,
        minSpendRwf: offers.minSpendRwf,
        maxRedemptions: offers.maxRedemptions,
        status: offers.status,
        createdAt: offers.createdAt,
      })
      .from(offers)
      .leftJoin(properties, eq(properties.id, offers.propertyId))
      .leftJoin(departments, eq(departments.id, offers.departmentId))
      .where(where)
      .orderBy(asc(offers.startsOn), asc(offers.name));
  }
}
