"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PsfReport = exports.PsfDistrictRow = exports.PsfReportSlice = exports.PsfReportMonth = exports.PsfKpi = exports.PsfReportQuery = exports.PsfAreaQuery = exports.PsfOfficerScope = exports.PsfScopeDistrict = exports.PsfTrackPayResult = exports.PsfRenewRequest = exports.PsfTrackPayRequest = exports.PsfTrackView = exports.PsfRenewalLine = exports.PsfRenewalState = exports.PSF_RENEWAL_WINDOW_DAYS = exports.EndPsfTeamQuery = exports.AppointPsfTeamRequest = exports.PsfTeamView = exports.PsfTeamMember = exports.PSF_TEAM_ROLE_DESCRIPTION = exports.PSF_TEAM_ROLE_LABEL = exports.PsfTeamRole = exports.PsfPaymentLine = exports.PsfTrackEvent = exports.PsfTrackEventKind = exports.PSF_TRACK_STAGE_LABEL = exports.PsfTrackStage = exports.PsfPublicSubmitResult = exports.PSF_CHECK_TOKEN_HEADER = exports.PsfLogoUploadResult = exports.PsfPublicSubmitRequest = exports.PsfPublicMembership = exports.PsfPublicContact = exports.PsfPublicBusiness = exports.PsfPublicBranch = exports.MAX_PSF_BRANCHES = exports.PsfPublicAddress = exports.MomoPhone = exports.PsfVerifiedApplicant = exports.PsfIdentityConfirmRequest = exports.PsfMemberLookupConfirmed = exports.PsfMemberLookupConfirm = exports.PsfMemberLookupResult = exports.PsfMemberLookupRequest = exports.PsfIdentityLookupResult = exports.PsfIdentityLookupRequest = exports.PsfDocId = exports.PSF_DOC_ID_PATTERN = exports.PSF_DOC_ID_ALPHABET = void 0;
exports.SetPsfTierFeeRequest = exports.PsfOfficerFeesView = exports.PsfOfficerFeeRow = exports.PsfFeesView = exports.PsfFeesQuery = exports.PsfTierFee = exports.PsfFeeSource = exports.PsfRegistrationProfile = exports.PsfBusinessDetail = exports.PsfBusinessHistory = exports.PsfQueueAreaQuery = exports.PsfDecisionsPage = exports.PsfDecisionItem = exports.PsfDecisionsQuery = exports.PSF_OVERDUE_DAYS = void 0;
exports.newPsfDocId = newPsfDocId;
exports.normalizePsfDocId = normalizePsfDocId;
exports.isPsfDocId = isPsfDocId;
exports.isOtherAssociation = isOtherAssociation;
exports.psfPlaceKey = psfPlaceKey;
exports.kigaliDay = kigaliDay;
exports.wholeDaysBetween = wholeDaysBetween;
exports.median = median;
exports.formatPsfMembershipNumber = formatPsfMembershipNumber;
exports.provinceDisplayName = provinceDisplayName;
exports.maskPhone = maskPhone;
exports.maskEmail = maskEmail;
exports.psfFeeCeilings = psfFeeCeilings;
exports.resolvePsfTierFee = resolvePsfTierFee;
const zod_1 = require("zod");
const primitives_1 = require("./primitives");
const psf_1 = require("./psf");
const registration_1 = require("./registration");
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
exports.PSF_DOC_ID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/** `PSF-` and two groups of four: 40 random bits. */
exports.PSF_DOC_ID_PATTERN = /^PSF-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
/**
 * A new docID from eight random bytes' worth of entropy. The caller passes its
 * own random source (`crypto.randomBytes` on the server), so contracts stays
 * free of Node.
 */
function newPsfDocId(randomBytes) {
    const bytes = randomBytes(8);
    let out = "";
    for (let i = 0; i < 8; i += 1)
        out += exports.PSF_DOC_ID_ALPHABET[bytes[i] & 31];
    return `PSF-${out.slice(0, 4)}-${out.slice(4)}`;
}
/**
 * A docID as somebody typed it, made canonical: upper case, the dashes put
 * back, and the letters Crockford folds (O to 0, I and L to 1) folded. Returns
 * null when what is left cannot be a docID.
 */
function normalizePsfDocId(input) {
    let s = input.toUpperCase().replace(/[\s_-]/g, "");
    if (s.startsWith("PSF"))
        s = s.slice(3);
    s = s.replace(/O/g, "0").replace(/[IL]/g, "1");
    if (s.length !== 8)
        return null;
    const id = `PSF-${s.slice(0, 4)}-${s.slice(4)}`;
    return exports.PSF_DOC_ID_PATTERN.test(id) ? id : null;
}
function isPsfDocId(value) {
    return exports.PSF_DOC_ID_PATTERN.test(value);
}
exports.PsfDocId = zod_1.z
    .string()
    .trim()
    .transform((v, ctx) => {
    const id = normalizePsfDocId(v);
    if (!id) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "A docID looks like PSF-7K3M-Q9XD." });
        return zod_1.z.NEVER;
    }
    return id;
});
// ---------------------------------------------------------------------------
// Step 1: who is applying (a National ID, bound by a code to its phone)
// ---------------------------------------------------------------------------
/** `POST /psf/identity/lookup` */
exports.PsfIdentityLookupRequest = zod_1.z.object({
    documentNumber: registration_1.RwandanNationalId,
    consent: zod_1.z.literal(true, {
        errorMap: () => ({ message: "Tick the box so we can check the number." }),
    }),
});
exports.PsfIdentityLookupResult = zod_1.z.discriminatedUnion("status", [
    zod_1.z.object({
        status: zod_1.z.literal("code_sent"),
        checkId: primitives_1.Uuid,
        /** Where the code went, masked: `+250 78• ••• 545`. */
        sentTo: zod_1.z.string(),
        expiresInSeconds: zod_1.z.number().int(),
        /**
         * The code, when no text really goes: the demo's fixed code, or the one just made while SMS is the
         * mock (a sample database). Null wherever a real text is sent.
         */
        demoCode: zod_1.z.string().nullable(),
    }),
    zod_1.z.object({ status: zod_1.z.enum(["not_found", "no_phone", "unavailable"]), message: zod_1.z.string() }),
]);
/**
 * Tracking by membership number (2026-11-02). The number is printed on the certificate, so it alone
 * opens nothing: a code goes by text to the phone on file, and only the code read back answers the
 * docID, which opens the tracking page as before. The docID alone keeps working.
 */
