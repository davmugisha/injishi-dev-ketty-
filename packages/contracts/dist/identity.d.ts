import { z } from "zod";
/**
 * Which side of each seam a deployment runs. `off` is a real answer, not a
 * missing one: it is what a real database runs until a provider is signed, and
 * it is the only mode in which a business registration is not held to a
 * verified identity, because a check nobody can run cannot be required.
 */
export declare const IdentityAdapterMode: z.ZodEnum<["mock", "live", "off"]>;
export type IdentityAdapterMode = z.infer<typeof IdentityAdapterMode>;
/**
 * The person as the register or the document states them. The document number
 * comes back MASKED, like every other read of it (§10); the server keeps the
 * full number on `identity_documents`.
 */
export declare const VerifiedPerson: z.ZodObject<{
    fullName: z.ZodString;
    /** `YYYY-MM-DD`. */
    dateOfBirth: z.ZodString;
    gender: z.ZodNullable<z.ZodEnum<["female", "male", "other", "prefer_not_to_say"]>>;
    /**
     * The phone the register holds, in full. Returned only to the person who
     * just proved they hold it by typing the code sent there, so it prefills
     * their phone field. Null for a passport, which carries no phone.
     */
    phoneE164: z.ZodNullable<z.ZodString>;
    documentType: z.ZodEnum<["national_id", "passport"]>;
    documentNumberMasked: z.ZodString;
    issuingCountry: z.ZodEffects<z.ZodString, string, string>;
    /**
     * True when a MOCK adapter made this person up. A demo must be able to say
     * "these details are generated" rather than pass them off as a register's.
     */
    generated: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    documentType: "national_id" | "passport";
    issuingCountry: string;
    fullName: string;
    gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
    dateOfBirth: string;
    phoneE164: string | null;
    generated: boolean;
    documentNumberMasked: string;
}, {
    documentType: "national_id" | "passport";
    issuingCountry: string;
    fullName: string;
    gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
    dateOfBirth: string;
    phoneE164: string | null;
    generated: boolean;
    documentNumberMasked: string;
}>;
export type VerifiedPerson = z.infer<typeof VerifiedPerson>;
/** `GET /api/v1/me/identity`: where the caller stands, and what can be run here. */
export declare const IdentityStatus: z.ZodObject<{
    kycStatus: z.ZodEnum<["unverified", "pending", "verified", "rejected"]>;
    /** `registry`, `document_scan` or `manual`, once verified. */
    method: z.ZodNullable<z.ZodString>;
    verified: z.ZodNullable<z.ZodObject<Omit<{
        fullName: z.ZodString;
        /** `YYYY-MM-DD`. */
        dateOfBirth: z.ZodString;
        gender: z.ZodNullable<z.ZodEnum<["female", "male", "other", "prefer_not_to_say"]>>;
        /**
         * The phone the register holds, in full. Returned only to the person who
         * just proved they hold it by typing the code sent there, so it prefills
         * their phone field. Null for a passport, which carries no phone.
         */
        phoneE164: z.ZodNullable<z.ZodString>;
        documentType: z.ZodEnum<["national_id", "passport"]>;
        documentNumberMasked: z.ZodString;
        issuingCountry: z.ZodEffects<z.ZodString, string, string>;
        /**
         * True when a MOCK adapter made this person up. A demo must be able to say
         * "these details are generated" rather than pass them off as a register's.
         */
        generated: z.ZodBoolean;
    }, "phoneE164">, "strip", z.ZodTypeAny, {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        fullName: string;
        gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
        dateOfBirth: string;
        generated: boolean;
        documentNumberMasked: string;
    }, {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        fullName: string;
        gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
        dateOfBirth: string;
        generated: boolean;
        documentNumberMasked: string;
    }>>;
    /** Which verification paths this deployment can run at all. */
    available: z.ZodObject<{
        nationalId: z.ZodBoolean;
        passport: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        passport: boolean;
        nationalId: boolean;
    }, {
        passport: boolean;
        nationalId: boolean;
    }>;
    /**
     * Whether registering a business here requires a verified identity. True
     * whenever either path is available: a check that can run is enforced.
     */
    required: z.ZodBoolean;
    modes: z.ZodObject<{
        registry: z.ZodEnum<["mock", "live", "off"]>;
        documents: z.ZodEnum<["mock", "live", "off"]>;
    }, "strip", z.ZodTypeAny, {
        documents: "mock" | "live" | "off";
        registry: "mock" | "live" | "off";
    }, {
        documents: "mock" | "live" | "off";
        registry: "mock" | "live" | "off";
    }>;
}, "strip", z.ZodTypeAny, {
    verified: {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        fullName: string;
        gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
        dateOfBirth: string;
        generated: boolean;
        documentNumberMasked: string;
    } | null;
    available: {
        passport: boolean;
        nationalId: boolean;
    };
    method: string | null;
    required: boolean;
    kycStatus: "rejected" | "unverified" | "pending" | "verified";
    modes: {
        documents: "mock" | "live" | "off";
        registry: "mock" | "live" | "off";
    };
}, {
    verified: {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        fullName: string;
        gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
        dateOfBirth: string;
        generated: boolean;
        documentNumberMasked: string;
    } | null;
    available: {
        passport: boolean;
        nationalId: boolean;
    };
    method: string | null;
    required: boolean;
    kycStatus: "rejected" | "unverified" | "pending" | "verified";
    modes: {
        documents: "mock" | "live" | "off";
        registry: "mock" | "live" | "off";
    };
}>;
export type IdentityStatus = z.infer<typeof IdentityStatus>;
/** `POST /api/v1/me/identity/national-id/lookup`. */
export declare const NationalIdLookupRequest: z.ZodObject<{
    documentNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
}, "strip", z.ZodTypeAny, {
    documentNumber: string;
}, {
    documentNumber: string;
}>;
export type NationalIdLookupRequest = z.infer<typeof NationalIdLookupRequest>;
/**
 * The lookup NEVER returns the person. Whoever types an ID number might not be
 * its holder, so a lookup that answered with a name and a date of birth would
 * be a directory of strangers. It sends a code to the phone the register holds
 * and says where, masked; the person is revealed by `confirm`, to whoever can
 * read that code.
 */
