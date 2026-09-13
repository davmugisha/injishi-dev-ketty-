import { z } from "zod";
import { isKnownCountry } from "./countries";
import { AccommodationClass, RdbEntityGroup, ResidenceClass, StoredAccommodationClass } from "./rdb";
import { Domain, OrgRegistrationStatus, OversightRole, RwfAmount, Uuid } from "./primitives";
/**
 * Business registration (F-S03 / FL01), governed by D20, D23 and D24.
 *
 * The wire shapes for the wizard and for the pipeline that carries a
 * registration from `pending_payment` to `active`. Validation lives here rather
 * than in the form so the browser and the server refuse the same input for the
 * same reason — a client-side check is an affordance, never the control.
 */
// ---------------------------------------------------------------------------
// Who is registering
// ---------------------------------------------------------------------------
/**
 * The first question the wizard asks, because it picks the whole path.
 *
 * `host` and `landlord` both create an `orgs` row and differ by `domain`;
 * `broker` creates a `brokers` row and no org at all. All three are priced
 * separately in `registration_fees`, which is why this is one enum and not a
 * boolean plus a domain.
 */
export const RegistrantRole = z.enum(["host", "landlord", "broker"]);
export type RegistrantRole = z.infer<typeof RegistrantRole>;
/** The three rows `registration_fees` is keyed by (schema §8.3a). */
export const RegistrationBusinessType = z.enum([
    "hospitality",
    "residence",
    "broker",
]);
export type RegistrationBusinessType = z.infer<typeof RegistrationBusinessType>;
/** A registrant's answer maps onto exactly one fee row and one domain. */
export function businessTypeFor(role: RegistrantRole): RegistrationBusinessType {
    switch (role) {
        case "host":
            return "hospitality";
        case "landlord":
            return "residence";
        case "broker":
            return "broker";
    }
}
/** Whether this registrant is the owner, or acting for one (OBO, FL02). */
export const RegistrantCapacity = z.enum(["owner", "on_behalf_of"]);
export type RegistrantCapacity = z.infer<typeof RegistrantCapacity>;
// ---------------------------------------------------------------------------
// Identity fields (D24)
// ---------------------------------------------------------------------------
export const Gender = z.enum(["female", "male", "other", "prefer_not_to_say"]);
export type Gender = z.infer<typeof Gender>;
/**
 * The two document types that may anchor an ACCOUNT.
 *
 * Narrower than the shared `DocumentType` primitive on purpose: that enum keeps
 * `other` for walk-in stay capture, and the database enforces the same
 * narrowing with a CHECK on `identity_documents`.
 */
export const AccountDocumentType = z.enum(["national_id", "passport"]);
export type AccountDocumentType = z.infer<typeof AccountDocumentType>;
/** ISO-3166-1 alpha-2, upper case. `RW` is the address discriminator (D24). */
export const CountryCode = z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Use a two-letter country code, like RW or KE.")
    // Checked against the list the picker renders, so a code that passes here is
    // always a code the form could have offered. Without this, "ZZ" validates.
    // Wrapped rather than passed as the type guard it is: a guard here would
    // narrow the inferred type to a 249-member union, which reads terribly in
    // every error message and cannot describe a code already sitting in a column.
    // The return type is spelled out because TypeScript now infers a type
    // predicate through an arrow that only forwards to a guard, which is exactly
    // the 249-member narrowing the wrapper above exists to prevent.
    .refine((c): boolean => isKnownCountry(c), "We do not recognise that country code.");
export type CountryCode = z.infer<typeof CountryCode>;
/**
 * Rwandan National ID: 16 digits, commonly written in spaced groups.
 *
 * Spaces are stripped before checking, because the field is displayed grouped
 * and a person who types what they see should not be told they are wrong. The
 * stored value is the bare digits.
 */
export const RwandanNationalId = z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, ""))
    .pipe(z
    .string()
    .regex(/^\d{16}$/, "A Rwandan National ID is 16 digits."));
/**
 * Passport number. Deliberately loose: issuing states disagree on length and
 * alphabet, and rejecting a valid foreign passport is worse than accepting a
 * typo that the verifier will catch against the document itself.
 */
