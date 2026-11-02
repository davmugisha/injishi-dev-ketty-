import { z } from "zod";
import { OversightScopeLevel, RwfAmount, Uuid } from "./primitives";
import { PsfBranchStatus, PsfBusinessBranch, PsfBusinessRow, PsfDeclineReason, PsfMembershipFamily, PsfPriceKind } from "./psf";
import { CountryCode, EnterpriseRegistrationKind, NUMBERED_REGISTRATION_KINDS, PsfCompanyType, PsfContactRole, PsfGender, PsfIdDocument, PsfOwnerGroup, PsfOwnership, PsfTradeDirection, RwandanNationalId, Tin } from "./registration";
/**
 * THE PUBLIC PSF PATH (2026-10-19).
 *
 * A business of any sector joins PSF through Injishi without an account. It
 * fills in one form (who it is, its business, the membership it can afford),
 * pays its first year's membership fee, and receives a docID. There is no
 * registration fee, and nothing is refunded (2026-10-23). The docID is the
 * only thing it keeps: it opens the tracking page, which shows where the
 * application stands and shows the membership certificate once PSF approves.
 *
 * A hotel still applies from its own workspace (`psf.ts`); this file is the
 * path for everyone else.
 *
 * THE DOCID IS A BEARER KEY. Whoever holds it reads the application's status
 * and may pay its fee, so it is random (40 bits, never a counter), the tracking
 * read carries nothing an ID thief could use (no ID number, no birth date, the
 * phone and email masked), and the endpoint is rate limited.
 */
// ---------------------------------------------------------------------------
// The docID
// ---------------------------------------------------------------------------
/** Crockford's base32: no I, L, O or U, so a docID read aloud is unambiguous. */
export const PSF_DOC_ID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/** `PSF-` and two groups of four: 40 random bits. */
export const PSF_DOC_ID_PATTERN = /^PSF-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
/**
 * A new docID from eight random bytes' worth of entropy. The caller passes its
 * own random source (`crypto.randomBytes` on the server), so contracts stays
 * free of Node.
 */
export function newPsfDocId(randomBytes: (n: number) => Uint8Array): string {
    const bytes = randomBytes(8);
    let out = "";
    for (let i = 0; i < 8; i += 1)
        out += PSF_DOC_ID_ALPHABET[bytes[i]! & 31];
    return `PSF-${out.slice(0, 4)}-${out.slice(4)}`;
}
/**
 * A docID as somebody typed it, made canonical: upper case, the dashes put
 * back, and the letters Crockford folds (O to 0, I and L to 1) folded. Returns
 * null when what is left cannot be a docID.
 */
export function normalizePsfDocId(input: string): string | null {
    let s = input.toUpperCase().replace(/[\s_-]/g, "");
    if (s.startsWith("PSF"))
        s = s.slice(3);
    s = s.replace(/O/g, "0").replace(/[IL]/g, "1");
    if (s.length !== 8)
        return null;
    const id = `PSF-${s.slice(0, 4)}-${s.slice(4)}`;
    return PSF_DOC_ID_PATTERN.test(id) ? id : null;
}
export function isPsfDocId(value: string): boolean {
    return PSF_DOC_ID_PATTERN.test(value);
}
export const PsfDocId = z
    .string()
    .trim()
    .transform((v, ctx) => {
    const id = normalizePsfDocId(v);
    if (!id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A docID looks like PSF-7K3M-Q9XD." });
        return z.NEVER;
    }
    return id;
});
// ---------------------------------------------------------------------------
// Step 1: who is applying (a National ID, bound by a code to its phone)
// ---------------------------------------------------------------------------
/** `POST /psf/identity/lookup` */
export const PsfIdentityLookupRequest = z.object({
    documentNumber: RwandanNationalId,
    consent: z.literal(true, {
        errorMap: () => ({ message: "Tick the box so we can check the number." }),
    }),
});
export type PsfIdentityLookupRequest = z.infer<typeof PsfIdentityLookupRequest>;
export const PsfIdentityLookupResult = z.discriminatedUnion("status", [
    z.object({
        status: z.literal("code_sent"),
        checkId: Uuid,
        /** Where the code went, masked: `+250 78• ••• 545`. */
        sentTo: z.string(),
        expiresInSeconds: z.number().int(),
        /**
         * The code, when no text really goes: the demo's fixed code, or the one just made while SMS is the
         * mock (a sample database). Null wherever a real text is sent.
         */
        demoCode: z.string().nullable(),
    }),
    z.object({ status: z.enum(["not_found", "no_phone", "unavailable"]), message: z.string() }),
]);
export type PsfIdentityLookupResult = z.infer<typeof PsfIdentityLookupResult>;
/**
 * Tracking by membership number (2026-11-02). The number is printed on the certificate, so it alone
 * opens nothing: a code goes by text to the phone on file, and only the code read back answers the
 * docID, which opens the tracking page as before. The docID alone keeps working.
 */
export const PsfMemberLookupRequest = z.object({
    membershipNumber: z.string().trim().min(4, "Type the membership number as it is on the certificate.").max(40),
});
export type PsfMemberLookupRequest = z.infer<typeof PsfMemberLookupRequest>;
export const PsfMemberLookupResult = z.discriminatedUnion("status", [
    z.object({
        status: z.literal("code_sent"),
        /** Carries the docID, the code's fingerprint and its expiry, signed: nothing is kept on the server. */
        lookupToken: z.string(),
        sentTo: z.string(),
        expiresInSeconds: z.number().int(),
        /** The code, when no text really goes (a test setup). Null wherever a real text is sent. */
        demoCode: z.string().nullable(),
    }),
    z.object({ status: z.enum(["not_found", "no_phone", "unavailable"]), message: z.string() }),
]);
export type PsfMemberLookupResult = z.infer<typeof PsfMemberLookupResult>;
export const PsfMemberLookupConfirm = z.object({
    lookupToken: z.string().min(10).max(2000),
    code: z.string().trim().regex(/^\d{6}$/, "Type the 6 digits from the text."),
});
export type PsfMemberLookupConfirm = z.infer<typeof PsfMemberLookupConfirm>;
export const PsfMemberLookupConfirmed = z.object({ docId: z.string() });
export type PsfMemberLookupConfirmed = z.infer<typeof PsfMemberLookupConfirmed>;
/** `POST /psf/identity/confirm` */
export const PsfIdentityConfirmRequest = z.object({
    checkId: Uuid,
    code: z.string().trim().regex(/^\d{6}$/, "The code is 6 digits."),
});
export type PsfIdentityConfirmRequest = z.infer<typeof PsfIdentityConfirmRequest>;
/**
 * The person the register holds, revealed to whoever read the code. The token
 * proves the check on submit; it lives 30 minutes and is spent by one submit.
 */