exports.PsfMemberLookupRequest = zod_1.z.object({
    membershipNumber: zod_1.z.string().trim().min(4, "Type the membership number as it is on the certificate.").max(40),
});
exports.PsfMemberLookupResult = zod_1.z.discriminatedUnion("status", [
    zod_1.z.object({
        status: zod_1.z.literal("code_sent"),
        /** Carries the docID, the code's fingerprint and its expiry, signed: nothing is kept on the server. */
        lookupToken: zod_1.z.string(),
        sentTo: zod_1.z.string(),
        expiresInSeconds: zod_1.z.number().int(),
        /** The code, when no text really goes (a test setup). Null wherever a real text is sent. */
        demoCode: zod_1.z.string().nullable(),
    }),
    zod_1.z.object({ status: zod_1.z.enum(["not_found", "no_phone", "unavailable"]), message: zod_1.z.string() }),
]);
exports.PsfMemberLookupConfirm = zod_1.z.object({
    lookupToken: zod_1.z.string().min(10).max(2000),
    code: zod_1.z.string().trim().regex(/^\d{6}$/, "Type the 6 digits from the text."),
});
exports.PsfMemberLookupConfirmed = zod_1.z.object({ docId: zod_1.z.string() });
/** `POST /psf/identity/confirm` */
exports.PsfIdentityConfirmRequest = zod_1.z.object({
    checkId: primitives_1.Uuid,
    code: zod_1.z.string().trim().regex(/^\d{6}$/, "The code is 6 digits."),
});
/**
 * The person the register holds, revealed to whoever read the code. The token
 * proves the check on submit; it lives 30 minutes and is spent by one submit.
 */
exports.PsfVerifiedApplicant = zod_1.z.object({
    checkToken: zod_1.z.string(),
    fullName: zod_1.z.string(),
    firstName: zod_1.z.string(),
    lastName: zod_1.z.string(),
    dateOfBirth: zod_1.z.string(),
    gender: zod_1.z.enum(["male", "female"]).nullable(),
    documentNumberMasked: zod_1.z.string(),
    /** The register's phone, masked. The contact phone starts from it. */
    phoneMasked: zod_1.z.string().nullable(),
    /** The register's phone in full, to prefill the contact and MoMo fields. */
    phoneE164: zod_1.z.string().nullable(),
    generated: zod_1.z.boolean(),
    expiresAt: zod_1.z.string(),
});
// ---------------------------------------------------------------------------
// The one form
// ---------------------------------------------------------------------------
const text = (max, required) => zod_1.z.string().trim().min(1, required).max(max, "That is too long for PSF's form.");
const phone = zod_1.z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .pipe(zod_1.z.string().regex(/^\+\d{7,15}$/, "Include the country code, like +250788123456."));
exports.MomoPhone = zod_1.z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .pipe(zod_1.z.string().regex(/^\+2507\d{8}$/, "Give a Rwandan mobile money number, like +250788123456."));
/** Where the business is. The street line is optional (2026-11-02): the village places it, and not every plot has one. */
exports.PsfPublicAddress = zod_1.z.object({
    provinceId: zod_1.z.number().int().positive("Choose a province."),
    districtId: zod_1.z.number().int().positive("Choose a district."),
    sectorId: zod_1.z.number().int().positive("Choose a sector."),
    cellId: zod_1.z.number().int().positive().optional(),
    villageId: zod_1.z.number().int().positive().optional(),
    street: zod_1.z.string().trim().max(200, "Keep the street address under 200 characters.").default(""),
});
/**
 * Each cluster's catch-all association (`industry_other`, `trade_other`, …):
 * where a business whose association is not on PSF's list is filed, beside the
 * name it types.
 */
function isOtherAssociation(code) {
    return code.endsWith("_other");
}
/** How many branches one form may list, as many as the hotel form allows. */
exports.MAX_PSF_BRANCHES = 20;
/**
 * Another place the business trades from (2026-10-23), under the business's
 * own name. Each goes to the PSF officer of its own district to admit, so it
 * carries the same address as the head office: province, district, sector
 * and a street line.
 */
