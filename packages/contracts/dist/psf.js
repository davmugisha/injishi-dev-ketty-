"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PsfApplicationPrefill = exports.PsfApplication = exports.PsfPayment = exports.PsfFiledForm = exports.PsfMembership = exports.CreatePsfAssociationRequest = exports.UpsertPsfAssociationRequest = exports.CreatePsfClusterRequest = exports.UpsertPsfClusterRequest = exports.PsfCatalogue = exports.PsfCluster = exports.PsfSubsector = exports.PsfAssociation = exports.UpdatePsfTierRequest = exports.CreatePsfTierRequest = exports.PsfTier = exports.OVERSIGHT_ROLE_POSTING = exports.PSF_OUT_OF_SCOPE_MESSAGE = exports.PSF_NOT_FOR_RESIDENCE_MESSAGE = exports.PSF_DISTRICT_DECIDES_MESSAGE = exports.PSF_OWN_BUSINESS_MESSAGE = exports.PSF_NOT_PAYABLE_MESSAGE = exports.PSF_NOT_OPEN_MESSAGE = exports.PSF_OPEN_APPLICATION_MESSAGE = exports.PSF_FEE_NOTICE = exports.REGISTRATION_TYPE_SHORT = exports.ENTERPRISE_REGISTRATION_KIND_LABEL = exports.PSF_OWNER_GROUP_SHORT = exports.PSF_OWNER_GROUP_LABEL = exports.PSF_CONTACT_ROLE_LABEL = exports.PSF_TRADE_DIRECTION_LABEL = exports.PSF_OWNERSHIP_LABEL = exports.PSF_COMPANY_TYPE_LABEL = exports.PSF_MEMBERSHIP_SOURCE_LABEL = exports.PSF_DECLINE_REASON_LABEL = exports.PSF_APPLICATION_STAGE_LABEL = exports.PSF_APPLICATION_STATUS_LABEL = exports.PSF_OFFERED_FAMILIES = exports.PSF_FAMILY_BLURB = exports.PSF_FAMILY_LABEL = exports.PSF_DOMAINS = exports.PSF_QUEUE_REGISTRATION_STATES = exports.PsfApplicationStage = exports.PsfMembershipSource = exports.PsfDeclineReason = exports.PsfSubmittedCapacity = exports.PSF_OPEN_APPLICATION_STATUSES = exports.PsfApplicationStatus = exports.PsfPriceKind = exports.PsfMembershipFamily = void 0;
exports.PsfMemberListRow = exports.RejectPsfClaimRequest = exports.ConfirmPsfClaimRequest = exports.PsfClaimsPage = exports.PsfClaimsQuery = exports.PsfMembershipClaim = exports.PsfClaimStatus = exports.PsfFormAnswers = exports.UpdatePsfFormFieldRequest = exports.CreatePsfFormFieldRequest = exports.PsfFormFieldsOfficerView = exports.PsfFormFieldsPublic = exports.PsfFormField = exports.PsfFormFieldOption = exports.PsfFormFieldKey = exports.PsfFormFieldType = exports.UpdatePsfSubsectorRequest = exports.CreatePsfSubsectorRequest = exports.PsfSubsectorsView = exports.PsfRegisterSummary = exports.PsfCount = exports.PsfBusinessesPage = exports.PsfBusinessBranch = exports.PsfPaymentReminderResult = exports.PsfPaymentReminderRequest = exports.PsfBusinessRow = exports.PsfBusinessesQuery = exports.PsfBusinessKind = exports.PSF_STANDING_LABEL = exports.PsfStanding = exports.PsfDeclineRequest = exports.PsfApproveRequest = exports.PsfOfficerApplication = exports.PsfQueueQuery = exports.PsfQueuePage = exports.PsfQueueItem = exports.PSF_APPLICATION_INTAKE_LABEL = exports.PsfApplicationIntake = exports.PSF_APPLICATION_ORIGIN_LABEL = exports.PsfApplicationOrigin = exports.PsfBranchDecisionRequest = exports.PsfApplicationBranch = exports.PSF_BRANCH_STATUS_LABEL = exports.PsfBranchStatus = exports.PayPsfMembershipRequest = exports.CreatePsfApplicationRequest = exports.AdminOrgPsf = exports.AdminPsfApplication = exports.PsfMembershipOverview = exports.PsfBusinessProfile = void 0;
exports.PsfMemberListResult = exports.UploadPsfMemberListRequest = void 0;
exports.isInPsfQueueState = isInPsfQueueState;
exports.isPsfApplicant = isPsfApplicant;
exports.psfTierAcceptsFee = psfTierAcceptsFee;
exports.psfFeeProblem = psfFeeProblem;
exports.psfStartingFee = psfStartingFee;
exports.defaultPsfMembershipDates = defaultPsfMembershipDates;
exports.psfBusinessActivityFor = psfBusinessActivityFor;
exports.splitPsfName = splitPsfName;
exports.normalizePsfNumber = normalizePsfNumber;
exports.looksLikePsfNumber = looksLikePsfNumber;
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
/** `psf_record`: a claimed number PSF confirmed against its own records (0121), with no application. */
exports.PsfMembershipSource = zod_1.z.enum(["psf_confirmed", "self_declared", "psf_record"]);
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
    psf_record: "Confirmed from PSF's records",
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
    rwandan_100: "100% Rwandan owned",
    foreign_100: "100% foreign owned",
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
/**
 * Only a PSF District Manager approves or declines (2026-10-23), and only in
 * their own district: the application for its head office's, a branch for the
 * branch's. Province and national managers read everything for reporting.
 */
