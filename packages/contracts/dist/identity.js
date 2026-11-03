"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NationalIdCheckRequest = exports.TypedIdentityRequest = exports.IdentityScanResult = exports.IdentityScanRequest = exports.IdentityStatus = exports.IdentityScanState = exports.IdentityOnFile = exports.IdentityScanReason = exports.IdentityScanOutcome = exports.SCAN_ATTEMPTS_BEFORE_CONTINUE = exports.IdentityAdapterMode = void 0;
const zod_1 = require("zod");
const primitives_1 = require("./primitives");
const registration_1 = require("./registration");
// ---------------------------------------------------------------------------
// Identity (ADR-060, rebuilt by ADR-075 A1): the ID is scanned, front then a
// selfie, for a National ID and a passport alike. No code is sent to any phone
// (AC-4); where no checker runs, the photos are kept and a PSF officer compares
// them before approving (D-a, O-6).
// ---------------------------------------------------------------------------
/**
 * Which side of an identity seam a deployment runs. `off` is a real answer,
 * not a missing one: it is what a real database runs until a provider is
 * signed, and there the scan stores the photos for PSF and reads nothing.
 * `sandbox` is the real HTTP adapter talking to Injishi Mock APIs
 * (`server/mock-apis`): the people it answers about are as invented as the
 * mock's.
 */
exports.IdentityAdapterMode = zod_1.z.enum(["mock", "sandbox", "live", "off"]);
/** How many tries a draft gets before the person may continue and PSF checks the ID by eye (AC-5). */
exports.SCAN_ATTEMPTS_BEFORE_CONTINUE = 3;
/**
 * One scan's outcome (D-n). `machine_passed` is the only one that reads
 * "Checked" (AC-6); `manual_needed` is a deployment with no checker, where the
 * photos wait for PSF; `machine_failed` is a checker that refused the photos.
 */
exports.IdentityScanOutcome = zod_1.z.enum(["machine_passed", "machine_failed", "manual_needed"]);
/** Why a checker refused a scan. Each has its own fix, worded by the server. */
exports.IdentityScanReason = zod_1.z.enum([
    "not_authentic",
    "face_mismatch",
    "unreadable",
    "expired",
    "unavailable",
    /** The population register holds no one under this National ID. */
    "not_found",
    /** The register holds the number, and the card was cancelled. */
    "revoked",
]);
/**
 * The person on file, as the scan read them or as they typed them. The number
 * comes back MASKED, like every other read of it (§10); the server keeps the
 * full number on `identity_documents`.
 */
exports.IdentityOnFile = zod_1.z.object({
    fullName: zod_1.z.string().min(1),
    /** `YYYY-MM-DD`. */
    dateOfBirth: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    gender: registration_1.Gender.nullable(),
    documentType: registration_1.AccountDocumentType,
    documentNumberMasked: zod_1.z.string(),
    issuingCountry: registration_1.CountryCode,
    /**
     * True when a MOCK verifier made this person up. A demo must be able to say
     * "these details are generated" rather than pass them off as a document's.
     */
    generated: zod_1.z.boolean(),
    /**
     * True once a machine check passed, or PSF verified the identity on
     * approval (D-o). False while the details are typed and PSF has still to
     * compare the photos: the status reads "PSF will check your ID" (AC-6).
     */
    checked: zod_1.z.boolean(),
    /**
     * Where the details came from: read off a document by a checker, returned
     * by the population register for a National ID number, or typed as
     * printed. Optional for a client built before it existed.
     */
    source: zod_1.z.enum(["document", "registry", "typed"]).optional(),
});
/** The caller's latest scan, and how many tries this draft has used. */
exports.IdentityScanState = zod_1.z.object({
    outcome: exports.IdentityScanOutcome,
    documentType: registration_1.AccountDocumentType,
    /** Tries on this draft (`checks.scan.attempts`, D-m), reset with the draft. */
    attempts: zod_1.z.number().int().nonnegative(),
    /** Whether the person may type their details and carry on, for PSF to check (AC-5). */
    mayContinue: zod_1.z.boolean(),
});
/** `GET /api/v1/me/identity`: where the caller stands, and whether a machine reads the ID here. */
exports.IdentityStatus = zod_1.z.object({
    kycStatus: primitives_1.KycStatus,
    /** `document_scan`, `psf_review` or another earlier method, once verified. */
    method: zod_1.z.string().nullable(),
    onFile: exports.IdentityOnFile.nullable(),
    scan: exports.IdentityScanState.nullable(),
    /** False where the seam is `off`: the scan keeps the photos and reads nothing, so the person types what is printed. */
    machineCheck: zod_1.z.boolean(),
    /** The document verifier's mode: a passport, and a National ID card where the registry is off. */
    mode: exports.IdentityAdapterMode,
    /**
     * The National ID registry's mode (NIDA, through GTBank). Anything but
     * `off` means a National ID is checked by its NUMBER and a selfie
     * (`POST /me/identity/national-id`), not by scanning the card.
     */
    nationalIdMode: exports.IdentityAdapterMode,
});
const PhotoKey = zod_1.z.string().trim().min(1).max(300);
/** `POST /api/v1/me/identity/scan`: the front of the card or the photo page, then a selfie, both uploaded first as `id_photo`. */
exports.IdentityScanRequest = zod_1.z.object({
    documentType: registration_1.AccountDocumentType,
    frontKey: PhotoKey,
    selfieKey: PhotoKey,
    /** A passport's issuing country, which the document checker is told. Ignored for a National ID. */
    issuingCountry: registration_1.CountryCode.optional(),
});
exports.IdentityScanResult = zod_1.z.object({
    outcome: exports.IdentityScanOutcome,
    reason: exports.IdentityScanReason.nullable(),
    /** What went wrong and how to fix it, or what happens next. Null when the check passed. */
    message: zod_1.z.string().nullable(),
    /** What the checker read, or null when it read nothing. */
    fields: exports.IdentityOnFile.nullable(),
    /** This try's number on the draft. */
    attempt: zod_1.z.number().int().positive(),
    mayContinue: zod_1.z.boolean(),
});
/**
 * `PUT /api/v1/me/identity/document`: the details as printed, typed after a
 * scan that read nothing (no checker here) or after the tries ran out. Stored
 * with `kyc_status` `pending`, for PSF to hold against the photos.
 */
exports.TypedIdentityRequest = zod_1.z.object({
    fullName: registration_1.PersonalDetails.shape.fullName,
    dateOfBirth: registration_1.PersonalDetails.shape.dateOfBirth,
    document: registration_1.IdentityDocumentInput,
});
/**
 * `POST /api/v1/me/identity/national-id`: a Rwandan National ID checked by its
 * number against the population register (NIDA, through GTBank), with a
 * selfie uploaded first as `id_photo`. Answers an `IdentityScanResult`, and
 * counts as one try on the draft, as a scan does.
 */
exports.NationalIdCheckRequest = zod_1.z.object({
    documentNumber: registration_1.RwandanNationalId,
    /**
     * Optional since 2026-11-02 (the owner's decision): without one, NIDA is asked by the number alone,
     * its details fill the form, and the document reviewer confirms the ID before approving.
     */
    selfieKey: PhotoKey.optional(),
});
//# sourceMappingURL=identity.js.map