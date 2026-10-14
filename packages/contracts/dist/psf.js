"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PsfDeclineRequest = exports.PsfMemberDecisionRequest = exports.PsfOfficerApplication = exports.PsfQueueQuery = exports.PsfQueuePage = exports.PsfQueueItem = exports.CreatePsfApplicationRequest = exports.AdminOrgPsf = exports.AdminPsfApplication = exports.PsfMembershipOverview = exports.PsfApplicationPrefill = exports.PsfApplication = exports.PsfFiledForm = exports.PsfMembership = exports.UpdatePsfTierRequest = exports.CreatePsfTierRequest = exports.PsfTier = exports.OVERSIGHT_ROLE_POSTING = exports.PSF_HOSPITALITY_ONLY_MESSAGE = exports.PSF_OWN_BUSINESS_MESSAGE = exports.PSF_NOT_OPEN_MESSAGE = exports.PSF_OPEN_APPLICATION_MESSAGE = exports.PSF_FEE_NOTICE = exports.PSF_CONTACT_ROLE_LABEL = exports.PSF_TRADE_DIRECTION_LABEL = exports.PSF_OWNERSHIP_LABEL = exports.PSF_COMPANY_TYPE_LABEL = exports.PSF_MEMBERSHIP_SOURCE_LABEL = exports.PSF_DECLINE_REASON_LABEL = exports.PSF_APPLICATION_STAGE_LABEL = exports.PSF_APPLICATION_STATUS_LABEL = exports.PSF_FAMILY_LABEL = exports.PSF_QUEUE_REGISTRATION_STATES = exports.PsfApplicationStage = exports.PsfMembershipSource = exports.PsfDeclineReason = exports.PsfSubmittedCapacity = exports.PsfApplicationStatus = exports.PsfPriceKind = exports.PsfMembershipFamily = void 0;
exports.isInPsfQueueState = isInPsfQueueState;
exports.isPsfApplicant = isPsfApplicant;
exports.defaultPsfMembershipDates = defaultPsfMembershipDates;
exports.psfBusinessActivityFor = psfBusinessActivityFor;
exports.splitPsfName = splitPsfName;
const zod_1 = require("zod");
const primitives_1 = require("./primitives");
const rdb_1 = require("./rdb");
const registration_1 = require("./registration");
/**
 * PSF membership (ADR-056).
 *
 * A hospitality business that is not a Private Sector Federation member
 * applies from the registration wizard or its workspace; a PSF membership
 * officer decides in the oversight console; a Yes becomes a membership with a
 * number and an expiry. PSF invoices the business itself, so nothing here
 * carries a payment.
 *
 * The application INPUT lives in `registration.ts`, because a registration
 * embeds it. Everything else is here.
 *
 * Not the `PSF` row in `government_bodies`: officers of that body decide these
 * applications (D24 as amended by ADR-056), but a membership is never read
 * through an oversight assignment.
 */
// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------
exports.PsfMembershipFamily = zod_1.z.enum(["golden_circle", "indashyikirwa", "ordinary", "junior_giants"]);
/** A fixed amount, a min to max range, or a price only PSF can quote. */
exports.PsfPriceKind = zod_1.z.enum(["fixed", "range", "set_by_psf"]);
/** `submitted` is the only open state; the other three are terminal. */
exports.PsfApplicationStatus = zod_1.z.enum(["submitted", "member", "declined", "withdrawn"]);
exports.PsfSubmittedCapacity = zod_1.z.enum(["owner", "on_behalf_of"]);
exports.PsfDeclineReason = zod_1.z.enum([
    "details_incomplete",
    "not_eligible_for_tier",
    "business_not_recognised",
    "other",
]);
exports.PsfMembershipSource = zod_1.z.enum(["psf_confirmed", "self_declared"]);
/**
 * Where an open application stands, as the business reads it. Derived on the
 * server from the business's registration status (ADR-056 AC-8), never stored.
 */
exports.PsfApplicationStage = zod_1.z.enum(["waiting_tin_check", "with_psf"]);
/**
 * The registration states in which an open application sits in PSF's queue
 * (ADR-056 AC-8): the TIN has passed and the business is in good standing.
 * Anywhere else it waits, unchanged, and returns when the business does.
 */
