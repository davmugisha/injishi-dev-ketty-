import { z } from "zod";
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
 * `host` and `landlord` both create an `orgs` row and differ by `domain`;
 * `broker` creates a `brokers` row and no org at all. All three are priced
 * separately in `registration_fees`, which is why this is one enum and not a
 * boolean plus a domain.
 */
export declare const RegistrantRole: z.ZodEnum<["host", "landlord", "broker"]>;
export type RegistrantRole = z.infer<typeof RegistrantRole>;
/** The three rows `registration_fees` is keyed by (schema §8.3a). */
export declare const RegistrationBusinessType: z.ZodEnum<["hospitality", "residence", "broker"]>;
export type RegistrationBusinessType = z.infer<typeof RegistrationBusinessType>;
/** A registrant's answer maps onto exactly one fee row and one domain. */
export declare function businessTypeFor(role: RegistrantRole): RegistrationBusinessType;
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
 * disagree. It is on the wire so the picker can validate its own cascade.
 */
export declare const RwandanAddress: z.ZodObject<{
    country: z.ZodLiteral<"RW">;
    provinceId: z.ZodNumber;
    districtId: z.ZodNumber;
    sectorId: z.ZodNumber;
    /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
    street: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    country: "RW";
    districtId: number;
    sectorId: number;
    provinceId: number;
    street?: string | undefined;
}, {
    country: "RW";
    districtId: number;
    sectorId: number;
    provinceId: number;
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
    /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
    street: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    country: "RW";
    districtId: number;
    sectorId: number;
    provinceId: number;
    street?: string | undefined;
}, {
    country: "RW";
    districtId: number;
    sectorId: number;
    provinceId: number;
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
    document: z.ZodDiscriminatedUnion<"documentType", [z.ZodObject<{
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
    gender: z.ZodOptional<z.ZodEnum<["female", "male", "other", "prefer_not_to_say"]>>;
    /** ISO date. Bounds are sanity rails, not a policy on who may register. */
    dateOfBirth: z.ZodEffects<z.ZodString, string, string>;
    phoneE164: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    address: z.ZodUnion<[z.ZodObject<{
        country: z.ZodLiteral<"RW">;
        provinceId: z.ZodNumber;
        districtId: z.ZodNumber;
        sectorId: z.ZodNumber;
        /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
        street: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    }, {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
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
    address: {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    } | {
        country: string;
        addressText: string;
    };
    fullName: string;
    document: {
        documentType: "national_id";
        documentNumber: string;
        issuingCountry: "RW";
    } | {
        documentType: "passport";
        documentNumber: string;
        issuingCountry: string;
    };
    dateOfBirth: string;
    phoneE164: string;
    gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
}, {
    address: {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    } | {
        country: string;
        addressText: string;
    };
    fullName: string;
    document: {
        documentType: "national_id";
        documentNumber: string;
        issuingCountry?: "RW" | undefined;
    } | {
        documentType: "passport";
        documentNumber: string;
        issuingCountry: string;
    };
    dateOfBirth: string;
    phoneE164: string;
    gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
}>;
export type PersonalDetails = z.infer<typeof PersonalDetails>;
/** A certificate the registrant attaches (schema §4.3a). */
export declare const CertificateInput: z.ZodObject<{
    kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other"]>;
    /** Required when `kind` is `other`; the database carries the same rule. */
    kindOther: z.ZodOptional<z.ZodString>;
    /** Key of an already-uploaded `stored_objects` row (F-S09). */
    objectKey: z.ZodString;
    certificateNumber: z.ZodOptional<z.ZodString>;
    issuedBy: z.ZodOptional<z.ZodString>;
    issuedOn: z.ZodOptional<z.ZodString>;
    expiresOn: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
    objectKey: string;
    kindOther?: string | undefined;
    certificateNumber?: string | undefined;
    issuedBy?: string | undefined;
    issuedOn?: string | undefined;
    expiresOn?: string | undefined;
}, {
    kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
    objectKey: string;
    kindOther?: string | undefined;
    certificateNumber?: string | undefined;
    issuedBy?: string | undefined;
    issuedOn?: string | undefined;
    expiresOn?: string | undefined;
}>;
export type CertificateInput = z.infer<typeof CertificateInput>;
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
        /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
        street: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    }, {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    }>;
    certificates: z.ZodDefault<z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other"]>;
        /** Required when `kind` is `other`; the database carries the same rule. */
        kindOther: z.ZodOptional<z.ZodString>;
        /** Key of an already-uploaded `stored_objects` row (F-S09). */
        objectKey: z.ZodString;
        certificateNumber: z.ZodOptional<z.ZodString>;
        issuedBy: z.ZodOptional<z.ZodString>;
        issuedOn: z.ZodOptional<z.ZodString>;
        expiresOn: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }, {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
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
    accommodationClass: z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other"]>;
    /** Required when the class is `other`, forbidden otherwise (D24). */
    accommodationClassOther: z.ZodOptional<z.ZodString>;
    tin: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    upi: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
    tourismLicenseNumber: z.ZodOptional<z.ZodString>;
    chamberOfTourismMember: z.ZodDefault<z.ZodBoolean>;
    /** Optional, and hospitality only. Not the PSF oversight body (D24). */
    psfMember: z.ZodDefault<z.ZodBoolean>;
    eacStarGrade: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    legalName: string;
    domain: "hospitality";
    accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa";
    chamberOfTourismMember: boolean;
    psfMember: boolean;
    tin: string;
    address: {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    };
    certificates: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[];
    entityGroup: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism";
    tourismLicenseNumber?: string | undefined;
    eacStarGrade?: number | undefined;
    upi?: string | undefined;
    accommodationClassOther?: string | undefined;
}, {
    legalName: string;
    domain: "hospitality";
    accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa";
    tin: string;
    address: {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    };
    tourismLicenseNumber?: string | undefined;
    chamberOfTourismMember?: boolean | undefined;
    psfMember?: boolean | undefined;
    eacStarGrade?: number | undefined;
    upi?: string | undefined;
    certificates?: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[] | undefined;
    entityGroup?: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism" | undefined;
    accommodationClassOther?: string | undefined;
}>;
/** A residence. Carries a UPI, and none of the tourism apparatus. */
export declare const ResidenceBusiness: z.ZodObject<{
    legalName: z.ZodString;
    address: z.ZodObject<{
        country: z.ZodLiteral<"RW">;
        provinceId: z.ZodNumber;
        districtId: z.ZodNumber;
        sectorId: z.ZodNumber;
        /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
        street: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    }, {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    }>;
    certificates: z.ZodDefault<z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other"]>;
        /** Required when `kind` is `other`; the database carries the same rule. */
        kindOther: z.ZodOptional<z.ZodString>;
        /** Key of an already-uploaded `stored_objects` row (F-S09). */
        objectKey: z.ZodString;
        certificateNumber: z.ZodOptional<z.ZodString>;
        issuedBy: z.ZodOptional<z.ZodString>;
        issuedOn: z.ZodOptional<z.ZodString>;
        expiresOn: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }, {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
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
}, "strip", z.ZodTypeAny, {
    legalName: string;
    domain: "residence";
    residenceClass: "residential_landlord" | "residential_property_manager";
    upi: string;
    address: {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    };
    certificates: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[];
}, {
    legalName: string;
    domain: "residence";
    residenceClass: "residential_landlord" | "residential_property_manager";
    upi: string;
    address: {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    };
    certificates?: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[] | undefined;
}>;
export declare const BusinessDetails: z.ZodEffects<z.ZodDiscriminatedUnion<"domain", [z.ZodObject<{
    legalName: z.ZodString;
    address: z.ZodObject<{
        country: z.ZodLiteral<"RW">;
        provinceId: z.ZodNumber;
        districtId: z.ZodNumber;
        sectorId: z.ZodNumber;
        /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
        street: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    }, {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    }>;
    certificates: z.ZodDefault<z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other"]>;
        /** Required when `kind` is `other`; the database carries the same rule. */
        kindOther: z.ZodOptional<z.ZodString>;
        /** Key of an already-uploaded `stored_objects` row (F-S09). */
        objectKey: z.ZodString;
        certificateNumber: z.ZodOptional<z.ZodString>;
        issuedBy: z.ZodOptional<z.ZodString>;
        issuedOn: z.ZodOptional<z.ZodString>;
        expiresOn: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }, {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
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
    accommodationClass: z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other"]>;
    /** Required when the class is `other`, forbidden otherwise (D24). */
    accommodationClassOther: z.ZodOptional<z.ZodString>;
    tin: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    upi: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
    tourismLicenseNumber: z.ZodOptional<z.ZodString>;
    chamberOfTourismMember: z.ZodDefault<z.ZodBoolean>;
    /** Optional, and hospitality only. Not the PSF oversight body (D24). */
    psfMember: z.ZodDefault<z.ZodBoolean>;
    eacStarGrade: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    legalName: string;
    domain: "hospitality";
    accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa";
    chamberOfTourismMember: boolean;
    psfMember: boolean;
    tin: string;
    address: {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    };
    certificates: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[];
    entityGroup: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism";
    tourismLicenseNumber?: string | undefined;
    eacStarGrade?: number | undefined;
    upi?: string | undefined;
    accommodationClassOther?: string | undefined;
}, {
    legalName: string;
    domain: "hospitality";
    accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa";
    tin: string;
    address: {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    };
    tourismLicenseNumber?: string | undefined;
    chamberOfTourismMember?: boolean | undefined;
    psfMember?: boolean | undefined;
    eacStarGrade?: number | undefined;
    upi?: string | undefined;
    certificates?: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[] | undefined;
    entityGroup?: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism" | undefined;
    accommodationClassOther?: string | undefined;
}>, z.ZodObject<{
    legalName: z.ZodString;
    address: z.ZodObject<{
        country: z.ZodLiteral<"RW">;
        provinceId: z.ZodNumber;
        districtId: z.ZodNumber;
        sectorId: z.ZodNumber;
        /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
        street: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    }, {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    }>;
    certificates: z.ZodDefault<z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other"]>;
        /** Required when `kind` is `other`; the database carries the same rule. */
        kindOther: z.ZodOptional<z.ZodString>;
        /** Key of an already-uploaded `stored_objects` row (F-S09). */
        objectKey: z.ZodString;
        certificateNumber: z.ZodOptional<z.ZodString>;
        issuedBy: z.ZodOptional<z.ZodString>;
        issuedOn: z.ZodOptional<z.ZodString>;
        expiresOn: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }, {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
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
}, "strip", z.ZodTypeAny, {
    legalName: string;
    domain: "residence";
    residenceClass: "residential_landlord" | "residential_property_manager";
    upi: string;
    address: {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    };
    certificates: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[];
}, {
    legalName: string;
    domain: "residence";
    residenceClass: "residential_landlord" | "residential_property_manager";
    upi: string;
    address: {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    };
    certificates?: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[] | undefined;
}>]>, {
    legalName: string;
    domain: "hospitality";
    accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa";
    chamberOfTourismMember: boolean;
    psfMember: boolean;
    tin: string;
    address: {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    };
    certificates: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[];
    entityGroup: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism";
    tourismLicenseNumber?: string | undefined;
    eacStarGrade?: number | undefined;
    upi?: string | undefined;
    accommodationClassOther?: string | undefined;
} | {
    legalName: string;
    domain: "residence";
    residenceClass: "residential_landlord" | "residential_property_manager";
    upi: string;
    address: {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    };
    certificates: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[];
}, {
    legalName: string;
    domain: "hospitality";
    accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa";
    tin: string;
    address: {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    };
    tourismLicenseNumber?: string | undefined;
    chamberOfTourismMember?: boolean | undefined;
    psfMember?: boolean | undefined;
    eacStarGrade?: number | undefined;
    upi?: string | undefined;
    certificates?: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[] | undefined;
    entityGroup?: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism" | undefined;
    accommodationClassOther?: string | undefined;
} | {
    legalName: string;
    domain: "residence";
    residenceClass: "residential_landlord" | "residential_property_manager";
    upi: string;
    address: {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    };
    certificates?: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
        objectKey: string;
        kindOther?: string | undefined;
        certificateNumber?: string | undefined;
        issuedBy?: string | undefined;
        issuedOn?: string | undefined;
        expiresOn?: string | undefined;
    }[] | undefined;
}>;
export type BusinessDetails = z.infer<typeof BusinessDetails>;
export declare const CreateRegistrationRequest: z.ZodEffects<z.ZodObject<{
    role: z.ZodEnum<["host", "landlord", "broker"]>;
    capacity: z.ZodDefault<z.ZodEnum<["owner", "on_behalf_of"]>>;
    /**
     * Omitted by a returning registrant, whose profile already carries it.
     * Absent is not "skip validation" — the server reads the stored profile and
     * refuses if that is incomplete.
     */
    personal: z.ZodOptional<z.ZodObject<{
        /** As written on the identity document. */
        fullName: z.ZodString;
        document: z.ZodDiscriminatedUnion<"documentType", [z.ZodObject<{
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
        gender: z.ZodOptional<z.ZodEnum<["female", "male", "other", "prefer_not_to_say"]>>;
        /** ISO date. Bounds are sanity rails, not a policy on who may register. */
        dateOfBirth: z.ZodEffects<z.ZodString, string, string>;
        phoneE164: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        address: z.ZodUnion<[z.ZodObject<{
            country: z.ZodLiteral<"RW">;
            provinceId: z.ZodNumber;
            districtId: z.ZodNumber;
            sectorId: z.ZodNumber;
            /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
            street: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        }, {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
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
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        } | {
            country: string;
            addressText: string;
        };
        fullName: string;
        document: {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry: "RW";
        } | {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        };
        dateOfBirth: string;
        phoneE164: string;
        gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
    }, {
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        } | {
            country: string;
            addressText: string;
        };
        fullName: string;
        document: {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry?: "RW" | undefined;
        } | {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        };
        dateOfBirth: string;
        phoneE164: string;
        gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
    }>>;
    business: z.ZodEffects<z.ZodDiscriminatedUnion<"domain", [z.ZodObject<{
        legalName: z.ZodString;
        address: z.ZodObject<{
            country: z.ZodLiteral<"RW">;
            provinceId: z.ZodNumber;
            districtId: z.ZodNumber;
            sectorId: z.ZodNumber;
            /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
            street: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        }, {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        }>;
        certificates: z.ZodDefault<z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other"]>;
            /** Required when `kind` is `other`; the database carries the same rule. */
            kindOther: z.ZodOptional<z.ZodString>;
            /** Key of an already-uploaded `stored_objects` row (F-S09). */
            objectKey: z.ZodString;
            certificateNumber: z.ZodOptional<z.ZodString>;
            issuedBy: z.ZodOptional<z.ZodString>;
            issuedOn: z.ZodOptional<z.ZodString>;
            expiresOn: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }, {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
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
        accommodationClass: z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other"]>;
        /** Required when the class is `other`, forbidden otherwise (D24). */
        accommodationClassOther: z.ZodOptional<z.ZodString>;
        tin: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        upi: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
        tourismLicenseNumber: z.ZodOptional<z.ZodString>;
        chamberOfTourismMember: z.ZodDefault<z.ZodBoolean>;
        /** Optional, and hospitality only. Not the PSF oversight body (D24). */
        psfMember: z.ZodDefault<z.ZodBoolean>;
        eacStarGrade: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        legalName: string;
        domain: "hospitality";
        accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa";
        chamberOfTourismMember: boolean;
        psfMember: boolean;
        tin: string;
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        };
        certificates: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[];
        entityGroup: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism";
        tourismLicenseNumber?: string | undefined;
        eacStarGrade?: number | undefined;
        upi?: string | undefined;
        accommodationClassOther?: string | undefined;
    }, {
        legalName: string;
        domain: "hospitality";
        accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa";
        tin: string;
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        };
        tourismLicenseNumber?: string | undefined;
        chamberOfTourismMember?: boolean | undefined;
        psfMember?: boolean | undefined;
        eacStarGrade?: number | undefined;
        upi?: string | undefined;
        certificates?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[] | undefined;
        entityGroup?: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism" | undefined;
        accommodationClassOther?: string | undefined;
    }>, z.ZodObject<{
        legalName: z.ZodString;
        address: z.ZodObject<{
            country: z.ZodLiteral<"RW">;
            provinceId: z.ZodNumber;
            districtId: z.ZodNumber;
            sectorId: z.ZodNumber;
            /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
            street: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        }, {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        }>;
        certificates: z.ZodDefault<z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other"]>;
            /** Required when `kind` is `other`; the database carries the same rule. */
            kindOther: z.ZodOptional<z.ZodString>;
            /** Key of an already-uploaded `stored_objects` row (F-S09). */
            objectKey: z.ZodString;
            certificateNumber: z.ZodOptional<z.ZodString>;
            issuedBy: z.ZodOptional<z.ZodString>;
            issuedOn: z.ZodOptional<z.ZodString>;
            expiresOn: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }, {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
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
    }, "strip", z.ZodTypeAny, {
        legalName: string;
        domain: "residence";
        residenceClass: "residential_landlord" | "residential_property_manager";
        upi: string;
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        };
        certificates: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[];
    }, {
        legalName: string;
        domain: "residence";
        residenceClass: "residential_landlord" | "residential_property_manager";
        upi: string;
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        };
        certificates?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[] | undefined;
    }>]>, {
        legalName: string;
        domain: "hospitality";
        accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa";
        chamberOfTourismMember: boolean;
        psfMember: boolean;
        tin: string;
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        };
        certificates: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[];
        entityGroup: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism";
        tourismLicenseNumber?: string | undefined;
        eacStarGrade?: number | undefined;
        upi?: string | undefined;
        accommodationClassOther?: string | undefined;
    } | {
        legalName: string;
        domain: "residence";
        residenceClass: "residential_landlord" | "residential_property_manager";
        upi: string;
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        };
        certificates: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[];
    }, {
        legalName: string;
        domain: "hospitality";
        accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa";
        tin: string;
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        };
        tourismLicenseNumber?: string | undefined;
        chamberOfTourismMember?: boolean | undefined;
        psfMember?: boolean | undefined;
        eacStarGrade?: number | undefined;
        upi?: string | undefined;
        certificates?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[] | undefined;
        entityGroup?: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism" | undefined;
        accommodationClassOther?: string | undefined;
    } | {
        legalName: string;
        domain: "residence";
        residenceClass: "residential_landlord" | "residential_property_manager";
        upi: string;
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        };
        certificates?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[] | undefined;
    }>;
    /** Captured when `capacity` is `on_behalf_of` (FL02). */
    intendedOwner: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        nationalId: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
        email: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        email?: string | undefined;
        nationalId?: string | undefined;
    }, {
        name: string;
        email?: string | undefined;
        nationalId?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    business: {
        legalName: string;
        domain: "hospitality";
        accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa";
        chamberOfTourismMember: boolean;
        psfMember: boolean;
        tin: string;
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        };
        certificates: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[];
        entityGroup: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism";
        tourismLicenseNumber?: string | undefined;
        eacStarGrade?: number | undefined;
        upi?: string | undefined;
        accommodationClassOther?: string | undefined;
    } | {
        legalName: string;
        domain: "residence";
        residenceClass: "residential_landlord" | "residential_property_manager";
        upi: string;
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        };
        certificates: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[];
    };
    capacity: "owner" | "on_behalf_of";
    role: "broker" | "host" | "landlord";
    personal?: {
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        } | {
            country: string;
            addressText: string;
        };
        fullName: string;
        document: {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry: "RW";
        } | {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        };
        dateOfBirth: string;
        phoneE164: string;
        gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
    } | undefined;
    intendedOwner?: {
        name: string;
        email?: string | undefined;
        nationalId?: string | undefined;
    } | undefined;
}, {
    business: {
        legalName: string;
        domain: "hospitality";
        accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa";
        tin: string;
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        };
        tourismLicenseNumber?: string | undefined;
        chamberOfTourismMember?: boolean | undefined;
        psfMember?: boolean | undefined;
        eacStarGrade?: number | undefined;
        upi?: string | undefined;
        certificates?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[] | undefined;
        entityGroup?: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism" | undefined;
        accommodationClassOther?: string | undefined;
    } | {
        legalName: string;
        domain: "residence";
        residenceClass: "residential_landlord" | "residential_property_manager";
        upi: string;
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        };
        certificates?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[] | undefined;
    };
    role: "broker" | "host" | "landlord";
    personal?: {
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        } | {
            country: string;
            addressText: string;
        };
        fullName: string;
        document: {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry?: "RW" | undefined;
        } | {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        };
        dateOfBirth: string;
        phoneE164: string;
        gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
    } | undefined;
    capacity?: "owner" | "on_behalf_of" | undefined;
    intendedOwner?: {
        name: string;
        email?: string | undefined;
        nationalId?: string | undefined;
    } | undefined;
}>, {
    business: {
        legalName: string;
        domain: "hospitality";
        accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa";
        chamberOfTourismMember: boolean;
        psfMember: boolean;
        tin: string;
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        };
        certificates: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[];
        entityGroup: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism";
        tourismLicenseNumber?: string | undefined;
        eacStarGrade?: number | undefined;
        upi?: string | undefined;
        accommodationClassOther?: string | undefined;
    } | {
        legalName: string;
        domain: "residence";
        residenceClass: "residential_landlord" | "residential_property_manager";
        upi: string;
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        };
        certificates: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[];
    };
    capacity: "owner" | "on_behalf_of";
    role: "broker" | "host" | "landlord";
    personal?: {
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        } | {
            country: string;
            addressText: string;
        };
        fullName: string;
        document: {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry: "RW";
        } | {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        };
        dateOfBirth: string;
        phoneE164: string;
        gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
    } | undefined;
    intendedOwner?: {
        name: string;
        email?: string | undefined;
        nationalId?: string | undefined;
    } | undefined;
}, {
    business: {
        legalName: string;
        domain: "hospitality";
        accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa";
        tin: string;
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        };
        tourismLicenseNumber?: string | undefined;
        chamberOfTourismMember?: boolean | undefined;
        psfMember?: boolean | undefined;
        eacStarGrade?: number | undefined;
        upi?: string | undefined;
        certificates?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[] | undefined;
        entityGroup?: "accommodation" | "restaurant_bar_nightclub" | "travel_services" | "tourism_information_center" | "cultural_tourism" | undefined;
        accommodationClassOther?: string | undefined;
    } | {
        legalName: string;
        domain: "residence";
        residenceClass: "residential_landlord" | "residential_property_manager";
        upi: string;
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        };
        certificates?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection";
            objectKey: string;
            kindOther?: string | undefined;
            certificateNumber?: string | undefined;
            issuedBy?: string | undefined;
            issuedOn?: string | undefined;
            expiresOn?: string | undefined;
        }[] | undefined;
    };
    role: "broker" | "host" | "landlord";
    personal?: {
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        } | {
            country: string;
            addressText: string;
        };
        fullName: string;
        document: {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry?: "RW" | undefined;
        } | {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        };
        dateOfBirth: string;
        phoneE164: string;
        gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
    } | undefined;
    capacity?: "owner" | "on_behalf_of" | undefined;
    intendedOwner?: {
        name: string;
        email?: string | undefined;
        nationalId?: string | undefined;
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
    oversightRole: z.ZodEnum<["tax_compliance_officer", "business_field_verifier", "business_approver"]>;
    /** The body and title AS OF the decision, never re-resolved (F-S03 §9). */
    governmentBodyCode: z.ZodString;
    governmentTitle: z.ZodNullable<z.ZodString>;
    reasonCode: z.ZodNullable<z.ZodEnum<["tin_not_found", "tin_mismatch", "premises_not_found", "documents_invalid", "documents_expired", "not_operating", "ownership_unclear", "duplicate_business", "other"]>>;
    notes: z.ZodNullable<z.ZodString>;
    decidedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    decision: "rejected" | "passed";
    reasonCode: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
    decidedAt: string;
    oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver";
    governmentBodyCode: string;
    governmentTitle: string | null;
    stage: "tin_verified" | "field_verified";
    notes: string | null;
}, {
    decision: "rejected" | "passed";
    reasonCode: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
    decidedAt: string;
    oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver";
    governmentBodyCode: string;
    governmentTitle: string | null;
    stage: "tin_verified" | "field_verified";
    notes: string | null;
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
 * One business waiting on this officer.
 *
 * Carries the district so a console can group by it, and `waitingSince` so the
 * time-in-stage that F-S03 §5 tracks is visible to the person who can move it,
 * not only to an analyst.
 */
export declare const OversightQueueItem: z.ZodObject<{
    orgId: z.ZodString;
    legalName: z.ZodString;
    domain: z.ZodEnum<["hospitality", "residence"]>;
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
}, "strip", z.ZodTypeAny, {
    status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    districtId: number | null;
    districtName: string | null;
    legalName: string;
    domain: "hospitality" | "residence";
    accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
    tin: string | null;
    upi: string | null;
    orgId: string;
    addressText: string | null;
    sectorName: string | null;
    waitingSince: string;
    blockedBySeparationOfDuties: boolean;
}, {
    status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    districtId: number | null;
    districtName: string | null;
    legalName: string;
    domain: "hospitality" | "residence";
    accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
    tin: string | null;
    upi: string | null;
    orgId: string;
    addressText: string | null;
    sectorName: string | null;
    waitingSince: string;
    blockedBySeparationOfDuties: boolean;
}>;
export type OversightQueueItem = z.infer<typeof OversightQueueItem>;
/** What the pending workspace renders: the stage, and what is owed. */
export declare const RegistrationSummary: z.ZodObject<{
    orgId: z.ZodString;
    workspaceId: z.ZodString;
    legalName: z.ZodString;
    domain: z.ZodEnum<["hospitality", "residence"]>;
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
}, "strip", z.ZodTypeAny, {
    status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    legalName: string;
    domain: "hospitality" | "residence";
    accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
    orgId: string;
    submittedAt: string | null;
    workspaceId: string;
    invoiceId: string | null;
    amountDueRwf: number | null;
    rejectionReason: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
    rejectionNotes: string | null;
}, {
    status: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended";
    legalName: string;
    domain: "hospitality" | "residence";
    accommodationClass: "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "town_hotel" | "vacation_hotel_resort" | "serviced_apartment" | "cottage" | null;
    orgId: string;
    submittedAt: string | null;
    workspaceId: string;
    invoiceId: string | null;
    amountDueRwf: number | null;
    rejectionReason: "other" | "tin_not_found" | "tin_mismatch" | "premises_not_found" | "documents_invalid" | "documents_expired" | "not_operating" | "ownership_unclear" | "duplicate_business" | null;
    rejectionNotes: string | null;
}>;
export type RegistrationSummary = z.infer<typeof RegistrationSummary>;
/** The fee a registrant is quoted, read from the effective-dated catalog. */
export declare const RegistrationFeeQuote: z.ZodObject<{
    businessType: z.ZodEnum<["hospitality", "residence", "broker"]>;
    amountRwf: z.ZodNumber;
    currency: z.ZodLiteral<"RWF">;
}, "strip", z.ZodTypeAny, {
    amountRwf: number;
    currency: "RWF";
    businessType: "hospitality" | "residence" | "broker";
}, {
    amountRwf: number;
    currency: "RWF";
    businessType: "hospitality" | "residence" | "broker";
}>;
export type RegistrationFeeQuote = z.infer<typeof RegistrationFeeQuote>;
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
        /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
        street: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    }, {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
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
    address: {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    } | {
        country: string;
        addressText: string;
    } | null;
    fullName: string | null;
    document: {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        documentNumberMasked: string;
    } | null;
    gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
    dateOfBirth: string | null;
    phoneE164: string | null;
    complete: boolean;
}, {
    address: {
        country: "RW";
        districtId: number;
        sectorId: number;
        provinceId: number;
        street?: string | undefined;
    } | {
        country: string;
        addressText: string;
    } | null;
    fullName: string | null;
    document: {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        documentNumberMasked: string;
    } | null;
    gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
    dateOfBirth: string | null;
    phoneE164: string | null;
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
        document: z.ZodDiscriminatedUnion<"documentType", [z.ZodObject<{
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
        gender: z.ZodOptional<z.ZodEnum<["female", "male", "other", "prefer_not_to_say"]>>;
        /** ISO date. Bounds are sanity rails, not a policy on who may register. */
        dateOfBirth: z.ZodEffects<z.ZodString, string, string>;
        phoneE164: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        address: z.ZodUnion<[z.ZodObject<{
            country: z.ZodLiteral<"RW">;
            provinceId: z.ZodNumber;
            districtId: z.ZodNumber;
            sectorId: z.ZodNumber;
            /** Street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
            street: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        }, {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
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
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        } | {
            country: string;
            addressText: string;
        };
        fullName: string;
        document: {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry: "RW";
        } | {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        };
        dateOfBirth: string;
        phoneE164: string;
        gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
    }, {
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        } | {
            country: string;
            addressText: string;
        };
        fullName: string;
        document: {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry?: "RW" | undefined;
        } | {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        };
        dateOfBirth: string;
        phoneE164: string;
        gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    personal?: {
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        } | {
            country: string;
            addressText: string;
        };
        fullName: string;
        document: {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry: "RW";
        } | {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        };
        dateOfBirth: string;
        phoneE164: string;
        gender?: "other" | "female" | "male" | "prefer_not_to_say" | undefined;
    } | undefined;
}, {
    personal?: {
        address: {
            country: "RW";
            districtId: number;
            sectorId: number;
            provinceId: number;
            street?: string | undefined;
        } | {
            country: string;
            addressText: string;
        };
        fullName: string;
        document: {
            documentType: "national_id";
            documentNumber: string;
            issuingCountry?: "RW" | undefined;
        } | {
            documentType: "passport";
            documentNumber: string;
            issuingCountry: string;
        };
        dateOfBirth: string;
        phoneE164: string;
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
/** The six kinds `org_certificates.kind` accepts, in the order the form asks. */
export declare const CERTIFICATE_KIND_LABEL: Readonly<Record<CertificateInput["kind"], string>>;
//# sourceMappingURL=registration.d.ts.map