import type {
  CreateOfferRequest,
  GuestOffer,
  GuestOfferList,
  Offer,
  OfferContext,
  OfferList,
  OfferTerms,
  RedeemOfferRequest,
  RedeemOfferResult,
  UpdateOfferRequest,
} from '@injishi/contracts';
import { PROPERTY_TIME_ZONE, offerEligibility } from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { assertOwned } from '../../../shared/auth/assert-owned';
import {
  assertInBranchScope,
  type ScopedWorkspace,
} from '../../../shared/auth/branch-scope';
import { FolioRepository } from '../infrastructure/folio.repository';
import {
  isOfferCodeCollision,
  type OfferRow,
  OffersRepository,
} from '../infrastructure/offers.repository';
import type { MyStayRow } from '../infrastructure/stay-claim.repository';

/** A day, in milliseconds. */
const DAY_MS = 86_400_000;

/**
 * WHAT THE PROPERTY IS OFFERING, AND WHAT THIS GUEST CAN ACTUALLY TAKE (§6.8).
 *
 * ## The conditions are enforced here, not shown here
 *
 * `offerEligibility` in `@injishi/contracts` is the one place an offer's
 * conditions are read, and this service calls it AGAIN before it writes
 * anything, with values it resolved itself: the property's own date, the
 * caller's own stay, the bill's own balance, the count of redemptions already
 * made. A client calls the same function to grey out a card, and that call is
 * politeness. This one is the control.
 *
 * The distinction is not theoretical. Every condition on an offer is a price:
 * "in-house guests only" is the difference between a hotel discounting its
 * restaurant to fill it and a hotel discounting its restaurant to the street.
 * A condition enforced only in a browser is a condition anybody can decline.
 *
 * ## Redeeming is a folio line, and the reservation comes first
 *
 * A redemption posts a NEGATIVE `discount` charge — a line type, an account
 * (`DISCOUNTS_ALLOWED`) and a ledger kind that all already existed with no
 * caller. The `offer_redemptions` row is written BEFORE the charge, because its
 * unique index is what actually stops four simultaneous taps from taking four
 * credits; if the charge then fails, the reservation is released so the guest's
 * one redemption is not burnt on a discount they never got.
 *
 * ## What this deliberately does not do
 *
 * A discount on a bill that has already been SIGNED reduces declared turnover
 * and needs an RRA credit note. Redeeming refuses a locked folio rather than
 * quietly opening the next sequence, because unlike a late minibar charge a
 * discount is not something that "arrived after the lock" — it is somebody
 * choosing to reduce a declared sale, and that is `ebm.refund`'s business.
 */
@Injectable()
export class OffersService {
  private readonly log = new Logger(OffersService.name);

  constructor(
    private readonly offers: OffersRepository,
    private readonly folios: FolioRepository,
  ) {}

  protected now(): Date {
    return new Date();
  }

  /* --------------------------------------------------- the property's side */

  async list(ws: ScopedWorkspace, propertyId?: string): Promise<OfferList> {
    const rows = await this.offers.listForWorkspace(
      ws.workspaceId,
      ws.branchScope,
      propertyId,
    );
    const counts = await this.offers.redemptionCounts(rows.map((r) => r.id));
    return {
      offers: rows.map((row) => this.present(row, counts.get(row.id) ?? 0)),
    };
  }