exports.PSF_QUEUE_REGISTRATION_STATES = [
    "tin_verified",
    "field_verified",
    "approved",
    "active",
];
function isInPsfQueueState(status) {
    return exports.PSF_QUEUE_REGISTRATION_STATES.includes(status);
}
/**
 * THE one definition of who may see and act on a business's PSF membership.
 * The workspace grant's `canManage`, every PSF endpoint and the business's
 * mail recipients all read it, over facts the server resolved.
 *
 * An active owner, EXCEPT the on behalf registrant once the owner has claimed
 * the business. The exception is load bearing: registration makes that agent
 * an `owner`, and the claim does not remove the row (scope `_root` 40), so
 * "is an owner" alone would keep the agent reading the owner's ID number and
 * date of birth after the claim. While the claim is open the agent qualifies
 * through that same owner row, with no special case.
 *
 * Deliberately not a permission: a pending business holds none (ADR-053 rule
 * 2), and the application must be reachable at every registration stage.
 */
function isPsfApplicant(facts) {
    if (facts.domain !== "hospitality")
        return false;
    if (facts.orgRole !== "owner")
        return false;
    const obo = facts.obo;
    if (obo && obo.claimStatus === "owner_claimed" && obo.registrantUserId === facts.userId)
        return false;
    return true;
}
// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------
exports.PSF_FAMILY_LABEL = {
    golden_circle: "Golden Circle",
    indashyikirwa: "Indashyikirwa",
    ordinary: "Ordinary",
    junior_giants: "Junior Giants",
};
exports.PSF_APPLICATION_STATUS_LABEL = {
    submitted: "Sent",
    member: "Member",
    declined: "Declined",
    withdrawn: "Withdrawn",
};
exports.PSF_APPLICATION_STAGE_LABEL = {
    waiting_tin_check: "Waiting for your TIN check",
    with_psf: "With PSF",
};
exports.PSF_DECLINE_REASON_LABEL = {
    details_incomplete: "Details incomplete",
    not_eligible_for_tier: "Not eligible for this tier",
    business_not_recognised: "Business not recognised",
    other: "Other",
};
exports.PSF_MEMBERSHIP_SOURCE_LABEL = {
    psf_confirmed: "Confirmed by PSF",
    self_declared: "Declared at registration",
};
exports.PSF_COMPANY_TYPE_LABEL = {
    cooperative: "Cooperative",
    ngo: "NGO",
    partly_state_owned: "Partly state owned",
    private_company: "Private company",
    public_company: "Public company",
    sole_trader: "Sole trader",
};
exports.PSF_OWNERSHIP_LABEL = {
    foreign_100: "100% foreign owned",
    rwandan_100: "100% Rwandan owned",
    franchise: "Franchise",
    joint_venture: "Joint venture",
    foreign_representative: "Representative of a foreign company",
    other: "Other",
};
exports.PSF_TRADE_DIRECTION_LABEL = {
    none: "No",
    export: "Export",
    import: "Import",
    both: "Both",
};
exports.PSF_CONTACT_ROLE_LABEL = {
    owner: "Owner",
    managing_director: "Managing director",
    ceo: "CEO",
    chairman: "Chairman or president",
};
/** What the business is told about the fee, wherever it picks a tier (AC-2). */
exports.PSF_FEE_NOTICE = "PSF invoices you directly for the membership fee. Injishi never takes this money.";
exports.PSF_OPEN_APPLICATION_MESSAGE = "This business already has an application with PSF. Withdraw it before sending another.";
exports.PSF_NOT_OPEN_MESSAGE = "This application has already been decided or withdrawn.";
exports.PSF_OWN_BUSINESS_MESSAGE = "You hold a role in this business, so another PSF officer must decide its application.";
exports.PSF_HOSPITALITY_ONLY_MESSAGE = "PSF membership through Injishi is for hospitality businesses.";
// ---------------------------------------------------------------------------
// Where an oversight role may be posted (ADR-056 AC-10)
// ---------------------------------------------------------------------------
/**
 * The body and scopes a role must be granted at, for the roles that have a
 * rule at all. The registration roles have none and are unchanged; the grant
 * path refuses with 422 a grant that breaks its role's entry.
 */
