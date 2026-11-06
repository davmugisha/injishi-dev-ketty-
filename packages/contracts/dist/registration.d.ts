import { z } from "zod";
import { Domain } from "./primitives";
/**
 * Business registration (F-S03 / FL01), governed by D20, D23 and D24.
 *
 * The wire shapes for the wizard and for the pipeline that carries a
 * registration from `pending_payment` to `active`. Validation lives here rather
 * than in the form so the browser and the server refuse the same input for the
 * same reason — a client-side check is an affordance, never the control.
 */
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
export declare const RegistrantRole: z.ZodEnum<["host", "landlord", "broker", "enterprise"]>;
export type RegistrantRole = z.infer<typeof RegistrantRole>;
/** The four rows `registration_fees` is keyed by (schema §8.3a). */
export declare const RegistrationBusinessType: z.ZodEnum<["hospitality", "residence", "broker", "enterprise"]>;
export type RegistrationBusinessType = z.infer<typeof RegistrationBusinessType>;
/** A registrant's answer maps onto exactly one fee row and one domain. */
export declare function businessTypeFor(role: RegistrantRole): RegistrationBusinessType;
/** The domain a registrant's role registers, for the three roles that create an org. */
export declare function domainForRole(role: Exclude<RegistrantRole, "broker">): Domain;
/** Whether this registrant is the owner, or acting for one (OBO, FL02). */
export declare const RegistrantCapacity: z.ZodEnum<["owner", "on_behalf_of"]>;
export type RegistrantCapacity = z.infer<typeof RegistrantCapacity>;
export declare const Gender: z.ZodEnum<["female", "male", "other", "prefer_not_to_say"]>;
export type Gender = z.infer<typeof Gender>;
/**
 * The two document types that may anchor an ACCOUNT.
 *
 * Narrower than the shared `DocumentType` primitive on purpose: that enum keeps
 * `other` for walk-in stay capture, and the database enforces the same
 * narrowing with a CHECK on `identity_documents`.
 */
export declare const AccountDocumentType: z.ZodEnum<["national_id", "passport"]>;
export type AccountDocumentType = z.infer<typeof AccountDocumentType>;
/** ISO-3166-1 alpha-2, upper case. `RW` is the address discriminator (D24). */
export declare const CountryCode: z.ZodEffects<z.ZodString, string, string>;
export type CountryCode = z.infer<typeof CountryCode>;
/**
 * Rwandan National ID: 16 digits, commonly written in spaced groups.
 *
 * Spaces are stripped before checking, because the field is displayed grouped
 * and a person who types what they see should not be told they are wrong. The
 * stored value is the bare digits.
 */
export declare const RwandanNationalId: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
/**
 * Passport number. Deliberately loose: issuing states disagree on length and
 * alphabet, and rejecting a valid foreign passport is worse than accepting a
 * typo that the verifier will catch against the document itself.
 */
export declare const PassportNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
/** The identity document a registrant presents, validated per type. */
export declare const IdentityDocumentInput: z.ZodDiscriminatedUnion<"documentType", [z.ZodObject<{
    documentType: z.ZodLiteral<"national_id">;
    documentNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    /** A Rwandan NID is Rwandan by definition; kept explicit for the row. */
    issuingCountry: z.ZodDefault<z.ZodLiteral<"RW">>;
}, "strip", z.ZodTypeAny, {
    documentType: "national_id";
    documentNumber: string;
    issuingCountry: "RW";
}, {
    documentType: "national_id";
    documentNumber: string;
    issuingCountry?: "RW" | undefined;
}>, z.ZodObject<{
    documentType: z.ZodLiteral<"passport">;
    documentNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    issuingCountry: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    documentType: "passport";
    documentNumber: string;
    issuingCountry: string;
}, {
    documentType: "passport";
    documentNumber: string;
    issuingCountry: string;
}>]>;
export type IdentityDocumentInput = z.infer<typeof IdentityDocumentInput>;
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
export declare const RwandanAddress: z.ZodObject<{
    country: z.ZodLiteral<"RW">;
    provinceId: z.ZodNumber;
    districtId: z.ZodNumber;
    sectorId: z.ZodNumber;
    /** Fourth level. Collected to drive the village picker, never stored. */
    cellId: z.ZodOptional<z.ZodNumber>;
    /** Fifth level, and the finest one. Stored; see `orgs.village_id`. */
    villageId: z.ZodOptional<z.ZodNumber>;
    /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
    street: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    country: "RW";
    provinceId: number;
    districtId: number;
    sectorId: number;
    cellId?: number | undefined;
    villageId?: number | undefined;
    street?: string | undefined;
}, {
    country: "RW";
    provinceId: number;
    districtId: number;
    sectorId: number;
    cellId?: number | undefined;
    villageId?: number | undefined;
    street?: string | undefined;
}>;
export type RwandanAddress = z.infer<typeof RwandanAddress>;
export declare const InternationalAddress: z.ZodObject<{
    country: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    /** The whole address as written locally. Formats differ too much to split. */
    addressText: z.ZodString;
}, "strip", z.ZodTypeAny, {
    country: string;
    addressText: string;
}, {
    country: string;
    addressText: string;
}>;
export type InternationalAddress = z.infer<typeof InternationalAddress>;
export declare const Address: z.ZodUnion<[z.ZodObject<{
    country: z.ZodLiteral<"RW">;
    provinceId: z.ZodNumber;
    districtId: z.ZodNumber;
    sectorId: z.ZodNumber;
    /** Fourth level. Collected to drive the village picker, never stored. */
    cellId: z.ZodOptional<z.ZodNumber>;
    /** Fifth level, and the finest one. Stored; see `orgs.village_id`. */
    villageId: z.ZodOptional<z.ZodNumber>;
    /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
    street: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    country: "RW";
    provinceId: number;
    districtId: number;
    sectorId: number;
    cellId?: number | undefined;
    villageId?: number | undefined;
    street?: string | undefined;
}, {
    country: "RW";
    provinceId: number;
    districtId: number;
    sectorId: number;
    cellId?: number | undefined;
    villageId?: number | undefined;
    street?: string | undefined;
}>, z.ZodObject<{
    country: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    /** The whole address as written locally. Formats differ too much to split. */
    addressText: z.ZodString;
}, "strip", z.ZodTypeAny, {
    country: string;
    addressText: string;
}, {
    country: string;
    addressText: string;
}>]>;
export type Address = z.infer<typeof Address>;
/** Narrowing helper both sides use rather than re-testing the discriminator. */
export declare function isRwandanAddress(address: Address): address is RwandanAddress;
/** RRA Tax Identification Number: 9 digits, often written in groups of three. */
export declare const Tin: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
/**
 * Unique Parcel Identifier. Five slash-separated numeric parts, e.g.
 * `1/03/07/02/1234`. Accepted with or without spaces around the separators.
 */
export declare const Upi: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
export declare const PersonalDetails: z.ZodObject<{
    /** As written on the identity document. */
    fullName: z.ZodString;
    /**
     * Absent only when the person's identity is already VERIFIED (ADR-060): the
     * server then keeps the verified document, whose full number the browser
     * never holds again after a reload. For anyone unverified the server
     * refuses its absence at this path.
     */
    document: z.ZodOptional<z.ZodDiscriminatedUnion<"documentType", [z.ZodObject<{
        documentType: z.ZodLiteral<"national_id">;
        documentNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        /** A Rwandan NID is Rwandan by definition; kept explicit for the row. */
        issuingCountry: z.ZodDefault<z.ZodLiteral<"RW">>;
    }, "strip", z.ZodTypeAny, {
        documentType: "national_id";
        documentNumber: string;
        issuingCountry: "RW";
    }, {
        documentType: "national_id";
        documentNumber: string;
        issuingCountry?: "RW" | undefined;
    }>, z.ZodObject<{
        documentType: z.ZodLiteral<"passport">;
        documentNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        issuingCountry: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        documentType: "passport";
        documentNumber: string;
        issuingCountry: string;
    }, {
        documentType: "passport";
        documentNumber: string;
        issuingCountry: string;
    }>]>>;
    gender: z.ZodOptional<z.ZodEnum<["female", "male", "other", "prefer_not_to_say"]>>;
    /** ISO date. Bounds are sanity rails, not a policy on who may register. */
    dateOfBirth: z.ZodEffects<z.ZodString, string, string>;
    phoneE164: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    address: z.ZodUnion<[z.ZodObject<{
        country: z.ZodLiteral<"RW">;
        provinceId: z.ZodNumber;
        districtId: z.ZodNumber;
        sectorId: z.ZodNumber;
        /** Fourth level. Collected to drive the village picker, never stored. */
        cellId: z.ZodOptional<z.ZodNumber>;
        /** Fifth level, and the finest one. Stored; see `orgs.village_id`. */
        villageId: z.ZodOptional<z.ZodNumber>;
        /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
        street: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    }, {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    }>, z.ZodObject<{
        country: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        /** The whole address as written locally. Formats differ too much to split. */
        addressText: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        country: string;
        addressText: string;
    }, {
        country: string;
        addressText: string;
    }>]>;
}, "strip", z.ZodTypeAny, {
    fullName: string;
    dateOfBirth: string;
    phoneE164: string;
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    } | {
        country: string;
        addressText: string;
    };
    document?: {
        documentType: "national_id";
        documentNumber: string;
        issuingCountry: "RW";
    } | {
        documentType: "passport";
        documentNumber: string;
        issuingCountry: string;
    } | undefined;
    gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
}, {
    fullName: string;
    dateOfBirth: string;
    phoneE164: string;
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    } | {
        country: string;
        addressText: string;
    };
    document?: {
        documentType: "national_id";
        documentNumber: string;
        issuingCountry?: "RW" | undefined;
    } | {
        documentType: "passport";
        documentNumber: string;
        issuingCountry: string;
    } | undefined;
    gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
}>;
export type PersonalDetails = z.infer<typeof PersonalDetails>;
/** A certificate the registrant attaches (schema §4.3a). */
/**
 * The kinds of document a business uploads about itself (`org_certificate_kind`).
 *
 * One name for the set, because two readers need it: the registration wizard
 * sending an upload, and the officer's console listing what was sent. Two
 * copies of an enum is how a kind gets added in one place and not the other.
 */
export declare const OrgCertificateKind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other", "rdb_certificate", "psf_certificate", "land_title", "franchise_agreement"]>;
export type OrgCertificateKind = z.infer<typeof OrgCertificateKind>;
/** What each kind is called on screen, wherever a document is listed. */
export declare const ORG_CERTIFICATE_KIND_LABEL: Readonly<Record<OrgCertificateKind, string>>;
export declare const CertificateInput: z.ZodObject<{
    kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other", "rdb_certificate", "psf_certificate", "land_title", "franchise_agreement"]>;
    /** Required when `kind` is `other`; the database carries the same rule. */
    kindOther: z.ZodOptional<z.ZodString>;
    /** Key of an already-uploaded `stored_objects` row (F-S09). */
    objectKey: z.ZodString;
    certificateNumber: z.ZodOptional<z.ZodString>;
    issuedBy: z.ZodOptional<z.ZodString>;
    issuedOn: z.ZodOptional<z.ZodString>;
    expiresOn: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
    objectKey: string;
    kindOther?: string | undefined;
    certificateNumber?: string | undefined;
    issuedBy?: string | undefined;
    issuedOn?: string | undefined;
    expiresOn?: string | undefined;
}, {
    kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
    objectKey: string;
    kindOther?: string | undefined;
    certificateNumber?: string | undefined;
    issuedBy?: string | undefined;
    issuedOn?: string | undefined;
    expiresOn?: string | undefined;
}>;
export type CertificateInput = z.infer<typeof CertificateInput>;
/**
 * How many branches a registration may declare beyond its head office (ADR-054).
 * The schema and the wizard's Branches step both read this one constant.
 */
export declare const MAX_REGISTRATION_BRANCHES = 20;
/**
 * One more location of a hospitality business, declared under the same TIN
 * (ADR-054 AC-R1). The head office is NOT one of these: it is the business
 * itself, named with its legal name at its own address.
 */
export declare const RegistrationBranch: z.ZodObject<{
    name: z.ZodString;
    address: z.ZodObject<{
        country: z.ZodLiteral<"RW">;
        provinceId: z.ZodNumber;
        districtId: z.ZodNumber;
        sectorId: z.ZodNumber;
        /** Fourth level. Collected to drive the village picker, never stored. */
        cellId: z.ZodOptional<z.ZodNumber>;
        /** Fifth level, and the finest one. Stored; see `orgs.village_id`. */
        villageId: z.ZodOptional<z.ZodNumber>;
        /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
        street: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    }, {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    name: string;
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    };
}, {
    name: string;
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    };
}>;
export type RegistrationBranch = z.infer<typeof RegistrationBranch>;
/** The comparison two branch names are equal under: trimmed, case ignored. */
export declare function branchNameKey(name: string): string;
/**
 * The input lives here, beside the rest of what a registration can carry,
 * because `HospitalityBusiness` embeds it and it reuses this file's ID, phone
 * and country rules. `psf.ts` holds everything else about PSF membership and
 * imports from here, never the other way round.
 */
/** PSF's form, "Company type", as printed. */
export declare const PsfCompanyType: z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>;
export type PsfCompanyType = z.infer<typeof PsfCompanyType>;
/** PSF's form, "Ownership", as printed. `other` carries a text. */
export declare const PsfOwnership: z.ZodEnum<["rwandan_100", "foreign_100", "franchise", "joint_venture", "foreign_representative", "other"]>;
export type PsfOwnership = z.infer<typeof PsfOwnership>;
export declare const PsfTradeDirection: z.ZodEnum<["none", "export", "import", "both"]>;
export type PsfTradeDirection = z.infer<typeof PsfTradeDirection>;
/** PSF's form, "Role/Function", as printed. */
export declare const PsfContactRole: z.ZodEnum<["owner", "managing_director", "ceo", "chairman"]>;
export type PsfContactRole = z.infer<typeof PsfContactRole>;
/**
 * PSF's form knows two genders. This never changes the person's own profile,
 * which keeps all four answers (ADR-056 AC-4).
 */
export declare const PsfGender: z.ZodEnum<["male", "female"]>;
export type PsfGender = z.infer<typeof PsfGender>;
/**
 * The version of the consent text the applicant ticked. Bump it whenever the
 * wording in `PSF_CONSENT_TEXT` changes, so every stored consent names the
 * words it agreed to.
 */
export declare const PSF_CONSENT_VERSION = "2026-09-27";
/** What the consent box says. Rendered verbatim by every surface that asks. */
export declare const PSF_CONSENT_TEXT: string;
/**
 * One PSF membership application, as the wizard or the workspace sends it.
 *
 * The registration type and number are NOT inputs: the server copies the TIN
 * from the business, which is what makes AC-3's "not editable" true on the
 * wire and not only on the screen.
 */
