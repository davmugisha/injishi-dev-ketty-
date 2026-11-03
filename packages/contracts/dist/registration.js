"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OversightDocumentList = exports.OversightDocument = exports.RejectRegistrationRequest = exports.PassGateRequest = exports.RegistrationReview = exports.RegistrationReviewDecision = exports.RegistrationReviewStage = exports.REJECTION_REASON_LABEL = exports.RegistrationRejectionReason = exports.CreateRegistrationRequest = exports.IntendedOwner = exports.BusinessDetails = exports.EnterpriseBusiness = exports.ResidenceBusiness = exports.HospitalityBusiness = exports.FranchiseDeclaration = exports.FranchiseRole = exports.PsfMembershipNumber = exports.NUMBERED_REGISTRATION_KINDS = exports.EnterpriseRegistrationKind = exports.PsfOwnerGroup = exports.PsfApplicationInput = exports.PsfIdDocument = exports.PSF_CONSENT_TEXT = exports.PSF_CONSENT_VERSION = exports.PsfGender = exports.PsfContactRole = exports.PsfTradeDirection = exports.PsfOwnership = exports.PsfCompanyType = exports.RegistrationBranch = exports.MAX_REGISTRATION_BRANCHES = exports.CertificateInput = exports.ORG_CERTIFICATE_KIND_LABEL = exports.OrgCertificateKind = exports.PersonalDetails = exports.Upi = exports.Tin = exports.Address = exports.InternationalAddress = exports.RwandanAddress = exports.IdentityDocumentInput = exports.PassportNumber = exports.RwandanNationalId = exports.CountryCode = exports.AccountDocumentType = exports.Gender = exports.RegistrantCapacity = exports.RegistrationBusinessType = exports.RegistrantRole = void 0;
exports.CERTIFICATE_KIND_LABEL = exports.UploadedObject = exports.BrokerRegistrationSummary = exports.BrokerStatus = exports.CreateBrokerRegistrationRequest = exports.MyProfile = exports.MyProfileDocument = exports.RegistrationPayResult = exports.RegistrationFeeAttemptStatus = exports.RegistrationPayRequest = exports.RegistrationFeeQuote = exports.ClaimPreview = exports.ClaimOrgRequest = exports.TinCheckResult = exports.RegistryBusiness = exports.TinCheckRequest = exports.RegistrationConflictCode = exports.OPERATOR_CONTRACT_VERSION = exports.RegistrationSummary = exports.OversightDecisionQuery = exports.OversightDecisionPage = exports.OversightDecision = exports.OversightQueueItem = void 0;
exports.businessTypeFor = businessTypeFor;
exports.domainForRole = domainForRole;
exports.isRwandanAddress = isRwandanAddress;
exports.branchNameKey = branchNameKey;
exports.stepForRejectionReason = stepForRejectionReason;
const zod_1 = require("zod");
const countries_1 = require("./countries");
const business_kind_1 = require("./business-kind");
const rdb_1 = require("./rdb");
const primitives_1 = require("./primitives");
const booking_1 = require("./booking");
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
 * `host`, `landlord` and `enterprise` each create an `orgs` row and differ by
 * `domain`; `broker` creates a `brokers` row and no org at all. All four are
 * priced separately in `registration_fees`, which is why this is one enum and
 * not a boolean plus a domain.
 *
 * `enterprise` is the PSF path: a business of any sector registering to join
 * the Private Sector Federation through Injishi.
 */
exports.RegistrantRole = zod_1.z.enum(["host", "landlord", "broker", "enterprise"]);
/** The four rows `registration_fees` is keyed by (schema §8.3a). */
exports.RegistrationBusinessType = zod_1.z.enum([
    "hospitality",
    "residence",
    "broker",
    "enterprise",
]);
/** A registrant's answer maps onto exactly one fee row and one domain. */
function businessTypeFor(role) {
    switch (role) {
        case "host":
            return "hospitality";
        case "landlord":
            return "residence";
        case "broker":
            return "broker";
        case "enterprise":
            return "enterprise";
    }
}
/** The domain a registrant's role registers, for the three roles that create an org. */
function domainForRole(role) {
    switch (role) {
        case "host":
            return "hospitality";
        case "landlord":
            return "residence";
        case "enterprise":
            return "enterprise";
    }
}
/** Whether this registrant is the owner, or acting for one (OBO, FL02). */
exports.RegistrantCapacity = zod_1.z.enum(["owner", "on_behalf_of"]);
// ---------------------------------------------------------------------------
// Identity fields (D24)
// ---------------------------------------------------------------------------
exports.Gender = zod_1.z.enum(["female", "male", "other", "prefer_not_to_say"]);
/**
 * The two document types that may anchor an ACCOUNT.
 *
 * Narrower than the shared `DocumentType` primitive on purpose: that enum keeps
 * `other` for walk-in stay capture, and the database enforces the same
 * narrowing with a CHECK on `identity_documents`.
 */
exports.AccountDocumentType = zod_1.z.enum(["national_id", "passport"]);
/** ISO-3166-1 alpha-2, upper case. `RW` is the address discriminator (D24). */
exports.CountryCode = zod_1.z
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
    .refine((c) => (0, countries_1.isKnownCountry)(c), "We do not recognise that country code.");
/**
 * Rwandan National ID: 16 digits, commonly written in spaced groups.
 *
 * Spaces are stripped before checking, because the field is displayed grouped
 * and a person who types what they see should not be told they are wrong. The
 * stored value is the bare digits.
 */
exports.RwandanNationalId = zod_1.z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, ""))
    .pipe(zod_1.z
    .string()
    .regex(/^\d{16}$/, "A Rwandan National ID is 16 digits."));
/**
 * Passport number. Deliberately loose: issuing states disagree on length and
 * alphabet, and rejecting a valid foreign passport is worse than accepting a
 * typo that the verifier will catch against the document itself.
 */
exports.PassportNumber = zod_1.z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, "").toUpperCase())
    .pipe(zod_1.z
    .string()
    .regex(/^[A-Z0-9]{6,12}$/, "A passport number is 6 to 12 letters or digits."));
/** The identity document a registrant presents, validated per type. */
exports.IdentityDocumentInput = zod_1.z
    .discriminatedUnion("documentType", [
    zod_1.z.object({
        documentType: zod_1.z.literal("national_id"),
        documentNumber: exports.RwandanNationalId,
        /** A Rwandan NID is Rwandan by definition; kept explicit for the row. */
        issuingCountry: zod_1.z.literal("RW").default("RW"),
    }),
    zod_1.z.object({
        documentType: zod_1.z.literal("passport"),
        documentNumber: exports.PassportNumber,
        issuingCountry: exports.CountryCode,
    }),
])
    .describe("National ID or passport, validated by the type chosen.");
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
 * disagree. It is on the wire so the picker can validate its own cascade. Cell
 * is the same kind of field one level down — `villages` resolves upward to its
 * cell — so `village_id` is the only one of the two that any table holds.
 *
 * Cell and village are OPTIONAL, and that is a product decision, not an
 * oversight: village is the level that actually locates a plot in Rwanda, and
 * it is also the level a registrant is most likely not to know by name. A
 * registration must not be blocked on it. Optional means absent, never zero:
 * the positive bound below refuses `0` rather than storing it as an id.
 */