exports.PSF_DISTRICT_DECIDES_MESSAGE = "Only the PSF District Manager of its district approves or declines. Province and national managers see it for reporting.";
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
 * one district, and sees exactly the businesses of that region. Injishi's admin
 * posts only the Province Managers (2026-11-02); each Province
 * Manager posts its districts' District Managers, and a District Manager its
 * district's BDEs, from the PSF console's Team screen, so neither is offered to
 * admin here.
 */
exports.OVERSIGHT_ROLE_POSTING = {
    psf_membership_officer: {
        governmentBodyCode: "PSF",
        scopeLevels: ["province"],
        message: "Injishi appoints PSF's Province Managers, at PSF. A Province Manager appoints its District Managers from the PSF console.",
    },
    psf_business_officer: {
        governmentBodyCode: "PSF",
        scopeLevels: [],
        message: "A BDE (Business Development & Empowerment) is appointed by the PSF District Manager of that district, from the PSF console.",
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
/**
 * A sector's subtype (2026-10-20): Hospitality, Tourism, Transport under
 * Services. National when `districtId` is null; otherwise offered only in
 * that district. `associationCodes` are the associations the form offers
 * once it is picked.
 */
exports.PsfSubsector = zod_1.z.object({
    id: primitives_1.Uuid,
    clusterCode: zod_1.z.string(),
    nameEn: zod_1.z.string(),
    districtId: zod_1.z.number().int().nullable(),
    districtName: zod_1.z.string().nullable(),
    sortOrder: zod_1.z.number().int(),
    active: zod_1.z.boolean(),
    associationCodes: zod_1.z.array(zod_1.z.string()),
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
    /** National subtypes, and the district's own when the catalogue was asked for one. */
    subsectors: zod_1.z.array(exports.PsfSubsector).default([]),
});
/** `GET /psf/catalogue?district=`: the clusters in order, each with its associations and subtypes. */
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
    /** The subtype picked, or the one the business typed. */
    subsectorName: zod_1.z.string().nullable().default(null),
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
/**
 * A BRANCH of a business that applied through the public form (2026-10-23):
 * another place it trades from. Each is admitted by the PSF officer of the
 * branch's own district, beside the head office's decision on the business,
 * so a business in Kicukiro with a shop in Musanze is seen in both offices.
 */
exports.PsfBranchStatus = zod_1.z.enum(["pending", "admitted", "declined"]);
exports.PSF_BRANCH_STATUS_LABEL = {
    pending: "Waiting on PSF",
    admitted: "Admitted",
    declined: "Declined",
};
/** A branch trades under the business's own name, so it is told apart by where it is. */
exports.PsfApplicationBranch = zod_1.z.object({
    id: primitives_1.Uuid,
    districtId: zod_1.z.number().int(),
    districtName: zod_1.z.string().nullable(),
    sectorName: zod_1.z.string().nullable(),
    street: zod_1.z.string(),
    status: exports.PsfBranchStatus,
    note: zod_1.z.string().nullable(),
    decidedAt: zod_1.z.string().nullable(),
    /** True when this officer covers the branch's district, it waits on PSF, and they hold no stake. */
    canDecide: zod_1.z.boolean(),
});
/** Admitting or declining one branch. A decline says why, so the business knows. */
exports.PsfBranchDecisionRequest = zod_1.z
    .object({
    decision: zod_1.z.enum(["admit", "decline"]),
    note: zod_1.z.string().trim().min(1).max(1000).optional(),
})
    .superRefine((value, ctx) => {
    if (value.decision === "decline" && !value.note) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["note"], message: "Say why, so the business knows what to fix." });
    }
});
/**
 * Where an application was sent from (2026-11-02): the public PSF form (no account, tracked by docID),
 * or Injishi's business registration, which files one when the business chooses to apply.
 */
