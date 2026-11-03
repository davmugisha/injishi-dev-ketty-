import { z } from "zod";
import { Domain, OrgRegistrationStatus, OrgRole, OversightRole, OversightScopeLevel } from "./primitives";
import { EnterpriseRegistrationKind, PsfCompanyType, PsfContactRole, PsfOwnerGroup, PsfOwnership, PsfTradeDirection } from "./registration";
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
/**
 * The families PSF prices membership in. `ordinary` and `junior_giants` are
 * retired (2026-10-15) and stay only so the rows that name them still read.
 */
export declare const PsfMembershipFamily: z.ZodEnum<["golden_circle", "indashyikirwa", "indatwa", "ordinary", "junior_giants"]>;
export type PsfMembershipFamily = z.infer<typeof PsfMembershipFamily>;
/**
 * A fixed amount, a min to max band, a floor with no ceiling (`minimum`, which
 * is Golden Circle's 5,000,000 and up), or a price only PSF can quote.
 */
export declare const PsfPriceKind: z.ZodEnum<["fixed", "range", "minimum", "set_by_psf"]>;
export type PsfPriceKind = z.infer<typeof PsfPriceKind>;
/**
 * `submitted` waits on PSF, `approved` waits on the business's payment; both
 * are open. The other three are terminal.
 */
export declare const PsfApplicationStatus: z.ZodEnum<["submitted", "approved", "member", "declined", "withdrawn"]>;
export type PsfApplicationStatus = z.infer<typeof PsfApplicationStatus>;
/** The statuses an application is still open in: one per business at a time. */
export declare const PSF_OPEN_APPLICATION_STATUSES: readonly PsfApplicationStatus[];
export declare const PsfSubmittedCapacity: z.ZodEnum<["owner", "on_behalf_of"]>;
export type PsfSubmittedCapacity = z.infer<typeof PsfSubmittedCapacity>;
export declare const PsfDeclineReason: z.ZodEnum<["details_incomplete", "not_eligible_for_tier", "business_not_recognised", "other"]>;
export type PsfDeclineReason = z.infer<typeof PsfDeclineReason>;
/** `psf_record`: a claimed number PSF confirmed against its own records (0121), with no application. */
export declare const PsfMembershipSource: z.ZodEnum<["psf_confirmed", "self_declared", "psf_record"]>;
export type PsfMembershipSource = z.infer<typeof PsfMembershipSource>;
/**
 * Where an open application stands, as the business reads it. Derived on the
 * server from the application and the business's registration status
 * (ADR-056 AC-8), never stored.
 */
export declare const PsfApplicationStage: z.ZodEnum<["waiting_tin_check", "with_psf", "awaiting_payment"]>;
export type PsfApplicationStage = z.infer<typeof PsfApplicationStage>;
/**
 * The registration states in which an open application sits in PSF's queue
 * (ADR-056 AC-8): the TIN has passed and the business is in good standing.
 * Anywhere else it waits, unchanged, and returns when the business does.
 */
export declare const PSF_QUEUE_REGISTRATION_STATES: readonly OrgRegistrationStatus[];
export declare function isInPsfQueueState(status: OrgRegistrationStatus): boolean;
/** The domains that may hold a PSF membership through Injishi. A residence may not. */
export declare const PSF_DOMAINS: readonly Domain[];
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
export declare function isPsfApplicant(facts: PsfApplicantFacts): boolean;
export declare const PSF_FAMILY_LABEL: Readonly<Record<PsfMembershipFamily, string>>;
/** One line on who each family is for, as the tier picker introduces it. */
export declare const PSF_FAMILY_BLURB: Readonly<Record<PsfMembershipFamily, string>>;
/** The families a business can still pick, in the order PSF ranks them. */
export declare const PSF_OFFERED_FAMILIES: readonly PsfMembershipFamily[];
export declare const PSF_APPLICATION_STATUS_LABEL: Readonly<Record<PsfApplicationStatus, string>>;
export declare const PSF_APPLICATION_STAGE_LABEL: Readonly<Record<PsfApplicationStage, string>>;
export declare const PSF_DECLINE_REASON_LABEL: Readonly<Record<PsfDeclineReason, string>>;
export declare const PSF_MEMBERSHIP_SOURCE_LABEL: Readonly<Record<PsfMembershipSource, string>>;
export declare const PSF_COMPANY_TYPE_LABEL: Readonly<Record<PsfCompanyType, string>>;
export declare const PSF_OWNERSHIP_LABEL: Readonly<Record<PsfOwnership, string>>;
export declare const PSF_TRADE_DIRECTION_LABEL: Readonly<Record<PsfTradeDirection, string>>;
export declare const PSF_CONTACT_ROLE_LABEL: Readonly<Record<PsfContactRole, string>>;
export declare const PSF_OWNER_GROUP_LABEL: Readonly<Record<PsfOwnerGroup, string>>;
/** The same groups, short, for a chip or a filter. */
export declare const PSF_OWNER_GROUP_SHORT: Readonly<Record<PsfOwnerGroup, string>>;
export declare const ENTERPRISE_REGISTRATION_KIND_LABEL: Readonly<Record<EnterpriseRegistrationKind, string>>;
/** The same kinds, as a filed form names its registration: `TIN 123456789`. */
export declare const REGISTRATION_TYPE_SHORT: Readonly<Record<string, string>>;
/** What the business is told about the fee, wherever it picks a tier (AC-2). */
export declare const PSF_FEE_NOTICE = "Once PSF approves you, you pay the membership fee here by mobile money. It goes to PSF; Injishi keeps none of it.";
export declare const PSF_OPEN_APPLICATION_MESSAGE = "This business already has an open application with PSF. Withdraw it before sending another.";
export declare const PSF_NOT_OPEN_MESSAGE = "This application has already been decided or withdrawn.";
export declare const PSF_NOT_PAYABLE_MESSAGE = "This application is not waiting for a payment.";
export declare const PSF_OWN_BUSINESS_MESSAGE = "You hold a role in this business, so another PSF officer must decide its application.";
/**
 * Only a PSF District Manager approves or declines (2026-10-23), and only in
 * their own district: the application for its head office's, a branch for the
 * branch's. Province and national managers read everything for reporting.
 */
export declare const PSF_DISTRICT_DECIDES_MESSAGE = "Only the PSF District Manager of its district approves or declines. Province and national managers see it for reporting.";
export declare const PSF_NOT_FOR_RESIDENCE_MESSAGE = "PSF membership through Injishi is for businesses, not for residences let on a lease.";
export declare const PSF_OUT_OF_SCOPE_MESSAGE = "This business is outside the region you cover.";
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
export declare const OVERSIGHT_ROLE_POSTING: Readonly<Partial<Record<OversightRole, {
    governmentBodyCode: string;
    scopeLevels: readonly OversightScopeLevel[];
    message: string;
}>>>;
export declare const PsfTier: z.ZodObject<{
    code: z.ZodString;
    family: z.ZodEnum<["golden_circle", "indashyikirwa", "indatwa", "ordinary", "junior_giants"]>;
    nameEn: z.ZodString;
    nameRw: z.ZodNullable<z.ZodString>;
    priceKind: z.ZodEnum<["fixed", "range", "minimum", "set_by_psf"]>;
    annualFeeRwf: z.ZodNullable<z.ZodNumber>;
    annualFeeMinRwf: z.ZodNullable<z.ZodNumber>;
    annualFeeMaxRwf: z.ZodNullable<z.ZodNumber>;
    benefitsEn: z.ZodArray<z.ZodString, "many">;
    benefitsRw: z.ZodNullable<z.ZodArray<z.ZodString, "many">>;
    sortOrder: z.ZodNumber;
    active: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    code: string;
    active: boolean;
    family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
    nameEn: string;
    nameRw: string | null;
    priceKind: "minimum" | "fixed" | "range" | "set_by_psf";
    annualFeeRwf: number | null;
    annualFeeMinRwf: number | null;
    annualFeeMaxRwf: number | null;
    benefitsEn: string[];
    benefitsRw: string[] | null;
    sortOrder: number;
}, {
    code: string;
    active: boolean;
    family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
    nameEn: string;
    nameRw: string | null;
    priceKind: "minimum" | "fixed" | "range" | "set_by_psf";
    annualFeeRwf: number | null;
    annualFeeMinRwf: number | null;
    annualFeeMaxRwf: number | null;
    benefitsEn: string[];
    benefitsRw: string[] | null;
    sortOrder: number;
}>;
export type PsfTier = z.infer<typeof PsfTier>;
/** Admin adds a tier (AC-19). The code is permanent: applications name it. */
export declare const CreatePsfTierRequest: z.ZodEffects<z.ZodObject<{
    family: z.ZodEnum<["golden_circle", "indashyikirwa", "indatwa", "ordinary", "junior_giants"]>;
    nameEn: z.ZodString;
    nameRw: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    priceKind: z.ZodEnum<["fixed", "range", "minimum", "set_by_psf"]>;
    annualFeeRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    annualFeeMinRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    annualFeeMaxRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    benefitsEn: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    benefitsRw: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString, "many">>>;
    sortOrder: z.ZodNumber;
    active: z.ZodDefault<z.ZodBoolean>;
    /** Why, for the audit row every admin write records. */
    reason: z.ZodString;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    active: boolean;
    family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
    nameEn: string;
    priceKind: "minimum" | "fixed" | "range" | "set_by_psf";
    benefitsEn: string[];
    sortOrder: number;
    reason: string;
    nameRw?: string | null | undefined;
    annualFeeRwf?: number | null | undefined;
    annualFeeMinRwf?: number | null | undefined;
    annualFeeMaxRwf?: number | null | undefined;
    benefitsRw?: string[] | null | undefined;
}, {
    code: string;
    family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
    nameEn: string;
    priceKind: "minimum" | "fixed" | "range" | "set_by_psf";
    sortOrder: number;
    reason: string;
    active?: boolean | undefined;
    nameRw?: string | null | undefined;
    annualFeeRwf?: number | null | undefined;
    annualFeeMinRwf?: number | null | undefined;
    annualFeeMaxRwf?: number | null | undefined;
    benefitsEn?: string[] | undefined;
    benefitsRw?: string[] | null | undefined;
}>, {
    code: string;
    active: boolean;
    family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
    nameEn: string;
    priceKind: "minimum" | "fixed" | "range" | "set_by_psf";
    benefitsEn: string[];
    sortOrder: number;
    reason: string;
    nameRw?: string | null | undefined;
    annualFeeRwf?: number | null | undefined;
    annualFeeMinRwf?: number | null | undefined;
    annualFeeMaxRwf?: number | null | undefined;
    benefitsRw?: string[] | null | undefined;
}, {
    code: string;
    family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
    nameEn: string;
    priceKind: "minimum" | "fixed" | "range" | "set_by_psf";
    sortOrder: number;
    reason: string;
    active?: boolean | undefined;
    nameRw?: string | null | undefined;
    annualFeeRwf?: number | null | undefined;
    annualFeeMinRwf?: number | null | undefined;
    annualFeeMaxRwf?: number | null | undefined;
    benefitsEn?: string[] | undefined;
    benefitsRw?: string[] | null | undefined;
}>;
export type CreatePsfTierRequest = z.infer<typeof CreatePsfTierRequest>;
/**
 * Admin edits a tier. The whole price travels together, because the three
 * price columns are only meaningful as a set.
 */
export declare const UpdatePsfTierRequest: z.ZodEffects<z.ZodObject<{
    family: z.ZodEnum<["golden_circle", "indashyikirwa", "indatwa", "ordinary", "junior_giants"]>;
    nameEn: z.ZodString;
    nameRw: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    priceKind: z.ZodEnum<["fixed", "range", "minimum", "set_by_psf"]>;
    annualFeeRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    annualFeeMinRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    annualFeeMaxRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    benefitsEn: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    benefitsRw: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString, "many">>>;
    sortOrder: z.ZodNumber;
    active: z.ZodDefault<z.ZodBoolean>;
    /** Why, for the audit row every admin write records. */
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    active: boolean;
    family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
    nameEn: string;
    priceKind: "minimum" | "fixed" | "range" | "set_by_psf";
    benefitsEn: string[];
    sortOrder: number;
    reason: string;
    nameRw?: string | null | undefined;
    annualFeeRwf?: number | null | undefined;
    annualFeeMinRwf?: number | null | undefined;
    annualFeeMaxRwf?: number | null | undefined;
    benefitsRw?: string[] | null | undefined;
}, {
    family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
    nameEn: string;
    priceKind: "minimum" | "fixed" | "range" | "set_by_psf";
    sortOrder: number;
    reason: string;
    active?: boolean | undefined;
    nameRw?: string | null | undefined;
    annualFeeRwf?: number | null | undefined;
    annualFeeMinRwf?: number | null | undefined;
    annualFeeMaxRwf?: number | null | undefined;
    benefitsEn?: string[] | undefined;
    benefitsRw?: string[] | null | undefined;
}>, {
    active: boolean;
    family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
    nameEn: string;
    priceKind: "minimum" | "fixed" | "range" | "set_by_psf";
    benefitsEn: string[];
    sortOrder: number;
    reason: string;
    nameRw?: string | null | undefined;
    annualFeeRwf?: number | null | undefined;
    annualFeeMinRwf?: number | null | undefined;
    annualFeeMaxRwf?: number | null | undefined;
    benefitsRw?: string[] | null | undefined;
}, {
    family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
    nameEn: string;
    priceKind: "minimum" | "fixed" | "range" | "set_by_psf";
    sortOrder: number;
    reason: string;
    active?: boolean | undefined;
    nameRw?: string | null | undefined;
    annualFeeRwf?: number | null | undefined;
    annualFeeMinRwf?: number | null | undefined;
    annualFeeMaxRwf?: number | null | undefined;
    benefitsEn?: string[] | undefined;
    benefitsRw?: string[] | null | undefined;
}>;
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
export declare function psfTierAcceptsFee(tier: PsfPrice, amountRwf: number | null | undefined): boolean;
/** What a refusal of `psfTierAcceptsFee` says, in the band's own terms. */
export declare function psfFeeProblem(tier: PsfPrice, amountRwf: number | null | undefined): string | null;
/** The amount a form starts from: the price, or the bottom of the band. */
export declare function psfStartingFee(tier: PsfPrice): number | null;
/**
 * PSF's sector clusters, and the associations inside them, as a catalogue
 * admin edits. PSF restructured once already (ten chambers became five
 * clusters in 2022), so this is data, never an enum: a new association is an
 * edit, not a migration. Women, youth and disability (the Specialized cluster)
 * are not here; they are `PsfOwnerGroup`, a marker on a business of any sector.
 */
export declare const PsfAssociation: z.ZodObject<{
    code: z.ZodString;
    clusterCode: z.ZodString;
    nameEn: z.ZodString;
    acronym: z.ZodNullable<z.ZodString>;
    sortOrder: z.ZodNumber;
    active: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    code: string;
    active: boolean;
    nameEn: string;
    sortOrder: number;
    clusterCode: string;
    acronym: string | null;
}, {
    code: string;
    active: boolean;
    nameEn: string;
    sortOrder: number;
    clusterCode: string;
    acronym: string | null;
}>;
export type PsfAssociation = z.infer<typeof PsfAssociation>;
/**
 * A sector's subtype (2026-10-20): Hospitality, Tourism, Transport under
 * Services. National when `districtId` is null; otherwise offered only in
 * that district. `associationCodes` are the associations the form offers
 * once it is picked.
 */