export const PsfVerifiedApplicant = z.object({
    checkToken: z.string(),
    fullName: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    dateOfBirth: z.string(),
    gender: z.enum(["male", "female"]).nullable(),
    documentNumberMasked: z.string(),
    /** The register's phone, masked. The contact phone starts from it. */
    phoneMasked: z.string().nullable(),
    /** The register's phone in full, to prefill the contact and MoMo fields. */
    phoneE164: z.string().nullable(),
    generated: z.boolean(),
    expiresAt: z.string(),
});
export type PsfVerifiedApplicant = z.infer<typeof PsfVerifiedApplicant>;
// ---------------------------------------------------------------------------
// The one form
// ---------------------------------------------------------------------------
const text = (max: number, required: string) => z.string().trim().min(1, required).max(max, "That is too long for PSF's form.");
const phone = z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\+\d{7,15}$/, "Include the country code, like +250788123456."));
export const MomoPhone = z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\+2507\d{8}$/, "Give a Rwandan mobile money number, like +250788123456."));
/** Where the business is. The street line is optional (2026-11-02): the village places it, and not every plot has one. */
export const PsfPublicAddress = z.object({
    provinceId: z.number().int().positive("Choose a province."),
    districtId: z.number().int().positive("Choose a district."),
    sectorId: z.number().int().positive("Choose a sector."),
    cellId: z.number().int().positive().optional(),
    villageId: z.number().int().positive().optional(),
    street: z.string().trim().max(200, "Keep the street address under 200 characters.").default(""),
});
export type PsfPublicAddress = z.infer<typeof PsfPublicAddress>;
/**
 * Each cluster's catch-all association (`industry_other`, `trade_other`, …):
 * where a business whose association is not on PSF's list is filed, beside the
 * name it types.
 */
export function isOtherAssociation(code: string): boolean {
    return code.endsWith("_other");
}
/** How many branches one form may list, as many as the hotel form allows. */
export const MAX_PSF_BRANCHES = 20;
/**
 * Another place the business trades from (2026-10-23), under the business's
 * own name. Each goes to the PSF officer of its own district to admit, so it
 * carries the same address as the head office: province, district, sector
 * and a street line.
 */