exports.PsfPublicBranch = zod_1.z.object({
    address: exports.PsfPublicAddress,
});
/** Two places are the same place when the sector matches and the street differs only in case and spacing. */
function psfPlaceKey(address) {
    return `${address.sectorId}:${address.street.trim().replace(/\s+/g, " ").toLowerCase()}`;
}
exports.PsfPublicBusiness = zod_1.z
    .object({
    legalName: zod_1.z.string().trim().min(2, "Give the name of the business.").max(200, "That name is too long."),
    registrationKind: registration_1.EnterpriseRegistrationKind,
    tin: registration_1.Tin.optional(),
    registrationNumber: zod_1.z.string().trim().min(1, "Give the registration number.").max(60).optional(),
    /** The sector's subtype the business picked, or `subsectorOther` when none fits. */
    subsectorId: primitives_1.Uuid.optional(),
    subsectorOther: zod_1.z.string().trim().min(2, "Name the kind of business.").max(80).optional(),
    associationCode: zod_1.z.string().trim().min(1, "Pick the association your business belongs to.").max(60),
    /**
     * The association the business names itself when PSF's list does not have
     * it. Goes with the cluster's own "other" row (`isOtherAssociation`).
     */
    associationOther: zod_1.z.string().trim().min(2, "Name your association, or what the business does.").max(120).optional(),
    ownerGroups: zod_1.z.array(registration_1.PsfOwnerGroup).max(3).default([]),
    address: exports.PsfPublicAddress,
    companyType: registration_1.PsfCompanyType,
    ownership: registration_1.PsfOwnership,
    ownershipOther: zod_1.z.string().trim().min(1).max(120).optional(),
    businessActivity: text(300, "Say in a few words what the business does."),
    website: zod_1.z.string().trim().max(200).url("Give the full address, like https://example.rw.").optional(),
    /**
     * The business's logo (2026-10-23), optional: the key `POST /psf/logo`
     * returned. It is printed on the membership certificate.
     */
    logoObjectKey: zod_1.z.string().trim().min(1).max(200).optional(),
    tradeDirection: registration_1.PsfTradeDirection,
    tradeGoods: zod_1.z.string().trim().min(1).max(300).optional(),
    tradeCountries: zod_1.z.array(registration_1.CountryCode).max(50).default([]),
    branches: zod_1.z.array(exports.PsfPublicBranch).max(exports.MAX_PSF_BRANCHES, `List at most ${exports.MAX_PSF_BRANCHES} branches.`).default([]),
})
    .superRefine((v, ctx) => {
    if (v.registrationKind === "tin" && !v.tin)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["tin"], message: "Enter the 9-digit TIN." });
    if (v.registrationKind !== "tin" && v.tin)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["tin"], message: "Only give a TIN when you pick TIN." });
    const numbered = registration_1.NUMBERED_REGISTRATION_KINDS.includes(v.registrationKind);
    if (numbered && !v.registrationNumber)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["registrationNumber"], message: "Give the registration number." });
    if (!numbered && v.registrationNumber)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["registrationNumber"], message: "Leave this empty for this kind of registration." });
    if (new Set(v.ownerGroups).size !== v.ownerGroups.length)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["ownerGroups"], message: "Pick each group once." });
    if (!v.subsectorId && !v.subsectorOther)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["subsectorId"], message: "Pick the kind of business, or type it." });
    if (v.subsectorId && v.subsectorOther)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["subsectorOther"], message: "Pick one from the list or type one, not both." });
    if (isOtherAssociation(v.associationCode) && !v.associationOther)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["associationOther"], message: "Name your association, or what the business does." });
    if (!isOtherAssociation(v.associationCode) && v.associationOther)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["associationOther"], message: "Only name one when it is not on PSF's list." });
    if (v.ownership === "other" && !v.ownershipOther)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["ownershipOther"], message: "Say what the ownership is." });
    if (v.tradeDirection !== "none" && !v.tradeGoods)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["tradeGoods"], message: "Say what you trade." });
    if (v.tradeDirection !== "none" && v.tradeCountries.length === 0)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["tradeCountries"], message: "Pick at least one country you trade with." });
    const seen = new Set([psfPlaceKey(v.address)]);
    v.branches.forEach((b, i) => {
        const key = psfPlaceKey(b.address);
        if (seen.has(key))
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["branches", i, "address", "street"], message: "This place is already listed. Each branch is somewhere else." });
        seen.add(key);
    });
});
exports.PsfPublicContact = zod_1.z.object({
    role: registration_1.PsfContactRole,
    /** PSF's form knows two genders; the register may hold none. */
    gender: registration_1.PsfGender,
    phoneE164: phone,
    /** Optional: status reaches the phone by SMS either way. */
    email: zod_1.z.string().trim().email("That email address does not look right.").optional(),
});
exports.PsfPublicMembership = zod_1.z.object({
    tierCode: zod_1.z.string().trim().min(1, "Pick a membership.").max(60),
    /**
     * The yearly amount the business will pay (2026-10-23): at least PSF's
     * price for the band in its district, and no more than the band's ceiling
     * (`psfFeeCeilings`). The API refuses an amount outside the band, so
     * nobody is charged a figure the band does not allow.
     */
    declaredFeeRwf: primitives_1.RwfAmount.refine((n) => n > 0, "Give the amount you will pay.").optional(),
});
/** `POST /psf/applications`: the whole form, and the number the membership fee is charged to. */
exports.PsfPublicSubmitRequest = zod_1.z.object({
    checkToken: zod_1.z.string().min(16).max(200),
    business: exports.PsfPublicBusiness,
    membership: exports.PsfPublicMembership,
    contact: exports.PsfPublicContact,
    payerPhoneE164: exports.MomoPhone,
    consent: zod_1.z.literal(true, {
        errorMap: () => ({ message: "Tick the box to agree to share this with PSF." }),
    }),
});
/**
 * `POST /psf/logo` (2026-10-23): a logo uploaded from the form, under the
 * form's verified ID check (`x-psf-check-token`), never a session. What comes
 * back is the key the form sends as `business.logoObjectKey`.
 */
exports.PsfLogoUploadResult = zod_1.z.object({ objectKey: zod_1.z.string(), sizeBytes: zod_1.z.number().int() });
/** The header the logo upload carries the form's ID check token in. */
exports.PSF_CHECK_TOKEN_HEADER = "x-psf-check-token";
exports.PsfPublicSubmitResult = zod_1.z.object({
    docId: zod_1.z.string(),
    businessCode: zod_1.z.string().nullable(),
    /** What the one payment at submit came to: the membership fee, nothing else (2026-10-23). */
    totalRwf: zod_1.z.number().int(),
    /** False when the fee charge did not settle; the tracking page offers it again. */
    feePaid: zod_1.z.boolean(),
    feeProblem: zod_1.z.string().nullable(),
});
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
exports.PsfTrackStage = zod_1.z.enum(["fee_due", "under_review", "approved", "member", "lapsed", "declined", "withdrawn"]);
exports.PSF_TRACK_STAGE_LABEL = {
    fee_due: "Payment due",
    under_review: "Under review",
    approved: "Approved, pay to join",
    member: "PSF member",
    lapsed: "Membership ended",
    declined: "Declined",
    withdrawn: "Withdrawn",
};
exports.PsfTrackEventKind = zod_1.z.enum(["submitted", "fee_paid", "code_issued", "in_review", "approved", "declined", "paid", "expired", "renewed", "withdrawn"]);
exports.PsfTrackEvent = zod_1.z.object({
    kind: exports.PsfTrackEventKind,
    at: zod_1.z.string(),
    title: zod_1.z.string(),
    detail: zod_1.z.string().nullable(),
});
/** `GET /psf/track/:docId`. Nothing here helps anyone pretend to be the applicant. */
/**
 * One payment on an application, for the tracking page and the officer. A
 * `registration_fee` is a hotel's account fee, or one a PSF business paid
 * before the fee was dropped (2026-10-23); nothing is refunded.
 */