export const PassportNumber = z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, "").toUpperCase())
    .pipe(z
    .string()
    .regex(/^[A-Z0-9]{6,12}$/, "A passport number is 6 to 12 letters or digits."));
/** The identity document a registrant presents, validated per type. */
export const IdentityDocumentInput = z
    .discriminatedUnion("documentType", [
    z.object({
        documentType: z.literal("national_id"),
        documentNumber: RwandanNationalId,
        /** A Rwandan NID is Rwandan by definition; kept explicit for the row. */
        issuingCountry: z.literal("RW").default("RW"),
    }),
    z.object({
        documentType: z.literal("passport"),
        documentNumber: PassportNumber,
        issuingCountry: CountryCode,
    }),
])
    .describe("National ID or passport, validated by the type chosen.");
export type IdentityDocumentInput = z.infer<typeof IdentityDocumentInput>;
// ---------------------------------------------------------------------------
// Address (D24)
// ---------------------------------------------------------------------------
/**
 * An address, discriminated by country.
 *
 * Rwanda gets the administrative hierarchy Province -> District -> Sector plus
 * a street line; anywhere else gets a free-form international address and no
 * hierarchy ids at all. The database carries the same rule as a CHECK, so a
 * non-Rwandan address can never hold a Rwandan sector id.
 *
 * Province is collected but not stored: `sectors` already resolves upward to
 * its district and province, and storing a fourth copy invites the four to
 * disagree. It is on the wire so the picker can validate its own cascade.
 */
export const RwandanAddress = z.object({
    country: z.literal("RW"),
    provinceId: z.number().int().positive("Choose a province."),
    districtId: z.number().int().positive("Choose a district."),
    sectorId: z.number().int().positive("Choose a sector."),
    /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
    street: z.string().trim().max(200).optional(),
});
export type RwandanAddress = z.infer<typeof RwandanAddress>;
export const InternationalAddress = z.object({
    country: CountryCode.refine((c) => c !== "RW", "Use the Rwandan address form for a Rwandan address."),
    /** The whole address as written locally. Formats differ too much to split. */
    addressText: z
        .string()
        .trim()
        .min(1, "Write the address.")
        .max(500, "That address is too long for our records."),
});
export type InternationalAddress = z.infer<typeof InternationalAddress>;
export const Address = z.union([RwandanAddress, InternationalAddress]);
export type Address = z.infer<typeof Address>;
/** Narrowing helper both sides use rather than re-testing the discriminator. */
export function isRwandanAddress(address: Address): address is RwandanAddress {
    return address.country === "RW";
}
// ---------------------------------------------------------------------------
// Identifiers (D24 — TIN for businesses, UPI for residences)
// ---------------------------------------------------------------------------
/** RRA Tax Identification Number: 9 digits, often written in groups of three. */
export const Tin = z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^\d{9}$/, "A TIN is 9 digits."));
/**
 * Unique Parcel Identifier. Five slash-separated numeric parts, e.g.
 * `1/03/07/02/1234`. Accepted with or without spaces around the separators.
 */
export const Upi = z
    .string()
    .trim()
    .transform((v) => v.replace(/\s*\/\s*/g, "/"))
    .pipe(z
    .string()
    .regex(/^\d+\/\d+\/\d+\/\d+\/\d+$/, "A UPI looks like 1/03/07/02/1234."));