exports.OVERSIGHT_ROLE_POSTING = {
    psf_membership_officer: {
        governmentBodyCode: "PSF",
        scopeLevels: ["country"],
        message: "A PSF membership officer is appointed at PSF, for the whole country.",
    },
};
// ---------------------------------------------------------------------------
// The tier catalogue
// ---------------------------------------------------------------------------
exports.PsfTier = zod_1.z.object({
    code: zod_1.z.string(),
    family: exports.PsfMembershipFamily,
    nameEn: zod_1.z.string(),
    nameRw: zod_1.z.string().nullable(),
    priceKind: exports.PsfPriceKind,
    annualFeeRwf: primitives_1.RwfAmount.nullable(),
    annualFeeMinRwf: primitives_1.RwfAmount.nullable(),
    annualFeeMaxRwf: primitives_1.RwfAmount.nullable(),
    benefitsEn: zod_1.z.array(zod_1.z.string()),
    benefitsRw: zod_1.z.array(zod_1.z.string()).nullable(),
    sortOrder: zod_1.z.number().int(),
    active: zod_1.z.boolean(),
});
const tierPriceShape = (value, ctx) => {
    const fee = value.annualFeeRwf ?? null;
    const min = value.annualFeeMinRwf ?? null;
    const max = value.annualFeeMaxRwf ?? null;
    // Mirrors `psf_membership_tiers_price_shape`.
    if (value.priceKind === "fixed" && (fee === null || fee <= 0 || min !== null || max !== null)) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["annualFeeRwf"], message: "A fixed price needs one amount above zero, and no range." });
    }
    if (value.priceKind === "range" && (fee !== null || min === null || max === null || min <= 0 || min >= max)) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["annualFeeMinRwf"], message: "A range needs a lowest and a highest amount, lowest first." });
    }
    if (value.priceKind === "set_by_psf" && (fee !== null || min !== null || max !== null)) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["priceKind"], message: "A price set by PSF carries no amount." });
    }
};
const tierFields = {
    family: exports.PsfMembershipFamily,
    nameEn: zod_1.z.string().trim().min(1, "Give the tier a name.").max(80),
    nameRw: zod_1.z.string().trim().min(1).max(80).nullable().optional(),
    priceKind: exports.PsfPriceKind,
    annualFeeRwf: primitives_1.RwfAmount.nullable().optional(),
    annualFeeMinRwf: primitives_1.RwfAmount.nullable().optional(),
    annualFeeMaxRwf: primitives_1.RwfAmount.nullable().optional(),
    benefitsEn: zod_1.z.array(zod_1.z.string().trim().min(1).max(400)).max(30).default([]),
    benefitsRw: zod_1.z.array(zod_1.z.string().trim().min(1).max(400)).max(30).nullable().optional(),
    sortOrder: zod_1.z.number().int().min(0).max(999),
    active: zod_1.z.boolean().default(true),
    /** Why, for the audit row every admin write records. */
    reason: zod_1.z.string().trim().min(3, "Say why, for the audit record.").max(500),
};
/** Admin adds a tier (AC-19). The code is permanent: applications name it. */
exports.CreatePsfTierRequest = zod_1.z
    .object({
    code: zod_1.z
        .string()
        .trim()
        .regex(/^[a-z][a-z0-9_]{1,59}$/, "Use lower case letters, digits and underscores, like ordinary_300k."),
    ...tierFields,
})
    .superRefine(tierPriceShape);
/**
 * Admin edits a tier. The whole price travels together, because the three
 * price columns are only meaningful as a set.
 */
