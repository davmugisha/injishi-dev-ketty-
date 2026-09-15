import { z } from "zod";
import { RwfAmount, Uuid } from "./primitives";

/**
 * WHAT A PROPERTY TAKES OFF A BILL, and the conditions it takes it off under
 * (§6.8).
 *
 * ## Conditions are fields, because the server has to be able to refuse
 *
 * "Two nights or more", "guests staying here tonight", "September only",
 * "RWF 20,000 and up" are each a field on {@link OfferTerms}, and
 * {@link offerEligibility} is the one function that reads them. An offer whose
 * conditions live in its description is an offer nothing can enforce: the only
 * thing between a stranger and the staff rate would be what the listing chose
 * to show, and a listing is a suggestion made in a browser.
 *
 * The same function runs on both sides. A client uses it to grey out a card and
 * word the reason; the API calls it again before writing anything, with values
 * it resolved itself. That second call is the control. The first is politeness.
 *
 * ## An offer is not a rate plan
 *
 * `rate_plans` prices a room type before a booking exists, and the price is
 * snapshotted onto the booking at sale. An offer takes money off a bill that
 * already exists, as a negative `discount` line on the folio. A hotel uses
 * both, and conflating them would mean a discount on tonight's dinner silently
 * re-pricing next March's room.
 */

export const OfferStatus = z.enum(["draft", "active", "archived"]);
export type OfferStatus = z.infer<typeof OfferStatus>;

export const OfferDiscountKind = z.enum(["percentage", "fixed_amount"]);
export type OfferDiscountKind = z.infer<typeof OfferDiscountKind>;

/**
 * What the money comes off.
 *
 * Which is a FISCAL choice and not a label: the scope decides which folio line
 * the discount posts against, which decides whose declared revenue it reduces.
 * A discount scoped to a tenant's restaurant must not quietly come off the
 * host's turnover.
 */
export const OfferScope = z.enum(["room", "service", "folio"]);
export type OfferScope = z.infer<typeof OfferScope>;

export const OfferAudience = z.enum(["anyone", "in_house"]);
export type OfferAudience = z.infer<typeof OfferAudience>;

/** An offer's terms: everything {@link offerEligibility} is allowed to read. */
export const OfferTerms = z.object({
  status: OfferStatus,
  discountKind: OfferDiscountKind,
  /** 1-100 for a percentage, francs for a fixed amount. */
  discountValue: z.number().int().positive(),
  scope: OfferScope,
  audience: OfferAudience,
  /** Upper-case, or null for an offer that needs no code. */
  code: z.string().nullable(),
  /** `YYYY-MM-DD` in the property's own calendar. */
  startsOn: z.string(),
  endsOn: z.string().nullable(),
  minNights: z.number().int().positive().nullable(),
  minSpendRwf: RwfAmount.nullable(),
  maxRedemptions: z.number().int().positive().nullable(),
});
export type OfferTerms = z.infer<typeof OfferTerms>;