// ---------------------------------------------------------------------------
// Step 1 — About you
// ---------------------------------------------------------------------------
export const PersonalDetails = z.object({
    /** As written on the identity document. */
    fullName: z
        .string()
        .trim()
        .min(2, "Tell us your full name, as written on your document.")
        .max(160, "That name is too long for our records."),
    document: IdentityDocumentInput,
    gender: Gender.optional(),
    /** ISO date. Bounds are sanity rails, not a policy on who may register. */
    dateOfBirth: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker.")
        .refine((v) => {
        const d = new Date(`${v}T00:00:00Z`);
        if (Number.isNaN(d.getTime()))
            return false;
        const years = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
        return years >= 18 && years <= 120;
    }, "You must be at least 18 to register a business."),
    phoneE164: z
        .string()
        .trim()
        .transform((v) => v.replace(/[\s-]/g, ""))
        .pipe(z
        .string()
        .regex(/^\+\d{7,15}$/, "Include the country code, like +250788123456.")),
    address: Address,
});
export type PersonalDetails = z.infer<typeof PersonalDetails>;
// ---------------------------------------------------------------------------
// Step 2 — Your business
// ---------------------------------------------------------------------------
/** A certificate the registrant attaches (schema §4.3a). */
export const CertificateInput = z.object({
    kind: z.enum([
        "rdb_grade",
        "tourism_license",
        "tax_clearance",
        "fire_safety",
        "health_inspection",
        "other",
    ]),
    /** Required when `kind` is `other`; the database carries the same rule. */
    kindOther: z.string().trim().min(1).max(120).optional(),
    /** Key of an already-uploaded `stored_objects` row (F-S09). */
    objectKey: z.string().trim().min(1),
    certificateNumber: z.string().trim().max(120).optional(),
    issuedBy: z.string().trim().max(160).optional(),
    issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type CertificateInput = z.infer<typeof CertificateInput>;
const businessBase = z.object({
    legalName: z
        .string()
        .trim()
        .min(2, "Give the registered name of the business.")
        .max(200, "That name is too long for our records."),
    address: RwandanAddress,
    certificates: z.array(CertificateInput).max(20).default([]),
});
/**
 * A hospitality business. Carries a TIN, never a UPI-only identity, and is the
 * only branch that may hold a tourism licence, a grade, or a PSF membership.
 */
export const HospitalityBusiness = businessBase.extend({
    domain: z.literal("hospitality"),
    entityGroup: RdbEntityGroup.default("accommodation"),
    accommodationClass: AccommodationClass,
    /** Required when the class is `other`, forbidden otherwise (D24). */
    accommodationClassOther: z.string().trim().min(1).max(120).optional(),
    tin: Tin,
    upi: Upi.optional(),
    tourismLicenseNumber: z.string().trim().max(60).optional(),
    chamberOfTourismMember: z.boolean().default(false),
    /** Optional, and hospitality only. Not the PSF oversight body (D24). */
    psfMember: z.boolean().default(false),
    eacStarGrade: z.number().int().min(1).max(5).optional(),
});
/** A residence. Carries a UPI, and none of the tourism apparatus. */
export const ResidenceBusiness = businessBase.extend({
    domain: z.literal("residence"),
    residenceClass: ResidenceClass,
    upi: Upi,
});
export const BusinessDetails = z
    .discriminatedUnion("domain", [HospitalityBusiness, ResidenceBusiness])
    .superRefine((value, ctx) => {
    if (value.domain !== "hospitality")
        return;
    // Mirrors `orgs_accommodation_class_other_shape`. Enforced here too so the
    // wizard can say which field is wrong instead of surfacing a constraint name.
    const isOther = value.accommodationClass === "other";
    if (isOther && !value.accommodationClassOther) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["accommodationClassOther"],
            message: "Tell us what kind of place this is.",
        });
    }
    if (!isOther && value.accommodationClassOther) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["accommodationClassOther"],
            message: "Only fill this in when you pick Other.",
        });
    }
});
export type BusinessDetails = z.infer<typeof BusinessDetails>;
/**
 * The owner an on behalf of registration is made for (FL02).
 *
 * All three are required (owner ruling 2026-09-13, ADR-049 J25). They used to be
 * optional, and each missing one strands the business: no email means no claim
 * invitation is ever sent, and no national id means no claimant can ever match,
 * so the real owner is refused their own business. Exported on its own so the
 * register wizard checks the block with this schema before it leaves the step
 * that asks for it, rather than restating the rule.
 */