export declare const PsfSubsector: z.ZodObject<{
    id: z.ZodString;
    clusterCode: z.ZodString;
    nameEn: z.ZodString;
    districtId: z.ZodNullable<z.ZodNumber>;
    districtName: z.ZodNullable<z.ZodString>;
    sortOrder: z.ZodNumber;
    active: z.ZodBoolean;
    associationCodes: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    active: boolean;
    id: string;
    districtName: string | null;
    districtId: number | null;
    nameEn: string;
    sortOrder: number;
    clusterCode: string;
    associationCodes: string[];
}, {
    active: boolean;
    id: string;
    districtName: string | null;
    districtId: number | null;
    nameEn: string;
    sortOrder: number;
    clusterCode: string;
    associationCodes: string[];
}>;
export type PsfSubsector = z.infer<typeof PsfSubsector>;
export declare const PsfCluster: z.ZodObject<{
    code: z.ZodString;
    nameEn: z.ZodString;
    nameRw: z.ZodNullable<z.ZodString>;
    /** One line on what kind of business belongs here. */
    description: z.ZodNullable<z.ZodString>;
    sortOrder: z.ZodNumber;
    active: z.ZodBoolean;
    associations: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        clusterCode: z.ZodString;
        nameEn: z.ZodString;
        acronym: z.ZodNullable<z.ZodString>;
        sortOrder: z.ZodNumber;
        active: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        code: string;
        active: boolean;
        nameEn: string;
        sortOrder: number;
        clusterCode: string;
        acronym: string | null;
    }, {
        code: string;
        active: boolean;
        nameEn: string;
        sortOrder: number;
        clusterCode: string;
        acronym: string | null;
    }>, "many">;
    /** National subtypes, and the district's own when the catalogue was asked for one. */
    subsectors: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        clusterCode: z.ZodString;
        nameEn: z.ZodString;
        districtId: z.ZodNullable<z.ZodNumber>;
        districtName: z.ZodNullable<z.ZodString>;
        sortOrder: z.ZodNumber;
        active: z.ZodBoolean;
        associationCodes: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        active: boolean;
        id: string;
        districtName: string | null;
        districtId: number | null;
        nameEn: string;
        sortOrder: number;
        clusterCode: string;
        associationCodes: string[];
    }, {
        active: boolean;
        id: string;
        districtName: string | null;
        districtId: number | null;
        nameEn: string;
        sortOrder: number;
        clusterCode: string;
        associationCodes: string[];
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    code: string;
    active: boolean;
    nameEn: string;
    nameRw: string | null;
    sortOrder: number;
    description: string | null;
    associations: {
        code: string;
        active: boolean;
        nameEn: string;
        sortOrder: number;
        clusterCode: string;
        acronym: string | null;
    }[];
    subsectors: {
        active: boolean;
        id: string;
        districtName: string | null;
        districtId: number | null;
        nameEn: string;
        sortOrder: number;
        clusterCode: string;
        associationCodes: string[];
    }[];
}, {
    code: string;
    active: boolean;
    nameEn: string;
    nameRw: string | null;
    sortOrder: number;
    description: string | null;
    associations: {
        code: string;
        active: boolean;
        nameEn: string;
        sortOrder: number;
        clusterCode: string;
        acronym: string | null;
    }[];
    subsectors?: {
        active: boolean;
        id: string;
        districtName: string | null;
        districtId: number | null;
        nameEn: string;
        sortOrder: number;
        clusterCode: string;
        associationCodes: string[];
    }[] | undefined;
}>;
export type PsfCluster = z.infer<typeof PsfCluster>;
/** `GET /psf/catalogue?district=`: the clusters in order, each with its associations and subtypes. */
export declare const PsfCatalogue: z.ZodObject<{
    clusters: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        nameEn: z.ZodString;
        nameRw: z.ZodNullable<z.ZodString>;
        /** One line on what kind of business belongs here. */
        description: z.ZodNullable<z.ZodString>;
        sortOrder: z.ZodNumber;
        active: z.ZodBoolean;
        associations: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            clusterCode: z.ZodString;
            nameEn: z.ZodString;
            acronym: z.ZodNullable<z.ZodString>;
            sortOrder: z.ZodNumber;
            active: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            code: string;
            active: boolean;
            nameEn: string;
            sortOrder: number;
            clusterCode: string;
            acronym: string | null;
        }, {
            code: string;
            active: boolean;
            nameEn: string;
            sortOrder: number;
            clusterCode: string;
            acronym: string | null;
        }>, "many">;
        /** National subtypes, and the district's own when the catalogue was asked for one. */
        subsectors: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            clusterCode: z.ZodString;
            nameEn: z.ZodString;
            districtId: z.ZodNullable<z.ZodNumber>;
            districtName: z.ZodNullable<z.ZodString>;
            sortOrder: z.ZodNumber;
            active: z.ZodBoolean;
            associationCodes: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            active: boolean;
            id: string;
            districtName: string | null;
            districtId: number | null;
            nameEn: string;
            sortOrder: number;
            clusterCode: string;
            associationCodes: string[];
        }, {
            active: boolean;
            id: string;
            districtName: string | null;
            districtId: number | null;
            nameEn: string;
            sortOrder: number;
            clusterCode: string;
            associationCodes: string[];
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        active: boolean;
        nameEn: string;
        nameRw: string | null;
        sortOrder: number;
        description: string | null;
        associations: {
            code: string;
            active: boolean;
            nameEn: string;
            sortOrder: number;
            clusterCode: string;
            acronym: string | null;
        }[];
        subsectors: {
            active: boolean;
            id: string;
            districtName: string | null;
            districtId: number | null;
            nameEn: string;
            sortOrder: number;
            clusterCode: string;
            associationCodes: string[];
        }[];
    }, {
        code: string;
        active: boolean;
        nameEn: string;
        nameRw: string | null;
        sortOrder: number;
        description: string | null;
        associations: {
            code: string;
            active: boolean;
            nameEn: string;
            sortOrder: number;
            clusterCode: string;
            acronym: string | null;
        }[];
        subsectors?: {
            active: boolean;
            id: string;
            districtName: string | null;
            districtId: number | null;
            nameEn: string;
            sortOrder: number;
            clusterCode: string;
            associationCodes: string[];
        }[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    clusters: {
        code: string;
        active: boolean;
        nameEn: string;
        nameRw: string | null;
        sortOrder: number;
        description: string | null;
        associations: {
            code: string;
            active: boolean;
            nameEn: string;
            sortOrder: number;
            clusterCode: string;
            acronym: string | null;
        }[];
        subsectors: {
            active: boolean;
            id: string;
            districtName: string | null;
            districtId: number | null;
            nameEn: string;
            sortOrder: number;
            clusterCode: string;
            associationCodes: string[];
        }[];
    }[];
}, {
    clusters: {
        code: string;
        active: boolean;
        nameEn: string;
        nameRw: string | null;
        sortOrder: number;
        description: string | null;
        associations: {
            code: string;
            active: boolean;
            nameEn: string;
            sortOrder: number;
            clusterCode: string;
            acronym: string | null;
        }[];
        subsectors?: {
            active: boolean;
            id: string;
            districtName: string | null;
            districtId: number | null;
            nameEn: string;
            sortOrder: number;
            clusterCode: string;
            associationCodes: string[];
        }[] | undefined;
    }[];
}>;
export type PsfCatalogue = z.infer<typeof PsfCatalogue>;
export declare const UpsertPsfClusterRequest: z.ZodObject<{
    nameEn: z.ZodString;
    nameRw: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sortOrder: z.ZodNumber;
    active: z.ZodDefault<z.ZodBoolean>;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    active: boolean;
    nameEn: string;
    sortOrder: number;
    reason: string;
    nameRw?: string | null | undefined;
    description?: string | null | undefined;
}, {
    nameEn: string;
    sortOrder: number;
    reason: string;
    active?: boolean | undefined;
    nameRw?: string | null | undefined;
    description?: string | null | undefined;
}>;
export type UpsertPsfClusterRequest = z.infer<typeof UpsertPsfClusterRequest>;
export declare const CreatePsfClusterRequest: z.ZodObject<{
    nameEn: z.ZodString;
    nameRw: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sortOrder: z.ZodNumber;
    active: z.ZodDefault<z.ZodBoolean>;
    reason: z.ZodString;
} & {
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    active: boolean;
    nameEn: string;
    sortOrder: number;
    reason: string;
    nameRw?: string | null | undefined;
    description?: string | null | undefined;
}, {
    code: string;
    nameEn: string;
    sortOrder: number;
    reason: string;
    active?: boolean | undefined;
    nameRw?: string | null | undefined;
    description?: string | null | undefined;
}>;
export type CreatePsfClusterRequest = z.infer<typeof CreatePsfClusterRequest>;
export declare const UpsertPsfAssociationRequest: z.ZodObject<{
    clusterCode: z.ZodString;
    nameEn: z.ZodString;
    acronym: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sortOrder: z.ZodNumber;
    active: z.ZodDefault<z.ZodBoolean>;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    active: boolean;
    nameEn: string;
    sortOrder: number;
    reason: string;
    clusterCode: string;
    acronym?: string | null | undefined;
}, {
    nameEn: string;
    sortOrder: number;
    reason: string;
    clusterCode: string;
    active?: boolean | undefined;
    acronym?: string | null | undefined;
}>;
export type UpsertPsfAssociationRequest = z.infer<typeof UpsertPsfAssociationRequest>;
export declare const CreatePsfAssociationRequest: z.ZodObject<{
    clusterCode: z.ZodString;
    nameEn: z.ZodString;
    acronym: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sortOrder: z.ZodNumber;
    active: z.ZodDefault<z.ZodBoolean>;
    reason: z.ZodString;
} & {
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    active: boolean;
    nameEn: string;
    sortOrder: number;
    reason: string;
    clusterCode: string;
    acronym?: string | null | undefined;
}, {
    code: string;
    nameEn: string;
    sortOrder: number;
    reason: string;
    clusterCode: string;
    active?: boolean | undefined;
    acronym?: string | null | undefined;
}>;
export type CreatePsfAssociationRequest = z.infer<typeof CreatePsfAssociationRequest>;
export declare const PsfMembership: z.ZodObject<{
    id: z.ZodString;
    source: z.ZodEnum<["psf_confirmed", "self_declared", "psf_record"]>;
    tierCode: z.ZodNullable<z.ZodString>;
    tierName: z.ZodNullable<z.ZodString>;
    membershipNumber: z.ZodString;
    annualFeeRwf: z.ZodNullable<z.ZodNumber>;
    startsOn: z.ZodNullable<z.ZodString>;
    expiresOn: z.ZodNullable<z.ZodString>;
    endedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    expiresOn: string | null;
    annualFeeRwf: number | null;
    source: "psf_confirmed" | "self_declared" | "psf_record";
    tierCode: string | null;
    tierName: string | null;
    membershipNumber: string;
    startsOn: string | null;
    endedAt: string | null;
}, {
    id: string;
    expiresOn: string | null;
    annualFeeRwf: number | null;
    source: "psf_confirmed" | "self_declared" | "psf_record";
    tierCode: string | null;
    tierName: string | null;
    membershipNumber: string;
    startsOn: string | null;
    endedAt: string | null;
}>;
export type PsfMembership = z.infer<typeof PsfMembership>;
/** The form as filed. Read by the business that sent it and the officer. */
export declare const PsfFiledForm: z.ZodObject<{
    companyName: z.ZodString;
    /** `tin`, `rca`, `rgb`, `other` or `none` (see `REGISTRATION_TYPE_SHORT`). */
    registrationType: z.ZodString;
    /** Null for a business registered nowhere yet. */
    registrationNumber: z.ZodNullable<z.ZodString>;
    website: z.ZodNullable<z.ZodString>;
    streetAddress: z.ZodString;
    companyType: z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>;
    ownership: z.ZodEnum<["rwandan_100", "foreign_100", "franchise", "joint_venture", "foreign_representative", "other"]>;
    ownershipOther: z.ZodNullable<z.ZodString>;
    businessActivity: z.ZodString;
    tradeDirection: z.ZodEnum<["none", "export", "import", "both"]>;
    tradeGoods: z.ZodNullable<z.ZodString>;
    tradeCountries: z.ZodArray<z.ZodString, "many">;
    contactRole: z.ZodEnum<["owner", "managing_director", "ceo", "chairman"]>;
    firstName: z.ZodString;
    lastName: z.ZodString;
    gender: z.ZodEnum<["male", "female"]>;
    phoneE164: z.ZodString;
    email: z.ZodString;
    idDocumentType: z.ZodEnum<["national_id", "passport"]>;
    idDocumentNumber: z.ZodString;
    dateOfBirth: z.ZodString;
}, "strip", z.ZodTypeAny, {
    gender: "female" | "male";
    dateOfBirth: string;
    phoneE164: string;
    companyName: string;
    streetAddress: string;
    website: string | null;
    companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
    ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
    ownershipOther: string | null;
    businessActivity: string;
    tradeDirection: "none" | "export" | "import" | "both";
    tradeGoods: string | null;
    tradeCountries: string[];
    contactRole: "owner" | "managing_director" | "ceo" | "chairman";
    firstName: string;
    lastName: string;
    email: string;
    registrationNumber: string | null;
    registrationType: string;
    idDocumentType: "national_id" | "passport";
    idDocumentNumber: string;
}, {
    gender: "female" | "male";
    dateOfBirth: string;
    phoneE164: string;
    companyName: string;
    streetAddress: string;
    website: string | null;
    companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
    ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
    ownershipOther: string | null;
    businessActivity: string;
    tradeDirection: "none" | "export" | "import" | "both";
    tradeGoods: string | null;
    tradeCountries: string[];
    contactRole: "owner" | "managing_director" | "ceo" | "chairman";
    firstName: string;
    lastName: string;
    email: string;
    registrationNumber: string | null;
    registrationType: string;
    idDocumentType: "national_id" | "passport";
    idDocumentNumber: string;
}>;
export type PsfFiledForm = z.infer<typeof PsfFiledForm>;
/** The payment that made an approved application a membership. */
export declare const PsfPayment: z.ZodObject<{
    paidAt: z.ZodString;
    amountRwf: z.ZodNumber;
    /** The provider's own reference, which a receipt quotes. */
    reference: z.ZodString;
    /** Whether Injishi has passed the money on to PSF yet. */
    remittedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reference: string;
    amountRwf: number;
    paidAt: string;
    remittedAt: string | null;
}, {
    reference: string;
    amountRwf: number;
    paidAt: string;
    remittedAt: string | null;
}>;
export type PsfPayment = z.infer<typeof PsfPayment>;
export declare const PsfApplication: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<["submitted", "approved", "member", "declined", "withdrawn"]>;
    requestedTierCode: z.ZodString;
    requestedTierName: z.ZodString;
    quotedPriceKind: z.ZodEnum<["fixed", "range", "minimum", "set_by_psf"]>;
    quotedFeeRwf: z.ZodNullable<z.ZodNumber>;
    quotedFeeMinRwf: z.ZodNullable<z.ZodNumber>;
    quotedFeeMaxRwf: z.ZodNullable<z.ZodNumber>;
    /** What the business said it would pay a year. Null for a tier PSF prices. */
    declaredFeeRwf: z.ZodNullable<z.ZodNumber>;
    submittedAt: z.ZodString;
    submittedCapacity: z.ZodEnum<["owner", "on_behalf_of"]>;
    /** Named so an owner can see an application sent on their behalf (AC-17). */
    submittedByName: z.ZodNullable<z.ZodString>;
    queuedAt: z.ZodNullable<z.ZodString>;
    decidedAt: z.ZodNullable<z.ZodString>;
    declineReason: z.ZodNullable<z.ZodEnum<["details_incomplete", "not_eligible_for_tier", "business_not_recognised", "other"]>>;
    decisionNote: z.ZodNullable<z.ZodString>;
    /** Set on approval: the number PSF gave, and what the business now owes. */
    approvedMembershipNumber: z.ZodNullable<z.ZodString>;
    approvedFeeRwf: z.ZodNullable<z.ZodNumber>;
    payment: z.ZodNullable<z.ZodObject<{
        paidAt: z.ZodString;
        amountRwf: z.ZodNumber;
        /** The provider's own reference, which a receipt quotes. */
        reference: z.ZodString;
        /** Whether Injishi has passed the money on to PSF yet. */
        remittedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        reference: string;
        amountRwf: number;
        paidAt: string;
        remittedAt: string | null;
    }, {
        reference: string;
        amountRwf: number;
        paidAt: string;
        remittedAt: string | null;
    }>>;
    withdrawnAt: z.ZodNullable<z.ZodString>;
    form: z.ZodObject<{
        companyName: z.ZodString;
        /** `tin`, `rca`, `rgb`, `other` or `none` (see `REGISTRATION_TYPE_SHORT`). */
        registrationType: z.ZodString;
        /** Null for a business registered nowhere yet. */
        registrationNumber: z.ZodNullable<z.ZodString>;
        website: z.ZodNullable<z.ZodString>;
        streetAddress: z.ZodString;
        companyType: z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>;
        ownership: z.ZodEnum<["rwandan_100", "foreign_100", "franchise", "joint_venture", "foreign_representative", "other"]>;
        ownershipOther: z.ZodNullable<z.ZodString>;
        businessActivity: z.ZodString;
        tradeDirection: z.ZodEnum<["none", "export", "import", "both"]>;
        tradeGoods: z.ZodNullable<z.ZodString>;
        tradeCountries: z.ZodArray<z.ZodString, "many">;
        contactRole: z.ZodEnum<["owner", "managing_director", "ceo", "chairman"]>;
        firstName: z.ZodString;
        lastName: z.ZodString;
        gender: z.ZodEnum<["male", "female"]>;
        phoneE164: z.ZodString;
        email: z.ZodString;
        idDocumentType: z.ZodEnum<["national_id", "passport"]>;
        idDocumentNumber: z.ZodString;
        dateOfBirth: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        gender: "female" | "male";
        dateOfBirth: string;
        phoneE164: string;
        companyName: string;
        streetAddress: string;
        website: string | null;
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
        ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
        ownershipOther: string | null;
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeGoods: string | null;
        tradeCountries: string[];
        contactRole: "owner" | "managing_director" | "ceo" | "chairman";
        firstName: string;
        lastName: string;
        email: string;
        registrationNumber: string | null;
        registrationType: string;
        idDocumentType: "national_id" | "passport";
        idDocumentNumber: string;
    }, {
        gender: "female" | "male";
        dateOfBirth: string;
        phoneE164: string;
        companyName: string;
        streetAddress: string;
        website: string | null;
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
        ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
        ownershipOther: string | null;
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeGoods: string | null;
        tradeCountries: string[];
        contactRole: "owner" | "managing_director" | "ceo" | "chairman";
        firstName: string;
        lastName: string;
        email: string;
        registrationNumber: string | null;
        registrationType: string;
        idDocumentType: "national_id" | "passport";
        idDocumentNumber: string;
    }>;
}, "strip", z.ZodTypeAny, {
    status: "submitted" | "approved" | "declined" | "member" | "withdrawn";
    id: string;
    declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
    requestedTierCode: string;
    declaredFeeRwf: number | null;
    decidedAt: string | null;
    submittedAt: string;
    requestedTierName: string;
    quotedPriceKind: "minimum" | "fixed" | "range" | "set_by_psf";
    quotedFeeRwf: number | null;
    quotedFeeMinRwf: number | null;
    quotedFeeMaxRwf: number | null;
    submittedCapacity: "owner" | "on_behalf_of";
    submittedByName: string | null;
    queuedAt: string | null;
    decisionNote: string | null;
    approvedMembershipNumber: string | null;
    approvedFeeRwf: number | null;
    payment: {
        reference: string;
        amountRwf: number;
        paidAt: string;
        remittedAt: string | null;
    } | null;
    withdrawnAt: string | null;
    form: {
        gender: "female" | "male";
        dateOfBirth: string;
        phoneE164: string;
        companyName: string;
        streetAddress: string;
        website: string | null;
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
        ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
        ownershipOther: string | null;
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeGoods: string | null;
        tradeCountries: string[];
        contactRole: "owner" | "managing_director" | "ceo" | "chairman";
        firstName: string;
        lastName: string;
        email: string;
        registrationNumber: string | null;
        registrationType: string;
        idDocumentType: "national_id" | "passport";
        idDocumentNumber: string;
    };
}, {
    status: "submitted" | "approved" | "declined" | "member" | "withdrawn";
    id: string;
    declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
    requestedTierCode: string;
    declaredFeeRwf: number | null;
    decidedAt: string | null;
    submittedAt: string;
    requestedTierName: string;
    quotedPriceKind: "minimum" | "fixed" | "range" | "set_by_psf";
    quotedFeeRwf: number | null;
    quotedFeeMinRwf: number | null;
    quotedFeeMaxRwf: number | null;
    submittedCapacity: "owner" | "on_behalf_of";
    submittedByName: string | null;
    queuedAt: string | null;
    decisionNote: string | null;
    approvedMembershipNumber: string | null;
    approvedFeeRwf: number | null;
    payment: {
        reference: string;
        amountRwf: number;
        paidAt: string;
        remittedAt: string | null;
    } | null;
    withdrawnAt: string | null;
    form: {
        gender: "female" | "male";
        dateOfBirth: string;
        phoneE164: string;
        companyName: string;
        streetAddress: string;
        website: string | null;
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
        ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
        ownershipOther: string | null;
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeGoods: string | null;
        tradeCountries: string[];
        contactRole: "owner" | "managing_director" | "ceo" | "chairman";
        firstName: string;
        lastName: string;
        email: string;
        registrationNumber: string | null;
        registrationType: string;
        idDocumentType: "national_id" | "passport";
        idDocumentNumber: string;
    };
}>;
export type PsfApplication = z.infer<typeof PsfApplication>;
/**
 * What the apply form starts from in the workspace (ADR-056 value sourcing):
 * the business row, the person's profile, and the last application sent.
 * Every field optional, because a first application from an on behalf agent
 * knows little about the owner.
 */
