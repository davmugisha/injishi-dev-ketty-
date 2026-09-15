import { z } from "zod";
/**
 * Hospitality inventory + booking wire contracts (F-B03, F-B05, F-B15, FL07).
 *
 * Enum members mirror the Postgres enums in
 * server/api/src/database/drizzle/schema.ts EXACTLY — do not fork.
 */
/** Per-Room-type booking mode (F-B03). */
export declare const BookingMode: z.ZodEnum<["instant_book", "request_to_book"]>;
export type BookingMode = z.infer<typeof BookingMode>;
/** Sub-field of `request_to_book` only — never a mode of its own (F-B03). */
export declare const ApprovalPolicy: z.ZodEnum<["approve_all", "approve_first_three"]>;
export type ApprovalPolicy = z.infer<typeof ApprovalPolicy>;
export declare const CancellationTier: z.ZodEnum<["flexible", "moderate", "limited", "firm", "strict_extended_stay"]>;
export type CancellationTier = z.infer<typeof CancellationTier>;
export declare const BookingStatus: z.ZodEnum<["pending_approval", "confirmed", "declined", "cancelled", "no_show"]>;
export type BookingStatus = z.infer<typeof BookingStatus>;
export declare const PaymentStatus: z.ZodEnum<["captured", "refunded_full", "refunded_partial", "forfeited", "paid_out"]>;
export type PaymentStatus = z.infer<typeof PaymentStatus>;
/** Why a `request_to_book` was declined (mirrors the Postgres `decline_reason` enum). */
export declare const DeclineReason: z.ZodEnum<["host_declined", "expired"]>;
export type DeclineReason = z.infer<typeof DeclineReason>;
export declare const EscrowStatus: z.ZodEnum<["held", "released", "refunded_full", "refunded_partial", "forfeited"]>;
export type EscrowStatus = z.infer<typeof EscrowStatus>;
/** ISO calendar day, `yyyy-mm-dd` (booking dates are days, not instants). */
export declare const IsoDate: z.ZodString;
export type IsoDate = z.infer<typeof IsoDate>;
export declare const RoomTypeSummary: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    domain: z.ZodEnum<["hospitality", "residence"]>;
    capacity: z.ZodNullable<z.ZodNumber>;
    /** Bookable units of this Room type (the atomic-hold denominator). */
    roomCount: z.ZodNumber;
    nightlyRateRwf: z.ZodNullable<z.ZodNumber>;
    bookingMode: z.ZodNullable<z.ZodEnum<["instant_book", "request_to_book"]>>;
    approvalPolicy: z.ZodNullable<z.ZodEnum<["approve_all", "approve_first_three"]>>;
    cancellationTier: z.ZodNullable<z.ZodEnum<["flexible", "moderate", "limited", "firm", "strict_extended_stay"]>>;
    nonrefundableEligible: z.ZodBoolean;
    /**
     * The shortest stay this room accepts (ARI, F-L08).
     *
     * The column has always existed and no client read it, so a room with a
     * three-night minimum was offered for one night and refused later. Nullable
     * on the wire because a host may not have set one; a consumer reads an
     * absent minimum as 1 rather than inventing a longer one.
     */
    minStay: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    domain: "hospitality" | "residence";
    name: string;
    roomCount: number;
    capacity: number | null;
    nightlyRateRwf: number | null;
    bookingMode: "instant_book" | "request_to_book" | null;
    approvalPolicy: "approve_all" | "approve_first_three" | null;
    cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
    nonrefundableEligible: boolean;
    minStay: number | null;
}, {
    id: string;
    domain: "hospitality" | "residence";
    name: string;
    roomCount: number;
    capacity: number | null;
    nightlyRateRwf: number | null;
    bookingMode: "instant_book" | "request_to_book" | null;
    approvalPolicy: "approve_all" | "approve_first_three" | null;
    cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
    nonrefundableEligible: boolean;
    minStay: number | null;
}>;
export type RoomTypeSummary = z.infer<typeof RoomTypeSummary>;
/**
 * One entry in the marketplace sitemap: `GET /api/v1/properties/sitemap`
 * (ADR-053, AC-I9).
 *
 * Read through the same visibility rule as a property page, so an unpublished or
 * suspended property is in neither. `publishedAt` is the most recent publish, a
 * crawler's `lastmod` hint and nothing more.
 */
export declare const SitemapProperty: z.ZodObject<{
    slug: z.ZodString;
    publishedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    slug: string;
    publishedAt: string | null;
}, {
    slug: string;
    publishedAt: string | null;
}>;
export type SitemapProperty = z.infer<typeof SitemapProperty>;
/**
 * The property, as the CHECKOUT needs to name it. Not a second PropertyDetail.
 *
 * A checkout has to say which property it is selling and link back to it. It
 * does not need the description, the house rules, the coordinates or the other
 * room types, and `PropertyDetail` carries all of them plus every room type on
 * the property — so serving checkout from that endpoint meant fetching a
 * document to read six fields out of it.
 */
export declare const BookablePropertySummary: z.ZodObject<{
    id: z.ZodString;
    slug: z.ZodNullable<z.ZodString>;
    name: z.ZodString;
    districtName: z.ZodNullable<z.ZodString>;
    checkInTime: z.ZodNullable<z.ZodString>;
    checkOutTime: z.ZodNullable<z.ZodString>;
    /**
     * The cover's photo route URL, or null — the checkout shows one thumbnail,
     * never a gallery. The same kind of URL `PropertyDetail.photos` carries.
     */
    photo: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    districtName: string | null;
    id: string;
    name: string;
    slug: string | null;
    checkInTime: string | null;
    checkOutTime: string | null;
    photo: string | null;
}, {
    districtName: string | null;
    id: string;
    name: string;
    slug: string | null;
    checkInTime: string | null;
    checkOutTime: string | null;
    photo: string | null;
}>;
export type BookablePropertySummary = z.infer<typeof BookablePropertySummary>;
/**
 * What `GET /api/v1/bookable/:roomTypeId` answers (ADR-020, checkout).
 *
 * ONE room type and the property it belongs to, resolved server-side from the
 * room type alone. The client used to send both ids and the server trusted the
 * pair; a hand-edited url could therefore price one property's room against
 * another's page. Here the property is DERIVED from the room type, so the pair
 * cannot disagree because there is no pair.
 *
 * It answers only for a room type whose listing is `published` and whose status
 * is `active`, which is the same visibility rule `PropertyDetail` enforces.
 */
