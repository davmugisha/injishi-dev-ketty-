import { z } from "zod";
import { Domain, OrgRegistrationStatus, OrgRole, OversightRole, OversightScopeLevel } from "./primitives";
import { PsfCompanyType, PsfContactRole, PsfOwnership, PsfTradeDirection } from "./registration";
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
export declare const PsfMembershipFamily: z.ZodEnum<["golden_circle", "indashyikirwa", "ordinary", "junior_giants"]>;
export type PsfMembershipFamily = z.infer<typeof PsfMembershipFamily>;
/** A fixed amount, a min to max range, or a price only PSF can quote. */
export declare const PsfPriceKind: z.ZodEnum<["fixed", "range", "set_by_psf"]>;
export type PsfPriceKind = z.infer<typeof PsfPriceKind>;
/** `submitted` is the only open state; the other three are terminal. */
export declare const PsfApplicationStatus: z.ZodEnum<["submitted", "member", "declined", "withdrawn"]>;
export type PsfApplicationStatus = z.infer<typeof PsfApplicationStatus>;
export declare const PsfSubmittedCapacity: z.ZodEnum<["owner", "on_behalf_of"]>;
export type PsfSubmittedCapacity = z.infer<typeof PsfSubmittedCapacity>;
export declare const PsfDeclineReason: z.ZodEnum<["details_incomplete", "not_eligible_for_tier", "business_not_recognised", "other"]>;
export type PsfDeclineReason = z.infer<typeof PsfDeclineReason>;
export declare const PsfMembershipSource: z.ZodEnum<["psf_confirmed", "self_declared"]>;
export type PsfMembershipSource = z.infer<typeof PsfMembershipSource>;
/**
 * Where an open application stands, as the business reads it. Derived on the
 * server from the business's registration status (ADR-056 AC-8), never stored.
 */
export declare const PsfApplicationStage: z.ZodEnum<["waiting_tin_check", "with_psf"]>;
export type PsfApplicationStage = z.infer<typeof PsfApplicationStage>;
/**
 * The registration states in which an open application sits in PSF's queue
 * (ADR-056 AC-8): the TIN has passed and the business is in good standing.
 * Anywhere else it waits, unchanged, and returns when the business does.
 */
export declare const PSF_QUEUE_REGISTRATION_STATES: readonly OrgRegistrationStatus[];
export declare function isInPsfQueueState(status: OrgRegistrationStatus): boolean;
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
export declare function isPsfApplicant(facts: PsfApplicantFacts): boolean;
export declare const PSF_FAMILY_LABEL: Readonly<Record<PsfMembershipFamily, string>>;
export declare const PSF_APPLICATION_STATUS_LABEL: Readonly<Record<PsfApplicationStatus, string>>;
export declare const PSF_APPLICATION_STAGE_LABEL: Readonly<Record<PsfApplicationStage, string>>;
export declare const PSF_DECLINE_REASON_LABEL: Readonly<Record<PsfDeclineReason, string>>;
export declare const PSF_MEMBERSHIP_SOURCE_LABEL: Readonly<Record<PsfMembershipSource, string>>;
export declare const PSF_COMPANY_TYPE_LABEL: Readonly<Record<PsfCompanyType, string>>;
export declare const PSF_OWNERSHIP_LABEL: Readonly<Record<PsfOwnership, string>>;
export declare const PSF_TRADE_DIRECTION_LABEL: Readonly<Record<PsfTradeDirection, string>>;
export declare const PSF_CONTACT_ROLE_LABEL: Readonly<Record<PsfContactRole, string>>;
/** What the business is told about the fee, wherever it picks a tier (AC-2). */
export declare const PSF_FEE_NOTICE = "PSF invoices you directly for the membership fee. Injishi never takes this money.";
export declare const PSF_OPEN_APPLICATION_MESSAGE = "This business already has an application with PSF. Withdraw it before sending another.";
export declare const PSF_NOT_OPEN_MESSAGE = "This application has already been decided or withdrawn.";
export declare const PSF_OWN_BUSINESS_MESSAGE = "You hold a role in this business, so another PSF officer must decide its application.";
export declare const PSF_HOSPITALITY_ONLY_MESSAGE = "PSF membership through Injishi is for hospitality businesses.";
/**
 * The body and scopes a role must be granted at, for the roles that have a
 * rule at all. The registration roles have none and are unchanged; the grant
 * path refuses with 422 a grant that breaks its role's entry.
 */