export declare const PsfApplicationPrefill: z.ZodObject<{
    companyName: z.ZodOptional<z.ZodString>;
    streetAddress: z.ZodOptional<z.ZodString>;
    businessActivity: z.ZodOptional<z.ZodString>;
    website: z.ZodOptional<z.ZodString>;
    companyType: z.ZodOptional<z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>>;
    ownership: z.ZodOptional<z.ZodEnum<["rwandan_100", "foreign_100", "franchise", "joint_venture", "foreign_representative", "other"]>>;
    ownershipOther: z.ZodOptional<z.ZodString>;
    tradeDirection: z.ZodOptional<z.ZodEnum<["none", "export", "import", "both"]>>;
    tradeGoods: z.ZodOptional<z.ZodString>;
    tradeCountries: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    contactRole: z.ZodOptional<z.ZodEnum<["owner", "managing_director", "ceo", "chairman"]>>;
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodEnum<["male", "female"]>>;
    phoneE164: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    idDocumentType: z.ZodOptional<z.ZodEnum<["national_id", "passport"]>>;
    idDocumentNumber: z.ZodOptional<z.ZodString>;
    dateOfBirth: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    gender?: "female" | "male" | undefined;
    dateOfBirth?: string | undefined;
    phoneE164?: string | undefined;
    companyName?: string | undefined;
    streetAddress?: string | undefined;
    website?: string | undefined;
    companyType?: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader" | undefined;
    ownership?: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative" | undefined;
    ownershipOther?: string | undefined;
    businessActivity?: string | undefined;
    tradeDirection?: "none" | "export" | "import" | "both" | undefined;
    tradeGoods?: string | undefined;
    tradeCountries?: string[] | undefined;
    contactRole?: "owner" | "managing_director" | "ceo" | "chairman" | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    email?: string | undefined;
    idDocumentType?: "national_id" | "passport" | undefined;
    idDocumentNumber?: string | undefined;
}, {
    gender?: "female" | "male" | undefined;
    dateOfBirth?: string | undefined;
    phoneE164?: string | undefined;
    companyName?: string | undefined;
    streetAddress?: string | undefined;
    website?: string | undefined;
    companyType?: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader" | undefined;
    ownership?: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative" | undefined;
    ownershipOther?: string | undefined;
    businessActivity?: string | undefined;
    tradeDirection?: "none" | "export" | "import" | "both" | undefined;
    tradeGoods?: string | undefined;
    tradeCountries?: string[] | undefined;
    contactRole?: "owner" | "managing_director" | "ceo" | "chairman" | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    email?: string | undefined;
    idDocumentType?: "national_id" | "passport" | undefined;
    idDocumentNumber?: string | undefined;
}>;
export type PsfApplicationPrefill = z.infer<typeof PsfApplicationPrefill>;
/** The business as PSF sees it: its code, its sector and who owns it. */
export declare const PsfBusinessProfile: z.ZodObject<{
    domain: z.ZodEnum<["hospitality", "residence", "enterprise"]>;
    businessCode: z.ZodNullable<z.ZodString>;
    districtName: z.ZodNullable<z.ZodString>;
    clusterName: z.ZodNullable<z.ZodString>;
    /** The subtype picked, or the one the business typed. */
    subsectorName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    associationName: z.ZodNullable<z.ZodString>;
    ownerGroups: z.ZodArray<z.ZodEnum<["women", "youth", "pwd"]>, "many">;
    registrationKind: z.ZodNullable<z.ZodEnum<["tin", "rca", "rgb", "other", "none"]>>;
}, "strip", z.ZodTypeAny, {
    domain: "hospitality" | "residence" | "enterprise";
    districtName: string | null;
    registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
    ownerGroups: ("women" | "youth" | "pwd")[];
    businessCode: string | null;
    clusterName: string | null;
    subsectorName: string | null;
    associationName: string | null;
}, {
    domain: "hospitality" | "residence" | "enterprise";
    districtName: string | null;
    registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
    ownerGroups: ("women" | "youth" | "pwd")[];
    businessCode: string | null;
    clusterName: string | null;
    associationName: string | null;
    subsectorName?: string | null | undefined;
}>;
export type PsfBusinessProfile = z.infer<typeof PsfBusinessProfile>;
/** `GET /orgs/:orgId/psf-membership` (AC-15). */
export declare const PsfMembershipOverview: z.ZodObject<{
    orgId: z.ZodString;
    /**
     * The registration PSF's form is filed under; not editable (AC-3). A TIN
     * for a hotel, whatever the business registered with on the PSF path, and
     * empty for a PSF business registered nowhere yet.
     */
    registrationNumber: z.ZodString;
    profile: z.ZodObject<{
        domain: z.ZodEnum<["hospitality", "residence", "enterprise"]>;
        businessCode: z.ZodNullable<z.ZodString>;
        districtName: z.ZodNullable<z.ZodString>;
        clusterName: z.ZodNullable<z.ZodString>;
        /** The subtype picked, or the one the business typed. */
        subsectorName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        associationName: z.ZodNullable<z.ZodString>;
        ownerGroups: z.ZodArray<z.ZodEnum<["women", "youth", "pwd"]>, "many">;
        registrationKind: z.ZodNullable<z.ZodEnum<["tin", "rca", "rgb", "other", "none"]>>;
    }, "strip", z.ZodTypeAny, {
        domain: "hospitality" | "residence" | "enterprise";
        districtName: string | null;
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
        ownerGroups: ("women" | "youth" | "pwd")[];
        businessCode: string | null;
        clusterName: string | null;
        subsectorName: string | null;
        associationName: string | null;
    }, {
        domain: "hospitality" | "residence" | "enterprise";
        districtName: string | null;
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
        ownerGroups: ("women" | "youth" | "pwd")[];
        businessCode: string | null;
        clusterName: string | null;
        associationName: string | null;
        subsectorName?: string | null | undefined;
    }>;
    current: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        source: z.ZodEnum<["psf_confirmed", "self_declared", "psf_record"]>;
        tierCode: z.ZodNullable<z.ZodString>;
        tierName: z.ZodNullable<z.ZodString>;
        membershipNumber: z.ZodString;
        annualFeeRwf: z.ZodNullable<z.ZodNumber>;
        startsOn: z.ZodNullable<z.ZodString>;
        expiresOn: z.ZodNullable<z.ZodString>;
        endedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        expiresOn: string | null;
        annualFeeRwf: number | null;
        source: "psf_confirmed" | "self_declared" | "psf_record";
        tierCode: string | null;
        tierName: string | null;
        membershipNumber: string;
        startsOn: string | null;
        endedAt: string | null;
    }, {
        id: string;
        expiresOn: string | null;
        annualFeeRwf: number | null;
        source: "psf_confirmed" | "self_declared" | "psf_record";
        tierCode: string | null;
        tierName: string | null;
        membershipNumber: string;
        startsOn: string | null;
        endedAt: string | null;
    }>>;
    open: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodEnum<["submitted", "approved", "member", "declined", "withdrawn"]>;
        requestedTierCode: z.ZodString;
        requestedTierName: z.ZodString;
        quotedPriceKind: z.ZodEnum<["fixed", "range", "minimum", "set_by_psf"]>;
        quotedFeeRwf: z.ZodNullable<z.ZodNumber>;
        quotedFeeMinRwf: z.ZodNullable<z.ZodNumber>;
        quotedFeeMaxRwf: z.ZodNullable<z.ZodNumber>;
        /** What the business said it would pay a year. Null for a tier PSF prices. */
        declaredFeeRwf: z.ZodNullable<z.ZodNumber>;
        submittedAt: z.ZodString;
        submittedCapacity: z.ZodEnum<["owner", "on_behalf_of"]>;
        /** Named so an owner can see an application sent on their behalf (AC-17). */
        submittedByName: z.ZodNullable<z.ZodString>;
        queuedAt: z.ZodNullable<z.ZodString>;
        decidedAt: z.ZodNullable<z.ZodString>;
        declineReason: z.ZodNullable<z.ZodEnum<["details_incomplete", "not_eligible_for_tier", "business_not_recognised", "other"]>>;
        decisionNote: z.ZodNullable<z.ZodString>;
        /** Set on approval: the number PSF gave, and what the business now owes. */
        approvedMembershipNumber: z.ZodNullable<z.ZodString>;
        approvedFeeRwf: z.ZodNullable<z.ZodNumber>;
        payment: z.ZodNullable<z.ZodObject<{
            paidAt: z.ZodString;
            amountRwf: z.ZodNumber;
            /** The provider's own reference, which a receipt quotes. */
            reference: z.ZodString;
            /** Whether Injishi has passed the money on to PSF yet. */
            remittedAt: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            reference: string;
            amountRwf: number;
            paidAt: string;
            remittedAt: string | null;
        }, {
            reference: string;
            amountRwf: number;
            paidAt: string;
            remittedAt: string | null;
        }>>;
        withdrawnAt: z.ZodNullable<z.ZodString>;
        form: z.ZodObject<{
            companyName: z.ZodString;
            /** `tin`, `rca`, `rgb`, `other` or `none` (see `REGISTRATION_TYPE_SHORT`). */
            registrationType: z.ZodString;
            /** Null for a business registered nowhere yet. */
            registrationNumber: z.ZodNullable<z.ZodString>;
            website: z.ZodNullable<z.ZodString>;
            streetAddress: z.ZodString;
            companyType: z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>;
            ownership: z.ZodEnum<["rwandan_100", "foreign_100", "franchise", "joint_venture", "foreign_representative", "other"]>;
            ownershipOther: z.ZodNullable<z.ZodString>;
            businessActivity: z.ZodString;
            tradeDirection: z.ZodEnum<["none", "export", "import", "both"]>;
            tradeGoods: z.ZodNullable<z.ZodString>;
            tradeCountries: z.ZodArray<z.ZodString, "many">;
            contactRole: z.ZodEnum<["owner", "managing_director", "ceo", "chairman"]>;
            firstName: z.ZodString;
            lastName: z.ZodString;
            gender: z.ZodEnum<["male", "female"]>;
            phoneE164: z.ZodString;
            email: z.ZodString;
            idDocumentType: z.ZodEnum<["national_id", "passport"]>;
            idDocumentNumber: z.ZodString;
            dateOfBirth: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            gender: "female" | "male";
            dateOfBirth: string;
            phoneE164: string;
            companyName: string;
            streetAddress: string;
            website: string | null;
            companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
            ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationNumber: string | null;
            registrationType: string;
            idDocumentType: "national_id" | "passport";
            idDocumentNumber: string;
        }, {
            gender: "female" | "male";
            dateOfBirth: string;
            phoneE164: string;
            companyName: string;
            streetAddress: string;
            website: string | null;
            companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
            ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationNumber: string | null;
            registrationType: string;
            idDocumentType: "national_id" | "passport";
            idDocumentNumber: string;
        }>;
    } & {
        stage: z.ZodEnum<["waiting_tin_check", "with_psf", "awaiting_payment"]>;
    }, "strip", z.ZodTypeAny, {
        status: "submitted" | "approved" | "declined" | "member" | "withdrawn";
        id: string;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        requestedTierCode: string;
        declaredFeeRwf: number | null;
        stage: "awaiting_payment" | "waiting_tin_check" | "with_psf";
        decidedAt: string | null;
        submittedAt: string;
        requestedTierName: string;
        quotedPriceKind: "minimum" | "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        decisionNote: string | null;
        approvedMembershipNumber: string | null;
        approvedFeeRwf: number | null;
        payment: {
            reference: string;
            amountRwf: number;
            paidAt: string;
            remittedAt: string | null;
        } | null;
        withdrawnAt: string | null;
        form: {
            gender: "female" | "male";
            dateOfBirth: string;
            phoneE164: string;
            companyName: string;
            streetAddress: string;
            website: string | null;
            companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
            ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationNumber: string | null;
            registrationType: string;
            idDocumentType: "national_id" | "passport";
            idDocumentNumber: string;
        };
    }, {
        status: "submitted" | "approved" | "declined" | "member" | "withdrawn";
        id: string;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        requestedTierCode: string;
        declaredFeeRwf: number | null;
        stage: "awaiting_payment" | "waiting_tin_check" | "with_psf";
        decidedAt: string | null;
        submittedAt: string;
        requestedTierName: string;
        quotedPriceKind: "minimum" | "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        decisionNote: string | null;
        approvedMembershipNumber: string | null;
        approvedFeeRwf: number | null;
        payment: {
            reference: string;
            amountRwf: number;
            paidAt: string;
            remittedAt: string | null;
        } | null;
        withdrawnAt: string | null;
        form: {
            gender: "female" | "male";
            dateOfBirth: string;
            phoneE164: string;
            companyName: string;
            streetAddress: string;
            website: string | null;
            companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
            ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationNumber: string | null;
            registrationType: string;
            idDocumentType: "national_id" | "passport";
            idDocumentNumber: string;
        };
    }>>;
    /** Decided and withdrawn applications, newest first. */
    history: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodEnum<["submitted", "approved", "member", "declined", "withdrawn"]>;
        requestedTierCode: z.ZodString;
        requestedTierName: z.ZodString;
        quotedPriceKind: z.ZodEnum<["fixed", "range", "minimum", "set_by_psf"]>;
        quotedFeeRwf: z.ZodNullable<z.ZodNumber>;
        quotedFeeMinRwf: z.ZodNullable<z.ZodNumber>;
        quotedFeeMaxRwf: z.ZodNullable<z.ZodNumber>;
        /** What the business said it would pay a year. Null for a tier PSF prices. */
        declaredFeeRwf: z.ZodNullable<z.ZodNumber>;
        submittedAt: z.ZodString;
        submittedCapacity: z.ZodEnum<["owner", "on_behalf_of"]>;
        /** Named so an owner can see an application sent on their behalf (AC-17). */
        submittedByName: z.ZodNullable<z.ZodString>;
        queuedAt: z.ZodNullable<z.ZodString>;
        decidedAt: z.ZodNullable<z.ZodString>;
        declineReason: z.ZodNullable<z.ZodEnum<["details_incomplete", "not_eligible_for_tier", "business_not_recognised", "other"]>>;
        decisionNote: z.ZodNullable<z.ZodString>;
        /** Set on approval: the number PSF gave, and what the business now owes. */
        approvedMembershipNumber: z.ZodNullable<z.ZodString>;
        approvedFeeRwf: z.ZodNullable<z.ZodNumber>;
        payment: z.ZodNullable<z.ZodObject<{
            paidAt: z.ZodString;
            amountRwf: z.ZodNumber;
            /** The provider's own reference, which a receipt quotes. */
            reference: z.ZodString;
            /** Whether Injishi has passed the money on to PSF yet. */
            remittedAt: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            reference: string;
            amountRwf: number;
            paidAt: string;
            remittedAt: string | null;
        }, {
            reference: string;
            amountRwf: number;
            paidAt: string;
            remittedAt: string | null;
        }>>;
        withdrawnAt: z.ZodNullable<z.ZodString>;
        form: z.ZodObject<{
            companyName: z.ZodString;
            /** `tin`, `rca`, `rgb`, `other` or `none` (see `REGISTRATION_TYPE_SHORT`). */
            registrationType: z.ZodString;
            /** Null for a business registered nowhere yet. */
            registrationNumber: z.ZodNullable<z.ZodString>;
            website: z.ZodNullable<z.ZodString>;
            streetAddress: z.ZodString;
            companyType: z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>;
            ownership: z.ZodEnum<["rwandan_100", "foreign_100", "franchise", "joint_venture", "foreign_representative", "other"]>;
            ownershipOther: z.ZodNullable<z.ZodString>;
            businessActivity: z.ZodString;
            tradeDirection: z.ZodEnum<["none", "export", "import", "both"]>;
            tradeGoods: z.ZodNullable<z.ZodString>;
            tradeCountries: z.ZodArray<z.ZodString, "many">;
            contactRole: z.ZodEnum<["owner", "managing_director", "ceo", "chairman"]>;
            firstName: z.ZodString;
            lastName: z.ZodString;
            gender: z.ZodEnum<["male", "female"]>;
            phoneE164: z.ZodString;
            email: z.ZodString;
            idDocumentType: z.ZodEnum<["national_id", "passport"]>;
            idDocumentNumber: z.ZodString;
            dateOfBirth: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            gender: "female" | "male";
            dateOfBirth: string;
            phoneE164: string;
            companyName: string;
            streetAddress: string;
            website: string | null;
            companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
            ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationNumber: string | null;
            registrationType: string;
            idDocumentType: "national_id" | "passport";
            idDocumentNumber: string;
        }, {
            gender: "female" | "male";
            dateOfBirth: string;
            phoneE164: string;
            companyName: string;
            streetAddress: string;
            website: string | null;
            companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
            ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationNumber: string | null;
            registrationType: string;
            idDocumentType: "national_id" | "passport";
            idDocumentNumber: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        status: "submitted" | "approved" | "declined" | "member" | "withdrawn";
        id: string;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        requestedTierCode: string;
        declaredFeeRwf: number | null;
        decidedAt: string | null;
        submittedAt: string;
        requestedTierName: string;
        quotedPriceKind: "minimum" | "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        decisionNote: string | null;
        approvedMembershipNumber: string | null;
        approvedFeeRwf: number | null;
        payment: {
            reference: string;
            amountRwf: number;
            paidAt: string;
            remittedAt: string | null;
        } | null;
        withdrawnAt: string | null;
        form: {
            gender: "female" | "male";
            dateOfBirth: string;
            phoneE164: string;
            companyName: string;
            streetAddress: string;
            website: string | null;
            companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
            ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationNumber: string | null;
            registrationType: string;
            idDocumentType: "national_id" | "passport";
            idDocumentNumber: string;
        };
    }, {
        status: "submitted" | "approved" | "declined" | "member" | "withdrawn";
        id: string;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        requestedTierCode: string;
        declaredFeeRwf: number | null;
        decidedAt: string | null;
        submittedAt: string;
        requestedTierName: string;
        quotedPriceKind: "minimum" | "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        decisionNote: string | null;
        approvedMembershipNumber: string | null;
        approvedFeeRwf: number | null;
        payment: {
            reference: string;
            amountRwf: number;
            paidAt: string;
            remittedAt: string | null;
        } | null;
        withdrawnAt: string | null;
        form: {
            gender: "female" | "male";
            dateOfBirth: string;
            phoneE164: string;
            companyName: string;
            streetAddress: string;
            website: string | null;
            companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
            ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationNumber: string | null;
            registrationType: string;
            idDocumentType: "national_id" | "passport";
            idDocumentNumber: string;
        };
    }>, "many">;
    canApply: z.ZodBoolean;
    prefill: z.ZodObject<{
        companyName: z.ZodOptional<z.ZodString>;
        streetAddress: z.ZodOptional<z.ZodString>;
        businessActivity: z.ZodOptional<z.ZodString>;
        website: z.ZodOptional<z.ZodString>;
        companyType: z.ZodOptional<z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>>;
        ownership: z.ZodOptional<z.ZodEnum<["rwandan_100", "foreign_100", "franchise", "joint_venture", "foreign_representative", "other"]>>;
        ownershipOther: z.ZodOptional<z.ZodString>;
        tradeDirection: z.ZodOptional<z.ZodEnum<["none", "export", "import", "both"]>>;
        tradeGoods: z.ZodOptional<z.ZodString>;
        tradeCountries: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        contactRole: z.ZodOptional<z.ZodEnum<["owner", "managing_director", "ceo", "chairman"]>>;
        firstName: z.ZodOptional<z.ZodString>;
        lastName: z.ZodOptional<z.ZodString>;
        gender: z.ZodOptional<z.ZodEnum<["male", "female"]>>;
        phoneE164: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        idDocumentType: z.ZodOptional<z.ZodEnum<["national_id", "passport"]>>;
        idDocumentNumber: z.ZodOptional<z.ZodString>;
        dateOfBirth: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        gender?: "female" | "male" | undefined;
        dateOfBirth?: string | undefined;
        phoneE164?: string | undefined;
        companyName?: string | undefined;
        streetAddress?: string | undefined;
        website?: string | undefined;
        companyType?: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader" | undefined;
        ownership?: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative" | undefined;
        ownershipOther?: string | undefined;
        businessActivity?: string | undefined;
        tradeDirection?: "none" | "export" | "import" | "both" | undefined;
        tradeGoods?: string | undefined;
        tradeCountries?: string[] | undefined;
        contactRole?: "owner" | "managing_director" | "ceo" | "chairman" | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        email?: string | undefined;
        idDocumentType?: "national_id" | "passport" | undefined;
        idDocumentNumber?: string | undefined;
    }, {
        gender?: "female" | "male" | undefined;
        dateOfBirth?: string | undefined;
        phoneE164?: string | undefined;
        companyName?: string | undefined;
        streetAddress?: string | undefined;
        website?: string | undefined;
        companyType?: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader" | undefined;
        ownership?: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative" | undefined;
        ownershipOther?: string | undefined;
        businessActivity?: string | undefined;
        tradeDirection?: "none" | "export" | "import" | "both" | undefined;
        tradeGoods?: string | undefined;
        tradeCountries?: string[] | undefined;
        contactRole?: "owner" | "managing_director" | "ceo" | "chairman" | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        email?: string | undefined;
        idDocumentType?: "national_id" | "passport" | undefined;
        idDocumentNumber?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    registrationNumber: string;
    orgId: string;
    profile: {
        domain: "hospitality" | "residence" | "enterprise";
        districtName: string | null;
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
        ownerGroups: ("women" | "youth" | "pwd")[];
        businessCode: string | null;
        clusterName: string | null;
        subsectorName: string | null;
        associationName: string | null;
    };
    current: {
        id: string;
        expiresOn: string | null;
        annualFeeRwf: number | null;
        source: "psf_confirmed" | "self_declared" | "psf_record";
        tierCode: string | null;
        tierName: string | null;
        membershipNumber: string;
        startsOn: string | null;
        endedAt: string | null;
    } | null;
    open: {
        status: "submitted" | "approved" | "declined" | "member" | "withdrawn";
        id: string;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        requestedTierCode: string;
        declaredFeeRwf: number | null;
        stage: "awaiting_payment" | "waiting_tin_check" | "with_psf";
        decidedAt: string | null;
        submittedAt: string;
        requestedTierName: string;
        quotedPriceKind: "minimum" | "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        decisionNote: string | null;
        approvedMembershipNumber: string | null;
        approvedFeeRwf: number | null;
        payment: {
            reference: string;
            amountRwf: number;
            paidAt: string;
            remittedAt: string | null;
        } | null;
        withdrawnAt: string | null;
        form: {
            gender: "female" | "male";
            dateOfBirth: string;
            phoneE164: string;
            companyName: string;
            streetAddress: string;
            website: string | null;
            companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
            ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationNumber: string | null;
            registrationType: string;
            idDocumentType: "national_id" | "passport";
            idDocumentNumber: string;
        };
    } | null;
    history: {
        status: "submitted" | "approved" | "declined" | "member" | "withdrawn";
        id: string;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        requestedTierCode: string;
        declaredFeeRwf: number | null;
        decidedAt: string | null;
        submittedAt: string;
        requestedTierName: string;
        quotedPriceKind: "minimum" | "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        decisionNote: string | null;
        approvedMembershipNumber: string | null;
        approvedFeeRwf: number | null;
        payment: {
            reference: string;
            amountRwf: number;
            paidAt: string;
            remittedAt: string | null;
        } | null;
        withdrawnAt: string | null;
        form: {
            gender: "female" | "male";
            dateOfBirth: string;
            phoneE164: string;
            companyName: string;
            streetAddress: string;
            website: string | null;
            companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
            ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationNumber: string | null;
            registrationType: string;
            idDocumentType: "national_id" | "passport";
            idDocumentNumber: string;
        };
    }[];
    canApply: boolean;
    prefill: {
        gender?: "female" | "male" | undefined;
        dateOfBirth?: string | undefined;
        phoneE164?: string | undefined;
        companyName?: string | undefined;
        streetAddress?: string | undefined;
        website?: string | undefined;
        companyType?: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader" | undefined;
        ownership?: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative" | undefined;
        ownershipOther?: string | undefined;
        businessActivity?: string | undefined;
        tradeDirection?: "none" | "export" | "import" | "both" | undefined;
        tradeGoods?: string | undefined;
        tradeCountries?: string[] | undefined;
        contactRole?: "owner" | "managing_director" | "ceo" | "chairman" | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        email?: string | undefined;
        idDocumentType?: "national_id" | "passport" | undefined;
        idDocumentNumber?: string | undefined;
    };
}, {
    registrationNumber: string;
    orgId: string;
    profile: {
        domain: "hospitality" | "residence" | "enterprise";
        districtName: string | null;
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
        ownerGroups: ("women" | "youth" | "pwd")[];
        businessCode: string | null;
        clusterName: string | null;
        associationName: string | null;
        subsectorName?: string | null | undefined;
    };
    current: {
        id: string;
        expiresOn: string | null;
        annualFeeRwf: number | null;
        source: "psf_confirmed" | "self_declared" | "psf_record";
        tierCode: string | null;
        tierName: string | null;
        membershipNumber: string;
        startsOn: string | null;
        endedAt: string | null;
    } | null;
    open: {
        status: "submitted" | "approved" | "declined" | "member" | "withdrawn";
        id: string;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        requestedTierCode: string;
        declaredFeeRwf: number | null;
        stage: "awaiting_payment" | "waiting_tin_check" | "with_psf";
        decidedAt: string | null;
        submittedAt: string;
        requestedTierName: string;
        quotedPriceKind: "minimum" | "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        decisionNote: string | null;
        approvedMembershipNumber: string | null;
        approvedFeeRwf: number | null;
        payment: {
            reference: string;
            amountRwf: number;
            paidAt: string;
            remittedAt: string | null;
        } | null;
        withdrawnAt: string | null;
        form: {
            gender: "female" | "male";
            dateOfBirth: string;
            phoneE164: string;
            companyName: string;
            streetAddress: string;
            website: string | null;
            companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
            ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationNumber: string | null;
            registrationType: string;
            idDocumentType: "national_id" | "passport";
            idDocumentNumber: string;
        };
    } | null;
    history: {
        status: "submitted" | "approved" | "declined" | "member" | "withdrawn";
        id: string;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        requestedTierCode: string;
        declaredFeeRwf: number | null;
        decidedAt: string | null;
        submittedAt: string;
        requestedTierName: string;
        quotedPriceKind: "minimum" | "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        decisionNote: string | null;
        approvedMembershipNumber: string | null;
        approvedFeeRwf: number | null;
        payment: {
            reference: string;
            amountRwf: number;
            paidAt: string;
            remittedAt: string | null;
        } | null;
        withdrawnAt: string | null;
        form: {
            gender: "female" | "male";
            dateOfBirth: string;
            phoneE164: string;
            companyName: string;
            streetAddress: string;
            website: string | null;
            companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
            ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationNumber: string | null;
            registrationType: string;
            idDocumentType: "national_id" | "passport";
            idDocumentNumber: string;
        };
    }[];
    canApply: boolean;
    prefill: {
        gender?: "female" | "male" | undefined;
        dateOfBirth?: string | undefined;
        phoneE164?: string | undefined;
        companyName?: string | undefined;
        streetAddress?: string | undefined;
        website?: string | undefined;
        companyType?: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader" | undefined;
        ownership?: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative" | undefined;
        ownershipOther?: string | undefined;
        businessActivity?: string | undefined;
        tradeDirection?: "none" | "export" | "import" | "both" | undefined;
        tradeGoods?: string | undefined;
        tradeCountries?: string[] | undefined;
        contactRole?: "owner" | "managing_director" | "ceo" | "chairman" | undefined;
        firstName?: string | undefined;
        lastName?: string | undefined;
        email?: string | undefined;
        idDocumentType?: "national_id" | "passport" | undefined;
        idDocumentNumber?: string | undefined;
    };
}>;
export type PsfMembershipOverview = z.infer<typeof PsfMembershipOverview>;
/**
 * One application as the admin business detail lists it (AC-20): its state,
 * tier and decision, WITHOUT the filed form. The form carries an ID number and
 * a date of birth, and the business detail is a read that asks for no reason.
 */
