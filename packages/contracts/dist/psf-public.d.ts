import { z } from "zod";
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
/** Crockford's base32: no I, L, O or U, so a docID read aloud is unambiguous. */
export declare const PSF_DOC_ID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/** `PSF-` and two groups of four: 40 random bits. */
export declare const PSF_DOC_ID_PATTERN: RegExp;
/**
 * A new docID from eight random bytes' worth of entropy. The caller passes its
 * own random source (`crypto.randomBytes` on the server), so contracts stays
 * free of Node.
 */
export declare function newPsfDocId(randomBytes: (n: number) => Uint8Array): string;
/**
 * A docID as somebody typed it, made canonical: upper case, the dashes put
 * back, and the letters Crockford folds (O to 0, I and L to 1) folded. Returns
 * null when what is left cannot be a docID.
 */
export declare function normalizePsfDocId(input: string): string | null;
export declare function isPsfDocId(value: string): boolean;
export declare const PsfDocId: z.ZodEffects<z.ZodString, string, string>;
/** `POST /psf/identity/lookup` */
export declare const PsfIdentityLookupRequest: z.ZodObject<{
    documentNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    consent: z.ZodLiteral<true>;
}, "strip", z.ZodTypeAny, {
    documentNumber: string;
    consent: true;
}, {
    documentNumber: string;
    consent: true;
}>;
export type PsfIdentityLookupRequest = z.infer<typeof PsfIdentityLookupRequest>;
export declare const PsfIdentityLookupResult: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
    status: z.ZodLiteral<"code_sent">;
    checkId: z.ZodString;
    /** Where the code went, masked: `+250 78• ••• 545`. */
    sentTo: z.ZodString;
    expiresInSeconds: z.ZodNumber;
    /** The demo's fixed code, so a walkthrough needs no phone. Null elsewhere. */
    demoCode: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "code_sent";
    expiresInSeconds: number;
    checkId: string;
    sentTo: string;
    demoCode: string | null;
}, {
    status: "code_sent";
    expiresInSeconds: number;
    checkId: string;
    sentTo: string;
    demoCode: string | null;
}>, z.ZodObject<{
    status: z.ZodEnum<["not_found", "no_phone", "unavailable"]>;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    status: "unavailable" | "not_found" | "no_phone";
}, {
    message: string;
    status: "unavailable" | "not_found" | "no_phone";
}>]>;
export type PsfIdentityLookupResult = z.infer<typeof PsfIdentityLookupResult>;
/** `POST /psf/identity/confirm` */
export declare const PsfIdentityConfirmRequest: z.ZodObject<{
    checkId: z.ZodString;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    checkId: string;
}, {
    code: string;
    checkId: string;
}>;
export type PsfIdentityConfirmRequest = z.infer<typeof PsfIdentityConfirmRequest>;
/**
 * The person the register holds, revealed to whoever read the code. The token
 * proves the check on submit; it lives 30 minutes and is spent by one submit.
 */
export declare const PsfVerifiedApplicant: z.ZodObject<{
    checkToken: z.ZodString;
    fullName: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    dateOfBirth: z.ZodString;
    gender: z.ZodNullable<z.ZodEnum<["male", "female"]>>;
    documentNumberMasked: z.ZodString;
    /** The register's phone, masked. The contact phone starts from it. */
    phoneMasked: z.ZodNullable<z.ZodString>;
    /** The register's phone in full, to prefill the contact and MoMo fields. */
    phoneE164: z.ZodNullable<z.ZodString>;
    generated: z.ZodBoolean;
    expiresAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    expiresAt: string;
    fullName: string;
    gender: "female" | "male" | null;
    dateOfBirth: string;
    phoneE164: string | null;
    firstName: string;
    lastName: string;
    generated: boolean;
    documentNumberMasked: string;
    phoneMasked: string | null;
    checkToken: string;
}, {
    expiresAt: string;
    fullName: string;
    gender: "female" | "male" | null;
    dateOfBirth: string;
    phoneE164: string | null;
    firstName: string;
    lastName: string;
    generated: boolean;
    documentNumberMasked: string;
    phoneMasked: string | null;
    checkToken: string;
}>;
export type PsfVerifiedApplicant = z.infer<typeof PsfVerifiedApplicant>;
export declare const MomoPhone: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
/** Where the business is. Unlike the hotel form, the street line is required: PSF's form asks for it. */
export declare const PsfPublicAddress: z.ZodObject<{
    provinceId: z.ZodNumber;
    districtId: z.ZodNumber;
    sectorId: z.ZodNumber;
    cellId: z.ZodOptional<z.ZodNumber>;
    villageId: z.ZodOptional<z.ZodNumber>;
    street: z.ZodString;
}, "strip", z.ZodTypeAny, {
    provinceId: number;
    districtId: number;
    sectorId: number;
    street: string;
    cellId?: number | undefined;
    villageId?: number | undefined;
}, {
    provinceId: number;
    districtId: number;
    sectorId: number;
    street: string;
    cellId?: number | undefined;
    villageId?: number | undefined;
}>;
export type PsfPublicAddress = z.infer<typeof PsfPublicAddress>;
/**
 * Each cluster's catch-all association (`industry_other`, `trade_other`, …):
 * where a business whose association is not on PSF's list is filed, beside the
 * name it types.
 */
export declare function isOtherAssociation(code: string): boolean;
/** How many branches one form may list, as many as the hotel form allows. */
export declare const MAX_PSF_BRANCHES = 20;
/**
 * Another place the business trades from (2026-10-23), under the business's
 * own name. Each goes to the PSF officer of its own district to admit, so it
 * carries the same address as the head office: province, district, sector
 * and a street line.
 */