/** The ID a PSF application names its contact by. */
export declare const PsfIdDocument: z.ZodDiscriminatedUnion<"documentType", [z.ZodObject<{
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
export type PsfIdDocument = z.infer<typeof PsfIdDocument>;
export declare const PsfApplicationInput: z.ZodEffects<z.ZodObject<{
    requestedTierCode: z.ZodString;
    /**
     * What the business will pay a year, inside the band it picked. A business
     * pays what it can afford within its tier, so the amount is its own answer.
     * Required for every tier except one PSF prices itself; the server checks it
     * against the tier (`psfTierAcceptsFee`), which only the server reads.
     */
    declaredFeeRwf: z.ZodOptional<z.ZodEffects<z.ZodNumber, number, number>>;
    /**
     * Who the business is, and where (2026-11-03): absent from Injishi's registration, which already
     * names the business and places it, so the server copies them from there.
     */
    companyName: z.ZodOptional<z.ZodString>;
    streetAddress: z.ZodOptional<z.ZodString>;
    /**
     * Its sector, kind of business and association, as the PSF form asks them (2026-11-03). Absent: a
     * hotel is filed under PSF's hospitality association.
     */
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
    /**
     * The contact person (2026-11-03): each is absent when the person already gave it on You, and the
     * server copies it from their profile. Gender is asked here only when You holds neither of the two
     * PSF's form knows.
     */
    contactRole: z.ZodOptional<z.ZodEnum<["owner", "managing_director", "ceo", "chairman"]>>;
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodEnum<["male", "female"]>>;
    phoneE164: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
    email: z.ZodOptional<z.ZodString>;
    /** Absent only when `useDocumentOnFile` asks the server for it instead. */
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
    /**
     * "Use the document on my profile" (registration Phase 0). The profile read
     * masks the number, so a returning registrant could only retype it; with
     * this the server copies the full number from the profile it holds, and the
     * browser never sees it.
     */
    useDocumentOnFile: z.ZodOptional<z.ZodLiteral<true>>;
    dateOfBirth: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    /** Must be ticked: an unticked box and a Yes are different acts (AC-5). */
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
export type PsfApplicationInput = z.infer<typeof PsfApplicationInput>;
/**
 * The owners PSF's Specialized cluster speaks for: women, young people and
 * people with disabilities. A marker on a business of ANY sector, never a
 * sector of its own, because a factory a woman owns is still a factory.
 */
export declare const PsfOwnerGroup: z.ZodEnum<["women", "youth", "pwd"]>;
export type PsfOwnerGroup = z.infer<typeof PsfOwnerGroup>;
/**
 * How a PSF business is registered, when it says so. A TIN is optional on this
 * path: a cooperative is registered with RCA, an NGO with RGB, and the smallest
 * businesses PSF wants are often registered nowhere yet. `tin` is checked with
 * RRA like every other TIN; the others are recorded as given, and the PSF
 * officer reads them.
 */
export declare const EnterpriseRegistrationKind: z.ZodEnum<["tin", "rca", "rgb", "other", "none"]>;
export type EnterpriseRegistrationKind = z.infer<typeof EnterpriseRegistrationKind>;
/** The kinds that carry a number other than a TIN. */
export declare const NUMBERED_REGISTRATION_KINDS: readonly EnterpriseRegistrationKind[];
/** The membership number a business that answered Yes may give (ADR-056 AC-1). */
export declare const PsfMembershipNumber: z.ZodString;
/**
 * Whether the business is part of a franchise (ADR-075 O-7, AC-8). No block
 * means No, as no `org_franchises` row does. A franchisee runs another
 * company's brand and names that company; a franchisor owns the brand and says
 * how many locations run under it. The franchisee's agreement, when it has one
 * to hand, is a `franchise_agreement` document on the Documents step.
 */
export declare const FranchiseRole: z.ZodEnum<["franchisee", "franchisor"]>;
export type FranchiseRole = z.infer<typeof FranchiseRole>;
export declare const FranchiseDeclaration: z.ZodDiscriminatedUnion<"role", [z.ZodObject<{
    role: z.ZodLiteral<"franchisee">;
    brandName: z.ZodString;
    franchisorLegalName: z.ZodString;
    franchisorCountry: z.ZodPipeline<z.ZodString, z.ZodEffects<z.ZodString, string, string>>;
}, "strict", z.ZodTypeAny, {
    role: "franchisee";
    brandName: string;
    franchisorLegalName: string;
    franchisorCountry: string;
}, {
    role: "franchisee";
    brandName: string;
    franchisorLegalName: string;
    franchisorCountry: string;
}>, z.ZodObject<{
    role: z.ZodLiteral<"franchisor">;
    brandName: z.ZodString;
    franchisedLocations: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    role: "franchisor";
    brandName: string;
    franchisedLocations: number;
}, {
    role: "franchisor";
    brandName: string;
    franchisedLocations: number;
}>]>;
export type FranchiseDeclaration = z.infer<typeof FranchiseDeclaration>;
/**
 * A hospitality business. Carries a TIN, never a UPI-only identity, and is the
 * only branch that may hold a tourism licence, a grade, or a PSF membership.
 */
export declare const HospitalityBusiness: z.ZodObject<{
    legalName: z.ZodString;
    address: z.ZodObject<{
        country: z.ZodLiteral<"RW">;
        provinceId: z.ZodNumber;
        districtId: z.ZodNumber;
        sectorId: z.ZodNumber;
        /** Fourth level. Collected to drive the village picker, never stored. */
        cellId: z.ZodOptional<z.ZodNumber>;
        /** Fifth level, and the finest one. Stored; see `orgs.village_id`. */
        villageId: z.ZodOptional<z.ZodNumber>;
        /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
        street: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    }, {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    }>;
    certificates: z.ZodDefault<z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other", "rdb_certificate", "psf_certificate", "land_title", "franchise_agreement"]>;
        /** Required when `kind` is `other`; the database carries the same rule. */
        kindOther: z.ZodOptional<z.ZodString>;
        /** Key of an already-uploaded `stored_objects` row (F-S09). */
        objectKey: z.ZodString;
        certificateNumber: z.ZodOptional<z.ZodString>;
        issuedBy: z.ZodOptional<z.ZodString>;
        issuedOn: z.ZodOptional<z.ZodString>;
        expiresOn: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }, {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }>, "many">>;
} & {
    domain: z.ZodLiteral<"hospitality">;
    entityGroup: z.ZodDefault<z.ZodEnum<["accommodation", "restaurant_bar_nightclub", "travel_services", "tourism_information_center", "cultural_tourism"]>>;
    /**
     * What kind of business it is (ADR-075 D-h, AC-31). A stay's kind is its accommodation class; a venue (Bar &
     * Restaurant, Coffee Shop) has a kind and no class. Optional only so a request built before ADR-075 still
     * reads: its kind is then derived from the class (`hospitalityKindOf`).
     */
    businessKind: z.ZodOptional<z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other", "bar_restaurant", "coffee_shop"]>>;
    /** A stay's RDB class. Required for a stay, forbidden for a venue, which has no rooms (ADR-075 O-14). */
    accommodationClass: z.ZodOptional<z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other"]>>;
    /** Required when the class is `other`, forbidden otherwise (D24). */
    accommodationClassOther: z.ZodOptional<z.ZodString>;
    tin: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    upi: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
    tourismLicenseNumber: z.ZodOptional<z.ZodString>;
    chamberOfTourismMember: z.ZodDefault<z.ZodBoolean>;
    /** Optional, and hospitality only. Not the PSF oversight body (D24). */
    psfMember: z.ZodDefault<z.ZodBoolean>;
    /**
     * A Yes may carry the PSF membership number; nobody checks it (ADR-056
     * AC-7). Forbidden with a No (see `BusinessDetails`).
     */
    psfMembershipNumber: z.ZodOptional<z.ZodString>;
    /**
     * A No may carry an application to join (ADR-056 AC-6), written in the
     * same transaction as the business. Forbidden with a Yes.
     */
    psfApplication: z.ZodOptional<z.ZodEffects<z.ZodObject<{
        requestedTierCode: z.ZodString;
        /**
         * What the business will pay a year, inside the band it picked. A business
         * pays what it can afford within its tier, so the amount is its own answer.
         * Required for every tier except one PSF prices itself; the server checks it
         * against the tier (`psfTierAcceptsFee`), which only the server reads.
         */
        declaredFeeRwf: z.ZodOptional<z.ZodEffects<z.ZodNumber, number, number>>;
        /**
         * Who the business is, and where (2026-11-03): absent from Injishi's registration, which already
         * names the business and places it, so the server copies them from there.
         */
        companyName: z.ZodOptional<z.ZodString>;
        streetAddress: z.ZodOptional<z.ZodString>;
        /**
         * Its sector, kind of business and association, as the PSF form asks them (2026-11-03). Absent: a
         * hotel is filed under PSF's hospitality association.
         */
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
        /**
         * The contact person (2026-11-03): each is absent when the person already gave it on You, and the
         * server copies it from their profile. Gender is asked here only when You holds neither of the two
         * PSF's form knows.
         */
        contactRole: z.ZodOptional<z.ZodEnum<["owner", "managing_director", "ceo", "chairman"]>>;
        firstName: z.ZodOptional<z.ZodString>;
        lastName: z.ZodOptional<z.ZodString>;
        gender: z.ZodOptional<z.ZodEnum<["male", "female"]>>;
        phoneE164: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
        email: z.ZodOptional<z.ZodString>;
        /** Absent only when `useDocumentOnFile` asks the server for it instead. */
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
        /**
         * "Use the document on my profile" (registration Phase 0). The profile read
         * masks the number, so a returning registrant could only retype it; with
         * this the server copies the full number from the profile it holds, and the
         * browser never sees it.
         */
        useDocumentOnFile: z.ZodOptional<z.ZodLiteral<true>>;
        dateOfBirth: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        /** Must be ticked: an unticked box and a Yes are different acts (AC-5). */
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
    }>>;
    /** The owner's passport photo (2026-11-05), when it applies or holds a card: on its card and certificate. */
    psfOwnerPhotoKey: z.ZodOptional<z.ZodString>;
    eacStarGrade: z.ZodOptional<z.ZodNumber>;
    /** Part of a franchise, and how (ADR-075 AC-8). Absent means No. */
    franchise: z.ZodOptional<z.ZodDiscriminatedUnion<"role", [z.ZodObject<{
        role: z.ZodLiteral<"franchisee">;
        brandName: z.ZodString;
        franchisorLegalName: z.ZodString;
        franchisorCountry: z.ZodPipeline<z.ZodString, z.ZodEffects<z.ZodString, string, string>>;
    }, "strict", z.ZodTypeAny, {
        role: "franchisee";
        brandName: string;
        franchisorLegalName: string;
        franchisorCountry: string;
    }, {
        role: "franchisee";
        brandName: string;
        franchisorLegalName: string;
        franchisorCountry: string;
    }>, z.ZodObject<{
        role: z.ZodLiteral<"franchisor">;
        brandName: z.ZodString;
        franchisedLocations: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        role: "franchisor";
        brandName: string;
        franchisedLocations: number;
    }, {
        role: "franchisor";
        brandName: string;
        franchisedLocations: number;
    }>]>>;
    /** The locations beyond the head office (ADR-054). Empty for a single site business. */
    branches: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        address: z.ZodObject<{
            country: z.ZodLiteral<"RW">;
            provinceId: z.ZodNumber;
            districtId: z.ZodNumber;
            sectorId: z.ZodNumber;
            /** Fourth level. Collected to drive the village picker, never stored. */
            cellId: z.ZodOptional<z.ZodNumber>;
            /** Fifth level, and the finest one. Stored; see `orgs.village_id`. */
            villageId: z.ZodOptional<z.ZodNumber>;
            /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
            street: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        }, {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
    }, {
        name: string;
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    domain: "hospitality";
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    };
    tin: string;
    legalName: string;
    certificates: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[];
    entityGroup: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism";
    chamberOfTourismMember: boolean;
    psfMember: boolean;
    branches: {
        name: string;
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
    }[];
    franchise?: {
        role: "franchisee";
        brandName: string;
        franchisorLegalName: string;
        franchisorCountry: string;
    } | {
        role: "franchisor";
        brandName: string;
        franchisedLocations: number;
    } | undefined;
    businessKind?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | undefined;
    accommodationClass?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | undefined;
    accommodationClassOther?: string | undefined;
    upi?: string | undefined;
    tourismLicenseNumber?: string | undefined;
    psfMembershipNumber?: string | undefined;
    psfApplication?: {
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
    } | undefined;
    psfOwnerPhotoKey?: string | undefined;
    eacStarGrade?: number | undefined;
}, {
    domain: "hospitality";
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    };
    tin: string;
    legalName: string;
    franchise?: {
        role: "franchisee";
        brandName: string;
        franchisorLegalName: string;
        franchisorCountry: string;
    } | {
        role: "franchisor";
        brandName: string;
        franchisedLocations: number;
    } | undefined;
    certificates?: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[] | undefined;
    entityGroup?: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism" | undefined;
    businessKind?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | undefined;
    accommodationClass?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | undefined;
    accommodationClassOther?: string | undefined;
    upi?: string | undefined;
    tourismLicenseNumber?: string | undefined;
    chamberOfTourismMember?: boolean | undefined;
    psfMember?: boolean | undefined;
    psfMembershipNumber?: string | undefined;
    psfApplication?: {
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
    } | undefined;
    psfOwnerPhotoKey?: string | undefined;
    eacStarGrade?: number | undefined;
    branches?: {
        name: string;
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
    }[] | undefined;
}>;
/** A residence. Carries a UPI, and none of the tourism apparatus. */
export declare const ResidenceBusiness: z.ZodObject<{
    legalName: z.ZodString;
    address: z.ZodObject<{
        country: z.ZodLiteral<"RW">;
        provinceId: z.ZodNumber;
        districtId: z.ZodNumber;
        sectorId: z.ZodNumber;
        /** Fourth level. Collected to drive the village picker, never stored. */
        cellId: z.ZodOptional<z.ZodNumber>;
        /** Fifth level, and the finest one. Stored; see `orgs.village_id`. */
        villageId: z.ZodOptional<z.ZodNumber>;
        /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
        street: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    }, {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    }>;
    certificates: z.ZodDefault<z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other", "rdb_certificate", "psf_certificate", "land_title", "franchise_agreement"]>;
        /** Required when `kind` is `other`; the database carries the same rule. */
        kindOther: z.ZodOptional<z.ZodString>;
        /** Key of an already-uploaded `stored_objects` row (F-S09). */
        objectKey: z.ZodString;
        certificateNumber: z.ZodOptional<z.ZodString>;
        issuedBy: z.ZodOptional<z.ZodString>;
        issuedOn: z.ZodOptional<z.ZodString>;
        expiresOn: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }, {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }>, "many">>;
} & {
    domain: z.ZodLiteral<"residence">;
    residenceClass: z.ZodEnum<["residential_landlord", "residential_property_manager"]>;
    upi: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    /**
     * Refused rather than left out (ADR-054 AC-R3). An unknown key would be
     * stripped silently, and a landlord who sent branches would believe they
     * had been recorded.
     */
    branches: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
    /**
     * Refused, not stripped, for the same reason (ADR-056 AC-6): PSF
     * membership through Injishi is hospitality only, and the database's
     * `orgs_domain_shape` forbids it on a residence too.
     */
    psfApplication: z.ZodOptional<z.ZodNever>;
    psfMembershipNumber: z.ZodOptional<z.ZodNever>;
    /** Refused, not stripped, for the same reason: a franchise is a hospitality business's brand (ADR-075 O-7). */
    franchise: z.ZodOptional<z.ZodNever>;
}, "strip", z.ZodTypeAny, {
    domain: "residence";
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    };
    legalName: string;
    certificates: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[];
    upi: string;
    residenceClass: "residential_landlord" | "residential_property_manager";
    franchise?: undefined;
    psfMembershipNumber?: undefined;
    psfApplication?: undefined;
    branches?: unknown[] | undefined;
}, {
    domain: "residence";
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    };
    legalName: string;
    upi: string;
    residenceClass: "residential_landlord" | "residential_property_manager";
    franchise?: undefined;
    certificates?: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[] | undefined;
    psfMembershipNumber?: undefined;
    psfApplication?: undefined;
    branches?: unknown[] | undefined;
}>;
/**
 * A business of any sector joining PSF through Injishi (the PSF path). It
 * names its sector by the PSF association it belongs to (the cluster follows
 * from it), may carry a TIN, and carries none of the tourism apparatus.
 *
 * The PSF application itself is NOT part of this: the business registers, gets
 * its code, and applies from its own portal, where the form and the tiers live.
 */
