"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminWaitlistInviteResult = exports.AdminWaitlistPage = exports.AdminWaitlistRow = exports.AdminWaitlistExportQuery = exports.AdminWaitlistQuery = exports.WaitlistUnsubscribeResult = exports.WaitlistSignupResult = exports.WaitlistSignupInput = exports.WAITLIST_SIZE_BAND_LABEL = exports.WAITLIST_PROPERTY_TYPE_LABEL = exports.WaitlistSizeBand = exports.WaitlistPropertyType = exports.WaitlistAudience = exports.WAITLIST_BUSINESS_NAME_MAX = exports.WAITLIST_PHONE_MAX = exports.WAITLIST_NAME_MAX = exports.WAITLIST_EMAIL_MAX = void 0;
const zod_1 = require("zod");
const phone_1 = require("./phone");
const primitives_1 = require("./primitives");
/**
 * Waitlist wire contract (ADR-048) — `POST /api/v1/waitlist/signups`.
 *
 * This is a PUBLIC write on an unlaunched domain, so it carries the same three
 * rules the support intake carries and for the same reasons: every string is
 * capped, every choice is a closed set, and unknown keys are refused. An
 * uncapped field on an anonymous write is a storage bill a stranger can run up.
 *
 * THE SHAPE IS A DISCRIMINATED UNION ON `audience`, not one object with seven
 * optional fields. An owner row is complete or it does not exist (the database
 * says so too, in `waitlist_owner_complete`), and a union is what makes that a
 * type level fact instead of a runtime hope: a handler holding an `owner` input
 * cannot read `businessName` as `string | undefined`.
 *
 * THE PROPERTY TYPES ARE DELIBERATELY NAMED `WaitlistPropertyType`, never
 * `PropertyType`. The listing module will define the product's real taxonomy;
 * naming this one after the surface it serves is what stops a pre launch
 * dropdown from quietly becoming the data model (ADR-048, Consequences).
 */
/** RFC 5321's limit on a forward path; no deliverable address is longer. */
exports.WAITLIST_EMAIL_MAX = 254;
/** Room for a full name in any script, not for a paragraph posing as one. */
exports.WAITLIST_NAME_MAX = 120;
/** E.164 is 15 digits; the rest is room for spaces, brackets and a `+`. */
exports.WAITLIST_PHONE_MAX = 32;
/** A trading name, not a description of the business. */
exports.WAITLIST_BUSINESS_NAME_MAX = 160;
exports.WaitlistAudience = zod_1.z.enum(["traveller", "owner"]);
exports.WaitlistPropertyType = zod_1.z.enum([
    "hotel",
    "guest_house",
    "apartment",
    "lodge",
    "villa",
    "hostel",
    "homestay",
    "campsite",
]);
exports.WaitlistSizeBand = zod_1.z.enum(["1_5", "6_20", "21_50", "50_plus"]);
/** The labels the form renders, from ADR-048 copy.md §3. One list, both ends. */
exports.WAITLIST_PROPERTY_TYPE_LABEL = {
    hotel: "Hotel",
    guest_house: "Guest house",
    apartment: "Apartment",
    lodge: "Lodge",
    villa: "Villa",
    hostel: "Hostel",
    homestay: "Homestay",
    campsite: "Campsite",
};
exports.WAITLIST_SIZE_BAND_LABEL = {
    "1_5": "1 to 5",
    "6_20": "6 to 20",
    "21_50": "21 to 50",
    "50_plus": "More than 50",
};
/** An email address, lower-cased so one mailbox is one row and one throttle bucket. */
const WaitlistEmail = zod_1.z
    .string()
    .trim()
    .toLowerCase()
    .max(exports.WAITLIST_EMAIL_MAX)
    .email("Enter an email address we can reach you on.");
const WaitlistFullName = zod_1.z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(exports.WAITLIST_NAME_MAX);
/**
 * A traveller's phone, optional and deliberately unconstrained in format.
 *
 * A traveller may be abroad, and refusing a number because it is not Rwandan
 * loses a signup over a field that was optional anyway. Digits and the
 * punctuation people type around them, nothing that lets prose through.
 */
const LoosePhone = zod_1.z
    .string()
    .trim()
    .min(1)
    .max(exports.WAITLIST_PHONE_MAX)
    .regex(/^[+0-9 ()-]+$/, "expected a phone number");
