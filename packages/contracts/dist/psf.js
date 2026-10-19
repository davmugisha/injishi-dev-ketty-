"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PsfMembershipOverview = exports.PsfBusinessProfile = exports.PsfApplicationPrefill = exports.PsfApplication = exports.PsfPayment = exports.PsfFiledForm = exports.PsfMembership = exports.CreatePsfAssociationRequest = exports.UpsertPsfAssociationRequest = exports.CreatePsfClusterRequest = exports.UpsertPsfClusterRequest = exports.PsfCatalogue = exports.PsfCluster = exports.PsfAssociation = exports.UpdatePsfTierRequest = exports.CreatePsfTierRequest = exports.PsfTier = exports.OVERSIGHT_ROLE_POSTING = exports.PSF_OUT_OF_SCOPE_MESSAGE = exports.PSF_NOT_FOR_RESIDENCE_MESSAGE = exports.PSF_OWN_BUSINESS_MESSAGE = exports.PSF_NOT_PAYABLE_MESSAGE = exports.PSF_NOT_OPEN_MESSAGE = exports.PSF_OPEN_APPLICATION_MESSAGE = exports.PSF_FEE_NOTICE = exports.REGISTRATION_TYPE_SHORT = exports.ENTERPRISE_REGISTRATION_KIND_LABEL = exports.PSF_OWNER_GROUP_SHORT = exports.PSF_OWNER_GROUP_LABEL = exports.PSF_CONTACT_ROLE_LABEL = exports.PSF_TRADE_DIRECTION_LABEL = exports.PSF_OWNERSHIP_LABEL = exports.PSF_COMPANY_TYPE_LABEL = exports.PSF_MEMBERSHIP_SOURCE_LABEL = exports.PSF_DECLINE_REASON_LABEL = exports.PSF_APPLICATION_STAGE_LABEL = exports.PSF_APPLICATION_STATUS_LABEL = exports.PSF_OFFERED_FAMILIES = exports.PSF_FAMILY_BLURB = exports.PSF_FAMILY_LABEL = exports.PSF_DOMAINS = exports.PSF_QUEUE_REGISTRATION_STATES = exports.PsfApplicationStage = exports.PsfMembershipSource = exports.PsfDeclineReason = exports.PsfSubmittedCapacity = exports.PSF_OPEN_APPLICATION_STATUSES = exports.PsfApplicationStatus = exports.PsfPriceKind = exports.PsfMembershipFamily = void 0;
exports.PsfRegisterSummary = exports.PsfCount = exports.PsfBusinessesPage = exports.PsfBusinessRow = exports.PsfBusinessesQuery = exports.PsfBusinessKind = exports.PSF_STANDING_LABEL = exports.PsfStanding = exports.PsfDeclineRequest = exports.PsfApproveRequest = exports.PsfOfficerApplication = exports.PsfQueueQuery = exports.PsfQueuePage = exports.PsfQueueItem = exports.PayPsfMembershipRequest = exports.CreatePsfApplicationRequest = exports.AdminOrgPsf = exports.AdminPsfApplication = void 0;
exports.isInPsfQueueState = isInPsfQueueState;
exports.isPsfApplicant = isPsfApplicant;
exports.psfTierAcceptsFee = psfTierAcceptsFee;
exports.psfFeeProblem = psfFeeProblem;
exports.psfStartingFee = psfStartingFee;
exports.defaultPsfMembershipDates = defaultPsfMembershipDates;
exports.psfBusinessActivityFor = psfBusinessActivityFor;
exports.splitPsfName = splitPsfName;
const zod_1 = require("zod");
const primitives_1 = require("./primitives");
const rdb_1 = require("./rdb");
const registration_1 = require("./registration");
/**
 * PSF membership (ADR-056, widened by the PSF path).
 *
 * A business that is not a Private Sector Federation member applies from its
 * workspace (a hotel may also apply from the registration wizard); a PSF
 * membership officer approves it; the business then pays the membership fee
 * through Injishi, which passes it to PSF; the payment is what makes it a
 * member, with a number and an expiry.
 *
 * Two kinds of business apply: a hospitality business, and an `enterprise`,
 * a business of any sector that registered on Injishi in order to join PSF.
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
/**
 * The families PSF prices membership in. `ordinary` and `junior_giants` are
 * retired (2026-10-15) and stay only so the rows that name them still read.
 */