exports.UpdatePsfTierRequest = zod_1.z.object(tierFields).superRefine(tierPriceShape);
// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
exports.PsfMembership = zod_1.z.object({
    id: primitives_1.Uuid,
    source: exports.PsfMembershipSource,
    tierCode: zod_1.z.string().nullable(),
    tierName: zod_1.z.string().nullable(),
    membershipNumber: zod_1.z.string(),
    annualFeeRwf: primitives_1.RwfAmount.nullable(),
    startsOn: zod_1.z.string().nullable(),
    expiresOn: zod_1.z.string().nullable(),
    endedAt: zod_1.z.string().nullable(),
});
/** The form as filed. Read by the business that sent it and the officer. */
exports.PsfFiledForm = zod_1.z.object({
    companyName: zod_1.z.string(),
    registrationType: zod_1.z.string(),
    registrationNumber: zod_1.z.string(),
    website: zod_1.z.string().nullable(),
    streetAddress: zod_1.z.string(),
    companyType: registration_1.PsfCompanyType,
    ownership: registration_1.PsfOwnership,
    ownershipOther: zod_1.z.string().nullable(),
    businessActivity: zod_1.z.string(),
    tradeDirection: registration_1.PsfTradeDirection,
    tradeGoods: zod_1.z.string().nullable(),
    tradeCountries: zod_1.z.array(zod_1.z.string()),
    contactRole: registration_1.PsfContactRole,
    firstName: zod_1.z.string(),
    lastName: zod_1.z.string(),
    gender: zod_1.z.enum(["male", "female"]),
    phoneE164: zod_1.z.string(),
    email: zod_1.z.string(),
    idDocumentType: zod_1.z.enum(["national_id", "passport"]),
    idDocumentNumber: zod_1.z.string(),
    dateOfBirth: zod_1.z.string(),
});
exports.PsfApplication = zod_1.z.object({
    id: primitives_1.Uuid,
    status: exports.PsfApplicationStatus,
    requestedTierCode: zod_1.z.string(),
    requestedTierName: zod_1.z.string(),
    quotedPriceKind: exports.PsfPriceKind,
    quotedFeeRwf: primitives_1.RwfAmount.nullable(),
    quotedFeeMinRwf: primitives_1.RwfAmount.nullable(),
    quotedFeeMaxRwf: primitives_1.RwfAmount.nullable(),
    submittedAt: zod_1.z.string(),
    submittedCapacity: exports.PsfSubmittedCapacity,
    /** Named so an owner can see an application sent on their behalf (AC-17). */
    submittedByName: zod_1.z.string().nullable(),
    queuedAt: zod_1.z.string().nullable(),
    decidedAt: zod_1.z.string().nullable(),
    declineReason: exports.PsfDeclineReason.nullable(),
    decisionNote: zod_1.z.string().nullable(),
    withdrawnAt: zod_1.z.string().nullable(),
    form: exports.PsfFiledForm,
});
/**
 * What the apply form starts from in the workspace (ADR-056 value sourcing):
 * the business row, the person's profile, and the last application sent.
 * Every field optional, because a first application from an on behalf agent
 * knows little about the owner.
 */
exports.PsfApplicationPrefill = zod_1.z.object({
    companyName: zod_1.z.string().optional(),
    streetAddress: zod_1.z.string().optional(),
    businessActivity: zod_1.z.string().optional(),
    website: zod_1.z.string().optional(),
    companyType: registration_1.PsfCompanyType.optional(),
    ownership: registration_1.PsfOwnership.optional(),
    ownershipOther: zod_1.z.string().optional(),
    tradeDirection: registration_1.PsfTradeDirection.optional(),
    tradeGoods: zod_1.z.string().optional(),
    tradeCountries: zod_1.z.array(zod_1.z.string()).optional(),
    contactRole: registration_1.PsfContactRole.optional(),
    firstName: zod_1.z.string().optional(),
    lastName: zod_1.z.string().optional(),
    gender: zod_1.z.enum(["male", "female"]).optional(),
    phoneE164: zod_1.z.string().optional(),
    email: zod_1.z.string().optional(),
    idDocumentType: zod_1.z.enum(["national_id", "passport"]).optional(),
    idDocumentNumber: zod_1.z.string().optional(),
    dateOfBirth: zod_1.z.string().optional(),
});
/** `GET /orgs/:orgId/psf-membership` (AC-15). */
exports.PsfMembershipOverview = zod_1.z.object({
    orgId: primitives_1.Uuid,
    /** The TIN PSF's form is filed under; not editable (AC-3). */
    registrationNumber: zod_1.z.string(),
    current: exports.PsfMembership.nullable(),
    open: exports.PsfApplication.extend({ stage: exports.PsfApplicationStage }).nullable(),
    /** Decided and withdrawn applications, newest first. */
    history: zod_1.z.array(exports.PsfApplication),
    canApply: zod_1.z.boolean(),
    prefill: exports.PsfApplicationPrefill,
});
/**
 * One application as the admin business detail lists it (AC-20): its state,
 * tier and decision, WITHOUT the filed form. The form carries an ID number and
 * a date of birth, and the business detail is a read that asks for no reason.
 */
