import { z } from "zod";
/**
 * Which side of the document verifier seam a deployment runs. `off` is a real
 * answer, not a missing one: it is what a real database runs until a provider
 * is signed, and there the scan stores the photos for PSF and reads nothing.
 */
export declare const IdentityAdapterMode: z.ZodEnum<["mock", "live", "off"]>;
export type IdentityAdapterMode = z.infer<typeof IdentityAdapterMode>;
/** How many tries a draft gets before the person may continue and PSF checks the ID by eye (AC-5). */
export declare const SCAN_ATTEMPTS_BEFORE_CONTINUE = 3;
/**
 * One scan's outcome (D-n). `machine_passed` is the only one that reads
 * "Checked" (AC-6); `manual_needed` is a deployment with no checker, where the
 * photos wait for PSF; `machine_failed` is a checker that refused the photos.
 */
export declare const IdentityScanOutcome: z.ZodEnum<["machine_passed", "machine_failed", "manual_needed"]>;
export type IdentityScanOutcome = z.infer<typeof IdentityScanOutcome>;
/** Why a checker refused a scan. Each has its own fix, worded by the server. */
export declare const IdentityScanReason: z.ZodEnum<["not_authentic", "face_mismatch", "unreadable", "expired", "unavailable"]>;
export type IdentityScanReason = z.infer<typeof IdentityScanReason>;
/**
 * The person on file, as the scan read them or as they typed them. The number
 * comes back MASKED, like every other read of it (§10); the server keeps the
 * full number on `identity_documents`.
 */