export declare const BookableRoom: z.ZodObject<{
    property: z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
        districtName: z.ZodNullable<z.ZodString>;
        checkInTime: z.ZodNullable<z.ZodString>;
        checkOutTime: z.ZodNullable<z.ZodString>;
        /**
         * The cover's photo route URL, or null — the checkout shows one thumbnail,
         * never a gallery. The same kind of URL `PropertyDetail.photos` carries.
         */
        photo: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        districtName: string | null;
        id: string;
        name: string;
        slug: string | null;
        checkInTime: string | null;
        checkOutTime: string | null;
        photo: string | null;
    }, {
        districtName: string | null;
        id: string;
        name: string;
        slug: string | null;
        checkInTime: string | null;
        checkOutTime: string | null;
        photo: string | null;
    }>;
    roomType: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        domain: z.ZodEnum<["hospitality", "residence"]>;
        capacity: z.ZodNullable<z.ZodNumber>;
        /** Bookable units of this Room type (the atomic-hold denominator). */
        roomCount: z.ZodNumber;
        nightlyRateRwf: z.ZodNullable<z.ZodNumber>;
        bookingMode: z.ZodNullable<z.ZodEnum<["instant_book", "request_to_book"]>>;
        approvalPolicy: z.ZodNullable<z.ZodEnum<["approve_all", "approve_first_three"]>>;
        cancellationTier: z.ZodNullable<z.ZodEnum<["flexible", "moderate", "limited", "firm", "strict_extended_stay"]>>;
        nonrefundableEligible: z.ZodBoolean;
        /**
         * The shortest stay this room accepts (ARI, F-L08).
         *
         * The column has always existed and no client read it, so a room with a
         * three-night minimum was offered for one night and refused later. Nullable
         * on the wire because a host may not have set one; a consumer reads an
         * absent minimum as 1 rather than inventing a longer one.
         */
        minStay: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        domain: "hospitality" | "residence";
        name: string;
        roomCount: number;
        capacity: number | null;
        nightlyRateRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        approvalPolicy: "approve_all" | "approve_first_three" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        minStay: number | null;
    }, {
        id: string;
        domain: "hospitality" | "residence";
        name: string;
        roomCount: number;
        capacity: number | null;
        nightlyRateRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        approvalPolicy: "approve_all" | "approve_first_three" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        minStay: number | null;
    }>;
}, "strip", z.ZodTypeAny, {
    property: {
        districtName: string | null;
        id: string;
        name: string;
        slug: string | null;
        checkInTime: string | null;
        checkOutTime: string | null;
        photo: string | null;
    };
    roomType: {
        id: string;
        domain: "hospitality" | "residence";
        name: string;
        roomCount: number;
        capacity: number | null;
        nightlyRateRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        approvalPolicy: "approve_all" | "approve_first_three" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        minStay: number | null;
    };
}, {
    property: {
        districtName: string | null;
        id: string;
        name: string;
        slug: string | null;
        checkInTime: string | null;
        checkOutTime: string | null;
        photo: string | null;
    };
    roomType: {
        id: string;
        domain: "hospitality" | "residence";
        name: string;
        roomCount: number;
        capacity: number | null;
        nightlyRateRwf: number | null;
        bookingMode: "instant_book" | "request_to_book" | null;
        approvalPolicy: "approve_all" | "approve_first_three" | null;
        cancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        nonrefundableEligible: boolean;
        minStay: number | null;
    };
}>;
export type BookableRoom = z.infer<typeof BookableRoom>;
/**
 * The bounds a stay has to fit inside, defined ONCE for both sides.
 *
 * These lived only in `server/api/src/modules/booking/domain/pricing.ts`, so
 * the API refused a stay the calendar had happily offered: a guest could pick
 * 120 nights, or a date three years out, fill in a payment method, and learn at
 * the last click that neither was ever allowed. A bound the client cannot see
 * is a bound the client cannot help the guest respect.
 *
 * `pricing.ts` re-exports these rather than restating them, so there is still
 * one number per rule.
 */
export declare const MAX_NIGHTS = 90;
/** How far ahead a booking may be made. 18 months. */
export declare const MAX_HORIZON_DAYS = 540;
/** A room type with no stated capacity is not unlimited. */
export declare const DEFAULT_CAPACITY = 4;
/** Every stay in this catalogue is in Rwanda, so "today" is a Kigali fact. */
export declare const PROPERTY_TIME_ZONE = "Africa/Kigali";
/** How many units of one room type are free on one night. */
export declare const NightAvailability: z.ZodObject<{
    night: z.ZodString;
    /** 0 means sold out. Never negative, whatever the bookings say. */
    freeUnits: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    night: string;
    freeUnits: number;
}, {
    night: string;
    freeUnits: number;
}>;
export type NightAvailability = z.infer<typeof NightAvailability>;
/**
 * What `GET /api/v1/room-types/:id/availability` answers.
 *
 * ## Why this exists
 *
 * `BookingRepository.freeUnits` has always been correct and was reachable from
 * exactly one place: inside `BookingService.create`, as a pre-check. Nothing
 * exposed it. So the calendar offered sold-out nights, the widget priced them,
 * the guest filled in a payment method, and the first anyone said "that room is
 * gone" was a 409 on the last click — after a charge had been attempted and
 * compensated.
 *
 * ## Per NIGHT, not per range
 *
 * The pre-check asks one question — "is anything free across these dates" — and
 * one number answers it. A calendar asks a different question about every cell,
 * and collapsing that to a range answer would grey out a whole month because
 * one Tuesday is full.
 *
 * A night is occupied by a booking when `check_in <= night < check_out`, so the
 * checkout DAY of one stay is bookable as the arrival day of the next. That is
 * the same half-open interval the availability hold uses, and getting it wrong
 * in either direction is either an oversell or a room nobody can buy.
 */