export declare const PsfPublicBranch: z.ZodObject<{
    address: z.ZodObject<{
        provinceId: z.ZodNumber;
        districtId: z.ZodNumber;
        sectorId: z.ZodNumber;
        cellId: z.ZodOptional<z.ZodNumber>;
        villageId: z.ZodOptional<z.ZodNumber>;
        street: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        provinceId: number;
        districtId: number;
        sectorId: number;
        street: string;
        cellId?: number | undefined;
        villageId?: number | undefined;
    }, {
        provinceId: number;
        districtId: number;
        sectorId: number;
        street: string;
        cellId?: number | undefined;
        villageId?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    address: {
        provinceId: number;
        districtId: number;
        sectorId: number;
        street: string;
        cellId?: number | undefined;
        villageId?: number | undefined;
    };
}, {
    address: {
        provinceId: number;
        districtId: number;
        sectorId: number;
        street: string;
        cellId?: number | undefined;
        villageId?: number | undefined;
    };
}>;
export type PsfPublicBranch = z.infer<typeof PsfPublicBranch>;
/** Two places are the same place when the sector matches and the street differs only in case and spacing. */
export declare function psfPlaceKey(address: Pick<PsfPublicAddress, "sectorId" | "street">): string;
export declare const PsfPublicBusiness: z.ZodEffects<z.ZodObject<{
    legalName: z.ZodString;
    registrationKind: z.ZodEnum<["tin", "rca", "rgb", "other", "none"]>;
    tin: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
    registrationNumber: z.ZodOptional<z.ZodString>;
    /** The sector's subtype the business picked, or `subsectorOther` when none fits. */
    subsectorId: z.ZodOptional<z.ZodString>;
    subsectorOther: z.ZodOptional<z.ZodString>;
    associationCode: z.ZodString;
    /**
     * The association the business names itself when PSF's list does not have
     * it. Goes with the cluster's own "other" row (`isOtherAssociation`).
     */
    associationOther: z.ZodOptional<z.ZodString>;
    ownerGroups: z.ZodDefault<z.ZodArray<z.ZodEnum<["women", "youth", "pwd"]>, "many">>;
    address: z.ZodObject<{
        provinceId: z.ZodNumber;
        districtId: z.ZodNumber;
        sectorId: z.ZodNumber;
        cellId: z.ZodOptional<z.ZodNumber>;
        villageId: z.ZodOptional<z.ZodNumber>;
        street: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        provinceId: number;
        districtId: number;
        sectorId: number;
        street: string;
        cellId?: number | undefined;
        villageId?: number | undefined;
    }, {
        provinceId: number;
        districtId: number;
        sectorId: number;
        street: string;
        cellId?: number | undefined;
        villageId?: number | undefined;
    }>;
    companyType: z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>;
    ownership: z.ZodEnum<["foreign_100", "rwandan_100", "franchise", "joint_venture", "foreign_representative", "other"]>;
    ownershipOther: z.ZodOptional<z.ZodString>;
    businessActivity: z.ZodString;
    website: z.ZodOptional<z.ZodString>;
    /**
     * The business's logo (2026-10-23), optional: the key `POST /psf/logo`
     * returned. It is printed on the membership certificate.
     */
    logoObjectKey: z.ZodOptional<z.ZodString>;
    tradeDirection: z.ZodEnum<["none", "export", "import", "both"]>;
    tradeGoods: z.ZodOptional<z.ZodString>;
    tradeCountries: z.ZodDefault<z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">>;
    branches: z.ZodDefault<z.ZodArray<z.ZodObject<{
        address: z.ZodObject<{
            provinceId: z.ZodNumber;
            districtId: z.ZodNumber;
            sectorId: z.ZodNumber;
            cellId: z.ZodOptional<z.ZodNumber>;
            villageId: z.ZodOptional<z.ZodNumber>;
            street: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            provinceId: number;
            districtId: number;
            sectorId: number;
            street: string;
            cellId?: number | undefined;
            villageId?: number | undefined;
        }, {
            provinceId: number;
            districtId: number;
            sectorId: number;
            street: string;
            cellId?: number | undefined;
            villageId?: number | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        address: {
            provinceId: number;
            districtId: number;
            sectorId: number;
            street: string;
            cellId?: number | undefined;
            villageId?: number | undefined;
        };
    }, {
        address: {
            provinceId: number;
            districtId: number;
            sectorId: number;
            street: string;
            cellId?: number | undefined;
            villageId?: number | undefined;
        };
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    address: {
        provinceId: number;
        districtId: number;
        sectorId: number;
        street: string;
        cellId?: number | undefined;
        villageId?: number | undefined;
    };
    companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
    ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
    businessActivity: string;
    tradeDirection: "none" | "export" | "import" | "both";
    tradeCountries: string[];
    legalName: string;
    branches: {
        address: {
            provinceId: number;
            districtId: number;
            sectorId: number;
            street: string;
            cellId?: number | undefined;
            villageId?: number | undefined;
        };
    }[];
    registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
    associationCode: string;
    ownerGroups: ("women" | "youth" | "pwd")[];
    website?: string | undefined;
    ownershipOther?: string | undefined;
    tradeGoods?: string | undefined;
    tin?: string | undefined;
    registrationNumber?: string | undefined;
    subsectorId?: string | undefined;
    subsectorOther?: string | undefined;
    associationOther?: string | undefined;
    logoObjectKey?: string | undefined;
}, {
    address: {
        provinceId: number;
        districtId: number;
        sectorId: number;
        street: string;
        cellId?: number | undefined;
        villageId?: number | undefined;
    };
    companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
    ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
    businessActivity: string;
    tradeDirection: "none" | "export" | "import" | "both";
    legalName: string;
    registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
    associationCode: string;
    website?: string | undefined;
    ownershipOther?: string | undefined;
    tradeGoods?: string | undefined;
    tradeCountries?: string[] | undefined;
    tin?: string | undefined;
    branches?: {
        address: {
            provinceId: number;
            districtId: number;
            sectorId: number;
            street: string;
            cellId?: number | undefined;
            villageId?: number | undefined;
        };
    }[] | undefined;
    registrationNumber?: string | undefined;
    ownerGroups?: ("women" | "youth" | "pwd")[] | undefined;
    subsectorId?: string | undefined;
    subsectorOther?: string | undefined;
    associationOther?: string | undefined;
    logoObjectKey?: string | undefined;
}>, {
    address: {
        provinceId: number;
        districtId: number;
        sectorId: number;
        street: string;
        cellId?: number | undefined;
        villageId?: number | undefined;
    };
    companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
    ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
    businessActivity: string;
    tradeDirection: "none" | "export" | "import" | "both";
    tradeCountries: string[];
    legalName: string;
    branches: {
        address: {
            provinceId: number;
            districtId: number;
            sectorId: number;
            street: string;
            cellId?: number | undefined;
            villageId?: number | undefined;
        };
    }[];
    registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
    associationCode: string;
    ownerGroups: ("women" | "youth" | "pwd")[];
    website?: string | undefined;
    ownershipOther?: string | undefined;
    tradeGoods?: string | undefined;
    tin?: string | undefined;
    registrationNumber?: string | undefined;
    subsectorId?: string | undefined;
    subsectorOther?: string | undefined;
    associationOther?: string | undefined;
    logoObjectKey?: string | undefined;
}, {
    address: {
        provinceId: number;
        districtId: number;
        sectorId: number;
        street: string;
        cellId?: number | undefined;
        villageId?: number | undefined;
    };
    companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
    ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
    businessActivity: string;
    tradeDirection: "none" | "export" | "import" | "both";
    legalName: string;
    registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
    associationCode: string;
    website?: string | undefined;
    ownershipOther?: string | undefined;
    tradeGoods?: string | undefined;
    tradeCountries?: string[] | undefined;
    tin?: string | undefined;
    branches?: {
        address: {
            provinceId: number;
            districtId: number;
            sectorId: number;
            street: string;
            cellId?: number | undefined;
            villageId?: number | undefined;
        };
    }[] | undefined;
    registrationNumber?: string | undefined;
    ownerGroups?: ("women" | "youth" | "pwd")[] | undefined;
    subsectorId?: string | undefined;
    subsectorOther?: string | undefined;
    associationOther?: string | undefined;
    logoObjectKey?: string | undefined;
}>;
export type PsfPublicBusiness = z.infer<typeof PsfPublicBusiness>;
export declare const PsfPublicContact: z.ZodObject<{
    role: z.ZodEnum<["owner", "managing_director", "ceo", "chairman"]>;
    /** PSF's form knows two genders; the register may hold none. */
    gender: z.ZodEnum<["male", "female"]>;
    phoneE164: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    /** Optional: status reaches the phone by SMS either way. */
    email: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    gender: "female" | "male";
    phoneE164: string;
    role: "owner" | "managing_director" | "ceo" | "chairman";
    email?: string | undefined;
}, {
    gender: "female" | "male";
    phoneE164: string;
    role: "owner" | "managing_director" | "ceo" | "chairman";
    email?: string | undefined;
}>;
export type PsfPublicContact = z.infer<typeof PsfPublicContact>;
export declare const PsfPublicMembership: z.ZodObject<{
    tierCode: z.ZodString;
    /**
     * The yearly amount the business will pay (2026-10-23): at least PSF's
     * price for the band in its district, and no more than the band's ceiling
     * (`psfFeeCeilings`). The API refuses an amount outside the band, so
     * nobody is charged a figure the band does not allow.
     */
    declaredFeeRwf: z.ZodOptional<z.ZodEffects<z.ZodNumber, number, number>>;
}, "strip", z.ZodTypeAny, {
    tierCode: string;
    declaredFeeRwf?: number | undefined;
}, {
    tierCode: string;
    declaredFeeRwf?: number | undefined;
}>;
export type PsfPublicMembership = z.infer<typeof PsfPublicMembership>;
/** `POST /psf/applications`: the whole form, and the number the membership fee is charged to. */
export declare const PsfPublicSubmitRequest: z.ZodObject<{
    checkToken: z.ZodString;
    business: z.ZodEffects<z.ZodObject<{
        legalName: z.ZodString;
        registrationKind: z.ZodEnum<["tin", "rca", "rgb", "other", "none"]>;
        tin: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
        registrationNumber: z.ZodOptional<z.ZodString>;
        /** The sector's subtype the business picked, or `subsectorOther` when none fits. */
        subsectorId: z.ZodOptional<z.ZodString>;
        subsectorOther: z.ZodOptional<z.ZodString>;
        associationCode: z.ZodString;
        /**
         * The association the business names itself when PSF's list does not have
         * it. Goes with the cluster's own "other" row (`isOtherAssociation`).
         */
        associationOther: z.ZodOptional<z.ZodString>;
        ownerGroups: z.ZodDefault<z.ZodArray<z.ZodEnum<["women", "youth", "pwd"]>, "many">>;
        address: z.ZodObject<{
            provinceId: z.ZodNumber;
            districtId: z.ZodNumber;
            sectorId: z.ZodNumber;
            cellId: z.ZodOptional<z.ZodNumber>;
            villageId: z.ZodOptional<z.ZodNumber>;
            street: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            provinceId: number;
            districtId: number;
            sectorId: number;
            street: string;
            cellId?: number | undefined;
            villageId?: number | undefined;
        }, {
            provinceId: number;
            districtId: number;
            sectorId: number;
            street: string;
            cellId?: number | undefined;
            villageId?: number | undefined;
        }>;
        companyType: z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>;
        ownership: z.ZodEnum<["foreign_100", "rwandan_100", "franchise", "joint_venture", "foreign_representative", "other"]>;
        ownershipOther: z.ZodOptional<z.ZodString>;
        businessActivity: z.ZodString;
        website: z.ZodOptional<z.ZodString>;
        /**
         * The business's logo (2026-10-23), optional: the key `POST /psf/logo`
         * returned. It is printed on the membership certificate.
         */
        logoObjectKey: z.ZodOptional<z.ZodString>;
        tradeDirection: z.ZodEnum<["none", "export", "import", "both"]>;
        tradeGoods: z.ZodOptional<z.ZodString>;
        tradeCountries: z.ZodDefault<z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">>;
        branches: z.ZodDefault<z.ZodArray<z.ZodObject<{
            address: z.ZodObject<{
                provinceId: z.ZodNumber;
                districtId: z.ZodNumber;
                sectorId: z.ZodNumber;
                cellId: z.ZodOptional<z.ZodNumber>;
                villageId: z.ZodOptional<z.ZodNumber>;
                street: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                provinceId: number;
                districtId: number;
                sectorId: number;
                street: string;
                cellId?: number | undefined;
                villageId?: number | undefined;
            }, {
                provinceId: number;
                districtId: number;
                sectorId: number;
                street: string;
                cellId?: number | undefined;
                villageId?: number | undefined;
            }>;
        }, "strip", z.ZodTypeAny, {
            address: {
                provinceId: number;
                districtId: number;
                sectorId: number;
                street: string;
                cellId?: number | undefined;
                villageId?: number | undefined;
            };
        }, {
            address: {
                provinceId: number;
                districtId: number;
                sectorId: number;
                street: string;
                cellId?: number | undefined;
                villageId?: number | undefined;
            };
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        address: {
            provinceId: number;
            districtId: number;
            sectorId: number;
            street: string;
            cellId?: number | undefined;
            villageId?: number | undefined;
        };
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
        ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeCountries: string[];
        legalName: string;
        branches: {
            address: {
                provinceId: number;
                districtId: number;
                sectorId: number;
                street: string;
                cellId?: number | undefined;
                villageId?: number | undefined;
            };
        }[];
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
        associationCode: string;
        ownerGroups: ("women" | "youth" | "pwd")[];
        website?: string | undefined;
        ownershipOther?: string | undefined;
        tradeGoods?: string | undefined;
        tin?: string | undefined;
        registrationNumber?: string | undefined;
        subsectorId?: string | undefined;
        subsectorOther?: string | undefined;
        associationOther?: string | undefined;
        logoObjectKey?: string | undefined;
    }, {
        address: {
            provinceId: number;
            districtId: number;
            sectorId: number;
            street: string;
            cellId?: number | undefined;
            villageId?: number | undefined;
        };
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
        ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        legalName: string;
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
        associationCode: string;
        website?: string | undefined;
        ownershipOther?: string | undefined;
        tradeGoods?: string | undefined;
        tradeCountries?: string[] | undefined;
        tin?: string | undefined;
        branches?: {
            address: {
                provinceId: number;
                districtId: number;
                sectorId: number;
                street: string;
                cellId?: number | undefined;
                villageId?: number | undefined;
            };
        }[] | undefined;
        registrationNumber?: string | undefined;
        ownerGroups?: ("women" | "youth" | "pwd")[] | undefined;
        subsectorId?: string | undefined;
        subsectorOther?: string | undefined;
        associationOther?: string | undefined;
        logoObjectKey?: string | undefined;
    }>, {
        address: {
            provinceId: number;
            districtId: number;
            sectorId: number;
            street: string;
            cellId?: number | undefined;
            villageId?: number | undefined;
        };
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
        ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeCountries: string[];
        legalName: string;
        branches: {
            address: {
                provinceId: number;
                districtId: number;
                sectorId: number;
                street: string;
                cellId?: number | undefined;
                villageId?: number | undefined;
            };
        }[];
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
        associationCode: string;
        ownerGroups: ("women" | "youth" | "pwd")[];
        website?: string | undefined;
        ownershipOther?: string | undefined;
        tradeGoods?: string | undefined;
        tin?: string | undefined;
        registrationNumber?: string | undefined;
        subsectorId?: string | undefined;
        subsectorOther?: string | undefined;
        associationOther?: string | undefined;
        logoObjectKey?: string | undefined;
    }, {
        address: {
            provinceId: number;
            districtId: number;
            sectorId: number;
            street: string;
            cellId?: number | undefined;
            villageId?: number | undefined;
        };
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
        ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        legalName: string;
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
        associationCode: string;
        website?: string | undefined;
        ownershipOther?: string | undefined;
        tradeGoods?: string | undefined;
        tradeCountries?: string[] | undefined;
        tin?: string | undefined;
        branches?: {
            address: {
                provinceId: number;
                districtId: number;
                sectorId: number;
                street: string;
                cellId?: number | undefined;
                villageId?: number | undefined;
            };
        }[] | undefined;
        registrationNumber?: string | undefined;
        ownerGroups?: ("women" | "youth" | "pwd")[] | undefined;
        subsectorId?: string | undefined;
        subsectorOther?: string | undefined;
        associationOther?: string | undefined;
        logoObjectKey?: string | undefined;
    }>;
    membership: z.ZodObject<{
        tierCode: z.ZodString;
        /**
         * The yearly amount the business will pay (2026-10-23): at least PSF's
         * price for the band in its district, and no more than the band's ceiling
         * (`psfFeeCeilings`). The API refuses an amount outside the band, so
         * nobody is charged a figure the band does not allow.
         */
        declaredFeeRwf: z.ZodOptional<z.ZodEffects<z.ZodNumber, number, number>>;
    }, "strip", z.ZodTypeAny, {
        tierCode: string;
        declaredFeeRwf?: number | undefined;
    }, {
        tierCode: string;
        declaredFeeRwf?: number | undefined;
    }>;
    contact: z.ZodObject<{
        role: z.ZodEnum<["owner", "managing_director", "ceo", "chairman"]>;
        /** PSF's form knows two genders; the register may hold none. */
        gender: z.ZodEnum<["male", "female"]>;
        phoneE164: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        /** Optional: status reaches the phone by SMS either way. */
        email: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        gender: "female" | "male";
        phoneE164: string;
        role: "owner" | "managing_director" | "ceo" | "chairman";
        email?: string | undefined;
    }, {
        gender: "female" | "male";
        phoneE164: string;
        role: "owner" | "managing_director" | "ceo" | "chairman";
        email?: string | undefined;
    }>;
    payerPhoneE164: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    consent: z.ZodLiteral<true>;
}, "strip", z.ZodTypeAny, {
    business: {
        address: {
            provinceId: number;
            districtId: number;
            sectorId: number;
            street: string;
            cellId?: number | undefined;
            villageId?: number | undefined;
        };
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
        ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        tradeCountries: string[];
        legalName: string;
        branches: {
            address: {
                provinceId: number;
                districtId: number;
                sectorId: number;
                street: string;
                cellId?: number | undefined;
                villageId?: number | undefined;
            };
        }[];
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
        associationCode: string;
        ownerGroups: ("women" | "youth" | "pwd")[];
        website?: string | undefined;
        ownershipOther?: string | undefined;
        tradeGoods?: string | undefined;
        tin?: string | undefined;
        registrationNumber?: string | undefined;
        subsectorId?: string | undefined;
        subsectorOther?: string | undefined;
        associationOther?: string | undefined;
        logoObjectKey?: string | undefined;
    };
    consent: true;
    membership: {
        tierCode: string;
        declaredFeeRwf?: number | undefined;
    };
    contact: {
        gender: "female" | "male";
        phoneE164: string;
        role: "owner" | "managing_director" | "ceo" | "chairman";
        email?: string | undefined;
    };
    checkToken: string;
    payerPhoneE164: string;
}, {
    business: {
        address: {
            provinceId: number;
            districtId: number;
            sectorId: number;
            street: string;
            cellId?: number | undefined;
            villageId?: number | undefined;
        };
        companyType: "cooperative" | "ngo" | "partly_state_owned" | "private_company" | "public_company" | "sole_trader";
        ownership: "other" | "foreign_100" | "rwandan_100" | "franchise" | "joint_venture" | "foreign_representative";
        businessActivity: string;
        tradeDirection: "none" | "export" | "import" | "both";
        legalName: string;
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb";
        associationCode: string;
        website?: string | undefined;
        ownershipOther?: string | undefined;
        tradeGoods?: string | undefined;
        tradeCountries?: string[] | undefined;
        tin?: string | undefined;
        branches?: {
            address: {
                provinceId: number;
                districtId: number;
                sectorId: number;
                street: string;
                cellId?: number | undefined;
                villageId?: number | undefined;
            };
        }[] | undefined;
        registrationNumber?: string | undefined;
        ownerGroups?: ("women" | "youth" | "pwd")[] | undefined;
        subsectorId?: string | undefined;
        subsectorOther?: string | undefined;
        associationOther?: string | undefined;
        logoObjectKey?: string | undefined;
    };
    consent: true;
    membership: {
        tierCode: string;
        declaredFeeRwf?: number | undefined;
    };
    contact: {
        gender: "female" | "male";
        phoneE164: string;
        role: "owner" | "managing_director" | "ceo" | "chairman";
        email?: string | undefined;
    };
    checkToken: string;
    payerPhoneE164: string;
}>;
export type PsfPublicSubmitRequest = z.infer<typeof PsfPublicSubmitRequest>;
/**
 * `POST /psf/logo` (2026-10-23): a logo uploaded from the form, under the
 * form's verified ID check (`x-psf-check-token`), never a session. What comes
 * back is the key the form sends as `business.logoObjectKey`.
 */
export declare const PsfLogoUploadResult: z.ZodObject<{
    objectKey: z.ZodString;
    sizeBytes: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    objectKey: string;
    sizeBytes: number;
}, {
    objectKey: string;
    sizeBytes: number;
}>;
export type PsfLogoUploadResult = z.infer<typeof PsfLogoUploadResult>;
/** The header the logo upload carries the form's ID check token in. */
export declare const PSF_CHECK_TOKEN_HEADER = "x-psf-check-token";
export declare const PsfPublicSubmitResult: z.ZodObject<{
    docId: z.ZodString;
    businessCode: z.ZodNullable<z.ZodString>;
    /** What the one payment at submit came to: the membership fee, nothing else (2026-10-23). */
    totalRwf: z.ZodNumber;
    /** False when the fee charge did not settle; the tracking page offers it again. */
    feePaid: z.ZodBoolean;
    feeProblem: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    businessCode: string | null;
    docId: string;
    totalRwf: number;
    feePaid: boolean;
    feeProblem: string | null;
}, {
    businessCode: string | null;
    docId: string;
    totalRwf: number;
    feePaid: boolean;
    feeProblem: string | null;
}>;
export type PsfPublicSubmitResult = z.infer<typeof PsfPublicSubmitResult>;
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
export declare const PsfTrackStage: z.ZodEnum<["fee_due", "under_review", "approved", "member", "lapsed", "declined", "withdrawn"]>;
export type PsfTrackStage = z.infer<typeof PsfTrackStage>;
export declare const PSF_TRACK_STAGE_LABEL: Readonly<Record<PsfTrackStage, string>>;
export declare const PsfTrackEventKind: z.ZodEnum<["submitted", "fee_paid", "code_issued", "in_review", "approved", "declined", "paid", "expired", "withdrawn"]>;
export type PsfTrackEventKind = z.infer<typeof PsfTrackEventKind>;
export declare const PsfTrackEvent: z.ZodObject<{
    kind: z.ZodEnum<["submitted", "fee_paid", "code_issued", "in_review", "approved", "declined", "paid", "expired", "withdrawn"]>;
    at: z.ZodString;
    title: z.ZodString;
    detail: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "submitted" | "approved" | "declined" | "expired" | "withdrawn" | "paid" | "fee_paid" | "code_issued" | "in_review";
    title: string;
    detail: string | null;
    at: string;
}, {
    kind: "submitted" | "approved" | "declined" | "expired" | "withdrawn" | "paid" | "fee_paid" | "code_issued" | "in_review";
    title: string;
    detail: string | null;
    at: string;
}>;
export type PsfTrackEvent = z.infer<typeof PsfTrackEvent>;
/** `GET /psf/track/:docId`. Nothing here helps anyone pretend to be the applicant. */
/**
 * One payment on an application, for the tracking page and the officer. A
 * `registration_fee` is a hotel's account fee, or one a PSF business paid
 * before the fee was dropped (2026-10-23); nothing is refunded.
 */
export declare const PsfPaymentLine: z.ZodObject<{
    kind: z.ZodEnum<["registration_fee", "membership_fee"]>;
    amountRwf: z.ZodNumber;
    at: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["paid"]>;
    reference: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "paid";
    kind: "registration_fee" | "membership_fee";
    reference: string | null;
    amountRwf: number;
    at: string | null;
}, {
    status: "paid";
    kind: "registration_fee" | "membership_fee";
    reference: string | null;
    amountRwf: number;
    at: string | null;
}>;
export type PsfPaymentLine = z.infer<typeof PsfPaymentLine>;
export declare const PsfTrackView: z.ZodObject<{
    docId: z.ZodString;
    stage: z.ZodEnum<["fee_due", "under_review", "approved", "member", "lapsed", "declined", "withdrawn"]>;
    submittedAt: z.ZodString;
    /** Whole days the application has waited on PSF; null when not under review. */
    waitingDays: z.ZodNullable<z.ZodNumber>;
    business: z.ZodObject<{
        name: z.ZodString;
        code: z.ZodNullable<z.ZodString>;
        districtName: z.ZodNullable<z.ZodString>;
        provinceName: z.ZodNullable<z.ZodString>;
        sectorName: z.ZodNullable<z.ZodString>;
        clusterName: z.ZodNullable<z.ZodString>;
        subsectorName: z.ZodNullable<z.ZodString>;
        associationName: z.ZodNullable<z.ZodString>;
        ownerGroups: z.ZodArray<z.ZodEnum<["women", "youth", "pwd"]>, "many">;
        registrationKind: z.ZodNullable<z.ZodEnum<["tin", "rca", "rgb", "other", "none"]>>;
        /** The business's logo, as an address under the API (`/v1/psf/track/:docId/logo`); null without one. */
        logoUrl: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        /** Each branch and where its own district's PSF office stands on it. */
        branches: z.ZodDefault<z.ZodArray<z.ZodObject<{
            districtName: z.ZodNullable<z.ZodString>;
            sectorName: z.ZodNullable<z.ZodString>;
            status: z.ZodEnum<["pending", "admitted", "declined"]>;
            note: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "pending" | "declined" | "admitted";
            districtName: string | null;
            sectorName: string | null;
            note: string | null;
        }, {
            status: "pending" | "declined" | "admitted";
            districtName: string | null;
            sectorName: string | null;
            note: string | null;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        code: string | null;
        name: string;
        districtName: string | null;
        branches: {
            status: "pending" | "declined" | "admitted";
            districtName: string | null;
            sectorName: string | null;
            note: string | null;
        }[];
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
        ownerGroups: ("women" | "youth" | "pwd")[];
        sectorName: string | null;
        clusterName: string | null;
        subsectorName: string | null;
        associationName: string | null;
        provinceName: string | null;
        logoUrl: string | null;
    }, {
        code: string | null;
        name: string;
        districtName: string | null;
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
        ownerGroups: ("women" | "youth" | "pwd")[];
        sectorName: string | null;
        clusterName: string | null;
        subsectorName: string | null;
        associationName: string | null;
        provinceName: string | null;
        branches?: {
            status: "pending" | "declined" | "admitted";
            districtName: string | null;
            sectorName: string | null;
            note: string | null;
        }[] | undefined;
        logoUrl?: string | null | undefined;
    }>;
    request: z.ZodObject<{
        family: z.ZodEnum<["golden_circle", "indashyikirwa", "indatwa", "ordinary", "junior_giants"]>;
        familyName: z.ZodString;
        tierName: z.ZodString;
        declaredFeeRwf: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        declaredFeeRwf: number | null;
        family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
        tierName: string;
        familyName: string;
    }, {
        declaredFeeRwf: number | null;
        family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
        tierName: string;
        familyName: string;
    }>;
    /** Who reviews it: "PSF Kicukiro district office". */
    reviewingOffice: z.ZodString;
    approval: z.ZodNullable<z.ZodObject<{
        membershipNumber: z.ZodString;
        feeRwf: z.ZodNumber;
        approvedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        membershipNumber: string;
        feeRwf: number;
        approvedAt: string;
    }, {
        membershipNumber: string;
        feeRwf: number;
        approvedAt: string;
    }>>;
    decline: z.ZodNullable<z.ZodObject<{
        reason: z.ZodEnum<["details_incomplete", "not_eligible_for_tier", "business_not_recognised", "other"]>;
        reasonLabel: z.ZodString;
        note: z.ZodNullable<z.ZodString>;
        decidedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        decidedAt: string;
        reason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised";
        note: string | null;
        reasonLabel: string;
    }, {
        decidedAt: string;
        reason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised";
        note: string | null;
        reasonLabel: string;
    }>>;
    membership: z.ZodNullable<z.ZodObject<{
        number: z.ZodString;
        tierName: z.ZodString;
        family: z.ZodNullable<z.ZodEnum<["golden_circle", "indashyikirwa", "indatwa", "ordinary", "junior_giants"]>>;
        feeRwf: z.ZodNullable<z.ZodNumber>;
        startsOn: z.ZodNullable<z.ZodString>;
        expiresOn: z.ZodNullable<z.ZodString>;
        paidAt: z.ZodNullable<z.ZodString>;
        reference: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        number: string;
        reference: string | null;
        expiresOn: string | null;
        family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants" | null;
        tierName: string;
        startsOn: string | null;
        paidAt: string | null;
        feeRwf: number | null;
    }, {
        number: string;
        reference: string | null;
        expiresOn: string | null;
        family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants" | null;
        tierName: string;
        startsOn: string | null;
        paidAt: string | null;
        feeRwf: number | null;
    }>>;
    contact: z.ZodObject<{
        name: z.ZodString;
        phoneMasked: z.ZodString;
        emailMasked: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        phoneMasked: string;
        emailMasked: string | null;
    }, {
        name: string;
        phoneMasked: string;
        emailMasked: string | null;
    }>;
    events: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["submitted", "fee_paid", "code_issued", "in_review", "approved", "declined", "paid", "expired", "withdrawn"]>;
        at: z.ZodString;
        title: z.ZodString;
        detail: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "submitted" | "approved" | "declined" | "expired" | "withdrawn" | "paid" | "fee_paid" | "code_issued" | "in_review";
        title: string;
        detail: string | null;
        at: string;
    }, {
        kind: "submitted" | "approved" | "declined" | "expired" | "withdrawn" | "paid" | "fee_paid" | "code_issued" | "in_review";
        title: string;
        detail: string | null;
        at: string;
    }>, "many">;
    /** Every payment on this application, oldest first. */
    payments: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["registration_fee", "membership_fee"]>;
        amountRwf: z.ZodNumber;
        at: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["paid"]>;
        reference: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "paid";
        kind: "registration_fee" | "membership_fee";
        reference: string | null;
        amountRwf: number;
        at: string | null;
    }, {
        status: "paid";
        kind: "registration_fee" | "membership_fee";
        reference: string | null;
        amountRwf: number;
        at: string | null;
    }>, "many">;
    /** What the one payment at submit comes to while it is still due. */
    dueRwf: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    business: {
        code: string | null;
        name: string;
        districtName: string | null;
        branches: {
            status: "pending" | "declined" | "admitted";
            districtName: string | null;
            sectorName: string | null;
            note: string | null;
        }[];
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
        ownerGroups: ("women" | "youth" | "pwd")[];
        sectorName: string | null;
        clusterName: string | null;
        subsectorName: string | null;
        associationName: string | null;
        provinceName: string | null;
        logoUrl: string | null;
    };
    stage: "approved" | "declined" | "member" | "withdrawn" | "lapsed" | "fee_due" | "under_review";
    submittedAt: string;
    membership: {
        number: string;
        reference: string | null;
        expiresOn: string | null;
        family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants" | null;
        tierName: string;
        startsOn: string | null;
        paidAt: string | null;
        feeRwf: number | null;
    } | null;
    decline: {
        decidedAt: string;
        reason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised";
        note: string | null;
        reasonLabel: string;
    } | null;
    waitingDays: number | null;
    docId: string;
    contact: {
        name: string;
        phoneMasked: string;
        emailMasked: string | null;
    };
    events: {
        kind: "submitted" | "approved" | "declined" | "expired" | "withdrawn" | "paid" | "fee_paid" | "code_issued" | "in_review";
        title: string;
        detail: string | null;
        at: string;
    }[];
    payments: {
        status: "paid";
        kind: "registration_fee" | "membership_fee";
        reference: string | null;
        amountRwf: number;
        at: string | null;
    }[];
    approval: {
        membershipNumber: string;
        feeRwf: number;
        approvedAt: string;
    } | null;
    request: {
        declaredFeeRwf: number | null;
        family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
        tierName: string;
        familyName: string;
    };
    reviewingOffice: string;
    dueRwf: number | null;
}, {
    business: {
        code: string | null;
        name: string;
        districtName: string | null;
        registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
        ownerGroups: ("women" | "youth" | "pwd")[];
        sectorName: string | null;
        clusterName: string | null;
        subsectorName: string | null;
        associationName: string | null;
        provinceName: string | null;
        branches?: {
            status: "pending" | "declined" | "admitted";
            districtName: string | null;
            sectorName: string | null;
            note: string | null;
        }[] | undefined;
        logoUrl?: string | null | undefined;
    };
    stage: "approved" | "declined" | "member" | "withdrawn" | "lapsed" | "fee_due" | "under_review";
    submittedAt: string;
    membership: {
        number: string;
        reference: string | null;
        expiresOn: string | null;
        family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants" | null;
        tierName: string;
        startsOn: string | null;
        paidAt: string | null;
        feeRwf: number | null;
    } | null;
    decline: {
        decidedAt: string;
        reason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised";
        note: string | null;
        reasonLabel: string;
    } | null;
    waitingDays: number | null;
    docId: string;
    contact: {
        name: string;
        phoneMasked: string;
        emailMasked: string | null;
    };
    events: {
        kind: "submitted" | "approved" | "declined" | "expired" | "withdrawn" | "paid" | "fee_paid" | "code_issued" | "in_review";
        title: string;
        detail: string | null;
        at: string;
    }[];
    payments: {
        status: "paid";
        kind: "registration_fee" | "membership_fee";
        reference: string | null;
        amountRwf: number;
        at: string | null;
    }[];
    approval: {
        membershipNumber: string;
        feeRwf: number;
        approvedAt: string;
    } | null;
    request: {
        declaredFeeRwf: number | null;
        family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
        tierName: string;
        familyName: string;
    };
    reviewingOffice: string;
    dueRwf: number | null;
}>;
export type PsfTrackView = z.infer<typeof PsfTrackView>;
/** `POST /psf/track/:docId/pay`, and `/pay-registration` for the payment at submit. */
export declare const PsfTrackPayRequest: z.ZodObject<{
    phoneE164: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
}, "strip", z.ZodTypeAny, {
    phoneE164: string;
}, {
    phoneE164: string;
}>;
export type PsfTrackPayRequest = z.infer<typeof PsfTrackPayRequest>;
export declare const PsfTrackPayResult: z.ZodObject<{
    status: z.ZodEnum<["paid", "pending", "declined"]>;
    message: z.ZodNullable<z.ZodString>;
    view: z.ZodObject<{
        docId: z.ZodString;
        stage: z.ZodEnum<["fee_due", "under_review", "approved", "member", "lapsed", "declined", "withdrawn"]>;
        submittedAt: z.ZodString;
        /** Whole days the application has waited on PSF; null when not under review. */
        waitingDays: z.ZodNullable<z.ZodNumber>;
        business: z.ZodObject<{
            name: z.ZodString;
            code: z.ZodNullable<z.ZodString>;
            districtName: z.ZodNullable<z.ZodString>;
            provinceName: z.ZodNullable<z.ZodString>;
            sectorName: z.ZodNullable<z.ZodString>;
            clusterName: z.ZodNullable<z.ZodString>;
            subsectorName: z.ZodNullable<z.ZodString>;
            associationName: z.ZodNullable<z.ZodString>;
            ownerGroups: z.ZodArray<z.ZodEnum<["women", "youth", "pwd"]>, "many">;
            registrationKind: z.ZodNullable<z.ZodEnum<["tin", "rca", "rgb", "other", "none"]>>;
            /** The business's logo, as an address under the API (`/v1/psf/track/:docId/logo`); null without one. */
            logoUrl: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            /** Each branch and where its own district's PSF office stands on it. */
            branches: z.ZodDefault<z.ZodArray<z.ZodObject<{
                districtName: z.ZodNullable<z.ZodString>;
                sectorName: z.ZodNullable<z.ZodString>;
                status: z.ZodEnum<["pending", "admitted", "declined"]>;
                note: z.ZodNullable<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                status: "pending" | "declined" | "admitted";
                districtName: string | null;
                sectorName: string | null;
                note: string | null;
            }, {
                status: "pending" | "declined" | "admitted";
                districtName: string | null;
                sectorName: string | null;
                note: string | null;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            code: string | null;
            name: string;
            districtName: string | null;
            branches: {
                status: "pending" | "declined" | "admitted";
                districtName: string | null;
                sectorName: string | null;
                note: string | null;
            }[];
            registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
            ownerGroups: ("women" | "youth" | "pwd")[];
            sectorName: string | null;
            clusterName: string | null;
            subsectorName: string | null;
            associationName: string | null;
            provinceName: string | null;
            logoUrl: string | null;
        }, {
            code: string | null;
            name: string;
            districtName: string | null;
            registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
            ownerGroups: ("women" | "youth" | "pwd")[];
            sectorName: string | null;
            clusterName: string | null;
            subsectorName: string | null;
            associationName: string | null;
            provinceName: string | null;
            branches?: {
                status: "pending" | "declined" | "admitted";
                districtName: string | null;
                sectorName: string | null;
                note: string | null;
            }[] | undefined;
            logoUrl?: string | null | undefined;
        }>;
        request: z.ZodObject<{
            family: z.ZodEnum<["golden_circle", "indashyikirwa", "indatwa", "ordinary", "junior_giants"]>;
            familyName: z.ZodString;
            tierName: z.ZodString;
            declaredFeeRwf: z.ZodNullable<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            declaredFeeRwf: number | null;
            family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
            tierName: string;
            familyName: string;
        }, {
            declaredFeeRwf: number | null;
            family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
            tierName: string;
            familyName: string;
        }>;
        /** Who reviews it: "PSF Kicukiro district office". */
        reviewingOffice: z.ZodString;
        approval: z.ZodNullable<z.ZodObject<{
            membershipNumber: z.ZodString;
            feeRwf: z.ZodNumber;
            approvedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            membershipNumber: string;
            feeRwf: number;
            approvedAt: string;
        }, {
            membershipNumber: string;
            feeRwf: number;
            approvedAt: string;
        }>>;
        decline: z.ZodNullable<z.ZodObject<{
            reason: z.ZodEnum<["details_incomplete", "not_eligible_for_tier", "business_not_recognised", "other"]>;
            reasonLabel: z.ZodString;
            note: z.ZodNullable<z.ZodString>;
            decidedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            decidedAt: string;
            reason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised";
            note: string | null;
            reasonLabel: string;
        }, {
            decidedAt: string;
            reason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised";
            note: string | null;
            reasonLabel: string;
        }>>;
        membership: z.ZodNullable<z.ZodObject<{
            number: z.ZodString;
            tierName: z.ZodString;
            family: z.ZodNullable<z.ZodEnum<["golden_circle", "indashyikirwa", "indatwa", "ordinary", "junior_giants"]>>;
            feeRwf: z.ZodNullable<z.ZodNumber>;
            startsOn: z.ZodNullable<z.ZodString>;
            expiresOn: z.ZodNullable<z.ZodString>;
            paidAt: z.ZodNullable<z.ZodString>;
            reference: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            number: string;
            reference: string | null;
            expiresOn: string | null;
            family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants" | null;
            tierName: string;
            startsOn: string | null;
            paidAt: string | null;
            feeRwf: number | null;
        }, {
            number: string;
            reference: string | null;
            expiresOn: string | null;
            family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants" | null;
            tierName: string;
            startsOn: string | null;
            paidAt: string | null;
            feeRwf: number | null;
        }>>;
        contact: z.ZodObject<{
            name: z.ZodString;
            phoneMasked: z.ZodString;
            emailMasked: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            phoneMasked: string;
            emailMasked: string | null;
        }, {
            name: string;
            phoneMasked: string;
            emailMasked: string | null;
        }>;
        events: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<["submitted", "fee_paid", "code_issued", "in_review", "approved", "declined", "paid", "expired", "withdrawn"]>;
            at: z.ZodString;
            title: z.ZodString;
            detail: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            kind: "submitted" | "approved" | "declined" | "expired" | "withdrawn" | "paid" | "fee_paid" | "code_issued" | "in_review";
            title: string;
            detail: string | null;
            at: string;
        }, {
            kind: "submitted" | "approved" | "declined" | "expired" | "withdrawn" | "paid" | "fee_paid" | "code_issued" | "in_review";
            title: string;
            detail: string | null;
            at: string;
        }>, "many">;
        /** Every payment on this application, oldest first. */
        payments: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<["registration_fee", "membership_fee"]>;
            amountRwf: z.ZodNumber;
            at: z.ZodNullable<z.ZodString>;
            status: z.ZodEnum<["paid"]>;
            reference: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "paid";
            kind: "registration_fee" | "membership_fee";
            reference: string | null;
            amountRwf: number;
            at: string | null;
        }, {
            status: "paid";
            kind: "registration_fee" | "membership_fee";
            reference: string | null;
            amountRwf: number;
            at: string | null;
        }>, "many">;
        /** What the one payment at submit comes to while it is still due. */
        dueRwf: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        business: {
            code: string | null;
            name: string;
            districtName: string | null;
            branches: {
                status: "pending" | "declined" | "admitted";
                districtName: string | null;
                sectorName: string | null;
                note: string | null;
            }[];
            registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
            ownerGroups: ("women" | "youth" | "pwd")[];
            sectorName: string | null;
            clusterName: string | null;
            subsectorName: string | null;
            associationName: string | null;
            provinceName: string | null;
            logoUrl: string | null;
        };
        stage: "approved" | "declined" | "member" | "withdrawn" | "lapsed" | "fee_due" | "under_review";
        submittedAt: string;
        membership: {
            number: string;
            reference: string | null;
            expiresOn: string | null;
            family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants" | null;
            tierName: string;
            startsOn: string | null;
            paidAt: string | null;
            feeRwf: number | null;
        } | null;
        decline: {
            decidedAt: string;
            reason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised";
            note: string | null;
            reasonLabel: string;
        } | null;
        waitingDays: number | null;
        docId: string;
        contact: {
            name: string;
            phoneMasked: string;
            emailMasked: string | null;
        };
        events: {
            kind: "submitted" | "approved" | "declined" | "expired" | "withdrawn" | "paid" | "fee_paid" | "code_issued" | "in_review";
            title: string;
            detail: string | null;
            at: string;
        }[];
        payments: {
            status: "paid";
            kind: "registration_fee" | "membership_fee";
            reference: string | null;
            amountRwf: number;
            at: string | null;
        }[];
        approval: {
            membershipNumber: string;
            feeRwf: number;
            approvedAt: string;
        } | null;
        request: {
            declaredFeeRwf: number | null;
            family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
            tierName: string;
            familyName: string;
        };
        reviewingOffice: string;
        dueRwf: number | null;
    }, {
        business: {
            code: string | null;
            name: string;
            districtName: string | null;
            registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
            ownerGroups: ("women" | "youth" | "pwd")[];
            sectorName: string | null;
            clusterName: string | null;
            subsectorName: string | null;
            associationName: string | null;
            provinceName: string | null;
            branches?: {
                status: "pending" | "declined" | "admitted";
                districtName: string | null;
                sectorName: string | null;
                note: string | null;
            }[] | undefined;
            logoUrl?: string | null | undefined;
        };
        stage: "approved" | "declined" | "member" | "withdrawn" | "lapsed" | "fee_due" | "under_review";
        submittedAt: string;
        membership: {
            number: string;
            reference: string | null;
            expiresOn: string | null;
            family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants" | null;
            tierName: string;
            startsOn: string | null;
            paidAt: string | null;
            feeRwf: number | null;
        } | null;
        decline: {
            decidedAt: string;
            reason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised";
            note: string | null;
            reasonLabel: string;
        } | null;
        waitingDays: number | null;
        docId: string;
        contact: {
            name: string;
            phoneMasked: string;
            emailMasked: string | null;
        };
        events: {
            kind: "submitted" | "approved" | "declined" | "expired" | "withdrawn" | "paid" | "fee_paid" | "code_issued" | "in_review";
            title: string;
            detail: string | null;
            at: string;
        }[];
        payments: {
            status: "paid";
            kind: "registration_fee" | "membership_fee";
            reference: string | null;
            amountRwf: number;
            at: string | null;
        }[];
        approval: {
            membershipNumber: string;
            feeRwf: number;
            approvedAt: string;
        } | null;
        request: {
            declaredFeeRwf: number | null;
            family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
            tierName: string;
            familyName: string;
        };
        reviewingOffice: string;
        dueRwf: number | null;
    }>;
}, "strip", z.ZodTypeAny, {
    message: string | null;
    status: "pending" | "declined" | "paid";
    view: {
        business: {
            code: string | null;
            name: string;
            districtName: string | null;
            branches: {
                status: "pending" | "declined" | "admitted";
                districtName: string | null;
                sectorName: string | null;
                note: string | null;
            }[];
            registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
            ownerGroups: ("women" | "youth" | "pwd")[];
            sectorName: string | null;
            clusterName: string | null;
            subsectorName: string | null;
            associationName: string | null;
            provinceName: string | null;
            logoUrl: string | null;
        };
        stage: "approved" | "declined" | "member" | "withdrawn" | "lapsed" | "fee_due" | "under_review";
        submittedAt: string;
        membership: {
            number: string;
            reference: string | null;
            expiresOn: string | null;
            family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants" | null;
            tierName: string;
            startsOn: string | null;
            paidAt: string | null;
            feeRwf: number | null;
        } | null;
        decline: {
            decidedAt: string;
            reason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised";
            note: string | null;
            reasonLabel: string;
        } | null;
        waitingDays: number | null;
        docId: string;
        contact: {
            name: string;
            phoneMasked: string;
            emailMasked: string | null;
        };
        events: {
            kind: "submitted" | "approved" | "declined" | "expired" | "withdrawn" | "paid" | "fee_paid" | "code_issued" | "in_review";
            title: string;
            detail: string | null;
            at: string;
        }[];
        payments: {
            status: "paid";
            kind: "registration_fee" | "membership_fee";
            reference: string | null;
            amountRwf: number;
            at: string | null;
        }[];
        approval: {
            membershipNumber: string;
            feeRwf: number;
            approvedAt: string;
        } | null;
        request: {
            declaredFeeRwf: number | null;
            family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
            tierName: string;
            familyName: string;
        };
        reviewingOffice: string;
        dueRwf: number | null;
    };
}, {
    message: string | null;
    status: "pending" | "declined" | "paid";
    view: {
        business: {
            code: string | null;
            name: string;
            districtName: string | null;
            registrationKind: "other" | "none" | "tin" | "rca" | "rgb" | null;
            ownerGroups: ("women" | "youth" | "pwd")[];
            sectorName: string | null;
            clusterName: string | null;
            subsectorName: string | null;
            associationName: string | null;
            provinceName: string | null;
            branches?: {
                status: "pending" | "declined" | "admitted";
                districtName: string | null;
                sectorName: string | null;
                note: string | null;
            }[] | undefined;
            logoUrl?: string | null | undefined;
        };
        stage: "approved" | "declined" | "member" | "withdrawn" | "lapsed" | "fee_due" | "under_review";
        submittedAt: string;
        membership: {
            number: string;
            reference: string | null;
            expiresOn: string | null;
            family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants" | null;
            tierName: string;
            startsOn: string | null;
            paidAt: string | null;
            feeRwf: number | null;
        } | null;
        decline: {
            decidedAt: string;
            reason: "other" | "details_incomplete" | "not_eligible_for_tier" | "business_not_recognised";
            note: string | null;
            reasonLabel: string;
        } | null;
        waitingDays: number | null;
        docId: string;
        contact: {
            name: string;
            phoneMasked: string;
            emailMasked: string | null;
        };
        events: {
            kind: "submitted" | "approved" | "declined" | "expired" | "withdrawn" | "paid" | "fee_paid" | "code_issued" | "in_review";
            title: string;
            detail: string | null;
            at: string;
        }[];
        payments: {
            status: "paid";
            kind: "registration_fee" | "membership_fee";
            reference: string | null;
            amountRwf: number;
            at: string | null;
        }[];
        approval: {
            membershipNumber: string;
            feeRwf: number;
            approvedAt: string;
        } | null;
        request: {
            declaredFeeRwf: number | null;
            family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
            tierName: string;
            familyName: string;
        };
        reviewingOffice: string;
        dueRwf: number | null;
    };
}>;
export type PsfTrackPayResult = z.infer<typeof PsfTrackPayResult>;
export declare const PsfScopeDistrict: z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
    letters: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: number;
    letters: string;
}, {
    name: string;
    id: number;
    letters: string;
}>;
export type PsfScopeDistrict = z.infer<typeof PsfScopeDistrict>;
/** `GET /oversight/psf/scope`: what the officer covers, and the districts they may narrow to. */
export declare const PsfOfficerScope: z.ZodObject<{
    level: z.ZodEnum<["country", "province", "district", "sector", "cell", "village"]>;
    /** "Kicukiro district", "Kigali City", "Rwanda". */
    label: z.ZodString;
    title: z.ZodString;
    provinces: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        name: z.ZodString;
        districts: z.ZodArray<z.ZodObject<{
            id: z.ZodNumber;
            name: z.ZodString;
            letters: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: number;
            letters: string;
        }, {
            name: string;
            id: number;
            letters: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: number;
        districts: {
            name: string;
            id: number;
            letters: string;
        }[];
    }, {
        name: string;
        id: number;
        districts: {
            name: string;
            id: number;
            letters: string;
        }[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    label: string;
    title: string;
    level: "country" | "province" | "district" | "sector" | "cell" | "village";
    provinces: {
        name: string;
        id: number;
        districts: {
            name: string;
            id: number;
            letters: string;
        }[];
    }[];
}, {
    label: string;
    title: string;
    level: "country" | "province" | "district" | "sector" | "cell" | "village";
    provinces: {
        name: string;
        id: number;
        districts: {
            name: string;
            id: number;
            letters: string;
        }[];
    }[];
}>;
export type PsfOfficerScope = z.infer<typeof PsfOfficerScope>;
/** Narrow any officer read to one district, or one province, inside the officer's own region. */
export declare const PsfAreaQuery: z.ZodObject<{
    district: z.ZodOptional<z.ZodNumber>;
    province: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    province?: number | undefined;
    district?: number | undefined;
}, {
    province?: number | undefined;
    district?: number | undefined;
}>;
export type PsfAreaQuery = z.infer<typeof PsfAreaQuery>;
export declare const PsfReportQuery: z.ZodObject<{
    district: z.ZodOptional<z.ZodNumber>;
    province: z.ZodOptional<z.ZodNumber>;
} & {
    from: z.ZodString;
    to: z.ZodString;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
    province?: number | undefined;
    district?: number | undefined;
}, {
    from: string;
    to: string;
    province?: number | undefined;
    district?: number | undefined;
}>;
export type PsfReportQuery = z.infer<typeof PsfReportQuery>;
/** One headline number, against the same length of time just before. */
export declare const PsfKpi: z.ZodObject<{
    value: z.ZodNumber;
    previous: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    value: number;
    previous: number;
}, {
    value: number;
    previous: number;
}>;
export type PsfKpi = z.infer<typeof PsfKpi>;
export declare const PsfReportMonth: z.ZodObject<{
    month: z.ZodString;
    registered: z.ZodNumber;
    applied: z.ZodNumber;
    approved: z.ZodNumber;
    members: z.ZodNumber;
    feesRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    approved: number;
    applied: number;
    members: number;
    month: string;
    registered: number;
    feesRwf: number;
}, {
    approved: number;
    applied: number;
    members: number;
    month: string;
    registered: number;
    feesRwf: number;
}>;
export type PsfReportMonth = z.infer<typeof PsfReportMonth>;
export declare const PsfReportSlice: z.ZodObject<{
    key: z.ZodString;
    label: z.ZodString;
    count: z.ZodNumber;
    amountRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    count: number;
    amountRwf: number;
    key: string;
    label: string;
}, {
    count: number;
    amountRwf: number;
    key: string;
    label: string;
}>;
export type PsfReportSlice = z.infer<typeof PsfReportSlice>;
export declare const PsfDistrictRow: z.ZodObject<{
    districtId: z.ZodNumber;
    name: z.ZodString;
    letters: z.ZodString;
    provinceName: z.ZodString;
    registered: z.ZodNumber;
    waiting: z.ZodNumber;
    overdue: z.ZodNumber;
    approved: z.ZodNumber;
    declined: z.ZodNumber;
    members: z.ZodNumber;
    membershipFeesRwf: z.ZodNumber;
    medianDecisionDays: z.ZodNullable<z.ZodNumber>;
    officers: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    approved: number;
    name: string;
    declined: number;
    districtId: number;
    provinceName: string;
    members: number;
    waiting: number;
    letters: string;
    overdue: number;
    registered: number;
    membershipFeesRwf: number;
    medianDecisionDays: number | null;
    officers: string[];
}, {
    approved: number;
    name: string;
    declined: number;
    districtId: number;
    provinceName: string;
    members: number;
    waiting: number;
    letters: string;
    overdue: number;
    registered: number;
    membershipFeesRwf: number;
    medianDecisionDays: number | null;
    officers: string[];
}>;
export type PsfDistrictRow = z.infer<typeof PsfDistrictRow>;
/** `GET /oversight/psf/report`: the officer's region over a period. */
export declare const PsfReport: z.ZodObject<{
    regionLabel: z.ZodString;
    from: z.ZodString;
    to: z.ZodString;
    kpis: z.ZodObject<{
        registered: z.ZodObject<{
            value: z.ZodNumber;
            previous: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            value: number;
            previous: number;
        }, {
            value: number;
            previous: number;
        }>;
        applied: z.ZodObject<{
            value: z.ZodNumber;
            previous: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            value: number;
            previous: number;
        }, {
            value: number;
            previous: number;
        }>;
        approved: z.ZodObject<{
            value: z.ZodNumber;
            previous: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            value: number;
            previous: number;
        }, {
            value: number;
            previous: number;
        }>;
        declined: z.ZodObject<{
            value: z.ZodNumber;
            previous: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            value: number;
            previous: number;
        }, {
            value: number;
            previous: number;
        }>;
        newMembers: z.ZodObject<{
            value: z.ZodNumber;
            previous: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            value: number;
            previous: number;
        }, {
            value: number;
            previous: number;
        }>;
        membershipFeesRwf: z.ZodObject<{
            value: z.ZodNumber;
            previous: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            value: number;
            previous: number;
        }, {
            value: number;
            previous: number;
        }>;
        medianDecisionDays: z.ZodObject<{
            value: z.ZodNullable<z.ZodNumber>;
            previous: z.ZodNullable<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            value: number | null;
            previous: number | null;
        }, {
            value: number | null;
            previous: number | null;
        }>;
    }, "strip", z.ZodTypeAny, {
        approved: {
            value: number;
            previous: number;
        };
        declined: {
            value: number;
            previous: number;
        };
        applied: {
            value: number;
            previous: number;
        };
        registered: {
            value: number;
            previous: number;
        };
        membershipFeesRwf: {
            value: number;
            previous: number;
        };
        medianDecisionDays: {
            value: number | null;
            previous: number | null;
        };
        newMembers: {
            value: number;
            previous: number;
        };
    }, {
        approved: {
            value: number;
            previous: number;
        };
        declined: {
            value: number;
            previous: number;
        };
        applied: {
            value: number;
            previous: number;
        };
        registered: {
            value: number;
            previous: number;
        };
        membershipFeesRwf: {
            value: number;
            previous: number;
        };
        medianDecisionDays: {
            value: number | null;
            previous: number | null;
        };
        newMembers: {
            value: number;
            previous: number;
        };
    }>;
    /** Right now, not over the period. */
    now: z.ZodObject<{
        members: z.ZodNumber;
        waiting: z.ZodNumber;
        overdue: z.ZodNumber;
        awaitingPayment: z.ZodNumber;
        expiringIn30Days: z.ZodNumber;
        /** Renewals further out, and memberships past their end with no renewal (2026-10-30). */
        expiringIn60Days: z.ZodNumber;
        expiringIn90Days: z.ZodNumber;
        lapsed: z.ZodNumber;
        /** Membership numbers typed at registration, waiting for PSF to confirm (0121). */
        claimsWaiting: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        lapsed: number;
        members: number;
        waiting: number;
        overdue: number;
        claimsWaiting: number;
        awaitingPayment: number;
        expiringIn30Days: number;
        expiringIn60Days: number;
        expiringIn90Days: number;
    }, {
        lapsed: number;
        members: number;
        waiting: number;
        overdue: number;
        awaitingPayment: number;
        expiringIn30Days: number;
        expiringIn60Days: number;
        expiringIn90Days: number;
        claimsWaiting?: number | undefined;
    }>;
    /**
     * Injishi registrations in the region (2026-10-30): where each business stands right now, and the
     * decisions taken in the period. A PSF District Manager reviews the first gate in one step (0119).
     */
    registrations: z.ZodObject<{
        waitingReview: z.ZodNumber;
        waitingApproval: z.ZodNumber;
        waitingPayment: z.ZodNumber;
        active: z.ZodNumber;
        rejected: z.ZodNumber;
        suspended: z.ZodNumber;
        approvedInPeriod: z.ZodObject<{
            value: z.ZodNumber;
            previous: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            value: number;
            previous: number;
        }, {
            value: number;
            previous: number;
        }>;
        rejectedInPeriod: z.ZodObject<{
            value: z.ZodNumber;
            previous: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            value: number;
            previous: number;
        }, {
            value: number;
            previous: number;
        }>;
        /** Days from the fee settling to the decision, the median over the period. */
        medianDaysToDecision: z.ZodNullable<z.ZodNumber>;
        /** The longest wait in the review queue right now, in whole days. */
        oldestWaitingDays: z.ZodNullable<z.ZodNumber>;
        /** Month by month: fees paid (registrations entering review) and the decisions on them. */
        months: z.ZodDefault<z.ZodArray<z.ZodObject<{
            month: z.ZodString;
            submitted: z.ZodNumber;
            approved: z.ZodNumber;
            rejected: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            submitted: number;
            approved: number;
            rejected: number;
            month: string;
        }, {
            submitted: number;
            approved: number;
            rejected: number;
            month: string;
        }>, "many">>;
        /** The businesses decided in the period, newest first, each opening its profile. */
        decided: z.ZodDefault<z.ZodArray<z.ZodObject<{
            orgId: z.ZodString;
            legalName: z.ZodString;
            kindLabel: z.ZodString;
            decision: z.ZodEnum<["approved", "rejected"]>;
            decidedAt: z.ZodString;
            decidedBy: z.ZodNullable<z.ZodString>;
            status: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            status: string;
            legalName: string;
            decision: "approved" | "rejected";
            decidedAt: string;
            orgId: string;
            decidedBy: string | null;
            kindLabel: string;
        }, {
            status: string;
            legalName: string;
            decision: "approved" | "rejected";
            decidedAt: string;
            orgId: string;
            decidedBy: string | null;
            kindLabel: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        active: number;
        rejected: number;
        suspended: number;
        months: {
            submitted: number;
            approved: number;
            rejected: number;
            month: string;
        }[];
        waitingReview: number;
        waitingApproval: number;
        waitingPayment: number;
        approvedInPeriod: {
            value: number;
            previous: number;
        };
        rejectedInPeriod: {
            value: number;
            previous: number;
        };
        medianDaysToDecision: number | null;
        oldestWaitingDays: number | null;
        decided: {
            status: string;
            legalName: string;
            decision: "approved" | "rejected";
            decidedAt: string;
            orgId: string;
            decidedBy: string | null;
            kindLabel: string;
        }[];
    }, {
        active: number;
        rejected: number;
        suspended: number;
        waitingReview: number;
        waitingApproval: number;
        waitingPayment: number;
        approvedInPeriod: {
            value: number;
            previous: number;
        };
        rejectedInPeriod: {
            value: number;
            previous: number;
        };
        medianDaysToDecision: number | null;
        oldestWaitingDays: number | null;
        months?: {
            submitted: number;
            approved: number;
            rejected: number;
            month: string;
        }[] | undefined;
        decided?: {
            status: string;
            legalName: string;
            decision: "approved" | "rejected";
            decidedAt: string;
            orgId: string;
            decidedBy: string | null;
            kindLabel: string;
        }[] | undefined;
    }>;
    /** The district's tourism economy on Injishi's own records, over the period (2026-10-30). */
    economy: z.ZodObject<{
        /** Active businesses by kind: hotels, guesthouses, apartments, residences, PSF enterprises. */
        activeBusinesses: z.ZodArray<z.ZodObject<{
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
        /** Confirmed bookings arriving in the period. */
        bookings: z.ZodObject<{
            value: z.ZodNumber;
            previous: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            value: number;
            previous: number;
        }, {
            value: number;
            previous: number;
        }>;
        /** Guests × nights of those bookings. */
        guestNights: z.ZodObject<{
            value: z.ZodNumber;
            previous: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            value: number;
            previous: number;
        }, {
            value: number;
            previous: number;
        }>;
        /** What those bookings are worth, RWF. */
        bookedValueRwf: z.ZodObject<{
            value: z.ZodNumber;
            previous: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            value: number;
            previous: number;
        }, {
            value: number;
            previous: number;
        }>;
        /** Month by month, by the month guests arrive. */
        months: z.ZodDefault<z.ZodArray<z.ZodObject<{
            month: z.ZodString;
            bookings: z.ZodNumber;
            guestNights: z.ZodNumber;
            valueRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            month: string;
            bookings: number;
            guestNights: number;
            valueRwf: number;
        }, {
            month: string;
            bookings: number;
            guestNights: number;
            valueRwf: number;
        }>, "many">>;
        /** The businesses that sold the most stays in the period. */
        topBusinesses: z.ZodDefault<z.ZodArray<z.ZodObject<{
            orgId: z.ZodString;
            legalName: z.ZodString;
            bookings: z.ZodNumber;
            guestNights: z.ZodNumber;
            valueRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            legalName: string;
            orgId: string;
            bookings: number;
            guestNights: number;
            valueRwf: number;
        }, {
            legalName: string;
            orgId: string;
            bookings: number;
            guestNights: number;
            valueRwf: number;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        bookings: {
            value: number;
            previous: number;
        };
        months: {
            month: string;
            bookings: number;
            guestNights: number;
            valueRwf: number;
        }[];
        activeBusinesses: {
            count: number;
            key: string;
            label: string;
        }[];
        guestNights: {
            value: number;
            previous: number;
        };
        bookedValueRwf: {
            value: number;
            previous: number;
        };
        topBusinesses: {
            legalName: string;
            orgId: string;
            bookings: number;
            guestNights: number;
            valueRwf: number;
        }[];
    }, {
        bookings: {
            value: number;
            previous: number;
        };
        activeBusinesses: {
            count: number;
            key: string;
            label: string;
        }[];
        guestNights: {
            value: number;
            previous: number;
        };
        bookedValueRwf: {
            value: number;
            previous: number;
        };
        months?: {
            month: string;
            bookings: number;
            guestNights: number;
            valueRwf: number;
        }[] | undefined;
        topBusinesses?: {
            legalName: string;
            orgId: string;
            bookings: number;
            guestNights: number;
            valueRwf: number;
        }[] | undefined;
    }>;
    months: z.ZodArray<z.ZodObject<{
        month: z.ZodString;
        registered: z.ZodNumber;
        applied: z.ZodNumber;
        approved: z.ZodNumber;
        members: z.ZodNumber;
        feesRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        approved: number;
        applied: number;
        members: number;
        month: string;
        registered: number;
        feesRwf: number;
    }, {
        approved: number;
        applied: number;
        members: number;
        month: string;
        registered: number;
        feesRwf: number;
    }>, "many">;
    funnel: z.ZodObject<{
        registered: z.ZodNumber;
        approved: z.ZodNumber;
        paid: z.ZodNumber;
        declined: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        approved: number;
        declined: number;
        paid: number;
        registered: number;
    }, {
        approved: number;
        declined: number;
        paid: number;
        registered: number;
    }>;
    bySector: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        count: z.ZodNumber;
        amountRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        amountRwf: number;
        key: string;
        label: string;
    }, {
        count: number;
        amountRwf: number;
        key: string;
        label: string;
    }>, "many">;
    byFamily: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        count: z.ZodNumber;
        amountRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        amountRwf: number;
        key: string;
        label: string;
    }, {
        count: number;
        amountRwf: number;
        key: string;
        label: string;
    }>, "many">;
    byGroup: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        count: z.ZodNumber;
        amountRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        amountRwf: number;
        key: string;
        label: string;
    }, {
        count: number;
        amountRwf: number;
        key: string;
        label: string;
    }>, "many">;
    districts: z.ZodArray<z.ZodObject<{
        districtId: z.ZodNumber;
        name: z.ZodString;
        letters: z.ZodString;
        provinceName: z.ZodString;
        registered: z.ZodNumber;
        waiting: z.ZodNumber;
        overdue: z.ZodNumber;
        approved: z.ZodNumber;
        declined: z.ZodNumber;
        members: z.ZodNumber;
        membershipFeesRwf: z.ZodNumber;
        medianDecisionDays: z.ZodNullable<z.ZodNumber>;
        officers: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        approved: number;
        name: string;
        declined: number;
        districtId: number;
        provinceName: string;
        members: number;
        waiting: number;
        letters: string;
        overdue: number;
        registered: number;
        membershipFeesRwf: number;
        medianDecisionDays: number | null;
        officers: string[];
    }, {
        approved: number;
        name: string;
        declined: number;
        districtId: number;
        provinceName: string;
        members: number;
        waiting: number;
        letters: string;
        overdue: number;
        registered: number;
        membershipFeesRwf: number;
        medianDecisionDays: number | null;
        officers: string[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    regionLabel: string;
    byGroup: {
        count: number;
        amountRwf: number;
        key: string;
        label: string;
    }[];
    kpis: {
        approved: {
            value: number;
            previous: number;
        };
        declined: {
            value: number;
            previous: number;
        };
        applied: {
            value: number;
            previous: number;
        };
        registered: {
            value: number;
            previous: number;
        };
        membershipFeesRwf: {
            value: number;
            previous: number;
        };
        medianDecisionDays: {
            value: number | null;
            previous: number | null;
        };
        newMembers: {
            value: number;
            previous: number;
        };
    };
    from: string;
    to: string;
    districts: {
        approved: number;
        name: string;
        declined: number;
        districtId: number;
        provinceName: string;
        members: number;
        waiting: number;
        letters: string;
        overdue: number;
        registered: number;
        membershipFeesRwf: number;
        medianDecisionDays: number | null;
        officers: string[];
    }[];
    months: {
        approved: number;
        applied: number;
        members: number;
        month: string;
        registered: number;
        feesRwf: number;
    }[];
    registrations: {
        active: number;
        rejected: number;
        suspended: number;
        months: {
            submitted: number;
            approved: number;
            rejected: number;
            month: string;
        }[];
        waitingReview: number;
        waitingApproval: number;
        waitingPayment: number;
        approvedInPeriod: {
            value: number;
            previous: number;
        };
        rejectedInPeriod: {
            value: number;
            previous: number;
        };
        medianDaysToDecision: number | null;
        oldestWaitingDays: number | null;
        decided: {
            status: string;
            legalName: string;
            decision: "approved" | "rejected";
            decidedAt: string;
            orgId: string;
            decidedBy: string | null;
            kindLabel: string;
        }[];
    };
    now: {
        lapsed: number;
        members: number;
        waiting: number;
        overdue: number;
        claimsWaiting: number;
        awaitingPayment: number;
        expiringIn30Days: number;
        expiringIn60Days: number;
        expiringIn90Days: number;
    };
    economy: {
        bookings: {
            value: number;
            previous: number;
        };
        months: {
            month: string;
            bookings: number;
            guestNights: number;
            valueRwf: number;
        }[];
        activeBusinesses: {
            count: number;
            key: string;
            label: string;
        }[];
        guestNights: {
            value: number;
            previous: number;
        };
        bookedValueRwf: {
            value: number;
            previous: number;
        };
        topBusinesses: {
            legalName: string;
            orgId: string;
            bookings: number;
            guestNights: number;
            valueRwf: number;
        }[];
    };
    funnel: {
        approved: number;
        declined: number;
        paid: number;
        registered: number;
    };
    bySector: {
        count: number;
        amountRwf: number;
        key: string;
        label: string;
    }[];
    byFamily: {
        count: number;
        amountRwf: number;
        key: string;
        label: string;
    }[];
}, {
    regionLabel: string;
    byGroup: {
        count: number;
        amountRwf: number;
        key: string;
        label: string;
    }[];
    kpis: {
        approved: {
            value: number;
            previous: number;
        };
        declined: {
            value: number;
            previous: number;
        };
        applied: {
            value: number;
            previous: number;
        };
        registered: {
            value: number;
            previous: number;
        };
        membershipFeesRwf: {
            value: number;
            previous: number;
        };
        medianDecisionDays: {
            value: number | null;
            previous: number | null;
        };
        newMembers: {
            value: number;
            previous: number;
        };
    };
    from: string;
    to: string;
    districts: {
        approved: number;
        name: string;
        declined: number;
        districtId: number;
        provinceName: string;
        members: number;
        waiting: number;
        letters: string;
        overdue: number;
        registered: number;
        membershipFeesRwf: number;
        medianDecisionDays: number | null;
        officers: string[];
    }[];
    months: {
        approved: number;
        applied: number;
        members: number;
        month: string;
        registered: number;
        feesRwf: number;
    }[];
    registrations: {
        active: number;
        rejected: number;
        suspended: number;
        waitingReview: number;
        waitingApproval: number;
        waitingPayment: number;
        approvedInPeriod: {
            value: number;
            previous: number;
        };
        rejectedInPeriod: {
            value: number;
            previous: number;
        };
        medianDaysToDecision: number | null;
        oldestWaitingDays: number | null;
        months?: {
            submitted: number;
            approved: number;
            rejected: number;
            month: string;
        }[] | undefined;
        decided?: {
            status: string;
            legalName: string;
            decision: "approved" | "rejected";
            decidedAt: string;
            orgId: string;
            decidedBy: string | null;
            kindLabel: string;
        }[] | undefined;
    };
    now: {
        lapsed: number;
        members: number;
        waiting: number;
        overdue: number;
        awaitingPayment: number;
        expiringIn30Days: number;
        expiringIn60Days: number;
        expiringIn90Days: number;
        claimsWaiting?: number | undefined;
    };
    economy: {
        bookings: {
            value: number;
            previous: number;
        };
        activeBusinesses: {
            count: number;
            key: string;
            label: string;
        }[];
        guestNights: {
            value: number;
            previous: number;
        };
        bookedValueRwf: {
            value: number;
            previous: number;
        };
        months?: {
            month: string;
            bookings: number;
            guestNights: number;
            valueRwf: number;
        }[] | undefined;
        topBusinesses?: {
            legalName: string;
            orgId: string;
            bookings: number;
            guestNights: number;
            valueRwf: number;
        }[] | undefined;
    };
    funnel: {
        approved: number;
        declined: number;
        paid: number;
        registered: number;
    };
    bySector: {
        count: number;
        amountRwf: number;
        key: string;
        label: string;
    }[];
    byFamily: {
        count: number;
        amountRwf: number;
        key: string;
        label: string;
    }[];
}>;
export type PsfReport = z.infer<typeof PsfReport>;
/** Days an application may wait on PSF before it shows as overdue. */
export declare const PSF_OVERDUE_DAYS = 7;
export declare const PsfDecisionsQuery: z.ZodObject<{
    district: z.ZodOptional<z.ZodNumber>;
    province: z.ZodOptional<z.ZodNumber>;
} & {
    outcome: z.ZodOptional<z.ZodEnum<["approved", "declined"]>>;
    q: z.ZodOptional<z.ZodString>;
    cluster: z.ZodOptional<z.ZodString>;
    cursor: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    province?: number | undefined;
    district?: number | undefined;
    cursor?: string | undefined;
    q?: string | undefined;
    cluster?: string | undefined;
    outcome?: "approved" | "declined" | undefined;
}, {
    province?: number | undefined;
    district?: number | undefined;
    cursor?: string | undefined;
    q?: string | undefined;
    cluster?: string | undefined;
    outcome?: "approved" | "declined" | undefined;
}>;
export type PsfDecisionsQuery = z.infer<typeof PsfDecisionsQuery>;
export declare const PsfDecisionItem: z.ZodObject<{
    applicationId: z.ZodString;
    docId: z.ZodNullable<z.ZodString>;
    businessName: z.ZodString;
    businessCode: z.ZodNullable<z.ZodString>;
    districtName: z.ZodNullable<z.ZodString>;
    tierName: z.ZodString;
    outcome: z.ZodEnum<["approved", "declined"]>;
    /** Where the application is now: approved may since have been paid. */
    paid: z.ZodBoolean;
    membershipNumber: z.ZodNullable<z.ZodString>;
    feeRwf: z.ZodNullable<z.ZodNumber>;
    declineReasonLabel: z.ZodNullable<z.ZodString>;
    decidedAt: z.ZodString;
    decidedByName: z.ZodNullable<z.ZodString>;
    daysToDecide: z.ZodNullable<z.ZodNumber>;
    clusterName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    subsectorName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    districtName: string | null;
    decidedAt: string;
    businessCode: string | null;
    tierName: string;
    membershipNumber: string | null;
    clusterName: string | null;
    subsectorName: string | null;
    applicationId: string;
    businessName: string;
    docId: string | null;
    feeRwf: number | null;
    decidedByName: string | null;
    paid: boolean;
    outcome: "approved" | "declined";
    declineReasonLabel: string | null;
    daysToDecide: number | null;
}, {
    districtName: string | null;
    decidedAt: string;
    businessCode: string | null;
    tierName: string;
    membershipNumber: string | null;
    applicationId: string;
    businessName: string;
    docId: string | null;
    feeRwf: number | null;
    decidedByName: string | null;
    paid: boolean;
    outcome: "approved" | "declined";
    declineReasonLabel: string | null;
    daysToDecide: number | null;
    clusterName?: string | null | undefined;
    subsectorName?: string | null | undefined;
}>;
export type PsfDecisionItem = z.infer<typeof PsfDecisionItem>;
export declare const PsfDecisionsPage: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        applicationId: z.ZodString;
        docId: z.ZodNullable<z.ZodString>;
        businessName: z.ZodString;
        businessCode: z.ZodNullable<z.ZodString>;
        districtName: z.ZodNullable<z.ZodString>;
        tierName: z.ZodString;
        outcome: z.ZodEnum<["approved", "declined"]>;
        /** Where the application is now: approved may since have been paid. */
        paid: z.ZodBoolean;
        membershipNumber: z.ZodNullable<z.ZodString>;
        feeRwf: z.ZodNullable<z.ZodNumber>;
        declineReasonLabel: z.ZodNullable<z.ZodString>;
        decidedAt: z.ZodString;
        decidedByName: z.ZodNullable<z.ZodString>;
        daysToDecide: z.ZodNullable<z.ZodNumber>;
        clusterName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        subsectorName: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        districtName: string | null;
        decidedAt: string;
        businessCode: string | null;
        tierName: string;
        membershipNumber: string | null;
        clusterName: string | null;
        subsectorName: string | null;
        applicationId: string;
        businessName: string;
        docId: string | null;
        feeRwf: number | null;
        decidedByName: string | null;
        paid: boolean;
        outcome: "approved" | "declined";
        declineReasonLabel: string | null;
        daysToDecide: number | null;
    }, {
        districtName: string | null;
        decidedAt: string;
        businessCode: string | null;
        tierName: string;
        membershipNumber: string | null;
        applicationId: string;
        businessName: string;
        docId: string | null;
        feeRwf: number | null;
        decidedByName: string | null;
        paid: boolean;
        outcome: "approved" | "declined";
        declineReasonLabel: string | null;
        daysToDecide: number | null;
        clusterName?: string | null | undefined;
        subsectorName?: string | null | undefined;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        districtName: string | null;
        decidedAt: string;
        businessCode: string | null;
        tierName: string;
        membershipNumber: string | null;
        clusterName: string | null;
        subsectorName: string | null;
        applicationId: string;
        businessName: string;
        docId: string | null;
        feeRwf: number | null;
        decidedByName: string | null;
        paid: boolean;
        outcome: "approved" | "declined";
        declineReasonLabel: string | null;
        daysToDecide: number | null;
    }[];
    nextCursor: string | null;
}, {
    items: {
        districtName: string | null;
        decidedAt: string;
        businessCode: string | null;
        tierName: string;
        membershipNumber: string | null;
        applicationId: string;
        businessName: string;
        docId: string | null;
        feeRwf: number | null;
        decidedByName: string | null;
        paid: boolean;
        outcome: "approved" | "declined";
        declineReasonLabel: string | null;
        daysToDecide: number | null;
        clusterName?: string | null | undefined;
        subsectorName?: string | null | undefined;
    }[];
    nextCursor: string | null;
}>;
export type PsfDecisionsPage = z.infer<typeof PsfDecisionsPage>;
/** The queue, narrowed by place and filtered, as the console asks for it. */
export declare const PsfQueueAreaQuery: z.ZodObject<{
    district: z.ZodOptional<z.ZodNumber>;
    province: z.ZodOptional<z.ZodNumber>;
} & {
    cursor: z.ZodOptional<z.ZodString>;
    q: z.ZodOptional<z.ZodString>;
    cluster: z.ZodOptional<z.ZodString>;
    family: z.ZodOptional<z.ZodEnum<["golden_circle", "indashyikirwa", "indatwa", "ordinary", "junior_giants"]>>;
    group: z.ZodOptional<z.ZodEnum<["women", "youth", "pwd"]>>;
    /** `newest` first by default: what just arrived is what an officer looks for. */
    sort: z.ZodDefault<z.ZodEnum<["newest", "oldest", "amount"]>>;
}, "strip", z.ZodTypeAny, {
    sort: "newest" | "oldest" | "amount";
    province?: number | undefined;
    district?: number | undefined;
    cursor?: string | undefined;
    family?: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants" | undefined;
    q?: string | undefined;
    cluster?: string | undefined;
    group?: "women" | "youth" | "pwd" | undefined;
}, {
    sort?: "newest" | "oldest" | "amount" | undefined;
    province?: number | undefined;
    district?: number | undefined;
    cursor?: string | undefined;
    family?: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants" | undefined;
    q?: string | undefined;
    cluster?: string | undefined;
    group?: "women" | "youth" | "pwd" | undefined;
}>;
export type PsfQueueAreaQuery = z.infer<typeof PsfQueueAreaQuery>;
/** A Kigali yyyy-mm-dd for a moment, which every PSF date reads in. */
export declare function kigaliDay(at: Date): string;
/** Whole days between two moments, floor, never negative. */
export declare function wholeDaysBetween(from: Date, to: Date): number;
/** The median of a list, or null for an empty one. */
export declare function median(values: readonly number[]): number | null;
/** The membership number PSF's officers give: `PSF/KIC/2026/0009`. */
export declare function formatPsfMembershipNumber(letters: string, year: number, n: number): string;
/**
 * A province as people say it. The geography table stores the names in capitals
 * (`KIGALI`, `EAST`); every PSF screen reads them through this.
 */
export declare function provinceDisplayName(name: string | null | undefined): string;
/** "+250781464545" as "+250 78• ••• 545": enough to recognise, not to call. */
export declare function maskPhone(e164: string): string;
/** "diane@example.rw" as "d••••@example.rw". */
export declare function maskEmail(email: string): string;
/** The business behind an application, as the officer's detail panel reads it. */
export declare const PsfBusinessHistory: z.ZodObject<{
    registeredAt: z.ZodNullable<z.ZodString>;
    payments: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["registration_fee", "membership_fee"]>;
        amountRwf: z.ZodNumber;
        at: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["paid"]>;
        reference: z.ZodNullable<z.ZodString>;
    } & {
        applicationDocId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "paid";
        kind: "registration_fee" | "membership_fee";
        reference: string | null;
        amountRwf: number;
        at: string | null;
        applicationDocId: string | null;
    }, {
        status: "paid";
        kind: "registration_fee" | "membership_fee";
        reference: string | null;
        amountRwf: number;
        at: string | null;
        applicationDocId: string | null;
    }>, "many">;
    applications: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        docId: z.ZodNullable<z.ZodString>;
        tierName: z.ZodString;
        status: z.ZodString;
        submittedAt: z.ZodString;
        decidedAt: z.ZodNullable<z.ZodString>;
        declineReasonLabel: z.ZodNullable<z.ZodString>;
        membershipNumber: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: string;
        id: string;
        decidedAt: string | null;
        submittedAt: string;
        tierName: string;
        membershipNumber: string | null;
        docId: string | null;
        declineReasonLabel: string | null;
    }, {
        status: string;
        id: string;
        decidedAt: string | null;
        submittedAt: string;
        tierName: string;
        membershipNumber: string | null;
        docId: string | null;
        declineReasonLabel: string | null;
    }>, "many">;
    memberships: z.ZodArray<z.ZodObject<{
        number: z.ZodString;
        tierName: z.ZodNullable<z.ZodString>;
        startsOn: z.ZodNullable<z.ZodString>;
        expiresOn: z.ZodNullable<z.ZodString>;
        current: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        number: string;
        expiresOn: string | null;
        tierName: string | null;
        startsOn: string | null;
        current: boolean;
    }, {
        number: string;
        expiresOn: string | null;
        tierName: string | null;
        startsOn: string | null;
        current: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    applications: {
        status: string;
        id: string;
        decidedAt: string | null;
        submittedAt: string;
        tierName: string;
        membershipNumber: string | null;
        docId: string | null;
        declineReasonLabel: string | null;
    }[];
    registeredAt: string | null;
    memberships: {
        number: string;
        expiresOn: string | null;
        tierName: string | null;
        startsOn: string | null;
        current: boolean;
    }[];
    payments: {
        status: "paid";
        kind: "registration_fee" | "membership_fee";
        reference: string | null;
        amountRwf: number;
        at: string | null;
        applicationDocId: string | null;
    }[];
}, {
    applications: {
        status: string;
        id: string;
        decidedAt: string | null;
        submittedAt: string;
        tierName: string;
        membershipNumber: string | null;
        docId: string | null;
        declineReasonLabel: string | null;
    }[];
    registeredAt: string | null;
    memberships: {
        number: string;
        expiresOn: string | null;
        tierName: string | null;
        startsOn: string | null;
        current: boolean;
    }[];
    payments: {
        status: "paid";
        kind: "registration_fee" | "membership_fee";
        reference: string | null;
        amountRwf: number;
        at: string | null;
        applicationDocId: string | null;
    }[];
}>;
export type PsfBusinessHistory = z.infer<typeof PsfBusinessHistory>;
/**
 * `GET /oversight/psf/businesses/:orgId`: one business on its own page, for the
 * officer covering it: what it is, how to reach it, and its whole history.
 */
export declare const PsfBusinessDetail: z.ZodObject<{
    business: z.ZodObject<{
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
        openApplicationId: z.ZodNullable<z.ZodString>;
        paidRwf: z.ZodDefault<z.ZodNumber>;
        lastPaidAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        branchCount: z.ZodDefault<z.ZodNumber>;
        headOfficeInScope: z.ZodDefault<z.ZodBoolean>;
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
    }>;
    /** The person on its newest application, as filed. */
    contact: z.ZodNullable<z.ZodObject<{
        name: z.ZodString;
        role: z.ZodString;
        phoneE164: z.ZodString;
        email: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        phoneE164: string;
        email: string | null;
        role: string;
    }, {
        name: string;
        phoneE164: string;
        email: string | null;
        role: string;
    }>>;
    history: z.ZodObject<{
        registeredAt: z.ZodNullable<z.ZodString>;
        payments: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<["registration_fee", "membership_fee"]>;
            amountRwf: z.ZodNumber;
            at: z.ZodNullable<z.ZodString>;
            status: z.ZodEnum<["paid"]>;
            reference: z.ZodNullable<z.ZodString>;
        } & {
            applicationDocId: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "paid";
            kind: "registration_fee" | "membership_fee";
            reference: string | null;
            amountRwf: number;
            at: string | null;
            applicationDocId: string | null;
        }, {
            status: "paid";
            kind: "registration_fee" | "membership_fee";
            reference: string | null;
            amountRwf: number;
            at: string | null;
            applicationDocId: string | null;
        }>, "many">;
        applications: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            docId: z.ZodNullable<z.ZodString>;
            tierName: z.ZodString;
            status: z.ZodString;
            submittedAt: z.ZodString;
            decidedAt: z.ZodNullable<z.ZodString>;
            declineReasonLabel: z.ZodNullable<z.ZodString>;
            membershipNumber: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: string;
            id: string;
            decidedAt: string | null;
            submittedAt: string;
            tierName: string;
            membershipNumber: string | null;
            docId: string | null;
            declineReasonLabel: string | null;
        }, {
            status: string;
            id: string;
            decidedAt: string | null;
            submittedAt: string;
            tierName: string;
            membershipNumber: string | null;
            docId: string | null;
            declineReasonLabel: string | null;
        }>, "many">;
        memberships: z.ZodArray<z.ZodObject<{
            number: z.ZodString;
            tierName: z.ZodNullable<z.ZodString>;
            startsOn: z.ZodNullable<z.ZodString>;
            expiresOn: z.ZodNullable<z.ZodString>;
            current: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            number: string;
            expiresOn: string | null;
            tierName: string | null;
            startsOn: string | null;
            current: boolean;
        }, {
            number: string;
            expiresOn: string | null;
            tierName: string | null;
            startsOn: string | null;
            current: boolean;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        applications: {
            status: string;
            id: string;
            decidedAt: string | null;
            submittedAt: string;
            tierName: string;
            membershipNumber: string | null;
            docId: string | null;
            declineReasonLabel: string | null;
        }[];
        registeredAt: string | null;
        memberships: {
            number: string;
            expiresOn: string | null;
            tierName: string | null;
            startsOn: string | null;
            current: boolean;
        }[];
        payments: {
            status: "paid";
            kind: "registration_fee" | "membership_fee";
            reference: string | null;
            amountRwf: number;
            at: string | null;
            applicationDocId: string | null;
        }[];
    }, {
        applications: {
            status: string;
            id: string;
            decidedAt: string | null;
            submittedAt: string;
            tierName: string;
            membershipNumber: string | null;
            docId: string | null;
            declineReasonLabel: string | null;
        }[];
        registeredAt: string | null;
        memberships: {
            number: string;
            expiresOn: string | null;
            tierName: string | null;
            startsOn: string | null;
            current: boolean;
        }[];
        payments: {
            status: "paid";
            kind: "registration_fee" | "membership_fee";
            reference: string | null;
            amountRwf: number;
            at: string | null;
            applicationDocId: string | null;
        }[];
    }>;
    /** Every branch it listed, in any district (2026-10-23), with where each stands. */
    branches: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        provinceName: z.ZodNullable<z.ZodString>;
        districtId: z.ZodNumber;
        districtName: z.ZodNullable<z.ZodString>;
        sectorName: z.ZodNullable<z.ZodString>;
        street: z.ZodString;
        status: z.ZodEnum<["pending", "admitted", "declined"]>;
        note: z.ZodNullable<z.ZodString>;
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
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    business: {
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
    };
    branches: {
        status: "pending" | "declined" | "admitted";
        id: string;
        districtName: string | null;
        districtId: number;
        street: string;
        sectorName: string | null;
        note: string | null;
        provinceName: string | null;
        inScope: boolean;
    }[];
    history: {
        applications: {
            status: string;
            id: string;
            decidedAt: string | null;
            submittedAt: string;
            tierName: string;
            membershipNumber: string | null;
            docId: string | null;
            declineReasonLabel: string | null;
        }[];
        registeredAt: string | null;
        memberships: {
            number: string;
            expiresOn: string | null;
            tierName: string | null;
            startsOn: string | null;
            current: boolean;
        }[];
        payments: {
            status: "paid";
            kind: "registration_fee" | "membership_fee";
            reference: string | null;
            amountRwf: number;
            at: string | null;
            applicationDocId: string | null;
        }[];
    };
    contact: {
        name: string;
        phoneE164: string;
        email: string | null;
        role: string;
    } | null;
}, {
    business: {
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
    };
    history: {
        applications: {
            status: string;
            id: string;
            decidedAt: string | null;
            submittedAt: string;
            tierName: string;
            membershipNumber: string | null;
            docId: string | null;
            declineReasonLabel: string | null;
        }[];
        registeredAt: string | null;
        memberships: {
            number: string;
            expiresOn: string | null;
            tierName: string | null;
            startsOn: string | null;
            current: boolean;
        }[];
        payments: {
            status: "paid";
            kind: "registration_fee" | "membership_fee";
            reference: string | null;
            amountRwf: number;
            at: string | null;
            applicationDocId: string | null;
        }[];
    };
    contact: {
        name: string;
        phoneE164: string;
        email: string | null;
        role: string;
    } | null;
    branches?: {
        status: "pending" | "declined" | "admitted";
        id: string;
        districtName: string | null;
        districtId: number;
        street: string;
        sectorName: string | null;
        note: string | null;
        provinceName: string | null;
        inScope: boolean;
    }[] | undefined;
}>;
export type PsfBusinessDetail = z.infer<typeof PsfBusinessDetail>;
/**
 * `GET /oversight/psf/registrations/:orgId` (2026-10-30): a business's side on Injishi, for the PSF
 * District Manager covering it, whatever its standing: what it is, who decided its registration and
 * when, and whether guests can find it yet. A business PSF's register does not hold (rejected, a
 * residence) still opens here.
 */
export declare const PsfRegistrationProfile: z.ZodObject<{
    orgId: z.ZodString;
    legalName: z.ZodString;
    businessCode: z.ZodNullable<z.ZodString>;
    kindLabel: z.ZodString;
    domain: z.ZodString;
    districtName: z.ZodNullable<z.ZodString>;
    sectorName: z.ZodNullable<z.ZodString>;
    addressText: z.ZodNullable<z.ZodString>;
    tin: z.ZodNullable<z.ZodString>;
    starGrade: z.ZodNullable<z.ZodNumber>;
    starGradeConfirmed: z.ZodBoolean;
    status: z.ZodString;
    owner: z.ZodNullable<z.ZodObject<{
        name: z.ZodNullable<z.ZodString>;
        email: z.ZodString;
        phone: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string | null;
        email: string;
        phone: string | null;
    }, {
        name: string | null;
        email: string;
        phone: string | null;
    }>>;
    registeredAt: z.ZodString;
    reviews: z.ZodArray<z.ZodObject<{
        stage: z.ZodString;
        decision: z.ZodEnum<["passed", "rejected"]>;
        roleLabel: z.ZodString;
        byName: z.ZodNullable<z.ZodString>;
        at: z.ZodString;
        notes: z.ZodNullable<z.ZodString>;
        reasonLabel: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        stage: string;
        decision: "rejected" | "passed";
        notes: string | null;
        at: string;
        roleLabel: string;
        reasonLabel: string | null;
        byName: string | null;
    }, {
        stage: string;
        decision: "rejected" | "passed";
        notes: string | null;
        at: string;
        roleLabel: string;
        reasonLabel: string | null;
        byName: string | null;
    }>, "many">;
    listings: z.ZodArray<z.ZodObject<{
        propertyName: z.ZodString;
        status: z.ZodString;
        publishedAt: z.ZodNullable<z.ZodString>;
        slug: z.ZodNullable<z.ZodString>;
        roomTypes: z.ZodNumber;
        rooms: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: string;
        slug: string | null;
        publishedAt: string | null;
        propertyName: string;
        roomTypes: number;
        rooms: number;
    }, {
        status: string;
        slug: string | null;
        publishedAt: string | null;
        propertyName: string;
        roomTypes: number;
        rooms: number;
    }>, "many">;
    /** Confirmed bookings arriving in the last 90 days. */
    bookings90Days: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: string;
    owner: {
        name: string | null;
        email: string;
        phone: string | null;
    } | null;
    domain: string;
    districtName: string | null;
    addressText: string | null;
    tin: string | null;
    legalName: string;
    orgId: string;
    sectorName: string | null;
    businessCode: string | null;
    registeredAt: string;
    reviews: {
        stage: string;
        decision: "rejected" | "passed";
        notes: string | null;
        at: string;
        roleLabel: string;
        reasonLabel: string | null;
        byName: string | null;
    }[];
    starGrade: number | null;
    kindLabel: string;
    starGradeConfirmed: boolean;
    listings: {
        status: string;
        slug: string | null;
        publishedAt: string | null;
        propertyName: string;
        roomTypes: number;
        rooms: number;
    }[];
    bookings90Days: number;
}, {
    status: string;
    owner: {
        name: string | null;
        email: string;
        phone: string | null;
    } | null;
    domain: string;
    districtName: string | null;
    addressText: string | null;
    tin: string | null;
    legalName: string;
    orgId: string;
    sectorName: string | null;
    businessCode: string | null;
    registeredAt: string;
    reviews: {
        stage: string;
        decision: "rejected" | "passed";
        notes: string | null;
        at: string;
        roleLabel: string;
        reasonLabel: string | null;
        byName: string | null;
    }[];
    starGrade: number | null;
    kindLabel: string;
    starGradeConfirmed: boolean;
    listings: {
        status: string;
        slug: string | null;
        publishedAt: string | null;
        propertyName: string;
        roomTypes: number;
        rooms: number;
    }[];
    bookings90Days: number;
}>;
export type PsfRegistrationProfile = z.infer<typeof PsfRegistrationProfile>;
/**
 * Where a band's price came from: the district's own, PSF's national price,
 * or (neither set) the band's starting price from the tier catalogue.
 */
export declare const PsfFeeSource: z.ZodEnum<["district", "national", "band"]>;
export type PsfFeeSource = z.infer<typeof PsfFeeSource>;
/** One band's price for a district, as the public form shows it. */
export declare const PsfTierFee: z.ZodObject<{
    tierCode: z.ZodString;
    /**
     * Null: no price anywhere (a tier PSF prices itself, never priced), so it is not offered.
     * Otherwise the LEAST a business in this band pays a year.
     */
    amountRwf: z.ZodNullable<z.ZodNumber>;
    source: z.ZodEnum<["district", "national", "band"]>;
    /**
     * The MOST a business in this band may pay (2026-10-23): the top of the
     * band's range in PSF's catalogue (49,999 for the 20,000 band), or, for a
     * band with no range, one franc under the next band's price. Null for the
     * top band, which has no ceiling.
     */
    ceilingRwf: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    amountRwf: number | null;
    source: "district" | "national" | "band";
    tierCode: string;
    ceilingRwf: number | null;
}, {
    amountRwf: number | null;
    source: "district" | "national" | "band";
    tierCode: string;
    ceilingRwf?: number | null | undefined;
}>;
export type PsfTierFee = z.infer<typeof PsfTierFee>;
/** `GET /psf/fees?district=`: every active band's price in one district. */
export declare const PsfFeesQuery: z.ZodObject<{
    district: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    district: number;
}, {
    district: number;
}>;
export type PsfFeesQuery = z.infer<typeof PsfFeesQuery>;
export declare const PsfFeesView: z.ZodObject<{
    districtId: z.ZodNumber;
    fees: z.ZodArray<z.ZodObject<{
        tierCode: z.ZodString;
        /**
         * Null: no price anywhere (a tier PSF prices itself, never priced), so it is not offered.
         * Otherwise the LEAST a business in this band pays a year.
         */
        amountRwf: z.ZodNullable<z.ZodNumber>;
        source: z.ZodEnum<["district", "national", "band"]>;
        /**
         * The MOST a business in this band may pay (2026-10-23): the top of the
         * band's range in PSF's catalogue (49,999 for the 20,000 band), or, for a
         * band with no range, one franc under the next band's price. Null for the
         * top band, which has no ceiling.
         */
        ceilingRwf: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        amountRwf: number | null;
        source: "district" | "national" | "band";
        tierCode: string;
        ceilingRwf: number | null;
    }, {
        amountRwf: number | null;
        source: "district" | "national" | "band";
        tierCode: string;
        ceilingRwf?: number | null | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    districtId: number;
    fees: {
        amountRwf: number | null;
        source: "district" | "national" | "band";
        tierCode: string;
        ceilingRwf: number | null;
    }[];
}, {
    districtId: number;
    fees: {
        amountRwf: number | null;
        source: "district" | "national" | "band";
        tierCode: string;
        ceilingRwf?: number | null | undefined;
    }[];
}>;
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
export declare function psfFeeCeilings(fees: ReadonlyArray<{
    tierCode: string;
    amountRwf: number | null;
    bandMaxRwf?: number | null;
}>): Map<string, number | null>;
/** One band in the officer's Fees screen: the national price, the district's, and what applies. */
export declare const PsfOfficerFeeRow: z.ZodObject<{
    tierCode: z.ZodString;
    tierName: z.ZodString;
    family: z.ZodEnum<["golden_circle", "indashyikirwa", "indatwa", "ordinary", "junior_giants"]>;
    priceKind: z.ZodEnum<["fixed", "range", "minimum", "set_by_psf"]>;
    /** The band's bounds from the catalogue; a price must sit inside them. */
    bandMinRwf: z.ZodNullable<z.ZodNumber>;
    bandMaxRwf: z.ZodNullable<z.ZodNumber>;
    /** The band's own starting price, used when nobody set one. */
    bandFeeRwf: z.ZodNullable<z.ZodNumber>;
    nationalRwf: z.ZodNullable<z.ZodNumber>;
    districtRwf: z.ZodNullable<z.ZodNumber>;
    effectiveRwf: z.ZodNullable<z.ZodNumber>;
    source: z.ZodEnum<["district", "national", "band"]>;
    updatedAt: z.ZodNullable<z.ZodString>;
    updatedByName: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
    priceKind: "minimum" | "fixed" | "range" | "set_by_psf";
    source: "district" | "national" | "band";
    tierCode: string;
    tierName: string;
    updatedAt: string | null;
    bandMinRwf: number | null;
    bandMaxRwf: number | null;
    bandFeeRwf: number | null;
    nationalRwf: number | null;
    districtRwf: number | null;
    effectiveRwf: number | null;
    updatedByName: string | null;
}, {
    family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
    priceKind: "minimum" | "fixed" | "range" | "set_by_psf";
    source: "district" | "national" | "band";
    tierCode: string;
    tierName: string;
    updatedAt: string | null;
    bandMinRwf: number | null;
    bandMaxRwf: number | null;
    bandFeeRwf: number | null;
    nationalRwf: number | null;
    districtRwf: number | null;
    effectiveRwf: number | null;
    updatedByName: string | null;
}>;
export type PsfOfficerFeeRow = z.infer<typeof PsfOfficerFeeRow>;
export declare const PsfOfficerFeesView: z.ZodObject<{
    /** The district being priced, or null for the national prices. */
    districtId: z.ZodNullable<z.ZodNumber>;
    districtName: z.ZodNullable<z.ZodString>;
    canEditNational: z.ZodBoolean;
    /** True when a district is shown and the officer covers it. */
    canEditDistrict: z.ZodBoolean;
    rows: z.ZodArray<z.ZodObject<{
        tierCode: z.ZodString;
        tierName: z.ZodString;
        family: z.ZodEnum<["golden_circle", "indashyikirwa", "indatwa", "ordinary", "junior_giants"]>;
        priceKind: z.ZodEnum<["fixed", "range", "minimum", "set_by_psf"]>;
        /** The band's bounds from the catalogue; a price must sit inside them. */
        bandMinRwf: z.ZodNullable<z.ZodNumber>;
        bandMaxRwf: z.ZodNullable<z.ZodNumber>;
        /** The band's own starting price, used when nobody set one. */
        bandFeeRwf: z.ZodNullable<z.ZodNumber>;
        nationalRwf: z.ZodNullable<z.ZodNumber>;
        districtRwf: z.ZodNullable<z.ZodNumber>;
        effectiveRwf: z.ZodNullable<z.ZodNumber>;
        source: z.ZodEnum<["district", "national", "band"]>;
        updatedAt: z.ZodNullable<z.ZodString>;
        updatedByName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
        priceKind: "minimum" | "fixed" | "range" | "set_by_psf";
        source: "district" | "national" | "band";
        tierCode: string;
        tierName: string;
        updatedAt: string | null;
        bandMinRwf: number | null;
        bandMaxRwf: number | null;
        bandFeeRwf: number | null;
        nationalRwf: number | null;
        districtRwf: number | null;
        effectiveRwf: number | null;
        updatedByName: string | null;
    }, {
        family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
        priceKind: "minimum" | "fixed" | "range" | "set_by_psf";
        source: "district" | "national" | "band";
        tierCode: string;
        tierName: string;
        updatedAt: string | null;
        bandMinRwf: number | null;
        bandMaxRwf: number | null;
        bandFeeRwf: number | null;
        nationalRwf: number | null;
        districtRwf: number | null;
        effectiveRwf: number | null;
        updatedByName: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    districtName: string | null;
    districtId: number | null;
    rows: {
        family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
        priceKind: "minimum" | "fixed" | "range" | "set_by_psf";
        source: "district" | "national" | "band";
        tierCode: string;
        tierName: string;
        updatedAt: string | null;
        bandMinRwf: number | null;
        bandMaxRwf: number | null;
        bandFeeRwf: number | null;
        nationalRwf: number | null;
        districtRwf: number | null;
        effectiveRwf: number | null;
        updatedByName: string | null;
    }[];
    canEditNational: boolean;
    canEditDistrict: boolean;
}, {
    districtName: string | null;
    districtId: number | null;
    rows: {
        family: "golden_circle" | "indashyikirwa" | "indatwa" | "ordinary" | "junior_giants";
        priceKind: "minimum" | "fixed" | "range" | "set_by_psf";
        source: "district" | "national" | "band";
        tierCode: string;
        tierName: string;
        updatedAt: string | null;
        bandMinRwf: number | null;
        bandMaxRwf: number | null;
        bandFeeRwf: number | null;
        nationalRwf: number | null;
        districtRwf: number | null;
        effectiveRwf: number | null;
        updatedByName: string | null;
    }[];
    canEditNational: boolean;
    canEditDistrict: boolean;
}>;
export type PsfOfficerFeesView = z.infer<typeof PsfOfficerFeesView>;
/** Set a band's price for a place (`districtId` null: national), or clear it with `amountRwf: null`. */
export declare const SetPsfTierFeeRequest: z.ZodObject<{
    tierCode: z.ZodString;
    districtId: z.ZodNullable<z.ZodNumber>;
    amountRwf: z.ZodNullable<z.ZodEffects<z.ZodNumber, number, number>>;
}, "strip", z.ZodTypeAny, {
    amountRwf: number | null;
    districtId: number | null;
    tierCode: string;
}, {
    amountRwf: number | null;
    districtId: number | null;
    tierCode: string;
}>;
export type SetPsfTierFeeRequest = z.infer<typeof SetPsfTierFeeRequest>;
/** The price that applies: the district's, else the national, else the band's starting price. */
export declare function resolvePsfTierFee(districtRwf: number | null, nationalRwf: number | null, bandRwf: number | null): {
    amountRwf: number | null;
    source: PsfFeeSource;
};
//# sourceMappingURL=psf-public.d.ts.map