exports.PsfPaymentLine = zod_1.z.object({
    kind: zod_1.z.enum(["registration_fee", "membership_fee", "membership_renewal"]),
    amountRwf: zod_1.z.number().int(),
    at: zod_1.z.string().nullable(),
    status: zod_1.z.enum(["paid"]),
    reference: zod_1.z.string().nullable(),
});
// ---------------------------------------------------------------------------
// The PSF team (2026-11-02): a Province Manager appoints its districts' people
// ---------------------------------------------------------------------------
/** The two posts a Province Manager fills in its districts. */
exports.PsfTeamRole = zod_1.z.enum(["district_manager", "business_officer"]);
exports.PSF_TEAM_ROLE_LABEL = {
    district_manager: "District Manager",
    business_officer: "District Business Officer (DBO)",
};
exports.PSF_TEAM_ROLE_DESCRIPTION = {
    district_manager: "Decides membership applications and claims, and sets the district's fees and subtypes.",
    business_officer: "Reads the district's applications, businesses, decisions and reports. Decides nothing.",
};
exports.PsfTeamMember = zod_1.z.object({
    assignmentId: primitives_1.Uuid,
    name: zod_1.z.string().nullable(),
    email: zod_1.z.string(),
    role: exports.PsfTeamRole,
    title: zod_1.z.string().nullable(),
    districtId: zod_1.z.number().int(),
    districtName: zod_1.z.string().nullable(),
    appointedAt: zod_1.z.string(),
    appointedByName: zod_1.z.string().nullable(),
});
/** `GET /oversight/psf/team`: the people in the caller's districts, and where the caller may appoint. */
exports.PsfTeamView = zod_1.z.object({
    /** A Province or National Manager: may appoint and end. A District Manager or DBO reads. */
    canAppoint: zod_1.z.boolean(),
    /** The districts the caller may appoint in, by province. */
    districts: zod_1.z.array(zod_1.z.object({ id: zod_1.z.number().int(), name: zod_1.z.string(), provinceName: zod_1.z.string().nullable() })),
    members: zod_1.z.array(exports.PsfTeamMember),
});
exports.AppointPsfTeamRequest = zod_1.z.object({
    email: zod_1.z.string().trim().toLowerCase().email("Enter their email address."),
    name: zod_1.z.string().trim().min(2, "Enter their full name.").max(120, "That name is too long."),
    role: exports.PsfTeamRole,
    districtId: zod_1.z.number().int().positive({ message: "Pick a district." }),
    reason: zod_1.z.string().trim().min(3, "Say why, in a few words.").max(500, "That reason is too long."),
});
exports.EndPsfTeamQuery = zod_1.z.object({
    reason: zod_1.z.string().trim().min(3, "Say why, in a few words.").max(500, "That reason is too long."),
});
/** How many days before the end date a membership may be renewed (2026-11-02). */
exports.PSF_RENEWAL_WINDOW_DAYS = 60;
/**
 * Renewing a membership (2026-11-02): a paid renewal renews at once, the year
 * runs on from the old end date (or from the payment, once lapsed), and the
 * band may change at the district's current price.
 */
