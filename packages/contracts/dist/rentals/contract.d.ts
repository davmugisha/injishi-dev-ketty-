import { z } from "zod";
/** The contract template this module writes for a new version. */
export declare const LEASE_CONTRACT_TEMPLATE_VERSION = 4;
/**
 * Every template a frozen contract may carry. Each is kept as text on its version, so one written under
 * an older template still reads, prints and signs as it stands; only new versions use the latest.
 *   3  signers confirm "with a code sent to their email or with their password"
 *   4  signers confirm "with an emailed code, or a tenant's password" (a landlord holds no password)
 */
export declare const LEASE_CONTRACT_TEMPLATE_VERSIONS: readonly [3, 4];
export type LeaseContractTemplateVersion = (typeof LEASE_CONTRACT_TEMPLATE_VERSIONS)[number];
/** A template version a stored contract may name. */
export declare function isKnownContractTemplate(version: number): version is LeaseContractTemplateVersion;
/** The law electronic signatures in Rwanda stand on. */
export declare const E_SIGNATURE_LAW = "Law No. 18/2010 relating to electronic messages, electronic signatures and electronic transactions";
/** The law that asks the landlord to file the lease with the tax administration. */
export declare const LEASE_FILING_LAW = "Law No. 048/2023";
/** The landlord as the contract names them. */
export declare const LeaseLandlordParty: z.ZodObject<{
    /** The business, or the person, letting the home. */
    legalName: z.ZodString;
    /** Who signs for the landlord. */
    signatoryName: z.ZodString;
    /** The signatory's national ID, or the business's TIN. */
    idNumber: z.ZodString;
    phone: z.ZodString;
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    legalName: string;
    phone: string;
    idNumber: string;
    signatoryName: string;
}, {
    email: string;
    legalName: string;
    phone: string;
    idNumber: string;
    signatoryName: string;
}>;
export type LeaseLandlordParty = z.infer<typeof LeaseLandlordParty>;
/** The tenant as the contract names them. */
export declare const LeaseTenantParty: z.ZodObject<{
    fullName: z.ZodString;
    idKind: z.ZodEnum<["national_id", "passport"]>;
    idNumber: z.ZodString;
    /** ISO country code. */
    nationality: z.ZodString;
    phone: z.ZodString;
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    fullName: string;
    email: string;
    phone: string;
    idNumber: string;
    idKind: "national_id" | "passport";
    nationality: string;
}, {
    fullName: string;
    email: string;
    phone: string;
    idNumber: string;
    idKind: "national_id" | "passport";
    nationality: string;
}>;
export type LeaseTenantParty = z.infer<typeof LeaseTenantParty>;
/** Where the home is, down to the village. */
export declare const LeasePremises: z.ZodObject<{
    property: z.ZodString;
    unit: z.ZodNullable<z.ZodString>;
    block: z.ZodNullable<z.ZodString>;
    street: z.ZodNullable<z.ZodString>;
    village: z.ZodNullable<z.ZodString>;
    cell: z.ZodNullable<z.ZodString>;
    sector: z.ZodNullable<z.ZodString>;
    district: z.ZodNullable<z.ZodString>;
    province: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    province: string | null;
    district: string | null;
    sector: string | null;
    cell: string | null;
    village: string | null;
    street: string | null;
    property: string;
    unit: string | null;
    block: string | null;
}, {
    province: string | null;
    district: string | null;
    sector: string | null;
    cell: string | null;
    village: string | null;
    street: string | null;
    property: string;
    unit: string | null;
    block: string | null;
}>;
export type LeasePremises = z.infer<typeof LeasePremises>;
/** The terms the contract states. The lease row holds the same figures. */
export declare const LeaseContractTerms: z.ZodObject<{
    startDate: z.ZodString;
    endDate: z.ZodString;
    /** Set for a tenancy brought onto Injishi mid way. */
    billingStartsOn: z.ZodNullable<z.ZodString>;
    monthlyRentRwf: z.ZodNumber;
    depositRwf: z.ZodNumber;
    rentDueDay: z.ZodNumber;
    graceDays: z.ZodNumber;
    noticeDays: z.ZodNumber;
    occupants: z.ZodArray<z.ZodString, "many">;
    otherTerms: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    monthlyRentRwf: number;
    startDate: string;
    endDate: string;
    billingStartsOn: string | null;
    noticeDays: number;
    depositRwf: number;
    rentDueDay: number;
    graceDays: number;
    occupants: string[];
    otherTerms: string | null;
}, {
    monthlyRentRwf: number;
    startDate: string;
    endDate: string;
    billingStartsOn: string | null;
    noticeDays: number;
    depositRwf: number;
    rentDueDay: number;
    graceDays: number;
    occupants: string[];
    otherTerms: string | null;
}>;
export type LeaseContractTerms = z.infer<typeof LeaseContractTerms>;
/** One clause, as it was frozen. */
export declare const LeaseClause: z.ZodObject<{
    heading: z.ZodString;
    body: z.ZodString;
}, "strip", z.ZodTypeAny, {
    body: string;
    heading: string;
}, {
    body: string;
    heading: string;
}>;
export type LeaseClause = z.infer<typeof LeaseClause>;
/** The contract both sides sign. */
export declare const LeaseContract: z.ZodObject<{
    version: z.ZodUnion<[z.ZodLiteral<3>, z.ZodLiteral<4>]>;
    title: z.ZodString;
    parties: z.ZodObject<{
        landlord: z.ZodObject<{
            /** The business, or the person, letting the home. */
            legalName: z.ZodString;
            /** Who signs for the landlord. */
            signatoryName: z.ZodString;
            /** The signatory's national ID, or the business's TIN. */
            idNumber: z.ZodString;
            phone: z.ZodString;
            email: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            email: string;
            legalName: string;
            phone: string;
            idNumber: string;
            signatoryName: string;
        }, {
            email: string;
            legalName: string;
            phone: string;
            idNumber: string;
            signatoryName: string;
        }>;
        tenant: z.ZodObject<{
            fullName: z.ZodString;
            idKind: z.ZodEnum<["national_id", "passport"]>;
            idNumber: z.ZodString;
            /** ISO country code. */
            nationality: z.ZodString;
            phone: z.ZodString;
            email: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            fullName: string;
            email: string;
            phone: string;
            idNumber: string;
            idKind: "national_id" | "passport";
            nationality: string;
        }, {
            fullName: string;
            email: string;
            phone: string;
            idNumber: string;
            idKind: "national_id" | "passport";
            nationality: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        landlord: {
            email: string;
            legalName: string;
            phone: string;
            idNumber: string;
            signatoryName: string;
        };
        tenant: {
            fullName: string;
            email: string;
            phone: string;
            idNumber: string;
            idKind: "national_id" | "passport";
            nationality: string;
        };
    }, {
        landlord: {
            email: string;
            legalName: string;
            phone: string;
            idNumber: string;
            signatoryName: string;
        };
        tenant: {
            fullName: string;
            email: string;
            phone: string;
            idNumber: string;
            idKind: "national_id" | "passport";
            nationality: string;
        };
    }>;
    premises: z.ZodObject<{
        property: z.ZodString;
        unit: z.ZodNullable<z.ZodString>;
        block: z.ZodNullable<z.ZodString>;
        street: z.ZodNullable<z.ZodString>;
        village: z.ZodNullable<z.ZodString>;
        cell: z.ZodNullable<z.ZodString>;
        sector: z.ZodNullable<z.ZodString>;
        district: z.ZodNullable<z.ZodString>;
        province: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        province: string | null;
        district: string | null;
        sector: string | null;
        cell: string | null;
        village: string | null;
        street: string | null;
        property: string;
        unit: string | null;
        block: string | null;
    }, {
        province: string | null;
        district: string | null;
        sector: string | null;
        cell: string | null;
        village: string | null;
        street: string | null;
        property: string;
        unit: string | null;
        block: string | null;
    }>;
    /** The home in one line, as the clauses name it. */
    premisesLine: z.ZodString;
    terms: z.ZodObject<{
        startDate: z.ZodString;
        endDate: z.ZodString;
        /** Set for a tenancy brought onto Injishi mid way. */
        billingStartsOn: z.ZodNullable<z.ZodString>;
        monthlyRentRwf: z.ZodNumber;
        depositRwf: z.ZodNumber;
        rentDueDay: z.ZodNumber;
        graceDays: z.ZodNumber;
        noticeDays: z.ZodNumber;
        occupants: z.ZodArray<z.ZodString, "many">;
        otherTerms: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        billingStartsOn: string | null;
        noticeDays: number;
        depositRwf: number;
        rentDueDay: number;
        graceDays: number;
        occupants: string[];
        otherTerms: string | null;
    }, {
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        billingStartsOn: string | null;
        noticeDays: number;
        depositRwf: number;
        rentDueDay: number;
        graceDays: number;
        occupants: string[];
        otherTerms: string | null;
    }>;
    clauses: z.ZodArray<z.ZodObject<{
        heading: z.ZodString;
        body: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        body: string;
        heading: string;
    }, {
        body: string;
        heading: string;
    }>, "many">;
    /** When this text was rendered. Not part of the fingerprint. */
    issuedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: string;
    version: 3 | 4;
    terms: {
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        billingStartsOn: string | null;
        noticeDays: number;
        depositRwf: number;
        rentDueDay: number;
        graceDays: number;
        occupants: string[];
        otherTerms: string | null;
    };
    parties: {
        landlord: {
            email: string;
            legalName: string;
            phone: string;
            idNumber: string;
            signatoryName: string;
        };
        tenant: {
            fullName: string;
            email: string;
            phone: string;
            idNumber: string;
            idKind: "national_id" | "passport";
            nationality: string;
        };
    };
    issuedAt: string;
    clauses: {
        body: string;
        heading: string;
    }[];
    premises: {
        province: string | null;
        district: string | null;
        sector: string | null;
        cell: string | null;
        village: string | null;
        street: string | null;
        property: string;
        unit: string | null;
        block: string | null;
    };
    premisesLine: string;
}, {
    title: string;
    version: 3 | 4;
    terms: {
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        billingStartsOn: string | null;
        noticeDays: number;
        depositRwf: number;
        rentDueDay: number;
        graceDays: number;
        occupants: string[];
        otherTerms: string | null;
    };
    parties: {
        landlord: {
            email: string;
            legalName: string;
            phone: string;
            idNumber: string;
            signatoryName: string;
        };
        tenant: {
            fullName: string;
            email: string;
            phone: string;
            idNumber: string;
            idKind: "national_id" | "passport";
            nationality: string;
        };
    };
    issuedAt: string;
    clauses: {
        body: string;
        heading: string;
    }[];
    premises: {
        province: string | null;
        district: string | null;
        sector: string | null;
        cell: string | null;
        village: string | null;
        street: string | null;
        property: string;
        unit: string | null;
        block: string | null;
    };
    premisesLine: string;
}>;
export type LeaseContract = z.infer<typeof LeaseContract>;
export interface LeaseContractInput {
    landlord: LeaseLandlordParty;
    tenant: LeaseTenantParty;
    premises: LeasePremises;
    terms: LeaseContractTerms;
}
/** `Unit D1, Block A, Ingoro Apartments, KK 15 Ave, Rebero village, ... Kigali City`. */
export declare function premisesLine(p: LeasePremises): string;
/**
 * The agreement for these parties, this home and these terms, as of
 * `issuedAt`. Pure: the same input gives the same text, and so the same
 * fingerprint, on every runtime. `template` is the latest unless an older
 * version is being rebuilt (tests pin each one's fingerprint).
 */
export declare function buildLeaseContract(input: LeaseContractInput, issuedAt: Date | string, template?: LeaseContractTemplateVersion): LeaseContract;
/**
 * JSON with object keys sorted at every level and `undefined` fields left
 * out, so two equal values always serialise to the same string.
 */
export declare function canonicalJson(value: unknown): string;
/**
 * The fingerprint a signature is given against: SHA-256 of the contract's
 * canonical JSON without its issue time. The terms are what is agreed; the
 * moment a version was rendered is not, so the landlord can sign the preview
 * they read and the server freeze the same text.
 */
export declare function contractHash(contract: LeaseContract): string;
/** A SHA-256 contract fingerprint: 64 lower case hex characters. */
export declare const ContractHash: z.ZodString;
/** The name a signer must type: the one the contract states for their side. */
export declare function expectedSignerName(contract: LeaseContract, role: "landlord" | "tenant"): string;
/** Why a typed signature does not match the contract, or null. */
export declare function typedNameProblem(typed: string, contract: LeaseContract, role: "landlord" | "tenant"): string | null;
/**
 * Sign a lease as whichever side the route says.
 *
 * An electronic signature under Law No. 18/2010: the signer types their full
 * name as the contract states it, may draw a signature (an uploaded PNG), and
 * proves it is them with the code emailed to them, or a tenant with their password.
 * `documentHash` is the `contractHash` they were shown; the API recomputes it
 * and refuses a signature on a contract that has changed since.
 *
 * The landlord's signature sends the invitation to the tenant's email, so the
 * API checks that address for a likely typo once more; `confirmEmail` says it
 * is right as typed. The tenant's side ignores it.
 */
export declare const SignLeaseRequest: z.ZodEffects<z.ZodObject<{
    typedName: z.ZodString;
    /** The drawn signature, uploaded first by the signer (`POST /uploads`, kind `lease_signature`). */
    signatureObjectKey: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
    documentHash: z.ZodString;
    confirmEmail: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    typedName: string;
    documentHash: string;
    code?: string | undefined;
    password?: string | undefined;
    confirmEmail?: boolean | undefined;
    signatureObjectKey?: string | undefined;
}, {
    typedName: string;
    documentHash: string;
    code?: string | undefined;
    password?: string | undefined;
    confirmEmail?: boolean | undefined;
    signatureObjectKey?: string | undefined;
}>, {
    typedName: string;
    documentHash: string;
    code?: string | undefined;
    password?: string | undefined;
    confirmEmail?: boolean | undefined;
    signatureObjectKey?: string | undefined;
}, {
    typedName: string;
    documentHash: string;
    code?: string | undefined;
    password?: string | undefined;
    confirmEmail?: boolean | undefined;
    signatureObjectKey?: string | undefined;
}>;
export type SignLeaseRequest = z.infer<typeof SignLeaseRequest>;
//# sourceMappingURL=contract.d.ts.map