exports.RwandanAddress = zod_1.z.object({
    country: zod_1.z.literal("RW"),
    provinceId: zod_1.z.number().int().positive("Choose a province."),
    districtId: zod_1.z.number().int().positive("Choose a district."),
    sectorId: zod_1.z.number().int().positive("Choose a sector."),
    /** Fourth level. Collected to drive the village picker, never stored. */
    cellId: zod_1.z.number().int().positive("Choose a cell.").optional(),
    /** Fifth level, and the finest one. Stored; see `orgs.village_id`. */
    villageId: zod_1.z.number().int().positive("Choose a village.").optional(),
    /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
    street: zod_1.z.string().trim().max(200).optional(),
});
exports.InternationalAddress = zod_1.z.object({
    country: exports.CountryCode.refine((c) => c !== "RW", "Use the Rwandan address form for a Rwandan address."),
    /** The whole address as written locally. Formats differ too much to split. */
    addressText: zod_1.z
        .string()
        .trim()
        .min(1, "Write the address.")
        .max(500, "That address is too long for our records."),
});
exports.Address = zod_1.z.union([exports.RwandanAddress, exports.InternationalAddress]);
/** Narrowing helper both sides use rather than re-testing the discriminator. */
function isRwandanAddress(address) {
    return address.country === "RW";
}
// ---------------------------------------------------------------------------
// Identifiers (D24 — TIN for businesses, UPI for residences)
// ---------------------------------------------------------------------------
/** RRA Tax Identification Number: 9 digits, often written in groups of three. */
exports.Tin = zod_1.z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, ""))
    .pipe(zod_1.z.string().regex(/^\d{9}$/, "A TIN is 9 digits."));
/**
 * Unique Parcel Identifier. Five slash-separated numeric parts, e.g.
 * `1/03/07/02/1234`. Accepted with or without spaces around the separators.
 */
exports.Upi = zod_1.z
    .string()
    .trim()
    .transform((v) => v.replace(/\s*\/\s*/g, "/"))
    .pipe(zod_1.z
    .string()
    .regex(/^\d+\/\d+\/\d+\/\d+\/\d+$/, "A UPI looks like 1/03/07/02/1234."));
// ---------------------------------------------------------------------------
// Step 1 — About you
// ---------------------------------------------------------------------------
exports.PersonalDetails = zod_1.z.object({
    /** As written on the identity document. */
    fullName: zod_1.z
        .string()
        .trim()
        .min(2, "Tell us your full name, as written on your document.")
        .max(160, "That name is too long for our records."),
    /**
     * Absent only when the person's identity is already VERIFIED (ADR-060): the
     * server then keeps the verified document, whose full number the browser
     * never holds again after a reload. For anyone unverified the server
     * refuses its absence at this path.
     */
    document: exports.IdentityDocumentInput.optional(),
    gender: exports.Gender.optional(),
    /** ISO date. Bounds are sanity rails, not a policy on who may register. */
    dateOfBirth: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker.")
        .refine((v) => {
        const d = new Date(`${v}T00:00:00Z`);
        if (Number.isNaN(d.getTime()))
            return false;
        const years = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
        return years >= 18 && years <= 120;
    }, "You must be at least 18 to register a business."),
    phoneE164: zod_1.z
        .string()
        .trim()
        .transform((v) => v.replace(/[\s-]/g, ""))
        .pipe(zod_1.z
        .string()
        .regex(/^\+\d{7,15}$/, "Include the country code, like +250788123456.")),
    address: exports.Address,
});
// ---------------------------------------------------------------------------
// Step 2 — Your business
// ---------------------------------------------------------------------------
/** A certificate the registrant attaches (schema §4.3a). */
/**
 * The kinds of document a business uploads about itself (`org_certificate_kind`).
 *
 * One name for the set, because two readers need it: the registration wizard
 * sending an upload, and the officer's console listing what was sent. Two
 * copies of an enum is how a kind gets added in one place and not the other.
 */
