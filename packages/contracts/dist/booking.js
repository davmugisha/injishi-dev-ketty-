"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingApprovalResult = exports.PAYMENT_PROMPT_TTL_SECONDS = exports.CreateBookingOutcome = exports.PaymentAttemptStatus = exports.PaymentAttemptState = exports.BookingResult = exports.GUEST_SERVICE_FEE_RATE = exports.NON_REFUNDABLE_DISCOUNT = exports.MoneyBreakdown = exports.CreateBookingInput = exports.PaymentInstrument = exports.NationalMsisdn = exports.NETWORK_PREFIXES = exports.MobileMoneyNetwork = exports.RoomAvailability = exports.NightAvailability = exports.PROPERTY_TIME_ZONE = exports.DEFAULT_CAPACITY = exports.MAX_HORIZON_DAYS = exports.MAX_NIGHTS = exports.BookableRoom = exports.BookablePropertySummary = exports.PropertyDetail = exports.SitemapProperty = exports.RoomTypeSummary = exports.IsoDate = exports.EscrowStatus = exports.DeclineReason = exports.PaymentStatus = exports.BookingStatus = exports.CancellationTier = exports.ApprovalPolicy = exports.BookingMode = void 0;
exports.soldOutNights = soldOutNights;
exports.networkForMsisdn = networkForMsisdn;
exports.instrumentProblem = instrumentProblem;
exports.computeBreakdown = computeBreakdown;
const zod_1 = require("zod");
const primitives_1 = require("./primitives");
/**
 * Hospitality inventory + booking wire contracts (F-B03, F-B05, F-B15, FL07).
 *
 * Enum members mirror the Postgres enums in
 * server/api/src/database/drizzle/schema.ts EXACTLY — do not fork.
 */
/** Per-Room-type booking mode (F-B03). */
exports.BookingMode = zod_1.z.enum(["instant_book", "request_to_book"]);
/** Sub-field of `request_to_book` only — never a mode of its own (F-B03). */
exports.ApprovalPolicy = zod_1.z.enum(["approve_all", "approve_first_three"]);
exports.CancellationTier = zod_1.z.enum([
    "flexible",
    "moderate",
    "limited",
    "firm",
    "strict_extended_stay",
]);
exports.BookingStatus = zod_1.z.enum([
    "pending_approval",
    "confirmed",
    "declined",
    "cancelled",
    "no_show",
]);
exports.PaymentStatus = zod_1.z.enum([
    "captured",
    "refunded_full",
    "refunded_partial",
    "forfeited",
    "paid_out",
]);
/** Why a `request_to_book` was declined (mirrors the Postgres `decline_reason` enum). */
exports.DeclineReason = zod_1.z.enum(["host_declined", "expired"]);
exports.EscrowStatus = zod_1.z.enum([
    "held",
    "released",
    "refunded_full",
    "refunded_partial",
    "forfeited",
]);
/** ISO calendar day, `yyyy-mm-dd` (booking dates are days, not instants). */
exports.IsoDate = zod_1.z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expected yyyy-mm-dd");
// --- Read: property detail (F-B15) -----------------------------------------
exports.RoomTypeSummary = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1),
    domain: primitives_1.Domain,
    capacity: zod_1.z.number().int().positive().nullable(),
    /** Bookable units of this Room type (the atomic-hold denominator). */
    roomCount: zod_1.z.number().int().nonnegative(),
    nightlyRateRwf: primitives_1.RwfAmount.nullable(),
    bookingMode: exports.BookingMode.nullable(),
    approvalPolicy: exports.ApprovalPolicy.nullable(),
    cancellationTier: exports.CancellationTier.nullable(),
    nonrefundableEligible: zod_1.z.boolean(),
    /**
     * The shortest stay this room accepts (ARI, F-L08).
     *
     * The column has always existed and no client read it, so a room with a
     * three-night minimum was offered for one night and refused later. Nullable
     * on the wire because a host may not have set one; a consumer reads an
     * absent minimum as 1 rather than inventing a longer one.
     */
    minStay: zod_1.z.number().int().positive().nullable(),
});
/**
 * One entry in the marketplace sitemap: `GET /api/v1/properties/sitemap`
 * (ADR-049, AC-I9).
 *
 * Read through the same visibility rule as a property page, so an unpublished or
 * suspended property is in neither. `publishedAt` is the most recent publish, a
 * crawler's `lastmod` hint and nothing more.
 */
