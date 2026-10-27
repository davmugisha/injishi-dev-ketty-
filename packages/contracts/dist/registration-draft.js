"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistrationDraftSaved = exports.RegistrationDraftRead = exports.RegistrationDraftChecks = exports.RegistrationDraft = exports.REGISTRATION_DRAFT_DONE = exports.REGISTRATION_DRAFT_STEPS = exports.REGISTRATION_DRAFT_PHASES = void 0;
exports.holdsIdNumber = holdsIdNumber;
const zod_1 = require("zod");
const identity_1 = require("./identity");
const primitives_1 = require("./primitives");
const registration_1 = require("./registration");
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
const DraftText = zod_1.z.string().max(300);
const DraftAddress = zod_1.z.record(zod_1.z.string().max(40), DraftText);
/** ADR-060's phases. A draft saved before ADR-075 carries one; nothing reads it now. */
exports.REGISTRATION_DRAFT_PHASES = ["place", "about", "business", "documents"];
/** The five steps, in order, that a draft reopens on (ADR-075 O-3, S9). */
exports.REGISTRATION_DRAFT_STEPS = ["business", "you", "documents", "review", "pay"];
/**
 * What a draft remembers as done: each section whose Next was pressed, and
 * Review's Continue. A section marked done is done again only while its answers
 * still satisfy it, so a stale mark opens nothing.
 */
exports.REGISTRATION_DRAFT_DONE = ["tin", "owner", "id", "intended", "loc", "fr", "upi", "review"];
/** Whether a value holds an ID number: a run of sixteen digits anywhere in it, a National ID's length. */
function holdsIdNumber(value) {
    return /\d{16}/.test(JSON.stringify(value) ?? "");
}
exports.RegistrationDraft = zod_1.z
    .object({
    v: zod_1.z.literal(1),
    /** ADR-060's phase, on a draft saved before ADR-075. Nothing writes it now. */
    phase: zod_1.z.enum(exports.REGISTRATION_DRAFT_PHASES).optional(),
    /** The step that was open (AC-9). Absent on an older draft, which opens on Business. */
    openStep: zod_1.z.enum(exports.REGISTRATION_DRAFT_STEPS).optional(),
    /** The furthest step reached, so a refresh keeps every step that could be pressed. */
    reached: zod_1.z.enum(exports.REGISTRATION_DRAFT_STEPS).optional(),
    done: zod_1.z.array(zod_1.z.enum(exports.REGISTRATION_DRAFT_DONE)).max(exports.REGISTRATION_DRAFT_DONE.length).optional(),
    kind: zod_1.z.string().max(40).nullable(),
    capacity: registration_1.RegistrantCapacity,
    /** False when the stored profile answered About you. */
    typedPersonal: zod_1.z.boolean(),
    personal: zod_1.z
        .object({
        firstName: DraftText,
        middleName: DraftText,
        lastName: DraftText,
        documentType: registration_1.AccountDocumentType,
        issuingCountry: DraftText,
        gender: DraftText,
        dateOfBirth: DraftText,
        phoneE164: DraftText,
        address: DraftAddress,
    })
        .strict(),
    intendedOwner: zod_1.z.object({ name: DraftText, email: DraftText }).strict(),
    business: zod_1.z.record(zod_1.z.string().max(60), zod_1.z.union([DraftText, zod_1.z.boolean(), zod_1.z.null(), DraftAddress])),
    branches: zod_1.z.array(zod_1.z.object({ name: DraftText, address: DraftAddress }).strict()).max(50),
    /** Part of a franchise? (ADR-075 O-7) as typed; `FranchiseDeclaration` is what Next checks it against. */
    franchise: zod_1.z
        .object({
        role: zod_1.z.enum(["", "none", "franchisee", "franchisor"]),
        brandName: DraftText,
        franchisorLegalName: DraftText,
        franchisorCountry: DraftText,
        franchisedLocations: DraftText,
    })
        .strict()
        .optional(),
    /** The documents uploaded so far (ADR-075 S5), each by the key of its stored object. */
    documents: zod_1.z
        .array(zod_1.z
        .object({
        kind: registration_1.OrgCertificateKind,
        objectKey: zod_1.z.string().max(300),
        filename: DraftText,
        sizeBytes: zod_1.z.number().int().nonnegative().max(100000000),
    })
        .strict())
        .max(30)
        .optional(),
})
    .strict()
    .refine((draft) => !holdsIdNumber(draft), {
    message: "A registration draft never holds an ID number.",
});
/**
 * What the server alone writes beside a draft (ADR-075 D-m), so a finished
 * check is never asked twice: the TIN check's answer and how often it was
 * asked, the ID scan's tries and their last outcome, and the registration the
 * draft became at the first Pay press (AC-14), whose settled fee is what deletes
 * the draft. A check counts as finished only while the answers still match it:
 * the TIN answer only for the TIN it answered.
 */
exports.RegistrationDraftChecks = zod_1.z.object({
    tin: zod_1.z
        .object({
        /** The TIN asked about. */
        tin: zod_1.z.string(),
        /** Whose question it was: the directors' names come back to the helper alone (AC-7). */
        capacity: registration_1.RegistrantCapacity.nullable(),
        attempts: zod_1.z.number().int().positive(),
        answer: registration_1.TinCheckResult,
        checkedAt: zod_1.z.string(),
    })
        .optional(),
    scan: zod_1.z
        .object({
        attempts: zod_1.z.number().int().nonnegative(),
        documentType: registration_1.AccountDocumentType,
        outcome: identity_1.IdentityScanOutcome,
    })
        .optional(),
    registrationId: primitives_1.Uuid.optional(),
});
/**
 * `GET /api/v1/me/registration-draft`: the answers, the checks, and when the
 * answers were last saved. With nothing kept, both nulls and no checks.
 */
exports.RegistrationDraftRead = zod_1.z.object({
    draft: exports.RegistrationDraft.nullable(),
    checks: exports.RegistrationDraftChecks,
    savedAt: zod_1.z.string().nullable(),
});
/** `PUT /api/v1/me/registration-draft`: when the server saved the answers. */
exports.RegistrationDraftSaved = zod_1.z.object({ savedAt: zod_1.z.string() });
//# sourceMappingURL=registration-draft.js.map