exports.OrgCertificateKind = zod_1.z.enum([
    "rdb_grade",
    "tourism_license",
    "tax_clearance",
    "fire_safety",
    "health_inspection",
    "other",
    // The registration artboard's own rows (Register.dc.html, 2026-10-19): the
    // RDB certificate a hospitality business is asked for, its PSF certificate,
    // and the land title a residence is asked for. Each used to arrive as
    // `other` with the name typed by hand, which filed the one document an
    // officer looks for first under a free-text label.
    "rdb_certificate",
    "psf_certificate",
    "land_title",
    // A franchisee's agreement with its franchisor (ADR-075 O-7, AC-8), optional
    // and asked only of a franchisee (`registrationDocumentRows`).
    "franchise_agreement",
]);
/** What each kind is called on screen, wherever a document is listed. */
exports.ORG_CERTIFICATE_KIND_LABEL = {
    rdb_grade: "RDB grade certificate",
    tourism_license: "Tourism license",
    tax_clearance: "Tax clearance",
    fire_safety: "Fire safety certificate",
    health_inspection: "Health inspection",
    other: "Other document",
    rdb_certificate: "RDB certificate",
    psf_certificate: "PSF certificate",
    land_title: "Land title",
    franchise_agreement: "Franchise agreement",
};
exports.CertificateInput = zod_1.z.object({
    kind: exports.OrgCertificateKind,
    /** Required when `kind` is `other`; the database carries the same rule. */
    kindOther: zod_1.z.string().trim().min(1).max(120).optional(),
    /** Key of an already-uploaded `stored_objects` row (F-S09). */
    objectKey: zod_1.z.string().trim().min(1),
    certificateNumber: zod_1.z.string().trim().max(120).optional(),
    issuedBy: zod_1.z.string().trim().max(160).optional(),
    issuedOn: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    expiresOn: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
/**
 * How many branches a registration may declare beyond its head office (ADR-054).
 * The schema and the wizard's Branches step both read this one constant.
 */
exports.MAX_REGISTRATION_BRANCHES = 20;
/**
 * One more location of a hospitality business, declared under the same TIN
 * (ADR-054 AC-R1). The head office is NOT one of these: it is the business
 * itself, named with its legal name at its own address.
 */
exports.RegistrationBranch = zod_1.z.object({
    name: zod_1.z
        .string()
        .trim()
        .min(1, "Give this branch a name.")
        .max(120, "That name is too long for our records."),
    address: exports.RwandanAddress,
});
/** The comparison two branch names are equal under: trimmed, case ignored. */
function branchNameKey(name) {
    return name.trim().toLocaleLowerCase("en");
}
// ---------------------------------------------------------------------------
// PSF membership application (ADR-056)
// ---------------------------------------------------------------------------
/**
 * The input lives here, beside the rest of what a registration can carry,
 * because `HospitalityBusiness` embeds it and it reuses this file's ID, phone
 * and country rules. `psf.ts` holds everything else about PSF membership and
 * imports from here, never the other way round.
 */
/** PSF's form, "Company type", as printed. */
exports.PsfCompanyType = zod_1.z.enum([
    "cooperative",
    "ngo",
    "partly_state_owned",
    "private_company",
    "public_company",
    "sole_trader",
]);
/** PSF's form, "Ownership", as printed. `other` carries a text. */
exports.PsfOwnership = zod_1.z.enum([
    "rwandan_100",
    "foreign_100",
    "franchise",
    "joint_venture",
    "foreign_representative",
    "other",
]);
exports.PsfTradeDirection = zod_1.z.enum(["none", "export", "import", "both"]);
/** PSF's form, "Role/Function", as printed. */
exports.PsfContactRole = zod_1.z.enum(["owner", "managing_director", "ceo", "chairman"]);
/**
 * PSF's form knows two genders. This never changes the person's own profile,
 * which keeps all four answers (ADR-056 AC-4).
 */
exports.PsfGender = zod_1.z.enum(["male", "female"], {
    errorMap: () => ({ message: "PSF's form needs Male or Female." }),
});
/**
 * The version of the consent text the applicant ticked. Bump it whenever the
 * wording in `PSF_CONSENT_TEXT` changes, so every stored consent names the
 * words it agreed to.
 */
exports.PSF_CONSENT_VERSION = "2026-09-27";
/** What the consent box says. Rendered verbatim by every surface that asks. */
exports.PSF_CONSENT_TEXT = "I agree that Injishi shares this application with the Private Sector Federation (PSF): " +
    "the business details above, and my name, ID number, date of birth, phone and email, " +
    "so that PSF can decide my membership.";
const psfText = (max, required) => zod_1.z.string().trim().min(1, required).max(max, "That is too long for PSF's form.");
/**
 * One PSF membership application, as the wizard or the workspace sends it.
 *
 * The registration type and number are NOT inputs: the server copies the TIN
 * from the business, which is what makes AC-3's "not editable" true on the
 * wire and not only on the screen.
 */
/** The ID a PSF application names its contact by. */
exports.PsfIdDocument = zod_1.z.discriminatedUnion("documentType", [
    zod_1.z.object({ documentType: zod_1.z.literal("national_id"), documentNumber: exports.RwandanNationalId }),
    zod_1.z.object({ documentType: zod_1.z.literal("passport"), documentNumber: exports.PassportNumber }),
]);
exports.PsfApplicationInput = zod_1.z
    .object({
    requestedTierCode: zod_1.z.string().trim().min(1, "Pick a membership tier.").max(60),
    /**
     * What the business will pay a year, inside the band it picked. A business
     * pays what it can afford within its tier, so the amount is its own answer.
     * Required for every tier except one PSF prices itself; the server checks it
     * against the tier (`psfTierAcceptsFee`), which only the server reads.
     */
    declaredFeeRwf: primitives_1.RwfAmount.refine((n) => n > 0, "Give the amount you will pay.").optional(),
    companyName: psfText(200, "Give the name PSF should record."),
    streetAddress: psfText(200, "Give the business's street address."),
    website: zod_1.z
        .string()
        .trim()
        .max(200)
        .url("Give the full address, like https://example.rw.")
        .optional(),
    companyType: exports.PsfCompanyType,
    ownership: exports.PsfOwnership,
    ownershipOther: zod_1.z.string().trim().min(1).max(120).optional(),
    businessActivity: psfText(300, "Say what the business does."),
    tradeDirection: exports.PsfTradeDirection,
    tradeGoods: zod_1.z.string().trim().min(1).max(300).optional(),
    tradeCountries: zod_1.z.array(exports.CountryCode).max(50).default([]),
    contactRole: exports.PsfContactRole,
    firstName: psfText(80, "Give a first name."),
    lastName: psfText(80, "Give a last name."),
    gender: exports.PsfGender,
    phoneE164: zod_1.z
        .string()
        .trim()
        .transform((v) => v.replace(/[\s-]/g, ""))
        .pipe(zod_1.z.string().regex(/^\+\d{7,15}$/, "Include the country code, like +250788123456.")),
    email: zod_1.z.string().trim().email("That email address does not look right."),
    /** Absent only when `useDocumentOnFile` asks the server for it instead. */
    idDocument: exports.PsfIdDocument.optional(),
    /**
     * "Use the document on my profile" (registration Phase 0). The profile read
     * masks the number, so a returning registrant could only retype it; with
     * this the server copies the full number from the profile it holds, and the
     * browser never sees it.
     */
    useDocumentOnFile: zod_1.z.literal(true).optional(),
    dateOfBirth: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker.")
        .refine((v) => {
        const d = new Date(`${v}T00:00:00Z`);
        if (Number.isNaN(d.getTime()))
            return false;
        const years = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
        return years >= 18 && years <= 120;
    }, "The person named here must be at least 18."),
    /** Must be ticked: an unticked box and a Yes are different acts (AC-5). */
    consent: zod_1.z.literal(true, {
        errorMap: () => ({ message: "Tick the box to agree to share this with PSF." }),
    }),
})
    .superRefine((value, ctx) => {
    // One source for the ID: typed, or the one on file. Never both, never none.
    if (!value.idDocument && !value.useDocumentOnFile) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["idDocument", "documentNumber"], message: "Give an ID number." });
    }
    if (value.idDocument && value.useDocumentOnFile) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["idDocument"], message: "Give an ID number or use the one on file, not both." });
    }
    // Mirrors `psf_membership_applications_ownership_shape`.
    if (value.ownership === "other" && !value.ownershipOther) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["ownershipOther"], message: "Say what the ownership is." });
    }
    if (value.ownership !== "other" && value.ownershipOther) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["ownershipOther"], message: "Only fill this in when you pick Other." });
    }
    // Mirrors `psf_membership_applications_trade_shape`.
    if (value.tradeDirection === "none") {
        if (value.tradeGoods) {
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["tradeGoods"], message: "Leave this empty when you do not export or import." });
        }
        if (value.tradeCountries.length > 0) {
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["tradeCountries"], message: "Leave this empty when you do not export or import." });
        }
    }
    else {
        if (!value.tradeGoods) {
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["tradeGoods"], message: "Say which goods or services." });
        }
        if (value.tradeCountries.length === 0) {
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["tradeCountries"], message: "Pick at least one country." });
        }
    }
});
/**
 * The owners PSF's Specialized cluster speaks for: women, young people and
 * people with disabilities. A marker on a business of ANY sector, never a
 * sector of its own, because a factory a woman owns is still a factory.
 */