export const IntendedOwner = z
    .object({
    name: z
        .string({ required_error: "Tell us the owner's full name." })
        .trim()
        .min(2, "Tell us the owner's full name.")
        .max(160, "That name is too long for our records."),
    nationalId: z
        .string({
        required_error: "Tell us the owner's National ID. It is how we match them when they claim.",
    })
        .trim()
        .min(1, "Tell us the owner's National ID. It is how we match them when they claim.")
        .pipe(RwandanNationalId),
    email: z
        .string({
        required_error: "Tell us the owner's email. We send their claim invitation there.",
    })
        .trim()
        .min(1, "Tell us the owner's email. We send their claim invitation there.")
        .email("That email address does not look right."),
});
export type IntendedOwner = z.infer<typeof IntendedOwner>;
// ---------------------------------------------------------------------------
// The request
// ---------------------------------------------------------------------------
export const CreateRegistrationRequest = z
    .object({
    role: RegistrantRole,
    capacity: RegistrantCapacity.default("owner"),
    /**
     * Omitted by a returning registrant, whose profile already carries it.
     * Absent is not "skip validation" — the server reads the stored profile and
     * refuses if that is incomplete.
     */
    personal: PersonalDetails.optional(),
    business: BusinessDetails,
    /** Captured when `capacity` is `on_behalf_of`. See `IntendedOwner`. */
    intendedOwner: IntendedOwner.optional(),
})
    .superRefine((value, ctx) => {
    const expected = value.role === "landlord" ? "residence" : "hospitality";
    if (value.role !== "broker" && value.business.domain !== expected) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["business", "domain"],
            message: `A ${value.role} registers a ${expected} business.`,
        });
    }
    if (value.capacity === "on_behalf_of" && !value.intendedOwner) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["intendedOwner"],
            message: "Tell us who you are registering for.",
        });
    }
});
export type CreateRegistrationRequest = z.infer<typeof CreateRegistrationRequest>;
// ---------------------------------------------------------------------------
// The two government gates (D25, F-S03 §6)
// ---------------------------------------------------------------------------
/**
 * Why a registration was refused.
 *
 * A code, not a sentence, because F-S03 §6 promises a RESUMABLE rejection: the
 * wizard has to send the registrant back to the part that was wrong, and it
 * cannot read an officer's paragraph to work out which part that was. `notes`
 * carries the officer's own words alongside, and `other` is the honest escape.
 */
export const RegistrationRejectionReason = z.enum([
    "tin_not_found",
    "tin_mismatch",
    "premises_not_found",
    "documents_invalid",
    "documents_expired",
    "not_operating",
    "ownership_unclear",
    "duplicate_business",
    "other",
]);
export type RegistrationRejectionReason = z.infer<typeof RegistrationRejectionReason>;
/** What the registrant is told to go and fix. Ordered as the wizard's steps. */
export const REJECTION_REASON_LABEL: Readonly<Record<RegistrationRejectionReason, string>> = {
    tin_not_found: "We could not find this TIN at RRA.",
    tin_mismatch: "The TIN does not match the business name on record.",
    premises_not_found: "The verifier could not find the business at this address.",
    documents_invalid: "One or more certificates could not be accepted.",
    documents_expired: "One or more certificates have expired.",
    not_operating: "The business was not operating when the verifier visited.",
    ownership_unclear: "We could not confirm who owns this business.",
    duplicate_business: "This business is already registered on Injishi.",
    other: "See the note from the reviewing officer.",
};
/** Which step of the wizard a reason sends the registrant back to. */
export function stepForRejectionReason(reason: RegistrationRejectionReason): "identity" | "business" | "documents" | "none" {
    switch (reason) {
        case "tin_not_found":
        case "tin_mismatch":
        case "duplicate_business":
            return "business";
        case "documents_invalid":
        case "documents_expired":
            return "documents";
        case "ownership_unclear":
            return "identity";
        // A verifier who found no premises, or wrote a note, is not pointing at a
        // field. Sending the registrant to a step we guessed would be worse than
        // showing them the note and letting them decide.
        case "premises_not_found":
        case "not_operating":
        case "other":
            return "none";
    }
}
/**
 * The stage a review acted at: the status the org was IN, not the one it
 * reached. `tin_verified` is therefore the field verification gate and
 * `field_verified` the approval gate (D25).
 */
