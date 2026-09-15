"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordTrainingAttendanceResult = exports.RecordTrainingAttendance = exports.TrainingWalkInResult = exports.CreateTrainingWalkIn = exports.TrainingRosterResponse = exports.TrainingRosterQuery = exports.TrainingRosterEntry = exports.CancelAdminTrainingSessionResult = exports.CancelAdminTrainingSession = exports.UpdateAdminTrainingSession = exports.CreateAdminTrainingSession = exports.AdminTrainingSessionListResponse = exports.AdminTrainingSessionListQuery = exports.AdminTrainingSession = exports.AdminTrainingTrainerListResponse = exports.AdminTrainingTrainerListQuery = exports.AdminTrainingTrainer = exports.TrainingSessionTrainer = exports.RetireAdminTrainingVenueResult = exports.UpdateAdminTrainingVenue = exports.CreateAdminTrainingVenue = exports.AdminTrainingVenueListResponse = exports.AdminTrainingVenueListQuery = exports.AdminTrainingVenue = exports.PublishAdminTrainingCourse = exports.UpdateAdminTrainingCourse = exports.CreateAdminTrainingCourse = exports.AdminTrainingCourseListResponse = exports.AdminTrainingCourseListQuery = exports.AdminTrainingCourse = exports.UNKNOWN_TRAINING_VERIFICATION = exports.TrainingVerification = exports.TrainingVerificationStatus = exports.TrainingCertificatePdfLink = exports.TrainingMeResponse = exports.TrainingMeQuery = exports.TrainingMyCertificate = exports.TrainingMyRegistration = exports.TrainingRegistrationResult = exports.CreateTrainingRegistration = exports.TrainingSessionDetail = exports.TrainingCourseListResponse = exports.TrainingCourseListQuery = exports.TrainingPublicCourse = exports.TrainingPublicSession = exports.TrainingVenueSummary = exports.TrainingAttendanceDecision = exports.TrainingRegistrationSource = exports.TrainingRegistrationStatus = exports.TrainingSessionStatus = void 0;
exports.TRAINING_FORBIDDEN_CLAIMS = exports.TRAINING_CREDENTIAL_WORDING = exports.AdminTrainingCertificateListResponse = exports.AdminTrainingCertificateListQuery = exports.AdminTrainingCertificate = exports.RevokeTrainingCertificate = exports.CloseTrainingRosterResult = void 0;
const zod_1 = require("zod");
const admin_1 = require("./admin");
const primitives_1 = require("./primitives");
/**
 * Training, live attendance and the digital certificate (ADR-049, F-S15).
 *
 * THE ONE THING THIS DOMAIN CLAIMS. A certificate here says "this named person
 * attended this live session of this module on this date" and nothing more. No
 * assessment happens, so no shape below carries a score, a pass mark, a grade
 * or a completion percentage, and AC-31 forbids the words qualified, passed and
 * certified competent from every surface that renders one. If a future change
 * wants the credential to mean more than attendance, it needs an assessment
 * first and its own decision record.
 *
 * THERE IS NO ONLINE SESSION. Deliberately, and structurally: no schema below
 * has a mode, a joining link, a meeting id or a recording url, and neither do
 * the tables. A session is a time, a venue and a trainer. Adding an online
 * session is a migration and a decision, never a field somebody slips in.
 *
 * PRICE WITHOUT COLLECTION. Every session carries `feeRwf` and every
 * registration copies it, and nothing in this build collects a franc:
 * `paid_at` is never written, and no shape here reports a payment state. The
 * public surface must therefore say in words that nothing is being charged
 * yet, because a price nobody is asked to pay is otherwise read as a price
 * already paid. ADR-049's follow-up owns deciding how it is collected.
 */
// ---------------------------------------------------------------------------
// Enumerations: the four new database enums, mirrored
// ---------------------------------------------------------------------------
/**
 * A session's life (schema `training_session_status`).
 *
 * `draft` is a trainer's proposal and is invisible to the public. `published`
 * is the only state `/training` ever shows. `cancelled` is terminal.
 * `completed` is what closing the roster leaves behind.
 */