  async create(
    ws: ScopedWorkspace,
    body: CreateOfferRequest,
    actorUserId: string,
  ): Promise<Offer> {
    if (!ws.orgId) {
      throw new BadRequestException(
        'Offers belong to a business. This workspace is not one.',
      );
    }

    // The property is proved to be this workspace's BEFORE anything is written.
    // Without it a caller could hang an offer off a competitor's property, and
    // `WorkspaceGuard` would see nothing wrong: the workspace they named is
    // genuinely theirs.
    const property = await this.offers.findPropertyOwner(body.propertyId);
    if (!property || property.workspaceId !== ws.workspaceId) {
      throw new NotFoundException('That property is not on this workspace.');
    }
    // ADR-054. Writing a price for a branch the caller is not covering is the
    // same act as reading one, and answers the same 404.
    assertInBranchScope(ws, body.propertyId, 'That property is');

    if (body.departmentId) {
      const department = await this.folios.findDepartment(body.departmentId);
      if (
        !department ||
        department.workspaceId !== ws.workspaceId ||
        (department.propertyId !== null &&
          department.propertyId !== body.propertyId)
      ) {
        throw new NotFoundException('That department is not at this property.');
      }
    }

    let id: string | null = null;
    try {
      id = await this.offers.create({
        orgId: ws.orgId,
        workspaceId: ws.workspaceId,
        propertyId: body.propertyId,
        name: body.name,
        description: body.description ?? null,
        discountKind: body.discountKind,
        discountValue: body.discountValue,
        scope: body.scope,
        departmentId: body.departmentId ?? null,
        code: body.code ?? null,
        audience: body.audience ?? 'anyone',
        startsOn: body.startsOn,
        endsOn: body.endsOn ?? null,
        minNights: body.minNights ?? null,
        minSpendRwf: body.minSpendRwf ?? null,
        maxRedemptions: body.maxRedemptions ?? null,
        // Born a draft unless the caller said otherwise, so nobody publishes a
        // price to the public by filling in a form and pressing save.
        status: body.status ?? 'draft',
        createdByUserId: actorUserId,
      });
    } catch (error) {
      if (isOfferCodeCollision(error)) {
        throw new ConflictException(
          'Another live offer at this property already uses that code.',
        );
      }
      throw error;
    }

    if (!id) throw new ConflictException('That offer could not be created.');
    return this.reread(id);
  }

  async update(
    ws: ScopedWorkspace,
    offerId: string,
    body: UpdateOfferRequest,
  ): Promise<Offer> {
    const offer = assertOwned(await this.offers.find(offerId), ws);
    assertInBranchScope(ws, offer.propertyId, 'That offer is');

    // A percentage is 1 to 100 and the database says so too. Checked here
    // as well because the kind may be changing in the same call, and a
    // `fixed_amount` of 250,000 becoming a `percentage` is a 2,500% discount.
    const kind = body.discountKind ?? offer.discountKind;
    const value = body.discountValue ?? Number(offer.discountValue);
    if (kind === 'percentage' && (value < 1 || value > 100)) {
      throw new BadRequestException('A percentage discount is 1 to 100.');
    }

    const startsOn = body.startsOn ?? offer.startsOn;
    const endsOn = body.endsOn === undefined ? offer.endsOn : body.endsOn;
    if (endsOn !== null && endsOn < startsOn) {
      throw new BadRequestException('An offer cannot close before it opens.');
    }

    try {
      await this.offers.update(offer.id, body);
    } catch (error) {
      if (isOfferCodeCollision(error)) {
        throw new ConflictException(
          'Another live offer at this property already uses that code.',
        );
      }
      throw error;
    }
    return this.reread(offer.id);
  }

  /* ------------------------------------------------------ the guest's side */

  /**
   * Every offer this caller could be shown, with their own answer worked out.
   *
   * The `stay` is resolved by the route through `StayClaimService`, so
   * ownership has already been proved; it is passed in rather than re-read
   * here, which is the same arrangement the department requests use. With no
   * stay, only `anyone` offers at the property named can qualify — a person
   * browsing a hotel they are not in.
   */
  async forGuest(input: {
    stay: MyStayRow | null;
    propertyId?: string;
    code?: string;
  }): Promise<GuestOfferList> {
    const propertyIds = [
      ...new Set(
        [input.stay?.propertyId, input.propertyId].filter(
          (id): id is string => typeof id === 'string',
        ),
      ),
    ];
    if (propertyIds.length === 0) {
      return { stayId: input.stay?.id ?? null, offers: [] };
    }

    const rows = await this.offers.activeAt(propertyIds);
    const [counts, redeemed] = await Promise.all([
      this.offers.redemptionCounts(rows.map((r) => r.id)),
      input.stay ? this.offers.redeemedBy(input.stay.id) : Promise.resolve(new Set<string>()),
    ]);

    const offers = rows.map((row) => {
      const ctx = this.contextFor(row, input.stay, {
        code: input.code ?? null,
        alreadyRedeemed: redeemed.has(row.id),
        redemptionsSoFar: counts.get(row.id) ?? 0,
      });
      const verdict = offerEligibility(this.termsOf(row), ctx);
      return {
        id: row.id,
        propertyId: row.propertyId,
        propertyName: row.propertyName,
        name: row.name,
        description: row.description,
        discountKind: row.discountKind,
        discountValue: Number(row.discountValue),
        scope: row.scope,
        departmentName: row.departmentName,
        // The code itself never leaves: an offer that needs one is an offer the
        // property is handing out deliberately, and listing the code would make
        // "needs a code" mean nothing at all.
        requiresCode: row.code !== null,
        startsOn: row.startsOn,
        endsOn: row.endsOn,
        minNights: row.minNights,
        minSpendRwf: row.minSpendRwf === null ? null : Number(row.minSpendRwf),
        discountRwf: verdict.discountRwf,
        eligible: verdict.eligible,
        reason: verdict.reason,
        redeemed: redeemed.has(row.id),
      } satisfies GuestOffer;
    });

    // Available first, then the biggest saving. A guest scanning this list is
    // looking for what they can have, not for a catalogue.
    offers.sort(
      (a, b) =>
        Number(b.eligible) - Number(a.eligible) || b.discountRwf - a.discountRwf,
    );
    return { stayId: input.stay?.id ?? null, offers };
  }