export declare const RoomAvailability: z.ZodObject<{
    roomTypeId: z.ZodString;
    /** Units that exist, the denominator every `freeUnits` is measured against. */
    roomCount: z.ZodNumber;
    /** Shortest stay this room accepts (ARI). 1 when the host set none. */
    minStay: z.ZodNumber;
    /** One entry per night in the requested window, in order. */
    nights: z.ZodArray<z.ZodObject<{
        night: z.ZodString;
        /** 0 means sold out. Never negative, whatever the bookings say. */
        freeUnits: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        night: string;
        freeUnits: number;
    }, {
        night: string;
        freeUnits: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    roomCount: number;
    minStay: number;
    roomTypeId: string;
    nights: {
        night: string;
        freeUnits: number;
    }[];
}, {
    roomCount: number;
    minStay: number;
    roomTypeId: string;
    nights: {
        night: string;
        freeUnits: number;
    }[];
}>;
export type RoomAvailability = z.infer<typeof RoomAvailability>;
/**
 * Nights a guest must not be offered, as a set of `yyyy-mm-dd`.
 *
 * Derived rather than served: the API answers with counts, because "sold out"
 * is a question about how many units are left and a client may want to say
 * "only one left" as well as "unavailable". One implementation of the
 * threshold, so a calendar and a summary cannot disagree about what full means.
 */
export declare function soldOutNights(availability: RoomAvailability): string[];
/**
 * The two mobile money rails Rwanda actually pays on.
 *
 * The prefixes each network owns live with this enum rather than in a form,
 * because the SAME question is asked on three surfaces — the web checkout, the
 * mobile stepper, and the API when it decides which rail to push a prompt at —
 * and three copies of a prefix table is three answers to "is this an MTN
 * number". `apps/web/src/lib/payment-methods.ts` and
 * `apps/mobile/src/screens/guest/book-format.ts` each carried their own.
 */
export declare const MobileMoneyNetwork: z.ZodEnum<["mtn_momo", "airtel_money"]>;
export type MobileMoneyNetwork = z.infer<typeof MobileMoneyNetwork>;
/** The MSISDN prefixes each network issues, after the +250 country code. */
export declare const NETWORK_PREFIXES: Readonly<Record<MobileMoneyNetwork, readonly string[]>>;
/** Rwandan MSISDN, reduced to its nine national digits. */
export declare const NationalMsisdn: z.ZodString;
/**
 * Which network a number belongs to, or null when no rail claims the prefix.
 * One implementation, so a form and the server cannot disagree about it.
 */
export declare function networkForMsisdn(national: string): MobileMoneyNetwork | null;
/**
 * WHO to charge, and on which rail (ADR-047).
 *
 * This is the field the three-step paywall was collecting and throwing away.
 * The checkout asked for an MTN number or a card, validated it locally, and
 * then sent a body that had nowhere to put it — so `captureEscrow` was called
 * with an amount and no payer, which no real provider can act on. A live
 * adapter was therefore unwritable against the old contract, whatever else was
 * built.
 *
 * **A card is a TOKEN, never a number.** `card.token` is what a provider's
 * hosted field or iframe hands back; a PAN and a CVV must never cross this
 * boundary, because the moment they do every service that can see this request
 * is inside PCI scope. The web checkout's own card form collected both and the
 * union is what makes sending them a type error rather than a decision.
 */
export declare const PaymentInstrument: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"mobile_money">;
    network: z.ZodEnum<["mtn_momo", "airtel_money"]>;
    /** Nine national digits. Normalised by the client; re-checked here. */
    msisdn: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "mobile_money";
    network: "mtn_momo" | "airtel_money";
    msisdn: string;
}, {
    kind: "mobile_money";
    network: "mtn_momo" | "airtel_money";
    msisdn: string;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"card">;
    /** A provider token from a hosted field. NEVER a card number. */
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "card";
    token: string;
}, {
    kind: "card";
    token: string;
}>]>;
export type PaymentInstrument = z.infer<typeof PaymentInstrument>;
/**
 * Is this number on the network it was filed under?
 *
 * The commonest mis-entry on a two-network market is an Airtel number typed
 * into the MTN row, which a provider refuses with a message about the account
 * rather than the number. Both the form and the API check it with this.
 */
export declare function instrumentProblem(instrument: PaymentInstrument): string | null;
/**
 * The guest's booking intent. Price is NOT accepted from the client — the
 * server re-derives the MoneyBreakdown from the Room type's locked rate, so a
 * tampered total cannot under-charge.
 */
export declare const CreateBookingInput: z.ZodObject<{
    roomTypeId: z.ZodString;
    checkIn: z.ZodString;
    checkOut: z.ZodString;
    guests: z.ZodNumber;
    nonRefundable: z.ZodDefault<z.ZodBoolean>;
    /**
     * One press of confirm, named (ADR-020 D-c).
     *
     * The browser mints one uuid per press and reuses it on every retry of that
     * press, so a slow request the client gave up on and re-sent is recognised as
     * the same intent rather than charged again. A NEW press, or a changed quote,
     * mints a NEW token, which is what lets one guest hold two rooms of the same
     * type for the same nights.
     *
     * Optional here on purpose, and only for now: migration phase 2 (ADR-020)
     * ships the field before any client sends it, so an API deploy never rejects
     * a browser still running the previous bundle. The server mints one when it is
     * absent, so the key it derives is still unique and the duplicate constraint
     * is simply inert for that request. It is NEVER null: a null under a unique
     * index deduplicates nothing.
     */
    attemptToken: z.ZodOptional<z.ZodString>;
    /**
     * How to take the money (ADR-047).
     *
     * REQUIRED, unlike `attemptToken`, and the difference is deliberate. An
     * absent attempt token degrades to a unique key and the request still
     * means something; an absent instrument means "charge somebody, somehow",
     * which is not a booking anyone can honour. `apps/web` is the only client
     * that creates bookings today, so requiring it costs no migration window.
     */
    instrument: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
        kind: z.ZodLiteral<"mobile_money">;
        network: z.ZodEnum<["mtn_momo", "airtel_money"]>;
        /** Nine national digits. Normalised by the client; re-checked here. */
        msisdn: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        kind: "mobile_money";
        network: "mtn_momo" | "airtel_money";
        msisdn: string;
    }, {
        kind: "mobile_money";
        network: "mtn_momo" | "airtel_money";
        msisdn: string;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"card">;
        /** A provider token from a hosted field. NEVER a card number. */
        token: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        kind: "card";
        token: string;
    }, {
        kind: "card";
        token: string;
    }>]>;
}, "strip", z.ZodTypeAny, {
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    nonRefundable: boolean;
    instrument: {
        kind: "mobile_money";
        network: "mtn_momo" | "airtel_money";
        msisdn: string;
    } | {
        kind: "card";
        token: string;
    };
    attemptToken?: string | undefined;
}, {
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    instrument: {
        kind: "mobile_money";
        network: "mtn_momo" | "airtel_money";
        msisdn: string;
    } | {
        kind: "card";
        token: string;
    };
    nonRefundable?: boolean | undefined;
    attemptToken?: string | undefined;
}>;
export type CreateBookingInput = z.infer<typeof CreateBookingInput>;
/** Server-computed price breakdown, echoed back so the UI can show what was charged. */
export declare const MoneyBreakdown: z.ZodObject<{
    nights: z.ZodNumber;
    nightlyRateRwf: z.ZodNumber;
    accommodationRwf: z.ZodNumber;
    nonRefundableDiscountRwf: z.ZodNumber;
    serviceFeeRwf: z.ZodNumber;
    /** Total captured into Escrow at booking time. */
    grossRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    nightlyRateRwf: number;
    nights: number;
    accommodationRwf: number;
    nonRefundableDiscountRwf: number;
    serviceFeeRwf: number;
    grossRwf: number;
}, {
    nightlyRateRwf: number;
    nights: number;
    accommodationRwf: number;
    nonRefundableDiscountRwf: number;
    serviceFeeRwf: number;
    grossRwf: number;
}>;
export type MoneyBreakdown = z.infer<typeof MoneyBreakdown>;
/**
 * Non-refundable rate is ~10% cheaper than the standard one (F-B05 Path A).
 */
