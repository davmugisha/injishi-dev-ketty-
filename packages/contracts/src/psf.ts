import { z } from "zod";
import { Domain, OrgRegistrationStatus, OrgRole, OversightRole, OversightScopeLevel, RwfAmount, Uuid } from "./primitives";
import { ACCOMMODATION_CLASS_LABEL } from "./rdb";
import { EnterpriseRegistrationKind, OversightDecisionQuery, PsfApplicationInput, PsfCompanyType, PsfContactRole, PsfOwnerGroup, PsfOwnership, PsfTradeDirection } from "./registration";
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
export const PsfMembershipFamily = z.enum(["golden_circle", "indashyikirwa", "indatwa", "ordinary", "junior_giants"]);
export type PsfMembershipFamily = z.infer<typeof PsfMembershipFamily>;
/**
 * A fixed amount, a min to max band, a floor with no ceiling (`minimum`, which
 * is Golden Circle's 5,000,000 and up), or a price only PSF can quote.
 */
export const PsfPriceKind = z.enum(["fixed", "range", "minimum", "set_by_psf"]);
export type PsfPriceKind = z.infer<typeof PsfPriceKind>;
/**
 * `submitted` waits on PSF, `approved` waits on the business's payment; both
 * are open. The other three are terminal.
 */
export const PsfApplicationStatus = z.enum(["submitted", "approved", "member", "declined", "withdrawn"]);
export type PsfApplicationStatus = z.infer<typeof PsfApplicationStatus>;
/** The statuses an application is still open in: one per business at a time. */
export const PSF_OPEN_APPLICATION_STATUSES: readonly PsfApplicationStatus[] = ["submitted", "approved"];
export const PsfSubmittedCapacity = z.enum(["owner", "on_behalf_of"]);
export type PsfSubmittedCapacity = z.infer<typeof PsfSubmittedCapacity>;
export const PsfDeclineReason = z.enum([
    "details_incomplete",
    "not_eligible_for_tier",
    "business_not_recognised",
    "other",
]);
export type PsfDeclineReason = z.infer<typeof PsfDeclineReason>;
export const PsfMembershipSource = z.enum(["psf_confirmed", "self_declared"]);
export type PsfMembershipSource = z.infer<typeof PsfMembershipSource>;
/**
 * Where an open application stands, as the business reads it. Derived on the
 * server from the application and the business's registration status
 * (ADR-056 AC-8), never stored.
 */
export const PsfApplicationStage = z.enum(["waiting_tin_check", "with_psf", "awaiting_payment"]);
export type PsfApplicationStage = z.infer<typeof PsfApplicationStage>;
/**
 * The registration states in which an open application sits in PSF's queue
 * (ADR-056 AC-8): the TIN has passed and the business is in good standing.
 * Anywhere else it waits, unchanged, and returns when the business does.
 */