export declare const OVERSIGHT_ROLE_POSTING: Readonly<Partial<Record<OversightRole, {
    governmentBodyCode: string;
    scopeLevels: readonly OversightScopeLevel[];
    message: string;
}>>>;
export declare const PsfTier: z.ZodObject<{
    code: z.ZodString;
    family: z.ZodEnum<["golden_circle", "indashyikirwa", "ordinary", "junior_giants"]>;
    nameEn: z.ZodString;
    nameRw: z.ZodNullable<z.ZodString>;
    priceKind: z.ZodEnum<["fixed", "range", "set_by_psf"]>;
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
    family: "golden_circle" | "indashyikirwa" | "ordinary" | "junior_giants";
    nameEn: string;
    nameRw: string | null;
    priceKind: "fixed" | "range" | "set_by_psf";
    annualFeeRwf: number | null;
    annualFeeMinRwf: number | null;
    annualFeeMaxRwf: number | null;
    benefitsEn: string[];
    benefitsRw: string[] | null;
    sortOrder: number;
}, {
    code: string;
    active: boolean;
    family: "golden_circle" | "indashyikirwa" | "ordinary" | "junior_giants";
    nameEn: string;
    nameRw: string | null;
    priceKind: "fixed" | "range" | "set_by_psf";
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
    family: z.ZodEnum<["golden_circle", "indashyikirwa", "ordinary", "junior_giants"]>;
    nameEn: z.ZodString;
    nameRw: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    priceKind: z.ZodEnum<["fixed", "range", "set_by_psf"]>;
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
    family: "golden_circle" | "indashyikirwa" | "ordinary" | "junior_giants";
    nameEn: string;
    priceKind: "fixed" | "range" | "set_by_psf";
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
    family: "golden_circle" | "indashyikirwa" | "ordinary" | "junior_giants";
    nameEn: string;
    priceKind: "fixed" | "range" | "set_by_psf";
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
    family: "golden_circle" | "indashyikirwa" | "ordinary" | "junior_giants";
    nameEn: string;
    priceKind: "fixed" | "range" | "set_by_psf";
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
    family: "golden_circle" | "indashyikirwa" | "ordinary" | "junior_giants";
    nameEn: string;
    priceKind: "fixed" | "range" | "set_by_psf";
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
    family: z.ZodEnum<["golden_circle", "indashyikirwa", "ordinary", "junior_giants"]>;
    nameEn: z.ZodString;
    nameRw: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    priceKind: z.ZodEnum<["fixed", "range", "set_by_psf"]>;
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
    family: "golden_circle" | "indashyikirwa" | "ordinary" | "junior_giants";
    nameEn: string;
    priceKind: "fixed" | "range" | "set_by_psf";
    benefitsEn: string[];
    sortOrder: number;
    reason: string;
    nameRw?: string | null | undefined;
    annualFeeRwf?: number | null | undefined;
    annualFeeMinRwf?: number | null | undefined;
    annualFeeMaxRwf?: number | null | undefined;
    benefitsRw?: string[] | null | undefined;
}, {
    family: "golden_circle" | "indashyikirwa" | "ordinary" | "junior_giants";
    nameEn: string;
    priceKind: "fixed" | "range" | "set_by_psf";
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
    family: "golden_circle" | "indashyikirwa" | "ordinary" | "junior_giants";
    nameEn: string;
    priceKind: "fixed" | "range" | "set_by_psf";
    benefitsEn: string[];
    sortOrder: number;
    reason: string;
    nameRw?: string | null | undefined;
    annualFeeRwf?: number | null | undefined;
    annualFeeMinRwf?: number | null | undefined;
    annualFeeMaxRwf?: number | null | undefined;
    benefitsRw?: string[] | null | undefined;
}, {
    family: "golden_circle" | "indashyikirwa" | "ordinary" | "junior_giants";
    nameEn: string;
    priceKind: "fixed" | "range" | "set_by_psf";
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
export declare const PsfMembership: z.ZodObject<{
    id: z.ZodString;
    source: z.ZodEnum<["psf_confirmed", "self_declared"]>;
    tierCode: z.ZodNullable<z.ZodString>;
    tierName: z.ZodNullable<z.ZodString>;
    membershipNumber: z.ZodString;
    annualFeeRwf: z.ZodNullable<z.ZodNumber>;
    startsOn: z.ZodNullable<z.ZodString>;
    expiresOn: z.ZodNullable<z.ZodString>;
    endedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    expiresOn: string | null;
    annualFeeRwf: number | null;
    id: string;
    source: "psf_confirmed" | "self_declared";
    tierCode: string | null;
    tierName: string | null;
    membershipNumber: string;
    startsOn: string | null;
    endedAt: string | null;
}, {
    expiresOn: string | null;
    annualFeeRwf: number | null;
    id: string;
    source: "psf_confirmed" | "self_declared";
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
    registrationType: z.ZodString;
    registrationNumber: z.ZodString;
    website: z.ZodNullable<z.ZodString>;
    streetAddress: z.ZodString;
    companyType: z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>;
    ownership: z.ZodEnum<["foreign_100", "rwandan_100", "franchise", "joint_venture", "foreign_representative", "other"]>;
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
    ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
    ownershipOther: string | null;
    businessActivity: string;
    tradeDirection: "none" | "export" | "import" | "both";
    tradeGoods: string | null;
    tradeCountries: string[];
    contactRole: "owner" | "managing_director" | "ceo" | "chairman";
    firstName: string;
    lastName: string;
    email: string;
    registrationType: string;
    registrationNumber: string;
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
    ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
    ownershipOther: string | null;
    businessActivity: string;
    tradeDirection: "none" | "export" | "import" | "both";
    tradeGoods: string | null;
    tradeCountries: string[];
    contactRole: "owner" | "managing_director" | "ceo" | "chairman";
    firstName: string;
    lastName: string;
    email: string;
    registrationType: string;
    registrationNumber: string;
    idDocumentType: "national_id" | "passport";
    idDocumentNumber: string;
}>;
export type PsfFiledForm = z.infer<typeof PsfFiledForm>;
export declare const PsfApplication: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<["submitted", "member", "declined", "withdrawn"]>;
    requestedTierCode: z.ZodString;
    requestedTierName: z.ZodString;
    quotedPriceKind: z.ZodEnum<["fixed", "range", "set_by_psf"]>;
    quotedFeeRwf: z.ZodNullable<z.ZodNumber>;
    quotedFeeMinRwf: z.ZodNullable<z.ZodNumber>;
    quotedFeeMaxRwf: z.ZodNullable<z.ZodNumber>;
    submittedAt: z.ZodString;
    submittedCapacity: z.ZodEnum<["owner", "on_behalf_of"]>;
    /** Named so an owner can see an application sent on their behalf (AC-17). */
    submittedByName: z.ZodNullable<z.ZodString>;
    queuedAt: z.ZodNullable<z.ZodString>;
    decidedAt: z.ZodNullable<z.ZodString>;
    declineReason: z.ZodNullable<z.ZodEnum<["details_incomplete", "not_eligible_for_tier", "business_not_recognised", "other"]>>;
    decisionNote: z.ZodNullable<z.ZodString>;
    withdrawnAt: z.ZodNullable<z.ZodString>;
    form: z.ZodObject<{
        companyName: z.ZodString;
        registrationType: z.ZodString;
        registrationNumber: z.ZodString;
        website: z.ZodNullable<z.ZodString>;
        streetAddress: z.ZodString;
        companyType: z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>;
        ownership: z.ZodEnum<["foreign_100", "rwandan_100", "franchise", "joint_venture", "foreign_representative", "other"]>;
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
        ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
        ownershipOther: string | null;
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeGoods: string | null;
        tradeCountries: string[];
        contactRole: "owner" | "managing_director" | "ceo" | "chairman";
        firstName: string;
        lastName: string;
        email: string;
        registrationType: string;
        registrationNumber: string;
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
        ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
        ownershipOther: string | null;
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeGoods: string | null;
        tradeCountries: string[];
        contactRole: "owner" | "managing_director" | "ceo" | "chairman";
        firstName: string;
        lastName: string;
        email: string;
        registrationType: string;
        registrationNumber: string;
        idDocumentType: "national_id" | "passport";
        idDocumentNumber: string;
    }>;
}, "strip", z.ZodTypeAny, {
    status: "submitted" | "member" | "declined" | "withdrawn";
    requestedTierCode: string;
    decidedAt: string | null;
    submittedAt: string;
    id: string;
    requestedTierName: string;
    quotedPriceKind: "fixed" | "range" | "set_by_psf";
    quotedFeeRwf: number | null;
    quotedFeeMinRwf: number | null;
    quotedFeeMaxRwf: number | null;
    submittedCapacity: "owner" | "on_behalf_of";
    submittedByName: string | null;
    queuedAt: string | null;
    declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
    decisionNote: string | null;
    withdrawnAt: string | null;
    form: {
        gender: "female" | "male";
        dateOfBirth: string;
        phoneE164: string;
        companyName: string;
        streetAddress: string;
        website: string | null;
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
        ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
        ownershipOther: string | null;
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeGoods: string | null;
        tradeCountries: string[];
        contactRole: "owner" | "managing_director" | "ceo" | "chairman";
        firstName: string;
        lastName: string;
        email: string;
        registrationType: string;
        registrationNumber: string;
        idDocumentType: "national_id" | "passport";
        idDocumentNumber: string;
    };
}, {
    status: "submitted" | "member" | "declined" | "withdrawn";
    requestedTierCode: string;
    decidedAt: string | null;
    submittedAt: string;
    id: string;
    requestedTierName: string;
    quotedPriceKind: "fixed" | "range" | "set_by_psf";
    quotedFeeRwf: number | null;
    quotedFeeMinRwf: number | null;
    quotedFeeMaxRwf: number | null;
    submittedCapacity: "owner" | "on_behalf_of";
    submittedByName: string | null;
    queuedAt: string | null;
    declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
    decisionNote: string | null;
    withdrawnAt: string | null;
    form: {
        gender: "female" | "male";
        dateOfBirth: string;
        phoneE164: string;
        companyName: string;
        streetAddress: string;
        website: string | null;
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
        ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
        ownershipOther: string | null;
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeGoods: string | null;
        tradeCountries: string[];
        contactRole: "owner" | "managing_director" | "ceo" | "chairman";
        firstName: string;
        lastName: string;
        email: string;
        registrationType: string;
        registrationNumber: string;
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
    ownership: z.ZodOptional<z.ZodEnum<["foreign_100", "rwandan_100", "franchise", "joint_venture", "foreign_representative", "other"]>>;
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
    ownership?: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative" | undefined;
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
    ownership?: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative" | undefined;
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
/** `GET /orgs/:orgId/psf-membership` (AC-15). */
export declare const PsfMembershipOverview: z.ZodObject<{
    orgId: z.ZodString;
    /** The TIN PSF's form is filed under; not editable (AC-3). */
    registrationNumber: z.ZodString;
    current: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        source: z.ZodEnum<["psf_confirmed", "self_declared"]>;
        tierCode: z.ZodNullable<z.ZodString>;
        tierName: z.ZodNullable<z.ZodString>;
        membershipNumber: z.ZodString;
        annualFeeRwf: z.ZodNullable<z.ZodNumber>;
        startsOn: z.ZodNullable<z.ZodString>;
        expiresOn: z.ZodNullable<z.ZodString>;
        endedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        expiresOn: string | null;
        annualFeeRwf: number | null;
        id: string;
        source: "psf_confirmed" | "self_declared";
        tierCode: string | null;
        tierName: string | null;
        membershipNumber: string;
        startsOn: string | null;
        endedAt: string | null;
    }, {
        expiresOn: string | null;
        annualFeeRwf: number | null;
        id: string;
        source: "psf_confirmed" | "self_declared";
        tierCode: string | null;
        tierName: string | null;
        membershipNumber: string;
        startsOn: string | null;
        endedAt: string | null;
    }>>;
    open: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodEnum<["submitted", "member", "declined", "withdrawn"]>;
        requestedTierCode: z.ZodString;
        requestedTierName: z.ZodString;
        quotedPriceKind: z.ZodEnum<["fixed", "range", "set_by_psf"]>;
        quotedFeeRwf: z.ZodNullable<z.ZodNumber>;
        quotedFeeMinRwf: z.ZodNullable<z.ZodNumber>;
        quotedFeeMaxRwf: z.ZodNullable<z.ZodNumber>;
        submittedAt: z.ZodString;
        submittedCapacity: z.ZodEnum<["owner", "on_behalf_of"]>;
        /** Named so an owner can see an application sent on their behalf (AC-17). */
        submittedByName: z.ZodNullable<z.ZodString>;
        queuedAt: z.ZodNullable<z.ZodString>;
        decidedAt: z.ZodNullable<z.ZodString>;
        declineReason: z.ZodNullable<z.ZodEnum<["details_incomplete", "not_eligible_for_tier", "business_not_recognised", "other"]>>;
        decisionNote: z.ZodNullable<z.ZodString>;
        withdrawnAt: z.ZodNullable<z.ZodString>;
        form: z.ZodObject<{
            companyName: z.ZodString;
            registrationType: z.ZodString;
            registrationNumber: z.ZodString;
            website: z.ZodNullable<z.ZodString>;
            streetAddress: z.ZodString;
            companyType: z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>;
            ownership: z.ZodEnum<["foreign_100", "rwandan_100", "franchise", "joint_venture", "foreign_representative", "other"]>;
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
            ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationType: string;
            registrationNumber: string;
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
            ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationType: string;
            registrationNumber: string;
            idDocumentType: "national_id" | "passport";
            idDocumentNumber: string;
        }>;
    } & {
        stage: z.ZodEnum<["waiting_tin_check", "with_psf"]>;
    }, "strip", z.ZodTypeAny, {
        status: "submitted" | "member" | "declined" | "withdrawn";
        requestedTierCode: string;
        stage: "waiting_tin_check" | "with_psf";
        decidedAt: string | null;
        submittedAt: string;
        id: string;
        requestedTierName: string;
        quotedPriceKind: "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        decisionNote: string | null;
        withdrawnAt: string | null;
        form: {
            gender: "female" | "male";
            dateOfBirth: string;
            phoneE164: string;
            companyName: string;
            streetAddress: string;
            website: string | null;
            companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
            ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationType: string;
            registrationNumber: string;
            idDocumentType: "national_id" | "passport";
            idDocumentNumber: string;
        };
    }, {
        status: "submitted" | "member" | "declined" | "withdrawn";
        requestedTierCode: string;
        stage: "waiting_tin_check" | "with_psf";
        decidedAt: string | null;
        submittedAt: string;
        id: string;
        requestedTierName: string;
        quotedPriceKind: "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        decisionNote: string | null;
        withdrawnAt: string | null;
        form: {
            gender: "female" | "male";
            dateOfBirth: string;
            phoneE164: string;
            companyName: string;
            streetAddress: string;
            website: string | null;
            companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
            ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationType: string;
            registrationNumber: string;
            idDocumentType: "national_id" | "passport";
            idDocumentNumber: string;
        };
    }>>;
    /** Decided and withdrawn applications, newest first. */
    history: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodEnum<["submitted", "member", "declined", "withdrawn"]>;
        requestedTierCode: z.ZodString;
        requestedTierName: z.ZodString;
        quotedPriceKind: z.ZodEnum<["fixed", "range", "set_by_psf"]>;
        quotedFeeRwf: z.ZodNullable<z.ZodNumber>;
        quotedFeeMinRwf: z.ZodNullable<z.ZodNumber>;
        quotedFeeMaxRwf: z.ZodNullable<z.ZodNumber>;
        submittedAt: z.ZodString;
        submittedCapacity: z.ZodEnum<["owner", "on_behalf_of"]>;
        /** Named so an owner can see an application sent on their behalf (AC-17). */
        submittedByName: z.ZodNullable<z.ZodString>;
        queuedAt: z.ZodNullable<z.ZodString>;
        decidedAt: z.ZodNullable<z.ZodString>;
        declineReason: z.ZodNullable<z.ZodEnum<["details_incomplete", "not_eligible_for_tier", "business_not_recognised", "other"]>>;
        decisionNote: z.ZodNullable<z.ZodString>;
        withdrawnAt: z.ZodNullable<z.ZodString>;
        form: z.ZodObject<{
            companyName: z.ZodString;
            registrationType: z.ZodString;
            registrationNumber: z.ZodString;
            website: z.ZodNullable<z.ZodString>;
            streetAddress: z.ZodString;
            companyType: z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>;
            ownership: z.ZodEnum<["foreign_100", "rwandan_100", "franchise", "joint_venture", "foreign_representative", "other"]>;
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
            ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationType: string;
            registrationNumber: string;
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
            ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationType: string;
            registrationNumber: string;
            idDocumentType: "national_id" | "passport";
            idDocumentNumber: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        status: "submitted" | "member" | "declined" | "withdrawn";
        requestedTierCode: string;
        decidedAt: string | null;
        submittedAt: string;
        id: string;
        requestedTierName: string;
        quotedPriceKind: "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        decisionNote: string | null;
        withdrawnAt: string | null;
        form: {
            gender: "female" | "male";
            dateOfBirth: string;
            phoneE164: string;
            companyName: string;
            streetAddress: string;
            website: string | null;
            companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
            ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationType: string;
            registrationNumber: string;
            idDocumentType: "national_id" | "passport";
            idDocumentNumber: string;
        };
    }, {
        status: "submitted" | "member" | "declined" | "withdrawn";
        requestedTierCode: string;
        decidedAt: string | null;
        submittedAt: string;
        id: string;
        requestedTierName: string;
        quotedPriceKind: "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        decisionNote: string | null;
        withdrawnAt: string | null;
        form: {
            gender: "female" | "male";
            dateOfBirth: string;
            phoneE164: string;
            companyName: string;
            streetAddress: string;
            website: string | null;
            companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
            ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationType: string;
            registrationNumber: string;
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
        ownership: z.ZodOptional<z.ZodEnum<["foreign_100", "rwandan_100", "franchise", "joint_venture", "foreign_representative", "other"]>>;
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
        ownership?: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative" | undefined;
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
        ownership?: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative" | undefined;
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
    orgId: string;
    registrationNumber: string;
    current: {
        expiresOn: string | null;
        annualFeeRwf: number | null;
        id: string;
        source: "psf_confirmed" | "self_declared";
        tierCode: string | null;
        tierName: string | null;
        membershipNumber: string;
        startsOn: string | null;
        endedAt: string | null;
    } | null;
    open: {
        status: "submitted" | "member" | "declined" | "withdrawn";
        requestedTierCode: string;
        stage: "waiting_tin_check" | "with_psf";
        decidedAt: string | null;
        submittedAt: string;
        id: string;
        requestedTierName: string;
        quotedPriceKind: "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        decisionNote: string | null;
        withdrawnAt: string | null;
        form: {
            gender: "female" | "male";
            dateOfBirth: string;
            phoneE164: string;
            companyName: string;
            streetAddress: string;
            website: string | null;
            companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
            ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationType: string;
            registrationNumber: string;
            idDocumentType: "national_id" | "passport";
            idDocumentNumber: string;
        };
    } | null;
    history: {
        status: "submitted" | "member" | "declined" | "withdrawn";
        requestedTierCode: string;
        decidedAt: string | null;
        submittedAt: string;
        id: string;
        requestedTierName: string;
        quotedPriceKind: "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        decisionNote: string | null;
        withdrawnAt: string | null;
        form: {
            gender: "female" | "male";
            dateOfBirth: string;
            phoneE164: string;
            companyName: string;
            streetAddress: string;
            website: string | null;
            companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
            ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationType: string;
            registrationNumber: string;
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
        ownership?: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative" | undefined;
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
    orgId: string;
    registrationNumber: string;
    current: {
        expiresOn: string | null;
        annualFeeRwf: number | null;
        id: string;
        source: "psf_confirmed" | "self_declared";
        tierCode: string | null;
        tierName: string | null;
        membershipNumber: string;
        startsOn: string | null;
        endedAt: string | null;
    } | null;
    open: {
        status: "submitted" | "member" | "declined" | "withdrawn";
        requestedTierCode: string;
        stage: "waiting_tin_check" | "with_psf";
        decidedAt: string | null;
        submittedAt: string;
        id: string;
        requestedTierName: string;
        quotedPriceKind: "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        decisionNote: string | null;
        withdrawnAt: string | null;
        form: {
            gender: "female" | "male";
            dateOfBirth: string;
            phoneE164: string;
            companyName: string;
            streetAddress: string;
            website: string | null;
            companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
            ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationType: string;
            registrationNumber: string;
            idDocumentType: "national_id" | "passport";
            idDocumentNumber: string;
        };
    } | null;
    history: {
        status: "submitted" | "member" | "declined" | "withdrawn";
        requestedTierCode: string;
        decidedAt: string | null;
        submittedAt: string;
        id: string;
        requestedTierName: string;
        quotedPriceKind: "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        decisionNote: string | null;
        withdrawnAt: string | null;
        form: {
            gender: "female" | "male";
            dateOfBirth: string;
            phoneE164: string;
            companyName: string;
            streetAddress: string;
            website: string | null;
            companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
            ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationType: string;
            registrationNumber: string;
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
        ownership?: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative" | undefined;
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
    status: z.ZodEnum<["submitted", "member", "declined", "withdrawn"]>;
    requestedTierCode: z.ZodString;
    requestedTierName: z.ZodString;
    quotedPriceKind: z.ZodEnum<["fixed", "range", "set_by_psf"]>;
    quotedFeeRwf: z.ZodNullable<z.ZodNumber>;
    quotedFeeMinRwf: z.ZodNullable<z.ZodNumber>;
    quotedFeeMaxRwf: z.ZodNullable<z.ZodNumber>;
    submittedAt: z.ZodString;
    submittedCapacity: z.ZodEnum<["owner", "on_behalf_of"]>;
    /** Named so an owner can see an application sent on their behalf (AC-17). */
    submittedByName: z.ZodNullable<z.ZodString>;
    queuedAt: z.ZodNullable<z.ZodString>;
    decidedAt: z.ZodNullable<z.ZodString>;
    declineReason: z.ZodNullable<z.ZodEnum<["details_incomplete", "not_eligible_for_tier", "business_not_recognised", "other"]>>;
    decisionNote: z.ZodNullable<z.ZodString>;
    withdrawnAt: z.ZodNullable<z.ZodString>;
    form: z.ZodObject<{
        companyName: z.ZodString;
        registrationType: z.ZodString;
        registrationNumber: z.ZodString;
        website: z.ZodNullable<z.ZodString>;
        streetAddress: z.ZodString;
        companyType: z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>;
        ownership: z.ZodEnum<["foreign_100", "rwandan_100", "franchise", "joint_venture", "foreign_representative", "other"]>;
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
        ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
        ownershipOther: string | null;
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeGoods: string | null;
        tradeCountries: string[];
        contactRole: "owner" | "managing_director" | "ceo" | "chairman";
        firstName: string;
        lastName: string;
        email: string;
        registrationType: string;
        registrationNumber: string;
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
        ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
        ownershipOther: string | null;
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeGoods: string | null;
        tradeCountries: string[];
        contactRole: "owner" | "managing_director" | "ceo" | "chairman";
        firstName: string;
        lastName: string;
        email: string;
        registrationType: string;
        registrationNumber: string;
        idDocumentType: "national_id" | "passport";
        idDocumentNumber: string;
    }>;
}, "form">, "strip", z.ZodTypeAny, {
    status: "submitted" | "member" | "declined" | "withdrawn";
    requestedTierCode: string;
    decidedAt: string | null;
    submittedAt: string;
    id: string;
    requestedTierName: string;
    quotedPriceKind: "fixed" | "range" | "set_by_psf";
    quotedFeeRwf: number | null;
    quotedFeeMinRwf: number | null;
    quotedFeeMaxRwf: number | null;
    submittedCapacity: "owner" | "on_behalf_of";
    submittedByName: string | null;
    queuedAt: string | null;
    declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
    decisionNote: string | null;
    withdrawnAt: string | null;
}, {
    status: "submitted" | "member" | "declined" | "withdrawn";
    requestedTierCode: string;
    decidedAt: string | null;
    submittedAt: string;
    id: string;
    requestedTierName: string;
    quotedPriceKind: "fixed" | "range" | "set_by_psf";
    quotedFeeRwf: number | null;
    quotedFeeMinRwf: number | null;
    quotedFeeMaxRwf: number | null;
    submittedCapacity: "owner" | "on_behalf_of";
    submittedByName: string | null;
    queuedAt: string | null;
    declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
    decisionNote: string | null;
    withdrawnAt: string | null;
}>;
export type AdminPsfApplication = z.infer<typeof AdminPsfApplication>;
/** The PSF section of the admin business detail (AC-20). */
export declare const AdminOrgPsf: z.ZodObject<{
    membership: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        source: z.ZodEnum<["psf_confirmed", "self_declared"]>;
        tierCode: z.ZodNullable<z.ZodString>;
        tierName: z.ZodNullable<z.ZodString>;
        membershipNumber: z.ZodString;
        annualFeeRwf: z.ZodNullable<z.ZodNumber>;
        startsOn: z.ZodNullable<z.ZodString>;
        expiresOn: z.ZodNullable<z.ZodString>;
        endedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        expiresOn: string | null;
        annualFeeRwf: number | null;
        id: string;
        source: "psf_confirmed" | "self_declared";
        tierCode: string | null;
        tierName: string | null;
        membershipNumber: string;
        startsOn: string | null;
        endedAt: string | null;
    }, {
        expiresOn: string | null;
        annualFeeRwf: number | null;
        id: string;
        source: "psf_confirmed" | "self_declared";
        tierCode: string | null;
        tierName: string | null;
        membershipNumber: string;
        startsOn: string | null;
        endedAt: string | null;
    }>>;
    applications: z.ZodArray<z.ZodObject<Omit<{
        id: z.ZodString;
        status: z.ZodEnum<["submitted", "member", "declined", "withdrawn"]>;
        requestedTierCode: z.ZodString;
        requestedTierName: z.ZodString;
        quotedPriceKind: z.ZodEnum<["fixed", "range", "set_by_psf"]>;
        quotedFeeRwf: z.ZodNullable<z.ZodNumber>;
        quotedFeeMinRwf: z.ZodNullable<z.ZodNumber>;
        quotedFeeMaxRwf: z.ZodNullable<z.ZodNumber>;
        submittedAt: z.ZodString;
        submittedCapacity: z.ZodEnum<["owner", "on_behalf_of"]>;
        /** Named so an owner can see an application sent on their behalf (AC-17). */
        submittedByName: z.ZodNullable<z.ZodString>;
        queuedAt: z.ZodNullable<z.ZodString>;
        decidedAt: z.ZodNullable<z.ZodString>;
        declineReason: z.ZodNullable<z.ZodEnum<["details_incomplete", "not_eligible_for_tier", "business_not_recognised", "other"]>>;
        decisionNote: z.ZodNullable<z.ZodString>;
        withdrawnAt: z.ZodNullable<z.ZodString>;
        form: z.ZodObject<{
            companyName: z.ZodString;
            registrationType: z.ZodString;
            registrationNumber: z.ZodString;
            website: z.ZodNullable<z.ZodString>;
            streetAddress: z.ZodString;
            companyType: z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>;
            ownership: z.ZodEnum<["foreign_100", "rwandan_100", "franchise", "joint_venture", "foreign_representative", "other"]>;
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
            ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationType: string;
            registrationNumber: string;
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
            ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
            ownershipOther: string | null;
            businessActivity: string;
            tradeDirection: "none" | "export" | "import" | "both";
            tradeGoods: string | null;
            tradeCountries: string[];
            contactRole: "owner" | "managing_director" | "ceo" | "chairman";
            firstName: string;
            lastName: string;
            email: string;
            registrationType: string;
            registrationNumber: string;
            idDocumentType: "national_id" | "passport";
            idDocumentNumber: string;
        }>;
    }, "form">, "strip", z.ZodTypeAny, {
        status: "submitted" | "member" | "declined" | "withdrawn";
        requestedTierCode: string;
        decidedAt: string | null;
        submittedAt: string;
        id: string;
        requestedTierName: string;
        quotedPriceKind: "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        decisionNote: string | null;
        withdrawnAt: string | null;
    }, {
        status: "submitted" | "member" | "declined" | "withdrawn";
        requestedTierCode: string;
        decidedAt: string | null;
        submittedAt: string;
        id: string;
        requestedTierName: string;
        quotedPriceKind: "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        decisionNote: string | null;
        withdrawnAt: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    membership: {
        expiresOn: string | null;
        annualFeeRwf: number | null;
        id: string;
        source: "psf_confirmed" | "self_declared";
        tierCode: string | null;
        tierName: string | null;
        membershipNumber: string;
        startsOn: string | null;
        endedAt: string | null;
    } | null;
    applications: {
        status: "submitted" | "member" | "declined" | "withdrawn";
        requestedTierCode: string;
        decidedAt: string | null;
        submittedAt: string;
        id: string;
        requestedTierName: string;
        quotedPriceKind: "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        decisionNote: string | null;
        withdrawnAt: string | null;
    }[];
}, {
    membership: {
        expiresOn: string | null;
        annualFeeRwf: number | null;
        id: string;
        source: "psf_confirmed" | "self_declared";
        tierCode: string | null;
        tierName: string | null;
        membershipNumber: string;
        startsOn: string | null;
        endedAt: string | null;
    } | null;
    applications: {
        status: "submitted" | "member" | "declined" | "withdrawn";
        requestedTierCode: string;
        decidedAt: string | null;
        submittedAt: string;
        id: string;
        requestedTierName: string;
        quotedPriceKind: "fixed" | "range" | "set_by_psf";
        quotedFeeRwf: number | null;
        quotedFeeMinRwf: number | null;
        quotedFeeMaxRwf: number | null;
        submittedCapacity: "owner" | "on_behalf_of";
        submittedByName: string | null;
        queuedAt: string | null;
        declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
        decisionNote: string | null;
        withdrawnAt: string | null;
    }[];
}>;
export type AdminOrgPsf = z.infer<typeof AdminOrgPsf>;
/** `POST /orgs/:orgId/psf-applications` (AC-16). */
export declare const CreatePsfApplicationRequest: z.ZodEffects<z.ZodObject<{
    requestedTierCode: z.ZodString;
    companyName: z.ZodString;
    streetAddress: z.ZodString;
    website: z.ZodOptional<z.ZodString>;
    companyType: z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>;
    ownership: z.ZodEnum<["foreign_100", "rwandan_100", "franchise", "joint_venture", "foreign_representative", "other"]>;
    ownershipOther: z.ZodOptional<z.ZodString>;
    businessActivity: z.ZodString;
    tradeDirection: z.ZodEnum<["none", "export", "import", "both"]>;
    tradeGoods: z.ZodOptional<z.ZodString>;
    tradeCountries: z.ZodDefault<z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">>;
    contactRole: z.ZodEnum<["owner", "managing_director", "ceo", "chairman"]>;
    firstName: z.ZodString;
    lastName: z.ZodString;
    gender: z.ZodEnum<["male", "female"]>;
    phoneE164: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    email: z.ZodString;
    idDocument: z.ZodDiscriminatedUnion<"documentType", [z.ZodObject<{
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
    }>]>;
    dateOfBirth: z.ZodEffects<z.ZodString, string, string>;
    consent: z.ZodLiteral<true>;
}, "strip", z.ZodTypeAny, {
    gender: "female" | "male";
    dateOfBirth: string;
    phoneE164: string;
    requestedTierCode: string;
    companyName: string;
    streetAddress: string;
    companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
    ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
    businessActivity: string;
    tradeDirection: "none" | "export" | "import" | "both";
    tradeCountries: string[];
    contactRole: "owner" | "managing_director" | "ceo" | "chairman";
    firstName: string;
    lastName: string;
    email: string;
    idDocument: {
        documentType: "national_id";
        documentNumber: string;
    } | {
        documentType: "passport";
        documentNumber: string;
    };
    consent: true;
    website?: string | undefined;
    ownershipOther?: string | undefined;
    tradeGoods?: string | undefined;
}, {
    gender: "female" | "male";
    dateOfBirth: string;
    phoneE164: string;
    requestedTierCode: string;
    companyName: string;
    streetAddress: string;
    companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
    ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
    businessActivity: string;
    tradeDirection: "none" | "export" | "import" | "both";
    contactRole: "owner" | "managing_director" | "ceo" | "chairman";
    firstName: string;
    lastName: string;
    email: string;
    idDocument: {
        documentType: "national_id";
        documentNumber: string;
    } | {
        documentType: "passport";
        documentNumber: string;
    };
    consent: true;
    website?: string | undefined;
    ownershipOther?: string | undefined;
    tradeGoods?: string | undefined;
    tradeCountries?: string[] | undefined;
}>, {
    gender: "female" | "male";
    dateOfBirth: string;
    phoneE164: string;
    requestedTierCode: string;
    companyName: string;
    streetAddress: string;
    companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
    ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
    businessActivity: string;
    tradeDirection: "none" | "export" | "import" | "both";
    tradeCountries: string[];
    contactRole: "owner" | "managing_director" | "ceo" | "chairman";
    firstName: string;
    lastName: string;
    email: string;
    idDocument: {
        documentType: "national_id";
        documentNumber: string;
    } | {
        documentType: "passport";
        documentNumber: string;
    };
    consent: true;
    website?: string | undefined;
    ownershipOther?: string | undefined;
    tradeGoods?: string | undefined;
}, {
    gender: "female" | "male";
    dateOfBirth: string;
    phoneE164: string;
    requestedTierCode: string;
    companyName: string;
    streetAddress: string;
    companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
    ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
    businessActivity: string;
    tradeDirection: "none" | "export" | "import" | "both";
    contactRole: "owner" | "managing_director" | "ceo" | "chairman";
    firstName: string;
    lastName: string;
    email: string;
    idDocument: {
        documentType: "national_id";
        documentNumber: string;
    } | {
        documentType: "passport";
        documentNumber: string;
    };
    consent: true;
    website?: string | undefined;
    ownershipOther?: string | undefined;
    tradeGoods?: string | undefined;
    tradeCountries?: string[] | undefined;
}>;
export type CreatePsfApplicationRequest = z.infer<typeof CreatePsfApplicationRequest>;
export declare const PsfQueueItem: z.ZodObject<{
    applicationId: z.ZodString;
    orgId: z.ZodString;
    businessName: z.ZodString;
    districtName: z.ZodNullable<z.ZodString>;
    requestedTierName: z.ZodString;
    submittedAt: z.ZodString;
    queuedAt: z.ZodNullable<z.ZodString>;
    registrationStatus: z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>;
    /** False when the officer holds a stake in the business (AC-14). */
    canDecide: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    orgId: string;
    districtName: string | null;
    submittedAt: string;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    requestedTierName: string;
    queuedAt: string | null;
    applicationId: string;
    businessName: string;
    canDecide: boolean;
}, {
    orgId: string;
    districtName: string | null;
    submittedAt: string;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    requestedTierName: string;
    queuedAt: string | null;
    applicationId: string;
    businessName: string;
    canDecide: boolean;
}>;
export type PsfQueueItem = z.infer<typeof PsfQueueItem>;
export declare const PsfQueuePage: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        applicationId: z.ZodString;
        orgId: z.ZodString;
        businessName: z.ZodString;
        districtName: z.ZodNullable<z.ZodString>;
        requestedTierName: z.ZodString;
        submittedAt: z.ZodString;
        queuedAt: z.ZodNullable<z.ZodString>;
        registrationStatus: z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>;
        /** False when the officer holds a stake in the business (AC-14). */
        canDecide: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        orgId: string;
        districtName: string | null;
        submittedAt: string;
        registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        requestedTierName: string;
        queuedAt: string | null;
        applicationId: string;
        businessName: string;
        canDecide: boolean;
    }, {
        orgId: string;
        districtName: string | null;
        submittedAt: string;
        registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        requestedTierName: string;
        queuedAt: string | null;
        applicationId: string;
        businessName: string;
        canDecide: boolean;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        orgId: string;
        districtName: string | null;
        submittedAt: string;
        registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        requestedTierName: string;
        queuedAt: string | null;
        applicationId: string;
        businessName: string;
        canDecide: boolean;
    }[];
    nextCursor: string | null;
}, {
    items: {
        orgId: string;
        districtName: string | null;
        submittedAt: string;
        registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        requestedTierName: string;
        queuedAt: string | null;
        applicationId: string;
        businessName: string;
        canDecide: boolean;
    }[];
    nextCursor: string | null;
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
    status: z.ZodEnum<["submitted", "member", "declined", "withdrawn"]>;
    requestedTierCode: z.ZodString;
    requestedTierName: z.ZodString;
    quotedPriceKind: z.ZodEnum<["fixed", "range", "set_by_psf"]>;
    quotedFeeRwf: z.ZodNullable<z.ZodNumber>;
    quotedFeeMinRwf: z.ZodNullable<z.ZodNumber>;
    quotedFeeMaxRwf: z.ZodNullable<z.ZodNumber>;
    submittedAt: z.ZodString;
    submittedCapacity: z.ZodEnum<["owner", "on_behalf_of"]>;
    /** Named so an owner can see an application sent on their behalf (AC-17). */
    submittedByName: z.ZodNullable<z.ZodString>;
    queuedAt: z.ZodNullable<z.ZodString>;
    decidedAt: z.ZodNullable<z.ZodString>;
    declineReason: z.ZodNullable<z.ZodEnum<["details_incomplete", "not_eligible_for_tier", "business_not_recognised", "other"]>>;
    decisionNote: z.ZodNullable<z.ZodString>;
    withdrawnAt: z.ZodNullable<z.ZodString>;
    form: z.ZodObject<{
        companyName: z.ZodString;
        registrationType: z.ZodString;
        registrationNumber: z.ZodString;
        website: z.ZodNullable<z.ZodString>;
        streetAddress: z.ZodString;
        companyType: z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>;
        ownership: z.ZodEnum<["foreign_100", "rwandan_100", "franchise", "joint_venture", "foreign_representative", "other"]>;
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
        ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
        ownershipOther: string | null;
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeGoods: string | null;
        tradeCountries: string[];
        contactRole: "owner" | "managing_director" | "ceo" | "chairman";
        firstName: string;
        lastName: string;
        email: string;
        registrationType: string;
        registrationNumber: string;
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
        ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
        ownershipOther: string | null;
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeGoods: string | null;
        tradeCountries: string[];
        contactRole: "owner" | "managing_director" | "ceo" | "chairman";
        firstName: string;
        lastName: string;
        email: string;
        registrationType: string;
        registrationNumber: string;
        idDocumentType: "national_id" | "passport";
        idDocumentNumber: string;
    }>;
} & {
    orgId: z.ZodString;
    businessName: z.ZodString;
    districtName: z.ZodNullable<z.ZodString>;
    registrationStatus: z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>;
    canDecide: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    status: "submitted" | "member" | "declined" | "withdrawn";
    requestedTierCode: string;
    decidedAt: string | null;
    orgId: string;
    districtName: string | null;
    submittedAt: string;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    id: string;
    requestedTierName: string;
    quotedPriceKind: "fixed" | "range" | "set_by_psf";
    quotedFeeRwf: number | null;
    quotedFeeMinRwf: number | null;
    quotedFeeMaxRwf: number | null;
    submittedCapacity: "owner" | "on_behalf_of";
    submittedByName: string | null;
    queuedAt: string | null;
    declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
    decisionNote: string | null;
    withdrawnAt: string | null;
    form: {
        gender: "female" | "male";
        dateOfBirth: string;
        phoneE164: string;
        companyName: string;
        streetAddress: string;
        website: string | null;
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
        ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
        ownershipOther: string | null;
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeGoods: string | null;
        tradeCountries: string[];
        contactRole: "owner" | "managing_director" | "ceo" | "chairman";
        firstName: string;
        lastName: string;
        email: string;
        registrationType: string;
        registrationNumber: string;
        idDocumentType: "national_id" | "passport";
        idDocumentNumber: string;
    };
    businessName: string;
    canDecide: boolean;
}, {
    status: "submitted" | "member" | "declined" | "withdrawn";
    requestedTierCode: string;
    decidedAt: string | null;
    orgId: string;
    districtName: string | null;
    submittedAt: string;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    id: string;
    requestedTierName: string;
    quotedPriceKind: "fixed" | "range" | "set_by_psf";
    quotedFeeRwf: number | null;
    quotedFeeMinRwf: number | null;
    quotedFeeMaxRwf: number | null;
    submittedCapacity: "owner" | "on_behalf_of";
    submittedByName: string | null;
    queuedAt: string | null;
    declineReason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised" | null;
    decisionNote: string | null;
    withdrawnAt: string | null;
    form: {
        gender: "female" | "male";
        dateOfBirth: string;
        phoneE164: string;
        companyName: string;
        streetAddress: string;
        website: string | null;
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
        ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
        ownershipOther: string | null;
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeGoods: string | null;
        tradeCountries: string[];
        contactRole: "owner" | "managing_director" | "ceo" | "chairman";
        firstName: string;
        lastName: string;
        email: string;
        registrationType: string;
        registrationNumber: string;
        idDocumentType: "national_id" | "passport";
        idDocumentNumber: string;
    };
    businessName: string;
    canDecide: boolean;
}>;
export type PsfOfficerApplication = z.infer<typeof PsfOfficerApplication>;
/** Marking an application `member` (AC-11). */
export declare const PsfMemberDecisionRequest: z.ZodEffects<z.ZodObject<{
    tierCode: z.ZodString;
    membershipNumber: z.ZodString;
    annualFeeRwf: z.ZodEffects<z.ZodNumber, number, number>;
    startsOn: z.ZodString;
    expiresOn: z.ZodString;
}, "strip", z.ZodTypeAny, {
    expiresOn: string;
    annualFeeRwf: number;
    tierCode: string;
    membershipNumber: string;
    startsOn: string;
}, {
    expiresOn: string;
    annualFeeRwf: number;
    tierCode: string;
    membershipNumber: string;
    startsOn: string;
}>, {
    expiresOn: string;
    annualFeeRwf: number;
    tierCode: string;
    membershipNumber: string;
    startsOn: string;
}, {
    expiresOn: string;
    annualFeeRwf: number;
    tierCode: string;
    membershipNumber: string;
    startsOn: string;
}>;
export type PsfMemberDecisionRequest = z.infer<typeof PsfMemberDecisionRequest>;
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
 * The membership dates an officer starts from: today, and one year later less
 * a day (ADR-056 value sourcing). `today` is a yyyy-mm-dd date in
 * Africa/Kigali, which the caller resolves.
 */
export declare function defaultPsfMembershipDates(today: string): {
    startsOn: string;
    expiresOn: string;
};
/**
 * The business activity PSF's form starts from, derived from the
 * accommodation class (ADR-056 value sourcing). Editable wherever it shows.
 */
export declare function psfBusinessActivityFor(accommodationClass: string | null, accommodationClassOther: string | null): string;
/**
 * Split a full name into PSF's two fields at the last space (ADR-056). A
 * starting point the person corrects, never a rule trusted on its own:
 * Rwandan names do not reliably put the family name last.
 */
export declare function splitPsfName(fullName: string): {
    firstName: string;
    lastName: string;
};
//# sourceMappingURL=psf.d.ts.map