export const RegistrationReviewStage = z.enum([
    "tin_verified",
    "field_verified",
]);
export type RegistrationReviewStage = z.infer<typeof RegistrationReviewStage>;
export const RegistrationReviewDecision = z.enum(["passed", "rejected"]);
export type RegistrationReviewDecision = z.infer<typeof RegistrationReviewDecision>;
/** One recorded decision, as the registrant and the console both read it. */
export const RegistrationReview = z.object({
    stage: RegistrationReviewStage,
    decision: RegistrationReviewDecision,
    oversightRole: OversightRole,
    /** The body and title AS OF the decision, never re-resolved (F-S03 §9). */
    governmentBodyCode: z.string(),
    governmentTitle: z.string().nullable(),
    reasonCode: RegistrationRejectionReason.nullable(),
    notes: z.string().nullable(),
    decidedAt: z.string(),
});
export type RegistrationReview = z.infer<typeof RegistrationReview>;
/** Passing a gate. Notes are optional: a clean pass rarely needs prose. */
export const PassGateRequest = z.object({
    notes: z.string().trim().max(2000).optional(),
});
export type PassGateRequest = z.infer<typeof PassGateRequest>;
/** Refusing at a gate. The reason is required; that is the whole point. */
export const RejectRegistrationRequest = z.object({
    reasonCode: RegistrationRejectionReason,
    notes: z.string().trim().max(2000).optional(),
});
export type RejectRegistrationRequest = z.infer<typeof RejectRegistrationRequest>;
/**
 * One business waiting on this officer.
 *
 * Carries the district so a console can group by it, and `waitingSince` so the
 * time-in-stage that F-S03 §5 tracks is visible to the person who can move it,
 * not only to an analyst.
 */
export const OversightQueueItem = z.object({
    orgId: Uuid,
    legalName: z.string(),
    domain: Domain,
    accommodationClass: StoredAccommodationClass.nullable(),
    tin: z.string().nullable(),
    upi: z.string().nullable(),
    districtId: z.number().int().nullable(),
    districtName: z.string().nullable(),
    sectorName: z.string().nullable(),
    addressText: z.string().nullable(),
    status: OrgRegistrationStatus,
    waitingSince: z.string(),
    /**
     * True when this officer took the field verification and therefore may not
     * approve it. Sent so the console can explain the greyed-out button rather
     * than only refusing the click (separation of duties, F-S03 §9).
     */
    blockedBySeparationOfDuties: z.boolean(),
});
export type OversightQueueItem = z.infer<typeof OversightQueueItem>;
/**
 * One decision in an officer's own log: `GET /api/v1/oversight/decisions`
 * (ADR-049, AC-G6).
 *
 * The body and the title are the REVIEW ROW'S OWN COPIES, taken when the
 * decision was recorded, never re joined from the officer's assignment. A
 * revoked or re scoped posting must not rewrite a decision already taken, and
 * this log is the first screen that depends on that.
 */
export const OversightDecision = z.object({
    reviewId: Uuid,
    orgId: Uuid,
    legalName: z.string(),
    /** The gate decided: `tin_verified` is field verification, `field_verified` approval. */
    stage: z.enum(["tin_verified", "field_verified"]),
    decision: z.enum(["passed", "rejected"]),
    reasonCode: RegistrationRejectionReason.nullable(),
    notes: z.string().nullable(),
    governmentBodyCode: z.string(),
    governmentTitle: z.string().nullable(),
    decidedAt: z.string(),
});
export type OversightDecision = z.infer<typeof OversightDecision>;
/** A page of the log, newest first. `nextCursor` is null on the last page. */
export const OversightDecisionPage = z.object({
    items: OversightDecision.array(),
    nextCursor: z.string().nullable(),
});
export type OversightDecisionPage = z.infer<typeof OversightDecisionPage>;
/** The page to read. No cursor is the newest page; a malformed one is too. */
export const OversightDecisionQuery = z.object({
    cursor: z.string().trim().max(200).optional(),
});
export type OversightDecisionQuery = z.infer<typeof OversightDecisionQuery>;
// ---------------------------------------------------------------------------
// The response
// ---------------------------------------------------------------------------
/** What the pending workspace renders: the stage, and what is owed. */
export const RegistrationSummary = z.object({
    orgId: Uuid,
    workspaceId: Uuid,
    legalName: z.string(),
    domain: Domain,
    accommodationClass: StoredAccommodationClass.nullable(),
    status: OrgRegistrationStatus,
    /** Set only while `status` is `pending_payment`. */
    amountDueRwf: RwfAmount.nullable(),
    /** The invoice to settle, when one is outstanding. */
    invoiceId: Uuid.nullable(),
    /** Reason code from the rejecting stage, when `status` is `rejected`. */
    rejectionReason: RegistrationRejectionReason.nullable(),
    /** The reviewing officer's own words, when they left any. */
    rejectionNotes: z.string().nullable(),
    submittedAt: z.string().nullable(),
    /**
     * The operator contract this business accepted, and when (ADR-049, AC-R8).
     *
     * Read from the server so a registrant who comes back to the wizard resumes
     * at the right step, never from the browser. Both null until accepted, and
     * both stay null for a business that paid before acceptance was recorded.
     */
    contractVersion: z.string().nullable(),
    contractAcceptedAt: z.string().nullable(),
    /**
     * Whether payouts wait on the owner's identity being verified (ADR-049,
     * AC-R1). Null for a business nobody registered on behalf of anyone else.
     */
    payoutLocked: z.boolean().nullable(),
});
export type RegistrationSummary = z.infer<typeof RegistrationSummary>;
/**
 * The operator contract's version: the date its terms last changed (ADR-049).
 *
 * The document is rendered from code, so the version lives in code too. A
 * version stored anywhere else can drift from the document it names. Change
 * this in the same commit as the clause copy, and only then.
 */