export declare const AdminPsfApplication: z.ZodObject<Omit<{
    id: z.ZodString;
    status: z.ZodEnum<["submitted", "approved", "member", "declined", "withdrawn"]>;
    requestedTierCode: z.ZodString;
    requestedTierName: z.ZodString;
    quotedPriceKind: z.ZodEnum<["fixed", "range", "minimum", "set_by_psf"]>;
    quotedFeeRwf: z.ZodNullable<z.ZodNumber>;
    quotedFeeMinRwf: z.ZodNullable<z.ZodNumber>;
    quotedFeeMaxRwf: z.ZodNullable<z.ZodNumber>;
    /** What the business said it would pay a year. Null for a tier PSF prices. */
    declaredFeeRwf: z.ZodNullable<z.ZodNumber>;
    submittedAt: z.ZodString;
    submittedCapacity: z.ZodEnum<["owner", "on_behalf_of"]>;
    /** Named so an owner can see an application sent on their behalf (AC-17). */
    submittedByName: z.ZodNullable<z.ZodString>;
    queuedAt: z.ZodNullable<z.ZodString>;
    decidedAt: z.ZodNullable<z.ZodString>;
    declineReason: z.ZodNullable<z.ZodEnum<["details_incomplete", "not_eligible_for_tier", "business_not_recognised", "other"]>>;
    decisionNote: z.ZodNullable<z.ZodString>;
    /** Set on approval: the number PSF gave, and what the business now owes. */
    approvedMembershipNumber: z.ZodNullable<z.ZodString>;
    approvedFeeRwf: z.ZodNullable<z.ZodNumber>;
    payment: z.ZodNullable<z.ZodObject<{
        paidAt: z.ZodString;
        amountRwf: z.ZodNumber;
        /** The provider's own reference, which a receipt quotes. */
        reference: z.ZodString;
        /** Whether Injishi has passed the money on to PSF yet. */
        remittedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        reference: string;
        amountRwf: number;
        paidAt: string;
        remittedAt: string | null;
    }, {
        reference: string;
        amountRwf: number;
        paidAt: string;
        remittedAt: string | null;
    }>>;
    withdrawnAt: z.ZodNullable<z.ZodString>;
    form: z.ZodObject<{
        companyName: z.ZodString;
        /** `tin`, `rca`, `rgb`, `other` or `none` (see `REGISTRATION_TYPE_SHORT`). */
        registrationType: z.ZodString;
        /** Null for a business registered nowhere yet. */
        registrationNumber: z.ZodNullable<z.ZodString>;
        website: z.ZodNullable<z.ZodString>;
        streetAddress: z.ZodString;
        companyType: z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>;
        ownership: z.ZodEnum<["rwandan_100", "foreign_100", "franchise", "joint_venture", "foreign_representative", "other"]>;
        ownershipOther: z.ZodNullable<z.ZodString>;
        businessActivity: z.ZodString;
        tradeDirection: z.ZodEnum<["none", "export", "import", "both"]>;
        tradeGoods: z.ZodNullable<z.ZodString>;
        tradeCountries: z.ZodArray<z.ZodString, "many">;
        contactRole: z.ZodEnum<["owner", "managing_director", "ceo", "chairman"]>;
        firstName: z.ZodString;
        lastName: z.ZodString;
        gender: z.ZodEnum<["male", "female"]>;
        phoneE164: z.ZodString;
        email: z.ZodString;
        idDocumentType: z.ZodEnum<["national_id", "passport"]>;
        idDocumentNumber: z.ZodString;
        dateOfBirth: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        gender: "female" | "male";
        dateOfBirth: string;
        phoneE164: string;
        companyName: string;
        streetAddress: string;
        website: string | null;
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
        ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
        ownershipOther: string | null;
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeGoods: string | null;
        tradeCountries: string[];
        contactRole: "owner" | "managing_director" | "ceo" | "chairman";
        firstName: string;
        lastName: string;
        email: string;
        registrationNumber: string | null;
        registrationType: string;
        idDocumentType: "national_id" | "passport";
        idDocumentNumber: string;
    }, {
        gender: "female" | "male";
        dateOfBirth: string;
        phoneE164: string;
        companyName: string;
        streetAddress: string;
        website: string | null;
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
        ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
        ownershipOther: string | null;
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeGoods: string | null;
        tradeCountries: string[];
        contactRole: "owner" | "managing_director" | "ceo" | "chairman";
        firstName: string;
        lastName: string;
        email: string;
        registrationNumber: string | null;
        registrationType: string;
        idDocumentType: "national_id" | "passport";
        idDocumentNumber: string;
    }>;
}, "form">, "strip", z.ZodTypeAny, {
    status: "submitted" | "approved" | "declined" | "member" | "withdrawn";
    id: string;
    declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
    requestedTierCode: string;
    declaredFeeRwf: number | null;
    decidedAt: string | null;
    submittedAt: string;
    requestedTierName: string;
    quotedPriceKind: "minimum" | "fixed" | "range" | "set_by_psf";
    quotedFeeRwf: number | null;
    quotedFeeMinRwf: number | null;
    quotedFeeMaxRwf: number | null;
    submittedCapacity: "owner" | "on_behalf_of";
    submittedByName: string | null;
    queuedAt: string | null;
    decisionNote: string | null;
    approvedMembershipNumber: string | null;
    approvedFeeRwf: number | null;
    payment: {
        reference: string;
        amountRwf: number;
        paidAt: string;
        remittedAt: string | null;
    } | null;
    withdrawnAt: string | null;
}, {
    status: "submitted" | "approved" | "declined" | "member" | "withdrawn";
    id: string;
    declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
    requestedTierCode: string;
    declaredFeeRwf: number | null;
    decidedAt: string | null;
    submittedAt: string;
    requestedTierName: string;
    quotedPriceKind: "minimum" | "fixed" | "range" | "set_by_psf";
    quotedFeeRwf: number | null;
    quotedFeeMinRwf: number | null;
    quotedFeeMaxRwf: number | null;
    submittedCapacity: "owner" | "on_behalf_of";
    submittedByName: string | null;
    queuedAt: string | null;
    decisionNote: string | null;
    approvedMembershipNumber: string | null;
    approvedFeeRwf: number | null;
    payment: {
        reference: string;
        amountRwf: number;
        paidAt: string;
        remittedAt: string | null;
    } | null;
    withdrawnAt: string | null;
}>;
export type AdminPsfApplication = z.infer<typeof AdminPsfApplication>;
/** The PSF section of the admin business detail (AC-20). */
export declare const AdminOrgPsf: z.ZodObject<{
    membership: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        source: z.ZodEnum<["psf_confirmed", "self_declared", "psf_record"]>;
        tierCode: z.ZodNullable<z.ZodString>;
        tierName: z.ZodNullable<z.ZodString>;
        membershipNumber: z.ZodString;
        annualFeeRwf: z.ZodNullable<z.ZodNumber>;
        startsOn: z.ZodNullable<z.ZodString>;
        expiresOn: z.ZodNullable<z.ZodString>;
        endedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        expiresOn: string | null;
        annualFeeRwf: number | null;
        source: "psf_confirmed" | "self_declared" | "psf_record";
        tierCode: string | null;
        tierName: string | null;
        membershipNumber: string;
        startsOn: string | null;
        endedAt: string | null;
    }, {
        id: string;
        expiresOn: string | null;
        annualFeeRwf: number | null;
        source: "psf_confirmed" | "self_declared" | "psf_record";
        tierCode: string | null;
        tierName: string | null;
        membershipNumber: string;
        startsOn: string | null;
        endedAt: string | null;
    }>>;
    applications: z.ZodArray<z.ZodObject<Omit<{
        id: z.ZodString;
        status: z.ZodEnum<["submitted", "approved", "member", "declined", "withdrawn"]>;
        requestedTierCode: z.ZodString;
        requestedTierName: z.ZodString;
        quotedPriceKind: z.ZodEnum<["fixed", "range", "minimum", "set_by_psf"]>;
        quotedFeeRwf: z.ZodNullable<z.ZodNumber>;
        quotedFeeMinRwf: z.ZodNullable<z.ZodNumber>;
        quotedFeeMaxRwf: z.ZodNullable<z.ZodNumber>;
        /** What the business said it would pay a year. Null for a tier PSF prices. */
        declaredFeeRwf: z.ZodNullable<z.ZodNumber>;
        submittedAt: z.ZodString;
        submittedCapacity: z.ZodEnum<["owner", "on_behalf_of"]>;
        /** Named so an owner can see an application sent on their behalf (AC-17). */
        submittedByName: z.ZodNullable<z.ZodString>;
        queuedAt: z.ZodNullable<z.ZodString>;
        decidedAt: z.ZodNullable<z.ZodString>;
        declineReason: z.ZodNullable<z.ZodEnum<["details_incomplete", "not_eligible_for_tier", "business_not_recognised", "other"]>>;
        decisionNote: z.ZodNullable<z.ZodString>;
        /** Set on approval: the number PSF gave, and what the business now owes. */
        approvedMembershipNumber: z.ZodNullable<z.ZodString>;
        approvedFeeRwf: z.ZodNullable<z.ZodNumber>;
        payment: z.ZodNullable<z.ZodObject<{
            paidAt: z.ZodString;
            amountRwf: z.ZodNumber;
            /** The provider's own reference, which a receipt quotes. */
            reference: z.ZodString;
            /** Whether Injishi has passed the money on to PSF yet. */
            remittedAt: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            reference: string;
            amountRwf: number;
            paidAt: string;
            remittedAt: string | null;
        }, {
            reference: string;
            amountRwf: number;
            paidAt: string;
            remittedAt: string | null;
        }>>;
        withdrawnAt: z.ZodNullable<z.ZodString>;
        form: z.ZodObject<{
            companyName: z.ZodString;
            /** `tin`, `rca`, `rgb`, `other` or `none` (see `REGISTRATION_TYPE_SHORT`). */
            registrationType: z.ZodString;
            /** Null for a business registered nowhere yet. */
            registrationNumber: z.ZodNullable<z.ZodString>;
            website: z.ZodNullable<z.ZodString>;
            streetAddress: z.ZodString;
            companyType: z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>;
            ownership: z.ZodEnum<["rwandan_100", "foreign_100", "franchise", "joint_venture", "foreign_representative", "other"]>;
            ownershipOther: z.ZodNullable<z.ZodString>;
            businessActivity: z.ZodString;
            tradeDirection: z.ZodEnum<["none", "export", "import", "both"]>;
            tradeGoods: z.ZodNullable<z.ZodString>;
            tradeCountries: z.ZodArray<z.ZodString, "many">;
            contactRole: z.ZodEnum<["owner", "managing_director", "ceo", "chairman"]>;
            firstName: z.ZodString;
            lastName: z.ZodString;
            gender: z.ZodEnum<["male", "female"]>;
            phoneE164: z.ZodString;
            email: z.ZodString;
            idDocumentType: z.ZodEnum<["national_id", "passport"]>;
            idDocumentNumber: z.ZodString;
            dateOfBirth: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            gender: "female" | "male";
            dateOfBirth: string;
            phoneE164: string;
            companyName: string;
            streetAddress: string;
            website: string | null;
            companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
            ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationNumber: string | null;
            registrationType: string;
            idDocumentType: "national_id" | "passport";
            idDocumentNumber: string;
        }, {
            gender: "female" | "male";
            dateOfBirth: string;
            phoneE164: string;
            companyName: string;
            streetAddress: string;
            website: string | null;
            companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
            ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationNumber: string | null;
            registrationType: string;
            idDocumentType: "national_id" | "passport";
            idDocumentNumber: string;
        }>;
    }, "form">, "strip", z.ZodTypeAny, {
        status: "submitted" | "approved" | "declined" | "member" | "withdrawn";
        id: string;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        requestedTierCode: string;
        declaredFeeRwf: number | null;
        decidedAt: string | null;
        submittedAt: string;
        requestedTierName: string;
        quotedPriceKind: "minimum" | "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        decisionNote: string | null;
        approvedMembershipNumber: string | null;
        approvedFeeRwf: number | null;
        payment: {
            reference: string;
            amountRwf: number;
            paidAt: string;
            remittedAt: string | null;
        } | null;
        withdrawnAt: string | null;
    }, {
        status: "submitted" | "approved" | "declined" | "member" | "withdrawn";
        id: string;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        requestedTierCode: string;
        declaredFeeRwf: number | null;
        decidedAt: string | null;
        submittedAt: string;
        requestedTierName: string;
        quotedPriceKind: "minimum" | "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        decisionNote: string | null;
        approvedMembershipNumber: string | null;
        approvedFeeRwf: number | null;
        payment: {
            reference: string;
            amountRwf: number;
            paidAt: string;
            remittedAt: string | null;
        } | null;
        withdrawnAt: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    membership: {
        id: string;
        expiresOn: string | null;
        annualFeeRwf: number | null;
        source: "psf_confirmed" | "self_declared" | "psf_record";
        tierCode: string | null;
        tierName: string | null;
        membershipNumber: string;
        startsOn: string | null;
        endedAt: string | null;
    } | null;
    applications: {
        status: "submitted" | "approved" | "declined" | "member" | "withdrawn";
        id: string;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        requestedTierCode: string;
        declaredFeeRwf: number | null;
        decidedAt: string | null;
        submittedAt: string;
        requestedTierName: string;
        quotedPriceKind: "minimum" | "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        decisionNote: string | null;
        approvedMembershipNumber: string | null;
        approvedFeeRwf: number | null;
        payment: {
            reference: string;
            amountRwf: number;
            paidAt: string;
            remittedAt: string | null;
        } | null;
        withdrawnAt: string | null;
    }[];
}, {
    membership: {
        id: string;
        expiresOn: string | null;
        annualFeeRwf: number | null;
        source: "psf_confirmed" | "self_declared" | "psf_record";
        tierCode: string | null;
        tierName: string | null;
        membershipNumber: string;
        startsOn: string | null;
        endedAt: string | null;
    } | null;
    applications: {
        status: "submitted" | "approved" | "declined" | "member" | "withdrawn";
        id: string;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        requestedTierCode: string;
        declaredFeeRwf: number | null;
        decidedAt: string | null;
        submittedAt: string;
        requestedTierName: string;
        quotedPriceKind: "minimum" | "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        decisionNote: string | null;
        approvedMembershipNumber: string | null;
        approvedFeeRwf: number | null;
        payment: {
            reference: string;
            amountRwf: number;
            paidAt: string;
            remittedAt: string | null;
        } | null;
        withdrawnAt: string | null;
    }[];
}>;
export type AdminOrgPsf = z.infer<typeof AdminOrgPsf>;
/** `POST /orgs/:orgId/psf-applications` (AC-16). */
export declare const CreatePsfApplicationRequest: z.ZodEffects<z.ZodObject<{
    requestedTierCode: z.ZodString;
    declaredFeeRwf: z.ZodOptional<z.ZodEffects<z.ZodNumber, number, number>>;
    companyName: z.ZodOptional<z.ZodString>;
    streetAddress: z.ZodOptional<z.ZodString>;
    associationCode: z.ZodOptional<z.ZodString>;
    associationOther: z.ZodOptional<z.ZodString>;
    subsectorId: z.ZodOptional<z.ZodString>;
    subsectorOther: z.ZodOptional<z.ZodString>;
    website: z.ZodOptional<z.ZodString>;
    companyType: z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>;
    ownership: z.ZodEnum<["rwandan_100", "foreign_100", "franchise", "joint_venture", "foreign_representative", "other"]>;
    ownershipOther: z.ZodOptional<z.ZodString>;
    businessActivity: z.ZodString;
    tradeDirection: z.ZodEnum<["none", "export", "import", "both"]>;
    tradeGoods: z.ZodOptional<z.ZodString>;
    tradeCountries: z.ZodDefault<z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">>;
    contactRole: z.ZodOptional<z.ZodEnum<["owner", "managing_director", "ceo", "chairman"]>>;
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodEnum<["male", "female"]>>;
    phoneE164: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
    email: z.ZodOptional<z.ZodString>;
    idDocument: z.ZodOptional<z.ZodDiscriminatedUnion<"documentType", [z.ZodObject<{
        documentType: z.ZodLiteral<"national_id">;
        documentNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        documentType: "national_id";
        documentNumber: string;
    }, {
        documentType: "national_id";
        documentNumber: string;
    }>, z.ZodObject<{
        documentType: z.ZodLiteral<"passport">;
        documentNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        documentType: "passport";
        documentNumber: string;
    }, {
        documentType: "passport";
        documentNumber: string;
    }>]>>;
    useDocumentOnFile: z.ZodOptional<z.ZodLiteral<true>>;
    dateOfBirth: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    consent: z.ZodLiteral<true>;
}, "strip", z.ZodTypeAny, {
    requestedTierCode: string;
    companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
    ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
    businessActivity: string;
    tradeDirection: "none" | "export" | "import" | "both";
    tradeCountries: string[];
    consent: true;
    gender?: "female" | "male" | undefined;
    dateOfBirth?: string | undefined;
    phoneE164?: string | undefined;
    declaredFeeRwf?: number | undefined;
    companyName?: string | undefined;
    streetAddress?: string | undefined;
    associationCode?: string | undefined;
    associationOther?: string | undefined;
    subsectorId?: string | undefined;
    subsectorOther?: string | undefined;
    website?: string | undefined;
    ownershipOther?: string | undefined;
    tradeGoods?: string | undefined;
    contactRole?: "owner" | "managing_director" | "ceo" | "chairman" | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    email?: string | undefined;
    idDocument?: {
        documentType: "national_id";
        documentNumber: string;
    } | {
        documentType: "passport";
        documentNumber: string;
    } | undefined;
    useDocumentOnFile?: true | undefined;
}, {
    requestedTierCode: string;
    companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
    ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
    businessActivity: string;
    tradeDirection: "none" | "export" | "import" | "both";
    consent: true;
    gender?: "female" | "male" | undefined;
    dateOfBirth?: string | undefined;
    phoneE164?: string | undefined;
    declaredFeeRwf?: number | undefined;
    companyName?: string | undefined;
    streetAddress?: string | undefined;
    associationCode?: string | undefined;
    associationOther?: string | undefined;
    subsectorId?: string | undefined;
    subsectorOther?: string | undefined;
    website?: string | undefined;
    ownershipOther?: string | undefined;
    tradeGoods?: string | undefined;
    tradeCountries?: string[] | undefined;
    contactRole?: "owner" | "managing_director" | "ceo" | "chairman" | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    email?: string | undefined;
    idDocument?: {
        documentType: "national_id";
        documentNumber: string;
    } | {
        documentType: "passport";
        documentNumber: string;
    } | undefined;
    useDocumentOnFile?: true | undefined;
}>, {
    requestedTierCode: string;
    companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
    ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
    businessActivity: string;
    tradeDirection: "none" | "export" | "import" | "both";
    tradeCountries: string[];
    consent: true;
    gender?: "female" | "male" | undefined;
    dateOfBirth?: string | undefined;
    phoneE164?: string | undefined;
    declaredFeeRwf?: number | undefined;
    companyName?: string | undefined;
    streetAddress?: string | undefined;
    associationCode?: string | undefined;
    associationOther?: string | undefined;
    subsectorId?: string | undefined;
    subsectorOther?: string | undefined;
    website?: string | undefined;
    ownershipOther?: string | undefined;
    tradeGoods?: string | undefined;
    contactRole?: "owner" | "managing_director" | "ceo" | "chairman" | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    email?: string | undefined;
    idDocument?: {
        documentType: "national_id";
        documentNumber: string;
    } | {
        documentType: "passport";
        documentNumber: string;
    } | undefined;
    useDocumentOnFile?: true | undefined;
}, {
    requestedTierCode: string;
    companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
    ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
    businessActivity: string;
    tradeDirection: "none" | "export" | "import" | "both";
    consent: true;
    gender?: "female" | "male" | undefined;
    dateOfBirth?: string | undefined;
    phoneE164?: string | undefined;
    declaredFeeRwf?: number | undefined;
    companyName?: string | undefined;
    streetAddress?: string | undefined;
    associationCode?: string | undefined;
    associationOther?: string | undefined;
    subsectorId?: string | undefined;
    subsectorOther?: string | undefined;
    website?: string | undefined;
    ownershipOther?: string | undefined;
    tradeGoods?: string | undefined;
    tradeCountries?: string[] | undefined;
    contactRole?: "owner" | "managing_director" | "ceo" | "chairman" | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    email?: string | undefined;
    idDocument?: {
        documentType: "national_id";
        documentNumber: string;
    } | {
        documentType: "passport";
        documentNumber: string;
    } | undefined;
    useDocumentOnFile?: true | undefined;
}>;
export type CreatePsfApplicationRequest = z.infer<typeof CreatePsfApplicationRequest>;
/**
 * `POST /orgs/:orgId/psf-applications/:id/pay`: pay an approved application's
 * fee by mobile money. The number the prompt goes to; the amount is the one on
 * the approval, never the request's.
 */