/** One offer, as the property manages it. */
export const Offer = OfferTerms.extend({
  id: Uuid,
  propertyId: Uuid,
  name: z.string(),
  description: z.string().nullable(),
  departmentId: Uuid.nullable(),
  departmentName: z.string().nullable(),
  /** How many times it has been taken. Counted, never stored on the offer. */
  redemptionCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type Offer = z.infer<typeof Offer>;

export const OfferList = z.object({ offers: z.array(Offer) });
export type OfferList = z.infer<typeof OfferList>;

/**
 * One offer as a GUEST sees it, with this guest's own answer already worked
 * out.
 *
 * `eligible` and `reason` are resolved on the server, against the caller's own
 * stay and bill. A card that says "2 nights minimum" and lets you tap it is a
 * card that produces a refusal; a card that says "you are on a one-night stay"
 * is one that does not.
 */
export const GuestOffer = z.object({
  id: Uuid,
  propertyId: Uuid,
  propertyName: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  discountKind: OfferDiscountKind,
  discountValue: z.number().int().positive(),
  scope: OfferScope,
  departmentName: z.string().nullable(),
  /** True when a code has to be typed. The code itself is never sent out. */
  requiresCode: z.boolean(),
  startsOn: z.string(),
  endsOn: z.string().nullable(),
  minNights: z.number().int().positive().nullable(),
  minSpendRwf: RwfAmount.nullable(),
  /** What it would take off this guest's bill right now. Zero when it cannot. */
  discountRwf: RwfAmount,
  eligible: z.boolean(),
  /** Why not, in words for the guest. Null when it is available. */
  reason: z.string().nullable(),
  /** Already taken on this stay. */
  redeemed: z.boolean(),
});
export type GuestOffer = z.infer<typeof GuestOffer>;

export const GuestOfferList = z.object({
  stayId: Uuid.nullable(),
  offers: z.array(GuestOffer),
});
export type GuestOfferList = z.infer<typeof GuestOfferList>;

/** Everything about the caller an offer is judged against. */
export interface OfferContext {
  /** `YYYY-MM-DD` in the property's calendar, never the browser's. */
  today: string;
  /** Is the caller checked in at this property right now? */
  inHouse: boolean;
  /** Nights of the stay. Null for an open-ended walk in, which fails `minNights`. */
  nights: number | null;
  /** What the discount would come off: the bill, or the part of it in scope. */
  baseRwf: number;
  /** The code the guest typed, if any. Compared case-insensitively. */
  code: string | null;
  /** Has this stay already taken this offer? */
  alreadyRedeemed: boolean;
  /** How many times it has been taken in total, by anybody. */
  redemptionsSoFar: number;
}

export interface OfferAssessment {
  eligible: boolean;
  /** What would come off, as a POSITIVE number. Zero when not eligible. */
  discountRwf: number;
  /** Why not, in words for the guest. Null when it is available. */
  reason: string | null;
}

/**
 * MAY THIS GUEST TAKE THIS OFFER, AND FOR HOW MUCH — the one place it is
 * decided.
 *
 * Every condition is checked, in a fixed order, and the FIRST failure is the
 * one reported: a guest told "2 nights minimum" who fixes that and is then told
 * "in-house only" has been sent round a loop, so the order runs from the most
 * structural reason to the least.
 *
 * The discount is floored to the franc, and is never larger than the base it
 * comes off. A fixed-amount offer bigger than the bill takes the bill to zero
 * and no further; a discount that could exceed the charge would turn a credit
 * into a payout, which is a different act with a different permission.
 */
export function offerEligibility(
  offer: OfferTerms,
  ctx: OfferContext,
): OfferAssessment {
  const no = (reason: string): OfferAssessment => ({
    eligible: false,
    discountRwf: 0,
    reason,
  });

  if (offer.status !== "active") return no("This offer is not running.");
  if (ctx.today < offer.startsOn) {
    return no(`This offer opens on ${offer.startsOn}.`);
  }
  if (offer.endsOn !== null && ctx.today > offer.endsOn) {
    return no(`This offer closed on ${offer.endsOn}.`);
  }
  if (offer.audience === "in_house" && !ctx.inHouse) {
    return no("This one is for guests staying at the property tonight.");
  }
  if (offer.code !== null) {
    const typed = (ctx.code ?? "").trim().toUpperCase();
    if (typed.length === 0) return no("This offer needs a code.");
    if (typed !== offer.code.trim().toUpperCase()) {
      return no("That code does not match this offer.");
    }
  }
  if (offer.minNights !== null) {
    if (ctx.nights === null) {
      return no(
        `This offer is for stays of ${offer.minNights} nights or more, and this stay has no end date yet.`,
      );
    }
    if (ctx.nights < offer.minNights) {
      return no(`This offer is for stays of ${offer.minNights} nights or more.`);
    }
  }
  if (offer.minSpendRwf !== null && ctx.baseRwf < offer.minSpendRwf) {
    return no(
      `This offer starts at ${offer.minSpendRwf.toLocaleString("en-RW")} RWF of charges.`,
    );
  }
  if (ctx.alreadyRedeemed) return no("You have already used this offer on this stay.");
  if (
    offer.maxRedemptions !== null &&
    ctx.redemptionsSoFar >= offer.maxRedemptions
  ) {
    return no("This offer has been fully taken up.");
  }

  const base = Math.max(0, Math.floor(ctx.baseRwf));
  if (base <= 0) {
    return no("There is nothing on the bill for this to come off yet.");
  }

  const discountRwf = offerDiscountRwf(offer, base);
  if (discountRwf <= 0) {
    return no("This offer works out at nothing on the current bill.");
  }
  return { eligible: true, discountRwf, reason: null };
}

/**
 * What one offer takes off one base amount, in francs.
 *
 * Separate from the eligibility check because both sides need the arithmetic
 * without the verdict — a card previews the saving before the guest has typed
 * the code — and because one function that returned a number sometimes and a
 * refusal other times would be read wrong exactly once.
 */
export function offerDiscountRwf(
  offer: Pick<OfferTerms, "discountKind" | "discountValue">,
  baseRwf: number,
): number {
  const base = Math.max(0, Math.floor(baseRwf));
  const raw =
    offer.discountKind === "percentage"
      ? Math.floor((base * offer.discountValue) / 100)
      : Math.floor(offer.discountValue);
  return Math.max(0, Math.min(base, raw));
}

/** Creating one. The property, its scope and its terms, all at once. */
export const CreateOfferRequest = z
  .object({
    propertyId: Uuid,
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000).optional(),
    discountKind: OfferDiscountKind,
    discountValue: z.number().int().positive(),
    scope: OfferScope,
    /** Only on a `service` offer; the database refuses it anywhere else. */
    departmentId: Uuid.optional(),
    /** Stored upper-cased, and unique among this property's live offers. */
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{3,24}$/, "Letters, digits and dashes, 3 to 24 of them.")
      .optional(),
    audience: OfferAudience.optional(),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    minNights: z.number().int().positive().max(365).optional(),
    minSpendRwf: z.number().int().nonnegative().optional(),
    maxRedemptions: z.number().int().positive().optional(),
    /** Offers are born `draft`, so nobody publishes one by filling in a form. */
    status: OfferStatus.optional(),
  })
  .strict()
  .refine(
    (v) => v.discountKind !== "percentage" || v.discountValue <= 100,
    { message: "A percentage discount is 1 to 100.", path: ["discountValue"] },
  )
  .refine((v) => v.departmentId === undefined || v.scope === "service", {
    message: "Only a service offer names a department.",
    path: ["departmentId"],
  })
  .refine((v) => v.endsOn === undefined || v.endsOn >= v.startsOn, {
    message: "An offer cannot close before it opens.",
    path: ["endsOn"],
  });