export declare const NationalIdLookupResult: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
    status: z.ZodLiteral<"code_sent">;
    challengeId: z.ZodString;
    /** The register's phone, masked: `+250·····123`. */
    sentTo: z.ZodString;
    expiresInSeconds: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "code_sent";
    expiresInSeconds: number;
    challengeId: string;
    sentTo: string;
}, {
    status: "code_sent";
    expiresInSeconds: number;
    challengeId: string;
    sentTo: string;
}>, z.ZodObject<{
    status: z.ZodLiteral<"not_found">;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    status: "not_found";
}, {
    message: string;
    status: "not_found";
}>, z.ZodObject<{
    status: z.ZodLiteral<"no_phone">;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    status: "no_phone";
}, {
    message: string;
    status: "no_phone";
}>, z.ZodObject<{
    status: z.ZodLiteral<"unavailable">;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    status: "unavailable";
}, {
    message: string;
    status: "unavailable";
}>]>;
export type NationalIdLookupResult = z.infer<typeof NationalIdLookupResult>;
/** `POST /api/v1/me/identity/national-id/confirm`. */
export declare const NationalIdConfirmRequest: z.ZodObject<{
    challengeId: z.ZodString;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    challengeId: string;
}, {
    code: string;
    challengeId: string;
}>;
export type NationalIdConfirmRequest = z.infer<typeof NationalIdConfirmRequest>;
/** `POST /api/v1/me/identity/passport`: two uploads, `id_photo` kind, the caller's own. */
export declare const PassportVerifyRequest: z.ZodObject<{
    /** The passport's photo page. */
    documentObjectKey: z.ZodString;
    /** A selfie, matched against the passport's portrait. */
    selfieObjectKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    documentObjectKey: string;
    selfieObjectKey: string;
}, {
    documentObjectKey: string;
    selfieObjectKey: string;
}>;
export type PassportVerifyRequest = z.infer<typeof PassportVerifyRequest>;
export declare const PassportRejectionReason: z.ZodEnum<["not_authentic", "face_mismatch", "unreadable", "expired"]>;
export type PassportRejectionReason = z.infer<typeof PassportRejectionReason>;
export declare const PassportVerifyResult: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
    status: z.ZodLiteral<"verified">;
    person: z.ZodObject<{
        fullName: z.ZodString;
        /** `YYYY-MM-DD`. */
        dateOfBirth: z.ZodString;
        gender: z.ZodNullable<z.ZodEnum<["female", "male", "other", "prefer_not_to_say"]>>;
        /**
         * The phone the register holds, in full. Returned only to the person who
         * just proved they hold it by typing the code sent there, so it prefills
         * their phone field. Null for a passport, which carries no phone.
         */
        phoneE164: z.ZodNullable<z.ZodString>;
        documentType: z.ZodEnum<["national_id", "passport"]>;
        documentNumberMasked: z.ZodString;
        issuingCountry: z.ZodEffects<z.ZodString, string, string>;
        /**
         * True when a MOCK adapter made this person up. A demo must be able to say
         * "these details are generated" rather than pass them off as a register's.
         */
        generated: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        fullName: string;
        gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
        dateOfBirth: string;
        phoneE164: string | null;
        generated: boolean;
        documentNumberMasked: string;
    }, {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        fullName: string;
        gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
        dateOfBirth: string;
        phoneE164: string | null;
        generated: boolean;
        documentNumberMasked: string;
    }>;
}, "strip", z.ZodTypeAny, {
    status: "verified";
    person: {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        fullName: string;
        gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
        dateOfBirth: string;
        phoneE164: string | null;
        generated: boolean;
        documentNumberMasked: string;
    };
}, {
    status: "verified";
    person: {
        documentType: "national_id" | "passport";
        issuingCountry: string;
        fullName: string;
        gender: "other" | "female" | "male" | "prefer_not_to_say" | null;
        dateOfBirth: string;
        phoneE164: string | null;
        generated: boolean;
        documentNumberMasked: string;
    };
}>, z.ZodObject<{
    status: z.ZodLiteral<"rejected">;
    reason: z.ZodEnum<["not_authentic", "face_mismatch", "unreadable", "expired"]>;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    status: "rejected";
    reason: "expired" | "not_authentic" | "face_mismatch" | "unreadable";
}, {
    message: string;
    status: "rejected";
    reason: "expired" | "not_authentic" | "face_mismatch" | "unreadable";
}>, z.ZodObject<{
    status: z.ZodLiteral<"unavailable">;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    status: "unavailable";
}, {
    message: string;
    status: "unavailable";
}>]>;
export type PassportVerifyResult = z.infer<typeof PassportVerifyResult>;
//# sourceMappingURL=identity.d.ts.map