export declare const PayPsfMembershipRequest: z.ZodObject<{
    phoneE164: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
}, "strip", z.ZodTypeAny, {
    phoneE164: string;
}, {
    phoneE164: string;
}>;
export type PayPsfMembershipRequest = z.infer<typeof PayPsfMembershipRequest>;
/**
 * A BRANCH of a business that applied through the public form (2026-10-23):
 * another place it trades from. Each is admitted by the PSF officer of the
 * branch's own district, beside the head office's decision on the business,
 * so a business in Kicukiro with a shop in Musanze is seen in both offices.
 */
export declare const PsfBranchStatus: z.ZodEnum<["pending", "admitted", "declined"]>;
export type PsfBranchStatus = z.infer<typeof PsfBranchStatus>;
export declare const PSF_BRANCH_STATUS_LABEL: Readonly<Record<PsfBranchStatus, string>>;
/** A branch trades under the business's own name, so it is told apart by where it is. */
export declare const PsfApplicationBranch: z.ZodObject<{
    id: z.ZodString;
    districtId: z.ZodNumber;
    districtName: z.ZodNullable<z.ZodString>;
    sectorName: z.ZodNullable<z.ZodString>;
    street: z.ZodString;
    status: z.ZodEnum<["pending", "admitted", "declined"]>;
    note: z.ZodNullable<z.ZodString>;
    decidedAt: z.ZodNullable<z.ZodString>;
    /** True when this officer covers the branch's district, it waits on PSF, and they hold no stake. */
    canDecide: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "declined" | "admitted";
    id: string;
    districtName: string | null;
    districtId: number;
    street: string;
    decidedAt: string | null;
    sectorName: string | null;
    note: string | null;
    canDecide: boolean;
}, {
    status: "pending" | "declined" | "admitted";
    id: string;
    districtName: string | null;
    districtId: number;
    street: string;
    decidedAt: string | null;
    sectorName: string | null;
    note: string | null;
    canDecide: boolean;
}>;
export type PsfApplicationBranch = z.infer<typeof PsfApplicationBranch>;
/** Admitting or declining one branch. A decline says why, so the business knows. */
export declare const PsfBranchDecisionRequest: z.ZodEffects<z.ZodObject<{
    decision: z.ZodEnum<["admit", "decline"]>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    decision: "admit" | "decline";
    note?: string | undefined;
}, {
    decision: "admit" | "decline";
    note?: string | undefined;
}>, {
    decision: "admit" | "decline";
    note?: string | undefined;
}, {
    decision: "admit" | "decline";
    note?: string | undefined;
}>;
export type PsfBranchDecisionRequest = z.infer<typeof PsfBranchDecisionRequest>;
/**
 * Where an application was sent from (2026-11-02): the public PSF form (no account, tracked by docID),
 * or Injishi's business registration, which files one when the business chooses to apply.
 */
export declare const PsfApplicationOrigin: z.ZodEnum<["psf_form", "registration"]>;
export type PsfApplicationOrigin = z.infer<typeof PsfApplicationOrigin>;
export declare const PSF_APPLICATION_ORIGIN_LABEL: Readonly<Record<PsfApplicationOrigin, string>>;
/**
 * How a business came in (2026-11-02, 0132): a new application, or a holder of an old PSF card, with
 * no number or certificate in the new module, joining it. A card holder pays nothing now, is given a
 * new number, and keeps the year on its card.
 */