exports.TrainingSessionStatus = zod_1.z.enum([
    "draft",
    "published",
    "cancelled",
    "completed",
]);
/**
 * A registration's life (schema `training_registration_status`).
 *
 * `released` and `withdrawn` are different facts and must stay different
 * words: `withdrawn` is the learner pulling out, `released` is the company
 * cancelling the session under them. Reading one as the other would tell a
 * person they changed their mind when they did not.
 */
exports.TrainingRegistrationStatus = zod_1.z.enum([
    "registered",
    "attended",
    "absent",
    "withdrawn",
    "released",
]);
/** How a registration came to exist (schema `training_registration_source`). */
exports.TrainingRegistrationSource = zod_1.z.enum(["self", "walk_in"]);
/**
 * One trainer's decision about one registrant (schema
 * `training_attendance_decision`).
 *
 * Only two values, and no `unknown`: a registrant with no decision has no row,
 * which is not the same as a row saying nothing. Closing the roster is what
 * turns every absence of a row into an `absent` row.
 */
exports.TrainingAttendanceDecision = zod_1.z.enum(["present", "absent"]);
// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------
/**
 * The one paged-answer shape, borrowed from `admin.ts`.
 *
 * The `Admin` in the name is now wrong for a public list, and it is still the
 * right thing to import: this package has exactly one definition of
 * `{ items, meta }`, and a second spelling of it for the sake of a better
 * prefix would be a new fact carrying no new meaning. Renaming it is a
 * cross-package change and belongs to whoever does that sweep.
 */
const listOf = (item) => zod_1.z.object({ items: zod_1.z.array(item), meta: admin_1.AdminListMeta });
/** Paging query params, coerced because they arrive as strings on a query string. */
const pageQuery = {
    page: zod_1.z.coerce.number().int().positive().optional(),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).optional(),
};
/**
 * A place training happens, as any reader of a session sees it.
 *
 * Carries the district AND the province name, because "Musanze" is only useful
 * to somebody who already knows which province it is in, and the person
 * deciding whether to travel is exactly the person who might not.
 */
exports.TrainingVenueSummary = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    address: zod_1.z.string(),
    districtId: zod_1.z.number().int().positive(),
    districtName: zod_1.z.string(),
    provinceId: zod_1.z.number().int().positive(),
    provinceName: zod_1.z.string(),
    /** The Injishi office is one row in the venue list, flagged, not special-cased. */
    isOffice: zod_1.z.boolean(),
});
// ---------------------------------------------------------------------------
// The public read path
// ---------------------------------------------------------------------------
/**
 * A published session as `/training` shows it.
 *
 * `seatsRemaining` may go NEGATIVE, and that is the honest rendering of an
 * advisory seat count (AC-5): registration past the count succeeds, so a
 * clamped zero would hide an over-subscribed session from the only person who
 * needs to know about it. The page warns before the commit; nothing prevents.
 */
exports.TrainingPublicSession = zod_1.z.object({
    id: primitives_1.Uuid,
    courseId: primitives_1.Uuid,
    startsAt: zod_1.z.string(),
    endsAt: zod_1.z.string(),
    venue: exports.TrainingVenueSummary,
    feeRwf: primitives_1.RwfAmount,
    currency: primitives_1.Currency,
    seatCount: zod_1.z.number().int().nonnegative(),
    registrationCount: zod_1.z.number().int().nonnegative(),
    seatsRemaining: zod_1.z.number().int(),
    /** True once `registrationCount` has reached `seatCount`. The page's warning. */
    isOverSubscribed: zod_1.z.boolean(),
});
/** A published course and every published, not cancelled session under it. */
exports.TrainingPublicCourse = zod_1.z.object({
    id: primitives_1.Uuid,
    slug: zod_1.z.string(),
    title: zod_1.z.string(),
    summary: zod_1.z.string(),
    version: zod_1.z.number().int().positive(),
    sessions: zod_1.z.array(exports.TrainingPublicSession),
});
/** Query params for `GET /api/v1/training/courses`. */
exports.TrainingCourseListQuery = zod_1.z.object({ ...pageQuery });
exports.TrainingCourseListResponse = listOf(exports.TrainingPublicCourse);
/** What `GET /api/v1/training/sessions/:id` answers. Unpublished is a 404. */
exports.TrainingSessionDetail = exports.TrainingPublicSession.extend({
    course: zod_1.z.object({
        id: primitives_1.Uuid,
        slug: zod_1.z.string(),
        title: zod_1.z.string(),
        summary: zod_1.z.string(),
        version: zod_1.z.number().int().positive(),
    }),
});
// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------
/**
 * What a person sends to register (`POST /api/v1/training/registrations`).
 *
 * NO `email` FIELD, on purpose. The address is taken from the Better Auth
 * session, because an address typed into a form is an address the sender does
 * not have to own, and this request is what a certificate eventually hangs
 * from. The registration still stores what it resolved, as a record of the day
 * (AC-3); every mail goes to the account's address as it stands at send time
 * (AC-20), never to that snapshot.
 *
 * The business is named exactly one way, and the refinement below is the
 * client-side half of a database CHECK, never a replacement for it.
 */