  /**
   * TAKE ONE, and put the credit on the bill.
   *
   * Every condition is re-checked here against server-resolved values, because
   * the list the guest tapped was rendered some seconds ago and an offer can
   * have been paused, filled up or aged out since. The refusal the guest sees
   * is the same sentence the listing would have shown, from the same function.
   */
  async redeem(
    userId: string,
    stay: MyStayRow,
    offerId: string,
    body: RedeemOfferRequest,
  ): Promise<RedeemOfferResult> {
    const offer = await this.offers.find(offerId);
    if (!offer || offer.propertyId !== stay.propertyId) {
      throw new NotFoundException('That offer is not at this property.');
    }
    if (!stay.folioId) {
      throw new ConflictException(
        'This stay has no open bill, so there is nothing to take the discount off.',
      );
    }

    const counts = await this.offers.redemptionCounts([offer.id]);
    const redeemed = await this.offers.redeemedBy(stay.id);
    const verdict = offerEligibility(
      this.termsOf(offer),
      this.contextFor(offer, stay, {
        code: body.code ?? null,
        alreadyRedeemed: redeemed.has(offer.id),
        redemptionsSoFar: counts.get(offer.id) ?? 0,
      }),
    );
    if (!verdict.eligible) {
      throw new ConflictException(verdict.reason ?? 'That offer is not available.');
    }

    const bill = await this.folios.findFolioForStay(stay.id);
    if (!bill || bill.id !== stay.folioId) {
      throw new ConflictException('This stay’s bill has changed. Refresh and try again.');
    }
    if (bill.lockedAt || bill.status === 'closed') {
      // Refused rather than opened onto the next folio sequence, unlike a late
      // charge. A discount against a signed sale reduces declared turnover and
      // needs an RRA credit note, which is `ebm.refund`'s business and not a
      // side effect of a guest tapping Apply.
      throw new ConflictException(
        'This bill has already been signed, so a discount cannot be added to it. The front desk can help.',
      );
    }

    const reservationId = await this.offers.reserve({
      offerId: offer.id,
      guestStayId: stay.id,
      folioId: bill.id,
      userId,
      amountRwf: verdict.discountRwf,
    });
    if (!reservationId) {
      throw new ConflictException('You have already used this offer on this stay.');
    }

    try {
      const posted = await this.folios.postCharges({
        folioId: bill.id,
        workspaceId: stay.workspaceId,
        drafts: [
          {
            chargeType: 'discount',
            description: `Offer: ${offer.name}`,
            /*
             * No department, even on a `service` scoped offer.
             *
             * `resolveTaxEntity` gives a non-revenue line with no source the
             * FOLIO's property's org, which keeps a host-funded discount on the
             * host's side of the ledger. Naming a tenant outlet's department
             * here would reduce the TENANT's declared turnover for a discount
             * the host paid for, which is the exact mistake ADR-050's tax
             * entity rule exists to prevent.
             */
            departmentId: null,
            quantity: 1,
            unitPriceRwf: verdict.discountRwf,
            // NEGATIVE: the folio's own sign rule is charges positive,
            // payments and discounts negative.
            amountRwf: -verdict.discountRwf,
            taxCode: null,
            taxRate: null,
            taxAmountRwf: null,
            sourceRefType: 'offer_redemption',
            sourceRefId: reservationId,
            postedByUserId: null,
            businessDate: null,
            idempotencyKey: `${stay.workspaceId}:offer:${reservationId}`,
            accountCode: 'DISCOUNTS_ALLOWED',
          },
        ],
        onLocked: 'refuse',
      });

      const chargeId = posted.chargeIds[0];
      if (chargeId) await this.offers.attachCharge(reservationId, chargeId);

      this.log.log(
        `Offer ${offer.id} redeemed on stay ${stay.id} for ${verdict.discountRwf} RWF.`,
      );
      return {
        offerId: offer.id,
        offerName: offer.name,
        stayId: stay.id,
        folioId: bill.id,
        folioChargeId: chargeId ?? null,
        discountRwf: verdict.discountRwf,
        balanceRwf: Math.max(0, posted.balanceRwf),
        applied: true,
      };
    } catch (error) {
      // Give the slot back. Without this a failed post burns the guest's one
      // redemption of this offer and the unique index then refuses the retry —
      // they would be holding a discount they never received and could not ask
      // for again.
      await this.offers.release(reservationId);
      throw error;
    }
  }