exports.PsfOwnerGroup = zod_1.z.enum(["women", "youth", "pwd"]);
/**
 * How a PSF business is registered, when it says so. A TIN is optional on this
 * path: a cooperative is registered with RCA, an NGO with RGB, and the smallest
 * businesses PSF wants are often registered nowhere yet. `tin` is checked with
 * RRA like every other TIN; the others are recorded as given, and the PSF
 * officer reads them.
 */
exports.EnterpriseRegistrationKind = zod_1.z.enum(["tin", "rca", "rgb", "other", "none"]);
/** The kinds that carry a number other than a TIN. */
exports.NUMBERED_REGISTRATION_KINDS = ["rca", "rgb", "other"];
/** The membership number a business that answered Yes may give (ADR-056 AC-1). */
exports.PsfMembershipNumber = zod_1.z
    .string()
    .trim()
    .min(1, "Give the number, or leave it empty.")
    .max(40, "That number is too long.");
/**
 * Whether the business is part of a franchise (ADR-075 O-7, AC-8). No block
 * means No, as no `org_franchises` row does. A franchisee runs another
 * company's brand and names that company; a franchisor owns the brand and says
 * how many locations run under it. The franchisee's agreement, when it has one
 * to hand, is a `franchise_agreement` document on the Documents step.
 */
exports.FranchiseRole = zod_1.z.enum(["franchisee", "franchisor"]);
const BrandName = zod_1.z
    .string()
    .trim()
    .min(1, "Give the brand name.")
    .max(120, "That brand name is too long for our records.");
exports.FranchiseDeclaration = zod_1.z.discriminatedUnion("role", [
    zod_1.z
        .object({
        role: zod_1.z.literal("franchisee"),
        brandName: BrandName,
        franchisorLegalName: zod_1.z
            .string()
            .trim()
            .min(2, "Give the franchisor's registered name.")
            .max(200, "That name is too long for our records."),
        franchisorCountry: zod_1.z
            .string({ required_error: "Pick the franchisor's country." })
            .trim()
            .min(1, "Pick the franchisor's country.")
            .pipe(exports.CountryCode),
    })
        .strict(),
    zod_1.z
        .object({
        role: zod_1.z.literal("franchisor"),
        brandName: BrandName,
        franchisedLocations: zod_1.z
            .number({ invalid_type_error: "Say how many locations run under your brand." })
            .int("Give a whole number of locations.")
            .min(1, "At least one location runs under your brand.")
            .max(100000, "That is more locations than we can record."),
    })
        .strict(),
]);
const businessBase = zod_1.z.object({
    legalName: zod_1.z
        .string()
        .trim()
        .min(2, "Give the registered name of the business.")
        .max(200, "That name is too long for our records."),
    address: exports.RwandanAddress,
    certificates: zod_1.z.array(exports.CertificateInput).max(20).default([]),
});
/**
 * A hospitality business. Carries a TIN, never a UPI-only identity, and is the
 * only branch that may hold a tourism licence, a grade, or a PSF membership.
 */
exports.HospitalityBusiness = businessBase.extend({
    domain: zod_1.z.literal("hospitality"),
    entityGroup: rdb_1.RdbEntityGroup.default("accommodation"),
    /**
     * What kind of business it is (ADR-075 D-h, AC-31). A stay's kind is its accommodation class; a venue (Bar &
     * Restaurant, Coffee Shop) has a kind and no class. Optional only so a request built before ADR-075 still
     * reads: its kind is then derived from the class (`hospitalityKindOf`).
     */
    businessKind: business_kind_1.HospitalityKind.optional(),
    /** A stay's RDB class. Required for a stay, forbidden for a venue, which has no rooms (ADR-075 O-14). */
    accommodationClass: rdb_1.AccommodationClass.optional(),
    /** Required when the class is `other`, forbidden otherwise (D24). */
    accommodationClassOther: zod_1.z.string().trim().min(1).max(120).optional(),
    tin: exports.Tin,
    upi: exports.Upi.optional(),
    tourismLicenseNumber: zod_1.z.string().trim().max(60).optional(),
    chamberOfTourismMember: zod_1.z.boolean().default(false),
    /** Optional, and hospitality only. Not the PSF oversight body (D24). */
    psfMember: zod_1.z.boolean().default(false),
    /**
     * A Yes may carry the PSF membership number; nobody checks it (ADR-056
     * AC-7). Forbidden with a No (see `BusinessDetails`).
     */
    psfMembershipNumber: exports.PsfMembershipNumber.optional(),
    /**
     * A No may carry an application to join (ADR-056 AC-6), written in the
     * same transaction as the business. Forbidden with a Yes.
     */
    psfApplication: exports.PsfApplicationInput.optional(),
    eacStarGrade: zod_1.z.number().int().min(1).max(5).optional(),
    /** Part of a franchise, and how (ADR-075 AC-8). Absent means No. */
    franchise: exports.FranchiseDeclaration.optional(),
    /** The locations beyond the head office (ADR-054). Empty for a single site business. */
    branches: zod_1.z
        .array(exports.RegistrationBranch)
        .max(exports.MAX_REGISTRATION_BRANCHES, `A business can list up to ${exports.MAX_REGISTRATION_BRANCHES} branches when it registers. Add more after approval.`)
        .default([]),
});
/** A residence. Carries a UPI, and none of the tourism apparatus. */
exports.ResidenceBusiness = businessBase.extend({
    domain: zod_1.z.literal("residence"),
    residenceClass: rdb_1.ResidenceClass,
    upi: exports.Upi,
    /**
     * Refused rather than left out (ADR-054 AC-R3). An unknown key would be
     * stripped silently, and a landlord who sent branches would believe they
     * had been recorded.
     */
    branches: zod_1.z
        .array(zod_1.z.unknown())
        .max(0, "A residence registers without branches.")
        .optional(),
    /**
     * Refused, not stripped, for the same reason (ADR-056 AC-6): PSF
     * membership through Injishi is hospitality only, and the database's
     * `orgs_domain_shape` forbids it on a residence too.
     */
    psfApplication: zod_1.z
        .never({ errorMap: () => ({ message: "A residence cannot apply for PSF membership here." }) })
        .optional(),
    psfMembershipNumber: zod_1.z
        .never({ errorMap: () => ({ message: "A residence cannot hold a PSF membership here." }) })
        .optional(),
    /** Refused, not stripped, for the same reason: a franchise is a hospitality business's brand (ADR-075 O-7). */
    franchise: zod_1.z
        .never({ errorMap: () => ({ message: "A residence registers without a franchise." }) })
        .optional(),
});
/**
 * A business of any sector joining PSF through Injishi (the PSF path). It
 * names its sector by the PSF association it belongs to (the cluster follows
 * from it), may carry a TIN, and carries none of the tourism apparatus.
 *
 * The PSF application itself is NOT part of this: the business registers, gets
 * its code, and applies from its own portal, where the form and the tiers live.
 */
