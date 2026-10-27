import { z } from "zod";

import { IdentityScanOutcome } from "./identity";
import { Uuid } from "./primitives";
import { AccountDocumentType, OrgCertificateKind, RegistrantCapacity, TinCheckResult } from "./registration";

/**
 * The wizard's answers, kept on the server at `GET|PUT|DELETE
 * /api/v1/me/registration-draft` (ADR-059 call 5, moved server side by
 * ADR-060), saved as they are typed since ADR-075 (S9, AC-9), and copied on the
 * device under this same contract.
 *
 * It NEVER holds an ID number, and that is structural rather than promised:
 * the personal block has no document number field and is strict, the intended
 * owner carries no National ID, and the whole draft is refused if a run of
 * sixteen digits appears anywhere in it (`holdsIdNumber`). A verified identity
 * lives in `verified_identities`; the draft only has to remember what was typed
 * around it. Nor does it hold a photo: an uploaded document is its object key,
 * which the server checks again at creation (AC-11).
 *
 * Everything ADR-075 added is optional, so a draft saved before it still reads,
 * and reopens on Business as it did then.
 */
const DraftText = z.string().max(300);
const DraftAddress = z.record(z.string().max(40), DraftText);

/** ADR-060's phases. A draft saved before ADR-075 carries one; nothing reads it now. */
export const REGISTRATION_DRAFT_PHASES = ["place", "about", "business", "documents"] as const;

/** The five steps, in order, that a draft reopens on (ADR-075 O-3, S9). */
export const REGISTRATION_DRAFT_STEPS = ["business", "you", "documents", "review", "pay"] as const;
export type RegistrationDraftStep = (typeof REGISTRATION_DRAFT_STEPS)[number];

/**
 * What a draft remembers as done: each section whose Next was pressed, and
 * Review's Continue. A section marked done is done again only while its answers
 * still satisfy it, so a stale mark opens nothing.
 */
export const REGISTRATION_DRAFT_DONE = ["tin", "owner", "id", "intended", "loc", "fr", "upi", "review"] as const;
export type RegistrationDraftDone = (typeof REGISTRATION_DRAFT_DONE)[number];

/** Whether a value holds an ID number: a run of sixteen digits anywhere in it, a National ID's length. */
export function holdsIdNumber(value: unknown): boolean {
  return /\d{16}/.test(JSON.stringify(value) ?? "");
}

export const RegistrationDraft = z
  .object({
    v: z.literal(1),
    /** ADR-060's phase, on a draft saved before ADR-075. Nothing writes it now. */
    phase: z.enum(REGISTRATION_DRAFT_PHASES).optional(),
    /** The step that was open (AC-9). Absent on an older draft, which opens on Business. */
    openStep: z.enum(REGISTRATION_DRAFT_STEPS).optional(),
    /** The furthest step reached, so a refresh keeps every step that could be pressed. */
    reached: z.enum(REGISTRATION_DRAFT_STEPS).optional(),
    done: z.array(z.enum(REGISTRATION_DRAFT_DONE)).max(REGISTRATION_DRAFT_DONE.length).optional(),
    kind: z.string().max(40).nullable(),
    capacity: RegistrantCapacity,
    /** False when the stored profile answered About you. */
    typedPersonal: z.boolean(),
    personal: z
      .object({
        firstName: DraftText,
        middleName: DraftText,
        lastName: DraftText,
        documentType: AccountDocumentType,
        issuingCountry: DraftText,
        gender: DraftText,
        dateOfBirth: DraftText,
        phoneE164: DraftText,
        address: DraftAddress,
      })
      .strict(),
    intendedOwner: z.object({ name: DraftText, email: DraftText }).strict(),
    business: z.record(z.string().max(60), z.union([DraftText, z.boolean(), z.null(), DraftAddress])),
    branches: z.array(z.object({ name: DraftText, address: DraftAddress }).strict()).max(50),
    /** Part of a franchise? (ADR-075 O-7) as typed; `FranchiseDeclaration` is what Next checks it against. */
    franchise: z
      .object({
        role: z.enum(["", "none", "franchisee", "franchisor"]),
        brandName: DraftText,
        franchisorLegalName: DraftText,
        franchisorCountry: DraftText,
        franchisedLocations: DraftText,
      })
      .strict()
      .optional(),
    /** The documents uploaded so far (ADR-075 S5), each by the key of its stored object. */
    documents: z
      .array(
        z
          .object({
            kind: OrgCertificateKind,
            objectKey: z.string().max(300),
            filename: DraftText,
            sizeBytes: z.number().int().nonnegative().max(100_000_000),
          })
          .strict(),
      )
      .max(30)
      .optional(),
  })
  .strict()
  .refine((draft) => !holdsIdNumber(draft), {
    message: "A registration draft never holds an ID number.",
  });
export type RegistrationDraft = z.infer<typeof RegistrationDraft>;

/**
 * What the server alone writes beside a draft (ADR-075 D-m), so a finished
 * check is never asked twice: the TIN check's answer and how often it was
 * asked, the ID scan's tries and their last outcome, and the registration the
 * draft became at the first Pay press (AC-14), whose settled fee is what deletes
 * the draft. A check counts as finished only while the answers still match it:
 * the TIN answer only for the TIN it answered.
 */
export const RegistrationDraftChecks = z.object({
  tin: z
    .object({
      /** The TIN asked about. */
      tin: z.string(),
      /** Whose question it was: the directors' names come back to the helper alone (AC-7). */
      capacity: RegistrantCapacity.nullable(),
      attempts: z.number().int().positive(),
      answer: TinCheckResult,
      checkedAt: z.string(),
    })
    .optional(),
  scan: z
    .object({
      attempts: z.number().int().nonnegative(),
      documentType: AccountDocumentType,
      outcome: IdentityScanOutcome,
    })
    .optional(),
  registrationId: Uuid.optional(),
});
export type RegistrationDraftChecks = z.infer<typeof RegistrationDraftChecks>;

/**
 * `GET /api/v1/me/registration-draft`: the answers, the checks, and when the
 * answers were last saved. With nothing kept, both nulls and no checks.
 */
export const RegistrationDraftRead = z.object({
  draft: RegistrationDraft.nullable(),
  checks: RegistrationDraftChecks,
  savedAt: z.string().nullable(),
});
export type RegistrationDraftRead = z.infer<typeof RegistrationDraftRead>;

/** `PUT /api/v1/me/registration-draft`: when the server saved the answers. */
export const RegistrationDraftSaved = z.object({ savedAt: z.string() });
export type RegistrationDraftSaved = z.infer<typeof RegistrationDraftSaved>;
