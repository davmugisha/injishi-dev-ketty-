import { z } from "zod";
/** ADR-060's phases. A draft saved before ADR-075 carries one; nothing reads it now. */
export declare const REGISTRATION_DRAFT_PHASES: readonly ["place", "about", "business", "documents"];
/** The five steps, in order, that a draft reopens on (ADR-075 O-3, S9). */
export declare const REGISTRATION_DRAFT_STEPS: readonly ["business", "you", "documents", "review", "pay"];
export type RegistrationDraftStep = (typeof REGISTRATION_DRAFT_STEPS)[number];
/**
 * What a draft remembers as done: each section whose Next was pressed, and
 * Review's Continue. A section marked done is done again only while its answers
 * still satisfy it, so a stale mark opens nothing.
 */
export declare const REGISTRATION_DRAFT_DONE: readonly ["tin", "owner", "id", "intended", "loc", "fr", "upi", "review"];
export type RegistrationDraftDone = (typeof REGISTRATION_DRAFT_DONE)[number];
/** Whether a value holds an ID number: a run of sixteen digits anywhere in it, a National ID's length. */
export declare function holdsIdNumber(value: unknown): boolean;
export declare const RegistrationDraft: z.ZodEffects<z.ZodObject<{
    v: z.ZodLiteral<1>;
    /** ADR-060's phase, on a draft saved before ADR-075. Nothing writes it now. */
    phase: z.ZodOptional<z.ZodEnum<["place", "about", "business", "documents"]>>;
    /** The step that was open (AC-9). Absent on an older draft, which opens on Business. */
    openStep: z.ZodOptional<z.ZodEnum<["business", "you", "documents", "review", "pay"]>>;
    /** The furthest step reached, so a refresh keeps every step that could be pressed. */
    reached: z.ZodOptional<z.ZodEnum<["business", "you", "documents", "review", "pay"]>>;
    done: z.ZodOptional<z.ZodArray<z.ZodEnum<["tin", "owner", "id", "intended", "loc", "fr", "upi", "review"]>, "many">>;
    kind: z.ZodNullable<z.ZodString>;
    capacity: z.ZodEnum<["owner", "on_behalf_of"]>;
    /** False when the stored profile answered About you. */
    typedPersonal: z.ZodBoolean;
    personal: z.ZodObject<{
        firstName: z.ZodString;
        middleName: z.ZodString;
        lastName: z.ZodString;
        documentType: z.ZodEnum<["national_id", "passport"]>;
        issuingCountry: z.ZodString;
        gender: z.ZodString;
        dateOfBirth: z.ZodString;
        phoneE164: z.ZodString;
        address: z.ZodRecord<z.ZodString, z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        gender: string;
        dateOfBirth: string;
        phoneE164: string;
        address: Record<string, string>;
        firstName: string;
        lastName: string;
        middleName: string;
    }, {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        gender: string;
        dateOfBirth: string;
        phoneE164: string;
        address: Record<string, string>;
        firstName: string;
        lastName: string;
        middleName: string;
    }>;
    intendedOwner: z.ZodObject<{
        name: z.ZodString;
        email: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        name: string;
        email: string;
    }, {
        name: string;
        email: string;
    }>;
    business: z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodBoolean, z.ZodNull, z.ZodRecord<z.ZodString, z.ZodString>]>>;
    branches: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        address: z.ZodRecord<z.ZodString, z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        name: string;
        address: Record<string, string>;
    }, {
        name: string;
        address: Record<string, string>;
    }>, "many">;
    /** Part of a franchise? (ADR-075 O-7) as typed; `FranchiseDeclaration` is what Next checks it against. */
    franchise: z.ZodOptional<z.ZodObject<{
        role: z.ZodEnum<["", "none", "franchisee", "franchisor"]>;
        brandName: z.ZodString;
        franchisorLegalName: z.ZodString;
        franchisorCountry: z.ZodString;
        franchisedLocations: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        role: "" | "none" | "franchisee" | "franchisor";
        brandName: string;
        franchisorLegalName: string;
        franchisorCountry: string;
        franchisedLocations: string;
    }, {
        role: "" | "none" | "franchisee" | "franchisor";
        brandName: string;
        franchisorLegalName: string;
        franchisorCountry: string;
        franchisedLocations: string;
    }>>;
    /** The documents uploaded so far (ADR-075 S5), each by the key of its stored object. */
    documents: z.ZodOptional<z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other", "rdb_certificate", "psf_certificate", "land_title", "franchise_agreement"]>;
        objectKey: z.ZodString;
        filename: z.ZodString;
        sizeBytes: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        sizeBytes: number;
        filename: string;
    }, {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        sizeBytes: number;
        filename: string;
    }>, "many">>;
}, "strict", z.ZodTypeAny, {
    business: Record<string, string | boolean | Record<string, string> | null>;
    personal: {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        gender: string;
        dateOfBirth: string;
        phoneE164: string;
        address: Record<string, string>;
        firstName: string;
        lastName: string;
        middleName: string;
    };
    capacity: "owner" | "on_behalf_of";
    kind: string | null;
    branches: {
        name: string;
        address: Record<string, string>;
    }[];
    intendedOwner: {
        name: string;
        email: string;
    };
    v: 1;
    typedPersonal: boolean;
    franchise?: {
        role: "" | "none" | "franchisee" | "franchisor";
        brandName: string;
        franchisorLegalName: string;
        franchisorCountry: string;
        franchisedLocations: string;
    } | undefined;
    documents?: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        sizeBytes: number;
        filename: string;
    }[] | undefined;
    done?: ("owner" | "id" | "tin" | "upi" | "review" | "fr" | "intended" | "loc")[] | undefined;
    phase?: "business" | "documents" | "place" | "about" | undefined;
    openStep?: "business" | "documents" | "review" | "you" | "pay" | undefined;
    reached?: "business" | "documents" | "review" | "you" | "pay" | undefined;
}, {
    business: Record<string, string | boolean | Record<string, string> | null>;
    personal: {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        gender: string;
        dateOfBirth: string;
        phoneE164: string;
        address: Record<string, string>;
        firstName: string;
        lastName: string;
        middleName: string;
    };
    capacity: "owner" | "on_behalf_of";
    kind: string | null;
    branches: {
        name: string;
        address: Record<string, string>;
    }[];
    intendedOwner: {
        name: string;
        email: string;
    };
    v: 1;
    typedPersonal: boolean;
    franchise?: {
        role: "" | "none" | "franchisee" | "franchisor";
        brandName: string;
        franchisorLegalName: string;
        franchisorCountry: string;
        franchisedLocations: string;
    } | undefined;
    documents?: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        sizeBytes: number;
        filename: string;
    }[] | undefined;
    done?: ("owner" | "id" | "tin" | "upi" | "review" | "fr" | "intended" | "loc")[] | undefined;
    phase?: "business" | "documents" | "place" | "about" | undefined;
    openStep?: "business" | "documents" | "review" | "you" | "pay" | undefined;
    reached?: "business" | "documents" | "review" | "you" | "pay" | undefined;
}>, {
    business: Record<string, string | boolean | Record<string, string> | null>;
    personal: {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        gender: string;
        dateOfBirth: string;
        phoneE164: string;
        address: Record<string, string>;
        firstName: string;
        lastName: string;
        middleName: string;
    };
    capacity: "owner" | "on_behalf_of";
    kind: string | null;
    branches: {
        name: string;
        address: Record<string, string>;
    }[];
    intendedOwner: {
        name: string;
        email: string;
    };
    v: 1;
    typedPersonal: boolean;
    franchise?: {
        role: "" | "none" | "franchisee" | "franchisor";
        brandName: string;
        franchisorLegalName: string;
        franchisorCountry: string;
        franchisedLocations: string;
    } | undefined;
    documents?: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        sizeBytes: number;
        filename: string;
    }[] | undefined;
    done?: ("owner" | "id" | "tin" | "upi" | "review" | "fr" | "intended" | "loc")[] | undefined;
    phase?: "business" | "documents" | "place" | "about" | undefined;
    openStep?: "business" | "documents" | "review" | "you" | "pay" | undefined;
    reached?: "business" | "documents" | "review" | "you" | "pay" | undefined;
}, {
    business: Record<string, string | boolean | Record<string, string> | null>;
    personal: {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        gender: string;
        dateOfBirth: string;
        phoneE164: string;
        address: Record<string, string>;
        firstName: string;
        lastName: string;
        middleName: string;
    };
    capacity: "owner" | "on_behalf_of";
    kind: string | null;
    branches: {
        name: string;
        address: Record<string, string>;
    }[];
    intendedOwner: {
        name: string;
        email: string;
    };
    v: 1;
    typedPersonal: boolean;
    franchise?: {
        role: "" | "none" | "franchisee" | "franchisor";
        brandName: string;
        franchisorLegalName: string;
        franchisorCountry: string;
        franchisedLocations: string;
    } | undefined;
    documents?: {
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        objectKey: string;
        sizeBytes: number;
        filename: string;
    }[] | undefined;
    done?: ("owner" | "id" | "tin" | "upi" | "review" | "fr" | "intended" | "loc")[] | undefined;
    phase?: "business" | "documents" | "place" | "about" | undefined;
    openStep?: "business" | "documents" | "review" | "you" | "pay" | undefined;
    reached?: "business" | "documents" | "review" | "you" | "pay" | undefined;
}>;
export type RegistrationDraft = z.infer<typeof RegistrationDraft>;
/**
 * What the server alone writes beside a draft (ADR-075 D-m), so a finished
 * check is never asked twice: the TIN check's answer and how often it was
 * asked, the ID scan's tries and their last outcome, and the registration the
 * draft became at the first Pay press (AC-14), whose settled fee is what deletes
 * the draft. A check counts as finished only while the answers still match it:
 * the TIN answer only for the TIN it answered.
 */