exports.CreateTrainingRegistration = zod_1.z
    .object({
    sessionId: primitives_1.Uuid,
    fullName: zod_1.z.string().trim().min(2).max(160),
    /** E.164. Normalised by the caller through `@injishi/auth`'s helper. */
    phone: zod_1.z.string().trim().min(8).max(20),
    /** An org the caller already holds, from `GET /api/v1/me/workspaces`. */
    orgId: primitives_1.Uuid.optional(),
    /** Free text, for somebody whose business is not on the platform. */
    businessName: zod_1.z.string().trim().min(2).max(200).optional(),
})
    .refine((v) => (v.orgId === undefined) !== (v.businessName === undefined), {
    message: "Name your business exactly one way: pick one you already hold, or type its name.",
    path: ["businessName"],
});
/**
 * What registering answers.
 *
 * `alreadyRegistered` is carried rather than inferred from a status code
 * because AC-4 makes the second attempt a SUCCESS that returns the first
 * registration. A caller that cannot tell the two apart either says "you are
 * registered" twice or reports an error for a thing that worked.
 */
exports.TrainingRegistrationResult = zod_1.z.object({
    registrationId: primitives_1.Uuid,
    status: exports.TrainingRegistrationStatus,
    alreadyRegistered: zod_1.z.boolean(),
    /** Copied from the session at registration. Collected by nothing yet. */
    feeRwf: primitives_1.RwfAmount,
    currency: primitives_1.Currency,
});
/** One of my registrations, as `GET /api/v1/training/me` lists it. */
exports.TrainingMyRegistration = zod_1.z.object({
    id: primitives_1.Uuid,
    status: exports.TrainingRegistrationStatus,
    source: exports.TrainingRegistrationSource,
    registeredAt: zod_1.z.string(),
    feeRwf: primitives_1.RwfAmount,
    currency: primitives_1.Currency,
    session: zod_1.z.object({
        id: primitives_1.Uuid,
        startsAt: zod_1.z.string(),
        endsAt: zod_1.z.string(),
        status: exports.TrainingSessionStatus,
        venue: exports.TrainingVenueSummary,
    }),
    course: zod_1.z.object({ id: primitives_1.Uuid, title: zod_1.z.string(), slug: zod_1.z.string() }),
    /** Set only once a trainer ticked them present. */
    certificateId: primitives_1.Uuid.nullable(),
});
/**
 * One of my certificates.
 *
 * Every field is read off the certificate row, never joined to a live profile
 * (AC-14). A person who changes their name keeps a certificate naming who
 * attended on the day, which is the only claim it was ever making.
 */