const WaitlistTravellerSignup = zod_1.z
    .object({
    audience: zod_1.z.literal("traveller"),
    email: WaitlistEmail,
    fullName: WaitlistFullName,
    phone: LoosePhone.optional(),
    marketingOptIn: zod_1.z.boolean().optional().default(false),
})
    .strict();
const WaitlistOwnerSignup = zod_1.z
    .object({
    audience: zod_1.z.literal("owner"),
    email: WaitlistEmail,
    fullName: WaitlistFullName,
    // Required here and Rwandan, unlike the traveller branch: this is supply,
    // and somebody is going to ring this number to onboard the property.
    // `RwPhoneNumber` normalises to `+250...` on the way in, so the column and
    // the database check constraint only ever see the one stored spelling.
    phone: phone_1.RwPhoneNumber,
    businessName: zod_1.z
        .string()
        .trim()
        .min(1, "This one is needed so we can get in touch properly.")
        .max(exports.WAITLIST_BUSINESS_NAME_MAX),
    // `districts.id` is an integer smart-code, not a uuid. Geography is the one
    // documented exception to this schema's uuid primary keys.
    districtId: zod_1.z.number().int().positive(),
    propertyType: exports.WaitlistPropertyType,
    sizeBand: exports.WaitlistSizeBand,
    marketingOptIn: zod_1.z.boolean().optional().default(false),
})
    .strict();
exports.WaitlistSignupInput = zod_1.z.discriminatedUnion("audience", [
    WaitlistTravellerSignup,
    WaitlistOwnerSignup,
]);
/**
 * What a submission returns: the row id, and whether the address was already
 * stored. Nothing the caller sent is echoed back (AC-9).
 */
exports.WaitlistSignupResult = zod_1.z.object({
    id: primitives_1.Uuid,
    alreadyJoined: zod_1.z.boolean(),
});
/**
 * Unsubscribing answers the same way for a known token, an unknown one and one
 * already spent (AC-12). There is no failure shape, on purpose: a 404 here
 * would tell a stranger whether an address is on the list.
 */
exports.WaitlistUnsubscribeResult = zod_1.z.object({ ok: zod_1.z.literal(true) });
// ===========================================================================
// The staff view (AC-17). Everything below sits behind `StaffGuard`.
// ===========================================================================
/** Offset pagination, capped so one call cannot pull the whole list. */
exports.AdminWaitlistQuery = zod_1.z.object({
    audience: exports.WaitlistAudience.optional(),
    districtId: zod_1.z.coerce.number().int().positive().optional(),
    limit: zod_1.z.coerce.number().int().positive().max(100).optional().default(50),
    offset: zod_1.z.coerce.number().int().nonnegative().optional().default(0),
});
/** The filter alone. The export streams every matching row, so it takes no page. */
exports.AdminWaitlistExportQuery = zod_1.z.object({
    audience: exports.WaitlistAudience.optional(),
    districtId: zod_1.z.coerce.number().int().positive().optional(),
});
exports.AdminWaitlistRow = zod_1.z.object({
    id: primitives_1.Uuid,
    audience: exports.WaitlistAudience,
    email: zod_1.z.string(),
    fullName: zod_1.z.string(),
    phone: zod_1.z.string().nullable(),
    businessName: zod_1.z.string().nullable(),
    districtId: zod_1.z.number().int().nullable(),
    districtName: zod_1.z.string().nullable(),
    propertyType: exports.WaitlistPropertyType.nullable(),
    sizeBand: exports.WaitlistSizeBand.nullable(),
    marketingOptIn: zod_1.z.boolean(),
    invitedAt: zod_1.z.string().nullable(),
    unsubscribedAt: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
exports.AdminWaitlistPage = zod_1.z.object({
    total: zod_1.z.number().int().nonnegative(),
    rows: zod_1.z.array(exports.AdminWaitlistRow),
});
/**
 * Marking somebody invited is idempotent: the value records when they were
 * FIRST invited, so a second click returns the timestamp already there rather
 * than rewriting history or answering 409 (ADR-048, API surface).
 */
exports.AdminWaitlistInviteResult = zod_1.z.object({
    invitedAt: zod_1.z.string(),
});
//# sourceMappingURL=waitlist.js.map