export const PSF_QUEUE_REGISTRATION_STATES: readonly OrgRegistrationStatus[] = [
    "tin_verified",
    "field_verified",
    "approved",
    "active",
];
export function isInPsfQueueState(status: OrgRegistrationStatus): boolean {
    return PSF_QUEUE_REGISTRATION_STATES.includes(status);
}
// ---------------------------------------------------------------------------
// Who may apply for a business (ADR-056, "the applicant")
// ---------------------------------------------------------------------------
/** The domains that may hold a PSF membership through Injishi. A residence may not. */
export const PSF_DOMAINS: readonly Domain[] = ["hospitality", "enterprise"];
/** The facts the applicant rule reads, all from the server's own rows. */
export interface PsfApplicantFacts {
    userId: string;
    domain: Domain | null;
    /** The caller's role in the business, from an ACTIVE membership only. */
    orgRole: OrgRole | null;
    /** The business's on behalf registration, when it has one. */
    obo: {
        registrantUserId: string;
        claimStatus: "registrant_held" | "owner_claimed" | "expired";
    } | null;
}
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
export function isPsfApplicant(facts: PsfApplicantFacts): boolean {
    if (facts.domain === null || !PSF_DOMAINS.includes(facts.domain))
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
export const PSF_FAMILY_LABEL: Readonly<Record<PsfMembershipFamily, string>> = {
    golden_circle: "Golden Circle",
    indashyikirwa: "Indashyikirwa",
    indatwa: "Indatwa",
    ordinary: "Ordinary",
    junior_giants: "Junior Giants",
};
/** One line on who each family is for, as the tier picker introduces it. */
export const PSF_FAMILY_BLURB: Readonly<Record<PsfMembershipFamily, string>> = {
    golden_circle: "For large companies and major investors.",
    indashyikirwa: "For established businesses leading their sector.",
    indatwa: "For small and growing businesses. Pick the band you can afford.",
    ordinary: "Retired.",
    junior_giants: "Retired.",
};
/** The families a business can still pick, in the order PSF ranks them. */
export const PSF_OFFERED_FAMILIES: readonly PsfMembershipFamily[] = ["golden_circle", "indashyikirwa", "indatwa"];
export const PSF_APPLICATION_STATUS_LABEL: Readonly<Record<PsfApplicationStatus, string>> = {
    submitted: "With PSF",
    approved: "Approved, to pay",
    member: "Member",
    declined: "Declined",
    withdrawn: "Withdrawn",
};
export const PSF_APPLICATION_STAGE_LABEL: Readonly<Record<PsfApplicationStage, string>> = {
    waiting_tin_check: "Waiting for your TIN check",
    with_psf: "With PSF",
    awaiting_payment: "Approved, waiting for your payment",
};
export const PSF_DECLINE_REASON_LABEL: Readonly<Record<PsfDeclineReason, string>> = {
    details_incomplete: "Details incomplete",
    not_eligible_for_tier: "Not eligible for this tier",
    business_not_recognised: "Business not recognised",
    other: "Other",
};
export const PSF_MEMBERSHIP_SOURCE_LABEL: Readonly<Record<PsfMembershipSource, string>> = {
    psf_confirmed: "Confirmed by PSF",
    self_declared: "Declared at registration",
};
export const PSF_COMPANY_TYPE_LABEL: Readonly<Record<PsfCompanyType, string>> = {
    cooperative: "Cooperative",
    ngo: "NGO",
    partly_state_owned: "Partly state owned",
    private_company: "Private company",
    public_company: "Public company",
    sole_trader: "Sole trader",
};
export const PSF_OWNERSHIP_LABEL: Readonly<Record<PsfOwnership, string>> = {
    foreign_100: "100% foreign owned",
    rwandan_100: "100% Rwandan owned",
    franchise: "Franchise",
    joint_venture: "Joint venture",
    foreign_representative: "Representative of a foreign company",
    other: "Other",
};
export const PSF_TRADE_DIRECTION_LABEL: Readonly<Record<PsfTradeDirection, string>> = {
    none: "No",
    export: "Export",
    import: "Import",
    both: "Both",
};
export const PSF_CONTACT_ROLE_LABEL: Readonly<Record<PsfContactRole, string>> = {
    owner: "Owner",
    managing_director: "Managing director",
    ceo: "CEO",
    chairman: "Chairman or president",
};
export const PSF_OWNER_GROUP_LABEL: Readonly<Record<PsfOwnerGroup, string>> = {
    women: "Women owned",
    youth: "Youth owned",
    pwd: "Owned by a person with a disability",
};
/** The same groups, short, for a chip or a filter. */
export const PSF_OWNER_GROUP_SHORT: Readonly<Record<PsfOwnerGroup, string>> = {
    women: "Women",
    youth: "Youth",
    pwd: "PWD",
};
export const ENTERPRISE_REGISTRATION_KIND_LABEL: Readonly<Record<EnterpriseRegistrationKind, string>> = {
    tin: "RRA TIN",
    rca: "Cooperative, registered with RCA",
    rgb: "NGO, registered with RGB",
    other: "Another registration",
    none: "Not registered yet",
};
/** The same kinds, as a filed form names its registration: `TIN 123456789`. */
export const REGISTRATION_TYPE_SHORT: Readonly<Record<string, string>> = {
    tin: "TIN",
    rca: "RCA",
    rgb: "RGB",
    other: "Registration",
    none: "Not registered",
};
/** What the business is told about the fee, wherever it picks a tier (AC-2). */
export const PSF_FEE_NOTICE = "Once PSF approves you, you pay the membership fee here by mobile money. It goes to PSF; Injishi keeps none of it.";
export const PSF_OPEN_APPLICATION_MESSAGE = "This business already has an open application with PSF. Withdraw it before sending another.";
export const PSF_NOT_OPEN_MESSAGE = "This application has already been decided or withdrawn.";
export const PSF_NOT_PAYABLE_MESSAGE = "This application is not waiting for a payment.";
export const PSF_OWN_BUSINESS_MESSAGE = "You hold a role in this business, so another PSF officer must decide its application.";
/**
 * Only a PSF District Manager approves or declines (2026-10-23), and only in
 * their own district: the application for its head office's, a branch for the
 * branch's. Province and national managers read everything for reporting.
 */
export const PSF_DISTRICT_DECIDES_MESSAGE = "Only the PSF District Manager of its district approves or declines. Province and national managers see it for reporting.";
export const PSF_NOT_FOR_RESIDENCE_MESSAGE = "PSF membership through Injishi is for businesses, not for residences let on a lease.";
export const PSF_OUT_OF_SCOPE_MESSAGE = "This business is outside the region you cover.";
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
export const OVERSIGHT_ROLE_POSTING: Readonly<Partial<Record<OversightRole, {
    governmentBodyCode: string;
    scopeLevels: readonly OversightScopeLevel[];
    message: string;
}>>> = {
    psf_membership_officer: {
        governmentBodyCode: "PSF",
        scopeLevels: ["country", "province", "district"],
        message: "A PSF District Manager is appointed at PSF.",
    },
};
// ---------------------------------------------------------------------------
// The tier catalogue
// ---------------------------------------------------------------------------
export const PsfTier = z.object({
    code: z.string(),
    family: PsfMembershipFamily,
    nameEn: z.string(),
    nameRw: z.string().nullable(),
    priceKind: PsfPriceKind,
    annualFeeRwf: RwfAmount.nullable(),
    annualFeeMinRwf: RwfAmount.nullable(),
    annualFeeMaxRwf: RwfAmount.nullable(),
    benefitsEn: z.array(z.string()),
    benefitsRw: z.array(z.string()).nullable(),
    sortOrder: z.number().int(),
    active: z.boolean(),
});
export type PsfTier = z.infer<typeof PsfTier>;
const tierPriceShape = (value: {
    priceKind: PsfPriceKind;
    annualFeeRwf?: number | null;
    annualFeeMinRwf?: number | null;
    annualFeeMaxRwf?: number | null;
}, ctx: z.RefinementCtx) => {
    const fee = value.annualFeeRwf ?? null;
    const min = value.annualFeeMinRwf ?? null;
    const max = value.annualFeeMaxRwf ?? null;
    // Mirrors `psf_membership_tiers_price_shape`.
    if (value.priceKind === "fixed" && (fee === null || fee <= 0 || min !== null || max !== null)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["annualFeeRwf"], message: "A fixed price needs one amount above zero, and no range." });
    }
    if (value.priceKind === "range" && (fee !== null || min === null || max === null || min <= 0 || min >= max)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["annualFeeMinRwf"], message: "A range needs a lowest and a highest amount, lowest first." });
    }
    if (value.priceKind === "minimum" && (fee !== null || min === null || min <= 0 || max !== null)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["annualFeeMinRwf"], message: "A price from an amount up needs that lowest amount, and no highest." });
    }
    if (value.priceKind === "set_by_psf" && (fee !== null || min !== null || max !== null)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["priceKind"], message: "A price set by PSF carries no amount." });
    }
};
const tierFields = {
    family: PsfMembershipFamily,
    nameEn: z.string().trim().min(1, "Give the tier a name.").max(80),
    nameRw: z.string().trim().min(1).max(80).nullable().optional(),
    priceKind: PsfPriceKind,
    annualFeeRwf: RwfAmount.nullable().optional(),
    annualFeeMinRwf: RwfAmount.nullable().optional(),
    annualFeeMaxRwf: RwfAmount.nullable().optional(),
    benefitsEn: z.array(z.string().trim().min(1).max(400)).max(30).default([]),
    benefitsRw: z.array(z.string().trim().min(1).max(400)).max(30).nullable().optional(),
    sortOrder: z.number().int().min(0).max(999),
    active: z.boolean().default(true),
    /** Why, for the audit row every admin write records. */
    reason: z.string().trim().min(3, "Say why, for the audit record.").max(500),
};
/** Admin adds a tier (AC-19). The code is permanent: applications name it. */
export const CreatePsfTierRequest = z
    .object({
    code: z
        .string()
        .trim()
        .regex(/^[a-z][a-z0-9_]{1,59}$/, "Use lower case letters, digits and underscores, like indatwa_10k."),
    ...tierFields,
})
    .superRefine(tierPriceShape);