exports.TrainingMyCertificate = zod_1.z.object({
    id: primitives_1.Uuid,
    serial: zod_1.z.string(),
    /** The absolute URL a stranger scans. Also what the QR on the PDF encodes. */
    verifyUrl: zod_1.z.string(),
    courseTitle: zod_1.z.string(),
    courseVersion: zod_1.z.number().int().positive(),
    holderName: zod_1.z.string(),
    sessionDate: zod_1.z.string(),
    venueName: zod_1.z.string(),
    districtName: zod_1.z.string(),
    leadTrainerName: zod_1.z.string(),
    issuedAt: zod_1.z.string(),
    revokedAt: zod_1.z.string().nullable(),
    revocationReason: zod_1.z.string().nullable(),
    /** False when the PDF is still being rendered or failed to store. */
    hasPdf: zod_1.z.boolean(),
});
/** Query params for `GET /api/v1/training/me`. */
exports.TrainingMeQuery = zod_1.z.object({ ...pageQuery });
/** What `GET /api/v1/training/me` answers. Both halves page. */
exports.TrainingMeResponse = zod_1.z.object({
    registrations: listOf(exports.TrainingMyRegistration),
    certificates: listOf(exports.TrainingMyCertificate),
});
/**
 * What `GET /api/v1/training/certificates/:id/pdf` answers.
 *
 * A URL with an expiry, never the bytes. `expiresInSeconds` is reported so a
 * client can re-ask rather than hand a stale link to a download that starts a
 * minute later; AC-13 caps it at 900.
 */
exports.TrainingCertificatePdfLink = zod_1.z.object({
    url: zod_1.z.string(),
    expiresInSeconds: zod_1.z.number().int().positive().max(900),
});
// ---------------------------------------------------------------------------
// Public verification
// ---------------------------------------------------------------------------
/** Whether the code names a live certificate, a withdrawn one, or nothing. */
exports.TrainingVerificationStatus = zod_1.z.enum([
    "valid",
    "revoked",
    "unknown",
]);
/**
 * What `GET /api/v1/verify/:token` answers, to anybody, with no session.
 *
 * ONE SHAPE FOR ALL THREE ANSWERS (AC-16). A valid token, a revoked token and
 * a token that never existed all return 200 and this object. That is not
 * tidiness: a 404 for an unknown token turns this endpoint into an oracle
 * confirming which tokens are real, and somebody working through a list of
 * guesses only needs to know which ones landed. So the shape never varies and
 * only `status` says anything.
 *
 * The descriptive fields are null when there is nothing to describe, and a
 * client must render its answer from `status` alone rather than from which
 * fields came back empty.
 *
 * NO BUSINESS NAME, ever (AC-12). The certificate is about a person attending;
 * naming their employer to every stranger who scans a piece of paper is a
 * disclosure the credential does not need to make.
 */
exports.TrainingVerification = zod_1.z.object({
    status: exports.TrainingVerificationStatus,
    serial: zod_1.z.string().nullable(),
    holderName: zod_1.z.string().nullable(),
    courseTitle: zod_1.z.string().nullable(),
    courseVersion: zod_1.z.number().int().positive().nullable(),
    sessionDate: zod_1.z.string().nullable(),
    venueName: zod_1.z.string().nullable(),
    districtName: zod_1.z.string().nullable(),
    leadTrainerName: zod_1.z.string().nullable(),
    issuedAt: zod_1.z.string().nullable(),
    revokedAt: zod_1.z.string().nullable(),
});
/** The one answer for a code that names nothing. Defined once so it cannot drift. */
exports.UNKNOWN_TRAINING_VERIFICATION = {
    status: "unknown",
    serial: null,
    holderName: null,
    courseTitle: null,
    courseVersion: null,
    sessionDate: null,
    venueName: null,
    districtName: null,
    leadTrainerName: null,
    issuedAt: null,
    revokedAt: null,
};
// ---------------------------------------------------------------------------
// The admin console: courses
// ---------------------------------------------------------------------------
/** A course as staff see it, drafts included. */
exports.AdminTrainingCourse = zod_1.z.object({
    id: primitives_1.Uuid,
    slug: zod_1.z.string(),
    title: zod_1.z.string(),
    summary: zod_1.z.string(),
    version: zod_1.z.number().int().positive(),
    isPublished: zod_1.z.boolean(),
    sessionCount: zod_1.z.number().int().nonnegative(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
});
exports.AdminTrainingCourseListQuery = zod_1.z.object({ ...pageQuery });
exports.AdminTrainingCourseListResponse = listOf(exports.AdminTrainingCourse);
/**
 * Creating a course.
 *
 * The slug is the stable public handle and is taken rather than derived from
 * the title, because a title gets corrected and a URL somebody printed must
 * not move when it does.
 */
exports.CreateAdminTrainingCourse = zod_1.z.object({
    slug: zod_1.z
        .string()
        .trim()
        .min(2)
        .max(80)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "A slug is lower case words joined by single hyphens."),
    title: zod_1.z.string().trim().min(2).max(200),
    summary: zod_1.z.string().trim().min(2).max(2000),
});
/**
 * Editing a course.
 *
 * `bumpVersion` is explicit rather than automatic on any edit. The version is
 * printed on certificates and means "this is the syllabus they sat through",
 * so fixing a typo must not claim a new one was taught. Whoever edits decides
 * which kind of change they just made.
 */