exports.PsfRenewalState = zod_1.z.object({
    /** Whether a renewal can be paid today. */
    open: zod_1.z.boolean(),
    /** The first day it can be: 60 days before the end date. */
    opensOn: zod_1.z.string(),
    /** Why it cannot be yet, in a sentence; null when open. */
    reason: zod_1.z.string().nullable(),
    /** The year a renewal paid today buys. */
    startsOn: zod_1.z.string(),
    expiresOn: zod_1.z.string(),
    /** The band held now, pre-picked. */
    tierCode: zod_1.z.string().nullable(),
    /** A prompt sent and not yet approved. */
    /** A prompt sent and not yet approved: its band, amount, and the phone it went to, masked (2026-11-02). */
    pending: zod_1.z
        .object({ tierCode: zod_1.z.string().default(""), tierName: zod_1.z.string(), amountRwf: primitives_1.RwfAmount, phoneMasked: zod_1.z.string().nullable().default(null) })
        .nullable(),
});
/** One paid renewal, for the tracking page and the officer. */
exports.PsfRenewalLine = zod_1.z.object({
    paidAt: zod_1.z.string(),
    membershipNumber: zod_1.z.string(),
    tierName: zod_1.z.string(),
    amountRwf: primitives_1.RwfAmount,
    startsOn: zod_1.z.string(),
    expiresOn: zod_1.z.string(),
    reference: zod_1.z.string().nullable(),
});
exports.PsfTrackView = zod_1.z.object({
    docId: zod_1.z.string(),
    stage: exports.PsfTrackStage,
    submittedAt: zod_1.z.string(),
    /** Whole days the application has waited on PSF; null when not under review. */
    waitingDays: zod_1.z.number().int().nullable(),
    business: zod_1.z.object({
        name: zod_1.z.string(),
        code: zod_1.z.string().nullable(),
        districtName: zod_1.z.string().nullable(),
        provinceName: zod_1.z.string().nullable(),
        sectorName: zod_1.z.string().nullable(),
        clusterName: zod_1.z.string().nullable(),
        subsectorName: zod_1.z.string().nullable(),
        associationName: zod_1.z.string().nullable(),
        ownerGroups: zod_1.z.array(registration_1.PsfOwnerGroup),
        registrationKind: registration_1.EnterpriseRegistrationKind.nullable(),
        /** The business's district, for the renewal's band prices. */
        districtId: zod_1.z.number().int().nullable().default(null),
        /** The business's logo, as an address under the API (`/v1/psf/track/:docId/logo`); null without one. */
        logoUrl: zod_1.z.string().nullable().default(null),
        /** Each branch and where its own district's PSF office stands on it. */
        branches: zod_1.z
            .array(zod_1.z.object({ districtName: zod_1.z.string().nullable(), sectorName: zod_1.z.string().nullable(), status: psf_1.PsfBranchStatus, note: zod_1.z.string().nullable() }))
            .default([]),
    }),
    request: zod_1.z.object({
        family: psf_1.PsfMembershipFamily,
        familyName: zod_1.z.string(),
        tierName: zod_1.z.string(),
        declaredFeeRwf: primitives_1.RwfAmount.nullable(),
    }),
    /** Who reviews it: "PSF Kicukiro district office". */
    reviewingOffice: zod_1.z.string(),
    approval: zod_1.z.object({ membershipNumber: zod_1.z.string(), feeRwf: primitives_1.RwfAmount, approvedAt: zod_1.z.string() }).nullable(),
    decline: zod_1.z.object({ reason: psf_1.PsfDeclineReason, reasonLabel: zod_1.z.string(), note: zod_1.z.string().nullable(), decidedAt: zod_1.z.string() }).nullable(),
    membership: zod_1.z
        .object({
        number: zod_1.z.string(),
        tierName: zod_1.z.string(),
        tierCode: zod_1.z.string().nullable().default(null),
        family: psf_1.PsfMembershipFamily.nullable(),
        feeRwf: primitives_1.RwfAmount.nullable(),
        startsOn: zod_1.z.string().nullable(),
        expiresOn: zod_1.z.string().nullable(),
        paidAt: zod_1.z.string().nullable(),
        reference: zod_1.z.string().nullable(),
    })
        .nullable(),
    contact: zod_1.z.object({ name: zod_1.z.string(), phoneMasked: zod_1.z.string(), emailMasked: zod_1.z.string().nullable() }),
    events: zod_1.z.array(exports.PsfTrackEvent),
    /** Every payment on this application, oldest first. */
    payments: zod_1.z.array(exports.PsfPaymentLine),
    /** What the one payment at submit comes to while it is still due. */
    dueRwf: zod_1.z.number().int().nullable(),
    /** Renewing: null until the business is (or was) a member. */
    renewal: exports.PsfRenewalState.nullable().default(null),
    /** Every paid renewal, newest first. */
    renewals: zod_1.z.array(exports.PsfRenewalLine).default([]),
});
/** `POST /psf/track/:docId/pay`, and `/pay-registration` for the payment at submit. */
exports.PsfTrackPayRequest = zod_1.z.object({ phoneE164: exports.MomoPhone });
/** `POST /psf/track/:docId/renew`: the band, the amount within it, and the phone to prompt. */
exports.PsfRenewRequest = zod_1.z.object({
    tierCode: zod_1.z.string().min(1),
    declaredFeeRwf: primitives_1.RwfAmount,
    /** Absent to check the prompt already waiting for this band and amount: it goes to the same phone. */
    phoneE164: exports.MomoPhone.optional(),
});
exports.PsfTrackPayResult = zod_1.z.object({
    status: zod_1.z.enum(["paid", "pending", "declined"]),
    message: zod_1.z.string().nullable(),
    view: exports.PsfTrackView,
});
// ---------------------------------------------------------------------------
// The officer's console: scope, report, decision log
// ---------------------------------------------------------------------------
exports.PsfScopeDistrict = zod_1.z.object({ id: zod_1.z.number().int(), name: zod_1.z.string(), letters: zod_1.z.string() });
/** `GET /oversight/psf/scope`: what the officer covers, and the districts they may narrow to. */
exports.PsfOfficerScope = zod_1.z.object({
    level: primitives_1.OversightScopeLevel,
    /** "Kicukiro district", "Kigali City", "Rwanda". */
    label: zod_1.z.string(),
    title: zod_1.z.string(),
    provinces: zod_1.z.array(zod_1.z.object({ id: zod_1.z.number().int(), name: zod_1.z.string(), districts: zod_1.z.array(exports.PsfScopeDistrict) })),
});
const isoDate = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-mm-dd.");
/** Narrow any officer read to one district, or one province, inside the officer's own region. */
exports.PsfAreaQuery = zod_1.z.object({
    district: zod_1.z.coerce.number().int().positive().optional(),
    province: zod_1.z.coerce.number().int().positive().optional(),
});
exports.PsfReportQuery = exports.PsfAreaQuery.extend({ from: isoDate, to: isoDate });
/** One headline number, against the same length of time just before. */
exports.PsfKpi = zod_1.z.object({ value: zod_1.z.number(), previous: zod_1.z.number() });
exports.PsfReportMonth = zod_1.z.object({
    month: zod_1.z.string(),
    registered: zod_1.z.number().int(),
    applied: zod_1.z.number().int(),
    approved: zod_1.z.number().int(),
    members: zod_1.z.number().int(),
    feesRwf: zod_1.z.number().int(),
});
exports.PsfReportSlice = zod_1.z.object({ key: zod_1.z.string(), label: zod_1.z.string(), count: zod_1.z.number().int(), amountRwf: zod_1.z.number().int() });
exports.PsfDistrictRow = zod_1.z.object({
    districtId: zod_1.z.number().int(),
    name: zod_1.z.string(),
    letters: zod_1.z.string(),
    provinceName: zod_1.z.string(),
    registered: zod_1.z.number().int(),
    waiting: zod_1.z.number().int(),
    overdue: zod_1.z.number().int(),
    approved: zod_1.z.number().int(),
    declined: zod_1.z.number().int(),
    members: zod_1.z.number().int(),
    membershipFeesRwf: zod_1.z.number().int(),
    medianDecisionDays: zod_1.z.number().nullable(),
    officers: zod_1.z.array(zod_1.z.string()),
});
/** `GET /oversight/psf/report`: the officer's region over a period. */
exports.PsfReport = zod_1.z.object({
    regionLabel: zod_1.z.string(),
    from: zod_1.z.string(),
    to: zod_1.z.string(),
    kpis: zod_1.z.object({
        registered: exports.PsfKpi,
        applied: exports.PsfKpi,
        approved: exports.PsfKpi,
        declined: exports.PsfKpi,
        newMembers: exports.PsfKpi,
        membershipFeesRwf: exports.PsfKpi,
        medianDecisionDays: zod_1.z.object({ value: zod_1.z.number().nullable(), previous: zod_1.z.number().nullable() }),
    }),
    /** Right now, not over the period. */
    now: zod_1.z.object({
        members: zod_1.z.number().int(),
        waiting: zod_1.z.number().int(),
        overdue: zod_1.z.number().int(),
        awaitingPayment: zod_1.z.number().int(),
        expiringIn30Days: zod_1.z.number().int(),
        /** Renewals further out, and memberships past their end with no renewal (2026-10-30). */
        expiringIn60Days: zod_1.z.number().int(),
        expiringIn90Days: zod_1.z.number().int(),
        lapsed: zod_1.z.number().int(),
        /** Membership numbers typed at registration, waiting for PSF to confirm (0121). */
        claimsWaiting: zod_1.z.number().int().default(0),
    }),
    /**
     * Injishi registrations in the region (2026-10-30): where each business stands right now, and the
     * decisions taken in the period. A PSF District Manager reviews the first gate in one step (0119).
     */
    registrations: zod_1.z.object({
        waitingReview: zod_1.z.number().int(),
        waitingApproval: zod_1.z.number().int(),
        waitingPayment: zod_1.z.number().int(),
        active: zod_1.z.number().int(),
        rejected: zod_1.z.number().int(),
        suspended: zod_1.z.number().int(),
        approvedInPeriod: exports.PsfKpi,
        rejectedInPeriod: exports.PsfKpi,
        /** Days from the fee settling to the decision, the median over the period. */
        medianDaysToDecision: zod_1.z.number().nullable(),
        /** The longest wait in the review queue right now, in whole days. */
        oldestWaitingDays: zod_1.z.number().int().nullable(),
        /** Month by month: fees paid (registrations entering review) and the decisions on them. */
        months: zod_1.z
            .array(zod_1.z.object({ month: zod_1.z.string(), submitted: zod_1.z.number().int(), approved: zod_1.z.number().int(), rejected: zod_1.z.number().int() }))
            .default([]),
        /** The businesses decided in the period, newest first, each opening its profile. */
        decided: zod_1.z
            .array(zod_1.z.object({
            orgId: zod_1.z.string(),
            legalName: zod_1.z.string(),
            kindLabel: zod_1.z.string(),
            decision: zod_1.z.enum(["approved", "rejected"]),
            decidedAt: zod_1.z.string(),
            decidedBy: zod_1.z.string().nullable(),
            status: zod_1.z.string(),
        }))
            .default([]),
    }),
    /** The district's tourism economy on Injishi's own records, over the period (2026-10-30). */
    economy: zod_1.z.object({
        /** Active businesses by kind: hotels, guesthouses, apartments, residences, PSF enterprises. */
        activeBusinesses: zod_1.z.array(zod_1.z.object({ key: zod_1.z.string(), label: zod_1.z.string(), count: zod_1.z.number().int() })),
        /** Confirmed bookings arriving in the period. */
        bookings: exports.PsfKpi,
        /** Guests × nights of those bookings. */
        guestNights: exports.PsfKpi,
        /** What those bookings are worth, RWF. */
        bookedValueRwf: exports.PsfKpi,
        /** Month by month, by the month guests arrive. */
        months: zod_1.z
            .array(zod_1.z.object({ month: zod_1.z.string(), bookings: zod_1.z.number().int(), guestNights: zod_1.z.number().int(), valueRwf: zod_1.z.number().int() }))
            .default([]),
        /** The businesses that sold the most stays in the period. */
        topBusinesses: zod_1.z
            .array(zod_1.z.object({ orgId: zod_1.z.string(), legalName: zod_1.z.string(), bookings: zod_1.z.number().int(), guestNights: zod_1.z.number().int(), valueRwf: zod_1.z.number().int() }))
            .default([]),
    }),
    months: zod_1.z.array(exports.PsfReportMonth),
    funnel: zod_1.z.object({ registered: zod_1.z.number().int(), approved: zod_1.z.number().int(), paid: zod_1.z.number().int(), declined: zod_1.z.number().int() }),
    bySector: zod_1.z.array(exports.PsfReportSlice),
    byFamily: zod_1.z.array(exports.PsfReportSlice),
    byGroup: zod_1.z.array(exports.PsfReportSlice),
    districts: zod_1.z.array(exports.PsfDistrictRow),
});
/** Days an application may wait on PSF before it shows as overdue. */
exports.PSF_OVERDUE_DAYS = 7;
exports.PsfDecisionsQuery = exports.PsfAreaQuery.extend({
    outcome: zod_1.z.enum(["approved", "declined"]).optional(),
    q: zod_1.z.string().trim().min(1).max(80).optional(),
    cluster: zod_1.z.string().trim().min(1).max(60).optional(),
    cursor: zod_1.z.string().max(200).optional(),
});
exports.PsfDecisionItem = zod_1.z.object({
    applicationId: primitives_1.Uuid,
    docId: zod_1.z.string().nullable(),
    businessName: zod_1.z.string(),
    businessCode: zod_1.z.string().nullable(),
    districtName: zod_1.z.string().nullable(),
    tierName: zod_1.z.string(),
    outcome: zod_1.z.enum(["approved", "declined"]),
    /** Where the application is now: approved may since have been paid. */
    paid: zod_1.z.boolean(),
    membershipNumber: zod_1.z.string().nullable(),
    feeRwf: primitives_1.RwfAmount.nullable(),
    declineReasonLabel: zod_1.z.string().nullable(),
    decidedAt: zod_1.z.string(),
    decidedByName: zod_1.z.string().nullable(),
    daysToDecide: zod_1.z.number().nullable(),
    clusterName: zod_1.z.string().nullable().default(null),
    subsectorName: zod_1.z.string().nullable().default(null),
});
exports.PsfDecisionsPage = zod_1.z.object({ items: zod_1.z.array(exports.PsfDecisionItem), nextCursor: zod_1.z.string().nullable() });
/** The queue, narrowed by place and filtered, as the console asks for it. */
exports.PsfQueueAreaQuery = exports.PsfAreaQuery.extend({
    cursor: zod_1.z.string().max(200).optional(),
    q: zod_1.z.string().trim().min(1).max(80).optional(),
    cluster: zod_1.z.string().trim().min(1).max(60).optional(),
    family: psf_1.PsfMembershipFamily.optional(),
    group: registration_1.PsfOwnerGroup.optional(),
    /** `newest` first by default: what just arrived is what an officer looks for. */
    sort: zod_1.z.enum(["newest", "oldest", "amount"]).default("newest"),
});
/** A Kigali yyyy-mm-dd for a moment, which every PSF date reads in. */
function kigaliDay(at) {
    return new Date(at.getTime() + 2 * 3600 * 1000).toISOString().slice(0, 10);
}
/** Whole days between two moments, floor, never negative. */
function wholeDaysBetween(from, to) {
    return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000));
}
/** The median of a list, or null for an empty one. */
function median(values) {
    if (values.length === 0)
        return null;
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
/** The membership number PSF's officers give: `PSF/KIC/2026/0009`. */
function formatPsfMembershipNumber(letters, year, n) {
    return `PSF/${letters}/${year}/${String(n).padStart(4, "0")}`;
}
/**
 * A province as people say it. The geography table stores the names in capitals
 * (`KIGALI`, `EAST`); every PSF screen reads them through this.
 */
function provinceDisplayName(name) {
    if (!name)
        return "";
    const key = name.trim().toUpperCase();
    const known = {
        KIGALI: "Kigali City",
        EAST: "Eastern Province",
        WEST: "Western Province",
        NORTH: "Northern Province",
        SOUTH: "Southern Province",
    };
    return known[key] ?? key.charAt(0) + key.slice(1).toLowerCase();
}
/** "+250781464545" as "+250 78• ••• 545": enough to recognise, not to call. */
function maskPhone(e164) {
    const d = e164.replace(/\s/g, "");
    if (d.length < 8)
        return "•".repeat(d.length);
    return `${d.slice(0, 4)} ${d.slice(4, 6)}• ••• ${d.slice(-3)}`;
}
/** "diane@example.rw" as "d••••@example.rw". */
function maskEmail(email) {
    const [user, domain] = email.split("@");
    if (!user || !domain)
        return "•••";
    return `${user[0]}${"•".repeat(Math.max(2, Math.min(5, user.length - 1)))}@${domain}`;
}
/** The business behind an application, as the officer's detail panel reads it. */
exports.PsfBusinessHistory = zod_1.z.object({
    registeredAt: zod_1.z.string().nullable(),
    payments: zod_1.z.array(exports.PsfPaymentLine.extend({ applicationDocId: zod_1.z.string().nullable() })),
    applications: zod_1.z.array(zod_1.z.object({
        id: primitives_1.Uuid,
        docId: zod_1.z.string().nullable(),
        tierName: zod_1.z.string(),
        status: zod_1.z.string(),
        submittedAt: zod_1.z.string(),
        decidedAt: zod_1.z.string().nullable(),
        declineReasonLabel: zod_1.z.string().nullable(),
        membershipNumber: zod_1.z.string().nullable(),
    })),
    memberships: zod_1.z.array(zod_1.z.object({
        number: zod_1.z.string(),
        tierName: zod_1.z.string().nullable(),
        startsOn: zod_1.z.string().nullable(),
        expiresOn: zod_1.z.string().nullable(),
        current: zod_1.z.boolean(),
    })),
});
/**
 * `GET /oversight/psf/businesses/:orgId`: one business on its own page, for the
 * officer covering it: what it is, how to reach it, and its whole history.
 */
exports.PsfBusinessDetail = zod_1.z.object({
    business: psf_1.PsfBusinessRow,
    /** The person on its newest application, as filed. */
    contact: zod_1.z
        .object({ name: zod_1.z.string(), role: zod_1.z.string(), phoneE164: zod_1.z.string(), email: zod_1.z.string().nullable() })
        .nullable(),
    history: exports.PsfBusinessHistory,
    /** Every branch it listed, in any district (2026-10-23), with where each stands. */
    branches: zod_1.z.array(psf_1.PsfBusinessBranch).default([]),
    /** Every paid renewal, newest first (2026-11-02). */
    renewals: zod_1.z.array(exports.PsfRenewalLine).default([]),
});
/**
 * `GET /oversight/psf/registrations/:orgId` (2026-10-30): a business's side on Injishi, for the PSF
 * District Manager covering it, whatever its standing: what it is, who decided its registration and
 * when, and whether guests can find it yet. A business PSF's register does not hold (rejected, a
 * residence) still opens here.
 */
exports.PsfRegistrationProfile = zod_1.z.object({
    orgId: zod_1.z.string(),
    legalName: zod_1.z.string(),
    businessCode: zod_1.z.string().nullable(),
    kindLabel: zod_1.z.string(),
    domain: zod_1.z.string(),
    districtName: zod_1.z.string().nullable(),
    sectorName: zod_1.z.string().nullable(),
    addressText: zod_1.z.string().nullable(),
    tin: zod_1.z.string().nullable(),
    starGrade: zod_1.z.number().int().nullable(),
    starGradeConfirmed: zod_1.z.boolean(),
    status: zod_1.z.string(),
    owner: zod_1.z.object({ name: zod_1.z.string().nullable(), email: zod_1.z.string(), phone: zod_1.z.string().nullable() }).nullable(),
    registeredAt: zod_1.z.string(),
    reviews: zod_1.z.array(zod_1.z.object({
        stage: zod_1.z.string(),
        decision: zod_1.z.enum(["passed", "rejected"]),
        roleLabel: zod_1.z.string(),
        byName: zod_1.z.string().nullable(),
        at: zod_1.z.string(),
        notes: zod_1.z.string().nullable(),
        reasonLabel: zod_1.z.string().nullable(),
    })),
    listings: zod_1.z.array(zod_1.z.object({
        propertyName: zod_1.z.string(),
        status: zod_1.z.string(),
        publishedAt: zod_1.z.string().nullable(),
        slug: zod_1.z.string().nullable(),
        roomTypes: zod_1.z.number().int(),
        rooms: zod_1.z.number().int(),
    })),
    /** Confirmed bookings arriving in the last 90 days. */
    bookings90Days: zod_1.z.number().int(),
});
// ---------------------------------------------------------------------------
// What a band costs, by place (2026-10-20)
// ---------------------------------------------------------------------------
/**
 * Where a band's price came from: the district's own, PSF's national price,
 * or (neither set) the band's starting price from the tier catalogue.
 */
exports.PsfFeeSource = zod_1.z.enum(["district", "national", "band"]);
/** One band's price for a district, as the public form shows it. */
exports.PsfTierFee = zod_1.z.object({
    tierCode: zod_1.z.string(),
    /**
     * Null: no price anywhere (a tier PSF prices itself, never priced), so it is not offered.
     * Otherwise the LEAST a business in this band pays a year.
     */
    amountRwf: primitives_1.RwfAmount.nullable(),
    source: exports.PsfFeeSource,
    /**
     * The MOST a business in this band may pay (2026-10-23): the top of the
     * band's range in PSF's catalogue (49,999 for the 20,000 band), or, for a
     * band with no range, one franc under the next band's price. Null for the
     * top band, which has no ceiling.
     */
    ceilingRwf: primitives_1.RwfAmount.nullable().default(null),
});
/** `GET /psf/fees?district=`: every active band's price in one district. */
exports.PsfFeesQuery = zod_1.z.object({ district: zod_1.z.coerce.number().int().positive() });
exports.PsfFeesView = zod_1.z.object({ districtId: zod_1.z.number().int(), fees: zod_1.z.array(exports.PsfTierFee) });
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
function psfFeeCeilings(fees) {
    const priced = fees.filter((f) => f.amountRwf !== null);
    const out = new Map();
    for (const f of priced) {
        if (f.bandMaxRwf != null) {
            out.set(f.tierCode, Math.max(f.bandMaxRwf, f.amountRwf));
            continue;
        }
        const next = priced.reduce((best, o) => (o.amountRwf > f.amountRwf && (best === null || o.amountRwf < best) ? o.amountRwf : best), null);
        out.set(f.tierCode, next === null ? null : next - 1);
    }
    return out;
}
/** One band in the officer's Fees screen: the national price, the district's, and what applies. */
exports.PsfOfficerFeeRow = zod_1.z.object({
    tierCode: zod_1.z.string(),
    tierName: zod_1.z.string(),
    family: psf_1.PsfMembershipFamily,
    priceKind: psf_1.PsfPriceKind,
    /** The band's bounds from the catalogue; a price must sit inside them. */
    bandMinRwf: primitives_1.RwfAmount.nullable(),
    bandMaxRwf: primitives_1.RwfAmount.nullable(),
    /** The band's own starting price, used when nobody set one. */
    bandFeeRwf: primitives_1.RwfAmount.nullable(),
    nationalRwf: primitives_1.RwfAmount.nullable(),
    districtRwf: primitives_1.RwfAmount.nullable(),
    effectiveRwf: primitives_1.RwfAmount.nullable(),
    source: exports.PsfFeeSource,
    updatedAt: zod_1.z.string().nullable(),
    updatedByName: zod_1.z.string().nullable(),
});
exports.PsfOfficerFeesView = zod_1.z.object({
    /** The district being priced, or null for the national prices. */
    districtId: zod_1.z.number().int().nullable(),
    districtName: zod_1.z.string().nullable(),
    canEditNational: zod_1.z.boolean(),
    /** True when a district is shown and the officer covers it. */
    canEditDistrict: zod_1.z.boolean(),
    rows: zod_1.z.array(exports.PsfOfficerFeeRow),
});
/** Set a band's price for a place (`districtId` null: national), or clear it with `amountRwf: null`. */
exports.SetPsfTierFeeRequest = zod_1.z.object({
    tierCode: zod_1.z.string().trim().min(1).max(60),
    districtId: zod_1.z.number().int().positive().nullable(),
    amountRwf: primitives_1.RwfAmount.refine((n) => n > 0, "Give a price above zero.").nullable(),
});
/** The price that applies: the district's, else the national, else the band's starting price. */
function resolvePsfTierFee(districtRwf, nationalRwf, bandRwf) {
    if (districtRwf !== null)
        return { amountRwf: districtRwf, source: "district" };
    if (nationalRwf !== null)
        return { amountRwf: nationalRwf, source: "national" };
    return { amountRwf: bandRwf, source: "band" };
}
//# sourceMappingURL=psf-public.js.map