export declare const EnterpriseBusiness: z.ZodObject<{
    legalName: z.ZodString;
    address: z.ZodObject<{
        country: z.ZodLiteral<"RW">;
        provinceId: z.ZodNumber;
        districtId: z.ZodNumber;
        sectorId: z.ZodNumber;
        /** Fourth level. Collected to drive the village picker, never stored. */
        cellId: z.ZodOptional<z.ZodNumber>;
        /** Fifth level, and the finest one. Stored; see `orgs.village_id`. */
        villageId: z.ZodOptional<z.ZodNumber>;
        /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
        street: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    }, {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    }>;
    certificates: z.ZodDefault<z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other", "rdb_certificate", "psf_certificate", "land_title", "franchise_agreement"]>;
        /** Required when `kind` is `other`; the database carries the same rule. */
        kindOther: z.ZodOptional<z.ZodString>;
        /** Key of an already-uploaded `stored_objects` row (F-S09). */
        objectKey: z.ZodString;
        certificateNumber: z.ZodOptional<z.ZodString>;
        issuedBy: z.ZodOptional<z.ZodString>;
        issuedOn: z.ZodOptional<z.ZodString>;
        expiresOn: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }, {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }>, "many">>;
} & {
    domain: z.ZodLiteral<"enterprise">;
    registrationKind: z.ZodEnum<["tin", "rca", "rgb", "other", "none"]>;
    /** Required with `registrationKind: tin`, forbidden otherwise. */
    tin: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
    /** Required with `rca`, `rgb` and `other`, forbidden otherwise. */
    registrationNumber: z.ZodOptional<z.ZodString>;
    /** A row of the PSF association catalogue, which admin edits. */
    associationCode: z.ZodString;
    ownerGroups: z.ZodDefault<z.ZodArray<z.ZodEnum<["women", "youth", "pwd"]>, "many">>;
    /** Refused, not stripped, like a residence's (ADR-054 AC-R3). */
    branches: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
    psfApplication: z.ZodOptional<z.ZodNever>;
    psfMembershipNumber: z.ZodOptional<z.ZodNever>;
}, "strip", z.ZodTypeAny, {
    domain: "enterprise";
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    };
    associationCode: string;
    legalName: string;
    certificates: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[];
    registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
    ownerGroups: ("women" | "youth" | "pwd")[];
    tin?: string | undefined;
    psfMembershipNumber?: undefined;
    psfApplication?: undefined;
    branches?: unknown[] | undefined;
    registrationNumber?: string | undefined;
}, {
    domain: "enterprise";
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    };
    associationCode: string;
    legalName: string;
    registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
    tin?: string | undefined;
    certificates?: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[] | undefined;
    psfMembershipNumber?: undefined;
    psfApplication?: undefined;
    branches?: unknown[] | undefined;
    registrationNumber?: string | undefined;
    ownerGroups?: ("women" | "youth" | "pwd")[] | undefined;
}>;
export declare const BusinessDetails: z.ZodEffects<z.ZodDiscriminatedUnion<"domain", [z.ZodObject<{
    legalName: z.ZodString;
    address: z.ZodObject<{
        country: z.ZodLiteral<"RW">;
        provinceId: z.ZodNumber;
        districtId: z.ZodNumber;
        sectorId: z.ZodNumber;
        /** Fourth level. Collected to drive the village picker, never stored. */
        cellId: z.ZodOptional<z.ZodNumber>;
        /** Fifth level, and the finest one. Stored; see `orgs.village_id`. */
        villageId: z.ZodOptional<z.ZodNumber>;
        /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
        street: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    }, {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    }>;
    certificates: z.ZodDefault<z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other", "rdb_certificate", "psf_certificate", "land_title", "franchise_agreement"]>;
        /** Required when `kind` is `other`; the database carries the same rule. */
        kindOther: z.ZodOptional<z.ZodString>;
        /** Key of an already-uploaded `stored_objects` row (F-S09). */
        objectKey: z.ZodString;
        certificateNumber: z.ZodOptional<z.ZodString>;
        issuedBy: z.ZodOptional<z.ZodString>;
        issuedOn: z.ZodOptional<z.ZodString>;
        expiresOn: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }, {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }>, "many">>;
} & {
    domain: z.ZodLiteral<"hospitality">;
    entityGroup: z.ZodDefault<z.ZodEnum<["accommodation", "restaurant_bar_nightclub", "travel_services", "tourism_information_center", "cultural_tourism"]>>;
    /**
     * What kind of business it is (ADR-075 D-h, AC-31). A stay's kind is its accommodation class; a venue (Bar &
     * Restaurant, Coffee Shop) has a kind and no class. Optional only so a request built before ADR-075 still
     * reads: its kind is then derived from the class (`hospitalityKindOf`).
     */
    businessKind: z.ZodOptional<z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other", "bar_restaurant", "coffee_shop"]>>;
    /** A stay's RDB class. Required for a stay, forbidden for a venue, which has no rooms (ADR-075 O-14). */
    accommodationClass: z.ZodOptional<z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other"]>>;
    /** Required when the class is `other`, forbidden otherwise (D24). */
    accommodationClassOther: z.ZodOptional<z.ZodString>;
    tin: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    upi: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
    tourismLicenseNumber: z.ZodOptional<z.ZodString>;
    chamberOfTourismMember: z.ZodDefault<z.ZodBoolean>;
    /** Optional, and hospitality only. Not the PSF oversight body (D24). */
    psfMember: z.ZodDefault<z.ZodBoolean>;
    /**
     * A Yes may carry the PSF membership number; nobody checks it (ADR-056
     * AC-7). Forbidden with a No (see `BusinessDetails`).
     */
    psfMembershipNumber: z.ZodOptional<z.ZodString>;
    /**
     * A No may carry an application to join (ADR-056 AC-6), written in the
     * same transaction as the business. Forbidden with a Yes.
     */
    psfApplication: z.ZodOptional<z.ZodEffects<z.ZodObject<{
        requestedTierCode: z.ZodString;
        /**
         * What the business will pay a year, inside the band it picked. A business
         * pays what it can afford within its tier, so the amount is its own answer.
         * Required for every tier except one PSF prices itself; the server checks it
         * against the tier (`psfTierAcceptsFee`), which only the server reads.
         */
        declaredFeeRwf: z.ZodOptional<z.ZodEffects<z.ZodNumber, number, number>>;
        /**
         * Who the business is, and where (2026-11-03): absent from Injishi's registration, which already
         * names the business and places it, so the server copies them from there.
         */
        companyName: z.ZodOptional<z.ZodString>;
        streetAddress: z.ZodOptional<z.ZodString>;
        /**
         * Its sector, kind of business and association, as the PSF form asks them (2026-11-03). Absent: a
         * hotel is filed under PSF's hospitality association.
         */
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
        /**
         * The contact person (2026-11-03): each is absent when the person already gave it on You, and the
         * server copies it from their profile. Gender is asked here only when You holds neither of the two
         * PSF's form knows.
         */
        contactRole: z.ZodOptional<z.ZodEnum<["owner", "managing_director", "ceo", "chairman"]>>;
        firstName: z.ZodOptional<z.ZodString>;
        lastName: z.ZodOptional<z.ZodString>;
        gender: z.ZodOptional<z.ZodEnum<["male", "female"]>>;
        phoneE164: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
        email: z.ZodOptional<z.ZodString>;
        /** Absent only when `useDocumentOnFile` asks the server for it instead. */
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
        /**
         * "Use the document on my profile" (registration Phase 0). The profile read
         * masks the number, so a returning registrant could only retype it; with
         * this the server copies the full number from the profile it holds, and the
         * browser never sees it.
         */
        useDocumentOnFile: z.ZodOptional<z.ZodLiteral<true>>;
        dateOfBirth: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        /** Must be ticked: an unticked box and a Yes are different acts (AC-5). */
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
    }>>;
    /** The owner's passport photo (2026-11-05), when it applies or holds a card: on its card and certificate. */
    psfOwnerPhotoKey: z.ZodOptional<z.ZodString>;
    eacStarGrade: z.ZodOptional<z.ZodNumber>;
    /** Part of a franchise, and how (ADR-075 AC-8). Absent means No. */
    franchise: z.ZodOptional<z.ZodDiscriminatedUnion<"role", [z.ZodObject<{
        role: z.ZodLiteral<"franchisee">;
        brandName: z.ZodString;
        franchisorLegalName: z.ZodString;
        franchisorCountry: z.ZodPipeline<z.ZodString, z.ZodEffects<z.ZodString, string, string>>;
    }, "strict", z.ZodTypeAny, {
        role: "franchisee";
        brandName: string;
        franchisorLegalName: string;
        franchisorCountry: string;
    }, {
        role: "franchisee";
        brandName: string;
        franchisorLegalName: string;
        franchisorCountry: string;
    }>, z.ZodObject<{
        role: z.ZodLiteral<"franchisor">;
        brandName: z.ZodString;
        franchisedLocations: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        role: "franchisor";
        brandName: string;
        franchisedLocations: number;
    }, {
        role: "franchisor";
        brandName: string;
        franchisedLocations: number;
    }>]>>;
    /** The locations beyond the head office (ADR-054). Empty for a single site business. */
    branches: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        address: z.ZodObject<{
            country: z.ZodLiteral<"RW">;
            provinceId: z.ZodNumber;
            districtId: z.ZodNumber;
            sectorId: z.ZodNumber;
            /** Fourth level. Collected to drive the village picker, never stored. */
            cellId: z.ZodOptional<z.ZodNumber>;
            /** Fifth level, and the finest one. Stored; see `orgs.village_id`. */
            villageId: z.ZodOptional<z.ZodNumber>;
            /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
            street: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        }, {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
    }, {
        name: string;
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    domain: "hospitality";
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    };
    tin: string;
    legalName: string;
    certificates: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[];
    entityGroup: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism";
    chamberOfTourismMember: boolean;
    psfMember: boolean;
    branches: {
        name: string;
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
    }[];
    franchise?: {
        role: "franchisee";
        brandName: string;
        franchisorLegalName: string;
        franchisorCountry: string;
    } | {
        role: "franchisor";
        brandName: string;
        franchisedLocations: number;
    } | undefined;
    businessKind?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | undefined;
    accommodationClass?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | undefined;
    accommodationClassOther?: string | undefined;
    upi?: string | undefined;
    tourismLicenseNumber?: string | undefined;
    psfMembershipNumber?: string | undefined;
    psfApplication?: {
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
    } | undefined;
    psfOwnerPhotoKey?: string | undefined;
    eacStarGrade?: number | undefined;
}, {
    domain: "hospitality";
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    };
    tin: string;
    legalName: string;
    franchise?: {
        role: "franchisee";
        brandName: string;
        franchisorLegalName: string;
        franchisorCountry: string;
    } | {
        role: "franchisor";
        brandName: string;
        franchisedLocations: number;
    } | undefined;
    certificates?: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[] | undefined;
    entityGroup?: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism" | undefined;
    businessKind?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | undefined;
    accommodationClass?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | undefined;
    accommodationClassOther?: string | undefined;
    upi?: string | undefined;
    tourismLicenseNumber?: string | undefined;
    chamberOfTourismMember?: boolean | undefined;
    psfMember?: boolean | undefined;
    psfMembershipNumber?: string | undefined;
    psfApplication?: {
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
    } | undefined;
    psfOwnerPhotoKey?: string | undefined;
    eacStarGrade?: number | undefined;
    branches?: {
        name: string;
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
    }[] | undefined;
}>, z.ZodObject<{
    legalName: z.ZodString;
    address: z.ZodObject<{
        country: z.ZodLiteral<"RW">;
        provinceId: z.ZodNumber;
        districtId: z.ZodNumber;
        sectorId: z.ZodNumber;
        /** Fourth level. Collected to drive the village picker, never stored. */
        cellId: z.ZodOptional<z.ZodNumber>;
        /** Fifth level, and the finest one. Stored; see `orgs.village_id`. */
        villageId: z.ZodOptional<z.ZodNumber>;
        /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
        street: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    }, {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    }>;
    certificates: z.ZodDefault<z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other", "rdb_certificate", "psf_certificate", "land_title", "franchise_agreement"]>;
        /** Required when `kind` is `other`; the database carries the same rule. */
        kindOther: z.ZodOptional<z.ZodString>;
        /** Key of an already-uploaded `stored_objects` row (F-S09). */
        objectKey: z.ZodString;
        certificateNumber: z.ZodOptional<z.ZodString>;
        issuedBy: z.ZodOptional<z.ZodString>;
        issuedOn: z.ZodOptional<z.ZodString>;
        expiresOn: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }, {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }>, "many">>;
} & {
    domain: z.ZodLiteral<"residence">;
    residenceClass: z.ZodEnum<["residential_landlord", "residential_property_manager"]>;
    upi: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    /**
     * Refused rather than left out (ADR-054 AC-R3). An unknown key would be
     * stripped silently, and a landlord who sent branches would believe they
     * had been recorded.
     */
    branches: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
    /**
     * Refused, not stripped, for the same reason (ADR-056 AC-6): PSF
     * membership through Injishi is hospitality only, and the database's
     * `orgs_domain_shape` forbids it on a residence too.
     */
    psfApplication: z.ZodOptional<z.ZodNever>;
    psfMembershipNumber: z.ZodOptional<z.ZodNever>;
    /** Refused, not stripped, for the same reason: a franchise is a hospitality business's brand (ADR-075 O-7). */
    franchise: z.ZodOptional<z.ZodNever>;
}, "strip", z.ZodTypeAny, {
    domain: "residence";
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    };
    legalName: string;
    certificates: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[];
    upi: string;
    residenceClass: "residential_landlord" | "residential_property_manager";
    franchise?: undefined;
    psfMembershipNumber?: undefined;
    psfApplication?: undefined;
    branches?: unknown[] | undefined;
}, {
    domain: "residence";
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    };
    legalName: string;
    upi: string;
    residenceClass: "residential_landlord" | "residential_property_manager";
    franchise?: undefined;
    certificates?: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[] | undefined;
    psfMembershipNumber?: undefined;
    psfApplication?: undefined;
    branches?: unknown[] | undefined;
}>, z.ZodObject<{
    legalName: z.ZodString;
    address: z.ZodObject<{
        country: z.ZodLiteral<"RW">;
        provinceId: z.ZodNumber;
        districtId: z.ZodNumber;
        sectorId: z.ZodNumber;
        /** Fourth level. Collected to drive the village picker, never stored. */
        cellId: z.ZodOptional<z.ZodNumber>;
        /** Fifth level, and the finest one. Stored; see `orgs.village_id`. */
        villageId: z.ZodOptional<z.ZodNumber>;
        /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
        street: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    }, {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    }>;
    certificates: z.ZodDefault<z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other", "rdb_certificate", "psf_certificate", "land_title", "franchise_agreement"]>;
        /** Required when `kind` is `other`; the database carries the same rule. */
        kindOther: z.ZodOptional<z.ZodString>;
        /** Key of an already-uploaded `stored_objects` row (F-S09). */
        objectKey: z.ZodString;
        certificateNumber: z.ZodOptional<z.ZodString>;
        issuedBy: z.ZodOptional<z.ZodString>;
        issuedOn: z.ZodOptional<z.ZodString>;
        expiresOn: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }, {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }>, "many">>;
} & {
    domain: z.ZodLiteral<"enterprise">;
    registrationKind: z.ZodEnum<["tin", "rca", "rgb", "other", "none"]>;
    /** Required with `registrationKind: tin`, forbidden otherwise. */
    tin: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
    /** Required with `rca`, `rgb` and `other`, forbidden otherwise. */
    registrationNumber: z.ZodOptional<z.ZodString>;
    /** A row of the PSF association catalogue, which admin edits. */
    associationCode: z.ZodString;
    ownerGroups: z.ZodDefault<z.ZodArray<z.ZodEnum<["women", "youth", "pwd"]>, "many">>;
    /** Refused, not stripped, like a residence's (ADR-054 AC-R3). */
    branches: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
    psfApplication: z.ZodOptional<z.ZodNever>;
    psfMembershipNumber: z.ZodOptional<z.ZodNever>;
}, "strip", z.ZodTypeAny, {
    domain: "enterprise";
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    };
    associationCode: string;
    legalName: string;
    certificates: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[];
    registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
    ownerGroups: ("women" | "youth" | "pwd")[];
    tin?: string | undefined;
    psfMembershipNumber?: undefined;
    psfApplication?: undefined;
    branches?: unknown[] | undefined;
    registrationNumber?: string | undefined;
}, {
    domain: "enterprise";
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    };
    associationCode: string;
    legalName: string;
    registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
    tin?: string | undefined;
    certificates?: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[] | undefined;
    psfMembershipNumber?: undefined;
    psfApplication?: undefined;
    branches?: unknown[] | undefined;
    registrationNumber?: string | undefined;
    ownerGroups?: ("women" | "youth" | "pwd")[] | undefined;
}>]>, {
    domain: "hospitality";
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    };
    tin: string;
    legalName: string;
    certificates: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[];
    entityGroup: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism";
    chamberOfTourismMember: boolean;
    psfMember: boolean;
    branches: {
        name: string;
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
    }[];
    franchise?: {
        role: "franchisee";
        brandName: string;
        franchisorLegalName: string;
        franchisorCountry: string;
    } | {
        role: "franchisor";
        brandName: string;
        franchisedLocations: number;
    } | undefined;
    businessKind?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | undefined;
    accommodationClass?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | undefined;
    accommodationClassOther?: string | undefined;
    upi?: string | undefined;
    tourismLicenseNumber?: string | undefined;
    psfMembershipNumber?: string | undefined;
    psfApplication?: {
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
    } | undefined;
    psfOwnerPhotoKey?: string | undefined;
    eacStarGrade?: number | undefined;
} | {
    domain: "residence";
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    };
    legalName: string;
    certificates: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[];
    upi: string;
    residenceClass: "residential_landlord" | "residential_property_manager";
    franchise?: undefined;
    psfMembershipNumber?: undefined;
    psfApplication?: undefined;
    branches?: unknown[] | undefined;
} | {
    domain: "enterprise";
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    };
    associationCode: string;
    legalName: string;
    certificates: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[];
    registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
    ownerGroups: ("women" | "youth" | "pwd")[];
    tin?: string | undefined;
    psfMembershipNumber?: undefined;
    psfApplication?: undefined;
    branches?: unknown[] | undefined;
    registrationNumber?: string | undefined;
}, {
    domain: "hospitality";
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    };
    tin: string;
    legalName: string;
    franchise?: {
        role: "franchisee";
        brandName: string;
        franchisorLegalName: string;
        franchisorCountry: string;
    } | {
        role: "franchisor";
        brandName: string;
        franchisedLocations: number;
    } | undefined;
    certificates?: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[] | undefined;
    entityGroup?: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism" | undefined;
    businessKind?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | undefined;
    accommodationClass?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | undefined;
    accommodationClassOther?: string | undefined;
    upi?: string | undefined;
    tourismLicenseNumber?: string | undefined;
    chamberOfTourismMember?: boolean | undefined;
    psfMember?: boolean | undefined;
    psfMembershipNumber?: string | undefined;
    psfApplication?: {
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
    } | undefined;
    psfOwnerPhotoKey?: string | undefined;
    eacStarGrade?: number | undefined;
    branches?: {
        name: string;
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
    }[] | undefined;
} | {
    domain: "residence";
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    };
    legalName: string;
    upi: string;
    residenceClass: "residential_landlord" | "residential_property_manager";
    franchise?: undefined;
    certificates?: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[] | undefined;
    psfMembershipNumber?: undefined;
    psfApplication?: undefined;
    branches?: unknown[] | undefined;
} | {
    domain: "enterprise";
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    };
    associationCode: string;
    legalName: string;
    registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
    tin?: string | undefined;
    certificates?: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[] | undefined;
    psfMembershipNumber?: undefined;
    psfApplication?: undefined;
    branches?: unknown[] | undefined;
    registrationNumber?: string | undefined;
    ownerGroups?: ("women" | "youth" | "pwd")[] | undefined;
}>;
export type BusinessDetails = z.infer<typeof BusinessDetails>;
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
export declare const IntendedOwner: z.ZodObject<{
    name: z.ZodString;
    nationalId: z.ZodPipeline<z.ZodString, z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    nationalId: string;
}, {
    name: string;
    email: string;
    nationalId: string;
}>;
export type IntendedOwner = z.infer<typeof IntendedOwner>;
export declare const CreateRegistrationRequest: z.ZodEffects<z.ZodObject<{
    role: z.ZodEnum<["host", "landlord", "broker", "enterprise"]>;
    capacity: z.ZodDefault<z.ZodEnum<["owner", "on_behalf_of"]>>;
    /**
     * Omitted by a returning registrant, whose profile already carries it.
     * Absent is not "skip validation" — the server reads the stored profile and
     * refuses if that is incomplete.
     */
    personal: z.ZodOptional<z.ZodObject<{
        /** As written on the identity document. */
        fullName: z.ZodString;
        /**
         * Absent only when the person's identity is already VERIFIED (ADR-060): the
         * server then keeps the verified document, whose full number the browser
         * never holds again after a reload. For anyone unverified the server
         * refuses its absence at this path.
         */
        document: z.ZodOptional<z.ZodDiscriminatedUnion<"documentType", [z.ZodObject<{
            documentType: z.ZodLiteral<"national_id">;
            documentNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
            /** A Rwandan NID is Rwandan by definition; kept explicit for the row. */
            issuingCountry: z.ZodDefault<z.ZodLiteral<"RW">>;
        }, "strip", z.ZodTypeAny, {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry: "RW";
        }, {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry?: "RW" | undefined;
        }>, z.ZodObject<{
            documentType: z.ZodLiteral<"passport">;
            documentNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
            issuingCountry: z.ZodEffects<z.ZodString, string, string>;
        }, "strip", z.ZodTypeAny, {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        }, {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        }>]>>;
        gender: z.ZodOptional<z.ZodEnum<["female", "male", "other", "prefer_not_to_say"]>>;
        /** ISO date. Bounds are sanity rails, not a policy on who may register. */
        dateOfBirth: z.ZodEffects<z.ZodString, string, string>;
        phoneE164: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        address: z.ZodUnion<[z.ZodObject<{
            country: z.ZodLiteral<"RW">;
            provinceId: z.ZodNumber;
            districtId: z.ZodNumber;
            sectorId: z.ZodNumber;
            /** Fourth level. Collected to drive the village picker, never stored. */
            cellId: z.ZodOptional<z.ZodNumber>;
            /** Fifth level, and the finest one. Stored; see `orgs.village_id`. */
            villageId: z.ZodOptional<z.ZodNumber>;
            /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
            street: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        }, {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        }>, z.ZodObject<{
            country: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
            /** The whole address as written locally. Formats differ too much to split. */
            addressText: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            country: string;
            addressText: string;
        }, {
            country: string;
            addressText: string;
        }>]>;
    }, "strip", z.ZodTypeAny, {
        fullName: string;
        dateOfBirth: string;
        phoneE164: string;
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        } | {
            country: string;
            addressText: string;
        };
        document?: {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry: "RW";
        } | {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        } | undefined;
        gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
    }, {
        fullName: string;
        dateOfBirth: string;
        phoneE164: string;
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        } | {
            country: string;
            addressText: string;
        };
        document?: {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry?: "RW" | undefined;
        } | {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        } | undefined;
        gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
    }>>;
    business: z.ZodEffects<z.ZodDiscriminatedUnion<"domain", [z.ZodObject<{
        legalName: z.ZodString;
        address: z.ZodObject<{
            country: z.ZodLiteral<"RW">;
            provinceId: z.ZodNumber;
            districtId: z.ZodNumber;
            sectorId: z.ZodNumber;
            /** Fourth level. Collected to drive the village picker, never stored. */
            cellId: z.ZodOptional<z.ZodNumber>;
            /** Fifth level, and the finest one. Stored; see `orgs.village_id`. */
            villageId: z.ZodOptional<z.ZodNumber>;
            /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
            street: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        }, {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        }>;
        certificates: z.ZodDefault<z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other", "rdb_certificate", "psf_certificate", "land_title", "franchise_agreement"]>;
            /** Required when `kind` is `other`; the database carries the same rule. */
            kindOther: z.ZodOptional<z.ZodString>;
            /** Key of an already-uploaded `stored_objects` row (F-S09). */
            objectKey: z.ZodString;
            certificateNumber: z.ZodOptional<z.ZodString>;
            issuedBy: z.ZodOptional<z.ZodString>;
            issuedOn: z.ZodOptional<z.ZodString>;
            expiresOn: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }, {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }>, "many">>;
    } & {
        domain: z.ZodLiteral<"hospitality">;
        entityGroup: z.ZodDefault<z.ZodEnum<["accommodation", "restaurant_bar_nightclub", "travel_services", "tourism_information_center", "cultural_tourism"]>>;
        /**
         * What kind of business it is (ADR-075 D-h, AC-31). A stay's kind is its accommodation class; a venue (Bar &
         * Restaurant, Coffee Shop) has a kind and no class. Optional only so a request built before ADR-075 still
         * reads: its kind is then derived from the class (`hospitalityKindOf`).
         */
        businessKind: z.ZodOptional<z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other", "bar_restaurant", "coffee_shop"]>>;
        /** A stay's RDB class. Required for a stay, forbidden for a venue, which has no rooms (ADR-075 O-14). */
        accommodationClass: z.ZodOptional<z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other"]>>;
        /** Required when the class is `other`, forbidden otherwise (D24). */
        accommodationClassOther: z.ZodOptional<z.ZodString>;
        tin: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        upi: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
        tourismLicenseNumber: z.ZodOptional<z.ZodString>;
        chamberOfTourismMember: z.ZodDefault<z.ZodBoolean>;
        /** Optional, and hospitality only. Not the PSF oversight body (D24). */
        psfMember: z.ZodDefault<z.ZodBoolean>;
        /**
         * A Yes may carry the PSF membership number; nobody checks it (ADR-056
         * AC-7). Forbidden with a No (see `BusinessDetails`).
         */
        psfMembershipNumber: z.ZodOptional<z.ZodString>;
        /**
         * A No may carry an application to join (ADR-056 AC-6), written in the
         * same transaction as the business. Forbidden with a Yes.
         */
        psfApplication: z.ZodOptional<z.ZodEffects<z.ZodObject<{
            requestedTierCode: z.ZodString;
            /**
             * What the business will pay a year, inside the band it picked. A business
             * pays what it can afford within its tier, so the amount is its own answer.
             * Required for every tier except one PSF prices itself; the server checks it
             * against the tier (`psfTierAcceptsFee`), which only the server reads.
             */
            declaredFeeRwf: z.ZodOptional<z.ZodEffects<z.ZodNumber, number, number>>;
            /**
             * Who the business is, and where (2026-11-03): absent from Injishi's registration, which already
             * names the business and places it, so the server copies them from there.
             */
            companyName: z.ZodOptional<z.ZodString>;
            streetAddress: z.ZodOptional<z.ZodString>;
            /**
             * Its sector, kind of business and association, as the PSF form asks them (2026-11-03). Absent: a
             * hotel is filed under PSF's hospitality association.
             */
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
            /**
             * The contact person (2026-11-03): each is absent when the person already gave it on You, and the
             * server copies it from their profile. Gender is asked here only when You holds neither of the two
             * PSF's form knows.
             */
            contactRole: z.ZodOptional<z.ZodEnum<["owner", "managing_director", "ceo", "chairman"]>>;
            firstName: z.ZodOptional<z.ZodString>;
            lastName: z.ZodOptional<z.ZodString>;
            gender: z.ZodOptional<z.ZodEnum<["male", "female"]>>;
            phoneE164: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
            email: z.ZodOptional<z.ZodString>;
            /** Absent only when `useDocumentOnFile` asks the server for it instead. */
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
            /**
             * "Use the document on my profile" (registration Phase 0). The profile read
             * masks the number, so a returning registrant could only retype it; with
             * this the server copies the full number from the profile it holds, and the
             * browser never sees it.
             */
            useDocumentOnFile: z.ZodOptional<z.ZodLiteral<true>>;
            dateOfBirth: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
            /** Must be ticked: an unticked box and a Yes are different acts (AC-5). */
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
        }>>;
        /** The owner's passport photo (2026-11-05), when it applies or holds a card: on its card and certificate. */
        psfOwnerPhotoKey: z.ZodOptional<z.ZodString>;
        eacStarGrade: z.ZodOptional<z.ZodNumber>;
        /** Part of a franchise, and how (ADR-075 AC-8). Absent means No. */
        franchise: z.ZodOptional<z.ZodDiscriminatedUnion<"role", [z.ZodObject<{
            role: z.ZodLiteral<"franchisee">;
            brandName: z.ZodString;
            franchisorLegalName: z.ZodString;
            franchisorCountry: z.ZodPipeline<z.ZodString, z.ZodEffects<z.ZodString, string, string>>;
        }, "strict", z.ZodTypeAny, {
            role: "franchisee";
            brandName: string;
            franchisorLegalName: string;
            franchisorCountry: string;
        }, {
            role: "franchisee";
            brandName: string;
            franchisorLegalName: string;
            franchisorCountry: string;
        }>, z.ZodObject<{
            role: z.ZodLiteral<"franchisor">;
            brandName: z.ZodString;
            franchisedLocations: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            role: "franchisor";
            brandName: string;
            franchisedLocations: number;
        }, {
            role: "franchisor";
            brandName: string;
            franchisedLocations: number;
        }>]>>;
        /** The locations beyond the head office (ADR-054). Empty for a single site business. */
        branches: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            address: z.ZodObject<{
                country: z.ZodLiteral<"RW">;
                provinceId: z.ZodNumber;
                districtId: z.ZodNumber;
                sectorId: z.ZodNumber;
                /** Fourth level. Collected to drive the village picker, never stored. */
                cellId: z.ZodOptional<z.ZodNumber>;
                /** Fifth level, and the finest one. Stored; see `orgs.village_id`. */
                villageId: z.ZodOptional<z.ZodNumber>;
                /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
                street: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                country: "RW";
                provinceId: number;
                districtId: number;
                sectorId: number;
                cellId?: number | undefined;
                villageId?: number | undefined;
                street?: string | undefined;
            }, {
                country: "RW";
                provinceId: number;
                districtId: number;
                sectorId: number;
                cellId?: number | undefined;
                villageId?: number | undefined;
                street?: string | undefined;
            }>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            address: {
                country: "RW";
                provinceId: number;
                districtId: number;
                sectorId: number;
                cellId?: number | undefined;
                villageId?: number | undefined;
                street?: string | undefined;
            };
        }, {
            name: string;
            address: {
                country: "RW";
                provinceId: number;
                districtId: number;
                sectorId: number;
                cellId?: number | undefined;
                villageId?: number | undefined;
                street?: string | undefined;
            };
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        domain: "hospitality";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        tin: string;
        legalName: string;
        certificates: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[];
        entityGroup: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism";
        chamberOfTourismMember: boolean;
        psfMember: boolean;
        branches: {
            name: string;
            address: {
                country: "RW";
                provinceId: number;
                districtId: number;
                sectorId: number;
                cellId?: number | undefined;
                villageId?: number | undefined;
                street?: string | undefined;
            };
        }[];
        franchise?: {
            role: "franchisee";
            brandName: string;
            franchisorLegalName: string;
            franchisorCountry: string;
        } | {
            role: "franchisor";
            brandName: string;
            franchisedLocations: number;
        } | undefined;
        businessKind?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | undefined;
        accommodationClass?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | undefined;
        accommodationClassOther?: string | undefined;
        upi?: string | undefined;
        tourismLicenseNumber?: string | undefined;
        psfMembershipNumber?: string | undefined;
        psfApplication?: {
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
        } | undefined;
        psfOwnerPhotoKey?: string | undefined;
        eacStarGrade?: number | undefined;
    }, {
        domain: "hospitality";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        tin: string;
        legalName: string;
        franchise?: {
            role: "franchisee";
            brandName: string;
            franchisorLegalName: string;
            franchisorCountry: string;
        } | {
            role: "franchisor";
            brandName: string;
            franchisedLocations: number;
        } | undefined;
        certificates?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[] | undefined;
        entityGroup?: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism" | undefined;
        businessKind?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | undefined;
        accommodationClass?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | undefined;
        accommodationClassOther?: string | undefined;
        upi?: string | undefined;
        tourismLicenseNumber?: string | undefined;
        chamberOfTourismMember?: boolean | undefined;
        psfMember?: boolean | undefined;
        psfMembershipNumber?: string | undefined;
        psfApplication?: {
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
        } | undefined;
        psfOwnerPhotoKey?: string | undefined;
        eacStarGrade?: number | undefined;
        branches?: {
            name: string;
            address: {
                country: "RW";
                provinceId: number;
                districtId: number;
                sectorId: number;
                cellId?: number | undefined;
                villageId?: number | undefined;
                street?: string | undefined;
            };
        }[] | undefined;
    }>, z.ZodObject<{
        legalName: z.ZodString;
        address: z.ZodObject<{
            country: z.ZodLiteral<"RW">;
            provinceId: z.ZodNumber;
            districtId: z.ZodNumber;
            sectorId: z.ZodNumber;
            /** Fourth level. Collected to drive the village picker, never stored. */
            cellId: z.ZodOptional<z.ZodNumber>;
            /** Fifth level, and the finest one. Stored; see `orgs.village_id`. */
            villageId: z.ZodOptional<z.ZodNumber>;
            /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
            street: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        }, {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        }>;
        certificates: z.ZodDefault<z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other", "rdb_certificate", "psf_certificate", "land_title", "franchise_agreement"]>;
            /** Required when `kind` is `other`; the database carries the same rule. */
            kindOther: z.ZodOptional<z.ZodString>;
            /** Key of an already-uploaded `stored_objects` row (F-S09). */
            objectKey: z.ZodString;
            certificateNumber: z.ZodOptional<z.ZodString>;
            issuedBy: z.ZodOptional<z.ZodString>;
            issuedOn: z.ZodOptional<z.ZodString>;
            expiresOn: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }, {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }>, "many">>;
    } & {
        domain: z.ZodLiteral<"residence">;
        residenceClass: z.ZodEnum<["residential_landlord", "residential_property_manager"]>;
        upi: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        /**
         * Refused rather than left out (ADR-054 AC-R3). An unknown key would be
         * stripped silently, and a landlord who sent branches would believe they
         * had been recorded.
         */
        branches: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
        /**
         * Refused, not stripped, for the same reason (ADR-056 AC-6): PSF
         * membership through Injishi is hospitality only, and the database's
         * `orgs_domain_shape` forbids it on a residence too.
         */
        psfApplication: z.ZodOptional<z.ZodNever>;
        psfMembershipNumber: z.ZodOptional<z.ZodNever>;
        /** Refused, not stripped, for the same reason: a franchise is a hospitality business's brand (ADR-075 O-7). */
        franchise: z.ZodOptional<z.ZodNever>;
    }, "strip", z.ZodTypeAny, {
        domain: "residence";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        legalName: string;
        certificates: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[];
        upi: string;
        residenceClass: "residential_landlord" | "residential_property_manager";
        franchise?: undefined;
        psfMembershipNumber?: undefined;
        psfApplication?: undefined;
        branches?: unknown[] | undefined;
    }, {
        domain: "residence";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        legalName: string;
        upi: string;
        residenceClass: "residential_landlord" | "residential_property_manager";
        franchise?: undefined;
        certificates?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[] | undefined;
        psfMembershipNumber?: undefined;
        psfApplication?: undefined;
        branches?: unknown[] | undefined;
    }>, z.ZodObject<{
        legalName: z.ZodString;
        address: z.ZodObject<{
            country: z.ZodLiteral<"RW">;
            provinceId: z.ZodNumber;
            districtId: z.ZodNumber;
            sectorId: z.ZodNumber;
            /** Fourth level. Collected to drive the village picker, never stored. */
            cellId: z.ZodOptional<z.ZodNumber>;
            /** Fifth level, and the finest one. Stored; see `orgs.village_id`. */
            villageId: z.ZodOptional<z.ZodNumber>;
            /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
            street: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        }, {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        }>;
        certificates: z.ZodDefault<z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other", "rdb_certificate", "psf_certificate", "land_title", "franchise_agreement"]>;
            /** Required when `kind` is `other`; the database carries the same rule. */
            kindOther: z.ZodOptional<z.ZodString>;
            /** Key of an already-uploaded `stored_objects` row (F-S09). */
            objectKey: z.ZodString;
            certificateNumber: z.ZodOptional<z.ZodString>;
            issuedBy: z.ZodOptional<z.ZodString>;
            issuedOn: z.ZodOptional<z.ZodString>;
            expiresOn: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }, {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }>, "many">>;
    } & {
        domain: z.ZodLiteral<"enterprise">;
        registrationKind: z.ZodEnum<["tin", "rca", "rgb", "other", "none"]>;
        /** Required with `registrationKind: tin`, forbidden otherwise. */
        tin: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
        /** Required with `rca`, `rgb` and `other`, forbidden otherwise. */
        registrationNumber: z.ZodOptional<z.ZodString>;
        /** A row of the PSF association catalogue, which admin edits. */
        associationCode: z.ZodString;
        ownerGroups: z.ZodDefault<z.ZodArray<z.ZodEnum<["women", "youth", "pwd"]>, "many">>;
        /** Refused, not stripped, like a residence's (ADR-054 AC-R3). */
        branches: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
        psfApplication: z.ZodOptional<z.ZodNever>;
        psfMembershipNumber: z.ZodOptional<z.ZodNever>;
    }, "strip", z.ZodTypeAny, {
        domain: "enterprise";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        associationCode: string;
        legalName: string;
        certificates: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[];
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
        ownerGroups: ("women" | "youth" | "pwd")[];
        tin?: string | undefined;
        psfMembershipNumber?: undefined;
        psfApplication?: undefined;
        branches?: unknown[] | undefined;
        registrationNumber?: string | undefined;
    }, {
        domain: "enterprise";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        associationCode: string;
        legalName: string;
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
        tin?: string | undefined;
        certificates?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[] | undefined;
        psfMembershipNumber?: undefined;
        psfApplication?: undefined;
        branches?: unknown[] | undefined;
        registrationNumber?: string | undefined;
        ownerGroups?: ("women" | "youth" | "pwd")[] | undefined;
    }>]>, {
        domain: "hospitality";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        tin: string;
        legalName: string;
        certificates: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[];
        entityGroup: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism";
        chamberOfTourismMember: boolean;
        psfMember: boolean;
        branches: {
            name: string;
            address: {
                country: "RW";
                provinceId: number;
                districtId: number;
                sectorId: number;
                cellId?: number | undefined;
                villageId?: number | undefined;
                street?: string | undefined;
            };
        }[];
        franchise?: {
            role: "franchisee";
            brandName: string;
            franchisorLegalName: string;
            franchisorCountry: string;
        } | {
            role: "franchisor";
            brandName: string;
            franchisedLocations: number;
        } | undefined;
        businessKind?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | undefined;
        accommodationClass?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | undefined;
        accommodationClassOther?: string | undefined;
        upi?: string | undefined;
        tourismLicenseNumber?: string | undefined;
        psfMembershipNumber?: string | undefined;
        psfApplication?: {
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
        } | undefined;
        psfOwnerPhotoKey?: string | undefined;
        eacStarGrade?: number | undefined;
    } | {
        domain: "residence";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        legalName: string;
        certificates: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[];
        upi: string;
        residenceClass: "residential_landlord" | "residential_property_manager";
        franchise?: undefined;
        psfMembershipNumber?: undefined;
        psfApplication?: undefined;
        branches?: unknown[] | undefined;
    } | {
        domain: "enterprise";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        associationCode: string;
        legalName: string;
        certificates: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[];
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
        ownerGroups: ("women" | "youth" | "pwd")[];
        tin?: string | undefined;
        psfMembershipNumber?: undefined;
        psfApplication?: undefined;
        branches?: unknown[] | undefined;
        registrationNumber?: string | undefined;
    }, {
        domain: "hospitality";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        tin: string;
        legalName: string;
        franchise?: {
            role: "franchisee";
            brandName: string;
            franchisorLegalName: string;
            franchisorCountry: string;
        } | {
            role: "franchisor";
            brandName: string;
            franchisedLocations: number;
        } | undefined;
        certificates?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[] | undefined;
        entityGroup?: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism" | undefined;
        businessKind?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | undefined;
        accommodationClass?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | undefined;
        accommodationClassOther?: string | undefined;
        upi?: string | undefined;
        tourismLicenseNumber?: string | undefined;
        chamberOfTourismMember?: boolean | undefined;
        psfMember?: boolean | undefined;
        psfMembershipNumber?: string | undefined;
        psfApplication?: {
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
        } | undefined;
        psfOwnerPhotoKey?: string | undefined;
        eacStarGrade?: number | undefined;
        branches?: {
            name: string;
            address: {
                country: "RW";
                provinceId: number;
                districtId: number;
                sectorId: number;
                cellId?: number | undefined;
                villageId?: number | undefined;
                street?: string | undefined;
            };
        }[] | undefined;
    } | {
        domain: "residence";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        legalName: string;
        upi: string;
        residenceClass: "residential_landlord" | "residential_property_manager";
        franchise?: undefined;
        certificates?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[] | undefined;
        psfMembershipNumber?: undefined;
        psfApplication?: undefined;
        branches?: unknown[] | undefined;
    } | {
        domain: "enterprise";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        associationCode: string;
        legalName: string;
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
        tin?: string | undefined;
        certificates?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[] | undefined;
        psfMembershipNumber?: undefined;
        psfApplication?: undefined;
        branches?: unknown[] | undefined;
        registrationNumber?: string | undefined;
        ownerGroups?: ("women" | "youth" | "pwd")[] | undefined;
    }>;
    /** Captured when `capacity` is `on_behalf_of`. See `IntendedOwner`. */
    intendedOwner: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        nationalId: z.ZodPipeline<z.ZodString, z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
        email: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        email: string;
        nationalId: string;
    }, {
        name: string;
        email: string;
        nationalId: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    business: {
        domain: "hospitality";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        tin: string;
        legalName: string;
        certificates: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[];
        entityGroup: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism";
        chamberOfTourismMember: boolean;
        psfMember: boolean;
        branches: {
            name: string;
            address: {
                country: "RW";
                provinceId: number;
                districtId: number;
                sectorId: number;
                cellId?: number | undefined;
                villageId?: number | undefined;
                street?: string | undefined;
            };
        }[];
        franchise?: {
            role: "franchisee";
            brandName: string;
            franchisorLegalName: string;
            franchisorCountry: string;
        } | {
            role: "franchisor";
            brandName: string;
            franchisedLocations: number;
        } | undefined;
        businessKind?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | undefined;
        accommodationClass?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | undefined;
        accommodationClassOther?: string | undefined;
        upi?: string | undefined;
        tourismLicenseNumber?: string | undefined;
        psfMembershipNumber?: string | undefined;
        psfApplication?: {
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
        } | undefined;
        psfOwnerPhotoKey?: string | undefined;
        eacStarGrade?: number | undefined;
    } | {
        domain: "residence";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        legalName: string;
        certificates: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[];
        upi: string;
        residenceClass: "residential_landlord" | "residential_property_manager";
        franchise?: undefined;
        psfMembershipNumber?: undefined;
        psfApplication?: undefined;
        branches?: unknown[] | undefined;
    } | {
        domain: "enterprise";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        associationCode: string;
        legalName: string;
        certificates: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[];
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
        ownerGroups: ("women" | "youth" | "pwd")[];
        tin?: string | undefined;
        psfMembershipNumber?: undefined;
        psfApplication?: undefined;
        branches?: unknown[] | undefined;
        registrationNumber?: string | undefined;
    };
    capacity: "owner" | "on_behalf_of";
    role: "enterprise" | "broker" | "host" | "landlord";
    personal?: {
        fullName: string;
        dateOfBirth: string;
        phoneE164: string;
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        } | {
            country: string;
            addressText: string;
        };
        document?: {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry: "RW";
        } | {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        } | undefined;
        gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
    } | undefined;
    intendedOwner?: {
        name: string;
        email: string;
        nationalId: string;
    } | undefined;
}, {
    business: {
        domain: "hospitality";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        tin: string;
        legalName: string;
        franchise?: {
            role: "franchisee";
            brandName: string;
            franchisorLegalName: string;
            franchisorCountry: string;
        } | {
            role: "franchisor";
            brandName: string;
            franchisedLocations: number;
        } | undefined;
        certificates?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[] | undefined;
        entityGroup?: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism" | undefined;
        businessKind?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | undefined;
        accommodationClass?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | undefined;
        accommodationClassOther?: string | undefined;
        upi?: string | undefined;
        tourismLicenseNumber?: string | undefined;
        chamberOfTourismMember?: boolean | undefined;
        psfMember?: boolean | undefined;
        psfMembershipNumber?: string | undefined;
        psfApplication?: {
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
        } | undefined;
        psfOwnerPhotoKey?: string | undefined;
        eacStarGrade?: number | undefined;
        branches?: {
            name: string;
            address: {
                country: "RW";
                provinceId: number;
                districtId: number;
                sectorId: number;
                cellId?: number | undefined;
                villageId?: number | undefined;
                street?: string | undefined;
            };
        }[] | undefined;
    } | {
        domain: "residence";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        legalName: string;
        upi: string;
        residenceClass: "residential_landlord" | "residential_property_manager";
        franchise?: undefined;
        certificates?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[] | undefined;
        psfMembershipNumber?: undefined;
        psfApplication?: undefined;
        branches?: unknown[] | undefined;
    } | {
        domain: "enterprise";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        associationCode: string;
        legalName: string;
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
        tin?: string | undefined;
        certificates?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[] | undefined;
        psfMembershipNumber?: undefined;
        psfApplication?: undefined;
        branches?: unknown[] | undefined;
        registrationNumber?: string | undefined;
        ownerGroups?: ("women" | "youth" | "pwd")[] | undefined;
    };
    role: "enterprise" | "broker" | "host" | "landlord";
    personal?: {
        fullName: string;
        dateOfBirth: string;
        phoneE164: string;
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        } | {
            country: string;
            addressText: string;
        };
        document?: {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry?: "RW" | undefined;
        } | {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        } | undefined;
        gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
    } | undefined;
    capacity?: "owner" | "on_behalf_of" | undefined;
    intendedOwner?: {
        name: string;
        email: string;
        nationalId: string;
    } | undefined;
}>, {
    business: {
        domain: "hospitality";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        tin: string;
        legalName: string;
        certificates: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[];
        entityGroup: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism";
        chamberOfTourismMember: boolean;
        psfMember: boolean;
        branches: {
            name: string;
            address: {
                country: "RW";
                provinceId: number;
                districtId: number;
                sectorId: number;
                cellId?: number | undefined;
                villageId?: number | undefined;
                street?: string | undefined;
            };
        }[];
        franchise?: {
            role: "franchisee";
            brandName: string;
            franchisorLegalName: string;
            franchisorCountry: string;
        } | {
            role: "franchisor";
            brandName: string;
            franchisedLocations: number;
        } | undefined;
        businessKind?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | undefined;
        accommodationClass?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | undefined;
        accommodationClassOther?: string | undefined;
        upi?: string | undefined;
        tourismLicenseNumber?: string | undefined;
        psfMembershipNumber?: string | undefined;
        psfApplication?: {
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
        } | undefined;
        psfOwnerPhotoKey?: string | undefined;
        eacStarGrade?: number | undefined;
    } | {
        domain: "residence";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        legalName: string;
        certificates: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[];
        upi: string;
        residenceClass: "residential_landlord" | "residential_property_manager";
        franchise?: undefined;
        psfMembershipNumber?: undefined;
        psfApplication?: undefined;
        branches?: unknown[] | undefined;
    } | {
        domain: "enterprise";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        associationCode: string;
        legalName: string;
        certificates: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[];
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
        ownerGroups: ("women" | "youth" | "pwd")[];
        tin?: string | undefined;
        psfMembershipNumber?: undefined;
        psfApplication?: undefined;
        branches?: unknown[] | undefined;
        registrationNumber?: string | undefined;
    };
    capacity: "owner" | "on_behalf_of";
    role: "enterprise" | "broker" | "host" | "landlord";
    personal?: {
        fullName: string;
        dateOfBirth: string;
        phoneE164: string;
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        } | {
            country: string;
            addressText: string;
        };
        document?: {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry: "RW";
        } | {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        } | undefined;
        gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
    } | undefined;
    intendedOwner?: {
        name: string;
        email: string;
        nationalId: string;
    } | undefined;
}, {
    business: {
        domain: "hospitality";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        tin: string;
        legalName: string;
        franchise?: {
            role: "franchisee";
            brandName: string;
            franchisorLegalName: string;
            franchisorCountry: string;
        } | {
            role: "franchisor";
            brandName: string;
            franchisedLocations: number;
        } | undefined;
        certificates?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[] | undefined;
        entityGroup?: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism" | undefined;
        businessKind?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | undefined;
        accommodationClass?: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | undefined;
        accommodationClassOther?: string | undefined;
        upi?: string | undefined;
        tourismLicenseNumber?: string | undefined;
        chamberOfTourismMember?: boolean | undefined;
        psfMember?: boolean | undefined;
        psfMembershipNumber?: string | undefined;
        psfApplication?: {
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
        } | undefined;
        psfOwnerPhotoKey?: string | undefined;
        eacStarGrade?: number | undefined;
        branches?: {
            name: string;
            address: {
                country: "RW";
                provinceId: number;
                districtId: number;
                sectorId: number;
                cellId?: number | undefined;
                villageId?: number | undefined;
                street?: string | undefined;
            };
        }[] | undefined;
    } | {
        domain: "residence";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        legalName: string;
        upi: string;
        residenceClass: "residential_landlord" | "residential_property_manager";
        franchise?: undefined;
        certificates?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[] | undefined;
        psfMembershipNumber?: undefined;
        psfApplication?: undefined;
        branches?: unknown[] | undefined;
    } | {
        domain: "enterprise";
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        };
        associationCode: string;
        legalName: string;
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
        tin?: string | undefined;
        certificates?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[] | undefined;
        psfMembershipNumber?: undefined;
        psfApplication?: undefined;
        branches?: unknown[] | undefined;
        registrationNumber?: string | undefined;
        ownerGroups?: ("women" | "youth" | "pwd")[] | undefined;
    };
    role: "enterprise" | "broker" | "host" | "landlord";
    personal?: {
        fullName: string;
        dateOfBirth: string;
        phoneE164: string;
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        } | {
            country: string;
            addressText: string;
        };
        document?: {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry?: "RW" | undefined;
        } | {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        } | undefined;
        gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
    } | undefined;
    capacity?: "owner" | "on_behalf_of" | undefined;
    intendedOwner?: {
        name: string;
        email: string;
        nationalId: string;
    } | undefined;
}>;
export type CreateRegistrationRequest = z.infer<typeof CreateRegistrationRequest>;
/**
 * Why a registration was refused.
 *
 * A code, not a sentence, because F-S03 §6 promises a RESUMABLE rejection: the
 * wizard has to send the registrant back to the part that was wrong, and it
 * cannot read an officer's paragraph to work out which part that was. `notes`
 * carries the officer's own words alongside, and `other` is the honest escape.
 */