export const PsfPublicBranch = z.object({
    address: PsfPublicAddress,
});
export type PsfPublicBranch = z.infer<typeof PsfPublicBranch>;
/** Two places are the same place when the sector matches and the street differs only in case and spacing. */
export function psfPlaceKey(address: Pick<PsfPublicAddress, "sectorId" | "street">): string {
    return `${address.sectorId}:${address.street.trim().replace(/\s+/g, " ").toLowerCase()}`;
}
export const PsfPublicBusiness = z
    .object({
    legalName: z.string().trim().min(2, "Give the name of the business.").max(200, "That name is too long."),
    registrationKind: EnterpriseRegistrationKind,
    tin: Tin.optional(),
    registrationNumber: z.string().trim().min(1, "Give the registration number.").max(60).optional(),
    /** The sector's subtype the business picked, or `subsectorOther` when none fits. */
    subsectorId: Uuid.optional(),
    subsectorOther: z.string().trim().min(2, "Name the kind of business.").max(80).optional(),
    associationCode: z.string().trim().min(1, "Pick the association your business belongs to.").max(60),
    /**
     * The association the business names itself when PSF's list does not have
     * it. Goes with the cluster's own "other" row (`isOtherAssociation`).
     */
    associationOther: z.string().trim().min(2, "Name your association, or what the business does.").max(120).optional(),
    ownerGroups: z.array(PsfOwnerGroup).max(3).default([]),
    address: PsfPublicAddress,
    companyType: PsfCompanyType,
    ownership: PsfOwnership,
    ownershipOther: z.string().trim().min(1).max(120).optional(),
    businessActivity: text(300, "Say in a few words what the business does."),
    website: z.string().trim().max(200).url("Give the full address, like https://example.rw.").optional(),
    /**
     * The business's logo (2026-10-23), optional: the key `POST /psf/logo`
     * returned. It is printed on the membership certificate.
     */
    logoObjectKey: z.string().trim().min(1).max(200).optional(),
    tradeDirection: PsfTradeDirection,
    tradeGoods: z.string().trim().min(1).max(300).optional(),
    tradeCountries: z.array(CountryCode).max(50).default([]),
    branches: z.array(PsfPublicBranch).max(MAX_PSF_BRANCHES, `List at most ${MAX_PSF_BRANCHES} branches.`).default([]),
})
    .superRefine((v, ctx) => {
    if (v.registrationKind === "tin" && !v.tin)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tin"], message: "Enter the 9-digit TIN." });
    if (v.registrationKind !== "tin" && v.tin)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tin"], message: "Only give a TIN when you pick TIN." });
    const numbered = NUMBERED_REGISTRATION_KINDS.includes(v.registrationKind);
    if (numbered && !v.registrationNumber)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["registrationNumber"], message: "Give the registration number." });
    if (!numbered && v.registrationNumber)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["registrationNumber"], message: "Leave this empty for this kind of registration." });
    if (new Set(v.ownerGroups).size !== v.ownerGroups.length)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ownerGroups"], message: "Pick each group once." });
    if (!v.subsectorId && !v.subsectorOther)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["subsectorId"], message: "Pick the kind of business, or type it." });
    if (v.subsectorId && v.subsectorOther)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["subsectorOther"], message: "Pick one from the list or type one, not both." });
    if (isOtherAssociation(v.associationCode) && !v.associationOther)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["associationOther"], message: "Name your association, or what the business does." });
    if (!isOtherAssociation(v.associationCode) && v.associationOther)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["associationOther"], message: "Only name one when it is not on PSF's list." });
    if (v.ownership === "other" && !v.ownershipOther)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ownershipOther"], message: "Say what the ownership is." });
    if (v.tradeDirection !== "none" && !v.tradeGoods)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tradeGoods"], message: "Say what you trade." });
    if (v.tradeDirection !== "none" && v.tradeCountries.length === 0)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tradeCountries"], message: "Pick at least one country you trade with." });
    const seen = new Set([psfPlaceKey(v.address)]);
    v.branches.forEach((b, i) => {
        const key = psfPlaceKey(b.address);
        if (seen.has(key))
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["branches", i, "address", "street"], message: "This place is already listed. Each branch is somewhere else." });
        seen.add(key);
    });
});
export type PsfPublicBusiness = z.infer<typeof PsfPublicBusiness>;
export const PsfPublicContact = z.object({
    role: PsfContactRole,
    /** PSF's form knows two genders; the register may hold none. */
    gender: PsfGender,
    phoneE164: phone,
    /** Optional: status reaches the phone by SMS either way. */
    email: z.string().trim().email("That email address does not look right.").optional(),
});
export type PsfPublicContact = z.infer<typeof PsfPublicContact>;
export const PsfPublicMembership = z.object({
    tierCode: z.string().trim().min(1, "Pick a membership.").max(60),
    /**
     * The yearly amount the business will pay (2026-10-23): at least PSF's
     * price for the band in its district, and no more than the band's ceiling
     * (`psfFeeCeilings`). The API refuses an amount outside the band, so
     * nobody is charged a figure the band does not allow.
     */
    declaredFeeRwf: RwfAmount.refine((n) => n > 0, "Give the amount you will pay.").optional(),
    /**
     * A holder of an old PSF card joining the new module (2026-11-02): no fee now, its card instead,
     * which PSF checks before it gives a new number and a certificate.
     */
    intake: z.enum(["new", "card_holder"]).default("new"),
    /** The card, uploaded under the form's ID check (`POST /psf/card-upload`). Required for a card holder. */
    cardObjectKey: z.string().min(1).max(300).optional(),
});
export type PsfPublicMembership = z.infer<typeof PsfPublicMembership>;
/** `POST /psf/applications`: the whole form, and the number the membership fee is charged to. */
export const PsfPublicSubmitRequest = z.object({
    checkToken: z.string().min(16).max(200),
    business: PsfPublicBusiness,
    membership: PsfPublicMembership,
    contact: PsfPublicContact,
    /** The number the membership fee is charged to; a card holder pays nothing now and sends none. */
    payerPhoneE164: MomoPhone.optional(),
    consent: z.literal(true, {
        errorMap: () => ({ message: "Tick the box to agree to share this with PSF." }),
    }),
})
    .superRefine((v, ctx) => {
    if (v.membership.intake === "card_holder" && !v.membership.cardObjectKey) {
        ctx.addIssue({ code: "custom", path: ["membership", "cardObjectKey"], message: "Add a photo or scan of your PSF card." });
    }
    if (v.membership.intake === "new" && !v.payerPhoneE164) {
        ctx.addIssue({ code: "custom", path: ["payerPhoneE164"], message: "Give the mobile money number to pay from." });
    }
});
export type PsfPublicSubmitRequest = z.infer<typeof PsfPublicSubmitRequest>;
/**
 * `POST /psf/logo` (2026-10-23): a logo uploaded from the form, under the
 * form's verified ID check (`x-psf-check-token`), never a session. What comes
 * back is the key the form sends as `business.logoObjectKey`.
 */
export const PsfLogoUploadResult = z.object({ objectKey: z.string(), sizeBytes: z.number().int() });
/** `POST /psf/card-upload` (2026-11-02): a card holder's old PSF card, uploaded under the form's ID check. */
export const PsfCardUploadResult = z.object({ objectKey: z.string(), sizeBytes: z.number().int(), filename: z.string() });
export type PsfCardUploadResult = z.infer<typeof PsfCardUploadResult>;
export type PsfLogoUploadResult = z.infer<typeof PsfLogoUploadResult>;
/** The header the logo upload carries the form's ID check token in. */
export const PSF_CHECK_TOKEN_HEADER = "x-psf-check-token";
export const PsfPublicSubmitResult = z.object({
    docId: z.string(),
    businessCode: z.string().nullable(),
    /** What the one payment at submit came to: the membership fee, nothing else (2026-10-23). */
    totalRwf: z.number().int(),
    /** False when the fee charge did not settle; the tracking page offers it again. */
    feePaid: z.boolean(),
    feeProblem: z.string().nullable(),
});
export type PsfPublicSubmitResult = z.infer<typeof PsfPublicSubmitResult>;
// ---------------------------------------------------------------------------
// Tracking
// ---------------------------------------------------------------------------
/**
 * Where an application stands, as its tracking page reads it. Derived, never
 * stored.
 *
 *   fee_due        submitted, the membership fee not settled yet
 *   under_review   the fee paid, the business code given, PSF reviewing
 *   approved       PSF approved; the membership fee is owed
 *   member         paid: a current membership
 *   lapsed         the membership ended
 *   declined       PSF declined it
 *   withdrawn      withdrawn (by PSF, on the business's request)
 */
