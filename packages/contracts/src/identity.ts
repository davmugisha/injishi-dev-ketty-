import { z } from "zod";
import { KycStatus, Uuid } from "./primitives";
import { AccountDocumentType, CountryCode, Gender, RwandanNationalId } from "./registration";
// ---------------------------------------------------------------------------
// Identity verification (ADR-060): a National ID looked up in the population
// register, or a passport read and checked by a document verifier.
// ---------------------------------------------------------------------------
/**
 * Which side of each seam a deployment runs. `off` is a real answer, not a
 * missing one: it is what a real database runs until a provider is signed, and
 * it is the only mode in which a business registration is not held to a
 * verified identity, because a check nobody can run cannot be required.
 */
export const IdentityAdapterMode = z.enum(["mock", "live", "off"]);
export type IdentityAdapterMode = z.infer<typeof IdentityAdapterMode>;
/**
 * The person as the register or the document states them. The document number
 * comes back MASKED, like every other read of it (§10); the server keeps the
 * full number on `identity_documents`.
 */
export const VerifiedPerson = z.object({
    fullName: z.string().min(1),
    /** `YYYY-MM-DD`. */
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    gender: Gender.nullable(),
    /**
     * The phone the register holds, in full. Returned only to the person who
     * just proved they hold it by typing the code sent there, so it prefills
     * their phone field. Null for a passport, which carries no phone.
     */
    phoneE164: z.string().nullable(),
    documentType: AccountDocumentType,
    documentNumberMasked: z.string(),
    issuingCountry: CountryCode,
    /**
     * True when a MOCK adapter made this person up. A demo must be able to say
     * "these details are generated" rather than pass them off as a register's.
     */
    generated: z.boolean(),
});
export type VerifiedPerson = z.infer<typeof VerifiedPerson>;
/** `GET /api/v1/me/identity`: where the caller stands, and what can be run here. */
export const IdentityStatus = z.object({
    kycStatus: KycStatus,
    /** `registry`, `document_scan` or `manual`, once verified. */
    method: z.string().nullable(),
    verified: VerifiedPerson.omit({ phoneE164: true }).nullable(),
    /** Which verification paths this deployment can run at all. */
    available: z.object({ nationalId: z.boolean(), passport: z.boolean() }),
    /**
     * Whether registering a business here requires a verified identity. True
     * whenever either path is available: a check that can run is enforced.
     */
    required: z.boolean(),
    modes: z.object({ registry: IdentityAdapterMode, documents: IdentityAdapterMode }),
});
export type IdentityStatus = z.infer<typeof IdentityStatus>;
/** `POST /api/v1/me/identity/national-id/lookup`. */
export const NationalIdLookupRequest = z.object({ documentNumber: RwandanNationalId });
export type NationalIdLookupRequest = z.infer<typeof NationalIdLookupRequest>;
/**
 * The lookup NEVER returns the person. Whoever types an ID number might not be
 * its holder, so a lookup that answered with a name and a date of birth would
 * be a directory of strangers. It sends a code to the phone the register holds
 * and says where, masked; the person is revealed by `confirm`, to whoever can
 * read that code.
 */
export const NationalIdLookupResult = z.discriminatedUnion("status", [
    z.object({
        status: z.literal("code_sent"),
        challengeId: Uuid,
        /** The register's phone, masked: `+250·····123`. */
        sentTo: z.string(),
        expiresInSeconds: z.number().int().positive(),
    }),
    z.object({ status: z.literal("not_found"), message: z.string() }),
    /** The register holds no phone for this person, so nothing can bind them. */
    z.object({ status: z.literal("no_phone"), message: z.string() }),
    z.object({ status: z.literal("unavailable"), message: z.string() }),
]);
export type NationalIdLookupResult = z.infer<typeof NationalIdLookupResult>;
/** `POST /api/v1/me/identity/national-id/confirm`. */
export const NationalIdConfirmRequest = z.object({
    challengeId: Uuid,
    code: z.string().trim().regex(/^\d{6}$/, "The code is 6 digits."),
});
export type NationalIdConfirmRequest = z.infer<typeof NationalIdConfirmRequest>;
/** `POST /api/v1/me/identity/passport`: two uploads, `id_photo` kind, the caller's own. */
export const PassportVerifyRequest = z.object({
    /** The passport's photo page. */
    documentObjectKey: z.string().trim().min(1).max(300),
    /** A selfie, matched against the passport's portrait. */
    selfieObjectKey: z.string().trim().min(1).max(300),
});
export type PassportVerifyRequest = z.infer<typeof PassportVerifyRequest>;
export const PassportRejectionReason = z.enum(["not_authentic", "face_mismatch", "unreadable", "expired"]);
export type PassportRejectionReason = z.infer<typeof PassportRejectionReason>;
export const PassportVerifyResult = z.discriminatedUnion("status", [
    z.object({ status: z.literal("verified"), person: VerifiedPerson }),
    z.object({ status: z.literal("rejected"), reason: PassportRejectionReason, message: z.string() }),
    z.object({ status: z.literal("unavailable"), message: z.string() }),
]);
export type PassportVerifyResult = z.infer<typeof PassportVerifyResult>;