export declare const NON_REFUNDABLE_DISCOUNT = 0.1;
/** Guest service fee. Rates are quoted excluding it. */
export declare const GUEST_SERVICE_FEE_RATE = 0.05;
/**
 * The one implementation of what a stay costs (ADR-014 call 4, ADR-020 AC-8).
 *
 * It lives here rather than in either consumer because it DEFINES what
 * `MoneyBreakdown` means — that is the whole test for putting logic in this
 * package (ADR-014 supporting call S5), and nothing else in booking passes it.
 *
 * It used to exist twice: once in the API's pricing module and once in the web
 * app's checkout preview, identical by hand. Two copies of a rounding rule is a
 * quote that eventually disagrees with the charge, and the guest reads the
 * quote. The API remains the only authority on the charge; the web app now
 * previews it with the same arithmetic instead of a lookalike.
 */
export declare function computeBreakdown(args: {
    nightlyRateRwf: number;
    nights: number;
    nonRefundable: boolean;
}): MoneyBreakdown;
export declare const BookingResult: z.ZodObject<{
    id: z.ZodString;
    /** Human-facing reference, e.g. `BK-7Q2M4X`. */
    reference: z.ZodString;
    status: z.ZodEnum<["pending_approval", "confirmed", "declined", "cancelled", "no_show"]>;
    bookingMode: z.ZodEnum<["instant_book", "request_to_book"]>;
    paymentStatus: z.ZodNullable<z.ZodEnum<["captured", "refunded_full", "refunded_partial", "forfeited", "paid_out"]>>;
    escrowStatus: z.ZodNullable<z.ZodEnum<["held", "released", "refunded_full", "refunded_partial", "forfeited"]>>;
    nonRefundable: z.ZodBoolean;
    lockedCancellationTier: z.ZodNullable<z.ZodEnum<["flexible", "moderate", "limited", "firm", "strict_extended_stay"]>>;
    checkIn: z.ZodString;
    checkOut: z.ZodString;
    guests: z.ZodNumber;
    breakdown: z.ZodObject<{
        nights: z.ZodNumber;
        nightlyRateRwf: z.ZodNumber;
        accommodationRwf: z.ZodNumber;
        nonRefundableDiscountRwf: z.ZodNumber;
        serviceFeeRwf: z.ZodNumber;
        /** Total captured into Escrow at booking time. */
        grossRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        nightlyRateRwf: number;
        nights: number;
        accommodationRwf: number;
        nonRefundableDiscountRwf: number;
        serviceFeeRwf: number;
        grossRwf: number;
    }, {
        nightlyRateRwf: number;
        nights: number;
        accommodationRwf: number;
        nonRefundableDiscountRwf: number;
        serviceFeeRwf: number;
        grossRwf: number;
    }>;
    /** Set for `request_to_book`: when the request auto-declines (F-B03). */
    approvalExpiresAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
    id: string;
    reference: string;
    bookingMode: "instant_book" | "request_to_book";
    checkIn: string;
    checkOut: string;
    guests: number;
    nonRefundable: boolean;
    paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
    escrowStatus: "held" | "refunded_full" | "refunded_partial" | "forfeited" | "released" | null;
    lockedCancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
    breakdown: {
        nightlyRateRwf: number;
        nights: number;
        accommodationRwf: number;
        nonRefundableDiscountRwf: number;
        serviceFeeRwf: number;
        grossRwf: number;
    };
    approvalExpiresAt: string | null;
}, {
    status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
    id: string;
    reference: string;
    bookingMode: "instant_book" | "request_to_book";
    checkIn: string;
    checkOut: string;
    guests: number;
    nonRefundable: boolean;
    paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
    escrowStatus: "held" | "refunded_full" | "refunded_partial" | "forfeited" | "released" | null;
    lockedCancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
    breakdown: {
        nightlyRateRwf: number;
        nights: number;
        accommodationRwf: number;
        nonRefundableDiscountRwf: number;
        serviceFeeRwf: number;
        grossRwf: number;
    };
    approvalExpiresAt: string | null;
}>;
export type BookingResult = z.infer<typeof BookingResult>;
/**
 * Where one press of confirm got to.
 *
 * Every Rwandan mobile money rail works the same way: the provider accepts the
 * instruction, pushes a prompt to a handset, and the customer LEAVES this app
 * to approve it in the MoMo app or on `*182#`. The answer arrives later.
 *
 * The API had no state for that interval. An unsettled capture was a 402 and a
 * sentence telling the guest to press the button again — a person polling a
 * payment provider by hand — and the mock adapter reported everything as
 * instantly settled because anything else "would refuse every booking in
 * development", in its own words. So the path every real payment on this
 * platform will take had never once been run end to end.
 *
 * `apps/mobile` already modelled this correctly in `data/payment-attempt.ts`,
 * and its obligations are the ones honoured here: the wait survives the app
 * closing, not-knowing is the default rather than an error, and ONLY the
 * provider can produce `confirmed`.
 */