export type CreatePsfTierRequest = z.infer<typeof CreatePsfTierRequest>;
/**
 * Admin edits a tier. The whole price travels together, because the three
 * price columns are only meaningful as a set.
 */
export const UpdatePsfTierRequest = z.object(tierFields).superRefine(tierPriceShape);
export type UpdatePsfTierRequest = z.infer<typeof UpdatePsfTierRequest>;
/** The price columns of a tier, or of an application's quote of one. */
export interface PsfPrice {
    priceKind: PsfPriceKind;
    annualFeeRwf: number | null;
    annualFeeMinRwf: number | null;
    annualFeeMaxRwf: number | null;
}
/**
 * Does this tier take this yearly amount?
 *
 * A business pays what it can afford inside its band, so the amount it names
 * is checked here, the one rule the apply form and the server both read:
 * a fixed tier takes its price, a band anything inside it, a floor anything
 * from it up. A tier PSF prices itself takes no amount from the business:
 * the officer names it on approval.
 */
export function psfTierAcceptsFee(tier: PsfPrice, amountRwf: number | null | undefined): boolean {
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
export function psfFeeProblem(tier: PsfPrice, amountRwf: number | null | undefined): string | null {
    if (psfTierAcceptsFee(tier, amountRwf))
        return null;
    const rwf = (n: number | null) => `RWF ${(n ?? 0).toLocaleString("en-US")}`;
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
export function psfStartingFee(tier: PsfPrice): number | null {
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
export const PsfAssociation = z.object({
    code: z.string(),
    clusterCode: z.string(),
    nameEn: z.string(),
    acronym: z.string().nullable(),
    sortOrder: z.number().int(),
    active: z.boolean(),
});
export type PsfAssociation = z.infer<typeof PsfAssociation>;
/**
 * A sector's subtype (2026-10-20): Hospitality, Tourism, Transport under
 * Services. National when `districtId` is null; otherwise offered only in
 * that district. `associationCodes` are the associations the form offers
 * once it is picked.
 */
export const PsfSubsector = z.object({
    id: Uuid,
    clusterCode: z.string(),
    nameEn: z.string(),
    districtId: z.number().int().nullable(),
    districtName: z.string().nullable(),
    sortOrder: z.number().int(),
    active: z.boolean(),
    associationCodes: z.array(z.string()),
});
export type PsfSubsector = z.infer<typeof PsfSubsector>;
export const PsfCluster = z.object({
    code: z.string(),
    nameEn: z.string(),
    nameRw: z.string().nullable(),
    /** One line on what kind of business belongs here. */
    description: z.string().nullable(),
    sortOrder: z.number().int(),
    active: z.boolean(),
    associations: z.array(PsfAssociation),
    /** National subtypes, and the district's own when the catalogue was asked for one. */
    subsectors: z.array(PsfSubsector).default([]),
});
export type PsfCluster = z.infer<typeof PsfCluster>;
/** `GET /psf/catalogue?district=`: the clusters in order, each with its associations and subtypes. */
export const PsfCatalogue = z.object({ clusters: z.array(PsfCluster) });
export type PsfCatalogue = z.infer<typeof PsfCatalogue>;
const catalogueCode = z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{1,59}$/, "Use lower case letters, digits and underscores, like industry.");
const auditReason = z.string().trim().min(3, "Say why, for the audit record.").max(500);
export const UpsertPsfClusterRequest = z.object({
    nameEn: z.string().trim().min(1, "Give the cluster a name.").max(80),
    nameRw: z.string().trim().min(1).max(80).nullable().optional(),
    description: z.string().trim().max(240).nullable().optional(),
    sortOrder: z.number().int().min(0).max(999),
    active: z.boolean().default(true),
    reason: auditReason,
});
export type UpsertPsfClusterRequest = z.infer<typeof UpsertPsfClusterRequest>;
export const CreatePsfClusterRequest = UpsertPsfClusterRequest.extend({ code: catalogueCode });
export type CreatePsfClusterRequest = z.infer<typeof CreatePsfClusterRequest>;
export const UpsertPsfAssociationRequest = z.object({
    clusterCode: z.string().trim().min(1, "Pick the cluster."),
    nameEn: z.string().trim().min(1, "Give the association a name.").max(160),
    acronym: z.string().trim().min(1).max(24).nullable().optional(),
    sortOrder: z.number().int().min(0).max(999),
    active: z.boolean().default(true),
    reason: auditReason,
});
export type UpsertPsfAssociationRequest = z.infer<typeof UpsertPsfAssociationRequest>;
export const CreatePsfAssociationRequest = UpsertPsfAssociationRequest.extend({ code: catalogueCode });
export type CreatePsfAssociationRequest = z.infer<typeof CreatePsfAssociationRequest>;
// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
export const PsfMembership = z.object({
    id: Uuid,
    source: PsfMembershipSource,
    tierCode: z.string().nullable(),
    tierName: z.string().nullable(),
    membershipNumber: z.string(),
    annualFeeRwf: RwfAmount.nullable(),
    startsOn: z.string().nullable(),
    expiresOn: z.string().nullable(),
    endedAt: z.string().nullable(),
});
export type PsfMembership = z.infer<typeof PsfMembership>;
/** The form as filed. Read by the business that sent it and the officer. */
export const PsfFiledForm = z.object({
    companyName: z.string(),
    /** `tin`, `rca`, `rgb`, `other` or `none` (see `REGISTRATION_TYPE_SHORT`). */
    registrationType: z.string(),
    /** Null for a business registered nowhere yet. */
    registrationNumber: z.string().nullable(),
    website: z.string().nullable(),
    streetAddress: z.string(),
    companyType: PsfCompanyType,
    ownership: PsfOwnership,
    ownershipOther: z.string().nullable(),
    businessActivity: z.string(),
    tradeDirection: PsfTradeDirection,
    tradeGoods: z.string().nullable(),
    tradeCountries: z.array(z.string()),
    contactRole: PsfContactRole,
    firstName: z.string(),
    lastName: z.string(),
    gender: z.enum(["male", "female"]),
    phoneE164: z.string(),
    email: z.string(),
    idDocumentType: z.enum(["national_id", "passport"]),
    idDocumentNumber: z.string(),
    dateOfBirth: z.string(),
});
export type PsfFiledForm = z.infer<typeof PsfFiledForm>;
/** The payment that made an approved application a membership. */
export const PsfPayment = z.object({
    paidAt: z.string(),
    amountRwf: RwfAmount,
    /** The provider's own reference, which a receipt quotes. */
    reference: z.string(),
    /** Whether Injishi has passed the money on to PSF yet. */
    remittedAt: z.string().nullable(),
});
export type PsfPayment = z.infer<typeof PsfPayment>;
export const PsfApplication = z.object({
    id: Uuid,
    status: PsfApplicationStatus,
    requestedTierCode: z.string(),
    requestedTierName: z.string(),
    quotedPriceKind: PsfPriceKind,
    quotedFeeRwf: RwfAmount.nullable(),
    quotedFeeMinRwf: RwfAmount.nullable(),
    quotedFeeMaxRwf: RwfAmount.nullable(),
    /** What the business said it would pay a year. Null for a tier PSF prices. */
    declaredFeeRwf: RwfAmount.nullable(),
    submittedAt: z.string(),
    submittedCapacity: PsfSubmittedCapacity,
    /** Named so an owner can see an application sent on their behalf (AC-17). */
    submittedByName: z.string().nullable(),
    queuedAt: z.string().nullable(),
    decidedAt: z.string().nullable(),
    declineReason: PsfDeclineReason.nullable(),
    decisionNote: z.string().nullable(),
    /** Set on approval: the number PSF gave, and what the business now owes. */
    approvedMembershipNumber: z.string().nullable(),
    approvedFeeRwf: RwfAmount.nullable(),
    payment: PsfPayment.nullable(),
    withdrawnAt: z.string().nullable(),
    form: PsfFiledForm,
});
export type PsfApplication = z.infer<typeof PsfApplication>;
/**
 * What the apply form starts from in the workspace (ADR-056 value sourcing):
 * the business row, the person's profile, and the last application sent.
 * Every field optional, because a first application from an on behalf agent
 * knows little about the owner.
 */
export const PsfApplicationPrefill = z.object({
    companyName: z.string().optional(),
    streetAddress: z.string().optional(),
    businessActivity: z.string().optional(),
    website: z.string().optional(),
    companyType: PsfCompanyType.optional(),
    ownership: PsfOwnership.optional(),
    ownershipOther: z.string().optional(),
    tradeDirection: PsfTradeDirection.optional(),
    tradeGoods: z.string().optional(),
    tradeCountries: z.array(z.string()).optional(),
    contactRole: PsfContactRole.optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    gender: z.enum(["male", "female"]).optional(),
    phoneE164: z.string().optional(),
    email: z.string().optional(),
    idDocumentType: z.enum(["national_id", "passport"]).optional(),
    idDocumentNumber: z.string().optional(),
    dateOfBirth: z.string().optional(),
});
export type PsfApplicationPrefill = z.infer<typeof PsfApplicationPrefill>;
/** The business as PSF sees it: its code, its sector and who owns it. */
export const PsfBusinessProfile = z.object({
    domain: Domain,
    businessCode: z.string().nullable(),
    districtName: z.string().nullable(),
    clusterName: z.string().nullable(),
    /** The subtype picked, or the one the business typed. */
    subsectorName: z.string().nullable().default(null),
    associationName: z.string().nullable(),
    ownerGroups: z.array(PsfOwnerGroup),
    registrationKind: EnterpriseRegistrationKind.nullable(),
});
export type PsfBusinessProfile = z.infer<typeof PsfBusinessProfile>;
/** `GET /orgs/:orgId/psf-membership` (AC-15). */
export const PsfMembershipOverview = z.object({
    orgId: Uuid,
    /**
     * The registration PSF's form is filed under; not editable (AC-3). A TIN
     * for a hotel, whatever the business registered with on the PSF path, and
     * empty for a PSF business registered nowhere yet.
     */
    registrationNumber: z.string(),
    profile: PsfBusinessProfile,
    current: PsfMembership.nullable(),
    open: PsfApplication.extend({ stage: PsfApplicationStage }).nullable(),
    /** Decided and withdrawn applications, newest first. */
    history: z.array(PsfApplication),
    canApply: z.boolean(),
    prefill: PsfApplicationPrefill,
});
export type PsfMembershipOverview = z.infer<typeof PsfMembershipOverview>;
/**
 * One application as the admin business detail lists it (AC-20): its state,
 * tier and decision, WITHOUT the filed form. The form carries an ID number and
 * a date of birth, and the business detail is a read that asks for no reason.
 */
export const AdminPsfApplication = PsfApplication.omit({ form: true });
export type AdminPsfApplication = z.infer<typeof AdminPsfApplication>;
/** The PSF section of the admin business detail (AC-20). */
export const AdminOrgPsf = z.object({
    membership: PsfMembership.nullable(),
    applications: z.array(AdminPsfApplication),
});
export type AdminOrgPsf = z.infer<typeof AdminOrgPsf>;
/** `POST /orgs/:orgId/psf-applications` (AC-16). */
export const CreatePsfApplicationRequest = PsfApplicationInput;
export type CreatePsfApplicationRequest = z.infer<typeof CreatePsfApplicationRequest>;
/**
 * `POST /orgs/:orgId/psf-applications/:id/pay`: pay an approved application's
 * fee by mobile money. The number the prompt goes to; the amount is the one on
 * the approval, never the request's.
 */
export const PayPsfMembershipRequest = z.object({
    phoneE164: z
        .string()
        .trim()
        .transform((v) => v.replace(/[\s-]/g, ""))
        .pipe(z.string().regex(/^\+2507\d{8}$/, "Give a Rwandan mobile money number, like +250788123456.")),
});
export type PayPsfMembershipRequest = z.infer<typeof PayPsfMembershipRequest>;
// ---------------------------------------------------------------------------
// The officer's side (AC-10 to AC-14)
// ---------------------------------------------------------------------------
/**
 * A BRANCH of a business that applied through the public form (2026-10-23):
 * another place it trades from. Each is admitted by the PSF officer of the
 * branch's own district, beside the head office's decision on the business,
 * so a business in Kicukiro with a shop in Musanze is seen in both offices.
 */
export const PsfBranchStatus = z.enum(["pending", "admitted", "declined"]);
export type PsfBranchStatus = z.infer<typeof PsfBranchStatus>;
export const PSF_BRANCH_STATUS_LABEL: Readonly<Record<PsfBranchStatus, string>> = {
    pending: "Waiting on PSF",
    admitted: "Admitted",
    declined: "Declined",
};
/** A branch trades under the business's own name, so it is told apart by where it is. */
export const PsfApplicationBranch = z.object({
    id: Uuid,
    districtId: z.number().int(),
    districtName: z.string().nullable(),
    sectorName: z.string().nullable(),
    street: z.string(),
    status: PsfBranchStatus,
    note: z.string().nullable(),
    decidedAt: z.string().nullable(),
    /** True when this officer covers the branch's district, it waits on PSF, and they hold no stake. */
    canDecide: z.boolean(),
});
export type PsfApplicationBranch = z.infer<typeof PsfApplicationBranch>;
/** Admitting or declining one branch. A decline says why, so the business knows. */
export const PsfBranchDecisionRequest = z
    .object({
    decision: z.enum(["admit", "decline"]),
    note: z.string().trim().min(1).max(1000).optional(),
})
    .superRefine((value, ctx) => {
    if (value.decision === "decline" && !value.note) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["note"], message: "Say why, so the business knows what to fix." });
    }
});
export type PsfBranchDecisionRequest = z.infer<typeof PsfBranchDecisionRequest>;
export const PsfQueueItem = z.object({
    applicationId: Uuid,
    orgId: Uuid,
    businessName: z.string(),
    businessCode: z.string().nullable(),
    domain: Domain,
    districtName: z.string().nullable(),
    associationName: z.string().nullable(),
    subsectorName: z.string().nullable().default(null),
    ownerGroups: z.array(PsfOwnerGroup),
    requestedTierName: z.string(),
    declaredFeeRwf: RwfAmount.nullable(),
    submittedAt: z.string(),
    queuedAt: z.string().nullable(),
    registrationStatus: OrgRegistrationStatus,
    /** False when the officer holds a stake in the business (AC-14). */
    canDecide: z.boolean(),
    districtId: z.number().int().nullable(),
    /** Whole days since it reached the queue. */
    waitingDays: z.number().int(),
    /** The docID a public applicant tracks it by; null for a hotel's. */
    docId: z.string().nullable(),
    clusterName: z.string().nullable().default(null),
    /** What the business already paid for its membership, when it paid before review. */
    paidRwf: RwfAmount.nullable().default(null),
    /**
     * False when the officer is here only for a branch: the head office is in
     * another district, whose officer decides the business itself.
     */
    headOfficeInScope: z.boolean().default(true),
    /** Branches in this officer's region still waiting on PSF. */
    branchesPending: z.number().int().default(0),
    /**
     * Whether this officer is the one who decides it (2026-10-23): the PSF
     * District Manager of its district. A province or national manager reads
     * the queue for reporting and never decides.
     */
    decidesHere: z.boolean().default(true),
});
export type PsfQueueItem = z.infer<typeof PsfQueueItem>;
export const PsfQueuePage = z.object({
    items: PsfQueueItem.array(),
    nextCursor: z.string().nullable(),
    /** How many match the filters, across every page. */
    total: z.number().int().default(0),
});
export type PsfQueuePage = z.infer<typeof PsfQueuePage>;
/** The same cursor shape the officer's decision log pages by. */
export const PsfQueueQuery = OversightDecisionQuery;
export type PsfQueueQuery = z.infer<typeof PsfQueueQuery>;
export const PsfOfficerApplication = PsfApplication.extend({
    orgId: Uuid,
    businessName: z.string(),
    districtName: z.string().nullable(),
    registrationStatus: OrgRegistrationStatus,
    profile: PsfBusinessProfile,
    canDecide: z.boolean(),
    docId: z.string().nullable(),
    waitingDays: z.number().int(),
    /** The next number in this district's run for this year, for the approve dialog. */
    suggestedMembershipNumber: z.string().nullable(),
    /**
     * Paid before review (the public path, 2026-10-20): approving makes the
     * business a member at once. Declining keeps the fee: nothing is refunded
     * (2026-10-23).
     */
    paidBeforeReview: z.boolean().default(false),
    /** False when the officer reads it only for a branch in their district. */
    headOfficeInScope: z.boolean().default(true),
    branches: PsfApplicationBranch.array().default([]),
    /** The officer is the District Manager who decides the business (2026-10-23); see `PsfQueueItem.decidesHere`. */
    decidesHere: z.boolean().default(true),
});
export type PsfOfficerApplication = z.infer<typeof PsfOfficerApplication>;
/**
 * Approving an application (AC-11, as the PSF path changed it). PSF gives the
 * membership number now; the membership itself starts when the business pays.
 * The fee is the business's own declared amount, so the officer names one only
 * for a tier PSF prices itself.
 */