export const PsfTrackStage = z.enum(["fee_due", "under_review", "approved", "member", "lapsed", "declined", "withdrawn"]);
export type PsfTrackStage = z.infer<typeof PsfTrackStage>;
export const PSF_TRACK_STAGE_LABEL: Readonly<Record<PsfTrackStage, string>> = {
    fee_due: "Payment due",
    under_review: "Under review",
    approved: "Approved, pay to join",
    member: "PSF member",
    lapsed: "Membership ended",
    declined: "Declined",
    withdrawn: "Withdrawn",
};
export const PsfTrackEventKind = z.enum(["submitted", "fee_paid", "code_issued", "in_review", "approved", "declined", "paid", "expired", "renewed", "withdrawn"]);
export type PsfTrackEventKind = z.infer<typeof PsfTrackEventKind>;
export const PsfTrackEvent = z.object({
    kind: PsfTrackEventKind,
    at: z.string(),
    title: z.string(),
    detail: z.string().nullable(),
});
export type PsfTrackEvent = z.infer<typeof PsfTrackEvent>;
/** `GET /psf/track/:docId`. Nothing here helps anyone pretend to be the applicant. */
/**
 * One payment on an application, for the tracking page and the officer. A
 * `registration_fee` is a hotel's account fee, or one a PSF business paid
 * before the fee was dropped (2026-10-23); nothing is refunded.
 */
export const PsfPaymentLine = z.object({
    kind: z.enum(["registration_fee", "membership_fee", "membership_renewal"]),
    amountRwf: z.number().int(),
    at: z.string().nullable(),
    status: z.enum(["paid"]),
    reference: z.string().nullable(),
});
export type PsfPaymentLine = z.infer<typeof PsfPaymentLine>;
// ---------------------------------------------------------------------------
// The PSF team (2026-11-02): a Province Manager appoints its District Managers,
// and a District Manager its district's BDEs
// ---------------------------------------------------------------------------
/** The two district posts: a Province Manager fills the first, a District Manager the second. */
export const PsfTeamRole = z.enum(["district_manager", "business_officer"]);
export type PsfTeamRole = z.infer<typeof PsfTeamRole>;
export const PSF_TEAM_ROLE_LABEL: Readonly<Record<PsfTeamRole, string>> = {
    district_manager: "District Manager",
    business_officer: "Business Development & Empowerment (BDE)",
};
export const PSF_TEAM_ROLE_DESCRIPTION: Readonly<Record<PsfTeamRole, string>> = {
    district_manager: "Decides membership applications and claims, and sets the district's fees and subtypes.",
    business_officer: "Reads the district's applications, businesses, decisions and reports. Approvals come later.",
};
export const PsfTeamMember = z.object({
    assignmentId: Uuid,
    name: z.string().nullable(),
    email: z.string(),
    role: PsfTeamRole,
    title: z.string().nullable(),
    districtId: z.number().int(),
    districtName: z.string().nullable(),
    appointedAt: z.string(),
    appointedByName: z.string().nullable(),
    /** Their ID as typed at the appointment, masked ("National ID ending 5187"); null for an older one. */
    idDocumentLine: z.string().nullable().default(null),
});
export type PsfTeamMember = z.infer<typeof PsfTeamMember>;
/** `GET /oversight/psf/team`: the people in the caller's districts, and where the caller may appoint. */
export const PsfTeamView = z.object({
    /** May appoint and end: a Province or National Manager (District Managers), a District Manager (BDEs). */
    canAppoint: z.boolean(),
    /** The posts the caller fills (2026-11-02). */
    appointRoles: z.array(PsfTeamRole).default([]),
    /** The districts the caller may appoint in, by province. */
    districts: z.array(z.object({ id: z.number().int(), name: z.string(), provinceName: z.string().nullable() })),
    members: z.array(PsfTeamMember),
});
export type PsfTeamView = z.infer<typeof PsfTeamView>;
export const AppointPsfTeamRequest = z.object({
    email: z.string().trim().toLowerCase().email("Enter their email address."),
    name: z.string().trim().min(2, "Enter their full name.").max(120, "That name is too long."),
    role: PsfTeamRole,
    /** The person's ID (2026-11-02): a National ID or a passport. */
    idDocument: PsfIdDocument,
    districtId: z.number().int().positive({ message: "Pick a district." }),
    reason: z.string().trim().min(3, "Say why, in a few words.").max(500, "That reason is too long."),
});
export type AppointPsfTeamRequest = z.infer<typeof AppointPsfTeamRequest>;
export const EndPsfTeamQuery = z.object({
    reason: z.string().trim().min(3, "Say why, in a few words.").max(500, "That reason is too long."),
});
export type EndPsfTeamQuery = z.infer<typeof EndPsfTeamQuery>;
/** How many days before the end date a membership may be renewed (2026-11-02). */
export const PSF_RENEWAL_WINDOW_DAYS = 60;
/**
 * Renewing a membership (2026-11-02): a paid renewal renews at once, the year
 * runs on from the old end date (or from the payment, once lapsed), and the
 * band may change at the district's current price.
 */