exports.AdminPsfApplication = exports.PsfApplication.omit({ form: true });
/** The PSF section of the admin business detail (AC-20). */
exports.AdminOrgPsf = zod_1.z.object({
    membership: exports.PsfMembership.nullable(),
    applications: zod_1.z.array(exports.AdminPsfApplication),
});
/** `POST /orgs/:orgId/psf-applications` (AC-16). */
exports.CreatePsfApplicationRequest = registration_1.PsfApplicationInput;
// ---------------------------------------------------------------------------
// The officer's side (AC-10 to AC-14)
// ---------------------------------------------------------------------------
exports.PsfQueueItem = zod_1.z.object({
    applicationId: primitives_1.Uuid,
    orgId: primitives_1.Uuid,
    businessName: zod_1.z.string(),
    districtName: zod_1.z.string().nullable(),
    requestedTierName: zod_1.z.string(),
    submittedAt: zod_1.z.string(),
    queuedAt: zod_1.z.string().nullable(),
    registrationStatus: primitives_1.OrgRegistrationStatus,
    /** False when the officer holds a stake in the business (AC-14). */
    canDecide: zod_1.z.boolean(),
});
exports.PsfQueuePage = zod_1.z.object({
    items: exports.PsfQueueItem.array(),
    nextCursor: zod_1.z.string().nullable(),
});
/** The same cursor shape the officer's decision log pages by. */
exports.PsfQueueQuery = registration_1.OversightDecisionQuery;
exports.PsfOfficerApplication = exports.PsfApplication.extend({
    orgId: primitives_1.Uuid,
    businessName: zod_1.z.string(),
    districtName: zod_1.z.string().nullable(),
    registrationStatus: primitives_1.OrgRegistrationStatus,
    canDecide: zod_1.z.boolean(),
});
const isoDate = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker.");
/** Marking an application `member` (AC-11). */
exports.PsfMemberDecisionRequest = zod_1.z
    .object({
    tierCode: zod_1.z.string().trim().min(1, "Pick the tier PSF confirmed."),
    membershipNumber: zod_1.z.string().trim().min(1, "Give the PSF membership number.").max(40),
    annualFeeRwf: primitives_1.RwfAmount.refine((n) => n > 0, "Give the annual fee PSF charged."),
    startsOn: isoDate,
    expiresOn: isoDate,
})
    .superRefine((value, ctx) => {
    if (value.expiresOn <= value.startsOn) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["expiresOn"], message: "The expiry must come after the start." });
    }
});
/** Declining an application (AC-12). A note is required with `other`. */
exports.PsfDeclineRequest = zod_1.z
    .object({
    reason: exports.PsfDeclineReason,
    note: zod_1.z.string().trim().min(1).max(1000).optional(),
})
    .superRefine((value, ctx) => {
    if (value.reason === "other" && !value.note) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["note"], message: "Say why, so the business knows what to fix." });
    }
});
/**
 * The membership dates an officer starts from: today, and one year later less
 * a day (ADR-056 value sourcing). `today` is a yyyy-mm-dd date in
 * Africa/Kigali, which the caller resolves.
 */
function defaultPsfMembershipDates(today) {
    const [y, m, d] = today.split("-").map(Number);
    const end = new Date(Date.UTC(y + 1, m - 1, d));
    end.setUTCDate(end.getUTCDate() - 1);
    return { startsOn: today, expiresOn: end.toISOString().slice(0, 10) };
}
/**
 * The business activity PSF's form starts from, derived from the
 * accommodation class (ADR-056 value sourcing). Editable wherever it shows.
 */
function psfBusinessActivityFor(accommodationClass, accommodationClassOther) {
    if (accommodationClass === "other" && accommodationClassOther)
        return `Accommodation: ${accommodationClassOther}`;
    if (!accommodationClass)
        return "Accommodation";
    const label = rdb_1.ACCOMMODATION_CLASS_LABEL[accommodationClass] ??
        accommodationClass.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
    return `Accommodation: ${label}`;
}
/**
 * Split a full name into PSF's two fields at the last space (ADR-056). A
 * starting point the person corrects, never a rule trusted on its own:
 * Rwandan names do not reliably put the family name last.
 */
function splitPsfName(fullName) {
    const trimmed = fullName.trim().replace(/\s+/g, " ");
    const at = trimmed.lastIndexOf(" ");
    if (at <= 0)
        return { firstName: trimmed, lastName: "" };
    return { firstName: trimmed.slice(0, at), lastName: trimmed.slice(at + 1) };
}
//# sourceMappingURL=psf.js.map