exports.UpdateAdminTrainingCourse = zod_1.z.object({
    title: zod_1.z.string().trim().min(2).max(200).optional(),
    summary: zod_1.z.string().trim().min(2).max(2000).optional(),
    bumpVersion: zod_1.z.boolean().optional(),
});
/** Publishing or unpublishing a course. Several may be published at once (AC-30). */
exports.PublishAdminTrainingCourse = zod_1.z.object({ published: zod_1.z.boolean() });
// ---------------------------------------------------------------------------
// The admin console: venues
// ---------------------------------------------------------------------------
/** A venue as staff see it, retired ones included when asked for. */
exports.AdminTrainingVenue = exports.TrainingVenueSummary.extend({
    retiredAt: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
exports.AdminTrainingVenueListQuery = zod_1.z.object({
    includeRetired: zod_1.z.coerce.boolean().optional(),
    ...pageQuery,
});
exports.AdminTrainingVenueListResponse = listOf(exports.AdminTrainingVenue);
/**
 * Creating a venue.
 *
 * `districtId` is an integer smart code from the geography reference data (D11)
 * and carries its province, so no province is sent: accepting both would let a
 * caller claim a district is somewhere it is not.
 */
exports.CreateAdminTrainingVenue = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(200),
    address: zod_1.z.string().trim().min(2).max(400),
    districtId: zod_1.z.coerce.number().int().positive(),
    isOffice: zod_1.z.boolean().optional(),
});
exports.UpdateAdminTrainingVenue = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(200).optional(),
    address: zod_1.z.string().trim().min(2).max(400).optional(),
    districtId: zod_1.z.coerce.number().int().positive().optional(),
    isOffice: zod_1.z.boolean().optional(),
});
/**
 * What retiring a venue answers.
 *
 * `draftsNowBlocked` is counted and reported because retiring is one way and
 * would otherwise be silent: the person retiring a hall should be told, then
 * and there, that three drafted sessions can no longer be published at it.
 */
exports.RetireAdminTrainingVenueResult = zod_1.z.object({
    venue: exports.AdminTrainingVenue,
    draftsNowBlocked: zod_1.z.number().int().nonnegative(),
});
// ---------------------------------------------------------------------------
// The admin console: sessions
// ---------------------------------------------------------------------------
/** A trainer on a session. The lead's name is what a certificate prints. */
exports.TrainingSessionTrainer = zod_1.z.object({
    userId: primitives_1.Uuid,
    name: zod_1.z.string(),
    isLead: zod_1.z.boolean(),
});
/**
 * A person a session form may offer as a lead or co trainer: live staff
 * holding the `trainer` role (AC-7, AC-24).
 *
 * THREE FIELDS AND NO MORE. The list is readable with `training.view`, which a
 * trainer holds, so one trainer can read every other trainer's entry. What a
 * picker needs to tell two people apart is a name and an email; phone, roles,
 * grant history and anything else from `admin_users` stay out of the shape, so
 * widening what is disclosed is a contract change somebody has to make on
 * purpose rather than a column a query happened to select.
 *
 * `name` is nullable because `users.name` is until a profile is filled in. It
 * is passed through as null rather than replaced with the email, because the
 * email is already beside it and a screen can choose its own fallback.
 */