exports.PsfApplicationOrigin = zod_1.z.enum(["psf_form", "registration"]);
exports.PSF_APPLICATION_ORIGIN_LABEL = {
    psf_form: "PSF form",
    registration: "Injishi registration",
};
/**
 * How a business came in (2026-11-02, 0131): a new application, or a holder of an old PSF card, with
 * no number or certificate in the new module, joining it. A card holder pays nothing now, is given a
 * new number, and keeps the year on its card.
 */
exports.PsfApplicationIntake = zod_1.z.enum(["new", "card_holder"]);
exports.PSF_APPLICATION_INTAKE_LABEL = {
    new: "New",
    card_holder: "Card holder",
};
exports.PsfQueueItem = zod_1.z.object({
    applicationId: primitives_1.Uuid,
    /** New, or a card holder joining the new module (2026-11-02). */
    intake: exports.PsfApplicationIntake.default("new"),
    /** Where it was sent from: the public PSF form, or Injishi's business registration. */
    origin: exports.PsfApplicationOrigin.default("registration"),
    orgId: primitives_1.Uuid,
    businessName: zod_1.z.string(),
    businessCode: zod_1.z.string().nullable(),
    domain: primitives_1.Domain,
    districtName: zod_1.z.string().nullable(),
    associationName: zod_1.z.string().nullable(),
    subsectorName: zod_1.z.string().nullable().default(null),
    ownerGroups: zod_1.z.array(registration_1.PsfOwnerGroup),
    requestedTierName: zod_1.z.string(),
    declaredFeeRwf: primitives_1.RwfAmount.nullable(),
    submittedAt: zod_1.z.string(),
    queuedAt: zod_1.z.string().nullable(),
    registrationStatus: primitives_1.OrgRegistrationStatus,
    /** False when the officer holds a stake in the business (AC-14). */
    canDecide: zod_1.z.boolean(),
    districtId: zod_1.z.number().int().nullable(),
    /** Whole days since it reached the queue. */
    waitingDays: zod_1.z.number().int(),
    /** The docID a public applicant tracks it by; null for a hotel's. */
    docId: zod_1.z.string().nullable(),
    clusterName: zod_1.z.string().nullable().default(null),
    /** What the business already paid for its membership, when it paid before review. */
    paidRwf: primitives_1.RwfAmount.nullable().default(null),
    /**
     * False when the officer is here only for a branch: the head office is in
     * another district, whose officer decides the business itself.
     */
    headOfficeInScope: zod_1.z.boolean().default(true),
    /** Branches in this officer's region still waiting on PSF. */
    branchesPending: zod_1.z.number().int().default(0),
    /**
     * Whether this officer is the one who decides it (2026-10-23): the PSF
     * District Manager of its district. A province or national manager reads
     * the queue for reporting and never decides.
     */
    decidesHere: zod_1.z.boolean().default(true),
});
exports.PsfQueuePage = zod_1.z.object({
    items: exports.PsfQueueItem.array(),
    nextCursor: zod_1.z.string().nullable(),
    /** How many match the filters, across every page. */
    total: zod_1.z.number().int().default(0),
});
/** The same cursor shape the officer's decision log pages by. */
exports.PsfQueueQuery = registration_1.OversightDecisionQuery;
exports.PsfOfficerApplication = exports.PsfApplication.extend({
    orgId: primitives_1.Uuid,
    /** New, or a card holder joining the new module (2026-11-02): confirmed with dates, no fee. */
    intake: exports.PsfApplicationIntake.default("new"),
    /** Where it was sent from: the public PSF form, or Injishi's business registration. */
    origin: exports.PsfApplicationOrigin.default("registration"),
    businessName: zod_1.z.string(),
    districtName: zod_1.z.string().nullable(),
    registrationStatus: primitives_1.OrgRegistrationStatus,
    profile: exports.PsfBusinessProfile,
    canDecide: zod_1.z.boolean(),
    docId: zod_1.z.string().nullable(),
    waitingDays: zod_1.z.number().int(),
    /** The next number in this district's run for this year, for the approve dialog. */
    suggestedMembershipNumber: zod_1.z.string().nullable(),
    /**
     * Paid before review (the public path, 2026-10-20): approving makes the
     * business a member at once. Declining keeps the fee: nothing is refunded
     * (2026-10-23).
     */
    paidBeforeReview: zod_1.z.boolean().default(false),
    /** False when the officer reads it only for a branch in their district. */
    headOfficeInScope: zod_1.z.boolean().default(true),
    branches: exports.PsfApplicationBranch.array().default([]),
    /** The officer is the District Manager who decides the business (2026-10-23); see `PsfQueueItem.decidesHere`. */
    decidesHere: zod_1.z.boolean().default(true),
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
    /** A card holder's year, as its card shows it (2026-11-02). Required for a card holder, unused otherwise. */
    startsOn: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-mm-dd.").optional(),
    expiresOn: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-mm-dd.").optional(),
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
 *   claimed            typed a membership number PSF has not confirmed yet (0121)
 *   applied            an application waits on PSF
 *   awaiting_payment   approved, the fee not yet paid
 *   member             a current membership
 *   lapsed             a membership that ended, and none current
 *   declined           the last application was declined, none open
 */
exports.PsfStanding = zod_1.z.enum(["not_applied", "claimed", "applied", "awaiting_payment", "member", "lapsed", "declined"]);
exports.PSF_STANDING_LABEL = {
    not_applied: "Not applied",
    claimed: "Card holder, waiting for PSF",
    applied: "Waiting for approval",
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
    subsector: primitives_1.Uuid.optional(),
    district: zod_1.z.coerce.number().int().positive().optional(),
    /** Narrow to one province of the officer's region (the province and national views). */
    province: zod_1.z.coerce.number().int().positive().optional(),
    cluster: optionalText(60),
    association: optionalText(60),
    tier: optionalText(60),
    standing: exports.PsfStanding.optional(),
    /** `due`: a current membership inside its renewal window, 60 days before it ends, or past it (2026-11-02). */
    renewal: zod_1.z.enum(["due"]).optional(),
    /**
     * `due`: an application sent and not paid (2026-11-02): the public form's payment at submit that did not go
     * through, or an approval still to pay. Such a business is not on the register otherwise.
     */
    payment: zod_1.z.enum(["due"]).optional(),
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
    subsectorName: zod_1.z.string().nullable().default(null),
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
    /** Paid in through Injishi: membership fees, and any registration fee. */
    paidRwf: primitives_1.RwfAmount.default(0),
    lastPaidAt: zod_1.z.string().nullable().default(null),
    /** Its branches (2026-10-23): the other places it trades from, on its newest application. */
    branchCount: zod_1.z.number().int().default(0),
    /**
     * False when the officer sees it only because a branch is in their region:
     * its head office, and its decision, are another district's.
     */
    headOfficeInScope: zod_1.z.boolean().default(true),
    /** The unpaid application, when one is waiting for its payment (2026-11-02): what is owed and who to reach. */
    paymentDue: zod_1.z
        .object({
        amountRwf: primitives_1.RwfAmount.nullable(),
        since: zod_1.z.string(),
        docId: zod_1.z.string().nullable(),
        contactName: zod_1.z.string(),
        phoneE164: zod_1.z.string().nullable(),
        email: zod_1.z.string().nullable(),
        /** The last payment reminder an officer sent; one a day at most. */
        lastRemindedAt: zod_1.z.string().nullable(),
    })
        .nullable()
        .default(null),
});
/** `POST /oversight/psf/payment-reminders`: remind one business, or every one waiting in the region. */
exports.PsfPaymentReminderRequest = zod_1.z.object({ orgId: primitives_1.Uuid.optional() });
exports.PsfPaymentReminderResult = zod_1.z.object({
    sent: zod_1.z.number().int(),
    /** Reminded within the last day already, so not again. */
    skipped: zod_1.z.number().int(),
});
/** One branch on a business's page, wherever it is: every officer who opens the business sees them all. */
exports.PsfBusinessBranch = zod_1.z.object({
    id: primitives_1.Uuid,
    provinceName: zod_1.z.string().nullable(),
    districtId: zod_1.z.number().int(),
    districtName: zod_1.z.string().nullable(),
    sectorName: zod_1.z.string().nullable(),
    street: zod_1.z.string(),
    status: exports.PsfBranchStatus,
    note: zod_1.z.string().nullable(),
    /** In the officer's own region: theirs to decide on the application. */
    inScope: zod_1.z.boolean(),
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
    /** Fees paid this calendar year through Injishi, in RWF: new memberships and renewals. */
    paidThisYearRwf: zod_1.z.number().int(),
    /** Members inside their renewal window, 60 days before the end date (2026-11-02). */
    renewalDue: zod_1.z.number().int().default(0),
    /** Renewals paid this calendar year. */
    renewedThisYear: zod_1.z.number().int().default(0),
    /** Applications sent and not paid (2026-11-02). */
    awaitingPayment: zod_1.z.number().int().default(0),
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
/** `GET /oversight/psf/subsectors`: what the officer may read and change. */
exports.PsfSubsectorsView = zod_1.z.object({
    clusters: zod_1.z.array(zod_1.z.object({ code: zod_1.z.string(), nameEn: zod_1.z.string(), subsectors: zod_1.z.array(exports.PsfSubsector.extend({ canEdit: zod_1.z.boolean() })) })),
    /** Where the officer may put a new subtype: null for national, or a district id. */
    places: zod_1.z.array(zod_1.z.object({ districtId: zod_1.z.number().int().nullable(), label: zod_1.z.string() })),
    associations: zod_1.z.array(zod_1.z.object({ code: zod_1.z.string(), clusterCode: zod_1.z.string(), nameEn: zod_1.z.string() })),
});
/** Add a subtype. A national officer may add one for the country; any officer for a district they cover. */
exports.CreatePsfSubsectorRequest = zod_1.z.object({
    clusterCode: zod_1.z.string().trim().min(1),
    nameEn: zod_1.z.string().trim().min(2, "Give the subtype a name.").max(80),
    districtId: zod_1.z.number().int().positive().nullable(),
    associationCodes: zod_1.z.array(zod_1.z.string().trim().min(1)).max(60).default([]),
});
exports.UpdatePsfSubsectorRequest = zod_1.z.object({
    nameEn: zod_1.z.string().trim().min(2, "Give the subtype a name.").max(80).optional(),
    active: zod_1.z.boolean().optional(),
    sortOrder: zod_1.z.number().int().min(0).max(999).optional(),
    associationCodes: zod_1.z.array(zod_1.z.string().trim().min(1)).max(60).optional(),
});
// ---------------------------------------------------------------------------
// Dynamic membership form fields (officer-configured extras on registration)
// ---------------------------------------------------------------------------
/**
 * Field types an officer may add to the PSF membership form. `select` needs at
 * least one option; the others carry no options.
 */
exports.PsfFormFieldType = zod_1.z.enum(["text", "textarea", "number", "boolean", "select"]);
/** Stable key: lowercase snake, used as the answer bag key and in APIs. */
exports.PsfFormFieldKey = zod_1.z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{1,39}$/, "Use a short lowercase key, e.g. employees_count.");
exports.PsfFormFieldOption = zod_1.z.string().trim().min(1).max(80);
exports.PsfFormField = zod_1.z.object({
    id: primitives_1.Uuid,
    key: exports.PsfFormFieldKey,
    label: zod_1.z.string().trim().min(1).max(120),
    helpText: zod_1.z.string().trim().max(400).nullable(),
    fieldType: exports.PsfFormFieldType,
    required: zod_1.z.boolean(),
    options: zod_1.z.array(exports.PsfFormFieldOption),
    sortOrder: zod_1.z.number().int(),
    active: zod_1.z.boolean(),
});
/** What applicants and the public form see: active fields only, ordered. */
exports.PsfFormFieldsPublic = zod_1.z.object({
    fields: zod_1.z.array(exports.PsfFormField.omit({ active: true })),
});
/** What an officer sees and may edit: every field, including inactive. */
exports.PsfFormFieldsOfficerView = zod_1.z.object({
    fields: zod_1.z.array(exports.PsfFormField),
    /** Only a country-scoped PSF officer may create or edit the catalogue. */
    canEdit: zod_1.z.boolean(),
});
exports.CreatePsfFormFieldRequest = zod_1.z
    .object({
    key: exports.PsfFormFieldKey,
    label: zod_1.z.string().trim().min(1).max(120),
    helpText: zod_1.z.string().trim().max(400).nullable().optional(),
    fieldType: exports.PsfFormFieldType,
    required: zod_1.z.boolean().default(false),
    options: zod_1.z.array(exports.PsfFormFieldOption).max(40).default([]),
    sortOrder: zod_1.z.number().int().min(0).max(999).default(0),
})
    .superRefine((v, ctx) => {
    if (v.fieldType === "select" && v.options.length < 1) {
        ctx.addIssue({ code: "custom", path: ["options"], message: "A select field needs at least one option." });
    }
    if (v.fieldType !== "select" && v.options.length > 0) {
        ctx.addIssue({ code: "custom", path: ["options"], message: "Only a select field carries options." });
    }
});
exports.UpdatePsfFormFieldRequest = zod_1.z
    .object({
    label: zod_1.z.string().trim().min(1).max(120).optional(),
    helpText: zod_1.z.string().trim().max(400).nullable().optional(),
    required: zod_1.z.boolean().optional(),
    options: zod_1.z.array(exports.PsfFormFieldOption).max(40).optional(),
    sortOrder: zod_1.z.number().int().min(0).max(999).optional(),
    active: zod_1.z.boolean().optional(),
})
    .refine((v) => Object.keys(v).length > 0, { message: "Send at least one change." });
/**
 * Answers bag keyed by field `key`. Validation against the live catalogue
 * happens on the server at submit; this shape only bounds the wire.
 */
exports.PsfFormAnswers = zod_1.z.record(zod_1.z.string(), zod_1.z.union([zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean(), zod_1.z.null()]));
// ---------------------------------------------------------------------------
// Membership claims (0121, 2026-10-30)
// ---------------------------------------------------------------------------
/** A typed membership number is a claim until PSF confirms it. */
exports.PsfClaimStatus = zod_1.z.enum(["claimed", "confirmed", "rejected"]);
/** A number as a business typed it: trimmed, upper case, inner spaces collapsed. */
function normalizePsfNumber(raw) {
    return raw.trim().toUpperCase().replace(/\s+/g, " ");
}
/**
 * Whether a typed number could be a membership number at all: letters, digits and the separators PSF
 * prints (`/`, `-`, a space), at least four characters, and at least two digits. It refuses "PSF-" and
 * other half-typed values; it cannot tell a real number from a made-up one, which is PSF's to confirm.
 */
function looksLikePsfNumber(raw) {
    const n = normalizePsfNumber(raw);
    return n.length >= 4 && n.length <= 40 && /^[A-Z0-9][A-Z0-9/ -]*[A-Z0-9]$/.test(n) && (n.match(/\d/g)?.length ?? 0) >= 2;
}
/** One claim, for the PSF District Manager deciding it. */
exports.PsfMembershipClaim = zod_1.z.object({
    id: zod_1.z.string(),
    orgId: zod_1.z.string(),
    legalName: zod_1.z.string(),
    businessCode: zod_1.z.string().nullable(),
    tin: zod_1.z.string().nullable(),
    districtName: zod_1.z.string().nullable(),
    /** The OLD number it typed from its card, when it did; null when it sent the card alone (2026-11-02). */
    membershipNumber: zod_1.z.string().nullable(),
    /** The next number in its district's run (2026-11-02): every card holder gets a new one. */
    suggestedMembershipNumber: zod_1.z.string().nullable().default(null),
    status: exports.PsfClaimStatus,
    claimedAt: zod_1.z.string(),
    claimedByName: zod_1.z.string().nullable(),
    decidedAt: zod_1.z.string().nullable(),
    decidedByName: zod_1.z.string().nullable(),
    decisionNote: zod_1.z.string().nullable(),
    matchedBy: zod_1.z.enum(["member_list", "officer"]).nullable(),
    /** What PSF's own list says about this number, when it holds it. */
    listed: zod_1.z
        .object({
        legalName: zod_1.z.string().nullable(),
        tin: zod_1.z.string().nullable(),
        tierCode: zod_1.z.string().nullable(),
        expiresOn: zod_1.z.string().nullable(),
        tinMatches: zod_1.z.boolean(),
    })
        .nullable(),
});
exports.PsfClaimsQuery = zod_1.z.object({ status: exports.PsfClaimStatus.optional() });
exports.PsfClaimsPage = zod_1.z.object({
    items: zod_1.z.array(exports.PsfMembershipClaim),
    counts: zod_1.z.object({ claimed: zod_1.z.number().int(), confirmed: zod_1.z.number().int(), rejected: zod_1.z.number().int() }),
    list: zod_1.z.object({ rows: zod_1.z.number().int(), uploadedAt: zod_1.z.string().nullable() }),
});
const isoDay = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-mm-dd.");
/** Confirm a claim: the tier and the dates PSF's records give. */
exports.ConfirmPsfClaimRequest = zod_1.z
    .object({
    tierCode: zod_1.z.string().min(1),
    startsOn: isoDay,
    expiresOn: isoDay,
    note: zod_1.z.string().trim().max(500).optional(),
    /**
     * The NEW number PSF gives the card holder in the new module (2026-11-02, the owner's decision):
     * every card holder gets one, whatever its old card shows. The dialog suggests the district's next.
     */
    membershipNumber: zod_1.z.string().trim().min(1, "Give the new membership number.").max(40),
})
    .refine((v) => v.expiresOn > v.startsOn, { path: ["expiresOn"], message: "The membership ends after it starts." });
/** Reject a claim, with the reason the business is told. */
exports.RejectPsfClaimRequest = zod_1.z.object({ reason: zod_1.z.string().trim().min(3, "Say why, for the business.").max(500) });
/** PSF's member list, as rows read from its spreadsheet. A number already listed is replaced. */
exports.PsfMemberListRow = zod_1.z.object({
    membershipNumber: zod_1.z.string().trim().min(1).max(60),
    legalName: zod_1.z.string().trim().max(200).nullable().optional(),
    tin: zod_1.z.string().trim().max(20).nullable().optional(),
    tierCode: zod_1.z.string().trim().max(60).nullable().optional(),
    startsOn: isoDay.nullable().optional(),
    expiresOn: isoDay.nullable().optional(),
});
exports.UploadPsfMemberListRequest = zod_1.z.object({ rows: zod_1.z.array(exports.PsfMemberListRow).min(1).max(20000) });
/** What an upload did: rows kept, and the claims it confirmed on the way. */
exports.PsfMemberListResult = zod_1.z.object({ rows: zod_1.z.number().int(), confirmedClaims: zod_1.z.number().int(), skipped: zod_1.z.array(zod_1.z.string()) });
//# sourceMappingURL=psf.js.map