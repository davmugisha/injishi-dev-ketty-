import { z } from "zod";
import { KycStatus } from "./primitives";
import { AccountDocumentType, CountryCode, Gender, IdentityDocumentInput, PersonalDetails, RwandanNationalId } from "./registration";
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
export const IdentityAdapterMode = z.enum(["mock", "sandbox", "live", "off"]);
export type IdentityAdapterMode = z.infer<typeof IdentityAdapterMode>;
/** How many tries a draft gets before the person may continue and PSF checks the ID by eye (AC-5). */
export const SCAN_ATTEMPTS_BEFORE_CONTINUE = 3;
/**
 * One scan's outcome (D-n). `machine_passed` is the only one that reads
 * "Checked" (AC-6); `manual_needed` is a deployment with no checker, where the
 * photos wait for PSF; `machine_failed` is a checker that refused the photos.
 */
export const IdentityScanOutcome = z.enum(["machine_passed", "machine_failed", "manual_needed"]);
export type IdentityScanOutcome = z.infer<typeof IdentityScanOutcome>;
/** Why a checker refused a scan. Each has its own fix, worded by the server. */
export const IdentityScanReason = z.enum([
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
export type IdentityScanReason = z.infer<typeof IdentityScanReason>;
/**
 * The person on file, as the scan read them or as they typed them. The number
 * comes back MASKED, like every other read of it (§10); the server keeps the
 * full number on `identity_documents`.
 */
export const IdentityOnFile = z.object({
    fullName: z.string().min(1),
    /** `YYYY-MM-DD`. */
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    gender: Gender.nullable(),
    documentType: AccountDocumentType,
    documentNumberMasked: z.string(),
    issuingCountry: CountryCode,
    /**
     * True when a MOCK verifier made this person up. A demo must be able to say
     * "these details are generated" rather than pass them off as a document's.
     */
    generated: z.boolean(),
    /**
     * True once a machine check passed, or PSF verified the identity on
     * approval (D-o). False while the details are typed and PSF has still to
     * compare the photos: the status reads "PSF will check your ID" (AC-6).
     */
    checked: z.boolean(),
    /**
     * Where the details came from: read off a document by a checker, returned
     * by the population register for a National ID number, or typed as
     * printed. Optional for a client built before it existed.
     */
    source: z.enum(["document", "registry", "typed"]).optional(),
});
export type IdentityOnFile = z.infer<typeof IdentityOnFile>;
/** The caller's latest scan, and how many tries this draft has used. */
export const IdentityScanState = z.object({
    outcome: IdentityScanOutcome,
    documentType: AccountDocumentType,
    /** Tries on this draft (`checks.scan.attempts`, D-m), reset with the draft. */
    attempts: z.number().int().nonnegative(),
    /** Whether the person may type their details and carry on, for PSF to check (AC-5). */
    mayContinue: z.boolean(),
});
export type IdentityScanState = z.infer<typeof IdentityScanState>;
/** `GET /api/v1/me/identity`: where the caller stands, and whether a machine reads the ID here. */
export const IdentityStatus = z.object({
    kycStatus: KycStatus,
    /** `document_scan`, `psf_review` or another earlier method, once verified. */
    method: z.string().nullable(),
    onFile: IdentityOnFile.nullable(),
    scan: IdentityScanState.nullable(),
    /** False where the seam is `off`: the scan keeps the photos and reads nothing, so the person types what is printed. */
    machineCheck: z.boolean(),
    /** The document verifier's mode: a passport, and a National ID card where the registry is off. */
    mode: IdentityAdapterMode,
    /**
     * The National ID registry's mode (NIDA, through GTBank). Anything but
     * `off` means a National ID is checked by its NUMBER and a selfie
     * (`POST /me/identity/national-id`), not by scanning the card.
     */
    nationalIdMode: IdentityAdapterMode,
});
export type IdentityStatus = z.infer<typeof IdentityStatus>;
const PhotoKey = z.string().trim().min(1).max(300);
/** `POST /api/v1/me/identity/scan`: the front of the card or the photo page, then a selfie, both uploaded first as `id_photo`. */
export const IdentityScanRequest = z.object({
    documentType: AccountDocumentType,
    frontKey: PhotoKey,
    selfieKey: PhotoKey,
    /** A passport's issuing country, which the document checker is told. Ignored for a National ID. */
    issuingCountry: CountryCode.optional(),
});
export type IdentityScanRequest = z.infer<typeof IdentityScanRequest>;
export const IdentityScanResult = z.object({
    outcome: IdentityScanOutcome,
    reason: IdentityScanReason.nullable(),
    /** What went wrong and how to fix it, or what happens next. Null when the check passed. */
    message: z.string().nullable(),
    /** What the checker read, or null when it read nothing. */
    fields: IdentityOnFile.nullable(),
    /** This try's number on the draft. */
    attempt: z.number().int().positive(),
    mayContinue: z.boolean(),
});
export type IdentityScanResult = z.infer<typeof IdentityScanResult>;
/**
 * `PUT /api/v1/me/identity/document`: the details as printed, typed after a
 * scan that read nothing (no checker here) or after the tries ran out. Stored
 * with `kyc_status` `pending`, for PSF to hold against the photos.
 */
export const TypedIdentityRequest = z.object({
    fullName: PersonalDetails.shape.fullName,
    dateOfBirth: PersonalDetails.shape.dateOfBirth,
    document: IdentityDocumentInput,
});
export type TypedIdentityRequest = z.infer<typeof TypedIdentityRequest>;
/**
 * `POST /api/v1/me/identity/national-id`: a Rwandan National ID checked by its
 * number against the population register (NIDA, through GTBank), with a
 * selfie uploaded first as `id_photo`. Answers an `IdentityScanResult`, and
 * counts as one try on the draft, as a scan does.
 */
export const NationalIdCheckRequest = z.object({
    documentNumber: RwandanNationalId,
    /**
     * Optional since 2026-11-02 (the owner's decision): without one, NIDA is asked by the number alone,
     * its details fill the form, and the document reviewer confirms the ID before approving.
     */
    selfieKey: PhotoKey.optional(),
});
export type NationalIdCheckRequest = z.infer<typeof NationalIdCheckRequest>;