export declare const RegistrationRejectionReason: z.ZodEnum<["tin_not_found", "tin_mismatch", "premises_not_found", "documents_invalid", "documents_expired", "not_operating", "ownership_unclear", "duplicate_business", "other"]>;
export type RegistrationRejectionReason = z.infer<typeof RegistrationRejectionReason>;
/** What the registrant is told to go and fix. Ordered as the wizard's steps. */
export declare const REJECTION_REASON_LABEL: Readonly<Record<RegistrationRejectionReason, string>>;
/** Which step of the wizard a reason sends the registrant back to. */
export declare function stepForRejectionReason(reason: RegistrationRejectionReason): "identity" | "business" | "documents" | "none";
/**
 * The stage a review acted at: the status the org was IN, not the one it
 * reached. `tin_verified` is therefore the field verification gate and
 * `field_verified` the approval gate (D25).
 */
export declare const RegistrationReviewStage: z.ZodEnum<["tin_verified", "field_verified"]>;
export type RegistrationReviewStage = z.infer<typeof RegistrationReviewStage>;
export declare const RegistrationReviewDecision: z.ZodEnum<["passed", "rejected"]>;
export type RegistrationReviewDecision = z.infer<typeof RegistrationReviewDecision>;
/** One recorded decision, as the registrant and the console both read it. */
export declare const RegistrationReview: z.ZodObject<{
    stage: z.ZodEnum<["tin_verified", "field_verified"]>;
    decision: z.ZodEnum<["passed", "rejected"]>;
    oversightRole: z.ZodEnum<["tax_compliance_officer", "business_field_verifier", "business_approver", "psf_membership_officer", "village_leader", "dasso", "cell_executive", "district_officer", "district_immigration", "sector_executive", "dgie_province", "dgie_national", "dgie_village", "dgie_cell", "psf_business_officer"]>;
    /** The body and title AS OF the decision, never re-resolved (F-S03 §9). */
    governmentBodyCode: z.ZodString;
    governmentTitle: z.ZodNullable<z.ZodString>;
    reasonCode: z.ZodNullable<z.ZodEnum<["tin_not_found", "tin_mismatch", "premises_not_found", "documents_invalid", "documents_expired", "not_operating", "ownership_unclear", "duplicate_business", "other"]>>;
    notes: z.ZodNullable<z.ZodString>;
    decidedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    stage: "tin_verified" | "field_verified";
    decision: "rejected" | "passed";
    oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell" | "psf_business_officer";
    governmentBodyCode: string;
    governmentTitle: string | null;
    reasonCode: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
    notes: string | null;
    decidedAt: string;
}, {
    stage: "tin_verified" | "field_verified";
    decision: "rejected" | "passed";
    oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell" | "psf_business_officer";
    governmentBodyCode: string;
    governmentTitle: string | null;
    reasonCode: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
    notes: string | null;
    decidedAt: string;
}>;
export type RegistrationReview = z.infer<typeof RegistrationReview>;
/** Passing a gate. Notes are optional: a clean pass rarely needs prose. */
export declare const PassGateRequest: z.ZodObject<{
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    notes?: string | undefined;
}, {
    notes?: string | undefined;
}>;
export type PassGateRequest = z.infer<typeof PassGateRequest>;
/** Refusing at a gate. The reason is required; that is the whole point. */
export declare const RejectRegistrationRequest: z.ZodObject<{
    reasonCode: z.ZodEnum<["tin_not_found", "tin_mismatch", "premises_not_found", "documents_invalid", "documents_expired", "not_operating", "ownership_unclear", "duplicate_business", "other"]>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reasonCode: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business";
    notes?: string | undefined;
}, {
    reasonCode: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business";
    notes?: string | undefined;
}>;
export type RejectRegistrationRequest = z.infer<typeof RejectRegistrationRequest>;
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
export declare const OversightDocument: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other", "rdb_certificate", "psf_certificate", "land_title", "franchise_agreement"]>;
    /** Set only when `kind` is `other`; the database carries the same rule. */
    kindOther: z.ZodNullable<z.ZodString>;
    certificateNumber: z.ZodNullable<z.ZodString>;
    issuedBy: z.ZodNullable<z.ZodString>;
    issuedOn: z.ZodNullable<z.ZodString>;
    expiresOn: z.ZodNullable<z.ZodString>;
    /** Computed against the server's clock, never in the browser. */
    expired: z.ZodBoolean;
    mime: z.ZodNullable<z.ZodString>;
    sizeBytes: z.ZodNullable<z.ZodNumber>;
    url: z.ZodNullable<z.ZodString>;
    /** When a field verifier recorded that they had read this document. */
    checkedAt: z.ZodNullable<z.ZodString>;
    checkedByName: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    expired: boolean;
    id: string;
    kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
    kindOther: string | null;
    certificateNumber: string | null;
    issuedBy: string | null;
    issuedOn: string | null;
    expiresOn: string | null;
    mime: string | null;
    sizeBytes: number | null;
    url: string | null;
    checkedAt: string | null;
    checkedByName: string | null;
}, {
    expired: boolean;
    id: string;
    kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
    kindOther: string | null;
    certificateNumber: string | null;
    issuedBy: string | null;
    issuedOn: string | null;
    expiresOn: string | null;
    mime: string | null;
    sizeBytes: number | null;
    url: string | null;
    checkedAt: string | null;
    checkedByName: string | null;
}>;
export type OversightDocument = z.infer<typeof OversightDocument>;
/**
 * Every document on one registration, for the officer deciding its gate.
 *
 * `uncheckedCount` is what the field verification gate refuses on, so a console
 * can say how many are left instead of only reporting the refusal.
 */