exports.EnterpriseBusiness = businessBase.extend({
    domain: zod_1.z.literal("enterprise"),
    registrationKind: exports.EnterpriseRegistrationKind,
    /** Required with `registrationKind: tin`, forbidden otherwise. */
    tin: exports.Tin.optional(),
    /** Required with `rca`, `rgb` and `other`, forbidden otherwise. */
    registrationNumber: zod_1.z.string().trim().min(1, "Give the registration number.").max(60).optional(),
    /** A row of the PSF association catalogue, which admin edits. */
    associationCode: zod_1.z.string().trim().min(1, "Pick the association your business belongs to.").max(60),
    ownerGroups: zod_1.z.array(exports.PsfOwnerGroup).max(3).default([]),
    /** Refused, not stripped, like a residence's (ADR-054 AC-R3). */
    branches: zod_1.z
        .array(zod_1.z.unknown())
        .max(0, "A PSF business registers without branches.")
        .optional(),
    psfApplication: zod_1.z
        .never({ errorMap: () => ({ message: "Apply for membership from your portal once you are registered." }) })
        .optional(),
    psfMembershipNumber: zod_1.z
        .never({ errorMap: () => ({ message: "Apply for membership from your portal once you are registered." }) })
        .optional(),
});
exports.BusinessDetails = zod_1.z
    .discriminatedUnion("domain", [exports.HospitalityBusiness, exports.ResidenceBusiness, exports.EnterpriseBusiness])
    .superRefine((value, ctx) => {
    if (value.domain === "enterprise") {
        // Mirrors `orgs_registration_shape`, so the wizard can name the field.
        if (value.registrationKind === "tin" && !value.tin) {
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["tin"], message: "Enter the 9-digit TIN." });
        }
        if (value.registrationKind !== "tin" && value.tin) {
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["tin"], message: "Only give a TIN when you pick TIN." });
        }
        const numbered = exports.NUMBERED_REGISTRATION_KINDS.includes(value.registrationKind);
        if (numbered && !value.registrationNumber) {
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["registrationNumber"], message: "Give the registration number." });
        }
        if (!numbered && value.registrationNumber) {
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["registrationNumber"], message: "Leave this empty for this kind of registration." });
        }
        if (new Set(value.ownerGroups).size !== value.ownerGroups.length) {
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["ownerGroups"], message: "Pick each group once." });
        }
        return;
    }
    // ADR-075 AC-8: a franchise agreement goes with a franchisee's answer, and with nothing else.
    const franchisee = value.domain === "hospitality" && value.franchise?.role === "franchisee";
    value.certificates.forEach((certificate, index) => {
        if (certificate.kind === "franchise_agreement" && !franchisee) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["certificates", index, "kind"],
                message: "A franchise agreement goes with a business that runs another company's brand.",
            });
        }
    });
    if (value.domain !== "hospitality")
        return;
    // ADR-075 D-h: a venue has a kind and no accommodation class; a stay's class is its kind. Mirrors
    // `orgs_domain_shape`, so the wizard can say which field is wrong instead of surfacing a constraint name.
    const kind = (0, business_kind_1.hospitalityKindOf)(value);
    if (kind === null) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["businessKind"],
            message: "Choose what kind of business it is.",
        });
    }
    else if ((0, business_kind_1.isVenueKind)(kind)) {
        if (value.accommodationClass !== undefined && value.businessKind !== undefined) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["accommodationClass"],
                message: "A bar & restaurant or a coffee shop has no accommodation class.",
            });
        }
    }
    else if (value.accommodationClass === undefined) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["accommodationClass"],
            message: "Choose what kind of place it is.",
        });
    }
    else if (value.businessKind !== undefined && value.accommodationClass !== value.businessKind) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["accommodationClass"],
            message: "The accommodation class must be the kind you chose.",
        });
    }
    // Mirrors `orgs_accommodation_class_other_shape`. Enforced here too so the
    // wizard can say which field is wrong instead of surfacing a constraint name.
    const isOther = value.accommodationClass === "other";
    if (isOther && !value.accommodationClassOther) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["accommodationClassOther"],
            message: "Tell us what kind of place this is.",
        });
    }
    if (!isOther && value.accommodationClassOther) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["accommodationClassOther"],
            message: "Only fill this in when you pick Other.",
        });
    }
    // ADR-056 AC-1: a number goes with a Yes, an application with a No.
    if (value.psfMembershipNumber && !value.psfMember) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["psfMembershipNumber"],
            message: "Only give a membership number when you answer Yes.",
        });
    }
    if (value.psfApplication && value.psfMember) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["psfApplication"],
            message: "A business that is already a member does not apply.",
        });
    }
    // ADR-054 AC-R3: no two branch names equal after trimming and ignoring
    // case, the head office included, which is named with the legal name.
    const seen = new Set([branchNameKey(value.legalName)]);
    value.branches.forEach((branch, index) => {
        const key = branchNameKey(branch.name);
        if (seen.has(key)) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["branches", index, "name"],
                message: "Another branch already has this name.",
            });
        }
        seen.add(key);
    });
});
/**
 * The owner an on behalf of registration is made for (FL02).
 *
 * All three are required (owner ruling 2026-09-13, ADR-053 J25). They used to be
 * optional, and each missing one strands the business: no email means no claim
 * invitation is ever sent, and no national id means no claimant can ever match,
 * so the real owner is refused their own business. Exported on its own so the
 * register wizard checks the block with this schema before it leaves the step
 * that asks for it, rather than restating the rule.
 */