export type CreateOfferRequest = z.infer<typeof CreateOfferRequest>;

/**
 * Changing one.
 *
 * Every field is optional and the terms may all be edited, INCLUDING while the
 * offer is live. That is deliberate: a hotel that cannot fix a typo in a live
 * offer archives it and makes another, and the redemption history then reads as
 * two offers where there was one. Past redemptions are unaffected — each one
 * stored the francs it actually took off.
 */
export const UpdateOfferRequest = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    discountKind: OfferDiscountKind.optional(),
    discountValue: z.number().int().positive().optional(),
    audience: OfferAudience.optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{3,24}$/)
      .nullable()
      .optional(),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    minNights: z.number().int().positive().max(365).nullable().optional(),
    minSpendRwf: z.number().int().nonnegative().nullable().optional(),
    maxRedemptions: z.number().int().positive().nullable().optional(),
    status: OfferStatus.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: "Nothing to change.",
  });
export type UpdateOfferRequest = z.infer<typeof UpdateOfferRequest>;

/** Taking one. The stay comes from the session, so only the code can be typed. */
export const RedeemOfferRequest = z
  .object({
    /** The stay to put it on. Required when the guest is in two places at once. */
    stayId: Uuid.optional(),
    code: z.string().trim().max(24).optional(),
  })
  .strict();
export type RedeemOfferRequest = z.infer<typeof RedeemOfferRequest>;

/** What redeeming answers: the credit, and the bill it landed on. */
export const RedeemOfferResult = z.object({
  offerId: Uuid,
  offerName: z.string(),
  stayId: Uuid,
  folioId: Uuid,
  /** The negative folio line this wrote. */
  folioChargeId: Uuid.nullable(),
  /** What came off, positive. */
  discountRwf: RwfAmount,
  /** The bill after it. */
  balanceRwf: RwfAmount,
  /** False when this stay had already taken it; the earlier credit stands. */
  applied: z.boolean(),
});
export type RedeemOfferResult = z.infer<typeof RedeemOfferResult>;