export declare const OversightDocumentList: z.ZodObject<{
    orgId: z.ZodString;
    legalName: z.ZodString;
    status: z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>;
    documents: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other", "rdb_certificate", "psf_certificate", "land_title", "franchise_agreement"]>;
        /** Set only when `kind` is `other`; the database carries the same rule. */
        kindOther: z.ZodNullable<z.ZodString>;
        certificateNumber: z.ZodNullable<z.ZodString>;
        issuedBy: z.ZodNullable<z.ZodString>;
        issuedOn: z.ZodNullable<z.ZodString>;
        expiresOn: z.ZodNullable<z.ZodString>;
        /** Computed against the server's clock, never in the browser. */
        expired: z.ZodBoolean;
        mime: z.ZodNullable<z.ZodString>;
        sizeBytes: z.ZodNullable<z.ZodNumber>;
        url: z.ZodNullable<z.ZodString>;
        /** When a field verifier recorded that they had read this document. */
        checkedAt: z.ZodNullable<z.ZodString>;
        checkedByName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        expired: boolean;
        id: string;
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        kindOther: string | null;
        certificateNumber: string | null;
        issuedBy: string | null;
        issuedOn: string | null;
        expiresOn: string | null;
        mime: string | null;
        sizeBytes: number | null;
        url: string | null;
        checkedAt: string | null;
        checkedByName: string | null;
    }, {
        expired: boolean;
        id: string;
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        kindOther: string | null;
        certificateNumber: string | null;
        issuedBy: string | null;
        issuedOn: string | null;
        expiresOn: string | null;
        mime: string | null;
        sizeBytes: number | null;
        url: string | null;
        checkedAt: string | null;
        checkedByName: string | null;
    }>, "many">;
    uncheckedCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    legalName: string;
    documents: {
        expired: boolean;
        id: string;
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        kindOther: string | null;
        certificateNumber: string | null;
        issuedBy: string | null;
        issuedOn: string | null;
        expiresOn: string | null;
        mime: string | null;
        sizeBytes: number | null;
        url: string | null;
        checkedAt: string | null;
        checkedByName: string | null;
    }[];
    orgId: string;
    uncheckedCount: number;
}, {
    status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    legalName: string;
    documents: {
        expired: boolean;
        id: string;
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        kindOther: string | null;
        certificateNumber: string | null;
        issuedBy: string | null;
        issuedOn: string | null;
        expiresOn: string | null;
        mime: string | null;
        sizeBytes: number | null;
        url: string | null;
        checkedAt: string | null;
        checkedByName: string | null;
    }[];
    orgId: string;
    uncheckedCount: number;
}>;
export type OversightDocumentList = z.infer<typeof OversightDocumentList>;
/**
 * One business waiting on this officer.
 *
 * Carries the district so a console can group by it, and `waitingSince` so the
 * time-in-stage that F-S03 §5 tracks is visible to the person who can move it,
 * not only to an analyst.
 */