exports.SitemapProperty = zod_1.z.object({
    slug: zod_1.z.string().min(1),
    publishedAt: zod_1.z.string().nullable(),
});
exports.PropertyDetail = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    /**
     * The property's public address on the marketplace, or null.
     *
     * Null while a property is in the registration pipeline: it has no public
     * page yet, and minting an address for one would publish a business nobody
     * has approved. A consumer that needs to link to the property must handle
     * the null rather than assume one exists.
     */
    slug: zod_1.z.string().min(1).nullable(),
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().nullable(),
    districtName: zod_1.z.string().nullable(),
    latitude: zod_1.z.number().nullable(),
    longitude: zod_1.z.number().nullable(),
    locationPrivacy: zod_1.z.boolean(),
    checkInTime: zod_1.z.string().nullable(),
    checkOutTime: zod_1.z.string().nullable(),
    houseRules: zod_1.z.string().nullable(),
    /**
     * One absolute URL per photograph, in the operator's order, the cover first.
     *
     * Each is the API's photo route (`/api/v1/properties/photos/:photoId`), which
     * answers 302 to a fresh signed URL while the property is public and 404 once
     * it is not (ADR-049, owner ruling of 2026-09-13). Never an object key, and
     * never a signed URL itself, so a cached page cannot hold one that expires.
     */
    photos: zod_1.z.array(zod_1.z.string().url()),
    roomTypes: zod_1.z.array(exports.RoomTypeSummary),
});
// --- Read: one bookable room, with just enough of its property -------------
/**
 * The property, as the CHECKOUT needs to name it. Not a second PropertyDetail.
 *
 * A checkout has to say which property it is selling and link back to it. It
 * does not need the description, the house rules, the coordinates or the other
 * room types, and `PropertyDetail` carries all of them plus every room type on
 * the property — so serving checkout from that endpoint meant fetching a
 * document to read six fields out of it.
 */
exports.BookablePropertySummary = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    slug: zod_1.z.string().min(1).nullable(),
    name: zod_1.z.string().min(1),
    districtName: zod_1.z.string().nullable(),
    checkInTime: zod_1.z.string().nullable(),
    checkOutTime: zod_1.z.string().nullable(),
    /**
     * The cover's photo route URL, or null — the checkout shows one thumbnail,
     * never a gallery. The same kind of URL `PropertyDetail.photos` carries.
     */
    photo: zod_1.z.string().url().nullable(),
});
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
exports.BookableRoom = zod_1.z.object({
    property: exports.BookablePropertySummary,
    roomType: exports.RoomTypeSummary,
});
// --- Read: what is left to sell (ADR-047 wave E) ---------------------------
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
exports.MAX_NIGHTS = 90;
/** How far ahead a booking may be made. 18 months. */
exports.MAX_HORIZON_DAYS = 540;
/** A room type with no stated capacity is not unlimited. */
exports.DEFAULT_CAPACITY = 4;
/** Every stay in this catalogue is in Rwanda, so "today" is a Kigali fact. */
exports.PROPERTY_TIME_ZONE = "Africa/Kigali";
/** How many units of one room type are free on one night. */
exports.NightAvailability = zod_1.z.object({
    night: exports.IsoDate,
    /** 0 means sold out. Never negative, whatever the bookings say. */
    freeUnits: zod_1.z.number().int().nonnegative(),
});
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
exports.RoomAvailability = zod_1.z.object({
    roomTypeId: zod_1.z.string().uuid(),
    /** Units that exist, the denominator every `freeUnits` is measured against. */
    roomCount: zod_1.z.number().int().nonnegative(),
    /** Shortest stay this room accepts (ARI). 1 when the host set none. */
    minStay: zod_1.z.number().int().positive(),
    /** One entry per night in the requested window, in order. */
    nights: zod_1.z.array(exports.NightAvailability),
});
/**
 * Nights a guest must not be offered, as a set of `yyyy-mm-dd`.
 *
 * Derived rather than served: the API answers with counts, because "sold out"
 * is a question about how many units are left and a client may want to say
 * "only one left" as well as "unavailable". One implementation of the
 * threshold, so a calendar and a summary cannot disagree about what full means.
 */