exports.IntendedOwner = zod_1.z
    .object({
    name: zod_1.z
        .string({ required_error: "Tell us the owner's full name." })
        .trim()
        .min(2, "Tell us the owner's full name.")
        .max(160, "That name is too long for our records."),
    nationalId: zod_1.z
        .string({
        required_error: "Tell us the owner's National ID. It is how we match them when they claim.",
    })
        .trim()
        .min(1, "Tell us the owner's National ID. It is how we match them when they claim.")
        .pipe(exports.RwandanNationalId),
    email: zod_1.z
        .string({
        required_error: "Tell us the owner's email. We send their claim invitation there.",
    })
        .trim()
        .min(1, "Tell us the owner's email. We send their claim invitation there.")
        .email("That email address does not look right."),
});
// ---------------------------------------------------------------------------
// The request
// ---------------------------------------------------------------------------
exports.CreateRegistrationRequest = zod_1.z
    .object({
    role: exports.RegistrantRole,
    capacity: exports.RegistrantCapacity.default("owner"),
    /**
     * Omitted by a returning registrant, whose profile already carries it.
     * Absent is not "skip validation" — the server reads the stored profile and
     * refuses if that is incomplete.
     */
    personal: exports.PersonalDetails.optional(),
    business: exports.BusinessDetails,
    /** Captured when `capacity` is `on_behalf_of`. See `IntendedOwner`. */
    intendedOwner: exports.IntendedOwner.optional(),
})
    .superRefine((value, ctx) => {
    if (value.role !== "broker") {
        const expected = domainForRole(value.role);
        if (value.business.domain !== expected) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["business", "domain"],
                message: `A ${value.role} registers a ${expected} business.`,
            });
        }
    }
    // A PSF business is registered by the person who runs it. The on behalf
    // path exists for agents who list a stranger's hotel, and its claim
    // machinery has nothing to say to a business that lists nothing.
    if (value.role === "enterprise" && value.capacity === "on_behalf_of") {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["capacity"],
            message: "A PSF business is registered by its owner.",
        });
    }
    if (value.capacity === "on_behalf_of" && !value.intendedOwner) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ["intendedOwner"],
            message: "Tell us who you are registering for.",
        });
    }
});
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
exports.RegistrationRejectionReason = zod_1.z.enum([
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
/** What the registrant is told to go and fix. Ordered as the wizard's steps. */
exports.REJECTION_REASON_LABEL = {
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
function stepForRejectionReason(reason) {
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
exports.RegistrationReviewStage = zod_1.z.enum([
    "tin_verified",
    "field_verified",
]);
exports.RegistrationReviewDecision = zod_1.z.enum(["passed", "rejected"]);
/** One recorded decision, as the registrant and the console both read it. */
exports.RegistrationReview = zod_1.z.object({
    stage: exports.RegistrationReviewStage,
    decision: exports.RegistrationReviewDecision,
    oversightRole: primitives_1.OversightRole,
    /** The body and title AS OF the decision, never re-resolved (F-S03 §9). */
    governmentBodyCode: zod_1.z.string(),
    governmentTitle: zod_1.z.string().nullable(),
    reasonCode: exports.RegistrationRejectionReason.nullable(),
    notes: zod_1.z.string().nullable(),
    decidedAt: zod_1.z.string(),
});
/** Passing a gate. Notes are optional: a clean pass rarely needs prose. */
exports.PassGateRequest = zod_1.z.object({
    notes: zod_1.z.string().trim().max(2000).optional(),
});
/** Refusing at a gate. The reason is required; that is the whole point. */
exports.RejectRegistrationRequest = zod_1.z.object({
    reasonCode: exports.RegistrationRejectionReason,
    notes: zod_1.z.string().trim().max(2000).optional(),
});
/**
 * A document a business uploaded with its registration, as an officer sees it.
 *
 * F-S03 §5 gives the field verifier two jobs — confirm the premises exist, and
 * confirm the documents are legitimate — and only the first was ever reachable:
 * the queue carried no documents at all, so the console drew an empty list and
 * flagged every business as missing them.
 *
 * The bytes are never inlined. `url` is a SHORT LIVED signed link minted per
 * read, and it is null when the certificate carries no object or the object has
 * gone, so a console can say "nothing was uploaded" rather than offer a link
 * that fails.
 */
exports.OversightDocument = zod_1.z.object({
    id: primitives_1.Uuid,
    kind: exports.OrgCertificateKind,
    /** Set only when `kind` is `other`; the database carries the same rule. */
    kindOther: zod_1.z.string().nullable(),
    certificateNumber: zod_1.z.string().nullable(),
    issuedBy: zod_1.z.string().nullable(),
    issuedOn: zod_1.z.string().nullable(),
    expiresOn: zod_1.z.string().nullable(),
    /** Computed against the server's clock, never in the browser. */
    expired: zod_1.z.boolean(),
    mime: zod_1.z.string().nullable(),
    sizeBytes: zod_1.z.number().int().nullable(),
    url: zod_1.z.string().nullable(),
    /** When a field verifier recorded that they had read this document. */
    checkedAt: zod_1.z.string().nullable(),
    checkedByName: zod_1.z.string().nullable(),
});
/**
 * Every document on one registration, for the officer deciding its gate.
 *
 * `uncheckedCount` is what the field verification gate refuses on, so a console
 * can say how many are left instead of only reporting the refusal.
 */
exports.OversightDocumentList = zod_1.z.object({
    orgId: primitives_1.Uuid,
    legalName: zod_1.z.string(),
    status: primitives_1.OrgRegistrationStatus,
    documents: zod_1.z.array(exports.OversightDocument),
    uncheckedCount: zod_1.z.number().int(),
});
/**
 * One business waiting on this officer.
 *
 * Carries the district so a console can group by it, and `waitingSince` so the
 * time-in-stage that F-S03 §5 tracks is visible to the person who can move it,
 * not only to an analyst.
 */
exports.OversightQueueItem = zod_1.z.object({
    orgId: primitives_1.Uuid,
    legalName: zod_1.z.string(),
    domain: primitives_1.Domain,
    accommodationClass: rdb_1.StoredAccommodationClass.nullable(),
    tin: zod_1.z.string().nullable(),
    upi: zod_1.z.string().nullable(),
    districtId: zod_1.z.number().int().nullable(),
    districtName: zod_1.z.string().nullable(),
    sectorName: zod_1.z.string().nullable(),
    addressText: zod_1.z.string().nullable(),
    status: primitives_1.OrgRegistrationStatus,
    waitingSince: zod_1.z.string(),
    /**
     * True when this officer took the field verification and therefore may not
     * approve it. Sent so the console can explain the greyed-out button rather
     * than only refusing the click (separation of duties, F-S03 §9).
     */
    blockedBySeparationOfDuties: zod_1.z.boolean(),
    /**
     * The locations the business declared, head office first then by name
     * (ADR-054 AC-R4). Listed so the officer knows what they approve; no
     * branch district is asked to verify.
     */
    branches: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        districtName: zod_1.z.string().nullable(),
        isHeadOffice: zod_1.z.boolean(),
    })),
    /**
     * How many documents this registration carries, and how many no officer has
     * read yet (F-S03 §5).
     *
     * On the ROW, not only in the file, because the console flags a document gap
     * in the list. It used to flag one whenever fewer than two documents were
     * present in a field the wire never filled, so every business was labelled
     * "Missing documents" — a warning that is on every row is not a warning.
     */
    documentCount: zod_1.z.number().int(),
    uncheckedDocumentCount: zod_1.z.number().int(),
    /**
     * What the registrant declared, sent so the queue stops flagging every
     * hotel "No tourism license" and every file "Missing documents" for want
     * of fields it was never given (registration Phase 0).
     */
    tourismLicenseNumber: zod_1.z.string().nullable(),
    /** Registered by an agent for its owner; payouts stay locked until claimed. */
    onBehalfOf: zod_1.z.boolean(),
    /**
     * The certificates attached, as metadata only: kind and number. The files
     * are not linked here; opening one is a PII read with its own access log.
     */
    certificates: zod_1.z.array(zod_1.z.object({
        kind: zod_1.z.string(),
        kindOther: zod_1.z.string().nullable(),
        certificateNumber: zod_1.z.string().nullable(),
    })),
    /**
     * The latest RRA answer on record, with the side of the seam that gave it,
     * so an officer can tell a register's verdict from a mock's (ADR-060).
     */
    tinCheck: zod_1.z
        .object({
        result: zod_1.z.enum(["pending", "verified", "failed"]),
        adapterMode: zod_1.z.enum(["mock", "live"]),
        checkedAt: zod_1.z.string(),
    })
        .nullable(),
    /** Who registered it, by their verified name where there is one. */
    registrantName: zod_1.z.string().nullable(),
    /** On an on behalf registration, the owner it was registered for. */
    intendedOwnerName: zod_1.z.string().nullable(),
});
/**
 * One decision in an officer's own log: `GET /api/v1/oversight/decisions`
 * (ADR-053, AC-G6).
 *
 * The body and the title are the REVIEW ROW'S OWN COPIES, taken when the
 * decision was recorded, never re joined from the officer's assignment. A
 * revoked or re scoped posting must not rewrite a decision already taken, and
 * this log is the first screen that depends on that.
 */
exports.OversightDecision = zod_1.z.object({
    reviewId: primitives_1.Uuid,
    orgId: primitives_1.Uuid,
    legalName: zod_1.z.string(),
    /** The gate decided: `tin_verified` is field verification, `field_verified` approval. */
    stage: zod_1.z.enum(["tin_verified", "field_verified"]),
    decision: zod_1.z.enum(["passed", "rejected"]),
    /** Who decided it: a PSF District Manager's review is one step that approves (0119). */
    oversightRole: zod_1.z.enum(["business_field_verifier", "business_approver", "psf_membership_officer"]).optional(),
    reasonCode: exports.RegistrationRejectionReason.nullable(),
    notes: zod_1.z.string().nullable(),
    governmentBodyCode: zod_1.z.string(),
    governmentTitle: zod_1.z.string().nullable(),
    decidedAt: zod_1.z.string(),
});
/** A page of the log, newest first. `nextCursor` is null on the last page. */
exports.OversightDecisionPage = zod_1.z.object({
    items: exports.OversightDecision.array(),
    nextCursor: zod_1.z.string().nullable(),
});
/** The page to read. No cursor is the newest page; a malformed one is too. */
exports.OversightDecisionQuery = zod_1.z.object({
    cursor: zod_1.z.string().trim().max(200).optional(),
});
// ---------------------------------------------------------------------------
// The response
// ---------------------------------------------------------------------------
/** What the pending workspace renders: the stage, and what is owed. */
exports.RegistrationSummary = zod_1.z.object({
    orgId: primitives_1.Uuid,
    workspaceId: primitives_1.Uuid,
    legalName: zod_1.z.string(),
    domain: primitives_1.Domain,
    /**
     * What kind of business it is (ADR-075 D-h): the noun the register's heading and status page say.
     * Null for a PSF business (`enterprise`), which is not a place.
     */
    businessKind: business_kind_1.BusinessKind.nullable(),
    accommodationClass: rdb_1.StoredAccommodationClass.nullable(),
    status: primitives_1.OrgRegistrationStatus,
    /** Set only while `status` is `pending_payment`. */
    amountDueRwf: primitives_1.RwfAmount.nullable(),
    /** The invoice to settle, when one is outstanding. */
    invoiceId: primitives_1.Uuid.nullable(),
    /** Reason code from the rejecting stage, when `status` is `rejected`. */
    rejectionReason: exports.RegistrationRejectionReason.nullable(),
    /** The reviewing officer's own words, when they left any. */
    rejectionNotes: zod_1.z.string().nullable(),
    submittedAt: zod_1.z.string().nullable(),
    /**
     * The operator contract a business accepted before paying, and when (ADR-053, AC-R8), kept readable for the
     * businesses that did. ADR-075 removed that step: a registration made since carries neither, and its
     * agreement is signed after approval (A3).
     */
    contractVersion: zod_1.z.string().nullable(),
    contractAcceptedAt: zod_1.z.string().nullable(),
    /**
     * Whether payouts wait on the owner's identity being verified (ADR-053,
     * AC-R1). Null for a business nobody registered on behalf of anyone else.
     */
    payoutLocked: zod_1.z.boolean().nullable(),
    /**
     * The business's code, its district's letters and a number (`KIC0001`),
     * given when the registration fee is paid. Null until then. Optional on the
     * wire so a client still parses a summary from an API built before it.
     */
    businessCode: zod_1.z.string().nullable().default(null),
});
/**
 * The operator contract's version: the date its terms last changed (ADR-053).
 *
 * The document is rendered from code, so the version lives in code too. A
 * version stored anywhere else can drift from the document it names. Change
 * this in the same commit as the clause copy, and only then.
 */
exports.OPERATOR_CONTRACT_VERSION = "2026-09-12";
// The wizard's draft moved to `registration-draft.ts` (ADR-075 S9), beside the checks the server writes for it.
/**
 * Why a registrant action was refused, sent as `code` on the error body so a page can word the refusal without
 * matching on English. The contract codes went with the contract before payment (ADR-075, AC-12).
 */
exports.RegistrationConflictCode = zod_1.z.enum([
    /** 403: registering a business needs a verified identity here (ADR-060). */
    "identity_not_verified",
]);
// ---------------------------------------------------------------------------
// The TIN pre-check (registration Phase 0)
// ---------------------------------------------------------------------------
/**
 * `POST /api/v1/registrations/tin-check`. Asked at the Business step, before
 * anything is created or billed, so a TIN RRA will refuse is found while the
 * registrant can still change it rather than after a non-refundable fee.
 */
exports.TinCheckRequest = zod_1.z.object({
    tin: exports.Tin,
    /**
     * Who is asking (ADR-075 AC-7). The directors' NAMES come back only for the
     * helper ("For the owner"), who picks the owner from them. On the owner path
     * they do not: the name matched there may be typed, and showing the names
     * first would let anyone type one. The owner learns only listed or not.
     */
    capacity: exports.RegistrantCapacity.optional(),
});
/**
 * A business as the company register states it (ADR-060). Directors are NAMES
 * only: their document numbers stay on the server, which compares them.
 */
exports.RegistryBusiness = zod_1.z.object({
    legalName: zod_1.z.string().min(1),
    /** `YYYY-MM-DD`, when the register gives one. */
    registeredOn: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    companyType: exports.PsfCompanyType.nullable(),
    /** The registered address, as geography ids the picker can take directly. */
    address: zod_1.z
        .object({
        provinceId: zod_1.z.number().int(),
        districtId: zod_1.z.number().int(),
        sectorId: zod_1.z.number().int(),
        street: zod_1.z.string().nullable(),
    })
        .nullable(),
    /** Empty unless the request named the helper capacity (ADR-075 AC-7). */
    directors: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string().min(1) })),
    /** True when a MOCK adapter made this business up. */
    generated: zod_1.z.boolean(),
});
/**
 * - `verified`: RRA knows the TIN.
 * - `failed`: RRA does not; registration with it is refused.
 * - `taken`: another business on Injishi already holds it.
 * - `pending`: RRA could not be reached. Not a refusal: the check runs again
 *   after payment, exactly as it did before this pre-check existed.
 */