export const PsfApproveRequest = z.object({
    membershipNumber: z.string().trim().min(1, "Give the PSF membership number.").max(40),
    feeRwf: RwfAmount.refine((n) => n > 0, "Give the annual fee PSF charges.").optional(),
    note: z.string().trim().min(1).max(1000).optional(),
});
export type PsfApproveRequest = z.infer<typeof PsfApproveRequest>;
/** Declining an application (AC-12). A note is required with `other`. */
export const PsfDeclineRequest = z
    .object({
    reason: PsfDeclineReason,
    note: z.string().trim().min(1).max(1000).optional(),
})
    .superRefine((value, ctx) => {
    if (value.reason === "other" && !value.note) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["note"], message: "Say why, so the business knows what to fix." });
    }
});
export type PsfDeclineRequest = z.infer<typeof PsfDeclineRequest>;
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
export const PsfStanding = z.enum(["not_applied", "applied", "awaiting_payment", "member", "lapsed", "declined"]);
export type PsfStanding = z.infer<typeof PsfStanding>;
export const PSF_STANDING_LABEL: Readonly<Record<PsfStanding, string>> = {
    not_applied: "Not applied",
    applied: "Applied",
    awaiting_payment: "Approved, to pay",
    member: "Member",
    lapsed: "Lapsed",
    declined: "Declined",
};
/** The registers a business may be listed under: the PSF path, a hotel, or both. */
export const PsfBusinessKind = z.enum(["enterprise", "hospitality"]);
export type PsfBusinessKind = z.infer<typeof PsfBusinessKind>;
const optionalText = (max: number) => z.string().trim().min(1).max(max).optional();
/**
 * `GET /oversight/psf/businesses`. Every filter optional; together they narrow.
 * `district` must sit inside the officer's own region, or the list is empty.
 */