export declare const OversightQueueItem: z.ZodObject<{
    orgId: z.ZodString;
    legalName: z.ZodString;
    domain: z.ZodEnum<["hospitality", "residence", "enterprise"]>;
    accommodationClass: z.ZodNullable<z.ZodUnion<[z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other"]>, z.ZodEnum<["town_hotel", "vacation_hotel_resort", "serviced_apartment", "cottage"]>]>>;
    tin: z.ZodNullable<z.ZodString>;
    upi: z.ZodNullable<z.ZodString>;
    districtId: z.ZodNullable<z.ZodNumber>;
    districtName: z.ZodNullable<z.ZodString>;
    sectorName: z.ZodNullable<z.ZodString>;
    addressText: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>;
    waitingSince: z.ZodString;
    /**
     * True when this officer took the field verification and therefore may not
     * approve it. Sent so the console can explain the greyed-out button rather
     * than only refusing the click (separation of duties, F-S03 §9).
     */
    blockedBySeparationOfDuties: z.ZodBoolean;
    /**
     * The locations the business declared, head office first then by name
     * (ADR-054 AC-R4). Listed so the officer knows what they approve; no
     * branch district is asked to verify.
     */
    branches: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        districtName: z.ZodNullable<z.ZodString>;
        isHeadOffice: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        name: string;
        districtName: string | null;
        isHeadOffice: boolean;
    }, {
        name: string;
        districtName: string | null;
        isHeadOffice: boolean;
    }>, "many">;
    /**
     * How many documents this registration carries, and how many no officer has
     * read yet (F-S03 §5).
     *
     * On the ROW, not only in the file, because the console flags a document gap
     * in the list. It used to flag one whenever fewer than two documents were
     * present in a field the wire never filled, so every business was labelled
     * "Missing documents" — a warning that is on every row is not a warning.
     */
    documentCount: z.ZodNumber;
    uncheckedDocumentCount: z.ZodNumber;
    /**
     * What the registrant declared, sent so the queue stops flagging every
     * hotel "No tourism license" and every file "Missing documents" for want
     * of fields it was never given (registration Phase 0).
     */
    tourismLicenseNumber: z.ZodNullable<z.ZodString>;
    /** Registered by an agent for its owner; payouts stay locked until claimed. */
    onBehalfOf: z.ZodBoolean;
    /**
     * The certificates attached, as metadata only: kind and number. The files
     * are not linked here; opening one is a PII read with its own access log.
     */
    certificates: z.ZodArray<z.ZodObject<{
        kind: z.ZodString;
        kindOther: z.ZodNullable<z.ZodString>;
        certificateNumber: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: string;
        kindOther: string | null;
        certificateNumber: string | null;
    }, {
        kind: string;
        kindOther: string | null;
        certificateNumber: string | null;
    }>, "many">;
    /**
     * The latest RRA answer on record, with the side of the seam that gave it,
     * so an officer can tell a register's verdict from a mock's (ADR-060).
     */
    tinCheck: z.ZodNullable<z.ZodObject<{
        result: z.ZodEnum<["pending", "verified", "failed"]>;
        adapterMode: z.ZodEnum<["mock", "live"]>;
        checkedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        checkedAt: string;
        result: "pending" | "verified" | "failed";
        adapterMode: "mock" | "live";
    }, {
        checkedAt: string;
        result: "pending" | "verified" | "failed";
        adapterMode: "mock" | "live";
    }>>;
    /** Who registered it, by their verified name where there is one. */
    registrantName: z.ZodNullable<z.ZodString>;
    /** On an on behalf registration, the owner it was registered for. */
    intendedOwnerName: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    domain: "hospitality" | "residence" | "enterprise";
    districtName: string | null;
    districtId: number | null;
    addressText: string | null;
    tin: string | null;
    legalName: string;
    certificates: {
        kind: string;
        kindOther: string | null;
        certificateNumber: string | null;
    }[];
    accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
    upi: string | null;
    tourismLicenseNumber: string | null;
    branches: {
        name: string;
        districtName: string | null;
        isHeadOffice: boolean;
    }[];
    orgId: string;
    sectorName: string | null;
    waitingSince: string;
    blockedBySeparationOfDuties: boolean;
    documentCount: number;
    uncheckedDocumentCount: number;
    onBehalfOf: boolean;
    tinCheck: {
        checkedAt: string;
        result: "pending" | "verified" | "failed";
        adapterMode: "mock" | "live";
    } | null;
    registrantName: string | null;
    intendedOwnerName: string | null;
}, {
    status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    domain: "hospitality" | "residence" | "enterprise";
    districtName: string | null;
    districtId: number | null;
    addressText: string | null;
    tin: string | null;
    legalName: string;
    certificates: {
        kind: string;
        kindOther: string | null;
        certificateNumber: string | null;
    }[];
    accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
    upi: string | null;
    tourismLicenseNumber: string | null;
    branches: {
        name: string;
        districtName: string | null;
        isHeadOffice: boolean;
    }[];
    orgId: string;
    sectorName: string | null;
    waitingSince: string;
    blockedBySeparationOfDuties: boolean;
    documentCount: number;
    uncheckedDocumentCount: number;
    onBehalfOf: boolean;
    tinCheck: {
        checkedAt: string;
        result: "pending" | "verified" | "failed";
        adapterMode: "mock" | "live";
    } | null;
    registrantName: string | null;
    intendedOwnerName: string | null;
}>;
export type OversightQueueItem = z.infer<typeof OversightQueueItem>;
/**
 * One decision in an officer's own log: `GET /api/v1/oversight/decisions`
 * (ADR-053, AC-G6).
 *
 * The body and the title are the REVIEW ROW'S OWN COPIES, taken when the
 * decision was recorded, never re joined from the officer's assignment. A
 * revoked or re scoped posting must not rewrite a decision already taken, and
 * this log is the first screen that depends on that.
 */
export declare const OversightDecision: z.ZodObject<{
    reviewId: z.ZodString;
    orgId: z.ZodString;
    legalName: z.ZodString;
    /** The gate decided: `tin_verified` is field verification, `field_verified` approval. */
    stage: z.ZodEnum<["tin_verified", "field_verified"]>;
    decision: z.ZodEnum<["passed", "rejected"]>;
    /** Who decided it: a PSF District Manager's review is one step that approves (0119). */
    oversightRole: z.ZodOptional<z.ZodEnum<["business_field_verifier", "business_approver", "psf_membership_officer"]>>;
    reasonCode: z.ZodNullable<z.ZodEnum<["tin_not_found", "tin_mismatch", "premises_not_found", "documents_invalid", "documents_expired", "not_operating", "ownership_unclear", "duplicate_business", "other"]>>;
    notes: z.ZodNullable<z.ZodString>;
    governmentBodyCode: z.ZodString;
    governmentTitle: z.ZodNullable<z.ZodString>;
    decidedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    legalName: string;
    stage: "tin_verified" | "field_verified";
    decision: "rejected" | "passed";
    governmentBodyCode: string;
    governmentTitle: string | null;
    reasonCode: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
    notes: string | null;
    decidedAt: string;
    orgId: string;
    reviewId: string;
    oversightRole?: "business_field_verifier" | "business_approver" | "psf_membership_officer" | undefined;
}, {
    legalName: string;
    stage: "tin_verified" | "field_verified";
    decision: "rejected" | "passed";
    governmentBodyCode: string;
    governmentTitle: string | null;
    reasonCode: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
    notes: string | null;
    decidedAt: string;
    orgId: string;
    reviewId: string;
    oversightRole?: "business_field_verifier" | "business_approver" | "psf_membership_officer" | undefined;
}>;
export type OversightDecision = z.infer<typeof OversightDecision>;
/** A page of the log, newest first. `nextCursor` is null on the last page. */
export declare const OversightDecisionPage: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        reviewId: z.ZodString;
        orgId: z.ZodString;
        legalName: z.ZodString;
        /** The gate decided: `tin_verified` is field verification, `field_verified` approval. */
        stage: z.ZodEnum<["tin_verified", "field_verified"]>;
        decision: z.ZodEnum<["passed", "rejected"]>;
        /** Who decided it: a PSF District Manager's review is one step that approves (0119). */
        oversightRole: z.ZodOptional<z.ZodEnum<["business_field_verifier", "business_approver", "psf_membership_officer"]>>;
        reasonCode: z.ZodNullable<z.ZodEnum<["tin_not_found", "tin_mismatch", "premises_not_found", "documents_invalid", "documents_expired", "not_operating", "ownership_unclear", "duplicate_business", "other"]>>;
        notes: z.ZodNullable<z.ZodString>;
        governmentBodyCode: z.ZodString;
        governmentTitle: z.ZodNullable<z.ZodString>;
        decidedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        legalName: string;
        stage: "tin_verified" | "field_verified";
        decision: "rejected" | "passed";
        governmentBodyCode: string;
        governmentTitle: string | null;
        reasonCode: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
        notes: string | null;
        decidedAt: string;
        orgId: string;
        reviewId: string;
        oversightRole?: "business_field_verifier" | "business_approver" | "psf_membership_officer" | undefined;
    }, {
        legalName: string;
        stage: "tin_verified" | "field_verified";
        decision: "rejected" | "passed";
        governmentBodyCode: string;
        governmentTitle: string | null;
        reasonCode: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
        notes: string | null;
        decidedAt: string;
        orgId: string;
        reviewId: string;
        oversightRole?: "business_field_verifier" | "business_approver" | "psf_membership_officer" | undefined;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        legalName: string;
        stage: "tin_verified" | "field_verified";
        decision: "rejected" | "passed";
        governmentBodyCode: string;
        governmentTitle: string | null;
        reasonCode: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
        notes: string | null;
        decidedAt: string;
        orgId: string;
        reviewId: string;
        oversightRole?: "business_field_verifier" | "business_approver" | "psf_membership_officer" | undefined;
    }[];
    nextCursor: string | null;
}, {
    items: {
        legalName: string;
        stage: "tin_verified" | "field_verified";
        decision: "rejected" | "passed";
        governmentBodyCode: string;
        governmentTitle: string | null;
        reasonCode: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
        notes: string | null;
        decidedAt: string;
        orgId: string;
        reviewId: string;
        oversightRole?: "business_field_verifier" | "business_approver" | "psf_membership_officer" | undefined;
    }[];
    nextCursor: string | null;
}>;
export type OversightDecisionPage = z.infer<typeof OversightDecisionPage>;
/** The page to read. No cursor is the newest page; a malformed one is too. */
export declare const OversightDecisionQuery: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    cursor?: string | undefined;
}, {
    cursor?: string | undefined;
}>;
export type OversightDecisionQuery = z.infer<typeof OversightDecisionQuery>;
/** What the pending workspace renders: the stage, and what is owed. */
export declare const RegistrationSummary: z.ZodObject<{
    orgId: z.ZodString;
    workspaceId: z.ZodString;
    legalName: z.ZodString;
    domain: z.ZodEnum<["hospitality", "residence", "enterprise"]>;
    /**
     * What kind of business it is (ADR-075 D-h): the noun the register's heading and status page say.
     * Null for a PSF business (`enterprise`), which is not a place.
     */
    businessKind: z.ZodNullable<z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other", "bar_restaurant", "coffee_shop", "residence", "broker"]>>;
    accommodationClass: z.ZodNullable<z.ZodUnion<[z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other"]>, z.ZodEnum<["town_hotel", "vacation_hotel_resort", "serviced_apartment", "cottage"]>]>>;
    status: z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>;
    /** Set only while `status` is `pending_payment`. */
    amountDueRwf: z.ZodNullable<z.ZodNumber>;
    /** The invoice to settle, when one is outstanding. */
    invoiceId: z.ZodNullable<z.ZodString>;
    /** Reason code from the rejecting stage, when `status` is `rejected`. */
    rejectionReason: z.ZodNullable<z.ZodEnum<["tin_not_found", "tin_mismatch", "premises_not_found", "documents_invalid", "documents_expired", "not_operating", "ownership_unclear", "duplicate_business", "other"]>>;
    /** The reviewing officer's own words, when they left any. */
    rejectionNotes: z.ZodNullable<z.ZodString>;
    submittedAt: z.ZodNullable<z.ZodString>;
    /**
     * The operator contract a business accepted before paying, and when (ADR-053, AC-R8), kept readable for the
     * businesses that did. ADR-075 removed that step: a registration made since carries neither, and its
     * agreement is signed after approval (A3).
     */
    contractVersion: z.ZodNullable<z.ZodString>;
    contractAcceptedAt: z.ZodNullable<z.ZodString>;
    /**
     * Whether payouts wait on the owner's identity being verified (ADR-053,
     * AC-R1). Null for a business nobody registered on behalf of anyone else.
     */
    payoutLocked: z.ZodNullable<z.ZodBoolean>;
    /**
     * The business's code, its district's letters and a number (`KIC0001`),
     * given when the registration fee is paid. Null until then. Optional on the
     * wire so a client still parses a summary from an API built before it.
     */
    businessCode: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    domain: "hospitality" | "residence" | "enterprise";
    legalName: string;
    businessKind: "residence" | "broker" | "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | null;
    accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
    orgId: string;
    workspaceId: string;
    amountDueRwf: number | null;
    invoiceId: string | null;
    rejectionReason: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
    rejectionNotes: string | null;
    submittedAt: string | null;
    contractVersion: string | null;
    contractAcceptedAt: string | null;
    payoutLocked: boolean | null;
    businessCode: string | null;
}, {
    status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    domain: "hospitality" | "residence" | "enterprise";
    legalName: string;
    businessKind: "residence" | "broker" | "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | null;
    accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
    orgId: string;
    workspaceId: string;
    amountDueRwf: number | null;
    invoiceId: string | null;
    rejectionReason: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
    rejectionNotes: string | null;
    submittedAt: string | null;
    contractVersion: string | null;
    contractAcceptedAt: string | null;
    payoutLocked: boolean | null;
    businessCode?: string | null | undefined;
}>;
export type RegistrationSummary = z.infer<typeof RegistrationSummary>;
/**
 * The operator contract's version: the date its terms last changed (ADR-053).
 *
 * The document is rendered from code, so the version lives in code too. A
 * version stored anywhere else can drift from the document it names. Change
 * this in the same commit as the clause copy, and only then.
 */
export declare const OPERATOR_CONTRACT_VERSION = "2026-09-12";
/**
 * Why a registrant action was refused, sent as `code` on the error body so a page can word the refusal without
 * matching on English. The contract codes went with the contract before payment (ADR-075, AC-12).
 */
export declare const RegistrationConflictCode: z.ZodEnum<["identity_not_verified"]>;
export type RegistrationConflictCode = z.infer<typeof RegistrationConflictCode>;
/**
 * `POST /api/v1/registrations/tin-check`. Asked at the Business step, before
 * anything is created or billed, so a TIN RRA will refuse is found while the
 * registrant can still change it rather than after a non-refundable fee.
 */
export declare const TinCheckRequest: z.ZodObject<{
    tin: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    /**
     * Who is asking (ADR-075 AC-7). The directors' NAMES come back only for the
     * helper ("For the owner"), who picks the owner from them. On the owner path
     * they do not: the name matched there may be typed, and showing the names
     * first would let anyone type one. The owner learns only listed or not.
     */
    capacity: z.ZodOptional<z.ZodEnum<["owner", "on_behalf_of"]>>;
}, "strip", z.ZodTypeAny, {
    tin: string;
    capacity?: "owner" | "on_behalf_of" | undefined;
}, {
    tin: string;
    capacity?: "owner" | "on_behalf_of" | undefined;
}>;
export type TinCheckRequest = z.infer<typeof TinCheckRequest>;
/**
 * A business as the company register states it (ADR-060). Directors are NAMES
 * only: their document numbers stay on the server, which compares them.
 */
export declare const RegistryBusiness: z.ZodObject<{
    legalName: z.ZodString;
    /** `YYYY-MM-DD`, when the register gives one. */
    registeredOn: z.ZodNullable<z.ZodString>;
    companyType: z.ZodNullable<z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>>;
    /** The registered address, as geography ids the picker can take directly. */
    address: z.ZodNullable<z.ZodObject<{
        provinceId: z.ZodNumber;
        districtId: z.ZodNumber;
        sectorId: z.ZodNumber;
        street: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        provinceId: number;
        districtId: number;
        sectorId: number;
        street: string | null;
    }, {
        provinceId: number;
        districtId: number;
        sectorId: number;
        street: string | null;
    }>>;
    /** Empty unless the request named the helper capacity (ADR-075 AC-7). */
    directors: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
    }, {
        name: string;
    }>, "many">;
    /** True when a MOCK adapter made this business up. */
    generated: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    address: {
        provinceId: number;
        districtId: number;
        sectorId: number;
        street: string | null;
    } | null;
    companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader" | null;
    legalName: string;
    registeredOn: string | null;
    directors: {
        name: string;
    }[];
    generated: boolean;
}, {
    address: {
        provinceId: number;
        districtId: number;
        sectorId: number;
        street: string | null;
    } | null;
    companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader" | null;
    legalName: string;
    registeredOn: string | null;
    directors: {
        name: string;
    }[];
    generated: boolean;
}>;
export type RegistryBusiness = z.infer<typeof RegistryBusiness>;
/**
 * - `verified`: RRA knows the TIN.
 * - `failed`: RRA does not; registration with it is refused.
 * - `taken`: another business on Injishi already holds it.
 * - `pending`: RRA could not be reached. Not a refusal: the check runs again
 *   after payment, exactly as it did before this pre-check existed.
 */
