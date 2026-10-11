import { z } from "zod";
import { Domain, OrgRegistrationStatus, OrgRole, OversightRole, OversightScopeLevel, RwfAmount, Uuid } from "./primitives";
import { ACCOMMODATION_CLASS_LABEL } from "./rdb";
import { OversightDecisionQuery, PsfApplicationInput, PsfCompanyType, PsfContactRole, PsfOwnership, PsfTradeDirection } from "./registration";
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
export const PsfMembershipFamily = z.enum(["golden_circle", "indashyikirwa", "ordinary", "junior_giants"]);
export type PsfMembershipFamily = z.infer<typeof PsfMembershipFamily>;
/** A fixed amount, a min to max range, or a price only PSF can quote. */
export const PsfPriceKind = z.enum(["fixed", "range", "set_by_psf"]);
export type PsfPriceKind = z.infer<typeof PsfPriceKind>;
/** `submitted` is the only open state; the other three are terminal. */
export const PsfApplicationStatus = z.enum(["submitted", "member", "declined", "withdrawn"]);
export type PsfApplicationStatus = z.infer<typeof PsfApplicationStatus>;
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
 * server from the business's registration status (ADR-056 AC-8), never stored.
 */
export const PsfApplicationStage = z.enum(["waiting_tin_check", "with_psf"]);
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
export function isPsfApplicant(facts: PsfApplicantFacts): boolean {
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
export const PSF_FAMILY_LABEL: Readonly<Record<PsfMembershipFamily, string>> = {
    golden_circle: "Golden Circle",
    indashyikirwa: "Indashyikirwa",
    ordinary: "Ordinary",
    junior_giants: "Junior Giants",
};
export const PSF_APPLICATION_STATUS_LABEL: Readonly<Record<PsfApplicationStatus, string>> = {
    submitted: "Sent",
    member: "Member",
    declined: "Declined",
    withdrawn: "Withdrawn",
};
export const PSF_APPLICATION_STAGE_LABEL: Readonly<Record<PsfApplicationStage, string>> = {
    waiting_tin_check: "Waiting for your TIN check",
    with_psf: "With PSF",
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
/** What the business is told about the fee, wherever it picks a tier (AC-2). */
export const PSF_FEE_NOTICE = "PSF invoices you directly for the membership fee. Injishi never takes this money.";
export const PSF_OPEN_APPLICATION_MESSAGE = "This business already has an application with PSF. Withdraw it before sending another.";
export const PSF_NOT_OPEN_MESSAGE = "This application has already been decided or withdrawn.";
export const PSF_OWN_BUSINESS_MESSAGE = "You hold a role in this business, so another PSF officer must decide its application.";
export const PSF_HOSPITALITY_ONLY_MESSAGE = "PSF membership through Injishi is for hospitality businesses.";
// ---------------------------------------------------------------------------
// Where an oversight role may be posted (ADR-056 AC-10)
// ---------------------------------------------------------------------------
/**
 * The body and scopes a role must be granted at, for the roles that have a
 * rule at all. The registration roles have none and are unchanged; the grant
 * path refuses with 422 a grant that breaks its role's entry.
 */
export const OVERSIGHT_ROLE_POSTING: Readonly<Partial<Record<OversightRole, {
    governmentBodyCode: string;
    scopeLevels: readonly OversightScopeLevel[];
    message: string;
}>>> = {
    psf_membership_officer: {
        governmentBodyCode: "PSF",
        scopeLevels: ["country"],
        message: "A PSF membership officer is appointed at PSF, for the whole country.",
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
        .regex(/^[a-z][a-z0-9_]{1,59}$/, "Use lower case letters, digits and underscores, like ordinary_300k."),
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
    registrationType: z.string(),
    registrationNumber: z.string(),
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
export const PsfApplication = z.object({
    id: Uuid,
    status: PsfApplicationStatus,
    requestedTierCode: z.string(),
    requestedTierName: z.string(),
    quotedPriceKind: PsfPriceKind,
    quotedFeeRwf: RwfAmount.nullable(),
    quotedFeeMinRwf: RwfAmount.nullable(),
    quotedFeeMaxRwf: RwfAmount.nullable(),
    submittedAt: z.string(),
    submittedCapacity: PsfSubmittedCapacity,
    /** Named so an owner can see an application sent on their behalf (AC-17). */
    submittedByName: z.string().nullable(),
    queuedAt: z.string().nullable(),
    decidedAt: z.string().nullable(),
    declineReason: PsfDeclineReason.nullable(),
    decisionNote: z.string().nullable(),
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
/** `GET /orgs/:orgId/psf-membership` (AC-15). */
export const PsfMembershipOverview = z.object({
    orgId: Uuid,
    /** The TIN PSF's form is filed under; not editable (AC-3). */
    registrationNumber: z.string(),
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
// ---------------------------------------------------------------------------
// The officer's side (AC-10 to AC-14)
// ---------------------------------------------------------------------------
export const PsfQueueItem = z.object({
    applicationId: Uuid,
    orgId: Uuid,
    businessName: z.string(),
    districtName: z.string().nullable(),
    requestedTierName: z.string(),
    submittedAt: z.string(),
    queuedAt: z.string().nullable(),
    registrationStatus: OrgRegistrationStatus,
    /** False when the officer holds a stake in the business (AC-14). */
    canDecide: z.boolean(),
});
export type PsfQueueItem = z.infer<typeof PsfQueueItem>;
export const PsfQueuePage = z.object({
    items: PsfQueueItem.array(),
    nextCursor: z.string().nullable(),
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
    canDecide: z.boolean(),
});
export type PsfOfficerApplication = z.infer<typeof PsfOfficerApplication>;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker.");
/** Marking an application `member` (AC-11). */
export const PsfMemberDecisionRequest = z
    .object({
    tierCode: z.string().trim().min(1, "Pick the tier PSF confirmed."),
    membershipNumber: z.string().trim().min(1, "Give the PSF membership number.").max(40),
    annualFeeRwf: RwfAmount.refine((n) => n > 0, "Give the annual fee PSF charged."),
    startsOn: isoDate,
    expiresOn: isoDate,
})
    .superRefine((value, ctx) => {
    if (value.expiresOn <= value.startsOn) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expiresOn"], message: "The expiry must come after the start." });
    }
});
export type PsfMemberDecisionRequest = z.infer<typeof PsfMemberDecisionRequest>;
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
/**
 * The membership dates an officer starts from: today, and one year later less
 * a day (ADR-056 value sourcing). `today` is a yyyy-mm-dd date in
 * Africa/Kigali, which the caller resolves.
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
 * The business activity PSF's form starts from, derived from the
 * accommodation class (ADR-056 value sourcing). Editable wherever it shows.
 */
export function psfBusinessActivityFor(accommodationClass: string | null, accommodationClassOther: string | null): string {
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