exports.AdminTrainingTrainer = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string().nullable(),
    email: zod_1.z.string(),
});
exports.AdminTrainingTrainerListQuery = zod_1.z.object({ ...pageQuery });
exports.AdminTrainingTrainerListResponse = listOf(exports.AdminTrainingTrainer);
/** A session as staff see it, drafts and cancellations included. */
exports.AdminTrainingSession = zod_1.z.object({
    id: primitives_1.Uuid,
    status: exports.TrainingSessionStatus,
    course: zod_1.z.object({
        id: primitives_1.Uuid,
        title: zod_1.z.string(),
        slug: zod_1.z.string(),
        version: zod_1.z.number().int().positive(),
        isPublished: zod_1.z.boolean(),
    }),
    venue: exports.AdminTrainingVenue,
    startsAt: zod_1.z.string(),
    endsAt: zod_1.z.string(),
    feeRwf: primitives_1.RwfAmount,
    currency: primitives_1.Currency,
    seatCount: zod_1.z.number().int().nonnegative(),
    registrationCount: zod_1.z.number().int().nonnegative(),
    trainers: zod_1.z.array(exports.TrainingSessionTrainer),
    publishedAt: zod_1.z.string().nullable(),
    cancelledAt: zod_1.z.string().nullable(),
    cancellationReason: zod_1.z.string().nullable(),
    rescheduledFrom: zod_1.z.string().nullable(),
    rosterClosedAt: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
exports.AdminTrainingSessionListQuery = zod_1.z.object({
    status: exports.TrainingSessionStatus.optional(),
    courseId: primitives_1.Uuid.optional(),
    ...pageQuery,
});
exports.AdminTrainingSessionListResponse = listOf(exports.AdminTrainingSession);
/**
 * Drafting a session.
 *
 * `venueId` is PICKED from the active venue list and never typed (AC-32), and
 * `leadTrainerId` is required here rather than defaulted to the caller: a
 * platform admin drafts sessions they will not teach, and a session whose lead
 * is whoever happened to fill the form is a certificate signed by the wrong
 * name.
 */
exports.CreateAdminTrainingSession = zod_1.z
    .object({
    courseId: primitives_1.Uuid,
    venueId: primitives_1.Uuid,
    startsAt: zod_1.z.string().datetime({ offset: true }),
    endsAt: zod_1.z.string().datetime({ offset: true }),
    feeRwf: primitives_1.RwfAmount,
    seatCount: zod_1.z.number().int().nonnegative().max(10000),
    leadTrainerId: primitives_1.Uuid,
    coTrainerIds: zod_1.z.array(primitives_1.Uuid).max(20).optional(),
})
    .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
    message: "A session has to end after it starts.",
    path: ["endsAt"],
})
    .refine((v) => !(v.coTrainerIds ?? []).includes(v.leadTrainerId), {
    message: "The lead trainer is already on the session.",
    path: ["coTrainerIds"],
});
/**
 * Editing a session.
 *
 * Moving `startsAt` on a PUBLISHED session is a reschedule and needs a reason,
 * because every registrant is mailed it. The API enforces that pairing; this
 * shape only carries it.
 */
exports.UpdateAdminTrainingSession = zod_1.z.object({
    venueId: primitives_1.Uuid.optional(),
    startsAt: zod_1.z.string().datetime({ offset: true }).optional(),
    endsAt: zod_1.z.string().datetime({ offset: true }).optional(),
    feeRwf: primitives_1.RwfAmount.optional(),
    seatCount: zod_1.z.number().int().nonnegative().max(10000).optional(),
    leadTrainerId: primitives_1.Uuid.optional(),
    coTrainerIds: zod_1.z.array(primitives_1.Uuid).max(20).optional(),
    rescheduleReason: zod_1.z.string().trim().min(3).max(500).optional(),
});
/** Cancelling a session. The reason is required and is mailed to every registrant. */
exports.CancelAdminTrainingSession = zod_1.z.object({
    reason: zod_1.z.string().trim().min(3).max(500),
});
/**
 * What cancelling answers.
 *
 * `releasedCount` excludes anybody already marked present (AC-21). Somebody
 * who attended a session that was later cancelled still attended it, and still
 * holds their certificate.
 */