export declare const TinCheckResult: z.ZodObject<{
    tin: z.ZodString;
    result: z.ZodEnum<["verified", "failed", "taken", "pending"]>;
    message: z.ZodString;
    /**
     * The business as the register holds it (ADR-060), or null when the
     * register returned no details. The Business step fills itself from this
     * and locks the legal name; `create` refuses a legal name that disagrees.
     */
    business: z.ZodNullable<z.ZodObject<{
        legalName: z.ZodString;
        /** `YYYY-MM-DD`, when the register gives one. */
        registeredOn: z.ZodNullable<z.ZodString>;
        companyType: z.ZodNullable<z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>>;
        /** The registered address, as geography ids the picker can take directly. */
        address: z.ZodNullable<z.ZodObject<{
            provinceId: z.ZodNumber;
            districtId: z.ZodNumber;
            sectorId: z.ZodNumber;
            street: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            provinceId: number;
            districtId: number;
            sectorId: number;
            street: string | null;
        }, {
            provinceId: number;
            districtId: number;
            sectorId: number;
            street: string | null;
        }>>;
        /** Empty unless the request named the helper capacity (ADR-075 AC-7). */
        directors: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
        }, {
            name: string;
        }>, "many">;
        /** True when a MOCK adapter made this business up. */
        generated: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        address: {
            provinceId: number;
            districtId: number;
            sectorId: number;
            street: string | null;
        } | null;
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader" | null;
        legalName: string;
        registeredOn: string | null;
        directors: {
            name: string;
        }[];
        generated: boolean;
    }, {
        address: {
            provinceId: number;
            districtId: number;
            sectorId: number;
            street: string | null;
        } | null;
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader" | null;
        legalName: string;
        registeredOn: string | null;
        directors: {
            name: string;
        }[];
        generated: boolean;
    }>>;
    /**
     * Whether the caller's own document, scanned or typed, is among the
     * directors. Null when the register lists no directors, or the caller holds
     * no document yet. `false` is what moves a registrant to the on behalf
     * path. The wizard's answer is never the record: create matches again.
     */
    registrantIsDirector: z.ZodNullable<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    message: string;
    business: {
        address: {
            provinceId: number;
            districtId: number;
            sectorId: number;
            street: string | null;
        } | null;
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader" | null;
        legalName: string;
        registeredOn: string | null;
        directors: {
            name: string;
        }[];
        generated: boolean;
    } | null;
    tin: string;
    result: "pending" | "verified" | "failed" | "taken";
    registrantIsDirector: boolean | null;
}, {
    message: string;
    business: {
        address: {
            provinceId: number;
            districtId: number;
            sectorId: number;
            street: string | null;
        } | null;
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader" | null;
        legalName: string;
        registeredOn: string | null;
        directors: {
            name: string;
        }[];
        generated: boolean;
    } | null;
    tin: string;
    result: "pending" | "verified" | "failed" | "taken";
    registrantIsDirector: boolean | null;
}>;
export type TinCheckResult = z.infer<typeof TinCheckResult>;
/**
 * `POST /api/v1/orgs/:orgId/claim/preview` and `/claim`. The token from the
 * invitation mail, in the body so it never lands in the API's access log.
 */
export declare const ClaimOrgRequest: z.ZodObject<{
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
}, {
    token: string;
}>;
export type ClaimOrgRequest = z.infer<typeof ClaimOrgRequest>;
/**
 * What `/claim-org` shows before the owner commits.
 *
 * Only what the invitation mail already told whoever holds the token: the
 * business, where it is, where it got to and who registered it. Never the
 * national id, an email or the TIN.
 */
export declare const ClaimPreview: z.ZodObject<{
    orgId: z.ZodString;
    legalName: z.ZodString;
    districtName: z.ZodNullable<z.ZodString>;
    registrationStatus: z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>;
    registrantName: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    districtName: string | null;
    legalName: string;
    orgId: string;
    registrantName: string | null;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
}, {
    districtName: string | null;
    legalName: string;
    orgId: string;
    registrantName: string | null;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
}>;
export type ClaimPreview = z.infer<typeof ClaimPreview>;
/** The fee a registrant is quoted, read from the effective-dated catalog. */
export declare const RegistrationFeeQuote: z.ZodObject<{
    businessType: z.ZodEnum<["hospitality", "residence", "broker", "enterprise"]>;
    amountRwf: z.ZodNumber;
    currency: z.ZodLiteral<"RWF">;
}, "strip", z.ZodTypeAny, {
    amountRwf: number;
    businessType: "hospitality" | "residence" | "enterprise" | "broker";
    currency: "RWF";
}, {
    amountRwf: number;
    businessType: "hospitality" | "residence" | "enterprise" | "broker";
    currency: "RWF";
}>;
export type RegistrationFeeQuote = z.infer<typeof RegistrationFeeQuote>;
/**
 * One press of pay. Both fields are optional because the fee settles free
 * while payments are off (call 9), and then there is nothing to prompt; when
 * money is taken, the server refuses a body missing either with a 422.
 */
