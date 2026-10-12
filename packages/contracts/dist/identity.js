"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PassportVerifyResult = exports.PassportRejectionReason = exports.PassportVerifyRequest = exports.NationalIdConfirmRequest = exports.NationalIdLookupResult = exports.NationalIdLookupRequest = exports.IdentityStatus = exports.VerifiedPerson = exports.IdentityAdapterMode = void 0;
const zod_1 = require("zod");
const primitives_1 = require("./primitives");
const registration_1 = require("./registration");
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
exports.IdentityAdapterMode = zod_1.z.enum(["mock", "live", "off"]);
/**
 * The person as the register or the document states them. The document number
 * comes back MASKED, like every other read of it (§10); the server keeps the
 * full number on `identity_documents`.
 */
exports.VerifiedPerson = zod_1.z.object({
    fullName: zod_1.z.string().min(1),
    /** `YYYY-MM-DD`. */
    dateOfBirth: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    gender: registration_1.Gender.nullable(),
    /**
     * The phone the register holds, in full. Returned only to the person who
     * just proved they hold it by typing the code sent there, so it prefills
     * their phone field. Null for a passport, which carries no phone.
     */
    phoneE164: zod_1.z.string().nullable(),
    documentType: registration_1.AccountDocumentType,
    documentNumberMasked: zod_1.z.string(),
    issuingCountry: registration_1.CountryCode,
    /**
     * True when a MOCK adapter made this person up. A demo must be able to say
     * "these details are generated" rather than pass them off as a register's.
     */
    generated: zod_1.z.boolean(),
});
/** `GET /api/v1/me/identity`: where the caller stands, and what can be run here. */
exports.IdentityStatus = zod_1.z.object({
    kycStatus: primitives_1.KycStatus,
    /** `registry`, `document_scan` or `manual`, once verified. */
    method: zod_1.z.string().nullable(),
    verified: exports.VerifiedPerson.omit({ phoneE164: true }).nullable(),
    /** Which verification paths this deployment can run at all. */
    available: zod_1.z.object({ nationalId: zod_1.z.boolean(), passport: zod_1.z.boolean() }),
    /**
     * Whether registering a business here requires a verified identity. True
     * whenever either path is available: a check that can run is enforced.
     */
    required: zod_1.z.boolean(),
    modes: zod_1.z.object({ registry: exports.IdentityAdapterMode, documents: exports.IdentityAdapterMode }),
});
/** `POST /api/v1/me/identity/national-id/lookup`. */
exports.NationalIdLookupRequest = zod_1.z.object({ documentNumber: registration_1.RwandanNationalId });
/**
 * The lookup NEVER returns the person. Whoever types an ID number might not be
 * its holder, so a lookup that answered with a name and a date of birth would
 * be a directory of strangers. It sends a code to the phone the register holds
 * and says where, masked; the person is revealed by `confirm`, to whoever can
 * read that code.
 */
exports.NationalIdLookupResult = zod_1.z.discriminatedUnion("status", [
    zod_1.z.object({
        status: zod_1.z.literal("code_sent"),
        challengeId: primitives_1.Uuid,
        /** The register's phone, masked: `+250·····123`. */
        sentTo: zod_1.z.string(),
        expiresInSeconds: zod_1.z.number().int().positive(),
    }),
    zod_1.z.object({ status: zod_1.z.literal("not_found"), message: zod_1.z.string() }),
    /** The register holds no phone for this person, so nothing can bind them. */
    zod_1.z.object({ status: zod_1.z.literal("no_phone"), message: zod_1.z.string() }),
    zod_1.z.object({ status: zod_1.z.literal("unavailable"), message: zod_1.z.string() }),
]);
/** `POST /api/v1/me/identity/national-id/confirm`. */
exports.NationalIdConfirmRequest = zod_1.z.object({
    challengeId: primitives_1.Uuid,
    code: zod_1.z.string().trim().regex(/^\d{6}$/, "The code is 6 digits."),
});
/** `POST /api/v1/me/identity/passport`: two uploads, `id_photo` kind, the caller's own. */
exports.PassportVerifyRequest = zod_1.z.object({
    /** The passport's photo page. */
    documentObjectKey: zod_1.z.string().trim().min(1).max(300),
    /** A selfie, matched against the passport's portrait. */
    selfieObjectKey: zod_1.z.string().trim().min(1).max(300),
});
exports.PassportRejectionReason = zod_1.z.enum(["not_authentic", "face_mismatch", "unreadable", "expired"]);
exports.PassportVerifyResult = zod_1.z.discriminatedUnion("status", [
    zod_1.z.object({ status: zod_1.z.literal("verified"), person: exports.VerifiedPerson }),
    zod_1.z.object({ status: zod_1.z.literal("rejected"), reason: exports.PassportRejectionReason, message: zod_1.z.string() }),
    zod_1.z.object({ status: zod_1.z.literal("unavailable"), message: zod_1.z.string() }),
]);
//# sourceMappingURL=identity.js.map