export declare const PaymentAttemptState: z.ZodEnum<["prompting", "confirmed", "refused", "expired"]>;
export type PaymentAttemptState = z.infer<typeof PaymentAttemptState>;
/** What a poll of `GET /api/v1/bookings/attempts/:token` answers. */
export declare const PaymentAttemptStatus: z.ZodObject<{
    attemptToken: z.ZodString;
    state: z.ZodEnum<["prompting", "confirmed", "refused", "expired"]>;
    /** Which rail is being waited on, so the screen can name it. */
    network: z.ZodNullable<z.ZodEnum<["mtn_momo", "airtel_money"]>>;
    /** `078••••456`. Enough to recognise, never enough to charge. */
    payerMasked: z.ZodNullable<z.ZodString>;
    amountRwf: z.ZodNullable<z.ZodNumber>;
    /** When an unanswered prompt stops being worth waiting for. */
    expiresAt: z.ZodString;
    /**
     * The reservation, present exactly when `state` is `confirmed`.
     *
     * A booking is written when the money settles and never before, which is
     * ADR-020 D-b unchanged: a reservation on the strength of a prompt nobody
     * has answered is a receipt for something that does not exist. What changed
     * is that the guest now has somewhere to wait instead of a refusal.
     */
    booking: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        /** Human-facing reference, e.g. `BK-7Q2M4X`. */
        reference: z.ZodString;
        status: z.ZodEnum<["pending_approval", "confirmed", "declined", "cancelled", "no_show"]>;
        bookingMode: z.ZodEnum<["instant_book", "request_to_book"]>;
        paymentStatus: z.ZodNullable<z.ZodEnum<["captured", "refunded_full", "refunded_partial", "forfeited", "paid_out"]>>;
        escrowStatus: z.ZodNullable<z.ZodEnum<["held", "released", "refunded_full", "refunded_partial", "forfeited"]>>;
        nonRefundable: z.ZodBoolean;
        lockedCancellationTier: z.ZodNullable<z.ZodEnum<["flexible", "moderate", "limited", "firm", "strict_extended_stay"]>>;
        checkIn: z.ZodString;
        checkOut: z.ZodString;
        guests: z.ZodNumber;
        breakdown: z.ZodObject<{
            nights: z.ZodNumber;
            nightlyRateRwf: z.ZodNumber;
            accommodationRwf: z.ZodNumber;
            nonRefundableDiscountRwf: z.ZodNumber;
            serviceFeeRwf: z.ZodNumber;
            /** Total captured into Escrow at booking time. */
            grossRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            nightlyRateRwf: number;
            nights: number;
            accommodationRwf: number;
            nonRefundableDiscountRwf: number;
            serviceFeeRwf: number;
            grossRwf: number;
        }, {
            nightlyRateRwf: number;
            nights: number;
            accommodationRwf: number;
            nonRefundableDiscountRwf: number;
            serviceFeeRwf: number;
            grossRwf: number;
        }>;
        /** Set for `request_to_book`: when the request auto-declines (F-B03). */
        approvalExpiresAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
        id: string;
        reference: string;
        bookingMode: "instant_book" | "request_to_book";
        checkIn: string;
        checkOut: string;
        guests: number;
        nonRefundable: boolean;
        paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
        escrowStatus: "held" | "refunded_full" | "refunded_partial" | "forfeited" | "released" | null;
        lockedCancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        breakdown: {
            nightlyRateRwf: number;
            nights: number;
            accommodationRwf: number;
            nonRefundableDiscountRwf: number;
            serviceFeeRwf: number;
            grossRwf: number;
        };
        approvalExpiresAt: string | null;
    }, {
        status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
        id: string;
        reference: string;
        bookingMode: "instant_book" | "request_to_book";
        checkIn: string;
        checkOut: string;
        guests: number;
        nonRefundable: boolean;
        paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
        escrowStatus: "held" | "refunded_full" | "refunded_partial" | "forfeited" | "released" | null;
        lockedCancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        breakdown: {
            nightlyRateRwf: number;
            nights: number;
            accommodationRwf: number;
            nonRefundableDiscountRwf: number;
            serviceFeeRwf: number;
            grossRwf: number;
        };
        approvalExpiresAt: string | null;
    }>>;
    /** Why it ended badly, in words meant for the guest. */
    failureReason: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    booking: {
        status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
        id: string;
        reference: string;
        bookingMode: "instant_book" | "request_to_book";
        checkIn: string;
        checkOut: string;
        guests: number;
        nonRefundable: boolean;
        paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
        escrowStatus: "held" | "refunded_full" | "refunded_partial" | "forfeited" | "released" | null;
        lockedCancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        breakdown: {
            nightlyRateRwf: number;
            nights: number;
            accommodationRwf: number;
            nonRefundableDiscountRwf: number;
            serviceFeeRwf: number;
            grossRwf: number;
        };
        approvalExpiresAt: string | null;
    } | null;
    amountRwf: number | null;
    failureReason: string | null;
    state: "expired" | "confirmed" | "prompting" | "refused";
    network: "mtn_momo" | "airtel_money" | null;
    attemptToken: string;
    payerMasked: string | null;
    expiresAt: string;
}, {
    booking: {
        status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
        id: string;
        reference: string;
        bookingMode: "instant_book" | "request_to_book";
        checkIn: string;
        checkOut: string;
        guests: number;
        nonRefundable: boolean;
        paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
        escrowStatus: "held" | "refunded_full" | "refunded_partial" | "forfeited" | "released" | null;
        lockedCancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        breakdown: {
            nightlyRateRwf: number;
            nights: number;
            accommodationRwf: number;
            nonRefundableDiscountRwf: number;
            serviceFeeRwf: number;
            grossRwf: number;
        };
        approvalExpiresAt: string | null;
    } | null;
    amountRwf: number | null;
    failureReason: string | null;
    state: "expired" | "confirmed" | "prompting" | "refused";
    network: "mtn_momo" | "airtel_money" | null;
    attemptToken: string;
    payerMasked: string | null;
    expiresAt: string;
}>;
export type PaymentAttemptStatus = z.infer<typeof PaymentAttemptStatus>;
/**
 * What `POST /api/v1/bookings` answers.
 *
 * A discriminated union rather than one shape, because the two outcomes are
 * genuinely different events and collapsing them is what produced the 402 dead
 * end. A card settles inside the request and there is a booking; a mobile money
 * prompt does not, and what comes back is something to WAIT on.
 */