export const PsfBusinessesQuery = z.object({
    q: optionalText(80),
    subsector: Uuid.optional(),
    district: z.coerce.number().int().positive().optional(),
    /** Narrow to one province of the officer's region (the province and national views). */
    province: z.coerce.number().int().positive().optional(),
    cluster: optionalText(60),
    association: optionalText(60),
    tier: optionalText(60),
    standing: PsfStanding.optional(),
    group: PsfOwnerGroup.optional(),
    tin: z.enum(["with", "without"]).optional(),
    kind: PsfBusinessKind.optional(),
    cursor: z.string().max(200).optional(),
});
export type PsfBusinessesQuery = z.infer<typeof PsfBusinessesQuery>;
export const PsfBusinessRow = z.object({
    orgId: Uuid,
    businessCode: z.string().nullable(),
    legalName: z.string(),
    domain: Domain,
    districtId: z.number().int().nullable(),
    districtName: z.string().nullable(),
    sectorName: z.string().nullable(),
    clusterCode: z.string().nullable(),
    clusterName: z.string().nullable(),
    subsectorName: z.string().nullable().default(null),
    associationName: z.string().nullable(),
    associationAcronym: z.string().nullable(),
    ownerGroups: z.array(PsfOwnerGroup),
    registrationKind: EnterpriseRegistrationKind.nullable(),
    hasTin: z.boolean(),
    registeredAt: z.string(),
    standing: PsfStanding,
    tierName: z.string().nullable(),
    membershipNumber: z.string().nullable(),
    expiresOn: z.string().nullable(),
    /** The open application, when there is one, so the row can open it. */
    openApplicationId: Uuid.nullable(),
    /** Paid in through Injishi: membership fees, and any registration fee. */
    paidRwf: RwfAmount.default(0),
    lastPaidAt: z.string().nullable().default(null),
    /** Its branches (2026-10-23): the other places it trades from, on its newest application. */
    branchCount: z.number().int().default(0),
    /**
     * False when the officer sees it only because a branch is in their region:
     * its head office, and its decision, are another district's.
     */
    headOfficeInScope: z.boolean().default(true),
});
export type PsfBusinessRow = z.infer<typeof PsfBusinessRow>;
/** One branch on a business's page, wherever it is: every officer who opens the business sees them all. */
export const PsfBusinessBranch = z.object({
    id: Uuid,
    provinceName: z.string().nullable(),
    districtId: z.number().int(),
    districtName: z.string().nullable(),
    sectorName: z.string().nullable(),
    street: z.string(),
    status: PsfBranchStatus,
    note: z.string().nullable(),
    /** In the officer's own region: theirs to decide on the application. */
    inScope: z.boolean(),
});
export type PsfBusinessBranch = z.infer<typeof PsfBusinessBranch>;
export const PsfBusinessesPage = z.object({
    items: z.array(PsfBusinessRow),
    nextCursor: z.string().nullable(),
    /** How many businesses match the filters, across every page. */
    total: z.number().int(),
});
export type PsfBusinessesPage = z.infer<typeof PsfBusinessesPage>;
/** A count of businesses under one heading, for the register's summary. */
export const PsfCount = z.object({ key: z.string(), label: z.string(), count: z.number().int() });
export type PsfCount = z.infer<typeof PsfCount>;
/**
 * `GET /oversight/psf/summary`: the officer's region at a glance. Counted over
 * the officer's whole region, ignoring the register's other filters.
 */