export declare const IdentityOnFile: z.ZodObject<{
    fullName: z.ZodString;
    /** `YYYY-MM-DD`. */
    dateOfBirth: z.ZodString;
    gender: z.ZodNullable<z.ZodEnum<["female", "male", "other", "prefer_not_to_say"]>>;
    documentType: z.ZodEnum<["national_id", "passport"]>;
    documentNumberMasked: z.ZodString;
    issuingCountry: z.ZodEffects<z.ZodString, string, string>;
    /**
     * True when a MOCK verifier made this person up. A demo must be able to say
     * "these details are generated" rather than pass them off as a document's.
     */
    generated: z.ZodBoolean;
    /**
     * True once a machine check passed, or PSF verified the identity on
     * approval (D-o). False while the details are typed and PSF has still to
     * compare the photos: the status reads "PSF will check your ID" (AC-6).
     */
    checked: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    documentType: "national_id" | "passport";
    issuingCountry: string;
    fullName: string;
    gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
    dateOfBirth: string;
    generated: boolean;
    documentNumberMasked: string;
    checked: boolean;
}, {
    documentType: "national_id" | "passport";
    issuingCountry: string;
    fullName: string;
    gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
    dateOfBirth: string;
    generated: boolean;
    documentNumberMasked: string;
    checked: boolean;
}>;
export type IdentityOnFile = z.infer<typeof IdentityOnFile>;
/** The caller's latest scan, and how many tries this draft has used. */
export declare const IdentityScanState: z.ZodObject<{
    outcome: z.ZodEnum<["machine_passed", "machine_failed", "manual_needed"]>;
    documentType: z.ZodEnum<["national_id", "passport"]>;
    /** Tries on this draft (`checks.scan.attempts`, D-m), reset with the draft. */
    attempts: z.ZodNumber;
    /** Whether the person may type their details and carry on, for PSF to check (AC-5). */
    mayContinue: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    documentType: "national_id" | "passport";
    attempts: number;
    outcome: "machine_passed" | "machine_failed" | "manual_needed";
    mayContinue: boolean;
}, {
    documentType: "national_id" | "passport";
    attempts: number;
    outcome: "machine_passed" | "machine_failed" | "manual_needed";
    mayContinue: boolean;
}>;
export type IdentityScanState = z.infer<typeof IdentityScanState>;
/** `GET /api/v1/me/identity`: where the caller stands, and whether a machine reads the ID here. */
export declare const IdentityStatus: z.ZodObject<{
    kycStatus: z.ZodEnum<["unverified", "pending", "verified", "rejected"]>;
    /** `document_scan`, `psf_review` or another earlier method, once verified. */
    method: z.ZodNullable<z.ZodString>;
    onFile: z.ZodNullable<z.ZodObject<{
        fullName: z.ZodString;
        /** `YYYY-MM-DD`. */
        dateOfBirth: z.ZodString;
        gender: z.ZodNullable<z.ZodEnum<["female", "male", "other", "prefer_not_to_say"]>>;
        documentType: z.ZodEnum<["national_id", "passport"]>;
        documentNumberMasked: z.ZodString;
        issuingCountry: z.ZodEffects<z.ZodString, string, string>;
        /**
         * True when a MOCK verifier made this person up. A demo must be able to say
         * "these details are generated" rather than pass them off as a document's.
         */
        generated: z.ZodBoolean;
        /**
         * True once a machine check passed, or PSF verified the identity on
         * approval (D-o). False while the details are typed and PSF has still to
         * compare the photos: the status reads "PSF will check your ID" (AC-6).
         */
        checked: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        fullName: string;
        gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
        dateOfBirth: string;
        generated: boolean;
        documentNumberMasked: string;
        checked: boolean;
    }, {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        fullName: string;
        gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
        dateOfBirth: string;
        generated: boolean;
        documentNumberMasked: string;
        checked: boolean;
    }>>;
    scan: z.ZodNullable<z.ZodObject<{
        outcome: z.ZodEnum<["machine_passed", "machine_failed", "manual_needed"]>;
        documentType: z.ZodEnum<["national_id", "passport"]>;
        /** Tries on this draft (`checks.scan.attempts`, D-m), reset with the draft. */
        attempts: z.ZodNumber;
        /** Whether the person may type their details and carry on, for PSF to check (AC-5). */
        mayContinue: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        documentType: "national_id" | "passport";
        attempts: number;
        outcome: "machine_passed" | "machine_failed" | "manual_needed";
        mayContinue: boolean;
    }, {
        documentType: "national_id" | "passport";
        attempts: number;
        outcome: "machine_passed" | "machine_failed" | "manual_needed";
        mayContinue: boolean;
    }>>;
    /** False where the seam is `off`: the scan keeps the photos and reads nothing, so the person types what is printed. */
    machineCheck: z.ZodBoolean;
    mode: z.ZodEnum<["mock", "live", "off"]>;
}, "strip", z.ZodTypeAny, {
    mode: "mock" | "live" | "off";
    method: string | null;
    kycStatus: "rejected" | "unverified" | "pending" | "verified";
    onFile: {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        fullName: string;
        gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
        dateOfBirth: string;
        generated: boolean;
        documentNumberMasked: string;
        checked: boolean;
    } | null;
    scan: {
        documentType: "national_id" | "passport";
        attempts: number;
        outcome: "machine_passed" | "machine_failed" | "manual_needed";
        mayContinue: boolean;
    } | null;
    machineCheck: boolean;
}, {
    mode: "mock" | "live" | "off";
    method: string | null;
    kycStatus: "rejected" | "unverified" | "pending" | "verified";
    onFile: {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        fullName: string;
        gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
        dateOfBirth: string;
        generated: boolean;
        documentNumberMasked: string;
        checked: boolean;
    } | null;
    scan: {
        documentType: "national_id" | "passport";
        attempts: number;
        outcome: "machine_passed" | "machine_failed" | "manual_needed";
        mayContinue: boolean;
    } | null;
    machineCheck: boolean;
}>;
export type IdentityStatus = z.infer<typeof IdentityStatus>;
/** `POST /api/v1/me/identity/scan`: the front of the card or the photo page, then a selfie, both uploaded first as `id_photo`. */
export declare const IdentityScanRequest: z.ZodObject<{
    documentType: z.ZodEnum<["national_id", "passport"]>;
    frontKey: z.ZodString;
    selfieKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    documentType: "national_id" | "passport";
    frontKey: string;
    selfieKey: string;
}, {
    documentType: "national_id" | "passport";
    frontKey: string;
    selfieKey: string;
}>;
export type IdentityScanRequest = z.infer<typeof IdentityScanRequest>;
export declare const IdentityScanResult: z.ZodObject<{
    outcome: z.ZodEnum<["machine_passed", "machine_failed", "manual_needed"]>;
    reason: z.ZodNullable<z.ZodEnum<["not_authentic", "face_mismatch", "unreadable", "expired", "unavailable"]>>;
    /** What went wrong and how to fix it, or what happens next. Null when the check passed. */
    message: z.ZodNullable<z.ZodString>;
    /** What the checker read, or null when it read nothing. */
    fields: z.ZodNullable<z.ZodObject<{
        fullName: z.ZodString;
        /** `YYYY-MM-DD`. */
        dateOfBirth: z.ZodString;
        gender: z.ZodNullable<z.ZodEnum<["female", "male", "other", "prefer_not_to_say"]>>;
        documentType: z.ZodEnum<["national_id", "passport"]>;
        documentNumberMasked: z.ZodString;
        issuingCountry: z.ZodEffects<z.ZodString, string, string>;
        /**
         * True when a MOCK verifier made this person up. A demo must be able to say
         * "these details are generated" rather than pass them off as a document's.
         */
        generated: z.ZodBoolean;
        /**
         * True once a machine check passed, or PSF verified the identity on
         * approval (D-o). False while the details are typed and PSF has still to
         * compare the photos: the status reads "PSF will check your ID" (AC-6).
         */
        checked: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        fullName: string;
        gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
        dateOfBirth: string;
        generated: boolean;
        documentNumberMasked: string;
        checked: boolean;
    }, {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        fullName: string;
        gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
        dateOfBirth: string;
        generated: boolean;
        documentNumberMasked: string;
        checked: boolean;
    }>>;
    /** This try's number on the draft. */
    attempt: z.ZodNumber;
    mayContinue: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    message: string | null;
    reason: "expired" | "unavailable" | "not_authentic" | "face_mismatch" | "unreadable" | null;
    attempt: number;
    outcome: "machine_passed" | "machine_failed" | "manual_needed";
    mayContinue: boolean;
    fields: {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        fullName: string;
        gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
        dateOfBirth: string;
        generated: boolean;
        documentNumberMasked: string;
        checked: boolean;
    } | null;
}, {
    message: string | null;
    reason: "expired" | "unavailable" | "not_authentic" | "face_mismatch" | "unreadable" | null;
    attempt: number;
    outcome: "machine_passed" | "machine_failed" | "manual_needed";
    mayContinue: boolean;
    fields: {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        fullName: string;
        gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
        dateOfBirth: string;
        generated: boolean;
        documentNumberMasked: string;
        checked: boolean;
    } | null;
}>;
export type IdentityScanResult = z.infer<typeof IdentityScanResult>;
/**
 * `PUT /api/v1/me/identity/document`: the details as printed, typed after a
 * scan that read nothing (no checker here) or after the tries ran out. Stored
 * with `kyc_status` `pending`, for PSF to hold against the photos.
 */
export declare const TypedIdentityRequest: z.ZodObject<{
    fullName: z.ZodString;
    dateOfBirth: z.ZodEffects<z.ZodString, string, string>;
    document: z.ZodDiscriminatedUnion<"documentType", [z.ZodObject<{
        documentType: z.ZodLiteral<"national_id">;
        documentNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
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
}, "strip", z.ZodTypeAny, {
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
}, {
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
}>;
export type TypedIdentityRequest = z.infer<typeof TypedIdentityRequest>;
//# sourceMappingURL=identity.d.ts.map