export declare const PsfApplicationIntake: z.ZodEnum<["new", "card_holder"]>;
export type PsfApplicationIntake = z.infer<typeof PsfApplicationIntake>;
export declare const PSF_APPLICATION_INTAKE_LABEL: Readonly<Record<PsfApplicationIntake, string>>;
export declare const PsfQueueItem: z.ZodObject<{
    applicationId: z.ZodString;
    /** New, or a card holder joining the new module (2026-11-02). */
    intake: z.ZodDefault<z.ZodEnum<["new", "card_holder"]>>;
    /** Where it was sent from: the public PSF form, or Injishi's business registration. */
    origin: z.ZodDefault<z.ZodEnum<["psf_form", "registration"]>>;
    orgId: z.ZodString;
    businessName: z.ZodString;
    businessCode: z.ZodNullable<z.ZodString>;
    domain: z.ZodEnum<["hospitality", "residence", "enterprise"]>;
    districtName: z.ZodNullable<z.ZodString>;
    associationName: z.ZodNullable<z.ZodString>;
    subsectorName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    ownerGroups: z.ZodArray<z.ZodEnum<["women", "youth", "pwd"]>, "many">;
    requestedTierName: z.ZodString;
    declaredFeeRwf: z.ZodNullable<z.ZodNumber>;
    submittedAt: z.ZodString;
    queuedAt: z.ZodNullable<z.ZodString>;
    registrationStatus: z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>;
    /** False when the officer holds a stake in the business (AC-14). */
    canDecide: z.ZodBoolean;
    districtId: z.ZodNullable<z.ZodNumber>;
    /** Whole days since it reached the queue. */
    waitingDays: z.ZodNumber;
    /** The docID a public applicant tracks it by; null for a hotel's. */
    docId: z.ZodNullable<z.ZodString>;
    clusterName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    /** What the business already paid for its membership, when it paid before review. */
    paidRwf: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    /**
     * False when the officer is here only for a branch: the head office is in
     * another district, whose officer decides the business itself.
     */
    headOfficeInScope: z.ZodDefault<z.ZodBoolean>;
    /** Branches in this officer's region still waiting on PSF. */
    branchesPending: z.ZodDefault<z.ZodNumber>;
    /**
     * Whether this officer is the one who decides it (2026-10-23): the PSF
     * District Manager of its district. A province or national manager reads
     * the queue for reporting and never decides.
     */
    decidesHere: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    domain: "hospitality" | "residence" | "enterprise";
    districtName: string | null;
    districtId: number | null;
    declaredFeeRwf: number | null;
    ownerGroups: ("women" | "youth" | "pwd")[];
    orgId: string;
    submittedAt: string;
    businessCode: string | null;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    requestedTierName: string;
    queuedAt: string | null;
    clusterName: string | null;
    subsectorName: string | null;
    associationName: string | null;
    canDecide: boolean;
    applicationId: string;
    intake: "new" | "card_holder";
    origin: "registration" | "psf_form";
    businessName: string;
    waitingDays: number;
    docId: string | null;
    paidRwf: number | null;
    headOfficeInScope: boolean;
    branchesPending: number;
    decidesHere: boolean;
}, {
    domain: "hospitality" | "residence" | "enterprise";
    districtName: string | null;
    districtId: number | null;
    declaredFeeRwf: number | null;
    ownerGroups: ("women" | "youth" | "pwd")[];
    orgId: string;
    submittedAt: string;
    businessCode: string | null;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    requestedTierName: string;
    queuedAt: string | null;
    associationName: string | null;
    canDecide: boolean;
    applicationId: string;
    businessName: string;
    waitingDays: number;
    docId: string | null;
    clusterName?: string | null | undefined;
    subsectorName?: string | null | undefined;
    intake?: "new" | "card_holder" | undefined;
    origin?: "registration" | "psf_form" | undefined;
    paidRwf?: number | null | undefined;
    headOfficeInScope?: boolean | undefined;
    branchesPending?: number | undefined;
    decidesHere?: boolean | undefined;
}>;
export type PsfQueueItem = z.infer<typeof PsfQueueItem>;
export declare const PsfQueuePage: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        applicationId: z.ZodString;
        /** New, or a card holder joining the new module (2026-11-02). */
        intake: z.ZodDefault<z.ZodEnum<["new", "card_holder"]>>;
        /** Where it was sent from: the public PSF form, or Injishi's business registration. */
        origin: z.ZodDefault<z.ZodEnum<["psf_form", "registration"]>>;
        orgId: z.ZodString;
        businessName: z.ZodString;
        businessCode: z.ZodNullable<z.ZodString>;
        domain: z.ZodEnum<["hospitality", "residence", "enterprise"]>;
        districtName: z.ZodNullable<z.ZodString>;
        associationName: z.ZodNullable<z.ZodString>;
        subsectorName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        ownerGroups: z.ZodArray<z.ZodEnum<["women", "youth", "pwd"]>, "many">;
        requestedTierName: z.ZodString;
        declaredFeeRwf: z.ZodNullable<z.ZodNumber>;
        submittedAt: z.ZodString;
        queuedAt: z.ZodNullable<z.ZodString>;
        registrationStatus: z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>;
        /** False when the officer holds a stake in the business (AC-14). */
        canDecide: z.ZodBoolean;
        districtId: z.ZodNullable<z.ZodNumber>;
        /** Whole days since it reached the queue. */
        waitingDays: z.ZodNumber;
        /** The docID a public applicant tracks it by; null for a hotel's. */
        docId: z.ZodNullable<z.ZodString>;
        clusterName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        /** What the business already paid for its membership, when it paid before review. */
        paidRwf: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        /**
         * False when the officer is here only for a branch: the head office is in
         * another district, whose officer decides the business itself.
         */
        headOfficeInScope: z.ZodDefault<z.ZodBoolean>;
        /** Branches in this officer's region still waiting on PSF. */
        branchesPending: z.ZodDefault<z.ZodNumber>;
        /**
         * Whether this officer is the one who decides it (2026-10-23): the PSF
         * District Manager of its district. A province or national manager reads
         * the queue for reporting and never decides.
         */
        decidesHere: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        domain: "hospitality" | "residence" | "enterprise";
        districtName: string | null;
        districtId: number | null;
        declaredFeeRwf: number | null;
        ownerGroups: ("women" | "youth" | "pwd")[];
        orgId: string;
        submittedAt: string;
        businessCode: string | null;
        registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        requestedTierName: string;
        queuedAt: string | null;
        clusterName: string | null;
        subsectorName: string | null;
        associationName: string | null;
        canDecide: boolean;
        applicationId: string;
        intake: "new" | "card_holder";
        origin: "registration" | "psf_form";
        businessName: string;
        waitingDays: number;
        docId: string | null;
        paidRwf: number | null;
        headOfficeInScope: boolean;
        branchesPending: number;
        decidesHere: boolean;
    }, {
        domain: "hospitality" | "residence" | "enterprise";
        districtName: string | null;
        districtId: number | null;
        declaredFeeRwf: number | null;
        ownerGroups: ("women" | "youth" | "pwd")[];
        orgId: string;
        submittedAt: string;
        businessCode: string | null;
        registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        requestedTierName: string;
        queuedAt: string | null;
        associationName: string | null;
        canDecide: boolean;
        applicationId: string;
        businessName: string;
        waitingDays: number;
        docId: string | null;
        clusterName?: string | null | undefined;
        subsectorName?: string | null | undefined;
        intake?: "new" | "card_holder" | undefined;
        origin?: "registration" | "psf_form" | undefined;
        paidRwf?: number | null | undefined;
        headOfficeInScope?: boolean | undefined;
        branchesPending?: number | undefined;
        decidesHere?: boolean | undefined;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
    /** How many match the filters, across every page. */
    total: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    items: {
        domain: "hospitality" | "residence" | "enterprise";
        districtName: string | null;
        districtId: number | null;
        declaredFeeRwf: number | null;
        ownerGroups: ("women" | "youth" | "pwd")[];
        orgId: string;
        submittedAt: string;
        businessCode: string | null;
        registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        requestedTierName: string;
        queuedAt: string | null;
        clusterName: string | null;
        subsectorName: string | null;
        associationName: string | null;
        canDecide: boolean;
        applicationId: string;
        intake: "new" | "card_holder";
        origin: "registration" | "psf_form";
        businessName: string;
        waitingDays: number;
        docId: string | null;
        paidRwf: number | null;
        headOfficeInScope: boolean;
        branchesPending: number;
        decidesHere: boolean;
    }[];
    nextCursor: string | null;
    total: number;
}, {
    items: {
        domain: "hospitality" | "residence" | "enterprise";
        districtName: string | null;
        districtId: number | null;
        declaredFeeRwf: number | null;
        ownerGroups: ("women" | "youth" | "pwd")[];
        orgId: string;
        submittedAt: string;
        businessCode: string | null;
        registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        requestedTierName: string;
        queuedAt: string | null;
        associationName: string | null;
        canDecide: boolean;
        applicationId: string;
        businessName: string;
        waitingDays: number;
        docId: string | null;
        clusterName?: string | null | undefined;
        subsectorName?: string | null | undefined;
        intake?: "new" | "card_holder" | undefined;
        origin?: "registration" | "psf_form" | undefined;
        paidRwf?: number | null | undefined;
        headOfficeInScope?: boolean | undefined;
        branchesPending?: number | undefined;
        decidesHere?: boolean | undefined;
    }[];
    nextCursor: string | null;
    total?: number | undefined;
}>;
export type PsfQueuePage = z.infer<typeof PsfQueuePage>;
/** The same cursor shape the officer's decision log pages by. */
export declare const PsfQueueQuery: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    cursor?: string | undefined;
}, {
    cursor?: string | undefined;
}>;
export type PsfQueueQuery = z.infer<typeof PsfQueueQuery>;
export declare const PsfOfficerApplication: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<["submitted", "approved", "member", "declined", "withdrawn"]>;
    requestedTierCode: z.ZodString;
    requestedTierName: z.ZodString;
    quotedPriceKind: z.ZodEnum<["fixed", "range", "minimum", "set_by_psf"]>;
    quotedFeeRwf: z.ZodNullable<z.ZodNumber>;
    quotedFeeMinRwf: z.ZodNullable<z.ZodNumber>;
    quotedFeeMaxRwf: z.ZodNullable<z.ZodNumber>;
    /** What the business said it would pay a year. Null for a tier PSF prices. */
    declaredFeeRwf: z.ZodNullable<z.ZodNumber>;
    submittedAt: z.ZodString;
    submittedCapacity: z.ZodEnum<["owner", "on_behalf_of"]>;
    /** Named so an owner can see an application sent on their behalf (AC-17). */
    submittedByName: z.ZodNullable<z.ZodString>;
    queuedAt: z.ZodNullable<z.ZodString>;
    decidedAt: z.ZodNullable<z.ZodString>;
    declineReason: z.ZodNullable<z.ZodEnum<["details_incomplete", "not_eligible_for_tier", "business_not_recognised", "other"]>>;
    decisionNote: z.ZodNullable<z.ZodString>;
    /** Set on approval: the number PSF gave, and what the business now owes. */
    approvedMembershipNumber: z.ZodNullable<z.ZodString>;
    approvedFeeRwf: z.ZodNullable<z.ZodNumber>;
    payment: z.ZodNullable<z.ZodObject<{
        paidAt: z.ZodString;
        amountRwf: z.ZodNumber;
        /** The provider's own reference, which a receipt quotes. */
        reference: z.ZodString;
        /** Whether Injishi has passed the money on to PSF yet. */
        remittedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        reference: string;
        amountRwf: number;
        paidAt: string;
        remittedAt: string | null;
    }, {
        reference: string;
        amountRwf: number;
        paidAt: string;
        remittedAt: string | null;
    }>>;
    withdrawnAt: z.ZodNullable<z.ZodString>;
    form: z.ZodObject<{
        companyName: z.ZodString;
        /** `tin`, `rca`, `rgb`, `other` or `none` (see `REGISTRATION_TYPE_SHORT`). */
        registrationType: z.ZodString;
        /** Null for a business registered nowhere yet. */
        registrationNumber: z.ZodNullable<z.ZodString>;
        website: z.ZodNullable<z.ZodString>;
        streetAddress: z.ZodString;
        companyType: z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>;
        ownership: z.ZodEnum<["rwandan_100", "foreign_100", "franchise", "joint_venture", "foreign_representative", "other"]>;
        ownershipOther: z.ZodNullable<z.ZodString>;
        businessActivity: z.ZodString;
        tradeDirection: z.ZodEnum<["none", "export", "import", "both"]>;
        tradeGoods: z.ZodNullable<z.ZodString>;
        tradeCountries: z.ZodArray<z.ZodString, "many">;
        contactRole: z.ZodEnum<["owner", "managing_director", "ceo", "chairman"]>;
        firstName: z.ZodString;
        lastName: z.ZodString;
        gender: z.ZodEnum<["male", "female"]>;
        phoneE164: z.ZodString;
        email: z.ZodString;
        idDocumentType: z.ZodEnum<["national_id", "passport"]>;
        idDocumentNumber: z.ZodString;
        dateOfBirth: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        gender: "female" | "male";
        dateOfBirth: string;
        phoneE164: string;
        companyName: string;
        streetAddress: string;
        website: string | null;
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
        ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
        ownershipOther: string | null;
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeGoods: string | null;
        tradeCountries: string[];
        contactRole: "owner" | "managing_director" | "ceo" | "chairman";
        firstName: string;
        lastName: string;
        email: string;
        registrationNumber: string | null;
        registrationType: string;
        idDocumentType: "national_id" | "passport";
        idDocumentNumber: string;
    }, {
        gender: "female" | "male";
        dateOfBirth: string;
        phoneE164: string;
        companyName: string;
        streetAddress: string;
        website: string | null;
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
        ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
        ownershipOther: string | null;
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeGoods: string | null;
        tradeCountries: string[];
        contactRole: "owner" | "managing_director" | "ceo" | "chairman";
        firstName: string;
        lastName: string;
        email: string;
        registrationNumber: string | null;
        registrationType: string;
        idDocumentType: "national_id" | "passport";
        idDocumentNumber: string;
    }>;
} & {
    orgId: z.ZodString;
    /** New, or a card holder joining the new module (2026-11-02): confirmed with dates, no fee. */
    intake: z.ZodDefault<z.ZodEnum<["new", "card_holder"]>>;
    /** Where it was sent from: the public PSF form, or Injishi's business registration. */
    origin: z.ZodDefault<z.ZodEnum<["psf_form", "registration"]>>;
    businessName: z.ZodString;
    districtName: z.ZodNullable<z.ZodString>;
    registrationStatus: z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>;
    profile: z.ZodObject<{
        domain: z.ZodEnum<["hospitality", "residence", "enterprise"]>;
        businessCode: z.ZodNullable<z.ZodString>;
        districtName: z.ZodNullable<z.ZodString>;
        clusterName: z.ZodNullable<z.ZodString>;
        /** The subtype picked, or the one the business typed. */
        subsectorName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        associationName: z.ZodNullable<z.ZodString>;
        ownerGroups: z.ZodArray<z.ZodEnum<["women", "youth", "pwd"]>, "many">;
        registrationKind: z.ZodNullable<z.ZodEnum<["tin", "rca", "rgb", "other", "none"]>>;
    }, "strip", z.ZodTypeAny, {
        domain: "hospitality" | "residence" | "enterprise";
        districtName: string | null;
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
        ownerGroups: ("women" | "youth" | "pwd")[];
        businessCode: string | null;
        clusterName: string | null;
        subsectorName: string | null;
        associationName: string | null;
    }, {
        domain: "hospitality" | "residence" | "enterprise";
        districtName: string | null;
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
        ownerGroups: ("women" | "youth" | "pwd")[];
        businessCode: string | null;
        clusterName: string | null;
        associationName: string | null;
        subsectorName?: string | null | undefined;
    }>;
    canDecide: z.ZodBoolean;
    docId: z.ZodNullable<z.ZodString>;
    waitingDays: z.ZodNumber;
    /** The next number in this district's run for this year, for the approve dialog. */
    suggestedMembershipNumber: z.ZodNullable<z.ZodString>;
    /**
     * Paid before review (the public path, 2026-10-20): approving makes the
     * business a member at once. Declining keeps the fee: nothing is refunded
     * (2026-10-23).
     */
    paidBeforeReview: z.ZodDefault<z.ZodBoolean>;
    /** False when the officer reads it only for a branch in their district. */
    headOfficeInScope: z.ZodDefault<z.ZodBoolean>;
    branches: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        districtId: z.ZodNumber;
        districtName: z.ZodNullable<z.ZodString>;
        sectorName: z.ZodNullable<z.ZodString>;
        street: z.ZodString;
        status: z.ZodEnum<["pending", "admitted", "declined"]>;
        note: z.ZodNullable<z.ZodString>;
        decidedAt: z.ZodNullable<z.ZodString>;
        /** True when this officer covers the branch's district, it waits on PSF, and they hold no stake. */
        canDecide: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "declined" | "admitted";
        id: string;
        districtName: string | null;
        districtId: number;
        street: string;
        decidedAt: string | null;
        sectorName: string | null;
        note: string | null;
        canDecide: boolean;
    }, {
        status: "pending" | "declined" | "admitted";
        id: string;
        districtName: string | null;
        districtId: number;
        street: string;
        decidedAt: string | null;
        sectorName: string | null;
        note: string | null;
        canDecide: boolean;
    }>, "many">>;
    /** The officer is the District Manager who decides the business (2026-10-23); see `PsfQueueItem.decidesHere`. */
    decidesHere: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    status: "submitted" | "approved" | "declined" | "member" | "withdrawn";
    id: string;
    districtName: string | null;
    declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
    requestedTierCode: string;
    declaredFeeRwf: number | null;
    branches: {
        status: "pending" | "declined" | "admitted";
        id: string;
        districtName: string | null;
        districtId: number;
        street: string;
        decidedAt: string | null;
        sectorName: string | null;
        note: string | null;
        canDecide: boolean;
    }[];
    decidedAt: string | null;
    orgId: string;
    submittedAt: string;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    requestedTierName: string;
    quotedPriceKind: "minimum" | "fixed" | "range" | "set_by_psf";
    quotedFeeRwf: number | null;
    quotedFeeMinRwf: number | null;
    quotedFeeMaxRwf: number | null;
    submittedCapacity: "owner" | "on_behalf_of";
    submittedByName: string | null;
    queuedAt: string | null;
    decisionNote: string | null;
    approvedMembershipNumber: string | null;
    approvedFeeRwf: number | null;
    payment: {
        reference: string;
        amountRwf: number;
        paidAt: string;
        remittedAt: string | null;
    } | null;
    withdrawnAt: string | null;
    form: {
        gender: "female" | "male";
        dateOfBirth: string;
        phoneE164: string;
        companyName: string;
        streetAddress: string;
        website: string | null;
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
        ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
        ownershipOther: string | null;
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeGoods: string | null;
        tradeCountries: string[];
        contactRole: "owner" | "managing_director" | "ceo" | "chairman";
        firstName: string;
        lastName: string;
        email: string;
        registrationNumber: string | null;
        registrationType: string;
        idDocumentType: "national_id" | "passport";
        idDocumentNumber: string;
    };
    profile: {
        domain: "hospitality" | "residence" | "enterprise";
        districtName: string | null;
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
        ownerGroups: ("women" | "youth" | "pwd")[];
        businessCode: string | null;
        clusterName: string | null;
        subsectorName: string | null;
        associationName: string | null;
    };
    canDecide: boolean;
    intake: "new" | "card_holder";
    origin: "registration" | "psf_form";
    businessName: string;
    waitingDays: number;
    docId: string | null;
    headOfficeInScope: boolean;
    decidesHere: boolean;
    suggestedMembershipNumber: string | null;
    paidBeforeReview: boolean;
}, {
    status: "submitted" | "approved" | "declined" | "member" | "withdrawn";
    id: string;
    districtName: string | null;
    declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
    requestedTierCode: string;
    declaredFeeRwf: number | null;
    decidedAt: string | null;
    orgId: string;
    submittedAt: string;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    requestedTierName: string;
    quotedPriceKind: "minimum" | "fixed" | "range" | "set_by_psf";
    quotedFeeRwf: number | null;
    quotedFeeMinRwf: number | null;
    quotedFeeMaxRwf: number | null;
    submittedCapacity: "owner" | "on_behalf_of";
    submittedByName: string | null;
    queuedAt: string | null;
    decisionNote: string | null;
    approvedMembershipNumber: string | null;
    approvedFeeRwf: number | null;
    payment: {
        reference: string;
        amountRwf: number;
        paidAt: string;
        remittedAt: string | null;
    } | null;
    withdrawnAt: string | null;
    form: {
        gender: "female" | "male";
        dateOfBirth: string;
        phoneE164: string;
        companyName: string;
        streetAddress: string;
        website: string | null;
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
        ownership: "other" | "rwandan_100" | "foreign_100" | "franchise" | "joint_venture" | "foreign_representative";
        ownershipOther: string | null;
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeGoods: string | null;
        tradeCountries: string[];
        contactRole: "owner" | "managing_director" | "ceo" | "chairman";
        firstName: string;
        lastName: string;
        email: string;
        registrationNumber: string | null;
        registrationType: string;
        idDocumentType: "national_id" | "passport";
        idDocumentNumber: string;
    };
    profile: {
        domain: "hospitality" | "residence" | "enterprise";
        districtName: string | null;
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
        ownerGroups: ("women" | "youth" | "pwd")[];
        businessCode: string | null;
        clusterName: string | null;
        associationName: string | null;
        subsectorName?: string | null | undefined;
    };
    canDecide: boolean;
    businessName: string;
    waitingDays: number;
    docId: string | null;
    suggestedMembershipNumber: string | null;
    branches?: {
        status: "pending" | "declined" | "admitted";
        id: string;
        districtName: string | null;
        districtId: number;
        street: string;
        decidedAt: string | null;
        sectorName: string | null;
        note: string | null;
        canDecide: boolean;
    }[] | undefined;
    intake?: "new" | "card_holder" | undefined;
    origin?: "registration" | "psf_form" | undefined;
    headOfficeInScope?: boolean | undefined;
    decidesHere?: boolean | undefined;
    paidBeforeReview?: boolean | undefined;
}>;
export type PsfOfficerApplication = z.infer<typeof PsfOfficerApplication>;
/**
 * Approving an application (AC-11, as the PSF path changed it). PSF gives the
 * membership number now; the membership itself starts when the business pays.
 * The fee is the business's own declared amount, so the officer names one only
 * for a tier PSF prices itself.
 */
export declare const PsfApproveRequest: z.ZodObject<{
    membershipNumber: z.ZodString;
    feeRwf: z.ZodOptional<z.ZodEffects<z.ZodNumber, number, number>>;
    note: z.ZodOptional<z.ZodString>;
    /** A card holder's year, as its card shows it (2026-11-02). Required for a card holder, unused otherwise. */
    startsOn: z.ZodOptional<z.ZodString>;
    expiresOn: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    membershipNumber: string;
    expiresOn?: string | undefined;
    startsOn?: string | undefined;
    note?: string | undefined;
    feeRwf?: number | undefined;
}, {
    membershipNumber: string;
    expiresOn?: string | undefined;
    startsOn?: string | undefined;
    note?: string | undefined;
    feeRwf?: number | undefined;
}>;
export type PsfApproveRequest = z.infer<typeof PsfApproveRequest>;
/** Declining an application (AC-12). A note is required with `other`. */
export declare const PsfDeclineRequest: z.ZodEffects<z.ZodObject<{
    reason: z.ZodEnum<["details_incomplete", "not_eligible_for_tier", "business_not_recognised", "other"]>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised";
    note?: string | undefined;
}, {
    reason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised";
    note?: string | undefined;
}>, {
    reason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised";
    note?: string | undefined;
}, {
    reason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised";
    note?: string | undefined;
}>;
export type PsfDeclineRequest = z.infer<typeof PsfDeclineRequest>;
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
export declare const PsfStanding: z.ZodEnum<["not_applied", "claimed", "applied", "awaiting_payment", "member", "lapsed", "declined"]>;
export type PsfStanding = z.infer<typeof PsfStanding>;
export declare const PSF_STANDING_LABEL: Readonly<Record<PsfStanding, string>>;
/** The registers a business may be listed under: the PSF path, a hotel, or both. */
export declare const PsfBusinessKind: z.ZodEnum<["enterprise", "hospitality"]>;
export type PsfBusinessKind = z.infer<typeof PsfBusinessKind>;
/**
 * `GET /oversight/psf/businesses`. Every filter optional; together they narrow.
 * `district` must sit inside the officer's own region, or the list is empty.
 */