export const PsfRenewalState = z.object({
    /** Whether a renewal can be paid today. */
    open: z.boolean(),
    /** The first day it can be: 60 days before the end date. */
    opensOn: z.string(),
    /** Why it cannot be yet, in a sentence; null when open. */
    reason: z.string().nullable(),
    /** The year a renewal paid today buys. */
    startsOn: z.string(),
    expiresOn: z.string(),
    /** The band held now, pre-picked. */
    tierCode: z.string().nullable(),
    /** A prompt sent and not yet approved. */
    /** A prompt sent and not yet approved: its band, amount, and the phone it went to, masked (2026-11-02). */
    pending: z
        .object({ tierCode: z.string().default(""), tierName: z.string(), amountRwf: RwfAmount, phoneMasked: z.string().nullable().default(null) })
        .nullable(),
});
export type PsfRenewalState = z.infer<typeof PsfRenewalState>;
/** One paid renewal, for the tracking page and the officer. */
export const PsfRenewalLine = z.object({
    paidAt: z.string(),
    membershipNumber: z.string(),
    tierName: z.string(),
    amountRwf: RwfAmount,
    startsOn: z.string(),
    expiresOn: z.string(),
    reference: z.string().nullable(),
});
export type PsfRenewalLine = z.infer<typeof PsfRenewalLine>;
export const PsfTrackView = z.object({
    docId: z.string(),
    /** A card holder joining the new module (2026-11-02): nothing to pay, PSF confirms its card. */
    intake: z.enum(["new", "card_holder"]).default("new"),
    stage: PsfTrackStage,
    submittedAt: z.string(),
    /** Whole days the application has waited on PSF; null when not under review. */
    waitingDays: z.number().int().nullable(),
    business: z.object({
        name: z.string(),
        code: z.string().nullable(),
        districtName: z.string().nullable(),
        provinceName: z.string().nullable(),
        sectorName: z.string().nullable(),
        clusterName: z.string().nullable(),
        subsectorName: z.string().nullable(),
        associationName: z.string().nullable(),
        ownerGroups: z.array(PsfOwnerGroup),
        registrationKind: EnterpriseRegistrationKind.nullable(),
        /** The business's district, for the renewal's band prices. */
        districtId: z.number().int().nullable().default(null),
        /** The business's logo, as an address under the API (`/v1/psf/track/:docId/logo`); null without one. */
        logoUrl: z.string().nullable().default(null),
        /** Each branch and where its own district's PSF office stands on it. */
        branches: z
            .array(z.object({ districtName: z.string().nullable(), sectorName: z.string().nullable(), status: PsfBranchStatus, note: z.string().nullable() }))
            .default([]),
    }),
    request: z.object({
        family: PsfMembershipFamily,
        familyName: z.string(),
        tierName: z.string(),
        declaredFeeRwf: RwfAmount.nullable(),
    }),
    /** Who reviews it: "PSF Kicukiro district office". */
    reviewingOffice: z.string(),
    approval: z.object({ membershipNumber: z.string(), feeRwf: RwfAmount, approvedAt: z.string() }).nullable(),
    decline: z.object({ reason: PsfDeclineReason, reasonLabel: z.string(), note: z.string().nullable(), decidedAt: z.string() }).nullable(),
    membership: z
        .object({
        number: z.string(),
        tierName: z.string(),
        tierCode: z.string().nullable().default(null),
        family: PsfMembershipFamily.nullable(),
        feeRwf: RwfAmount.nullable(),
        startsOn: z.string().nullable(),
        expiresOn: z.string().nullable(),
        paidAt: z.string().nullable(),
        reference: z.string().nullable(),
    })
        .nullable(),
    contact: z.object({ name: z.string(), phoneMasked: z.string(), emailMasked: z.string().nullable() }),
    events: z.array(PsfTrackEvent),
    /** Every payment on this application, oldest first. */
    payments: z.array(PsfPaymentLine),
    /** What the one payment at submit comes to while it is still due. */
    dueRwf: z.number().int().nullable(),
    /** Renewing: null until the business is (or was) a member. */
    renewal: PsfRenewalState.nullable().default(null),
    /** Every paid renewal, newest first. */
    renewals: z.array(PsfRenewalLine).default([]),
});
export type PsfTrackView = z.infer<typeof PsfTrackView>;
/** `POST /psf/track/:docId/pay`, and `/pay-registration` for the payment at submit. */
export const PsfTrackPayRequest = z.object({ phoneE164: MomoPhone });
export type PsfTrackPayRequest = z.infer<typeof PsfTrackPayRequest>;
/** `POST /psf/track/:docId/renew`: the band, the amount within it, and the phone to prompt. */
export const PsfRenewRequest = z.object({
    tierCode: z.string().min(1),
    declaredFeeRwf: RwfAmount,
    /** Absent to check the prompt already waiting for this band and amount: it goes to the same phone. */
    phoneE164: MomoPhone.optional(),
});
export type PsfRenewRequest = z.infer<typeof PsfRenewRequest>;
export const PsfTrackPayResult = z.object({
    status: z.enum(["paid", "pending", "declined"]),
    message: z.string().nullable(),
    view: PsfTrackView,
});
export type PsfTrackPayResult = z.infer<typeof PsfTrackPayResult>;
// ---------------------------------------------------------------------------
// The officer's console: scope, report, decision log
// ---------------------------------------------------------------------------
export const PsfScopeDistrict = z.object({ id: z.number().int(), name: z.string(), letters: z.string() });
export type PsfScopeDistrict = z.infer<typeof PsfScopeDistrict>;
/** `GET /oversight/psf/scope`: what the officer covers, and the districts they may narrow to. */
export const PsfOfficerScope = z.object({
    level: OversightScopeLevel,
    /** "Kicukiro district", "Kigali City", "Rwanda". */
    label: z.string(),
    title: z.string(),
    provinces: z.array(z.object({ id: z.number().int(), name: z.string(), districts: z.array(PsfScopeDistrict) })),
});
export type PsfOfficerScope = z.infer<typeof PsfOfficerScope>;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-mm-dd.");
/** Narrow any officer read to one district, or one province, inside the officer's own region. */
export const PsfAreaQuery = z.object({
    district: z.coerce.number().int().positive().optional(),
    province: z.coerce.number().int().positive().optional(),
});
export type PsfAreaQuery = z.infer<typeof PsfAreaQuery>;
export const PsfReportQuery = PsfAreaQuery.extend({ from: isoDate, to: isoDate });
export type PsfReportQuery = z.infer<typeof PsfReportQuery>;
/** One headline number, against the same length of time just before. */
export const PsfKpi = z.object({ value: z.number(), previous: z.number() });
export type PsfKpi = z.infer<typeof PsfKpi>;
export const PsfReportMonth = z.object({
    month: z.string(),
    registered: z.number().int(),
    applied: z.number().int(),
    approved: z.number().int(),
    members: z.number().int(),
    feesRwf: z.number().int(),
});
export type PsfReportMonth = z.infer<typeof PsfReportMonth>;
export const PsfReportSlice = z.object({ key: z.string(), label: z.string(), count: z.number().int(), amountRwf: z.number().int() });
export type PsfReportSlice = z.infer<typeof PsfReportSlice>;
export const PsfDistrictRow = z.object({
    districtId: z.number().int(),
    name: z.string(),
    letters: z.string(),
    provinceName: z.string(),
    registered: z.number().int(),
    waiting: z.number().int(),
    overdue: z.number().int(),
    approved: z.number().int(),
    declined: z.number().int(),
    members: z.number().int(),
    membershipFeesRwf: z.number().int(),
    medianDecisionDays: z.number().nullable(),
    officers: z.array(z.string()),
});
export type PsfDistrictRow = z.infer<typeof PsfDistrictRow>;
/** `GET /oversight/psf/report`: the officer's region over a period. */
export const PsfReport = z.object({
    regionLabel: z.string(),
    from: z.string(),
    to: z.string(),
    kpis: z.object({
        registered: PsfKpi,
        applied: PsfKpi,
        approved: PsfKpi,
        declined: PsfKpi,
        newMembers: PsfKpi,
        /** Memberships renewed in the period, and old card holders brought into the new module (2026-11-02). */
        renewed: PsfKpi.default({ value: 0, previous: 0 }),
        cardHolders: PsfKpi.default({ value: 0, previous: 0 }),
        membershipFeesRwf: PsfKpi,
        medianDecisionDays: z.object({ value: z.number().nullable(), previous: z.number().nullable() }),
    }),
    /** Right now, not over the period. */
    now: z.object({
        members: z.number().int(),
        waiting: z.number().int(),
        overdue: z.number().int(),
        awaitingPayment: z.number().int(),
        expiringIn30Days: z.number().int(),
        /** Renewals further out, and memberships past their end with no renewal (2026-10-30). */
        expiringIn60Days: z.number().int(),
        expiringIn90Days: z.number().int(),
        lapsed: z.number().int(),
        /** Membership numbers typed at registration, waiting for PSF to confirm (0121). */
        claimsWaiting: z.number().int().default(0),
    }),
    /**
     * Injishi registrations in the region (2026-10-30): where each business stands right now, and the
     * decisions taken in the period. A PSF District Manager reviews the first gate in one step (0119).
     */
    registrations: z.object({
        waitingReview: z.number().int(),
        waitingApproval: z.number().int(),
        waitingPayment: z.number().int(),
        active: z.number().int(),
        rejected: z.number().int(),
        suspended: z.number().int(),
        approvedInPeriod: PsfKpi,
        rejectedInPeriod: PsfKpi,
        /** Days from the fee settling to the decision, the median over the period. */
        medianDaysToDecision: z.number().nullable(),
        /** The longest wait in the review queue right now, in whole days. */
        oldestWaitingDays: z.number().int().nullable(),
        /** Month by month: fees paid (registrations entering review) and the decisions on them. */
        months: z
            .array(z.object({ month: z.string(), submitted: z.number().int(), approved: z.number().int(), rejected: z.number().int() }))
            .default([]),
        /** The businesses decided in the period, newest first, each opening its profile. */
        decided: z
            .array(z.object({
                orgId: z.string(),
                legalName: z.string(),
                kindLabel: z.string(),
                decision: z.enum(["approved", "rejected"]),
                decidedAt: z.string(),
                decidedBy: z.string().nullable(),
                status: z.string(),
            }))
            .default([]),
    }),
    /** The district's tourism economy on Injishi's own records, over the period (2026-10-30). */
    economy: z.object({
        /** Active businesses by kind: hotels, guesthouses, apartments, residences, PSF enterprises. */
        activeBusinesses: z.array(z.object({ key: z.string(), label: z.string(), count: z.number().int() })),
        /** Confirmed bookings arriving in the period. */
        bookings: PsfKpi,
        /** Guests × nights of those bookings. */
        guestNights: PsfKpi,
        /** What those bookings are worth, RWF. */
        bookedValueRwf: PsfKpi,
        /** Month by month, by the month guests arrive. */
        months: z
            .array(z.object({ month: z.string(), bookings: z.number().int(), guestNights: z.number().int(), valueRwf: z.number().int() }))
            .default([]),
        /** The businesses that sold the most stays in the period. */
        topBusinesses: z
            .array(z.object({ orgId: z.string(), legalName: z.string(), bookings: z.number().int(), guestNights: z.number().int(), valueRwf: z.number().int() }))
            .default([]),
    }),
    months: z.array(PsfReportMonth),
    funnel: z.object({ registered: z.number().int(), approved: z.number().int(), paid: z.number().int(), declined: z.number().int() }),
    bySector: z.array(PsfReportSlice),
    byFamily: z.array(PsfReportSlice),
    byGroup: z.array(PsfReportSlice),
    districts: z.array(PsfDistrictRow),
});
export type PsfReport = z.infer<typeof PsfReport>;
/** Days an application may wait on PSF before it shows as overdue. */
export const PSF_OVERDUE_DAYS = 7;
export const PsfDecisionsQuery = PsfAreaQuery.extend({
    outcome: z.enum(["approved", "declined"]).optional(),
    q: z.string().trim().min(1).max(80).optional(),
    cluster: z.string().trim().min(1).max(60).optional(),
    cursor: z.string().max(200).optional(),
});
export type PsfDecisionsQuery = z.infer<typeof PsfDecisionsQuery>;
export const PsfDecisionItem = z.object({
    applicationId: Uuid,
    docId: z.string().nullable(),
    businessName: z.string(),
    businessCode: z.string().nullable(),
    districtName: z.string().nullable(),
    tierName: z.string(),
    outcome: z.enum(["approved", "declined"]),
    /** Where the application is now: approved may since have been paid. */
    paid: z.boolean(),
    membershipNumber: z.string().nullable(),
    feeRwf: RwfAmount.nullable(),
    declineReasonLabel: z.string().nullable(),
    decidedAt: z.string(),
    decidedByName: z.string().nullable(),
    daysToDecide: z.number().nullable(),
    clusterName: z.string().nullable().default(null),
    subsectorName: z.string().nullable().default(null),
});
export type PsfDecisionItem = z.infer<typeof PsfDecisionItem>;
export const PsfDecisionsPage = z.object({ items: z.array(PsfDecisionItem), nextCursor: z.string().nullable() });
export type PsfDecisionsPage = z.infer<typeof PsfDecisionsPage>;
/** The queue, narrowed by place and filtered, as the console asks for it. */
export const PsfQueueAreaQuery = PsfAreaQuery.extend({
    cursor: z.string().max(200).optional(),
    q: z.string().trim().min(1).max(80).optional(),
    cluster: z.string().trim().min(1).max(60).optional(),
    family: PsfMembershipFamily.optional(),
    group: PsfOwnerGroup.optional(),
    /** `newest` first by default: what just arrived is what an officer looks for. */
    sort: z.enum(["newest", "oldest", "amount"]).default("newest"),
});
export type PsfQueueAreaQuery = z.infer<typeof PsfQueueAreaQuery>;
/** A Kigali yyyy-mm-dd for a moment, which every PSF date reads in. */
export function kigaliDay(at: Date): string {
    return new Date(at.getTime() + 2 * 3600 * 1000).toISOString().slice(0, 10);
}
/** Whole days between two moments, floor, never negative. */
export function wholeDaysBetween(from: Date, to: Date): number {
    return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000));
}
/** The median of a list, or null for an empty one. */
export function median(values: readonly number[]): number | null {
    if (values.length === 0)
        return null;
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
/** The membership number PSF's officers give: `PSF/KIC/2026/0009`. */
export function formatPsfMembershipNumber(letters: string, year: number, n: number): string {
    return `PSF/${letters}/${year}/${String(n).padStart(4, "0")}`;
}
/**
 * A province as people say it. The geography table stores the names in capitals
 * (`KIGALI`, `EAST`); every PSF screen reads them through this.
 */
export function provinceDisplayName(name: string | null | undefined): string {
    if (!name)
        return "";
    const key = name.trim().toUpperCase();
    const known: Record<string, string> = {
        KIGALI: "Kigali City",
        EAST: "Eastern Province",
        WEST: "Western Province",
        NORTH: "Northern Province",
        SOUTH: "Southern Province",
    };
    return known[key] ?? key.charAt(0) + key.slice(1).toLowerCase();
}
/** "+250781464545" as "+250 78• ••• 545": enough to recognise, not to call. */
export function maskPhone(e164: string): string {
    const d = e164.replace(/\s/g, "");
    if (d.length < 8)
        return "•".repeat(d.length);
    return `${d.slice(0, 4)} ${d.slice(4, 6)}• ••• ${d.slice(-3)}`;
}
/** "diane@example.rw" as "d••••@example.rw". */
export function maskEmail(email: string): string {
    const [user, domain] = email.split("@");
    if (!user || !domain)
        return "•••";
    return `${user[0]}${"•".repeat(Math.max(2, Math.min(5, user.length - 1)))}@${domain}`;
}

/** The business behind an application, as the officer's detail panel reads it. */
export const PsfBusinessHistory = z.object({
    registeredAt: z.string().nullable(),
    payments: z.array(PsfPaymentLine.extend({ applicationDocId: z.string().nullable() })),
    applications: z.array(z.object({
        id: Uuid,
        docId: z.string().nullable(),
        tierName: z.string(),
        status: z.string(),
        submittedAt: z.string(),
        decidedAt: z.string().nullable(),
        declineReasonLabel: z.string().nullable(),
        membershipNumber: z.string().nullable(),
    })),
    memberships: z.array(z.object({
        number: z.string(),
        tierName: z.string().nullable(),
        startsOn: z.string().nullable(),
        expiresOn: z.string().nullable(),
        current: z.boolean(),
    })),
});
export type PsfBusinessHistory = z.infer<typeof PsfBusinessHistory>;
/**
 * `GET /oversight/psf/businesses/:orgId`: one business on its own page, for the
 * officer covering it: what it is, how to reach it, and its whole history.
 */
export const PsfBusinessDetail = z.object({
    business: PsfBusinessRow,
    /** The person on its newest application, as filed. */
    contact: z
        .object({ name: z.string(), role: z.string(), phoneE164: z.string(), email: z.string().nullable() })
        .nullable(),
    history: PsfBusinessHistory,
    /** Every branch it listed, in any district (2026-10-23), with where each stands. */
    branches: z.array(PsfBusinessBranch).default([]),
    /** Every paid renewal, newest first (2026-11-02). */
    renewals: z.array(PsfRenewalLine).default([]),
});
export type PsfBusinessDetail = z.infer<typeof PsfBusinessDetail>;
/**
 * `GET /oversight/psf/registrations/:orgId` (2026-10-30): a business's side on Injishi, for the PSF
 * District Manager covering it, whatever its standing: what it is, who decided its registration and
 * when, and whether guests can find it yet. A business PSF's register does not hold (rejected, a
 * residence) still opens here.
 */
export const PsfRegistrationProfile = z.object({
    orgId: z.string(),
    legalName: z.string(),
    businessCode: z.string().nullable(),
    kindLabel: z.string(),
    domain: z.string(),
    districtName: z.string().nullable(),
    sectorName: z.string().nullable(),
    addressText: z.string().nullable(),
    tin: z.string().nullable(),
    starGrade: z.number().int().nullable(),
    starGradeConfirmed: z.boolean(),
    status: z.string(),
    owner: z.object({ name: z.string().nullable(), email: z.string(), phone: z.string().nullable() }).nullable(),
    registeredAt: z.string(),
    reviews: z.array(z.object({
        stage: z.string(),
        decision: z.enum(["passed", "rejected"]),
        roleLabel: z.string(),
        byName: z.string().nullable(),
        at: z.string(),
        notes: z.string().nullable(),
        reasonLabel: z.string().nullable(),
    })),
    listings: z.array(z.object({
        propertyName: z.string(),
        status: z.string(),
        publishedAt: z.string().nullable(),
        slug: z.string().nullable(),
        roomTypes: z.number().int(),
        rooms: z.number().int(),
    })),
    /** Confirmed bookings arriving in the last 90 days. */
    bookings90Days: z.number().int(),
});
export type PsfRegistrationProfile = z.infer<typeof PsfRegistrationProfile>;

// ---------------------------------------------------------------------------
// What a band costs, by place (2026-10-20)
// ---------------------------------------------------------------------------
/**
 * Where a band's price came from: the district's own, PSF's national price,
 * or (neither set) the band's starting price from the tier catalogue.
 */
export const PsfFeeSource = z.enum(["district", "national", "band"]);
export type PsfFeeSource = z.infer<typeof PsfFeeSource>;
/** One band's price for a district, as the public form shows it. */
export const PsfTierFee = z.object({
    tierCode: z.string(),
    /**
     * Null: no price anywhere (a tier PSF prices itself, never priced), so it is not offered.
     * Otherwise the LEAST a business in this band pays a year.
     */
    amountRwf: RwfAmount.nullable(),
    source: PsfFeeSource,
    /**
     * The MOST a business in this band may pay (2026-10-23): the top of the
     * band's range in PSF's catalogue (49,999 for the 20,000 band), or, for a
     * band with no range, one franc under the next band's price. Null for the
     * top band, which has no ceiling.
     */
    ceilingRwf: RwfAmount.nullable().default(null),
});
export type PsfTierFee = z.infer<typeof PsfTierFee>;
/** `GET /psf/fees?district=`: every active band's price in one district. */
export const PsfFeesQuery = z.object({ district: z.coerce.number().int().positive() });
export type PsfFeesQuery = z.infer<typeof PsfFeesQuery>;
export const PsfFeesView = z.object({ districtId: z.number().int(), fees: z.array(PsfTierFee) });
export type PsfFeesView = z.infer<typeof PsfFeesView>;
/**
 * The ceiling of each priced band in one district (2026-10-23). PSF's
 * catalogue range wins: a band with one (`bandMaxRwf`, Indatwa's 20,000 to
 * 49,999) tops out where it says, whatever the district charges for the next
 * band. A band without one runs to one franc under the next dearer band's
 * price, across memberships, since PSF's bands run on from one another
 * (Indatwa, then Indashyikirwa, then the Golden Circle); the dearest has
 * none. Never under the band's own price. The ONE place the rule lives: the
 * form shows it and the API refuses outside it.
 */
export function psfFeeCeilings(
    fees: ReadonlyArray<{ tierCode: string; amountRwf: number | null; bandMaxRwf?: number | null }>,
): Map<string, number | null> {
    const priced = fees.filter((f): f is { tierCode: string; amountRwf: number; bandMaxRwf?: number | null } => f.amountRwf !== null);
    const out = new Map<string, number | null>();
    for (const f of priced) {
        if (f.bandMaxRwf != null) {
            out.set(f.tierCode, Math.max(f.bandMaxRwf, f.amountRwf));
            continue;
        }
        const next = priced.reduce<number | null>((best, o) => (o.amountRwf > f.amountRwf && (best === null || o.amountRwf < best) ? o.amountRwf : best), null);
        out.set(f.tierCode, next === null ? null : next - 1);
    }
    return out;
}
/** One band in the officer's Fees screen: the national price, the district's, and what applies. */
export const PsfOfficerFeeRow = z.object({
    tierCode: z.string(),
    tierName: z.string(),
    family: PsfMembershipFamily,
    priceKind: PsfPriceKind,
    /** The band's bounds from the catalogue; a price must sit inside them. */
    bandMinRwf: RwfAmount.nullable(),
    bandMaxRwf: RwfAmount.nullable(),
    /** The band's own starting price, used when nobody set one. */
    bandFeeRwf: RwfAmount.nullable(),
    nationalRwf: RwfAmount.nullable(),
    districtRwf: RwfAmount.nullable(),
    effectiveRwf: RwfAmount.nullable(),
    source: PsfFeeSource,
    updatedAt: z.string().nullable(),
    updatedByName: z.string().nullable(),
});
export type PsfOfficerFeeRow = z.infer<typeof PsfOfficerFeeRow>;
export const PsfOfficerFeesView = z.object({
    /** The district being priced, or null for the national prices. */
    districtId: z.number().int().nullable(),
    districtName: z.string().nullable(),
    canEditNational: z.boolean(),
    /** True when a district is shown and the officer covers it. */
    canEditDistrict: z.boolean(),
    rows: z.array(PsfOfficerFeeRow),
});
export type PsfOfficerFeesView = z.infer<typeof PsfOfficerFeesView>;
/** Set a band's price for a place (`districtId` null: national), or clear it with `amountRwf: null`. */
export const SetPsfTierFeeRequest = z.object({
    tierCode: z.string().trim().min(1).max(60),
    districtId: z.number().int().positive().nullable(),
    amountRwf: RwfAmount.refine((n) => n > 0, "Give a price above zero.").nullable(),
});
export type SetPsfTierFeeRequest = z.infer<typeof SetPsfTierFeeRequest>;
/** The price that applies: the district's, else the national, else the band's starting price. */
export function resolvePsfTierFee(districtRwf: number | null, nationalRwf: number | null, bandRwf: number | null): { amountRwf: number | null; source: PsfFeeSource } {
    if (districtRwf !== null)
        return { amountRwf: districtRwf, source: "district" };
    if (nationalRwf !== null)
        return { amountRwf: nationalRwf, source: "national" };
    return { amountRwf: bandRwf, source: "band" };
}

// ---------------------------------------------------------------------------
// The member's card (2026-11-02): what the certificate's QR code opens
// ---------------------------------------------------------------------------
/**
 * One membership, by its number, for anyone who scans a certificate: only
 * what the certificate already prints, and whether it is still valid today.
 */
export const PsfMemberCard = z.object({
    status: z.enum(["valid", "lapsed", "not_found"]),
    card: z
        .object({
            businessName: z.string(),
            businessCode: z.string().nullable(),
            districtName: z.string().nullable(),
            levelName: z.string(),
            tierName: z.string(),
            membershipNumber: z.string(),
            startsOn: z.string().nullable(),
            expiresOn: z.string().nullable(),
        })
        .nullable(),
});
export type PsfMemberCard = z.infer<typeof PsfMemberCard>;
export const PsfMemberCardQuery = z.object({ number: z.string().trim().min(3).max(60) });
export type PsfMemberCardQuery = z.infer<typeof PsfMemberCardQuery>;