exports.TinCheckResult = zod_1.z.object({
    tin: zod_1.z.string(),
    result: zod_1.z.enum(["verified", "failed", "taken", "pending"]),
    message: zod_1.z.string(),
    /**
     * The business as the register holds it (ADR-060), or null when the
     * register returned no details. The Business step fills itself from this
     * and locks the legal name; `create` refuses a legal name that disagrees.
     */
    business: exports.RegistryBusiness.nullable(),
    /**
     * Whether the caller's own document, scanned or typed, is among the
     * directors. Null when the register lists no directors, or the caller holds
     * no document yet. `false` is what moves a registrant to the on behalf
     * path. The wizard's answer is never the record: create matches again.
     */
    registrantIsDirector: zod_1.z.boolean().nullable(),
});
// ---------------------------------------------------------------------------
// The owner claim (FL02, ADR-053)
// ---------------------------------------------------------------------------
/**
 * `POST /api/v1/orgs/:orgId/claim/preview` and `/claim`. The token from the
 * invitation mail, in the body so it never lands in the API's access log.
 */
exports.ClaimOrgRequest = zod_1.z.object({
    token: zod_1.z.string().trim().min(1).max(200),
});
/**
 * What `/claim-org` shows before the owner commits.
 *
 * Only what the invitation mail already told whoever holds the token: the
 * business, where it is, where it got to and who registered it. Never the
 * national id, an email or the TIN.
 */