export declare const PsfBusinessesQuery: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    subsector: z.ZodOptional<z.ZodString>;
    district: z.ZodOptional<z.ZodNumber>;
    /** Narrow to one province of the officer's region (the province and national views). */
    province: z.ZodOptional<z.ZodNumber>;
    cluster: z.ZodOptional<z.ZodString>;
    association: z.ZodOptional<z.ZodString>;
    tier: z.ZodOptional<z.ZodString>;
    standing: z.ZodOptional<z.ZodEnum<["not_applied", "claimed", "applied", "awaiting_payment", "member", "lapsed", "declined"]>>;
    /** `due`: a current membership inside its renewal window, 60 days before it ends, or past it (2026-11-02). */
    renewal: z.ZodOptional<z.ZodEnum<["due"]>>;
    /**
     * `due`: an application sent and not paid (2026-11-02): the public form's payment at submit that did not go
     * through, or an approval still to pay. Such a business is not on the register otherwise.
     */
    payment: z.ZodOptional<z.ZodEnum<["due"]>>;
    group: z.ZodOptional<z.ZodEnum<["women", "youth", "pwd"]>>;
    tin: z.ZodOptional<z.ZodEnum<["with", "without"]>>;
    kind: z.ZodOptional<z.ZodEnum<["enterprise", "hospitality"]>>;
    cursor: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    province?: number | undefined;
    district?: number | undefined;
    kind?: "hospitality" | "enterprise" | undefined;
    tin?: "with" | "without" | undefined;
    cursor?: string | undefined;
    payment?: "due" | undefined;
    q?: string | undefined;
    subsector?: string | undefined;
    cluster?: string | undefined;
    association?: string | undefined;
    tier?: string | undefined;
    standing?: "declined" | "awaiting_payment" | "member" | "not_applied" | "claimed" | "applied" | "lapsed" | undefined;
    renewal?: "due" | undefined;
    group?: "women" | "youth" | "pwd" | undefined;
}, {
    province?: number | undefined;
    district?: number | undefined;
    kind?: "hospitality" | "enterprise" | undefined;
    tin?: "with" | "without" | undefined;
    cursor?: string | undefined;
    payment?: "due" | undefined;
    q?: string | undefined;
    subsector?: string | undefined;
    cluster?: string | undefined;
    association?: string | undefined;
    tier?: string | undefined;
    standing?: "declined" | "awaiting_payment" | "member" | "not_applied" | "claimed" | "applied" | "lapsed" | undefined;
    renewal?: "due" | undefined;
    group?: "women" | "youth" | "pwd" | undefined;
}>;
export type PsfBusinessesQuery = z.infer<typeof PsfBusinessesQuery>;
export declare const PsfBusinessRow: z.ZodObject<{
    orgId: z.ZodString;
    businessCode: z.ZodNullable<z.ZodString>;
    legalName: z.ZodString;
    domain: z.ZodEnum<["hospitality", "residence", "enterprise"]>;
    districtId: z.ZodNullable<z.ZodNumber>;
    districtName: z.ZodNullable<z.ZodString>;
    sectorName: z.ZodNullable<z.ZodString>;
    clusterCode: z.ZodNullable<z.ZodString>;
    clusterName: z.ZodNullable<z.ZodString>;
    subsectorName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    associationName: z.ZodNullable<z.ZodString>;
    associationAcronym: z.ZodNullable<z.ZodString>;
    ownerGroups: z.ZodArray<z.ZodEnum<["women", "youth", "pwd"]>, "many">;
    registrationKind: z.ZodNullable<z.ZodEnum<["tin", "rca", "rgb", "other", "none"]>>;
    hasTin: z.ZodBoolean;
    registeredAt: z.ZodString;
    standing: z.ZodEnum<["not_applied", "claimed", "applied", "awaiting_payment", "member", "lapsed", "declined"]>;
    tierName: z.ZodNullable<z.ZodString>;
    membershipNumber: z.ZodNullable<z.ZodString>;
    expiresOn: z.ZodNullable<z.ZodString>;
    /** The open application, when there is one, so the row can open it. */
    openApplicationId: z.ZodNullable<z.ZodString>;
    /** Paid in through Injishi: membership fees, and any registration fee. */
    paidRwf: z.ZodDefault<z.ZodNumber>;
    lastPaidAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    /** Its branches (2026-10-23): the other places it trades from, on its newest application. */
    branchCount: z.ZodDefault<z.ZodNumber>;
    /**
     * False when the officer sees it only because a branch is in their region:
     * its head office, and its decision, are another district's.
     */
    headOfficeInScope: z.ZodDefault<z.ZodBoolean>;
    /** The unpaid application, when one is waiting for its payment (2026-11-02): what is owed and who to reach. */
    paymentDue: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        amountRwf: z.ZodNullable<z.ZodNumber>;
        since: z.ZodString;
        docId: z.ZodNullable<z.ZodString>;
        contactName: z.ZodString;
        phoneE164: z.ZodNullable<z.ZodString>;
        email: z.ZodNullable<z.ZodString>;
        /** The last payment reminder an officer sent; one a day at most. */
        lastRemindedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        amountRwf: number | null;
        phoneE164: string | null;
        email: string | null;
        docId: string | null;
        since: string;
        contactName: string;
        lastRemindedAt: string | null;
    }, {
        amountRwf: number | null;
        phoneE164: string | null;
        email: string | null;
        docId: string | null;
        since: string;
        contactName: string;
        lastRemindedAt: string | null;
    }>>>;
}, "strip", z.ZodTypeAny, {
    domain: "hospitality" | "residence" | "enterprise";
    districtName: string | null;
    districtId: number | null;
    expiresOn: string | null;
    legalName: string;
    registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
    ownerGroups: ("women" | "youth" | "pwd")[];
    orgId: string;
    sectorName: string | null;
    businessCode: string | null;
    clusterCode: string | null;
    tierName: string | null;
    membershipNumber: string | null;
    clusterName: string | null;
    subsectorName: string | null;
    associationName: string | null;
    paidRwf: number;
    headOfficeInScope: boolean;
    standing: "declined" | "awaiting_payment" | "member" | "not_applied" | "claimed" | "applied" | "lapsed";
    associationAcronym: string | null;
    hasTin: boolean;
    registeredAt: string;
    openApplicationId: string | null;
    lastPaidAt: string | null;
    branchCount: number;
    paymentDue: {
        amountRwf: number | null;
        phoneE164: string | null;
        email: string | null;
        docId: string | null;
        since: string;
        contactName: string;
        lastRemindedAt: string | null;
    } | null;
}, {
    domain: "hospitality" | "residence" | "enterprise";
    districtName: string | null;
    districtId: number | null;
    expiresOn: string | null;
    legalName: string;
    registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
    ownerGroups: ("women" | "youth" | "pwd")[];
    orgId: string;
    sectorName: string | null;
    businessCode: string | null;
    clusterCode: string | null;
    tierName: string | null;
    membershipNumber: string | null;
    clusterName: string | null;
    associationName: string | null;
    standing: "declined" | "awaiting_payment" | "member" | "not_applied" | "claimed" | "applied" | "lapsed";
    associationAcronym: string | null;
    hasTin: boolean;
    registeredAt: string;
    openApplicationId: string | null;
    subsectorName?: string | null | undefined;
    paidRwf?: number | undefined;
    headOfficeInScope?: boolean | undefined;
    lastPaidAt?: string | null | undefined;
    branchCount?: number | undefined;
    paymentDue?: {
        amountRwf: number | null;
        phoneE164: string | null;
        email: string | null;
        docId: string | null;
        since: string;
        contactName: string;
        lastRemindedAt: string | null;
    } | null | undefined;
}>;
export type PsfBusinessRow = z.infer<typeof PsfBusinessRow>;
/** `POST /oversight/psf/payment-reminders`: remind one business, or every one waiting in the region. */
export declare const PsfPaymentReminderRequest: z.ZodObject<{
    orgId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    orgId?: string | undefined;
}, {
    orgId?: string | undefined;
}>;
export type PsfPaymentReminderRequest = z.infer<typeof PsfPaymentReminderRequest>;
export declare const PsfPaymentReminderResult: z.ZodObject<{
    sent: z.ZodNumber;
    /** Reminded within the last day already, so not again. */
    skipped: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    sent: number;
    skipped: number;
}, {
    sent: number;
    skipped: number;
}>;
export type PsfPaymentReminderResult = z.infer<typeof PsfPaymentReminderResult>;
/** One branch on a business's page, wherever it is: every officer who opens the business sees them all. */
export declare const PsfBusinessBranch: z.ZodObject<{
    id: z.ZodString;
    provinceName: z.ZodNullable<z.ZodString>;
    districtId: z.ZodNumber;
    districtName: z.ZodNullable<z.ZodString>;
    sectorName: z.ZodNullable<z.ZodString>;
    street: z.ZodString;
    status: z.ZodEnum<["pending", "admitted", "declined"]>;
    note: z.ZodNullable<z.ZodString>;
    /** In the officer's own region: theirs to decide on the application. */
    inScope: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "declined" | "admitted";
    id: string;
    districtName: string | null;
    districtId: number;
    street: string;
    sectorName: string | null;
    note: string | null;
    provinceName: string | null;
    inScope: boolean;
}, {
    status: "pending" | "declined" | "admitted";
    id: string;
    districtName: string | null;
    districtId: number;
    street: string;
    sectorName: string | null;
    note: string | null;
    provinceName: string | null;
    inScope: boolean;
}>;
export type PsfBusinessBranch = z.infer<typeof PsfBusinessBranch>;
export declare const PsfBusinessesPage: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        orgId: z.ZodString;
        businessCode: z.ZodNullable<z.ZodString>;
        legalName: z.ZodString;
        domain: z.ZodEnum<["hospitality", "residence", "enterprise"]>;
        districtId: z.ZodNullable<z.ZodNumber>;
        districtName: z.ZodNullable<z.ZodString>;
        sectorName: z.ZodNullable<z.ZodString>;
        clusterCode: z.ZodNullable<z.ZodString>;
        clusterName: z.ZodNullable<z.ZodString>;
        subsectorName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        associationName: z.ZodNullable<z.ZodString>;
        associationAcronym: z.ZodNullable<z.ZodString>;
        ownerGroups: z.ZodArray<z.ZodEnum<["women", "youth", "pwd"]>, "many">;
        registrationKind: z.ZodNullable<z.ZodEnum<["tin", "rca", "rgb", "other", "none"]>>;
        hasTin: z.ZodBoolean;
        registeredAt: z.ZodString;
        standing: z.ZodEnum<["not_applied", "claimed", "applied", "awaiting_payment", "member", "lapsed", "declined"]>;
        tierName: z.ZodNullable<z.ZodString>;
        membershipNumber: z.ZodNullable<z.ZodString>;
        expiresOn: z.ZodNullable<z.ZodString>;
        /** The open application, when there is one, so the row can open it. */
        openApplicationId: z.ZodNullable<z.ZodString>;
        /** Paid in through Injishi: membership fees, and any registration fee. */
        paidRwf: z.ZodDefault<z.ZodNumber>;
        lastPaidAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        /** Its branches (2026-10-23): the other places it trades from, on its newest application. */
        branchCount: z.ZodDefault<z.ZodNumber>;
        /**
         * False when the officer sees it only because a branch is in their region:
         * its head office, and its decision, are another district's.
         */
        headOfficeInScope: z.ZodDefault<z.ZodBoolean>;
        /** The unpaid application, when one is waiting for its payment (2026-11-02): what is owed and who to reach. */
        paymentDue: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            amountRwf: z.ZodNullable<z.ZodNumber>;
            since: z.ZodString;
            docId: z.ZodNullable<z.ZodString>;
            contactName: z.ZodString;
            phoneE164: z.ZodNullable<z.ZodString>;
            email: z.ZodNullable<z.ZodString>;
            /** The last payment reminder an officer sent; one a day at most. */
            lastRemindedAt: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            amountRwf: number | null;
            phoneE164: string | null;
            email: string | null;
            docId: string | null;
            since: string;
            contactName: string;
            lastRemindedAt: string | null;
        }, {
            amountRwf: number | null;
            phoneE164: string | null;
            email: string | null;
            docId: string | null;
            since: string;
            contactName: string;
            lastRemindedAt: string | null;
        }>>>;
    }, "strip", z.ZodTypeAny, {
        domain: "hospitality" | "residence" | "enterprise";
        districtName: string | null;
        districtId: number | null;
        expiresOn: string | null;
        legalName: string;
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
        ownerGroups: ("women" | "youth" | "pwd")[];
        orgId: string;
        sectorName: string | null;
        businessCode: string | null;
        clusterCode: string | null;
        tierName: string | null;
        membershipNumber: string | null;
        clusterName: string | null;
        subsectorName: string | null;
        associationName: string | null;
        paidRwf: number;
        headOfficeInScope: boolean;
        standing: "declined" | "awaiting_payment" | "member" | "not_applied" | "claimed" | "applied" | "lapsed";
        associationAcronym: string | null;
        hasTin: boolean;
        registeredAt: string;
        openApplicationId: string | null;
        lastPaidAt: string | null;
        branchCount: number;
        paymentDue: {
            amountRwf: number | null;
            phoneE164: string | null;
            email: string | null;
            docId: string | null;
            since: string;
            contactName: string;
            lastRemindedAt: string | null;
        } | null;
    }, {
        domain: "hospitality" | "residence" | "enterprise";
        districtName: string | null;
        districtId: number | null;
        expiresOn: string | null;
        legalName: string;
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
        ownerGroups: ("women" | "youth" | "pwd")[];
        orgId: string;
        sectorName: string | null;
        businessCode: string | null;
        clusterCode: string | null;
        tierName: string | null;
        membershipNumber: string | null;
        clusterName: string | null;
        associationName: string | null;
        standing: "declined" | "awaiting_payment" | "member" | "not_applied" | "claimed" | "applied" | "lapsed";
        associationAcronym: string | null;
        hasTin: boolean;
        registeredAt: string;
        openApplicationId: string | null;
        subsectorName?: string | null | undefined;
        paidRwf?: number | undefined;
        headOfficeInScope?: boolean | undefined;
        lastPaidAt?: string | null | undefined;
        branchCount?: number | undefined;
        paymentDue?: {
            amountRwf: number | null;
            phoneE164: string | null;
            email: string | null;
            docId: string | null;
            since: string;
            contactName: string;
            lastRemindedAt: string | null;
        } | null | undefined;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
    /** How many businesses match the filters, across every page. */
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    items: {
        domain: "hospitality" | "residence" | "enterprise";
        districtName: string | null;
        districtId: number | null;
        expiresOn: string | null;
        legalName: string;
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
        ownerGroups: ("women" | "youth" | "pwd")[];
        orgId: string;
        sectorName: string | null;
        businessCode: string | null;
        clusterCode: string | null;
        tierName: string | null;
        membershipNumber: string | null;
        clusterName: string | null;
        subsectorName: string | null;
        associationName: string | null;
        paidRwf: number;
        headOfficeInScope: boolean;
        standing: "declined" | "awaiting_payment" | "member" | "not_applied" | "claimed" | "applied" | "lapsed";
        associationAcronym: string | null;
        hasTin: boolean;
        registeredAt: string;
        openApplicationId: string | null;
        lastPaidAt: string | null;
        branchCount: number;
        paymentDue: {
            amountRwf: number | null;
            phoneE164: string | null;
            email: string | null;
            docId: string | null;
            since: string;
            contactName: string;
            lastRemindedAt: string | null;
        } | null;
    }[];
    nextCursor: string | null;
    total: number;
}, {
    items: {
        domain: "hospitality" | "residence" | "enterprise";
        districtName: string | null;
        districtId: number | null;
        expiresOn: string | null;
        legalName: string;
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
        ownerGroups: ("women" | "youth" | "pwd")[];
        orgId: string;
        sectorName: string | null;
        businessCode: string | null;
        clusterCode: string | null;
        tierName: string | null;
        membershipNumber: string | null;
        clusterName: string | null;
        associationName: string | null;
        standing: "declined" | "awaiting_payment" | "member" | "not_applied" | "claimed" | "applied" | "lapsed";
        associationAcronym: string | null;
        hasTin: boolean;
        registeredAt: string;
        openApplicationId: string | null;
        subsectorName?: string | null | undefined;
        paidRwf?: number | undefined;
        headOfficeInScope?: boolean | undefined;
        lastPaidAt?: string | null | undefined;
        branchCount?: number | undefined;
        paymentDue?: {
            amountRwf: number | null;
            phoneE164: string | null;
            email: string | null;
            docId: string | null;
            since: string;
            contactName: string;
            lastRemindedAt: string | null;
        } | null | undefined;
    }[];
    nextCursor: string | null;
    total: number;
}>;
export type PsfBusinessesPage = z.infer<typeof PsfBusinessesPage>;
/** A count of businesses under one heading, for the register's summary. */
export declare const PsfCount: z.ZodObject<{
    key: z.ZodString;
    label: z.ZodString;
    count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    count: number;
    key: string;
    label: string;
}, {
    count: number;
    key: string;
    label: string;
}>;
export type PsfCount = z.infer<typeof PsfCount>;
/**
 * `GET /oversight/psf/summary`: the officer's region at a glance. Counted over
 * the officer's whole region, ignoring the register's other filters.
 */
export declare const PsfRegisterSummary: z.ZodObject<{
    /** The region in words: "Rwanda", a province, or a district. */
    regionLabel: z.ZodString;
    total: z.ZodNumber;
    members: z.ZodNumber;
    waiting: z.ZodNumber;
    /** Fees paid this calendar year through Injishi, in RWF: new memberships and renewals. */
    paidThisYearRwf: z.ZodNumber;
    /** Members inside their renewal window, 60 days before the end date (2026-11-02). */
    renewalDue: z.ZodDefault<z.ZodNumber>;
    /** Renewals paid this calendar year. */
    renewedThisYear: z.ZodDefault<z.ZodNumber>;
    /** Applications sent and not paid (2026-11-02). */
    awaitingPayment: z.ZodDefault<z.ZodNumber>;
    byCluster: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        key: string;
        label: string;
    }, {
        count: number;
        key: string;
        label: string;
    }>, "many">;
    byStanding: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        key: string;
        label: string;
    }, {
        count: number;
        key: string;
        label: string;
    }>, "many">;
    byGroup: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        key: string;
        label: string;
    }, {
        count: number;
        key: string;
        label: string;
    }>, "many">;
    byDistrict: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        count: z.ZodNumber;
    } & {
        letters: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        count: number;
        key: string;
        label: string;
        letters: string;
    }, {
        count: number;
        key: string;
        label: string;
        letters: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    total: number;
    regionLabel: string;
    members: number;
    waiting: number;
    paidThisYearRwf: number;
    renewalDue: number;
    renewedThisYear: number;
    awaitingPayment: number;
    byCluster: {
        count: number;
        key: string;
        label: string;
    }[];
    byStanding: {
        count: number;
        key: string;
        label: string;
    }[];
    byGroup: {
        count: number;
        key: string;
        label: string;
    }[];
    byDistrict: {
        count: number;
        key: string;
        label: string;
        letters: string;
    }[];
}, {
    total: number;
    regionLabel: string;
    members: number;
    waiting: number;
    paidThisYearRwf: number;
    byCluster: {
        count: number;
        key: string;
        label: string;
    }[];
    byStanding: {
        count: number;
        key: string;
        label: string;
    }[];
    byGroup: {
        count: number;
        key: string;
        label: string;
    }[];
    byDistrict: {
        count: number;
        key: string;
        label: string;
        letters: string;
    }[];
    renewalDue?: number | undefined;
    renewedThisYear?: number | undefined;
    awaitingPayment?: number | undefined;
}>;
export type PsfRegisterSummary = z.infer<typeof PsfRegisterSummary>;
/**
 * The membership dates a payment starts from: the day it settled, and one
 * year later less a day (ADR-056 value sourcing). `today` is a yyyy-mm-dd date
 * in Africa/Kigali, which the caller resolves.
 */
export declare function defaultPsfMembershipDates(today: string): {
    startsOn: string;
    expiresOn: string;
};
/**
 * The business activity PSF's form starts from (ADR-056 value sourcing): the
 * accommodation class for a hotel, the association for a PSF business.
 * Editable wherever it shows.
 */
export declare function psfBusinessActivityFor(accommodationClass: string | null, accommodationClassOther: string | null, associationName?: string | null): string;
/**
 * Split a full name into PSF's two fields at the last space (ADR-056). A
 * starting point the person corrects, never a rule trusted on its own:
 * Rwandan names do not reliably put the family name last.
 */
export declare function splitPsfName(fullName: string): {
    firstName: string;
    lastName: string;
};
/** `GET /oversight/psf/subsectors`: what the officer may read and change. */
export declare const PsfSubsectorsView: z.ZodObject<{
    clusters: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        nameEn: z.ZodString;
        subsectors: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            clusterCode: z.ZodString;
            nameEn: z.ZodString;
            districtId: z.ZodNullable<z.ZodNumber>;
            districtName: z.ZodNullable<z.ZodString>;
            sortOrder: z.ZodNumber;
            active: z.ZodBoolean;
            associationCodes: z.ZodArray<z.ZodString, "many">;
        } & {
            canEdit: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            active: boolean;
            id: string;
            districtName: string | null;
            districtId: number | null;
            nameEn: string;
            sortOrder: number;
            clusterCode: string;
            associationCodes: string[];
            canEdit: boolean;
        }, {
            active: boolean;
            id: string;
            districtName: string | null;
            districtId: number | null;
            nameEn: string;
            sortOrder: number;
            clusterCode: string;
            associationCodes: string[];
            canEdit: boolean;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        code: string;
        nameEn: string;
        subsectors: {
            active: boolean;
            id: string;
            districtName: string | null;
            districtId: number | null;
            nameEn: string;
            sortOrder: number;
            clusterCode: string;
            associationCodes: string[];
            canEdit: boolean;
        }[];
    }, {
        code: string;
        nameEn: string;
        subsectors: {
            active: boolean;
            id: string;
            districtName: string | null;
            districtId: number | null;
            nameEn: string;
            sortOrder: number;
            clusterCode: string;
            associationCodes: string[];
            canEdit: boolean;
        }[];
    }>, "many">;
    /** Where the officer may put a new subtype: null for national, or a district id. */
    places: z.ZodArray<z.ZodObject<{
        districtId: z.ZodNullable<z.ZodNumber>;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        districtId: number | null;
        label: string;
    }, {
        districtId: number | null;
        label: string;
    }>, "many">;
    associations: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        clusterCode: z.ZodString;
        nameEn: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        nameEn: string;
        clusterCode: string;
    }, {
        code: string;
        nameEn: string;
        clusterCode: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    associations: {
        code: string;
        nameEn: string;
        clusterCode: string;
    }[];
    clusters: {
        code: string;
        nameEn: string;
        subsectors: {
            active: boolean;
            id: string;
            districtName: string | null;
            districtId: number | null;
            nameEn: string;
            sortOrder: number;
            clusterCode: string;
            associationCodes: string[];
            canEdit: boolean;
        }[];
    }[];
    places: {
        districtId: number | null;
        label: string;
    }[];
}, {
    associations: {
        code: string;
        nameEn: string;
        clusterCode: string;
    }[];
    clusters: {
        code: string;
        nameEn: string;
        subsectors: {
            active: boolean;
            id: string;
            districtName: string | null;
            districtId: number | null;
            nameEn: string;
            sortOrder: number;
            clusterCode: string;
            associationCodes: string[];
            canEdit: boolean;
        }[];
    }[];
    places: {
        districtId: number | null;
        label: string;
    }[];
}>;
export type PsfSubsectorsView = z.infer<typeof PsfSubsectorsView>;
/** Add a subtype. A national officer may add one for the country; any officer for a district they cover. */
export declare const CreatePsfSubsectorRequest: z.ZodObject<{
    clusterCode: z.ZodString;
    nameEn: z.ZodString;
    districtId: z.ZodNullable<z.ZodNumber>;
    associationCodes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    districtId: number | null;
    nameEn: string;
    clusterCode: string;
    associationCodes: string[];
}, {
    districtId: number | null;
    nameEn: string;
    clusterCode: string;
    associationCodes?: string[] | undefined;
}>;
export type CreatePsfSubsectorRequest = z.infer<typeof CreatePsfSubsectorRequest>;
export declare const UpdatePsfSubsectorRequest: z.ZodObject<{
    nameEn: z.ZodOptional<z.ZodString>;
    active: z.ZodOptional<z.ZodBoolean>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
    associationCodes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    active?: boolean | undefined;
    nameEn?: string | undefined;
    sortOrder?: number | undefined;
    associationCodes?: string[] | undefined;
}, {
    active?: boolean | undefined;
    nameEn?: string | undefined;
    sortOrder?: number | undefined;
    associationCodes?: string[] | undefined;
}>;
export type UpdatePsfSubsectorRequest = z.infer<typeof UpdatePsfSubsectorRequest>;
/**
 * Field types an officer may add to the PSF membership form. `select` needs at
 * least one option; the others carry no options.
 */