exports.CancelAdminTrainingSessionResult = zod_1.z.object({
    session: exports.AdminTrainingSession,
    releasedCount: zod_1.z.number().int().nonnegative(),
    keptAttendedCount: zod_1.z.number().int().nonnegative(),
});
// ---------------------------------------------------------------------------
// The admin console: the roster and the tick
// ---------------------------------------------------------------------------
/**
 * One registrant on a roster, with the decision that currently stands.
 *
 * `latestDecision` is the newest row of an append-only table, never a column
 * that got overwritten (AC-11). `decisionCount` is carried so a trainer can see
 * that a person was ticked twice and the second tick won, rather than
 * wondering whether the first one registered at all.
 */
exports.TrainingRosterEntry = zod_1.z.object({
    registrationId: primitives_1.Uuid,
    userId: primitives_1.Uuid,
    fullName: zod_1.z.string(),
    /** The address given at registration. A record of the day, not a mailbox. */
    email: zod_1.z.string(),
    phone: zod_1.z.string(),
    orgId: primitives_1.Uuid.nullable(),
    businessName: zod_1.z.string().nullable(),
    status: exports.TrainingRegistrationStatus,
    source: exports.TrainingRegistrationSource,
    registeredAt: zod_1.z.string(),
    latestDecision: exports.TrainingAttendanceDecision.nullable(),
    latestDecisionAt: zod_1.z.string().nullable(),
    decisionCount: zod_1.z.number().int().nonnegative(),
    certificateId: primitives_1.Uuid.nullable(),
    certificateSerial: zod_1.z.string().nullable(),
    certificateRevokedAt: zod_1.z.string().nullable(),
});
exports.TrainingRosterQuery = zod_1.z.object({ ...pageQuery });
exports.TrainingRosterResponse = listOf(exports.TrainingRosterEntry);
/**
 * Adding a walk-in.
 *
 * The email is typed HERE and only here, because the person it names is
 * standing in the room and has no session to read it from. It is matched
 * against existing accounts rather than used to make a new one (AC-8): a walk
 * in who already has an Injishi account must end up with one account, not two,
 * or their certificate lands on an identity they cannot sign in to.
 */
exports.CreateTrainingWalkIn = zod_1.z
    .object({
    fullName: zod_1.z.string().trim().min(2).max(160),
    email: zod_1.z.string().trim().toLowerCase().email().max(254),
    phone: zod_1.z.string().trim().min(8).max(20),
    orgId: primitives_1.Uuid.optional(),
    businessName: zod_1.z.string().trim().min(2).max(200).optional(),
})
    .refine((v) => (v.orgId === undefined) !== (v.businessName === undefined), {
    message: "Name their business exactly one way.",
    path: ["businessName"],
});
exports.TrainingWalkInResult = zod_1.z.object({
    registrationId: primitives_1.Uuid,
    source: zod_1.z.literal("walk_in"),
    /** True when the email matched an account that already existed. */
    linkedExistingUser: zod_1.z.boolean(),
});
/**
 * The tick.
 *
 * `idempotencyKey` is REQUIRED, not optional (AC-9). Marking somebody present
 * mints a certificate, and a trainer on a bad connection taps twice. Without a
 * key the second tap issues a second certificate with its own serial, and a
 * serial is a thing that gets printed and read down a phone line, so there is
 * no tidying that up afterwards.
 */
exports.RecordTrainingAttendance = zod_1.z.object({
    decision: exports.TrainingAttendanceDecision,
    reason: zod_1.z.string().trim().min(1).max(500).optional(),
    idempotencyKey: zod_1.z.string().trim().min(8).max(200),
});
/**
 * What the tick answers.
 *
 * `certificateId` is null for an absent decision and for a replayed present
 * decision that issued nothing new. `issuedNow` separates "there is a
 * certificate" from "this call made it", which is what lets a client confirm
 * once rather than on every retry.
 */