export const PsfRegisterSummary = z.object({
    /** The region in words: "Rwanda", a province, or a district. */
    regionLabel: z.string(),
    total: z.number().int(),
    members: z.number().int(),
    waiting: z.number().int(),
    /** Fees paid this calendar year through Injishi, in RWF. */
    paidThisYearRwf: z.number().int(),
    byCluster: z.array(PsfCount),
    byStanding: z.array(PsfCount),
    byGroup: z.array(PsfCount),
    byDistrict: z.array(PsfCount.extend({ letters: z.string() })),
});
export type PsfRegisterSummary = z.infer<typeof PsfRegisterSummary>;
/**
 * The membership dates a payment starts from: the day it settled, and one
 * year later less a day (ADR-056 value sourcing). `today` is a yyyy-mm-dd date
 * in Africa/Kigali, which the caller resolves.
 */
export function defaultPsfMembershipDates(today: string): {
    startsOn: string;
    expiresOn: string;
} {
    const [y, m, d] = today.split("-").map(Number) as [number, number, number];
    const end = new Date(Date.UTC(y + 1, m - 1, d));
    end.setUTCDate(end.getUTCDate() - 1);
    return { startsOn: today, expiresOn: end.toISOString().slice(0, 10) };
}
/**
 * The business activity PSF's form starts from (ADR-056 value sourcing): the
 * accommodation class for a hotel, the association for a PSF business.
 * Editable wherever it shows.
 */