export declare const PsfFormFieldType: z.ZodEnum<["text", "textarea", "number", "boolean", "select"]>;
export type PsfFormFieldType = z.infer<typeof PsfFormFieldType>;
/** Stable key: lowercase snake, used as the answer bag key and in APIs. */
export declare const PsfFormFieldKey: z.ZodString;
export declare const PsfFormFieldOption: z.ZodString;
export declare const PsfFormField: z.ZodObject<{
    id: z.ZodString;
    key: z.ZodString;
    label: z.ZodString;
    helpText: z.ZodNullable<z.ZodString>;
    fieldType: z.ZodEnum<["text", "textarea", "number", "boolean", "select"]>;
    required: z.ZodBoolean;
    options: z.ZodArray<z.ZodString, "many">;
    sortOrder: z.ZodNumber;
    active: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    options: string[];
    active: boolean;
    id: string;
    sortOrder: number;
    key: string;
    label: string;
    helpText: string | null;
    fieldType: "number" | "boolean" | "text" | "textarea" | "select";
    required: boolean;
}, {
    options: string[];
    active: boolean;
    id: string;
    sortOrder: number;
    key: string;
    label: string;
    helpText: string | null;
    fieldType: "number" | "boolean" | "text" | "textarea" | "select";
    required: boolean;
}>;
export type PsfFormField = z.infer<typeof PsfFormField>;
/** What applicants and the public form see: active fields only, ordered. */
export declare const PsfFormFieldsPublic: z.ZodObject<{
    fields: z.ZodArray<z.ZodObject<Omit<{
        id: z.ZodString;
        key: z.ZodString;
        label: z.ZodString;
        helpText: z.ZodNullable<z.ZodString>;
        fieldType: z.ZodEnum<["text", "textarea", "number", "boolean", "select"]>;
        required: z.ZodBoolean;
        options: z.ZodArray<z.ZodString, "many">;
        sortOrder: z.ZodNumber;
        active: z.ZodBoolean;
    }, "active">, "strip", z.ZodTypeAny, {
        options: string[];
        id: string;
        sortOrder: number;
        key: string;
        label: string;
        helpText: string | null;
        fieldType: "number" | "boolean" | "text" | "textarea" | "select";
        required: boolean;
    }, {
        options: string[];
        id: string;
        sortOrder: number;
        key: string;
        label: string;
        helpText: string | null;
        fieldType: "number" | "boolean" | "text" | "textarea" | "select";
        required: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    fields: {
        options: string[];
        id: string;
        sortOrder: number;
        key: string;
        label: string;
        helpText: string | null;
        fieldType: "number" | "boolean" | "text" | "textarea" | "select";
        required: boolean;
    }[];
}, {
    fields: {
        options: string[];
        id: string;
        sortOrder: number;
        key: string;
        label: string;
        helpText: string | null;
        fieldType: "number" | "boolean" | "text" | "textarea" | "select";
        required: boolean;
    }[];
}>;
export type PsfFormFieldsPublic = z.infer<typeof PsfFormFieldsPublic>;
/** What an officer sees and may edit: every field, including inactive. */
export declare const PsfFormFieldsOfficerView: z.ZodObject<{
    fields: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        key: z.ZodString;
        label: z.ZodString;
        helpText: z.ZodNullable<z.ZodString>;
        fieldType: z.ZodEnum<["text", "textarea", "number", "boolean", "select"]>;
        required: z.ZodBoolean;
        options: z.ZodArray<z.ZodString, "many">;
        sortOrder: z.ZodNumber;
        active: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        options: string[];
        active: boolean;
        id: string;
        sortOrder: number;
        key: string;
        label: string;
        helpText: string | null;
        fieldType: "number" | "boolean" | "text" | "textarea" | "select";
        required: boolean;
    }, {
        options: string[];
        active: boolean;
        id: string;
        sortOrder: number;
        key: string;
        label: string;
        helpText: string | null;
        fieldType: "number" | "boolean" | "text" | "textarea" | "select";
        required: boolean;
    }>, "many">;
    /** Only a country-scoped PSF officer may create or edit the catalogue. */
    canEdit: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    canEdit: boolean;
    fields: {
        options: string[];
        active: boolean;
        id: string;
        sortOrder: number;
        key: string;
        label: string;
        helpText: string | null;
        fieldType: "number" | "boolean" | "text" | "textarea" | "select";
        required: boolean;
    }[];
}, {
    canEdit: boolean;
    fields: {
        options: string[];
        active: boolean;
        id: string;
        sortOrder: number;
        key: string;
        label: string;
        helpText: string | null;
        fieldType: "number" | "boolean" | "text" | "textarea" | "select";
        required: boolean;
    }[];
}>;
export type PsfFormFieldsOfficerView = z.infer<typeof PsfFormFieldsOfficerView>;
export declare const CreatePsfFormFieldRequest: z.ZodEffects<z.ZodObject<{
    key: z.ZodString;
    label: z.ZodString;
    helpText: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    fieldType: z.ZodEnum<["text", "textarea", "number", "boolean", "select"]>;
    required: z.ZodDefault<z.ZodBoolean>;
    options: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    options: string[];
    sortOrder: number;
    key: string;
    label: string;
    fieldType: "number" | "boolean" | "text" | "textarea" | "select";
    required: boolean;
    helpText?: string | null | undefined;
}, {
    key: string;
    label: string;
    fieldType: "number" | "boolean" | "text" | "textarea" | "select";
    options?: string[] | undefined;
    sortOrder?: number | undefined;
    helpText?: string | null | undefined;
    required?: boolean | undefined;
}>, {
    options: string[];
    sortOrder: number;
    key: string;
    label: string;
    fieldType: "number" | "boolean" | "text" | "textarea" | "select";
    required: boolean;
    helpText?: string | null | undefined;
}, {
    key: string;
    label: string;
    fieldType: "number" | "boolean" | "text" | "textarea" | "select";
    options?: string[] | undefined;
    sortOrder?: number | undefined;
    helpText?: string | null | undefined;
    required?: boolean | undefined;
}>;
export type CreatePsfFormFieldRequest = z.infer<typeof CreatePsfFormFieldRequest>;
export declare const UpdatePsfFormFieldRequest: z.ZodEffects<z.ZodObject<{
    label: z.ZodOptional<z.ZodString>;
    helpText: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    required: z.ZodOptional<z.ZodBoolean>;
    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
    active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    options?: string[] | undefined;
    active?: boolean | undefined;
    sortOrder?: number | undefined;
    label?: string | undefined;
    helpText?: string | null | undefined;
    required?: boolean | undefined;
}, {
    options?: string[] | undefined;
    active?: boolean | undefined;
    sortOrder?: number | undefined;
    label?: string | undefined;
    helpText?: string | null | undefined;
    required?: boolean | undefined;
}>, {
    options?: string[] | undefined;
    active?: boolean | undefined;
    sortOrder?: number | undefined;
    label?: string | undefined;
    helpText?: string | null | undefined;
    required?: boolean | undefined;
}, {
    options?: string[] | undefined;
    active?: boolean | undefined;
    sortOrder?: number | undefined;
    label?: string | undefined;
    helpText?: string | null | undefined;
    required?: boolean | undefined;
}>;
export type UpdatePsfFormFieldRequest = z.infer<typeof UpdatePsfFormFieldRequest>;
/**
 * Answers bag keyed by field `key`. Validation against the live catalogue
 * happens on the server at submit; this shape only bounds the wire.
 */
export declare const PsfFormAnswers: z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
export type PsfFormAnswers = z.infer<typeof PsfFormAnswers>;
/** A typed membership number is a claim until PSF confirms it. */
export declare const PsfClaimStatus: z.ZodEnum<["claimed", "confirmed", "rejected"]>;
export type PsfClaimStatus = z.infer<typeof PsfClaimStatus>;
/** A number as a business typed it: trimmed, upper case, inner spaces collapsed. */
export declare function normalizePsfNumber(raw: string): string;
/**
 * Whether a typed number could be a membership number at all: letters, digits and the separators PSF
 * prints (`/`, `-`, a space), at least four characters, and at least two digits. It refuses "PSF-" and
 * other half-typed values; it cannot tell a real number from a made-up one, which is PSF's to confirm.
 */
export declare function looksLikePsfNumber(raw: string): boolean;
/** One claim, for the PSF District Manager deciding it. */
export declare const PsfMembershipClaim: z.ZodObject<{
    id: z.ZodString;
    orgId: z.ZodString;
    legalName: z.ZodString;
    businessCode: z.ZodNullable<z.ZodString>;
    tin: z.ZodNullable<z.ZodString>;
    districtName: z.ZodNullable<z.ZodString>;
    /** The OLD number it typed from its card, when it did; null when it sent the card alone (2026-11-02). */
    membershipNumber: z.ZodNullable<z.ZodString>;
    /** The next number in its district's run (2026-11-02): every card holder gets a new one. */
    suggestedMembershipNumber: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    status: z.ZodEnum<["claimed", "confirmed", "rejected"]>;
    claimedAt: z.ZodString;
    claimedByName: z.ZodNullable<z.ZodString>;
    decidedAt: z.ZodNullable<z.ZodString>;
    decidedByName: z.ZodNullable<z.ZodString>;
    decisionNote: z.ZodNullable<z.ZodString>;
    matchedBy: z.ZodNullable<z.ZodEnum<["member_list", "officer"]>>;
    /** What PSF's own list says about this number, when it holds it. */
    listed: z.ZodNullable<z.ZodObject<{
        legalName: z.ZodNullable<z.ZodString>;
        tin: z.ZodNullable<z.ZodString>;
        tierCode: z.ZodNullable<z.ZodString>;
        expiresOn: z.ZodNullable<z.ZodString>;
        tinMatches: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        expiresOn: string | null;
        tin: string | null;
        legalName: string | null;
        tierCode: string | null;
        tinMatches: boolean;
    }, {
        expiresOn: string | null;
        tin: string | null;
        legalName: string | null;
        tierCode: string | null;
        tinMatches: boolean;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "rejected" | "confirmed" | "claimed";
    id: string;
    districtName: string | null;
    tin: string | null;
    legalName: string;
    decidedAt: string | null;
    orgId: string;
    businessCode: string | null;
    membershipNumber: string | null;
    decisionNote: string | null;
    suggestedMembershipNumber: string | null;
    claimedAt: string;
    claimedByName: string | null;
    decidedByName: string | null;
    matchedBy: "member_list" | "officer" | null;
    listed: {
        expiresOn: string | null;
        tin: string | null;
        legalName: string | null;
        tierCode: string | null;
        tinMatches: boolean;
    } | null;
}, {
    status: "rejected" | "confirmed" | "claimed";
    id: string;
    districtName: string | null;
    tin: string | null;
    legalName: string;
    decidedAt: string | null;
    orgId: string;
    businessCode: string | null;
    membershipNumber: string | null;
    decisionNote: string | null;
    claimedAt: string;
    claimedByName: string | null;
    decidedByName: string | null;
    matchedBy: "member_list" | "officer" | null;
    listed: {
        expiresOn: string | null;
        tin: string | null;
        legalName: string | null;
        tierCode: string | null;
        tinMatches: boolean;
    } | null;
    suggestedMembershipNumber?: string | null | undefined;
}>;
export type PsfMembershipClaim = z.infer<typeof PsfMembershipClaim>;
export declare const PsfClaimsQuery: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["claimed", "confirmed", "rejected"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "rejected" | "confirmed" | "claimed" | undefined;
}, {
    status?: "rejected" | "confirmed" | "claimed" | undefined;
}>;
export type PsfClaimsQuery = z.infer<typeof PsfClaimsQuery>;
export declare const PsfClaimsPage: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        orgId: z.ZodString;
        legalName: z.ZodString;
        businessCode: z.ZodNullable<z.ZodString>;
        tin: z.ZodNullable<z.ZodString>;
        districtName: z.ZodNullable<z.ZodString>;
        /** The OLD number it typed from its card, when it did; null when it sent the card alone (2026-11-02). */
        membershipNumber: z.ZodNullable<z.ZodString>;
        /** The next number in its district's run (2026-11-02): every card holder gets a new one. */
        suggestedMembershipNumber: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        status: z.ZodEnum<["claimed", "confirmed", "rejected"]>;
        claimedAt: z.ZodString;
        claimedByName: z.ZodNullable<z.ZodString>;
        decidedAt: z.ZodNullable<z.ZodString>;
        decidedByName: z.ZodNullable<z.ZodString>;
        decisionNote: z.ZodNullable<z.ZodString>;
        matchedBy: z.ZodNullable<z.ZodEnum<["member_list", "officer"]>>;
        /** What PSF's own list says about this number, when it holds it. */
        listed: z.ZodNullable<z.ZodObject<{
            legalName: z.ZodNullable<z.ZodString>;
            tin: z.ZodNullable<z.ZodString>;
            tierCode: z.ZodNullable<z.ZodString>;
            expiresOn: z.ZodNullable<z.ZodString>;
            tinMatches: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            expiresOn: string | null;
            tin: string | null;
            legalName: string | null;
            tierCode: string | null;
            tinMatches: boolean;
        }, {
            expiresOn: string | null;
            tin: string | null;
            legalName: string | null;
            tierCode: string | null;
            tinMatches: boolean;
        }>>;
    }, "strip", z.ZodTypeAny, {
        status: "rejected" | "confirmed" | "claimed";
        id: string;
        districtName: string | null;
        tin: string | null;
        legalName: string;
        decidedAt: string | null;
        orgId: string;
        businessCode: string | null;
        membershipNumber: string | null;
        decisionNote: string | null;
        suggestedMembershipNumber: string | null;
        claimedAt: string;
        claimedByName: string | null;
        decidedByName: string | null;
        matchedBy: "member_list" | "officer" | null;
        listed: {
            expiresOn: string | null;
            tin: string | null;
            legalName: string | null;
            tierCode: string | null;
            tinMatches: boolean;
        } | null;
    }, {
        status: "rejected" | "confirmed" | "claimed";
        id: string;
        districtName: string | null;
        tin: string | null;
        legalName: string;
        decidedAt: string | null;
        orgId: string;
        businessCode: string | null;
        membershipNumber: string | null;
        decisionNote: string | null;
        claimedAt: string;
        claimedByName: string | null;
        decidedByName: string | null;
        matchedBy: "member_list" | "officer" | null;
        listed: {
            expiresOn: string | null;
            tin: string | null;
            legalName: string | null;
            tierCode: string | null;
            tinMatches: boolean;
        } | null;
        suggestedMembershipNumber?: string | null | undefined;
    }>, "many">;
    counts: z.ZodObject<{
        claimed: z.ZodNumber;
        confirmed: z.ZodNumber;
        rejected: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        rejected: number;
        confirmed: number;
        claimed: number;
    }, {
        rejected: number;
        confirmed: number;
        claimed: number;
    }>;
    list: z.ZodObject<{
        rows: z.ZodNumber;
        uploadedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        rows: number;
        uploadedAt: string | null;
    }, {
        rows: number;
        uploadedAt: string | null;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        status: "rejected" | "confirmed" | "claimed";
        id: string;
        districtName: string | null;
        tin: string | null;
        legalName: string;
        decidedAt: string | null;
        orgId: string;
        businessCode: string | null;
        membershipNumber: string | null;
        decisionNote: string | null;
        suggestedMembershipNumber: string | null;
        claimedAt: string;
        claimedByName: string | null;
        decidedByName: string | null;
        matchedBy: "member_list" | "officer" | null;
        listed: {
            expiresOn: string | null;
            tin: string | null;
            legalName: string | null;
            tierCode: string | null;
            tinMatches: boolean;
        } | null;
    }[];
    counts: {
        rejected: number;
        confirmed: number;
        claimed: number;
    };
    list: {
        rows: number;
        uploadedAt: string | null;
    };
}, {
    items: {
        status: "rejected" | "confirmed" | "claimed";
        id: string;
        districtName: string | null;
        tin: string | null;
        legalName: string;
        decidedAt: string | null;
        orgId: string;
        businessCode: string | null;
        membershipNumber: string | null;
        decisionNote: string | null;
        claimedAt: string;
        claimedByName: string | null;
        decidedByName: string | null;
        matchedBy: "member_list" | "officer" | null;
        listed: {
            expiresOn: string | null;
            tin: string | null;
            legalName: string | null;
            tierCode: string | null;
            tinMatches: boolean;
        } | null;
        suggestedMembershipNumber?: string | null | undefined;
    }[];
    counts: {
        rejected: number;
        confirmed: number;
        claimed: number;
    };
    list: {
        rows: number;
        uploadedAt: string | null;
    };
}>;
export type PsfClaimsPage = z.infer<typeof PsfClaimsPage>;
/** Confirm a claim: the tier and the dates PSF's records give. */
export declare const ConfirmPsfClaimRequest: z.ZodEffects<z.ZodObject<{
    tierCode: z.ZodString;
    startsOn: z.ZodString;
    expiresOn: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
    /**
     * The NEW number PSF gives the card holder in the new module (2026-11-02, the owner's decision):
     * every card holder gets one, whatever its old card shows. The dialog suggests the district's next.
     */
    membershipNumber: z.ZodString;
}, "strip", z.ZodTypeAny, {
    expiresOn: string;
    tierCode: string;
    membershipNumber: string;
    startsOn: string;
    note?: string | undefined;
}, {
    expiresOn: string;
    tierCode: string;
    membershipNumber: string;
    startsOn: string;
    note?: string | undefined;
}>, {
    expiresOn: string;
    tierCode: string;
    membershipNumber: string;
    startsOn: string;
    note?: string | undefined;
}, {
    expiresOn: string;
    tierCode: string;
    membershipNumber: string;
    startsOn: string;
    note?: string | undefined;
}>;
export type ConfirmPsfClaimRequest = z.infer<typeof ConfirmPsfClaimRequest>;
/** Reject a claim, with the reason the business is told. */
export declare const RejectPsfClaimRequest: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type RejectPsfClaimRequest = z.infer<typeof RejectPsfClaimRequest>;
/** PSF's member list, as rows read from its spreadsheet. A number already listed is replaced. */
export declare const PsfMemberListRow: z.ZodObject<{
    membershipNumber: z.ZodString;
    legalName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tin: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tierCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    startsOn: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    expiresOn: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    membershipNumber: string;
    expiresOn?: string | null | undefined;
    tin?: string | null | undefined;
    legalName?: string | null | undefined;
    tierCode?: string | null | undefined;
    startsOn?: string | null | undefined;
}, {
    membershipNumber: string;
    expiresOn?: string | null | undefined;
    tin?: string | null | undefined;
    legalName?: string | null | undefined;
    tierCode?: string | null | undefined;
    startsOn?: string | null | undefined;
}>;
export type PsfMemberListRow = z.infer<typeof PsfMemberListRow>;
export declare const UploadPsfMemberListRequest: z.ZodObject<{
    rows: z.ZodArray<z.ZodObject<{
        membershipNumber: z.ZodString;
        legalName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        tin: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        tierCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        startsOn: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        expiresOn: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        membershipNumber: string;
        expiresOn?: string | null | undefined;
        tin?: string | null | undefined;
        legalName?: string | null | undefined;
        tierCode?: string | null | undefined;
        startsOn?: string | null | undefined;
    }, {
        membershipNumber: string;
        expiresOn?: string | null | undefined;
        tin?: string | null | undefined;
        legalName?: string | null | undefined;
        tierCode?: string | null | undefined;
        startsOn?: string | null | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    rows: {
        membershipNumber: string;
        expiresOn?: string | null | undefined;
        tin?: string | null | undefined;
        legalName?: string | null | undefined;
        tierCode?: string | null | undefined;
        startsOn?: string | null | undefined;
    }[];
}, {
    rows: {
        membershipNumber: string;
        expiresOn?: string | null | undefined;
        tin?: string | null | undefined;
        legalName?: string | null | undefined;
        tierCode?: string | null | undefined;
        startsOn?: string | null | undefined;
    }[];
}>;
export type UploadPsfMemberListRequest = z.infer<typeof UploadPsfMemberListRequest>;
/** What an upload did: rows kept, and the claims it confirmed on the way. */
export declare const PsfMemberListResult: z.ZodObject<{
    rows: z.ZodNumber;
    confirmedClaims: z.ZodNumber;
    skipped: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    skipped: string[];
    rows: number;
    confirmedClaims: number;
}, {
    skipped: string[];
    rows: number;
    confirmedClaims: number;
}>;
export type PsfMemberListResult = z.infer<typeof PsfMemberListResult>;
//# sourceMappingURL=psf.d.ts.map