export declare const RegistrationDraftChecks: z.ZodObject<{
    tin: z.ZodOptional<z.ZodObject<{
        /** The TIN asked about. */
        tin: z.ZodString;
        /** Whose question it was: the directors' names come back to the helper alone (AC-7). */
        capacity: z.ZodNullable<z.ZodEnum<["owner", "on_behalf_of"]>>;
        attempts: z.ZodNumber;
        answer: z.ZodObject<{
            tin: z.ZodString;
            result: z.ZodEnum<["verified", "failed", "taken", "pending"]>;
            message: z.ZodString;
            business: z.ZodNullable<z.ZodObject<{
                legalName: z.ZodString;
                registeredOn: z.ZodNullable<z.ZodString>;
                companyType: z.ZodNullable<z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>>;
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
                directors: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                }, "strip", z.ZodTypeAny, {
                    name: string;
                }, {
                    name: string;
                }>, "many">;
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
        checkedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        capacity: "owner" | "on_behalf_of" | null;
        tin: string;
        checkedAt: string;
        attempts: number;
        answer: {
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
        };
    }, {
        capacity: "owner" | "on_behalf_of" | null;
        tin: string;
        checkedAt: string;
        attempts: number;
        answer: {
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
        };
    }>>;
    scan: z.ZodOptional<z.ZodObject<{
        attempts: z.ZodNumber;
        documentType: z.ZodEnum<["national_id", "passport"]>;
        outcome: z.ZodEnum<["machine_passed", "machine_failed", "manual_needed"]>;
    }, "strip", z.ZodTypeAny, {
        documentType: "national_id" | "passport";
        attempts: number;
        outcome: "machine_passed" | "machine_failed" | "manual_needed";
    }, {
        documentType: "national_id" | "passport";
        attempts: number;
        outcome: "machine_passed" | "machine_failed" | "manual_needed";
    }>>;
    registrationId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    tin?: {
        capacity: "owner" | "on_behalf_of" | null;
        tin: string;
        checkedAt: string;
        attempts: number;
        answer: {
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
        };
    } | undefined;
    scan?: {
        documentType: "national_id" | "passport";
        attempts: number;
        outcome: "machine_passed" | "machine_failed" | "manual_needed";
    } | undefined;
    registrationId?: string | undefined;
}, {
    tin?: {
        capacity: "owner" | "on_behalf_of" | null;
        tin: string;
        checkedAt: string;
        attempts: number;
        answer: {
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
        };
    } | undefined;
    scan?: {
        documentType: "national_id" | "passport";
        attempts: number;
        outcome: "machine_passed" | "machine_failed" | "manual_needed";
    } | undefined;
    registrationId?: string | undefined;
}>;
export type RegistrationDraftChecks = z.infer<typeof RegistrationDraftChecks>;
/**
 * `GET /api/v1/me/registration-draft`: the answers, the checks, and when the
 * answers were last saved. With nothing kept, both nulls and no checks.
 */
export declare const RegistrationDraftRead: z.ZodObject<{
    draft: z.ZodNullable<z.ZodEffects<z.ZodObject<{
        v: z.ZodLiteral<1>;
        /** ADR-060's phase, on a draft saved before ADR-075. Nothing writes it now. */
        phase: z.ZodOptional<z.ZodEnum<["place", "about", "business", "documents"]>>;
        /** The step that was open (AC-9). Absent on an older draft, which opens on Business. */
        openStep: z.ZodOptional<z.ZodEnum<["business", "you", "documents", "review", "pay"]>>;
        /** The furthest step reached, so a refresh keeps every step that could be pressed. */
        reached: z.ZodOptional<z.ZodEnum<["business", "you", "documents", "review", "pay"]>>;
        done: z.ZodOptional<z.ZodArray<z.ZodEnum<["tin", "owner", "id", "intended", "loc", "fr", "upi", "review"]>, "many">>;
        kind: z.ZodNullable<z.ZodString>;
        capacity: z.ZodEnum<["owner", "on_behalf_of"]>;
        /** False when the stored profile answered About you. */
        typedPersonal: z.ZodBoolean;
        personal: z.ZodObject<{
            firstName: z.ZodString;
            middleName: z.ZodString;
            lastName: z.ZodString;
            documentType: z.ZodEnum<["national_id", "passport"]>;
            issuingCountry: z.ZodString;
            gender: z.ZodString;
            dateOfBirth: z.ZodString;
            phoneE164: z.ZodString;
            address: z.ZodRecord<z.ZodString, z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            documentType: "national_id" | "passport";
            issuingCountry: string;
            gender: string;
            dateOfBirth: string;
            phoneE164: string;
            address: Record<string, string>;
            firstName: string;
            lastName: string;
            middleName: string;
        }, {
            documentType: "national_id" | "passport";
            issuingCountry: string;
            gender: string;
            dateOfBirth: string;
            phoneE164: string;
            address: Record<string, string>;
            firstName: string;
            lastName: string;
            middleName: string;
        }>;
        intendedOwner: z.ZodObject<{
            name: z.ZodString;
            email: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            name: string;
            email: string;
        }, {
            name: string;
            email: string;
        }>;
        business: z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodBoolean, z.ZodNull, z.ZodRecord<z.ZodString, z.ZodString>]>>;
        branches: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            address: z.ZodRecord<z.ZodString, z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            name: string;
            address: Record<string, string>;
        }, {
            name: string;
            address: Record<string, string>;
        }>, "many">;
        /** Part of a franchise? (ADR-075 O-7) as typed; `FranchiseDeclaration` is what Next checks it against. */
        franchise: z.ZodOptional<z.ZodObject<{
            role: z.ZodEnum<["", "none", "franchisee", "franchisor"]>;
            brandName: z.ZodString;
            franchisorLegalName: z.ZodString;
            franchisorCountry: z.ZodString;
            franchisedLocations: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            role: "" | "none" | "franchisee" | "franchisor";
            brandName: string;
            franchisorLegalName: string;
            franchisorCountry: string;
            franchisedLocations: string;
        }, {
            role: "" | "none" | "franchisee" | "franchisor";
            brandName: string;
            franchisorLegalName: string;
            franchisorCountry: string;
            franchisedLocations: string;
        }>>;
        /** The documents uploaded so far (ADR-075 S5), each by the key of its stored object. */
        documents: z.ZodOptional<z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other", "rdb_certificate", "psf_certificate", "land_title", "franchise_agreement"]>;
            objectKey: z.ZodString;
            filename: z.ZodString;
            sizeBytes: z.ZodNumber;
        }, "strict", z.ZodTypeAny, {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            sizeBytes: number;
            filename: string;
        }, {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            sizeBytes: number;
            filename: string;
        }>, "many">>;
    }, "strict", z.ZodTypeAny, {
        business: Record<string, string | boolean | Record<string, string> | null>;
        personal: {
            documentType: "national_id" | "passport";
            issuingCountry: string;
            gender: string;
            dateOfBirth: string;
            phoneE164: string;
            address: Record<string, string>;
            firstName: string;
            lastName: string;
            middleName: string;
        };
        capacity: "owner" | "on_behalf_of";
        kind: string | null;
        branches: {
            name: string;
            address: Record<string, string>;
        }[];
        intendedOwner: {
            name: string;
            email: string;
        };
        v: 1;
        typedPersonal: boolean;
        franchise?: {
            role: "" | "none" | "franchisee" | "franchisor";
            brandName: string;
            franchisorLegalName: string;
            franchisorCountry: string;
            franchisedLocations: string;
        } | undefined;
        documents?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            sizeBytes: number;
            filename: string;
        }[] | undefined;
        done?: ("owner" | "id" | "tin" | "upi" | "review" | "fr" | "intended" | "loc")[] | undefined;
        phase?: "business" | "documents" | "place" | "about" | undefined;
        openStep?: "business" | "documents" | "review" | "you" | "pay" | undefined;
        reached?: "business" | "documents" | "review" | "you" | "pay" | undefined;
    }, {
        business: Record<string, string | boolean | Record<string, string> | null>;
        personal: {
            documentType: "national_id" | "passport";
            issuingCountry: string;
            gender: string;
            dateOfBirth: string;
            phoneE164: string;
            address: Record<string, string>;
            firstName: string;
            lastName: string;
            middleName: string;
        };
        capacity: "owner" | "on_behalf_of";
        kind: string | null;
        branches: {
            name: string;
            address: Record<string, string>;
        }[];
        intendedOwner: {
            name: string;
            email: string;
        };
        v: 1;
        typedPersonal: boolean;
        franchise?: {
            role: "" | "none" | "franchisee" | "franchisor";
            brandName: string;
            franchisorLegalName: string;
            franchisorCountry: string;
            franchisedLocations: string;
        } | undefined;
        documents?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            sizeBytes: number;
            filename: string;
        }[] | undefined;
        done?: ("owner" | "id" | "tin" | "upi" | "review" | "fr" | "intended" | "loc")[] | undefined;
        phase?: "business" | "documents" | "place" | "about" | undefined;
        openStep?: "business" | "documents" | "review" | "you" | "pay" | undefined;
        reached?: "business" | "documents" | "review" | "you" | "pay" | undefined;
    }>, {
        business: Record<string, string | boolean | Record<string, string> | null>;
        personal: {
            documentType: "national_id" | "passport";
            issuingCountry: string;
            gender: string;
            dateOfBirth: string;
            phoneE164: string;
            address: Record<string, string>;
            firstName: string;
            lastName: string;
            middleName: string;
        };
        capacity: "owner" | "on_behalf_of";
        kind: string | null;
        branches: {
            name: string;
            address: Record<string, string>;
        }[];
        intendedOwner: {
            name: string;
            email: string;
        };
        v: 1;
        typedPersonal: boolean;
        franchise?: {
            role: "" | "none" | "franchisee" | "franchisor";
            brandName: string;
            franchisorLegalName: string;
            franchisorCountry: string;
            franchisedLocations: string;
        } | undefined;
        documents?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            sizeBytes: number;
            filename: string;
        }[] | undefined;
        done?: ("owner" | "id" | "tin" | "upi" | "review" | "fr" | "intended" | "loc")[] | undefined;
        phase?: "business" | "documents" | "place" | "about" | undefined;
        openStep?: "business" | "documents" | "review" | "you" | "pay" | undefined;
        reached?: "business" | "documents" | "review" | "you" | "pay" | undefined;
    }, {
        business: Record<string, string | boolean | Record<string, string> | null>;
        personal: {
            documentType: "national_id" | "passport";
            issuingCountry: string;
            gender: string;
            dateOfBirth: string;
            phoneE164: string;
            address: Record<string, string>;
            firstName: string;
            lastName: string;
            middleName: string;
        };
        capacity: "owner" | "on_behalf_of";
        kind: string | null;
        branches: {
            name: string;
            address: Record<string, string>;
        }[];
        intendedOwner: {
            name: string;
            email: string;
        };
        v: 1;
        typedPersonal: boolean;
        franchise?: {
            role: "" | "none" | "franchisee" | "franchisor";
            brandName: string;
            franchisorLegalName: string;
            franchisorCountry: string;
            franchisedLocations: string;
        } | undefined;
        documents?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            sizeBytes: number;
            filename: string;
        }[] | undefined;
        done?: ("owner" | "id" | "tin" | "upi" | "review" | "fr" | "intended" | "loc")[] | undefined;
        phase?: "business" | "documents" | "place" | "about" | undefined;
        openStep?: "business" | "documents" | "review" | "you" | "pay" | undefined;
        reached?: "business" | "documents" | "review" | "you" | "pay" | undefined;
    }>>;
    checks: z.ZodObject<{
        tin: z.ZodOptional<z.ZodObject<{
            /** The TIN asked about. */
            tin: z.ZodString;
            /** Whose question it was: the directors' names come back to the helper alone (AC-7). */
            capacity: z.ZodNullable<z.ZodEnum<["owner", "on_behalf_of"]>>;
            attempts: z.ZodNumber;
            answer: z.ZodObject<{
                tin: z.ZodString;
                result: z.ZodEnum<["verified", "failed", "taken", "pending"]>;
                message: z.ZodString;
                business: z.ZodNullable<z.ZodObject<{
                    legalName: z.ZodString;
                    registeredOn: z.ZodNullable<z.ZodString>;
                    companyType: z.ZodNullable<z.ZodEnum<["cooperative", "ngo", "partly_state_owned", "private_company", "public_company", "sole_trader"]>>;
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
                    directors: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                    }, "strip", z.ZodTypeAny, {
                        name: string;
                    }, {
                        name: string;
                    }>, "many">;
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
            checkedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            capacity: "owner" | "on_behalf_of" | null;
            tin: string;
            checkedAt: string;
            attempts: number;
            answer: {
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
            };
        }, {
            capacity: "owner" | "on_behalf_of" | null;
            tin: string;
            checkedAt: string;
            attempts: number;
            answer: {
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
            };
        }>>;
        scan: z.ZodOptional<z.ZodObject<{
            attempts: z.ZodNumber;
            documentType: z.ZodEnum<["national_id", "passport"]>;
            outcome: z.ZodEnum<["machine_passed", "machine_failed", "manual_needed"]>;
        }, "strip", z.ZodTypeAny, {
            documentType: "national_id" | "passport";
            attempts: number;
            outcome: "machine_passed" | "machine_failed" | "manual_needed";
        }, {
            documentType: "national_id" | "passport";
            attempts: number;
            outcome: "machine_passed" | "machine_failed" | "manual_needed";
        }>>;
        registrationId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        tin?: {
            capacity: "owner" | "on_behalf_of" | null;
            tin: string;
            checkedAt: string;
            attempts: number;
            answer: {
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
            };
        } | undefined;
        scan?: {
            documentType: "national_id" | "passport";
            attempts: number;
            outcome: "machine_passed" | "machine_failed" | "manual_needed";
        } | undefined;
        registrationId?: string | undefined;
    }, {
        tin?: {
            capacity: "owner" | "on_behalf_of" | null;
            tin: string;
            checkedAt: string;
            attempts: number;
            answer: {
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
            };
        } | undefined;
        scan?: {
            documentType: "national_id" | "passport";
            attempts: number;
            outcome: "machine_passed" | "machine_failed" | "manual_needed";
        } | undefined;
        registrationId?: string | undefined;
    }>;
    savedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    draft: {
        business: Record<string, string | boolean | Record<string, string> | null>;
        personal: {
            documentType: "national_id" | "passport";
            issuingCountry: string;
            gender: string;
            dateOfBirth: string;
            phoneE164: string;
            address: Record<string, string>;
            firstName: string;
            lastName: string;
            middleName: string;
        };
        capacity: "owner" | "on_behalf_of";
        kind: string | null;
        branches: {
            name: string;
            address: Record<string, string>;
        }[];
        intendedOwner: {
            name: string;
            email: string;
        };
        v: 1;
        typedPersonal: boolean;
        franchise?: {
            role: "" | "none" | "franchisee" | "franchisor";
            brandName: string;
            franchisorLegalName: string;
            franchisorCountry: string;
            franchisedLocations: string;
        } | undefined;
        documents?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            sizeBytes: number;
            filename: string;
        }[] | undefined;
        done?: ("owner" | "id" | "tin" | "upi" | "review" | "fr" | "intended" | "loc")[] | undefined;
        phase?: "business" | "documents" | "place" | "about" | undefined;
        openStep?: "business" | "documents" | "review" | "you" | "pay" | undefined;
        reached?: "business" | "documents" | "review" | "you" | "pay" | undefined;
    } | null;
    checks: {
        tin?: {
            capacity: "owner" | "on_behalf_of" | null;
            tin: string;
            checkedAt: string;
            attempts: number;
            answer: {
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
            };
        } | undefined;
        scan?: {
            documentType: "national_id" | "passport";
            attempts: number;
            outcome: "machine_passed" | "machine_failed" | "manual_needed";
        } | undefined;
        registrationId?: string | undefined;
    };
    savedAt: string | null;
}, {
    draft: {
        business: Record<string, string | boolean | Record<string, string> | null>;
        personal: {
            documentType: "national_id" | "passport";
            issuingCountry: string;
            gender: string;
            dateOfBirth: string;
            phoneE164: string;
            address: Record<string, string>;
            firstName: string;
            lastName: string;
            middleName: string;
        };
        capacity: "owner" | "on_behalf_of";
        kind: string | null;
        branches: {
            name: string;
            address: Record<string, string>;
        }[];
        intendedOwner: {
            name: string;
            email: string;
        };
        v: 1;
        typedPersonal: boolean;
        franchise?: {
            role: "" | "none" | "franchisee" | "franchisor";
            brandName: string;
            franchisorLegalName: string;
            franchisorCountry: string;
            franchisedLocations: string;
        } | undefined;
        documents?: {
            kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
            objectKey: string;
            sizeBytes: number;
            filename: string;
        }[] | undefined;
        done?: ("owner" | "id" | "tin" | "upi" | "review" | "fr" | "intended" | "loc")[] | undefined;
        phase?: "business" | "documents" | "place" | "about" | undefined;
        openStep?: "business" | "documents" | "review" | "you" | "pay" | undefined;
        reached?: "business" | "documents" | "review" | "you" | "pay" | undefined;
    } | null;
    checks: {
        tin?: {
            capacity: "owner" | "on_behalf_of" | null;
            tin: string;
            checkedAt: string;
            attempts: number;
            answer: {
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
            };
        } | undefined;
        scan?: {
            documentType: "national_id" | "passport";
            attempts: number;
            outcome: "machine_passed" | "machine_failed" | "manual_needed";
        } | undefined;
        registrationId?: string | undefined;
    };
    savedAt: string | null;
}>;
export type RegistrationDraftRead = z.infer<typeof RegistrationDraftRead>;
/** `PUT /api/v1/me/registration-draft`: when the server saved the answers. */
export declare const RegistrationDraftSaved: z.ZodObject<{
    savedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    savedAt: string;
}, {
    savedAt: string;
}>;
export type RegistrationDraftSaved = z.infer<typeof RegistrationDraftSaved>;
//# sourceMappingURL=registration-draft.d.ts.map