exports.ClaimPreview = zod_1.z.object({
    orgId: primitives_1.Uuid,
    legalName: zod_1.z.string(),
    districtName: zod_1.z.string().nullable(),
    registrationStatus: primitives_1.OrgRegistrationStatus,
    registrantName: zod_1.z.string().nullable(),
});
/** The fee a registrant is quoted, read from the effective-dated catalog. */
exports.RegistrationFeeQuote = zod_1.z.object({
    businessType: exports.RegistrationBusinessType,
    amountRwf: primitives_1.RwfAmount,
    currency: zod_1.z.literal("RWF"),
});
// ---------------------------------------------------------------------------
// Paying the fee — POST /api/v1/registrations/:id/pay (073-gtbank-payments AC-16)
// ---------------------------------------------------------------------------
/**
 * One press of pay. Both fields are optional because the fee settles free
 * while payments are off (call 9), and then there is nothing to prompt; when
 * money is taken, the server refuses a body missing either with a 422.
 */
exports.RegistrationPayRequest = zod_1.z.object({
    /** Minted once per press and reused on every retry of that press. */
    attemptToken: primitives_1.Uuid.optional(),
    /** The registrant's mobile money number. A card is refused. */
    instrument: booking_1.PaymentInstrument.optional(),
});
/** A fee payment waiting on the registrant's handset, as the wizard watches it. */
exports.RegistrationFeeAttemptStatus = zod_1.z.object({
    attemptToken: zod_1.z.string(),
    state: booking_1.PaymentAttemptState,
    network: booking_1.MobileMoneyNetwork.nullable(),
    /** Masked: enough to recognise, never enough to charge. */
    payerMasked: zod_1.z.string().nullable(),
    amountRwf: primitives_1.RwfAmount.nullable(),
    expiresAt: zod_1.z.string(),
    failureReason: zod_1.z.string().nullable(),
    /** The registration as it stands now: `submitted` once the fee settled. */
    registration: exports.RegistrationSummary,
});
/**
 * What the pay press answers: settled at once (the free path, or an
 * instrument that settled inside the call), or an attempt to wait on.
 */
exports.RegistrationPayResult = zod_1.z.discriminatedUnion("kind", [
    zod_1.z.object({ kind: zod_1.z.literal("settled"), registration: exports.RegistrationSummary }),
    zod_1.z.object({ kind: zod_1.z.literal("attempt"), attempt: exports.RegistrationFeeAttemptStatus }),
]);
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
exports.MyProfileDocument = zod_1.z.object({
    documentType: exports.AccountDocumentType,
    /** Last four characters, prefixed with a bullet run, e.g. `••••1234`. */
    documentNumberMasked: zod_1.z.string(),
    issuingCountry: exports.CountryCode,
});
exports.MyProfile = zod_1.z.object({
    fullName: zod_1.z.string().nullable(),
    gender: exports.Gender.nullable(),
    dateOfBirth: zod_1.z.string().nullable(),
    phoneE164: zod_1.z.string().nullable(),
    document: exports.MyProfileDocument.nullable(),
    address: exports.Address.nullable(),
    /**
     * Whether Step 1 is answered well enough to register a business.
     *
     * Served rather than re-derived in the browser: the rule differs by country
     * (a Rwandan profile owes its district and sector, an international one does
     * not), and two copies of that rule is one copy too many.
     */
    complete: zod_1.z.boolean(),
});
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
exports.CreateBrokerRegistrationRequest = zod_1.z.object({
    personal: exports.PersonalDetails.optional(),
    /** The district the broker works in: the free plan shows the homes there (2026-10-25). */
    homeDistrictId: zod_1.z.number({ required_error: "Choose the district you work in.", invalid_type_error: "Choose the district you work in." }).int().positive("Choose the district you work in."),
    /** The registration fee, paid first by mobile money (`POST /registrations/broker/fee`). */
    feePaymentId: primitives_1.Uuid,
});
/** A broker's own status. Two values, and no government pipeline (F-R09 §8). */
exports.BrokerStatus = zod_1.z.enum(["active", "suspended"]);
/**
 * What a completed broker registration hands back.
 *
 * Deliberately NOT a `RegistrationSummary`. That shape is the org pipeline —
 * six statuses, a fee, an invoice, a rejection reason — and a broker passes
 * through none of it. Reusing it would mean six fields that are null by
 * construction and a status enum that can never hold the value it is showing.
 */
exports.BrokerRegistrationSummary = zod_1.z.object({
    brokerId: primitives_1.Uuid,
    workspaceId: primitives_1.Uuid,
    name: zod_1.z.string(),
    status: exports.BrokerStatus,
});
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
exports.UploadedObject = zod_1.z.object({
    objectKey: zod_1.z.string().min(1),
    kind: zod_1.z.literal("certificate"),
    mime: zod_1.z.string(),
    sizeBytes: zod_1.z.number().int().nonnegative(),
    filename: zod_1.z.string(),
});
/** Every kind `org_certificates.kind` accepts, worded for a list of what was sent. */
exports.CERTIFICATE_KIND_LABEL = {
    rdb_grade: "RDB grade certificate",
    tourism_license: "Tourism licence",
    tax_clearance: "Tax clearance certificate",
    fire_safety: "Fire safety certificate",
    health_inspection: "Health inspection certificate",
    other: "Another document",
    rdb_certificate: "RDB certificate",
    psf_certificate: "PSF certificate",
    land_title: "Land title",
    franchise_agreement: "Franchise agreement",
};
//# sourceMappingURL=registration.js.map