export const OPERATOR_CONTRACT_VERSION = "2026-09-12";
/**
 * `POST /api/v1/registrations/:id/contract`. The version the page rendered.
 *
 * The server refuses anything but `OPERATOR_CONTRACT_VERSION` and stores the
 * constant, never this value, so a stale tab cannot bind anyone to old terms.
 */
export const AcceptContractRequest = z.object({
    contractVersion: z.string().trim().min(1).max(40),
});
export type AcceptContractRequest = z.infer<typeof AcceptContractRequest>;
/**
 * Why a registrant action on the contract or the fee was refused (409).
 *
 * `contract_not_accepted` is pay's refusal, `contract_not_open` and
 * `contract_version_stale` are accept's. Sent as `code` on the error body so a
 * page can word the refusal without matching on English.
 */
export const RegistrationConflictCode = z.enum([
    "contract_not_accepted",
    "contract_not_open",
    "contract_version_stale",
]);
export type RegistrationConflictCode = z.infer<typeof RegistrationConflictCode>;
// ---------------------------------------------------------------------------
// The owner claim (FL02, ADR-049)
// ---------------------------------------------------------------------------
/**
 * `POST /api/v1/orgs/:orgId/claim/preview` and `/claim`. The token from the
 * invitation mail, in the body so it never lands in the API's access log.
 */
export const ClaimOrgRequest = z.object({
    token: z.string().trim().min(1).max(200),
});
export type ClaimOrgRequest = z.infer<typeof ClaimOrgRequest>;
/**
 * What `/claim-org` shows before the owner commits.
 *
 * Only what the invitation mail already told whoever holds the token: the
 * business, where it is, where it got to and who registered it. Never the
 * national id, an email or the TIN.
 */
export const ClaimPreview = z.object({
    orgId: Uuid,
    legalName: z.string(),
    districtName: z.string().nullable(),
    registrationStatus: OrgRegistrationStatus,
    registrantName: z.string().nullable(),
});
export type ClaimPreview = z.infer<typeof ClaimPreview>;
/** The fee a registrant is quoted, read from the effective-dated catalog. */
export const RegistrationFeeQuote = z.object({
    businessType: RegistrationBusinessType,
    amountRwf: RwfAmount,
    currency: z.literal("RWF"),
});
export type RegistrationFeeQuote = z.infer<typeof RegistrationFeeQuote>;
// ---------------------------------------------------------------------------
// Step 1, read back — GET /api/v1/me/profile
// ---------------------------------------------------------------------------
/**
 * What the wizard shows a registrant who already has an account (FL01 §1).
 *
 * Every field is nullable because a brand new account has answered none of
 * them, and a half-answered profile is a real state the form has to render.
 *
 * The identity document comes back MASKED. Showing a person the last four
 * characters is enough for them to recognise which document is on file, and it
 * keeps this route out of the reason-gated PII read path (§10) — a full number
 * sent back on every page load is a full number in every log and cache.
 */
