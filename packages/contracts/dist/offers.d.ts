import { z } from "zod";
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
export declare const OfferStatus: z.ZodEnum<["draft", "active", "archived"]>;
export type OfferStatus = z.infer<typeof OfferStatus>;
export declare const OfferDiscountKind: z.ZodEnum<["percentage", "fixed_amount"]>;
export type OfferDiscountKind = z.infer<typeof OfferDiscountKind>;
/**
 * What the money comes off.
 *
 * Which is a FISCAL choice and not a label: the scope decides which folio line
 * the discount posts against, which decides whose declared revenue it reduces.
 * A discount scoped to a tenant's restaurant must not quietly come off the
 * host's turnover.
 */
export declare const OfferScope: z.ZodEnum<["room", "service", "folio"]>;
export type OfferScope = z.infer<typeof OfferScope>;
export declare const OfferAudience: z.ZodEnum<["anyone", "in_house"]>;
export type OfferAudience = z.infer<typeof OfferAudience>;
/** An offer's terms: everything {@link offerEligibility} is allowed to read. */
export declare const OfferTerms: z.ZodObject<{
    status: z.ZodEnum<["draft", "active", "archived"]>;
    discountKind: z.ZodEnum<["percentage", "fixed_amount"]>;
    /** 1-100 for a percentage, francs for a fixed amount. */
    discountValue: z.ZodNumber;
    scope: z.ZodEnum<["room", "service", "folio"]>;
    audience: z.ZodEnum<["anyone", "in_house"]>;
    /** Upper-case, or null for an offer that needs no code. */
    code: z.ZodNullable<z.ZodString>;
    /** `YYYY-MM-DD` in the property's own calendar. */
    startsOn: z.ZodString;
    endsOn: z.ZodNullable<z.ZodString>;
    minNights: z.ZodNullable<z.ZodNumber>;
    minSpendRwf: z.ZodNullable<z.ZodNumber>;
    maxRedemptions: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    code: string | null;
    status: "active" | "draft" | "archived";
    startsOn: string;
    scope: "room" | "service" | "folio";
    audience: "anyone" | "in_house";
    discountKind: "percentage" | "fixed_amount";
    discountValue: number;
    endsOn: string | null;
    minNights: number | null;
    minSpendRwf: number | null;
    maxRedemptions: number | null;
}, {
    code: string | null;
    status: "active" | "draft" | "archived";
    startsOn: string;
    scope: "room" | "service" | "folio";
    audience: "anyone" | "in_house";
    discountKind: "percentage" | "fixed_amount";
    discountValue: number;
    endsOn: string | null;
    minNights: number | null;
    minSpendRwf: number | null;
    maxRedemptions: number | null;
}>;
export type OfferTerms = z.infer<typeof OfferTerms>;
/** One offer, as the property manages it. */
export declare const Offer: z.ZodObject<{
    status: z.ZodEnum<["draft", "active", "archived"]>;
    discountKind: z.ZodEnum<["percentage", "fixed_amount"]>;
    /** 1-100 for a percentage, francs for a fixed amount. */
    discountValue: z.ZodNumber;
    scope: z.ZodEnum<["room", "service", "folio"]>;
    audience: z.ZodEnum<["anyone", "in_house"]>;
    /** Upper-case, or null for an offer that needs no code. */
    code: z.ZodNullable<z.ZodString>;
    /** `YYYY-MM-DD` in the property's own calendar. */
    startsOn: z.ZodString;
    endsOn: z.ZodNullable<z.ZodString>;
    minNights: z.ZodNullable<z.ZodNumber>;
    minSpendRwf: z.ZodNullable<z.ZodNumber>;
    maxRedemptions: z.ZodNullable<z.ZodNumber>;
} & {
    id: z.ZodString;
    propertyId: z.ZodString;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    departmentId: z.ZodNullable<z.ZodString>;
    departmentName: z.ZodNullable<z.ZodString>;
    /** How many times it has been taken. Counted, never stored on the offer. */
    redemptionCount: z.ZodNumber;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string | null;
    status: "active" | "draft" | "archived";
    name: string;
    id: string;
    startsOn: string;
    createdAt: string;
    scope: "room" | "service" | "folio";
    audience: "anyone" | "in_house";
    departmentName: string | null;
    description: string | null;
    propertyId: string;
    departmentId: string | null;
    discountKind: "percentage" | "fixed_amount";
    discountValue: number;
    endsOn: string | null;
    minNights: number | null;
    minSpendRwf: number | null;
    maxRedemptions: number | null;
    redemptionCount: number;
}, {
    code: string | null;
    status: "active" | "draft" | "archived";
    name: string;
    id: string;
    startsOn: string;
    createdAt: string;
    scope: "room" | "service" | "folio";
    audience: "anyone" | "in_house";
    departmentName: string | null;
    description: string | null;
    propertyId: string;
    departmentId: string | null;
    discountKind: "percentage" | "fixed_amount";
    discountValue: number;
    endsOn: string | null;
    minNights: number | null;
    minSpendRwf: number | null;
    maxRedemptions: number | null;
    redemptionCount: number;
}>;
export type Offer = z.infer<typeof Offer>;
export declare const OfferList: z.ZodObject<{
    offers: z.ZodArray<z.ZodObject<{
        status: z.ZodEnum<["draft", "active", "archived"]>;
        discountKind: z.ZodEnum<["percentage", "fixed_amount"]>;
        /** 1-100 for a percentage, francs for a fixed amount. */
        discountValue: z.ZodNumber;
        scope: z.ZodEnum<["room", "service", "folio"]>;
        audience: z.ZodEnum<["anyone", "in_house"]>;
        /** Upper-case, or null for an offer that needs no code. */
        code: z.ZodNullable<z.ZodString>;
        /** `YYYY-MM-DD` in the property's own calendar. */
        startsOn: z.ZodString;
        endsOn: z.ZodNullable<z.ZodString>;
        minNights: z.ZodNullable<z.ZodNumber>;
        minSpendRwf: z.ZodNullable<z.ZodNumber>;
        maxRedemptions: z.ZodNullable<z.ZodNumber>;
    } & {
        id: z.ZodString;
        propertyId: z.ZodString;
        name: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        departmentId: z.ZodNullable<z.ZodString>;
        departmentName: z.ZodNullable<z.ZodString>;
        /** How many times it has been taken. Counted, never stored on the offer. */
        redemptionCount: z.ZodNumber;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string | null;
        status: "active" | "draft" | "archived";
        name: string;
        id: string;
        startsOn: string;
        createdAt: string;
        scope: "room" | "service" | "folio";
        audience: "anyone" | "in_house";
        departmentName: string | null;
        description: string | null;
        propertyId: string;
        departmentId: string | null;
        discountKind: "percentage" | "fixed_amount";
        discountValue: number;
        endsOn: string | null;
        minNights: number | null;
        minSpendRwf: number | null;
        maxRedemptions: number | null;
        redemptionCount: number;
    }, {
        code: string | null;
        status: "active" | "draft" | "archived";
        name: string;
        id: string;
        startsOn: string;
        createdAt: string;
        scope: "room" | "service" | "folio";
        audience: "anyone" | "in_house";
        departmentName: string | null;
        description: string | null;
        propertyId: string;
        departmentId: string | null;
        discountKind: "percentage" | "fixed_amount";
        discountValue: number;
        endsOn: string | null;
        minNights: number | null;
        minSpendRwf: number | null;
        maxRedemptions: number | null;
        redemptionCount: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    offers: {
        code: string | null;
        status: "active" | "draft" | "archived";
        name: string;
        id: string;
        startsOn: string;
        createdAt: string;
        scope: "room" | "service" | "folio";
        audience: "anyone" | "in_house";
        departmentName: string | null;
        description: string | null;
        propertyId: string;
        departmentId: string | null;
        discountKind: "percentage" | "fixed_amount";
        discountValue: number;
        endsOn: string | null;
        minNights: number | null;
        minSpendRwf: number | null;
        maxRedemptions: number | null;
        redemptionCount: number;
    }[];
}, {
    offers: {
        code: string | null;
        status: "active" | "draft" | "archived";
        name: string;
        id: string;
        startsOn: string;
        createdAt: string;
        scope: "room" | "service" | "folio";
        audience: "anyone" | "in_house";
        departmentName: string | null;
        description: string | null;
        propertyId: string;
        departmentId: string | null;
        discountKind: "percentage" | "fixed_amount";
        discountValue: number;
        endsOn: string | null;
        minNights: number | null;
        minSpendRwf: number | null;
        maxRedemptions: number | null;
        redemptionCount: number;
    }[];
}>;
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
export declare const GuestOffer: z.ZodObject<{
    id: z.ZodString;
    propertyId: z.ZodString;
    propertyName: z.ZodNullable<z.ZodString>;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    discountKind: z.ZodEnum<["percentage", "fixed_amount"]>;
    discountValue: z.ZodNumber;
    scope: z.ZodEnum<["room", "service", "folio"]>;
    departmentName: z.ZodNullable<z.ZodString>;
    /** True when a code has to be typed. The code itself is never sent out. */
    requiresCode: z.ZodBoolean;
    startsOn: z.ZodString;
    endsOn: z.ZodNullable<z.ZodString>;
    minNights: z.ZodNullable<z.ZodNumber>;
    minSpendRwf: z.ZodNullable<z.ZodNumber>;
    /** What it would take off this guest's bill right now. Zero when it cannot. */
    discountRwf: z.ZodNumber;
    eligible: z.ZodBoolean;
    /** Why not, in words for the guest. Null when it is available. */
    reason: z.ZodNullable<z.ZodString>;
    /** Already taken on this stay. */
    redeemed: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    name: string;
    reason: string | null;
    id: string;
    startsOn: string;
    propertyName: string | null;
    scope: "room" | "service" | "folio";
    departmentName: string | null;
    description: string | null;
    propertyId: string;
    eligible: boolean;
    discountKind: "percentage" | "fixed_amount";
    discountValue: number;
    endsOn: string | null;
    minNights: number | null;
    minSpendRwf: number | null;
    requiresCode: boolean;
    discountRwf: number;
    redeemed: boolean;
}, {
    name: string;
    reason: string | null;
    id: string;
    startsOn: string;
    propertyName: string | null;
    scope: "room" | "service" | "folio";
    departmentName: string | null;
    description: string | null;
    propertyId: string;
    eligible: boolean;
    discountKind: "percentage" | "fixed_amount";
    discountValue: number;
    endsOn: string | null;
    minNights: number | null;
    minSpendRwf: number | null;
    requiresCode: boolean;
    discountRwf: number;
    redeemed: boolean;
}>;
export type GuestOffer = z.infer<typeof GuestOffer>;
export declare const GuestOfferList: z.ZodObject<{
    stayId: z.ZodNullable<z.ZodString>;
    offers: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        propertyId: z.ZodString;
        propertyName: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        discountKind: z.ZodEnum<["percentage", "fixed_amount"]>;
        discountValue: z.ZodNumber;
        scope: z.ZodEnum<["room", "service", "folio"]>;
        departmentName: z.ZodNullable<z.ZodString>;
        /** True when a code has to be typed. The code itself is never sent out. */
        requiresCode: z.ZodBoolean;
        startsOn: z.ZodString;
        endsOn: z.ZodNullable<z.ZodString>;
        minNights: z.ZodNullable<z.ZodNumber>;
        minSpendRwf: z.ZodNullable<z.ZodNumber>;
        /** What it would take off this guest's bill right now. Zero when it cannot. */
        discountRwf: z.ZodNumber;
        eligible: z.ZodBoolean;
        /** Why not, in words for the guest. Null when it is available. */
        reason: z.ZodNullable<z.ZodString>;
        /** Already taken on this stay. */
        redeemed: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        name: string;
        reason: string | null;
        id: string;
        startsOn: string;
        propertyName: string | null;
        scope: "room" | "service" | "folio";
        departmentName: string | null;
        description: string | null;
        propertyId: string;
        eligible: boolean;
        discountKind: "percentage" | "fixed_amount";
        discountValue: number;
        endsOn: string | null;
        minNights: number | null;
        minSpendRwf: number | null;
        requiresCode: boolean;
        discountRwf: number;
        redeemed: boolean;
    }, {
        name: string;
        reason: string | null;
        id: string;
        startsOn: string;
        propertyName: string | null;
        scope: "room" | "service" | "folio";
        departmentName: string | null;
        description: string | null;
        propertyId: string;
        eligible: boolean;
        discountKind: "percentage" | "fixed_amount";
        discountValue: number;
        endsOn: string | null;
        minNights: number | null;
        minSpendRwf: number | null;
        requiresCode: boolean;
        discountRwf: number;
        redeemed: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    stayId: string | null;
    offers: {
        name: string;
        reason: string | null;
        id: string;
        startsOn: string;
        propertyName: string | null;
        scope: "room" | "service" | "folio";
        departmentName: string | null;
        description: string | null;
        propertyId: string;
        eligible: boolean;
        discountKind: "percentage" | "fixed_amount";
        discountValue: number;
        endsOn: string | null;
        minNights: number | null;
        minSpendRwf: number | null;
        requiresCode: boolean;
        discountRwf: number;
        redeemed: boolean;
    }[];
}, {
    stayId: string | null;
    offers: {
        name: string;
        reason: string | null;
        id: string;
        startsOn: string;
        propertyName: string | null;
        scope: "room" | "service" | "folio";
        departmentName: string | null;
        description: string | null;
        propertyId: string;
        eligible: boolean;
        discountKind: "percentage" | "fixed_amount";
        discountValue: number;
        endsOn: string | null;
        minNights: number | null;
        minSpendRwf: number | null;
        requiresCode: boolean;
        discountRwf: number;
        redeemed: boolean;
    }[];
}>;
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
export declare function offerEligibility(offer: OfferTerms, ctx: OfferContext): OfferAssessment;
/**
 * What one offer takes off one base amount, in francs.
 *
 * Separate from the eligibility check because both sides need the arithmetic
 * without the verdict — a card previews the saving before the guest has typed
 * the code — and because one function that returned a number sometimes and a
 * refusal other times would be read wrong exactly once.
 */
export declare function offerDiscountRwf(offer: Pick<OfferTerms, "discountKind" | "discountValue">, baseRwf: number): number;
/** Creating one. The property, its scope and its terms, all at once. */
export declare const CreateOfferRequest: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodObject<{
    propertyId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    discountKind: z.ZodEnum<["percentage", "fixed_amount"]>;
    discountValue: z.ZodNumber;
    scope: z.ZodEnum<["room", "service", "folio"]>;
    /** Only on a `service` offer; the database refuses it anywhere else. */
    departmentId: z.ZodOptional<z.ZodString>;
    /** Stored upper-cased, and unique among this property's live offers. */
    code: z.ZodOptional<z.ZodString>;
    audience: z.ZodOptional<z.ZodEnum<["anyone", "in_house"]>>;
    startsOn: z.ZodString;
    endsOn: z.ZodOptional<z.ZodString>;
    minNights: z.ZodOptional<z.ZodNumber>;
    minSpendRwf: z.ZodOptional<z.ZodNumber>;
    maxRedemptions: z.ZodOptional<z.ZodNumber>;
    /** Offers are born `draft`, so nobody publishes one by filling in a form. */
    status: z.ZodOptional<z.ZodEnum<["draft", "active", "archived"]>>;
}, "strict", z.ZodTypeAny, {
    name: string;
    startsOn: string;
    scope: "room" | "service" | "folio";
    propertyId: string;
    discountKind: "percentage" | "fixed_amount";
    discountValue: number;
    code?: string | undefined;
    status?: "active" | "draft" | "archived" | undefined;
    audience?: "anyone" | "in_house" | undefined;
    description?: string | undefined;
    departmentId?: string | undefined;
    endsOn?: string | undefined;
    minNights?: number | undefined;
    minSpendRwf?: number | undefined;
    maxRedemptions?: number | undefined;
}, {
    name: string;
    startsOn: string;
    scope: "room" | "service" | "folio";
    propertyId: string;
    discountKind: "percentage" | "fixed_amount";
    discountValue: number;
    code?: string | undefined;
    status?: "active" | "draft" | "archived" | undefined;
    audience?: "anyone" | "in_house" | undefined;
    description?: string | undefined;
    departmentId?: string | undefined;
    endsOn?: string | undefined;
    minNights?: number | undefined;
    minSpendRwf?: number | undefined;
    maxRedemptions?: number | undefined;
}>, {
    name: string;
    startsOn: string;
    scope: "room" | "service" | "folio";
    propertyId: string;
    discountKind: "percentage" | "fixed_amount";
    discountValue: number;
    code?: string | undefined;
    status?: "active" | "draft" | "archived" | undefined;
    audience?: "anyone" | "in_house" | undefined;
    description?: string | undefined;
    departmentId?: string | undefined;
    endsOn?: string | undefined;
    minNights?: number | undefined;
    minSpendRwf?: number | undefined;
    maxRedemptions?: number | undefined;
}, {
    name: string;
    startsOn: string;
    scope: "room" | "service" | "folio";
    propertyId: string;
    discountKind: "percentage" | "fixed_amount";
    discountValue: number;
    code?: string | undefined;
    status?: "active" | "draft" | "archived" | undefined;
    audience?: "anyone" | "in_house" | undefined;
    description?: string | undefined;
    departmentId?: string | undefined;
    endsOn?: string | undefined;
    minNights?: number | undefined;
    minSpendRwf?: number | undefined;
    maxRedemptions?: number | undefined;
}>, {
    name: string;
    startsOn: string;
    scope: "room" | "service" | "folio";
    propertyId: string;
    discountKind: "percentage" | "fixed_amount";
    discountValue: number;
    code?: string | undefined;
    status?: "active" | "draft" | "archived" | undefined;
    audience?: "anyone" | "in_house" | undefined;
    description?: string | undefined;
    departmentId?: string | undefined;
    endsOn?: string | undefined;
    minNights?: number | undefined;
    minSpendRwf?: number | undefined;
    maxRedemptions?: number | undefined;
}, {
    name: string;
    startsOn: string;
    scope: "room" | "service" | "folio";
    propertyId: string;
    discountKind: "percentage" | "fixed_amount";
    discountValue: number;
    code?: string | undefined;
    status?: "active" | "draft" | "archived" | undefined;
    audience?: "anyone" | "in_house" | undefined;
    description?: string | undefined;
    departmentId?: string | undefined;
    endsOn?: string | undefined;
    minNights?: number | undefined;
    minSpendRwf?: number | undefined;
    maxRedemptions?: number | undefined;
}>, {
    name: string;
    startsOn: string;
    scope: "room" | "service" | "folio";
    propertyId: string;
    discountKind: "percentage" | "fixed_amount";
    discountValue: number;
    code?: string | undefined;
    status?: "active" | "draft" | "archived" | undefined;
    audience?: "anyone" | "in_house" | undefined;
    description?: string | undefined;
    departmentId?: string | undefined;
    endsOn?: string | undefined;
    minNights?: number | undefined;
    minSpendRwf?: number | undefined;
    maxRedemptions?: number | undefined;
}, {
    name: string;
    startsOn: string;
    scope: "room" | "service" | "folio";
    propertyId: string;
    discountKind: "percentage" | "fixed_amount";
    discountValue: number;
    code?: string | undefined;
    status?: "active" | "draft" | "archived" | undefined;
    audience?: "anyone" | "in_house" | undefined;
    description?: string | undefined;
    departmentId?: string | undefined;
    endsOn?: string | undefined;
    minNights?: number | undefined;
    minSpendRwf?: number | undefined;
    maxRedemptions?: number | undefined;
}>;
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
export declare const UpdateOfferRequest: z.ZodEffects<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    discountKind: z.ZodOptional<z.ZodEnum<["percentage", "fixed_amount"]>>;
    discountValue: z.ZodOptional<z.ZodNumber>;
    audience: z.ZodOptional<z.ZodEnum<["anyone", "in_house"]>>;
    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    startsOn: z.ZodOptional<z.ZodString>;
    endsOn: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    minNights: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    minSpendRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    maxRedemptions: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    status: z.ZodOptional<z.ZodEnum<["draft", "active", "archived"]>>;
}, "strict", z.ZodTypeAny, {
    code?: string | null | undefined;
    status?: "active" | "draft" | "archived" | undefined;
    name?: string | undefined;
    startsOn?: string | undefined;
    audience?: "anyone" | "in_house" | undefined;
    description?: string | null | undefined;
    discountKind?: "percentage" | "fixed_amount" | undefined;
    discountValue?: number | undefined;
    endsOn?: string | null | undefined;
    minNights?: number | null | undefined;
    minSpendRwf?: number | null | undefined;
    maxRedemptions?: number | null | undefined;
}, {
    code?: string | null | undefined;
    status?: "active" | "draft" | "archived" | undefined;
    name?: string | undefined;
    startsOn?: string | undefined;
    audience?: "anyone" | "in_house" | undefined;
    description?: string | null | undefined;
    discountKind?: "percentage" | "fixed_amount" | undefined;
    discountValue?: number | undefined;
    endsOn?: string | null | undefined;
    minNights?: number | null | undefined;
    minSpendRwf?: number | null | undefined;
    maxRedemptions?: number | null | undefined;
}>, {
    code?: string | null | undefined;
    status?: "active" | "draft" | "archived" | undefined;
    name?: string | undefined;
    startsOn?: string | undefined;
    audience?: "anyone" | "in_house" | undefined;
    description?: string | null | undefined;
    discountKind?: "percentage" | "fixed_amount" | undefined;
    discountValue?: number | undefined;
    endsOn?: string | null | undefined;
    minNights?: number | null | undefined;
    minSpendRwf?: number | null | undefined;
    maxRedemptions?: number | null | undefined;
}, {
    code?: string | null | undefined;
    status?: "active" | "draft" | "archived" | undefined;
    name?: string | undefined;
    startsOn?: string | undefined;
    audience?: "anyone" | "in_house" | undefined;
    description?: string | null | undefined;
    discountKind?: "percentage" | "fixed_amount" | undefined;
    discountValue?: number | undefined;
    endsOn?: string | null | undefined;
    minNights?: number | null | undefined;
    minSpendRwf?: number | null | undefined;
    maxRedemptions?: number | null | undefined;
}>;
export type UpdateOfferRequest = z.infer<typeof UpdateOfferRequest>;
/** Taking one. The stay comes from the session, so only the code can be typed. */
export declare const RedeemOfferRequest: z.ZodObject<{
    /** The stay to put it on. Required when the guest is in two places at once. */
    stayId: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    code?: string | undefined;
    stayId?: string | undefined;
}, {
    code?: string | undefined;
    stayId?: string | undefined;
}>;
export type RedeemOfferRequest = z.infer<typeof RedeemOfferRequest>;
/** What redeeming answers: the credit, and the bill it landed on. */
export declare const RedeemOfferResult: z.ZodObject<{
    offerId: z.ZodString;
    offerName: z.ZodString;
    stayId: z.ZodString;
    folioId: z.ZodString;
    /** The negative folio line this wrote. */
    folioChargeId: z.ZodNullable<z.ZodString>;
    /** What came off, positive. */
    discountRwf: z.ZodNumber;
    /** The bill after it. */
    balanceRwf: z.ZodNumber;
    /** False when this stay had already taken it; the earlier credit stands. */
    applied: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    stayId: string;
    balanceRwf: number;
    folioId: string;
    discountRwf: number;
    offerId: string;
    offerName: string;
    folioChargeId: string | null;
    applied: boolean;
}, {
    stayId: string;
    balanceRwf: number;
    folioId: string;
    discountRwf: number;
    offerId: string;
    offerName: string;
    folioChargeId: string | null;
    applied: boolean;
}>;
export type RedeemOfferResult = z.infer<typeof RedeemOfferResult>;
//# sourceMappingURL=offers.d.ts.map