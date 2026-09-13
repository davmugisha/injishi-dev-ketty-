import { z } from "zod";
import { RwPhoneNumber } from "./phone";
import { Uuid } from "./primitives";

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
export const WAITLIST_EMAIL_MAX = 254;
/** Room for a full name in any script, not for a paragraph posing as one. */
export const WAITLIST_NAME_MAX = 120;
/** E.164 is 15 digits; the rest is room for spaces, brackets and a `+`. */
export const WAITLIST_PHONE_MAX = 32;
/** A trading name, not a description of the business. */
export const WAITLIST_BUSINESS_NAME_MAX = 160;

export const WaitlistAudience = z.enum(["traveller", "owner"]);
export type WaitlistAudience = z.infer<typeof WaitlistAudience>;

export const WaitlistPropertyType = z.enum([
  "hotel",
  "guest_house",
  "apartment",
  "lodge",
  "villa",
  "hostel",
  "homestay",
  "campsite",
]);
export type WaitlistPropertyType = z.infer<typeof WaitlistPropertyType>;

export const WaitlistSizeBand = z.enum(["1_5", "6_20", "21_50", "50_plus"]);
export type WaitlistSizeBand = z.infer<typeof WaitlistSizeBand>;

/** The labels the form renders, from ADR-048 copy.md §3. One list, both ends. */
export const WAITLIST_PROPERTY_TYPE_LABEL: Readonly<
  Record<WaitlistPropertyType, string>
> = {
  hotel: "Hotel",
  guest_house: "Guest house",
  apartment: "Apartment",
  lodge: "Lodge",
  villa: "Villa",
  hostel: "Hostel",
  homestay: "Homestay",
  campsite: "Campsite",
};

export const WAITLIST_SIZE_BAND_LABEL: Readonly<
  Record<WaitlistSizeBand, string>
> = {
  "1_5": "1 to 5",
  "6_20": "6 to 20",
  "21_50": "21 to 50",
  "50_plus": "More than 50",
};

/** An email address, lower-cased so one mailbox is one row and one throttle bucket. */
const WaitlistEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(WAITLIST_EMAIL_MAX)
  .email("Enter an email address we can reach you on.");

const WaitlistFullName = z
  .string()
  .trim()
  .min(1, "Enter your name.")
  .max(WAITLIST_NAME_MAX);

/**
 * A traveller's phone, optional and deliberately unconstrained in format.
 *
 * A traveller may be abroad, and refusing a number because it is not Rwandan
 * loses a signup over a field that was optional anyway. Digits and the
 * punctuation people type around them, nothing that lets prose through.
 */
const LoosePhone = z
  .string()
  .trim()
  .min(1)
  .max(WAITLIST_PHONE_MAX)
  .regex(/^[+0-9 ()-]+$/, "expected a phone number");

const WaitlistTravellerSignup = z
  .object({
    audience: z.literal("traveller"),
    email: WaitlistEmail,
    fullName: WaitlistFullName,
    phone: LoosePhone.optional(),
    marketingOptIn: z.boolean().optional().default(false),
  })
  .strict();

const WaitlistOwnerSignup = z
  .object({
    audience: z.literal("owner"),
    email: WaitlistEmail,
    fullName: WaitlistFullName,
    // Required here and Rwandan, unlike the traveller branch: this is supply,
    // and somebody is going to ring this number to onboard the property.
    // `RwPhoneNumber` normalises to `+250...` on the way in, so the column and
    // the database check constraint only ever see the one stored spelling.
    phone: RwPhoneNumber,
    businessName: z
      .string()
      .trim()
      .min(1, "This one is needed so we can get in touch properly.")
      .max(WAITLIST_BUSINESS_NAME_MAX),
    // `districts.id` is an integer smart-code, not a uuid. Geography is the one
    // documented exception to this schema's uuid primary keys.
    districtId: z.number().int().positive(),
    propertyType: WaitlistPropertyType,
    sizeBand: WaitlistSizeBand,
    marketingOptIn: z.boolean().optional().default(false),
  })
  .strict();

export const WaitlistSignupInput = z.discriminatedUnion("audience", [
  WaitlistTravellerSignup,
  WaitlistOwnerSignup,
]);
export type WaitlistSignupInput = z.infer<typeof WaitlistSignupInput>;

/**
 * What a submission returns: the row id, and whether the address was already
 * stored. Nothing the caller sent is echoed back (AC-9).
 */
export const WaitlistSignupResult = z.object({
  id: Uuid,
  alreadyJoined: z.boolean(),
});
export type WaitlistSignupResult = z.infer<typeof WaitlistSignupResult>;

/**
 * Unsubscribing answers the same way for a known token, an unknown one and one
 * already spent (AC-12). There is no failure shape, on purpose: a 404 here
 * would tell a stranger whether an address is on the list.
 */
export const WaitlistUnsubscribeResult = z.object({ ok: z.literal(true) });
export type WaitlistUnsubscribeResult = z.infer<
  typeof WaitlistUnsubscribeResult
>;

// ===========================================================================
// The staff view (AC-17). Everything below sits behind `StaffGuard`.
// ===========================================================================

/** Offset pagination, capped so one call cannot pull the whole list. */
export const AdminWaitlistQuery = z.object({
  audience: WaitlistAudience.optional(),
  districtId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});
export type AdminWaitlistQuery = z.infer<typeof AdminWaitlistQuery>;

/** The filter alone. The export streams every matching row, so it takes no page. */
export const AdminWaitlistExportQuery = z.object({
  audience: WaitlistAudience.optional(),
  districtId: z.coerce.number().int().positive().optional(),
});
export type AdminWaitlistExportQuery = z.infer<typeof AdminWaitlistExportQuery>;

export const AdminWaitlistRow = z.object({
  id: Uuid,
  audience: WaitlistAudience,
  email: z.string(),
  fullName: z.string(),
  phone: z.string().nullable(),
  businessName: z.string().nullable(),
  districtId: z.number().int().nullable(),
  districtName: z.string().nullable(),
  propertyType: WaitlistPropertyType.nullable(),
  sizeBand: WaitlistSizeBand.nullable(),
  marketingOptIn: z.boolean(),
  invitedAt: z.string().nullable(),
  unsubscribedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type AdminWaitlistRow = z.infer<typeof AdminWaitlistRow>;

export const AdminWaitlistPage = z.object({
  total: z.number().int().nonnegative(),
  rows: z.array(AdminWaitlistRow),
});
export type AdminWaitlistPage = z.infer<typeof AdminWaitlistPage>;

/**
 * Marking somebody invited is idempotent: the value records when they were
 * FIRST invited, so a second click returns the timestamp already there rather
 * than rewriting history or answering 409 (ADR-048, API surface).
 */
export const AdminWaitlistInviteResult = z.object({
  invitedAt: z.string(),
});
export type AdminWaitlistInviteResult = z.infer<
  typeof AdminWaitlistInviteResult
>;