export declare const CreateBookingOutcome: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
    status: z.ZodLiteral<"confirmed">;
    booking: z.ZodObject<{
        id: z.ZodString;
        /** Human-facing reference, e.g. `BK-7Q2M4X`. */
        reference: z.ZodString;
        status: z.ZodEnum<["pending_approval", "confirmed", "declined", "cancelled", "no_show"]>;
        bookingMode: z.ZodEnum<["instant_book", "request_to_book"]>;
        paymentStatus: z.ZodNullable<z.ZodEnum<["captured", "refunded_full", "refunded_partial", "forfeited", "paid_out"]>>;
        escrowStatus: z.ZodNullable<z.ZodEnum<["held", "released", "refunded_full", "refunded_partial", "forfeited"]>>;
        nonRefundable: z.ZodBoolean;
        lockedCancellationTier: z.ZodNullable<z.ZodEnum<["flexible", "moderate", "limited", "firm", "strict_extended_stay"]>>;
        checkIn: z.ZodString;
        checkOut: z.ZodString;
        guests: z.ZodNumber;
        breakdown: z.ZodObject<{
            nights: z.ZodNumber;
            nightlyRateRwf: z.ZodNumber;
            accommodationRwf: z.ZodNumber;
            nonRefundableDiscountRwf: z.ZodNumber;
            serviceFeeRwf: z.ZodNumber;
            /** Total captured into Escrow at booking time. */
            grossRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            nightlyRateRwf: number;
            nights: number;
            accommodationRwf: number;
            nonRefundableDiscountRwf: number;
            serviceFeeRwf: number;
            grossRwf: number;
        }, {
            nightlyRateRwf: number;
            nights: number;
            accommodationRwf: number;
            nonRefundableDiscountRwf: number;
            serviceFeeRwf: number;
            grossRwf: number;
        }>;
        /** Set for `request_to_book`: when the request auto-declines (F-B03). */
        approvalExpiresAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
        id: string;
        reference: string;
        bookingMode: "instant_book" | "request_to_book";
        checkIn: string;
        checkOut: string;
        guests: number;
        nonRefundable: boolean;
        paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
        escrowStatus: "held" | "refunded_full" | "refunded_partial" | "forfeited" | "released" | null;
        lockedCancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        breakdown: {
            nightlyRateRwf: number;
            nights: number;
            accommodationRwf: number;
            nonRefundableDiscountRwf: number;
            serviceFeeRwf: number;
            grossRwf: number;
        };
        approvalExpiresAt: string | null;
    }, {
        status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
        id: string;
        reference: string;
        bookingMode: "instant_book" | "request_to_book";
        checkIn: string;
        checkOut: string;
        guests: number;
        nonRefundable: boolean;
        paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
        escrowStatus: "held" | "refunded_full" | "refunded_partial" | "forfeited" | "released" | null;
        lockedCancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        breakdown: {
            nightlyRateRwf: number;
            nights: number;
            accommodationRwf: number;
            nonRefundableDiscountRwf: number;
            serviceFeeRwf: number;
            grossRwf: number;
        };
        approvalExpiresAt: string | null;
    }>;
}, "strip", z.ZodTypeAny, {
    status: "confirmed";
    booking: {
        status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
        id: string;
        reference: string;
        bookingMode: "instant_book" | "request_to_book";
        checkIn: string;
        checkOut: string;
        guests: number;
        nonRefundable: boolean;
        paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
        escrowStatus: "held" | "refunded_full" | "refunded_partial" | "forfeited" | "released" | null;
        lockedCancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        breakdown: {
            nightlyRateRwf: number;
            nights: number;
            accommodationRwf: number;
            nonRefundableDiscountRwf: number;
            serviceFeeRwf: number;
            grossRwf: number;
        };
        approvalExpiresAt: string | null;
    };
}, {
    status: "confirmed";
    booking: {
        status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
        id: string;
        reference: string;
        bookingMode: "instant_book" | "request_to_book";
        checkIn: string;
        checkOut: string;
        guests: number;
        nonRefundable: boolean;
        paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
        escrowStatus: "held" | "refunded_full" | "refunded_partial" | "forfeited" | "released" | null;
        lockedCancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
        breakdown: {
            nightlyRateRwf: number;
            nights: number;
            accommodationRwf: number;
            nonRefundableDiscountRwf: number;
            serviceFeeRwf: number;
            grossRwf: number;
        };
        approvalExpiresAt: string | null;
    };
}>, z.ZodObject<{
    status: z.ZodLiteral<"awaiting_payment">;
    attempt: z.ZodObject<{
        attemptToken: z.ZodString;
        state: z.ZodEnum<["prompting", "confirmed", "refused", "expired"]>;
        /** Which rail is being waited on, so the screen can name it. */
        network: z.ZodNullable<z.ZodEnum<["mtn_momo", "airtel_money"]>>;
        /** `078••••456`. Enough to recognise, never enough to charge. */
        payerMasked: z.ZodNullable<z.ZodString>;
        amountRwf: z.ZodNullable<z.ZodNumber>;
        /** When an unanswered prompt stops being worth waiting for. */
        expiresAt: z.ZodString;
        /**
         * The reservation, present exactly when `state` is `confirmed`.
         *
         * A booking is written when the money settles and never before, which is
         * ADR-020 D-b unchanged: a reservation on the strength of a prompt nobody
         * has answered is a receipt for something that does not exist. What changed
         * is that the guest now has somewhere to wait instead of a refusal.
         */
        booking: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            /** Human-facing reference, e.g. `BK-7Q2M4X`. */
            reference: z.ZodString;
            status: z.ZodEnum<["pending_approval", "confirmed", "declined", "cancelled", "no_show"]>;
            bookingMode: z.ZodEnum<["instant_book", "request_to_book"]>;
            paymentStatus: z.ZodNullable<z.ZodEnum<["captured", "refunded_full", "refunded_partial", "forfeited", "paid_out"]>>;
            escrowStatus: z.ZodNullable<z.ZodEnum<["held", "released", "refunded_full", "refunded_partial", "forfeited"]>>;
            nonRefundable: z.ZodBoolean;
            lockedCancellationTier: z.ZodNullable<z.ZodEnum<["flexible", "moderate", "limited", "firm", "strict_extended_stay"]>>;
            checkIn: z.ZodString;
            checkOut: z.ZodString;
            guests: z.ZodNumber;
            breakdown: z.ZodObject<{
                nights: z.ZodNumber;
                nightlyRateRwf: z.ZodNumber;
                accommodationRwf: z.ZodNumber;
                nonRefundableDiscountRwf: z.ZodNumber;
                serviceFeeRwf: z.ZodNumber;
                /** Total captured into Escrow at booking time. */
                grossRwf: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                nightlyRateRwf: number;
                nights: number;
                accommodationRwf: number;
                nonRefundableDiscountRwf: number;
                serviceFeeRwf: number;
                grossRwf: number;
            }, {
                nightlyRateRwf: number;
                nights: number;
                accommodationRwf: number;
                nonRefundableDiscountRwf: number;
                serviceFeeRwf: number;
                grossRwf: number;
            }>;
            /** Set for `request_to_book`: when the request auto-declines (F-B03). */
            approvalExpiresAt: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
            id: string;
            reference: string;
            bookingMode: "instant_book" | "request_to_book";
            checkIn: string;
            checkOut: string;
            guests: number;
            nonRefundable: boolean;
            paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
            escrowStatus: "held" | "refunded_full" | "refunded_partial" | "forfeited" | "released" | null;
            lockedCancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
            breakdown: {
                nightlyRateRwf: number;
                nights: number;
                accommodationRwf: number;
                nonRefundableDiscountRwf: number;
                serviceFeeRwf: number;
                grossRwf: number;
            };
            approvalExpiresAt: string | null;
        }, {
            status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
            id: string;
            reference: string;
            bookingMode: "instant_book" | "request_to_book";
            checkIn: string;
            checkOut: string;
            guests: number;
            nonRefundable: boolean;
            paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
            escrowStatus: "held" | "refunded_full" | "refunded_partial" | "forfeited" | "released" | null;
            lockedCancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
            breakdown: {
                nightlyRateRwf: number;
                nights: number;
                accommodationRwf: number;
                nonRefundableDiscountRwf: number;
                serviceFeeRwf: number;
                grossRwf: number;
            };
            approvalExpiresAt: string | null;
        }>>;
        /** Why it ended badly, in words meant for the guest. */
        failureReason: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        booking: {
            status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
            id: string;
            reference: string;
            bookingMode: "instant_book" | "request_to_book";
            checkIn: string;
            checkOut: string;
            guests: number;
            nonRefundable: boolean;
            paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
            escrowStatus: "held" | "refunded_full" | "refunded_partial" | "forfeited" | "released" | null;
            lockedCancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
            breakdown: {
                nightlyRateRwf: number;
                nights: number;
                accommodationRwf: number;
                nonRefundableDiscountRwf: number;
                serviceFeeRwf: number;
                grossRwf: number;
            };
            approvalExpiresAt: string | null;
        } | null;
        amountRwf: number | null;
        failureReason: string | null;
        state: "expired" | "confirmed" | "prompting" | "refused";
        network: "mtn_momo" | "airtel_money" | null;
        attemptToken: string;
        payerMasked: string | null;
        expiresAt: string;
    }, {
        booking: {
            status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
            id: string;
            reference: string;
            bookingMode: "instant_book" | "request_to_book";
            checkIn: string;
            checkOut: string;
            guests: number;
            nonRefundable: boolean;
            paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
            escrowStatus: "held" | "refunded_full" | "refunded_partial" | "forfeited" | "released" | null;
            lockedCancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
            breakdown: {
                nightlyRateRwf: number;
                nights: number;
                accommodationRwf: number;
                nonRefundableDiscountRwf: number;
                serviceFeeRwf: number;
                grossRwf: number;
            };
            approvalExpiresAt: string | null;
        } | null;
        amountRwf: number | null;
        failureReason: string | null;
        state: "expired" | "confirmed" | "prompting" | "refused";
        network: "mtn_momo" | "airtel_money" | null;
        attemptToken: string;
        payerMasked: string | null;
        expiresAt: string;
    }>;
}, "strip", z.ZodTypeAny, {
    status: "awaiting_payment";
    attempt: {
        booking: {
            status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
            id: string;
            reference: string;
            bookingMode: "instant_book" | "request_to_book";
            checkIn: string;
            checkOut: string;
            guests: number;
            nonRefundable: boolean;
            paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
            escrowStatus: "held" | "refunded_full" | "refunded_partial" | "forfeited" | "released" | null;
            lockedCancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
            breakdown: {
                nightlyRateRwf: number;
                nights: number;
                accommodationRwf: number;
                nonRefundableDiscountRwf: number;
                serviceFeeRwf: number;
                grossRwf: number;
            };
            approvalExpiresAt: string | null;
        } | null;
        amountRwf: number | null;
        failureReason: string | null;
        state: "expired" | "confirmed" | "prompting" | "refused";
        network: "mtn_momo" | "airtel_money" | null;
        attemptToken: string;
        payerMasked: string | null;
        expiresAt: string;
    };
}, {
    status: "awaiting_payment";
    attempt: {
        booking: {
            status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
            id: string;
            reference: string;
            bookingMode: "instant_book" | "request_to_book";
            checkIn: string;
            checkOut: string;
            guests: number;
            nonRefundable: boolean;
            paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
            escrowStatus: "held" | "refunded_full" | "refunded_partial" | "forfeited" | "released" | null;
            lockedCancellationTier: "flexible" | "moderate" | "limited" | "firm" | "strict_extended_stay" | null;
            breakdown: {
                nightlyRateRwf: number;
                nights: number;
                accommodationRwf: number;
                nonRefundableDiscountRwf: number;
                serviceFeeRwf: number;
                grossRwf: number;
            };
            approvalExpiresAt: string | null;
        } | null;
        amountRwf: number | null;
        failureReason: string | null;
        state: "expired" | "confirmed" | "prompting" | "refused";
        network: "mtn_momo" | "airtel_money" | null;
        attemptToken: string;
        payerMasked: string | null;
        expiresAt: string;
    };
}>]>;
export type CreateBookingOutcome = z.infer<typeof CreateBookingOutcome>;
/**
 * How long an unanswered prompt is worth waiting for.
 *
 * Both rails abandon one within a few minutes, and a guest watching a spinner
 * needs an end. Shared, so the countdown on the screen and the sweep that voids
 * the capture cannot disagree about when it is over.
 */