exports.PsfMembershipFamily = zod_1.z.enum(["golden_circle", "indashyikirwa", "indatwa", "ordinary", "junior_giants"]);
/**
 * A fixed amount, a min to max band, a floor with no ceiling (`minimum`, which
 * is Golden Circle's 5,000,000 and up), or a price only PSF can quote.
 */
exports.PsfPriceKind = zod_1.z.enum(["fixed", "range", "minimum", "set_by_psf"]);
/**
 * `submitted` waits on PSF, `approved` waits on the business's payment; both
 * are open. The other three are terminal.
 */
exports.PsfApplicationStatus = zod_1.z.enum(["submitted", "approved", "member", "declined", "withdrawn"]);
/** The statuses an application is still open in: one per business at a time. */
exports.PSF_OPEN_APPLICATION_STATUSES = ["submitted", "approved"];
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
 * server from the application and the business's registration status
 * (ADR-056 AC-8), never stored.
 */
exports.PsfApplicationStage = zod_1.z.enum(["waiting_tin_check", "with_psf", "awaiting_payment"]);
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
// ---------------------------------------------------------------------------
// Who may apply for a business (ADR-056, "the applicant")
// ---------------------------------------------------------------------------
/** The domains that may hold a PSF membership through Injishi. A residence may not. */
exports.PSF_DOMAINS = ["hospitality", "enterprise"];
/**
 * THE one definition of who may see and act on a business's PSF membership.
 * The workspace grant's `canManage`, every PSF endpoint and the business's
 * mail recipients all read it, over facts the server resolved.
 *
 * An active owner of a hospitality or PSF business, EXCEPT the on behalf
 * registrant once the owner has claimed the business. The exception is load
 * bearing: registration makes that agent an `owner`, and the claim does not
 * remove the row (scope `_root` 40), so "is an owner" alone would keep the
 * agent reading the owner's ID number and date of birth after the claim. While
 * the claim is open the agent qualifies through that same owner row, with no
 * special case.
 *
 * Deliberately not a permission: a pending business holds none (ADR-053 rule
 * 2), and the application must be reachable at every registration stage.
 */