exports.RecordTrainingAttendanceResult = zod_1.z.object({
    decisionId: primitives_1.Uuid,
    registrationStatus: exports.TrainingRegistrationStatus,
    certificateId: primitives_1.Uuid.nullable(),
    certificateSerial: zod_1.z.string().nullable(),
    issuedNow: zod_1.z.boolean(),
});
/** What closing a roster answers. One action, every undecided person (AC-10). */
exports.CloseTrainingRosterResult = zod_1.z.object({
    markedAbsent: zod_1.z.number().int().nonnegative(),
    rosterClosedAt: zod_1.z.string(),
});
// ---------------------------------------------------------------------------
// The admin console: revocation
// ---------------------------------------------------------------------------
/**
 * Withdrawing a certificate.
 *
 * The reason is required and is written to the audit log (AC-22). A credential
 * that can be withdrawn silently is a credential nobody can rely on having
 * been withdrawn for cause.
 */
exports.RevokeTrainingCertificate = zod_1.z.object({
    reason: zod_1.z.string().trim().min(3).max(500),
});
/** A certificate as staff see it. The row is never deleted (AC-23). */
exports.AdminTrainingCertificate = zod_1.z.object({
    id: primitives_1.Uuid,
    serial: zod_1.z.string(),
    registrationId: primitives_1.Uuid,
    sessionId: primitives_1.Uuid,
    holderName: zod_1.z.string(),
    holderUserId: primitives_1.Uuid,
    courseTitle: zod_1.z.string(),
    courseVersion: zod_1.z.number().int().positive(),
    sessionDate: zod_1.z.string(),
    venueName: zod_1.z.string(),
    districtName: zod_1.z.string(),
    leadTrainerName: zod_1.z.string(),
    issuedAt: zod_1.z.string(),
    issuedBy: primitives_1.Uuid,
    revokedAt: zod_1.z.string().nullable(),
    revokedBy: primitives_1.Uuid.nullable(),
    revocationReason: zod_1.z.string().nullable(),
    hasPdf: zod_1.z.boolean(),
});
exports.AdminTrainingCertificateListQuery = zod_1.z.object({
    sessionId: primitives_1.Uuid.optional(),
    ...pageQuery,
});
exports.AdminTrainingCertificateListResponse = listOf(exports.AdminTrainingCertificate);
// ---------------------------------------------------------------------------
// Wording, so every surface says the same honest thing
// ---------------------------------------------------------------------------
/**
 * The words a certificate is allowed to use about itself (AC-31).
 *
 * Held here rather than typed into three templates, because the constraint is
 * one fact about what the credential means and it has to hold on the PDF, the
 * holder's page and the public verification page at once. Nothing here reads
 * qualified, passed or certified competent: no assessment took place, and the
 * wording is the only thing keeping the paper honest about that.
 */
exports.TRAINING_CREDENTIAL_WORDING = {
    /** The line under the holder's name on the PDF. */
    pdfClaim: "attended this live training session",
    /** What the public page says about a certificate that stands. */
    verifiedClaim: "This certificate is genuine. The person named attended the live session below.",
    /** What the public page says about one that was withdrawn. */
    revokedClaim: "This certificate has been withdrawn and should not be relied on.",
    /** What the public page says about a code that names nothing. */
    unknownClaim: "We cannot confirm a certificate from this code.",
    /** The honest label for a session price that nothing collects yet. */
    feeNotice: "Nothing is collected online yet. The session fee is shown so you know what it is.",
};
/**
 * The words that must never appear on a training credential surface (AC-31).
 *
 * A list rather than a comment, so the wording pass can be checked mechanically
 * instead of read for. Every entry is a claim about competence, and this
 * credential is a claim about attendance.
 */
exports.TRAINING_FORBIDDEN_CLAIMS = [
    "qualified",
    "passed",
    "certified competent",
    "competent",
    "accredited",
    "licensed",
];
//# sourceMappingURL=training.js.map