export declare const RegistrationPayRequest: z.ZodObject<{
    /** Minted once per press and reused on every retry of that press. */
    attemptToken: z.ZodOptional<z.ZodString>;
    /** The registrant's mobile money number. A card is refused. */
    instrument: z.ZodOptional<z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
        kind: z.ZodLiteral<"mobile_money">;
        network: z.ZodEnum<["mtn_momo", "airtel_money"]>;
        msisdn: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        network: "mtn_momo" | "airtel_money";
        kind: "mobile_money";
        msisdn: string;
    }, {
        network: "mtn_momo" | "airtel_money";
        kind: "mobile_money";
        msisdn: string;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"card">;
        token: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        kind: "card";
        token: string;
    }, {
        kind: "card";
        token: string;
    }>]>>;
}, "strip", z.ZodTypeAny, {
    attemptToken?: string | undefined;
    instrument?: {
        network: "mtn_momo" | "airtel_money";
        kind: "mobile_money";
        msisdn: string;
    } | {
        kind: "card";
        token: string;
    } | undefined;
}, {
    attemptToken?: string | undefined;
    instrument?: {
        network: "mtn_momo" | "airtel_money";
        kind: "mobile_money";
        msisdn: string;
    } | {
        kind: "card";
        token: string;
    } | undefined;
}>;
export type RegistrationPayRequest = z.infer<typeof RegistrationPayRequest>;
/** A fee payment waiting on the registrant's handset, as the wizard watches it. */
export declare const RegistrationFeeAttemptStatus: z.ZodObject<{
    attemptToken: z.ZodString;
    state: z.ZodEnum<["prompting", "confirmed", "refused", "expired"]>;
    network: z.ZodNullable<z.ZodEnum<["mtn_momo", "airtel_money"]>>;
    /** Masked: enough to recognise, never enough to charge. */
    payerMasked: z.ZodNullable<z.ZodString>;
    amountRwf: z.ZodNullable<z.ZodNumber>;
    expiresAt: z.ZodString;
    failureReason: z.ZodNullable<z.ZodString>;
    /** The registration as it stands now: `submitted` once the fee settled. */
    registration: z.ZodObject<{
        orgId: z.ZodString;
        workspaceId: z.ZodString;
        legalName: z.ZodString;
        domain: z.ZodEnum<["hospitality", "residence", "enterprise"]>;
        /**
         * What kind of business it is (ADR-075 D-h): the noun the register's heading and status page say.
         * Null for a PSF business (`enterprise`), which is not a place.
         */
        businessKind: z.ZodNullable<z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other", "bar_restaurant", "coffee_shop", "residence", "broker"]>>;
        accommodationClass: z.ZodNullable<z.ZodUnion<[z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other"]>, z.ZodEnum<["town_hotel", "vacation_hotel_resort", "serviced_apartment", "cottage"]>]>>;
        status: z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>;
        /** Set only while `status` is `pending_payment`. */
        amountDueRwf: z.ZodNullable<z.ZodNumber>;
        /** The invoice to settle, when one is outstanding. */
        invoiceId: z.ZodNullable<z.ZodString>;
        /** Reason code from the rejecting stage, when `status` is `rejected`. */
        rejectionReason: z.ZodNullable<z.ZodEnum<["tin_not_found", "tin_mismatch", "premises_not_found", "documents_invalid", "documents_expired", "not_operating", "ownership_unclear", "duplicate_business", "other"]>>;
        /** The reviewing officer's own words, when they left any. */
        rejectionNotes: z.ZodNullable<z.ZodString>;
        submittedAt: z.ZodNullable<z.ZodString>;
        /**
         * The operator contract a business accepted before paying, and when (ADR-053, AC-R8), kept readable for the
         * businesses that did. ADR-075 removed that step: a registration made since carries neither, and its
         * agreement is signed after approval (A3).
         */
        contractVersion: z.ZodNullable<z.ZodString>;
        contractAcceptedAt: z.ZodNullable<z.ZodString>;
        /**
         * Whether payouts wait on the owner's identity being verified (ADR-053,
         * AC-R1). Null for a business nobody registered on behalf of anyone else.
         */
        payoutLocked: z.ZodNullable<z.ZodBoolean>;
        /**
         * The business's code, its district's letters and a number (`KIC0001`),
         * given when the registration fee is paid. Null until then. Optional on the
         * wire so a client still parses a summary from an API built before it.
         */
        businessCode: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        domain: "hospitality" | "residence" | "enterprise";
        legalName: string;
        businessKind: "residence" | "broker" | "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | null;
        accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
        orgId: string;
        workspaceId: string;
        amountDueRwf: number | null;
        invoiceId: string | null;
        rejectionReason: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
        rejectionNotes: string | null;
        submittedAt: string | null;
        contractVersion: string | null;
        contractAcceptedAt: string | null;
        payoutLocked: boolean | null;
        businessCode: string | null;
    }, {
        status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        domain: "hospitality" | "residence" | "enterprise";
        legalName: string;
        businessKind: "residence" | "broker" | "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | null;
        accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
        orgId: string;
        workspaceId: string;
        amountDueRwf: number | null;
        invoiceId: string | null;
        rejectionReason: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
        rejectionNotes: string | null;
        submittedAt: string | null;
        contractVersion: string | null;
        contractAcceptedAt: string | null;
        payoutLocked: boolean | null;
        businessCode?: string | null | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    network: "mtn_momo" | "airtel_money" | null;
    attemptToken: string;
    state: "confirmed" | "expired" | "prompting" | "refused";
    payerMasked: string | null;
    amountRwf: number | null;
    expiresAt: string;
    failureReason: string | null;
    registration: {
        status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        domain: "hospitality" | "residence" | "enterprise";
        legalName: string;
        businessKind: "residence" | "broker" | "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | null;
        accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
        orgId: string;
        workspaceId: string;
        amountDueRwf: number | null;
        invoiceId: string | null;
        rejectionReason: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
        rejectionNotes: string | null;
        submittedAt: string | null;
        contractVersion: string | null;
        contractAcceptedAt: string | null;
        payoutLocked: boolean | null;
        businessCode: string | null;
    };
}, {
    network: "mtn_momo" | "airtel_money" | null;
    attemptToken: string;
    state: "confirmed" | "expired" | "prompting" | "refused";
    payerMasked: string | null;
    amountRwf: number | null;
    expiresAt: string;
    failureReason: string | null;
    registration: {
        status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        domain: "hospitality" | "residence" | "enterprise";
        legalName: string;
        businessKind: "residence" | "broker" | "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | null;
        accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
        orgId: string;
        workspaceId: string;
        amountDueRwf: number | null;
        invoiceId: string | null;
        rejectionReason: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
        rejectionNotes: string | null;
        submittedAt: string | null;
        contractVersion: string | null;
        contractAcceptedAt: string | null;
        payoutLocked: boolean | null;
        businessCode?: string | null | undefined;
    };
}>;
export type RegistrationFeeAttemptStatus = z.infer<typeof RegistrationFeeAttemptStatus>;
/**
 * What the pay press answers: settled at once (the free path, or an
 * instrument that settled inside the call), or an attempt to wait on.
 */
export declare const RegistrationPayResult: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"settled">;
    registration: z.ZodObject<{
        orgId: z.ZodString;
        workspaceId: z.ZodString;
        legalName: z.ZodString;
        domain: z.ZodEnum<["hospitality", "residence", "enterprise"]>;
        /**
         * What kind of business it is (ADR-075 D-h): the noun the register's heading and status page say.
         * Null for a PSF business (`enterprise`), which is not a place.
         */
        businessKind: z.ZodNullable<z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other", "bar_restaurant", "coffee_shop", "residence", "broker"]>>;
        accommodationClass: z.ZodNullable<z.ZodUnion<[z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other"]>, z.ZodEnum<["town_hotel", "vacation_hotel_resort", "serviced_apartment", "cottage"]>]>>;
        status: z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>;
        /** Set only while `status` is `pending_payment`. */
        amountDueRwf: z.ZodNullable<z.ZodNumber>;
        /** The invoice to settle, when one is outstanding. */
        invoiceId: z.ZodNullable<z.ZodString>;
        /** Reason code from the rejecting stage, when `status` is `rejected`. */
        rejectionReason: z.ZodNullable<z.ZodEnum<["tin_not_found", "tin_mismatch", "premises_not_found", "documents_invalid", "documents_expired", "not_operating", "ownership_unclear", "duplicate_business", "other"]>>;
        /** The reviewing officer's own words, when they left any. */
        rejectionNotes: z.ZodNullable<z.ZodString>;
        submittedAt: z.ZodNullable<z.ZodString>;
        /**
         * The operator contract a business accepted before paying, and when (ADR-053, AC-R8), kept readable for the
         * businesses that did. ADR-075 removed that step: a registration made since carries neither, and its
         * agreement is signed after approval (A3).
         */
        contractVersion: z.ZodNullable<z.ZodString>;
        contractAcceptedAt: z.ZodNullable<z.ZodString>;
        /**
         * Whether payouts wait on the owner's identity being verified (ADR-053,
         * AC-R1). Null for a business nobody registered on behalf of anyone else.
         */
        payoutLocked: z.ZodNullable<z.ZodBoolean>;
        /**
         * The business's code, its district's letters and a number (`KIC0001`),
         * given when the registration fee is paid. Null until then. Optional on the
         * wire so a client still parses a summary from an API built before it.
         */
        businessCode: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        domain: "hospitality" | "residence" | "enterprise";
        legalName: string;
        businessKind: "residence" | "broker" | "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | null;
        accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
        orgId: string;
        workspaceId: string;
        amountDueRwf: number | null;
        invoiceId: string | null;
        rejectionReason: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
        rejectionNotes: string | null;
        submittedAt: string | null;
        contractVersion: string | null;
        contractAcceptedAt: string | null;
        payoutLocked: boolean | null;
        businessCode: string | null;
    }, {
        status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        domain: "hospitality" | "residence" | "enterprise";
        legalName: string;
        businessKind: "residence" | "broker" | "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | null;
        accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
        orgId: string;
        workspaceId: string;
        amountDueRwf: number | null;
        invoiceId: string | null;
        rejectionReason: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
        rejectionNotes: string | null;
        submittedAt: string | null;
        contractVersion: string | null;
        contractAcceptedAt: string | null;
        payoutLocked: boolean | null;
        businessCode?: string | null | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    kind: "settled";
    registration: {
        status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        domain: "hospitality" | "residence" | "enterprise";
        legalName: string;
        businessKind: "residence" | "broker" | "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | null;
        accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
        orgId: string;
        workspaceId: string;
        amountDueRwf: number | null;
        invoiceId: string | null;
        rejectionReason: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
        rejectionNotes: string | null;
        submittedAt: string | null;
        contractVersion: string | null;
        contractAcceptedAt: string | null;
        payoutLocked: boolean | null;
        businessCode: string | null;
    };
}, {
    kind: "settled";
    registration: {
        status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
        domain: "hospitality" | "residence" | "enterprise";
        legalName: string;
        businessKind: "residence" | "broker" | "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | null;
        accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
        orgId: string;
        workspaceId: string;
        amountDueRwf: number | null;
        invoiceId: string | null;
        rejectionReason: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
        rejectionNotes: string | null;
        submittedAt: string | null;
        contractVersion: string | null;
        contractAcceptedAt: string | null;
        payoutLocked: boolean | null;
        businessCode?: string | null | undefined;
    };
}>, z.ZodObject<{
    kind: z.ZodLiteral<"attempt">;
    attempt: z.ZodObject<{
        attemptToken: z.ZodString;
        state: z.ZodEnum<["prompting", "confirmed", "refused", "expired"]>;
        network: z.ZodNullable<z.ZodEnum<["mtn_momo", "airtel_money"]>>;
        /** Masked: enough to recognise, never enough to charge. */
        payerMasked: z.ZodNullable<z.ZodString>;
        amountRwf: z.ZodNullable<z.ZodNumber>;
        expiresAt: z.ZodString;
        failureReason: z.ZodNullable<z.ZodString>;
        /** The registration as it stands now: `submitted` once the fee settled. */
        registration: z.ZodObject<{
            orgId: z.ZodString;
            workspaceId: z.ZodString;
            legalName: z.ZodString;
            domain: z.ZodEnum<["hospitality", "residence", "enterprise"]>;
            /**
             * What kind of business it is (ADR-075 D-h): the noun the register's heading and status page say.
             * Null for a PSF business (`enterprise`), which is not a place.
             */
            businessKind: z.ZodNullable<z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other", "bar_restaurant", "coffee_shop", "residence", "broker"]>>;
            accommodationClass: z.ZodNullable<z.ZodUnion<[z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other"]>, z.ZodEnum<["town_hotel", "vacation_hotel_resort", "serviced_apartment", "cottage"]>]>>;
            status: z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>;
            /** Set only while `status` is `pending_payment`. */
            amountDueRwf: z.ZodNullable<z.ZodNumber>;
            /** The invoice to settle, when one is outstanding. */
            invoiceId: z.ZodNullable<z.ZodString>;
            /** Reason code from the rejecting stage, when `status` is `rejected`. */
            rejectionReason: z.ZodNullable<z.ZodEnum<["tin_not_found", "tin_mismatch", "premises_not_found", "documents_invalid", "documents_expired", "not_operating", "ownership_unclear", "duplicate_business", "other"]>>;
            /** The reviewing officer's own words, when they left any. */
            rejectionNotes: z.ZodNullable<z.ZodString>;
            submittedAt: z.ZodNullable<z.ZodString>;
            /**
             * The operator contract a business accepted before paying, and when (ADR-053, AC-R8), kept readable for the
             * businesses that did. ADR-075 removed that step: a registration made since carries neither, and its
             * agreement is signed after approval (A3).
             */
            contractVersion: z.ZodNullable<z.ZodString>;
            contractAcceptedAt: z.ZodNullable<z.ZodString>;
            /**
             * Whether payouts wait on the owner's identity being verified (ADR-053,
             * AC-R1). Null for a business nobody registered on behalf of anyone else.
             */
            payoutLocked: z.ZodNullable<z.ZodBoolean>;
            /**
             * The business's code, its district's letters and a number (`KIC0001`),
             * given when the registration fee is paid. Null until then. Optional on the
             * wire so a client still parses a summary from an API built before it.
             */
            businessCode: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
            domain: "hospitality" | "residence" | "enterprise";
            legalName: string;
            businessKind: "residence" | "broker" | "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | null;
            accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
            orgId: string;
            workspaceId: string;
            amountDueRwf: number | null;
            invoiceId: string | null;
            rejectionReason: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
            rejectionNotes: string | null;
            submittedAt: string | null;
            contractVersion: string | null;
            contractAcceptedAt: string | null;
            payoutLocked: boolean | null;
            businessCode: string | null;
        }, {
            status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
            domain: "hospitality" | "residence" | "enterprise";
            legalName: string;
            businessKind: "residence" | "broker" | "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | null;
            accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
            orgId: string;
            workspaceId: string;
            amountDueRwf: number | null;
            invoiceId: string | null;
            rejectionReason: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
            rejectionNotes: string | null;
            submittedAt: string | null;
            contractVersion: string | null;
            contractAcceptedAt: string | null;
            payoutLocked: boolean | null;
            businessCode?: string | null | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        network: "mtn_momo" | "airtel_money" | null;
        attemptToken: string;
        state: "confirmed" | "expired" | "prompting" | "refused";
        payerMasked: string | null;
        amountRwf: number | null;
        expiresAt: string;
        failureReason: string | null;
        registration: {
            status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
            domain: "hospitality" | "residence" | "enterprise";
            legalName: string;
            businessKind: "residence" | "broker" | "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | null;
            accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
            orgId: string;
            workspaceId: string;
            amountDueRwf: number | null;
            invoiceId: string | null;
            rejectionReason: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
            rejectionNotes: string | null;
            submittedAt: string | null;
            contractVersion: string | null;
            contractAcceptedAt: string | null;
            payoutLocked: boolean | null;
            businessCode: string | null;
        };
    }, {
        network: "mtn_momo" | "airtel_money" | null;
        attemptToken: string;
        state: "confirmed" | "expired" | "prompting" | "refused";
        payerMasked: string | null;
        amountRwf: number | null;
        expiresAt: string;
        failureReason: string | null;
        registration: {
            status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
            domain: "hospitality" | "residence" | "enterprise";
            legalName: string;
            businessKind: "residence" | "broker" | "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | null;
            accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
            orgId: string;
            workspaceId: string;
            amountDueRwf: number | null;
            invoiceId: string | null;
            rejectionReason: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
            rejectionNotes: string | null;
            submittedAt: string | null;
            contractVersion: string | null;
            contractAcceptedAt: string | null;
            payoutLocked: boolean | null;
            businessCode?: string | null | undefined;
        };
    }>;
}, "strip", z.ZodTypeAny, {
    kind: "attempt";
    attempt: {
        network: "mtn_momo" | "airtel_money" | null;
        attemptToken: string;
        state: "confirmed" | "expired" | "prompting" | "refused";
        payerMasked: string | null;
        amountRwf: number | null;
        expiresAt: string;
        failureReason: string | null;
        registration: {
            status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
            domain: "hospitality" | "residence" | "enterprise";
            legalName: string;
            businessKind: "residence" | "broker" | "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | null;
            accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
            orgId: string;
            workspaceId: string;
            amountDueRwf: number | null;
            invoiceId: string | null;
            rejectionReason: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
            rejectionNotes: string | null;
            submittedAt: string | null;
            contractVersion: string | null;
            contractAcceptedAt: string | null;
            payoutLocked: boolean | null;
            businessCode: string | null;
        };
    };
}, {
    kind: "attempt";
    attempt: {
        network: "mtn_momo" | "airtel_money" | null;
        attemptToken: string;
        state: "confirmed" | "expired" | "prompting" | "refused";
        payerMasked: string | null;
        amountRwf: number | null;
        expiresAt: string;
        failureReason: string | null;
        registration: {
            status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
            domain: "hospitality" | "residence" | "enterprise";
            legalName: string;
            businessKind: "residence" | "broker" | "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop" | null;
            accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
            orgId: string;
            workspaceId: string;
            amountDueRwf: number | null;
            invoiceId: string | null;
            rejectionReason: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
            rejectionNotes: string | null;
            submittedAt: string | null;
            contractVersion: string | null;
            contractAcceptedAt: string | null;
            payoutLocked: boolean | null;
            businessCode?: string | null | undefined;
        };
    };
}>]>;
export type RegistrationPayResult = z.infer<typeof RegistrationPayResult>;
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
export declare const MyProfileDocument: z.ZodObject<{
    documentType: z.ZodEnum<["national_id", "passport"]>;
    /** Last four characters, prefixed with a bullet run, e.g. `••••1234`. */
    documentNumberMasked: z.ZodString;
    issuingCountry: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    documentType: "national_id" | "passport";
    issuingCountry: string;
    documentNumberMasked: string;
}, {
    documentType: "national_id" | "passport";
    issuingCountry: string;
    documentNumberMasked: string;
}>;
export type MyProfileDocument = z.infer<typeof MyProfileDocument>;
export declare const MyProfile: z.ZodObject<{
    fullName: z.ZodNullable<z.ZodString>;
    gender: z.ZodNullable<z.ZodEnum<["female", "male", "other", "prefer_not_to_say"]>>;
    dateOfBirth: z.ZodNullable<z.ZodString>;
    phoneE164: z.ZodNullable<z.ZodString>;
    document: z.ZodNullable<z.ZodObject<{
        documentType: z.ZodEnum<["national_id", "passport"]>;
        /** Last four characters, prefixed with a bullet run, e.g. `••••1234`. */
        documentNumberMasked: z.ZodString;
        issuingCountry: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        documentNumberMasked: string;
    }, {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        documentNumberMasked: string;
    }>>;
    address: z.ZodNullable<z.ZodUnion<[z.ZodObject<{
        country: z.ZodLiteral<"RW">;
        provinceId: z.ZodNumber;
        districtId: z.ZodNumber;
        sectorId: z.ZodNumber;
        /** Fourth level. Collected to drive the village picker, never stored. */
        cellId: z.ZodOptional<z.ZodNumber>;
        /** Fifth level, and the finest one. Stored; see `orgs.village_id`. */
        villageId: z.ZodOptional<z.ZodNumber>;
        /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
        street: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    }, {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    }>, z.ZodObject<{
        country: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        /** The whole address as written locally. Formats differ too much to split. */
        addressText: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        country: string;
        addressText: string;
    }, {
        country: string;
        addressText: string;
    }>]>>;
    /**
     * Whether Step 1 is answered well enough to register a business.
     *
     * Served rather than re-derived in the browser: the rule differs by country
     * (a Rwandan profile owes its district and sector, an international one does
     * not), and two copies of that rule is one copy too many.
     */
    complete: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    fullName: string | null;
    document: {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        documentNumberMasked: string;
    } | null;
    gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
    dateOfBirth: string | null;
    phoneE164: string | null;
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    } | {
        country: string;
        addressText: string;
    } | null;
    complete: boolean;
}, {
    fullName: string | null;
    document: {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        documentNumberMasked: string;
    } | null;
    gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
    dateOfBirth: string | null;
    phoneE164: string | null;
    address: {
        country: "RW";
        provinceId: number;
        districtId: number;
        sectorId: number;
        cellId?: number | undefined;
        villageId?: number | undefined;
        street?: string | undefined;
    } | {
        country: string;
        addressText: string;
    } | null;
    complete: boolean;
}>;
export type MyProfile = z.infer<typeof MyProfile>;
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
export declare const CreateBrokerRegistrationRequest: z.ZodObject<{
    personal: z.ZodOptional<z.ZodObject<{
        /** As written on the identity document. */
        fullName: z.ZodString;
        /**
         * Absent only when the person's identity is already VERIFIED (ADR-060): the
         * server then keeps the verified document, whose full number the browser
         * never holds again after a reload. For anyone unverified the server
         * refuses its absence at this path.
         */
        document: z.ZodOptional<z.ZodDiscriminatedUnion<"documentType", [z.ZodObject<{
            documentType: z.ZodLiteral<"national_id">;
            documentNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
            /** A Rwandan NID is Rwandan by definition; kept explicit for the row. */
            issuingCountry: z.ZodDefault<z.ZodLiteral<"RW">>;
        }, "strip", z.ZodTypeAny, {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry: "RW";
        }, {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry?: "RW" | undefined;
        }>, z.ZodObject<{
            documentType: z.ZodLiteral<"passport">;
            documentNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
            issuingCountry: z.ZodEffects<z.ZodString, string, string>;
        }, "strip", z.ZodTypeAny, {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        }, {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        }>]>>;
        gender: z.ZodOptional<z.ZodEnum<["female", "male", "other", "prefer_not_to_say"]>>;
        /** ISO date. Bounds are sanity rails, not a policy on who may register. */
        dateOfBirth: z.ZodEffects<z.ZodString, string, string>;
        phoneE164: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        address: z.ZodUnion<[z.ZodObject<{
            country: z.ZodLiteral<"RW">;
            provinceId: z.ZodNumber;
            districtId: z.ZodNumber;
            sectorId: z.ZodNumber;
            /** Fourth level. Collected to drive the village picker, never stored. */
            cellId: z.ZodOptional<z.ZodNumber>;
            /** Fifth level, and the finest one. Stored; see `orgs.village_id`. */
            villageId: z.ZodOptional<z.ZodNumber>;
            /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
            street: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        }, {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        }>, z.ZodObject<{
            country: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
            /** The whole address as written locally. Formats differ too much to split. */
            addressText: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            country: string;
            addressText: string;
        }, {
            country: string;
            addressText: string;
        }>]>;
    }, "strip", z.ZodTypeAny, {
        fullName: string;
        dateOfBirth: string;
        phoneE164: string;
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        } | {
            country: string;
            addressText: string;
        };
        document?: {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry: "RW";
        } | {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        } | undefined;
        gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
    }, {
        fullName: string;
        dateOfBirth: string;
        phoneE164: string;
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        } | {
            country: string;
            addressText: string;
        };
        document?: {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry?: "RW" | undefined;
        } | {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        } | undefined;
        gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
    }>>;
    /** The district the broker works in: the free plan shows the homes there (2026-10-25). */
    homeDistrictId: z.ZodNumber;
    /** The registration fee, paid first by mobile money (`POST /registrations/broker/fee`). */
    feePaymentId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    homeDistrictId: number;
    feePaymentId: string;
    personal?: {
        fullName: string;
        dateOfBirth: string;
        phoneE164: string;
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        } | {
            country: string;
            addressText: string;
        };
        document?: {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry: "RW";
        } | {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        } | undefined;
        gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
    } | undefined;
}, {
    homeDistrictId: number;
    feePaymentId: string;
    personal?: {
        fullName: string;
        dateOfBirth: string;
        phoneE164: string;
        address: {
            country: "RW";
            provinceId: number;
            districtId: number;
            sectorId: number;
            cellId?: number | undefined;
            villageId?: number | undefined;
            street?: string | undefined;
        } | {
            country: string;
            addressText: string;
        };
        document?: {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry?: "RW" | undefined;
        } | {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        } | undefined;
        gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
    } | undefined;
}>;
export type CreateBrokerRegistrationRequest = z.infer<typeof CreateBrokerRegistrationRequest>;
/** A broker's own status. Two values, and no government pipeline (F-R09 §8). */
export declare const BrokerStatus: z.ZodEnum<["active", "suspended"]>;
export type BrokerStatus = z.infer<typeof BrokerStatus>;
/**
 * What a completed broker registration hands back.
 *
 * Deliberately NOT a `RegistrationSummary`. That shape is the org pipeline —
 * six statuses, a fee, an invoice, a rejection reason — and a broker passes
 * through none of it. Reusing it would mean six fields that are null by
 * construction and a status enum that can never hold the value it is showing.
 */
export declare const BrokerRegistrationSummary: z.ZodObject<{
    brokerId: z.ZodString;
    workspaceId: z.ZodString;
    name: z.ZodString;
    status: z.ZodEnum<["active", "suspended"]>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "suspended";
    name: string;
    workspaceId: string;
    brokerId: string;
}, {
    status: "active" | "suspended";
    name: string;
    workspaceId: string;
    brokerId: string;
}>;
export type BrokerRegistrationSummary = z.infer<typeof BrokerRegistrationSummary>;
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
export declare const UploadedObject: z.ZodObject<{
    objectKey: z.ZodString;
    kind: z.ZodLiteral<"certificate">;
    mime: z.ZodString;
    sizeBytes: z.ZodNumber;
    filename: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "certificate";
    objectKey: string;
    mime: string;
    sizeBytes: number;
    filename: string;
}, {
    kind: "certificate";
    objectKey: string;
    mime: string;
    sizeBytes: number;
    filename: string;
}>;
export type UploadedObject = z.infer<typeof UploadedObject>;
/** Every kind `org_certificates.kind` accepts, worded for a list of what was sent. */
export declare const CERTIFICATE_KIND_LABEL: Readonly<Record<CertificateInput["kind"], string>>;
//# sourceMappingURL=registration.d.ts.map