function isPsfApplicant(facts) {
    if (facts.domain === null || !exports.PSF_DOMAINS.includes(facts.domain))
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
    indatwa: "Indatwa",
    ordinary: "Ordinary",
    junior_giants: "Junior Giants",
};
/** One line on who each family is for, as the tier picker introduces it. */
exports.PSF_FAMILY_BLURB = {
    golden_circle: "For large companies and major investors.",
    indashyikirwa: "For established businesses leading their sector.",
    indatwa: "For small and growing businesses. Pick the band you can afford.",
    ordinary: "Retired.",
    junior_giants: "Retired.",
};
/** The families a business can still pick, in the order PSF ranks them. */
exports.PSF_OFFERED_FAMILIES = ["golden_circle", "indashyikirwa", "indatwa"];
exports.PSF_APPLICATION_STATUS_LABEL = {
    submitted: "With PSF",
    approved: "Approved, to pay",
    member: "Member",
    declined: "Declined",
    withdrawn: "Withdrawn",
};
exports.PSF_APPLICATION_STAGE_LABEL = {
    waiting_tin_check: "Waiting for your TIN check",
    with_psf: "With PSF",
    awaiting_payment: "Approved, waiting for your payment",
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
exports.PSF_OWNER_GROUP_LABEL = {
    women: "Women owned",
    youth: "Youth owned",
    pwd: "Owned by a person with a disability",
};
/** The same groups, short, for a chip or a filter. */
exports.PSF_OWNER_GROUP_SHORT = {
    women: "Women",
    youth: "Youth",
    pwd: "PWD",
};
exports.ENTERPRISE_REGISTRATION_KIND_LABEL = {
    tin: "RRA TIN",
    rca: "Cooperative, registered with RCA",
    rgb: "NGO, registered with RGB",
    other: "Another registration",
    none: "Not registered yet",
};
/** The same kinds, as a filed form names its registration: `TIN 123456789`. */
exports.REGISTRATION_TYPE_SHORT = {
    tin: "TIN",
    rca: "RCA",
    rgb: "RGB",
    other: "Registration",
    none: "Not registered",
};
/** What the business is told about the fee, wherever it picks a tier (AC-2). */
exports.PSF_FEE_NOTICE = "Once PSF approves you, you pay the membership fee here by mobile money. It goes to PSF; Injishi keeps none of it.";
exports.PSF_OPEN_APPLICATION_MESSAGE = "This business already has an open application with PSF. Withdraw it before sending another.";
exports.PSF_NOT_OPEN_MESSAGE = "This application has already been decided or withdrawn.";
exports.PSF_NOT_PAYABLE_MESSAGE = "This application is not waiting for a payment.";
exports.PSF_OWN_BUSINESS_MESSAGE = "You hold a role in this business, so another PSF officer must decide its application.";
exports.PSF_NOT_FOR_RESIDENCE_MESSAGE = "PSF membership through Injishi is for businesses, not for residences let on a lease.";
exports.PSF_OUT_OF_SCOPE_MESSAGE = "This business is outside the region you cover.";
// ---------------------------------------------------------------------------
// Where an oversight role may be posted (ADR-056 AC-10)
// ---------------------------------------------------------------------------
/**
 * The body and scopes a role must be granted at, for the roles that have a
 * rule at all. The registration roles have none and are unchanged; the grant
 * path refuses with 422 a grant that breaks its role's entry.
 *
 * A PSF membership officer may be posted for the whole country, a province or
 * one district, and sees exactly the businesses of that region.
 */
exports.OVERSIGHT_ROLE_POSTING = {
    psf_membership_officer: {
        governmentBodyCode: "PSF",
        scopeLevels: ["country", "province", "district"],
        message: "A PSF membership officer is appointed at PSF.",
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
    if (value.priceKind === "minimum" && (fee !== null || min === null || min <= 0 || max !== null)) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["annualFeeMinRwf"], message: "A price from an amount up needs that lowest amount, and no highest." });
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
        .regex(/^[a-z][a-z0-9_]{1,59}$/, "Use lower case letters, digits and underscores, like indatwa_10k."),
    ...tierFields,
})
    .superRefine(tierPriceShape);
/**
 * Admin edits a tier. The whole price travels together, because the three
 * price columns are only meaningful as a set.
 */
exports.UpdatePsfTierRequest = zod_1.z.object(tierFields).superRefine(tierPriceShape);
/**
 * Does this tier take this yearly amount?
 *
 * A business pays what it can afford inside its band, so the amount it names
 * is checked here, the one rule the apply form and the server both read:
 * a fixed tier takes its price, a band anything inside it, a floor anything
 * from it up. A tier PSF prices itself takes no amount from the business:
 * the officer names it on approval.
 */
function psfTierAcceptsFee(tier, amountRwf) {
    const amount = amountRwf ?? null;
    switch (tier.priceKind) {
        case "fixed":
            return amount !== null && amount === tier.annualFeeRwf;
        case "range":
            return (amount !== null &&
                tier.annualFeeMinRwf !== null &&
                tier.annualFeeMaxRwf !== null &&
                amount >= tier.annualFeeMinRwf &&
                amount <= tier.annualFeeMaxRwf);
        case "minimum":
            return amount !== null && tier.annualFeeMinRwf !== null && amount >= tier.annualFeeMinRwf;
        case "set_by_psf":
            return amount === null;
    }
}
/** What a refusal of `psfTierAcceptsFee` says, in the band's own terms. */
function psfFeeProblem(tier, amountRwf) {
    if (psfTierAcceptsFee(tier, amountRwf))
        return null;
    const rwf = (n) => `RWF ${(n ?? 0).toLocaleString("en-US")}`;
    switch (tier.priceKind) {
        case "fixed":
            return `This tier costs ${rwf(tier.annualFeeRwf)} a year.`;
        case "range":
            return `Give an amount from ${rwf(tier.annualFeeMinRwf)} to ${rwf(tier.annualFeeMaxRwf)}.`;
        case "minimum":
            return `Give an amount of at least ${rwf(tier.annualFeeMinRwf)}.`;
        case "set_by_psf":
            return "PSF names the price of this tier. Leave the amount empty.";
    }
}
/** The amount a form starts from: the price, or the bottom of the band. */
function psfStartingFee(tier) {
    if (tier.priceKind === "fixed")
        return tier.annualFeeRwf;
    if (tier.priceKind === "range" || tier.priceKind === "minimum")
        return tier.annualFeeMinRwf;
    return null;
}
// ---------------------------------------------------------------------------
// The sector catalogue (clusters and their associations)
// ---------------------------------------------------------------------------
/**
 * PSF's sector clusters, and the associations inside them, as a catalogue
 * admin edits. PSF restructured once already (ten chambers became five
 * clusters in 2022), so this is data, never an enum: a new association is an
 * edit, not a migration. Women, youth and disability (the Specialized cluster)
 * are not here; they are `PsfOwnerGroup`, a marker on a business of any sector.
 */