export declare const PAYMENT_PROMPT_TTL_SECONDS = 180;
/**
 * Outcome of a host approve/decline on a `request_to_book`.
 *
 * `confirmed` retains the hold and keeps escrow `held`; `declined` (reason
 * `host_declined`) refunds 100% and releases the hold. The transition is
 * guarded on `pending_approval`, so acting on an already-resolved request —
 * e.g. one the auto-decline job already expired — is a conflict, not a silent
 * no-op (FL08 Path C).
 */
export declare const BookingApprovalResult: z.ZodObject<{
    id: z.ZodString;
    reference: z.ZodString;
    status: z.ZodEnum<["pending_approval", "confirmed", "declined", "cancelled", "no_show"]>;
    declineReason: z.ZodNullable<z.ZodEnum<["host_declined", "expired"]>>;
    paymentStatus: z.ZodNullable<z.ZodEnum<["captured", "refunded_full", "refunded_partial", "forfeited", "paid_out"]>>;
    escrowStatus: z.ZodNullable<z.ZodEnum<["held", "released", "refunded_full", "refunded_partial", "forfeited"]>>;
    confirmedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
    id: string;
    reference: string;
    paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
    escrowStatus: "held" | "refunded_full" | "refunded_partial" | "forfeited" | "released" | null;
    declineReason: "expired" | "host_declined" | null;
    confirmedAt: string | null;
}, {
    status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
    id: string;
    reference: string;
    paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
    escrowStatus: "held" | "refunded_full" | "refunded_partial" | "forfeited" | "released" | null;
    declineReason: "expired" | "host_declined" | null;
    confirmedAt: string | null;
}>;
export type BookingApprovalResult = z.infer<typeof BookingApprovalResult>;
/**
 * What each tier refunds a GUEST who cancels a confirmed booking, by how long
 * before check-in they cancel.
 *
 * The only statement of these numbers before ADR-051 was the checkout copy in
 * `apps/web/src/lib/booking.ts`, which guests had already been shown when they
 * paid, so that copy IS the policy and this table is it in figures:
 *
 * - flexible: 100% up to 24 hours before check-in; nothing after.
 * - moderate: 100% up to 5 days before; 50% after.
 * - limited: 50% up to 7 days before; nothing after.
 * - firm: 50% up to 30 days before; nothing after.
 * - strict_extended_stay: 50% up to 30 days before; nothing after.
 *
 * `windowHours` is the cut-off; `before` applies at or beyond it, `after` inside
 * it. The guest service fee is refunded in the same proportion as the stay.
 */