export function psfBusinessActivityFor(accommodationClass: string | null, accommodationClassOther: string | null, associationName: string | null = null): string {
    if (associationName)
        return associationName;
    if (accommodationClass === "other" && accommodationClassOther)
        return `Accommodation: ${accommodationClassOther}`;
    if (!accommodationClass)
        return "Accommodation";
    const label = (ACCOMMODATION_CLASS_LABEL as Readonly<Record<string, string>>)[accommodationClass] ??
        accommodationClass.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
    return `Accommodation: ${label}`;
}
/**
 * Split a full name into PSF's two fields at the last space (ADR-056). A
 * starting point the person corrects, never a rule trusted on its own:
 * Rwandan names do not reliably put the family name last.
 */
export function splitPsfName(fullName: string): {
    firstName: string;
    lastName: string;
} {
    const trimmed = fullName.trim().replace(/\s+/g, " ");
    const at = trimmed.lastIndexOf(" ");
    if (at <= 0)
        return { firstName: trimmed, lastName: "" };
    return { firstName: trimmed.slice(0, at), lastName: trimmed.slice(at + 1) };
}
/** `GET /oversight/psf/subsectors`: what the officer may read and change. */
export const PsfSubsectorsView = z.object({
    clusters: z.array(z.object({ code: z.string(), nameEn: z.string(), subsectors: z.array(PsfSubsector.extend({ canEdit: z.boolean() })) })),
    /** Where the officer may put a new subtype: null for national, or a district id. */
    places: z.array(z.object({ districtId: z.number().int().nullable(), label: z.string() })),
    associations: z.array(z.object({ code: z.string(), clusterCode: z.string(), nameEn: z.string() })),
});
export type PsfSubsectorsView = z.infer<typeof PsfSubsectorsView>;
/** Add a subtype. A national officer may add one for the country; any officer for a district they cover. */
export const CreatePsfSubsectorRequest = z.object({
    clusterCode: z.string().trim().min(1),
    nameEn: z.string().trim().min(2, "Give the subtype a name.").max(80),
    districtId: z.number().int().positive().nullable(),
    associationCodes: z.array(z.string().trim().min(1)).max(60).default([]),
});
export type CreatePsfSubsectorRequest = z.infer<typeof CreatePsfSubsectorRequest>;
export const UpdatePsfSubsectorRequest = z.object({
    nameEn: z.string().trim().min(2, "Give the subtype a name.").max(80).optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(999).optional(),
    associationCodes: z.array(z.string().trim().min(1)).max(60).optional(),
});
export type UpdatePsfSubsectorRequest = z.infer<typeof UpdatePsfSubsectorRequest>;