exports.PsfAssociation = zod_1.z.object({
    code: zod_1.z.string(),
    clusterCode: zod_1.z.string(),
    nameEn: zod_1.z.string(),
    acronym: zod_1.z.string().nullable(),
    sortOrder: zod_1.z.number().int(),
    active: zod_1.z.boolean(),
});
exports.PsfCluster = zod_1.z.object({
    code: zod_1.z.string(),
    nameEn: zod_1.z.string(),
    nameRw: zod_1.z.string().nullable(),
    /** One line on what kind of business belongs here. */
    description: zod_1.z.string().nullable(),
    sortOrder: zod_1.z.number().int(),
    active: zod_1.z.boolean(),
    associations: zod_1.z.array(exports.PsfAssociation),
});
/** `GET /psf/catalogue`: the clusters in order, each with its associations. */
exports.PsfCatalogue = zod_1.z.object({ clusters: zod_1.z.array(exports.PsfCluster) });
const catalogueCode = zod_1.z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{1,59}$/, "Use lower case letters, digits and underscores, like industry.");
const auditReason = zod_1.z.string().trim().min(3, "Say why, for the audit record.").max(500);
exports.UpsertPsfClusterRequest = zod_1.z.object({
    nameEn: zod_1.z.string().trim().min(1, "Give the cluster a name.").max(80),
    nameRw: zod_1.z.string().trim().min(1).max(80).nullable().optional(),
    description: zod_1.z.string().trim().max(240).nullable().optional(),
    sortOrder: zod_1.z.number().int().min(0).max(999),
    active: zod_1.z.boolean().default(true),
    reason: auditReason,
});
exports.CreatePsfClusterRequest = exports.UpsertPsfClusterRequest.extend({ code: catalogueCode });
exports.UpsertPsfAssociationRequest = zod_1.z.object({
    clusterCode: zod_1.z.string().trim().min(1, "Pick the cluster."),
    nameEn: zod_1.z.string().trim().min(1, "Give the association a name.").max(160),
    acronym: zod_1.z.string().trim().min(1).max(24).nullable().optional(),
    sortOrder: zod_1.z.number().int().min(0).max(999),
    active: zod_1.z.boolean().default(true),
    reason: auditReason,
});
exports.CreatePsfAssociationRequest = exports.UpsertPsfAssociationRequest.extend({ code: catalogueCode });
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
    /** `tin`, `rca`, `rgb`, `other` or `none` (see `REGISTRATION_TYPE_SHORT`). */
    registrationType: zod_1.z.string(),
    /** Null for a business registered nowhere yet. */
    registrationNumber: zod_1.z.string().nullable(),
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
/** The payment that made an approved application a membership. */
exports.PsfPayment = zod_1.z.object({
    paidAt: zod_1.z.string(),
    amountRwf: primitives_1.RwfAmount,
    /** The provider's own reference, which a receipt quotes. */
    reference: zod_1.z.string(),
    /** Whether Injishi has passed the money on to PSF yet. */
    remittedAt: zod_1.z.string().nullable(),
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
    /** What the business said it would pay a year. Null for a tier PSF prices. */
    declaredFeeRwf: primitives_1.RwfAmount.nullable(),
    submittedAt: zod_1.z.string(),
    submittedCapacity: exports.PsfSubmittedCapacity,
    /** Named so an owner can see an application sent on their behalf (AC-17). */
    submittedByName: zod_1.z.string().nullable(),
    queuedAt: zod_1.z.string().nullable(),
    decidedAt: zod_1.z.string().nullable(),
    declineReason: exports.PsfDeclineReason.nullable(),
    decisionNote: zod_1.z.string().nullable(),
    /** Set on approval: the number PSF gave, and what the business now owes. */
    approvedMembershipNumber: zod_1.z.string().nullable(),
    approvedFeeRwf: primitives_1.RwfAmount.nullable(),
    payment: exports.PsfPayment.nullable(),
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
/** The business as PSF sees it: its code, its sector and who owns it. */
exports.PsfBusinessProfile = zod_1.z.object({
    domain: primitives_1.Domain,
    businessCode: zod_1.z.string().nullable(),
    districtName: zod_1.z.string().nullable(),
    clusterName: zod_1.z.string().nullable(),
    associationName: zod_1.z.string().nullable(),
    ownerGroups: zod_1.z.array(registration_1.PsfOwnerGroup),
    registrationKind: registration_1.EnterpriseRegistrationKind.nullable(),
});
/** `GET /orgs/:orgId/psf-membership` (AC-15). */
exports.PsfMembershipOverview = zod_1.z.object({
    orgId: primitives_1.Uuid,
    /**
     * The registration PSF's form is filed under; not editable (AC-3). A TIN
     * for a hotel, whatever the business registered with on the PSF path, and
     * empty for a PSF business registered nowhere yet.
     */
    registrationNumber: zod_1.z.string(),
    profile: exports.PsfBusinessProfile,
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
/**
 * `POST /orgs/:orgId/psf-applications/:id/pay`: pay an approved application's
 * fee by mobile money. The number the prompt goes to; the amount is the one on
 * the approval, never the request's.
 */
exports.PayPsfMembershipRequest = zod_1.z.object({
    phoneE164: zod_1.z
        .string()
        .trim()
        .transform((v) => v.replace(/[\s-]/g, ""))
        .pipe(zod_1.z.string().regex(/^\+2507\d{8}$/, "Give a Rwandan mobile money number, like +250788123456.")),
});
// ---------------------------------------------------------------------------
// The officer's side (AC-10 to AC-14)
// ---------------------------------------------------------------------------
exports.PsfQueueItem = zod_1.z.object({
    applicationId: primitives_1.Uuid,
    orgId: primitives_1.Uuid,
    businessName: zod_1.z.string(),
    businessCode: zod_1.z.string().nullable(),
    domain: primitives_1.Domain,
    districtName: zod_1.z.string().nullable(),
    associationName: zod_1.z.string().nullable(),
    ownerGroups: zod_1.z.array(registration_1.PsfOwnerGroup),
    requestedTierName: zod_1.z.string(),
    declaredFeeRwf: primitives_1.RwfAmount.nullable(),
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
    profile: exports.PsfBusinessProfile,
    canDecide: zod_1.z.boolean(),
});
/**
 * Approving an application (AC-11, as the PSF path changed it). PSF gives the
 * membership number now; the membership itself starts when the business pays.
 * The fee is the business's own declared amount, so the officer names one only
 * for a tier PSF prices itself.
 */
exports.PsfApproveRequest = zod_1.z.object({
    membershipNumber: zod_1.z.string().trim().min(1, "Give the PSF membership number.").max(40),
    feeRwf: primitives_1.RwfAmount.refine((n) => n > 0, "Give the annual fee PSF charges.").optional(),
    note: zod_1.z.string().trim().min(1).max(1000).optional(),
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
// ---------------------------------------------------------------------------
// The officer's register of businesses
// ---------------------------------------------------------------------------
/**
 * Where a business stands with PSF, as the officer's register filters it.
 * Derived from its applications and memberships, never stored:
 *
 *   not_applied        registered, never applied (or only withdrew)
 *   applied            an application waits on PSF
 *   awaiting_payment   approved, the fee not yet paid
 *   member             a current membership
 *   lapsed             a membership that ended, and none current
 *   declined           the last application was declined, none open
 */
exports.PsfStanding = zod_1.z.enum(["not_applied", "applied", "awaiting_payment", "member", "lapsed", "declined"]);
exports.PSF_STANDING_LABEL = {
    not_applied: "Not applied",
    applied: "Applied",
    awaiting_payment: "Approved, to pay",
    member: "Member",
    lapsed: "Lapsed",
    declined: "Declined",
};
/** The registers a business may be listed under: the PSF path, a hotel, or both. */
exports.PsfBusinessKind = zod_1.z.enum(["enterprise", "hospitality"]);
const optionalText = (max) => zod_1.z.string().trim().min(1).max(max).optional();
/**
 * `GET /oversight/psf/businesses`. Every filter optional; together they narrow.
 * `district` must sit inside the officer's own region, or the list is empty.
 */
exports.PsfBusinessesQuery = zod_1.z.object({
    q: optionalText(80),
    district: zod_1.z.coerce.number().int().positive().optional(),
    cluster: optionalText(60),
    association: optionalText(60),
    tier: optionalText(60),
    standing: exports.PsfStanding.optional(),
    group: registration_1.PsfOwnerGroup.optional(),
    tin: zod_1.z.enum(["with", "without"]).optional(),
    kind: exports.PsfBusinessKind.optional(),
    cursor: zod_1.z.string().max(200).optional(),
});
exports.PsfBusinessRow = zod_1.z.object({
    orgId: primitives_1.Uuid,
    businessCode: zod_1.z.string().nullable(),
    legalName: zod_1.z.string(),
    domain: primitives_1.Domain,
    districtId: zod_1.z.number().int().nullable(),
    districtName: zod_1.z.string().nullable(),
    sectorName: zod_1.z.string().nullable(),
    clusterCode: zod_1.z.string().nullable(),
    clusterName: zod_1.z.string().nullable(),
    associationName: zod_1.z.string().nullable(),
    associationAcronym: zod_1.z.string().nullable(),
    ownerGroups: zod_1.z.array(registration_1.PsfOwnerGroup),
    registrationKind: registration_1.EnterpriseRegistrationKind.nullable(),
    hasTin: zod_1.z.boolean(),
    registeredAt: zod_1.z.string(),
    standing: exports.PsfStanding,
    tierName: zod_1.z.string().nullable(),
    membershipNumber: zod_1.z.string().nullable(),
    expiresOn: zod_1.z.string().nullable(),
    /** The open application, when there is one, so the row can open it. */
    openApplicationId: primitives_1.Uuid.nullable(),
});
exports.PsfBusinessesPage = zod_1.z.object({
    items: zod_1.z.array(exports.PsfBusinessRow),
    nextCursor: zod_1.z.string().nullable(),
    /** How many businesses match the filters, across every page. */
    total: zod_1.z.number().int(),
});
/** A count of businesses under one heading, for the register's summary. */
exports.PsfCount = zod_1.z.object({ key: zod_1.z.string(), label: zod_1.z.string(), count: zod_1.z.number().int() });
/**
 * `GET /oversight/psf/summary`: the officer's region at a glance. Counted over
 * the officer's whole region, ignoring the register's other filters.
 */
exports.PsfRegisterSummary = zod_1.z.object({
    /** The region in words: "Rwanda", a province, or a district. */
    regionLabel: zod_1.z.string(),
    total: zod_1.z.number().int(),
    members: zod_1.z.number().int(),
    waiting: zod_1.z.number().int(),
    /** Fees paid this calendar year through Injishi, in RWF. */
    paidThisYearRwf: zod_1.z.number().int(),
    byCluster: zod_1.z.array(exports.PsfCount),
    byStanding: zod_1.z.array(exports.PsfCount),
    byGroup: zod_1.z.array(exports.PsfCount),
    byDistrict: zod_1.z.array(exports.PsfCount.extend({ letters: zod_1.z.string() })),
});
/**
 * The membership dates a payment starts from: the day it settled, and one
 * year later less a day (ADR-056 value sourcing). `today` is a yyyy-mm-dd date
 * in Africa/Kigali, which the caller resolves.
 */
function defaultPsfMembershipDates(today) {
    const [y, m, d] = today.split("-").map(Number);
    const end = new Date(Date.UTC(y + 1, m - 1, d));
    end.setUTCDate(end.getUTCDate() - 1);
    return { startsOn: today, expiresOn: end.toISOString().slice(0, 10) };
}
/**
 * The business activity PSF's form starts from (ADR-056 value sourcing): the
 * accommodation class for a hotel, the association for a PSF business.
 * Editable wherever it shows.
 */
function psfBusinessActivityFor(accommodationClass, accommodationClassOther, associationName = null) {
    if (associationName)
        return associationName;
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