  /* ----------------------------------------------------------- the rules */

  /** Only the fields `offerEligibility` is allowed to read. */
  private termsOf(row: OfferRow): OfferTerms {
    return {
      status: row.status,
      discountKind: row.discountKind,
      discountValue: Number(row.discountValue),
      scope: row.scope,
      audience: row.audience,
      code: row.code,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      minNights: row.minNights,
      minSpendRwf: row.minSpendRwf === null ? null : Number(row.minSpendRwf),
      maxRedemptions: row.maxRedemptions,
    };
  }

  /**
   * Everything about the caller an offer is judged against, resolved on the
   * server.
   *
   * `today` is the PROPERTY's date, never the browser's: a guest whose phone is
   * on European time must not be able to take tomorrow's offer tonight, and a
   * guest in Kigali must not be told an offer has closed because a laptop
   * thinks it is already the next day.
   */
  private contextFor(
    row: OfferRow,
    stay: MyStayRow | null,
    extras: {
      code: string | null;
      alreadyRedeemed: boolean;
      redemptionsSoFar: number;
    },
  ): OfferContext {
    const here = stay !== null && stay.propertyId === row.propertyId;
    const inHouse = here && stay.lifecycle === 'open';
    return {
      today: this.propertyToday(),
      inHouse,
      nights: here ? this.nightsOf(stay) : null,
      baseRwf: here ? this.baseFor(row, stay) : 0,
      code: extras.code,
      alreadyRedeemed: extras.alreadyRedeemed,
      redemptionsSoFar: extras.redemptionsSoFar,
    };
  }

  /** `YYYY-MM-DD` in Kigali, which keeps one zone and no daylight saving. */
  private propertyToday(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: PROPERTY_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(this.now());
  }

  /**
   * What the discount would come off.
   *
   * The bill's balance, for every scope. THIS IS A SIMPLIFICATION AND IT IS
   * DELIBERATE at this stage: a `room` or `service` scope narrows which offers
   * a property writes and what the line says, and pricing each scope against
   * only its own charges needs a per-department sum on the folio that the
   * discount line then has to be reconciled against. The balance is the honest
   * conservative base — a percentage of it is never more than the guest owes —
   * and narrowing it later makes an offer worth LESS, never more, so no
   * redemption made now becomes retroactively too generous.
   */
  private baseFor(_row: OfferRow, stay: MyStayRow): number {
    return Math.max(0, stay.balanceRwf ?? 0);
  }

  /** Nights of the stay, or null when nobody has agreed a length. */
  private nightsOf(stay: MyStayRow): number | null {
    const end = stay.actualExitAt ?? stay.plannedExitAt;
    if (!end) return null;
    return Math.max(
      1,
      Math.round((end.getTime() - stay.entryAt.getTime()) / DAY_MS),
    );
  }

  private async reread(id: string): Promise<Offer> {
    const row = await this.offers.find(id);
    if (!row) throw new ConflictException('That offer could not be read back.');
    const counts = await this.offers.redemptionCounts([id]);
    return this.present(row, counts.get(id) ?? 0);
  }

  private present(row: OfferRow, redemptionCount: number): Offer {
    return {
      id: row.id,
      propertyId: row.propertyId,
      name: row.name,
      description: row.description,
      status: row.status,
      discountKind: row.discountKind,
      discountValue: Number(row.discountValue),
      scope: row.scope,
      audience: row.audience,
      departmentId: row.departmentId,
      departmentName: row.departmentName,
      code: row.code,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      minNights: row.minNights,
      minSpendRwf: row.minSpendRwf === null ? null : Number(row.minSpendRwf),
      maxRedemptions: row.maxRedemptions,
      redemptionCount,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