function soldOutNights(availability) {
    return availability.nights
        .filter((night) => night.freeUnits <= 0)
        .map((night) => night.night);
}
// --- The payment instrument (ADR-047) --------------------------------------
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
exports.MobileMoneyNetwork = zod_1.z.enum(["mtn_momo", "airtel_money"]);
/** The MSISDN prefixes each network issues, after the +250 country code. */
exports.NETWORK_PREFIXES = {
    mtn_momo: ["78", "79"],
    airtel_money: ["72", "73"],
};
/** Rwandan MSISDN, reduced to its nine national digits. */
exports.NationalMsisdn = zod_1.z
    .string()
    .regex(/^\d{9}$/, "expected nine national digits");
/**
 * Which network a number belongs to, or null when no rail claims the prefix.
 * One implementation, so a form and the server cannot disagree about it.
 */
function networkForMsisdn(national) {
    const prefix = national.slice(0, 2);
    for (const [network, prefixes] of Object.entries(exports.NETWORK_PREFIXES)) {
        if (prefixes.includes(prefix))
            return network;
    }
    return null;
}
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
exports.PaymentInstrument = zod_1.z.discriminatedUnion("kind", [
    zod_1.z.object({
        kind: zod_1.z.literal("mobile_money"),
        network: exports.MobileMoneyNetwork,
        /** Nine national digits. Normalised by the client; re-checked here. */
        msisdn: exports.NationalMsisdn,
    }),
    zod_1.z.object({
        kind: zod_1.z.literal("card"),
        /** A provider token from a hosted field. NEVER a card number. */
        token: zod_1.z.string().min(1),
    }),
]);
/**
 * Is this number on the network it was filed under?
 *
 * The commonest mis-entry on a two-network market is an Airtel number typed
 * into the MTN row, which a provider refuses with a message about the account
 * rather than the number. Both the form and the API check it with this.
 */
function instrumentProblem(instrument) {
    if (instrument.kind === "card")
        return null;
    const actual = networkForMsisdn(instrument.msisdn);
    if (actual === null) {
        return `No Rwandan network issues numbers starting ${instrument.msisdn.slice(0, 2)}.`;
    }
    if (actual !== instrument.network) {
        return "That number is on the other network. Pick the matching rail.";
    }
    return null;
}
// --- Write: create a booking (F-B05 / FL07) --------------------------------
/**
 * The guest's booking intent. Price is NOT accepted from the client — the
 * server re-derives the MoneyBreakdown from the Room type's locked rate, so a
 * tampered total cannot under-charge.
 */
exports.CreateBookingInput = zod_1.z.object({
    roomTypeId: zod_1.z.string().uuid(),
    checkIn: exports.IsoDate,
    checkOut: exports.IsoDate,
    guests: zod_1.z.number().int().positive().max(50),
    nonRefundable: zod_1.z.boolean().default(false),
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
    attemptToken: zod_1.z.string().uuid().optional(),
    /**
     * How to take the money (ADR-047).
     *
     * REQUIRED, unlike `attemptToken`, and the difference is deliberate. An
     * absent attempt token degrades to a unique key and the request still
     * means something; an absent instrument means "charge somebody, somehow",
     * which is not a booking anyone can honour. `apps/web` is the only client
     * that creates bookings today, so requiring it costs no migration window.
     */
    instrument: exports.PaymentInstrument,
});
/** Server-computed price breakdown, echoed back so the UI can show what was charged. */
exports.MoneyBreakdown = zod_1.z.object({
    nights: zod_1.z.number().int().positive(),
    nightlyRateRwf: primitives_1.RwfAmount,
    accommodationRwf: primitives_1.RwfAmount,
    nonRefundableDiscountRwf: primitives_1.RwfAmount,
    serviceFeeRwf: primitives_1.RwfAmount,
    /** Total captured into Escrow at booking time. */
    grossRwf: primitives_1.RwfAmount,
});
/**
 * Non-refundable rate is ~10% cheaper than the standard one (F-B05 Path A).
 */