export const MyProfileDocument = z.object({
    documentType: AccountDocumentType,
    /** Last four characters, prefixed with a bullet run, e.g. `••••1234`. */
    documentNumberMasked: z.string(),
    issuingCountry: CountryCode,
});
export type MyProfileDocument = z.infer<typeof MyProfileDocument>;
export const MyProfile = z.object({
    fullName: z.string().nullable(),
    gender: Gender.nullable(),
    dateOfBirth: z.string().nullable(),
    phoneE164: z.string().nullable(),
    document: MyProfileDocument.nullable(),
    address: Address.nullable(),
    /**
     * Whether Step 1 is answered well enough to register a business.
     *
     * Served rather than re-derived in the browser: the rule differs by country
     * (a Rwandan profile owes its district and sector, an international one does
     * not), and two copies of that rule is one copy too many.
     */
    complete: z.boolean(),
});
export type MyProfile = z.infer<typeof MyProfile>;
// ---------------------------------------------------------------------------
// Broker registration (F-R09, ADR-026 assumption 2)
// ---------------------------------------------------------------------------
/**
 * A broker registration.
 *
 * The third arm of `RegistrantRole`, and the one that creates no org. F-R09 §6
 * asks for a Rwandan national ID, a name, a phone and an email — all of which
 * `PersonalDetails` already carries, and the email comes from the session
 * rather than the form. So this request adds no fields of its own: it exists as
 * a separate shape because `CreateRegistrationRequest` REQUIRES a business, and
 * a broker has none.
 *
 * `personal` is omitted by a returning registrant whose profile already holds
 * it, exactly as on the business path. Absent never means "skip validation":
 * the server reads the stored profile and refuses if it is incomplete.
 */
export const CreateBrokerRegistrationRequest = z.object({
    personal: PersonalDetails.optional(),
});
export type CreateBrokerRegistrationRequest = z.infer<typeof CreateBrokerRegistrationRequest>;
/** A broker's own status. Two values, and no government pipeline (F-R09 §8). */
export const BrokerStatus = z.enum(["active", "suspended"]);
export type BrokerStatus = z.infer<typeof BrokerStatus>;
/**
 * What a completed broker registration hands back.
 *
 * Deliberately NOT a `RegistrationSummary`. That shape is the org pipeline —
 * six statuses, a fee, an invoice, a rejection reason — and a broker passes
 * through none of it. Reusing it would mean six fields that are null by
 * construction and a status enum that can never hold the value it is showing.
 */
export const BrokerRegistrationSummary = z.object({
    brokerId: Uuid,
    workspaceId: Uuid,
    name: z.string(),
    status: BrokerStatus,
});
export type BrokerRegistrationSummary = z.infer<typeof BrokerRegistrationSummary>;
// ---------------------------------------------------------------------------
// Uploads (F-S09, ADR-026 assumption 1)
// ---------------------------------------------------------------------------
/**
 * A stored file, as `POST /api/v1/uploads/certificate` reports it back.
 *
 * `objectKey` is the only field that travels onward: it is what
 * `CertificateInput.objectKey` carries into `POST /registrations`. The other
 * three exist so the form can list what was attached without asking again.
 *
 * `filename` is the name the browser sent and is never a path. It is echoed for
 * display only, so a person recognises which of four PDFs they just attached.
 */
export const UploadedObject = z.object({
    objectKey: z.string().min(1),
    kind: z.literal("certificate"),
    mime: z.string(),
    sizeBytes: z.number().int().nonnegative(),
    filename: z.string(),
});
export type UploadedObject = z.infer<typeof UploadedObject>;
/** The six kinds `org_certificates.kind` accepts, in the order the form asks. */
export const CERTIFICATE_KIND_LABEL: Readonly<Record<CertificateInput["kind"], string>> = {
    rdb_grade: "RDB grade certificate",
    tourism_license: "Tourism licence",
    tax_clearance: "Tax clearance certificate",
    fire_safety: "Fire safety certificate",
    health_inspection: "Health inspection certificate",
    other: "Another document",
};