export declare const CANCELLATION_TIERS: Record<CancellationTier, {
    windowHours: number;
    beforePercent: number;
    afterPercent: number;
}>;
/** Who cancelled. A host cancellation always refunds in full (F-B11). */
export declare const CancellationParty: z.ZodEnum<["guest", "host"]>;
export type CancellationParty = z.infer<typeof CancellationParty>;
export interface CancellationRefund {
    /** 0 to 100. */
    percent: number;
    refundRwf: number;
    /** What the guest does not get back. Stays in escrow for the host. */
    forfeitRwf: number;
    /** The rule that decided it, in a sentence meant for the guest. */
    rule: string;
}
/**
 * THE REFUND FOR ONE CANCELLATION, and the only place it is computed.
 *
 * In order, the first that applies wins:
 * 1. The host cancels: 100%, always.
 * 2. The request was never accepted (`pending_approval`): 100%, no contract.
 * 3. The guest chose the non-refundable rate: 0%, whatever the tier.
 * 4. The tier, by hours before check-in. A booking that locked no tier is read
 *    as `flexible`, the most generous one, rather than refused.
 *
 * Rounded DOWN to the franc on the refund, so a partial refund can never pay
 * out more than was captured and the forfeit is the exact remainder.
 */
export declare function cancellationRefund(input: {
    party: CancellationParty;
    status: BookingStatus;
    tier: CancellationTier | null;
    nonRefundable: boolean;
    grossRwf: number;
    hoursBeforeCheckIn: number;
}): CancellationRefund;
/** What `GET /api/v1/bookings/:reference/cancellation` answers: the refund, before committing. */
export declare const CancellationQuote: z.ZodObject<{
    reference: z.ZodString;
    cancellable: z.ZodBoolean;
    /** Why it cannot be cancelled, when it cannot. */
    refusal: z.ZodNullable<z.ZodString>;
    percent: z.ZodNumber;
    refundRwf: z.ZodNumber;
    forfeitRwf: z.ZodNumber;
    rule: z.ZodString;
}, "strip", z.ZodTypeAny, {
    percent: number;
    reference: string;
    cancellable: boolean;
    refusal: string | null;
    refundRwf: number;
    forfeitRwf: number;
    rule: string;
}, {
    percent: number;
    reference: string;
    cancellable: boolean;
    refusal: string | null;
    refundRwf: number;
    forfeitRwf: number;
    rule: string;
}>;
export type CancellationQuote = z.infer<typeof CancellationQuote>;
/** What a cancellation answers once it is done. */
export declare const BookingCancellationResult: z.ZodObject<{
    id: z.ZodString;
    reference: z.ZodString;
    status: z.ZodEnum<["pending_approval", "confirmed", "declined", "cancelled", "no_show"]>;
    cancelledBy: z.ZodEnum<["guest", "host"]>;
    paymentStatus: z.ZodNullable<z.ZodEnum<["captured", "refunded_full", "refunded_partial", "forfeited", "paid_out"]>>;
    escrowStatus: z.ZodNullable<z.ZodEnum<["held", "released", "refunded_full", "refunded_partial", "forfeited"]>>;
    refundRwf: z.ZodNumber;
    forfeitRwf: z.ZodNumber;
    rule: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
    id: string;
    reference: string;
    paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
    escrowStatus: "held" | "refunded_full" | "refunded_partial" | "forfeited" | "released" | null;
    refundRwf: number;
    forfeitRwf: number;
    rule: string;
    cancelledBy: "guest" | "host";
}, {
    status: "pending_approval" | "confirmed" | "declined" | "cancelled" | "no_show";
    id: string;
    reference: string;
    paymentStatus: "captured" | "refunded_full" | "refunded_partial" | "forfeited" | "paid_out" | null;
    escrowStatus: "held" | "refunded_full" | "refunded_partial" | "forfeited" | "released" | null;
    refundRwf: number;
    forfeitRwf: number;
    rule: string;
    cancelledBy: "guest" | "host";
}>;
export type BookingCancellationResult = z.infer<typeof BookingCancellationResult>;
//# sourceMappingURL=booking.d.ts.map