exports.NON_REFUNDABLE_DISCOUNT = 0.1;
/** Guest service fee. Rates are quoted excluding it. */
exports.GUEST_SERVICE_FEE_RATE = 0.05;
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
function computeBreakdown(args) {
    const { nightlyRateRwf, nights, nonRefundable } = args;
    const accommodationRwf = nightlyRateRwf * nights;
    const nonRefundableDiscountRwf = nonRefundable
        ? Math.round(accommodationRwf * exports.NON_REFUNDABLE_DISCOUNT)
        : 0;
    const discounted = accommodationRwf - nonRefundableDiscountRwf;
    const serviceFeeRwf = Math.round(discounted * exports.GUEST_SERVICE_FEE_RATE);
    return {
        nights,
        nightlyRateRwf,
        accommodationRwf,
        nonRefundableDiscountRwf,
        serviceFeeRwf,
        grossRwf: discounted + serviceFeeRwf,
    };
}
exports.BookingResult = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    /** Human-facing reference, e.g. `BK-7Q2M4X`. */
    reference: zod_1.z.string().min(1),
    status: exports.BookingStatus,
    bookingMode: exports.BookingMode,
    paymentStatus: exports.PaymentStatus.nullable(),
    escrowStatus: exports.EscrowStatus.nullable(),
    nonRefundable: zod_1.z.boolean(),
    lockedCancellationTier: exports.CancellationTier.nullable(),
    checkIn: exports.IsoDate,
    checkOut: exports.IsoDate,
    guests: zod_1.z.number().int().positive(),
    breakdown: exports.MoneyBreakdown,
    /** Set for `request_to_book`: when the request auto-declines (F-B03). */
    approvalExpiresAt: zod_1.z.string().nullable(),
});
// --- The async rail: a payment waiting on a handset (ADR-047 D-j) ----------
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
exports.PaymentAttemptState = zod_1.z.enum([
    /** Accepted by the provider, waiting on a person and their handset. */
    "prompting",
    /** Settled, and the booking behind it exists. */
    "confirmed",
    /** The provider or the customer said no. Nothing was taken. */
    "refused",
    /** Nobody answered in time. Voided or refunded; nothing was kept. */
    "expired",
]);
/** What a poll of `GET /api/v1/bookings/attempts/:token` answers. */
exports.PaymentAttemptStatus = zod_1.z.object({
    attemptToken: zod_1.z.string(),
    state: exports.PaymentAttemptState,
    /** Which rail is being waited on, so the screen can name it. */
    network: exports.MobileMoneyNetwork.nullable(),
    /** `078••••456`. Enough to recognise, never enough to charge. */
    payerMasked: zod_1.z.string().nullable(),
    amountRwf: primitives_1.RwfAmount.nullable(),
    /** When an unanswered prompt stops being worth waiting for. */
    expiresAt: zod_1.z.string(),
    /**
     * The reservation, present exactly when `state` is `confirmed`.
     *
     * A booking is written when the money settles and never before, which is
     * ADR-020 D-b unchanged: a reservation on the strength of a prompt nobody
     * has answered is a receipt for something that does not exist. What changed
     * is that the guest now has somewhere to wait instead of a refusal.
     */
    booking: exports.BookingResult.nullable(),
    /** Why it ended badly, in words meant for the guest. */
    failureReason: zod_1.z.string().nullable(),
});
/**
 * What `POST /api/v1/bookings` answers.
 *
 * A discriminated union rather than one shape, because the two outcomes are
 * genuinely different events and collapsing them is what produced the 402 dead
 * end. A card settles inside the request and there is a booking; a mobile money
 * prompt does not, and what comes back is something to WAIT on.
 */
exports.CreateBookingOutcome = zod_1.z.discriminatedUnion("status", [
    zod_1.z.object({ status: zod_1.z.literal("confirmed"), booking: exports.BookingResult }),
    zod_1.z.object({
        status: zod_1.z.literal("awaiting_payment"),
        attempt: exports.PaymentAttemptStatus,
    }),
]);
/**
 * How long an unanswered prompt is worth waiting for.
 *
 * Both rails abandon one within a few minutes, and a guest watching a spinner
 * needs an end. Shared, so the countdown on the screen and the sweep that voids
 * the capture cannot disagree about when it is over.
 */
exports.PAYMENT_PROMPT_TTL_SECONDS = 180;
// --- Write: host approve / decline a request_to_book (F-B06 / FL08) ---------
/**
 * Outcome of a host approve/decline on a `request_to_book`.
 *
 * `confirmed` retains the hold and keeps escrow `held`; `declined` (reason
 * `host_declined`) refunds 100% and releases the hold. The transition is
 * guarded on `pending_approval`, so acting on an already-resolved request —
 * e.g. one the auto-decline job already expired — is a conflict, not a silent
 * no-op (FL08 Path C).
 */
exports.BookingApprovalResult = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    reference: zod_1.z.string().min(1),
    status: exports.BookingStatus,
    declineReason: exports.DeclineReason.nullable(),
    paymentStatus: exports.PaymentStatus.nullable(),
    escrowStatus: exports.EscrowStatus.nullable(),
    confirmedAt: zod_1.z.string().nullable(),
});
//# sourceMappingURL=booking.js.map