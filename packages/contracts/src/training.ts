import { z } from "zod";
import { AdminListMeta } from "./admin";
import { Currency, RwfAmount, Uuid } from "./primitives";
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
export const TrainingSessionStatus = z.enum([
    "draft",
    "published",
    "cancelled",
    "completed",
]);
export type TrainingSessionStatus = z.infer<typeof TrainingSessionStatus>;
/**
 * A registration's life (schema `training_registration_status`).
 *
 * `released` and `withdrawn` are different facts and must stay different
 * words: `withdrawn` is the learner pulling out, `released` is the company
 * cancelling the session under them. Reading one as the other would tell a
 * person they changed their mind when they did not.
 */
export const TrainingRegistrationStatus = z.enum([
    "registered",
    "attended",
    "absent",
    "withdrawn",
    "released",
]);
export type TrainingRegistrationStatus = z.infer<
    typeof TrainingRegistrationStatus
>;
/** How a registration came to exist (schema `training_registration_source`). */
export const TrainingRegistrationSource = z.enum(["self", "walk_in"]);
export type TrainingRegistrationSource = z.infer<
    typeof TrainingRegistrationSource
>;
/**
 * One trainer's decision about one registrant (schema
 * `training_attendance_decision`).
 *
 * Only two values, and no `unknown`: a registrant with no decision has no row,
 * which is not the same as a row saying nothing. Closing the roster is what
 * turns every absence of a row into an `absent` row.
 */
export const TrainingAttendanceDecision = z.enum(["present", "absent"]);
export type TrainingAttendanceDecision = z.infer<
    typeof TrainingAttendanceDecision
>;
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
const listOf = <T extends z.ZodTypeAny>(item: T) =>
    z.object({ items: z.array(item), meta: AdminListMeta });
/** Paging query params, coerced because they arrive as strings on a query string. */
const pageQuery = {
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(100).optional(),
};
/**
 * A place training happens, as any reader of a session sees it.
 *
 * Carries the district AND the province name, because "Musanze" is only useful
 * to somebody who already knows which province it is in, and the person
 * deciding whether to travel is exactly the person who might not.
 */
export const TrainingVenueSummary = z.object({
    id: Uuid,
    name: z.string(),
    address: z.string(),
    districtId: z.number().int().positive(),
    districtName: z.string(),
    provinceId: z.number().int().positive(),
    provinceName: z.string(),
    /** The Injishi office is one row in the venue list, flagged, not special-cased. */
    isOffice: z.boolean(),
});
export type TrainingVenueSummary = z.infer<typeof TrainingVenueSummary>;
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
export const TrainingPublicSession = z.object({
    id: Uuid,
    courseId: Uuid,
    startsAt: z.string(),
    endsAt: z.string(),
    venue: TrainingVenueSummary,
    feeRwf: RwfAmount,
    currency: Currency,
    seatCount: z.number().int().nonnegative(),
    registrationCount: z.number().int().nonnegative(),
    seatsRemaining: z.number().int(),
    /** True once `registrationCount` has reached `seatCount`. The page's warning. */
    isOverSubscribed: z.boolean(),
});
export type TrainingPublicSession = z.infer<typeof TrainingPublicSession>;
/** A published course and every published, not cancelled session under it. */
export const TrainingPublicCourse = z.object({
    id: Uuid,
    slug: z.string(),
    title: z.string(),
    summary: z.string(),
    version: z.number().int().positive(),
    sessions: z.array(TrainingPublicSession),
});
export type TrainingPublicCourse = z.infer<typeof TrainingPublicCourse>;
/** Query params for `GET /api/v1/training/courses`. */
export const TrainingCourseListQuery = z.object({ ...pageQuery });
export type TrainingCourseListQuery = z.infer<typeof TrainingCourseListQuery>;
export const TrainingCourseListResponse = listOf(TrainingPublicCourse);
export type TrainingCourseListResponse = z.infer<
    typeof TrainingCourseListResponse
>;
/** What `GET /api/v1/training/sessions/:id` answers. Unpublished is a 404. */
export const TrainingSessionDetail = TrainingPublicSession.extend({
    course: z.object({
        id: Uuid,
        slug: z.string(),
        title: z.string(),
        summary: z.string(),
        version: z.number().int().positive(),
    }),
});
export type TrainingSessionDetail = z.infer<typeof TrainingSessionDetail>;
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
export const CreateTrainingRegistration = z
    .object({
        sessionId: Uuid,
        fullName: z.string().trim().min(2).max(160),
        /** E.164. Normalised by the caller through `@injishi/auth`'s helper. */
        phone: z.string().trim().min(8).max(20),
        /** An org the caller already holds, from `GET /api/v1/me/workspaces`. */
        orgId: Uuid.optional(),
        /** Free text, for somebody whose business is not on the platform. */
        businessName: z.string().trim().min(2).max(200).optional(),
    })
    .refine((v) => (v.orgId === undefined) !== (v.businessName === undefined), {
        message:
            "Name your business exactly one way: pick one you already hold, or type its name.",
        path: ["businessName"],
    });
export type CreateTrainingRegistration = z.infer<
    typeof CreateTrainingRegistration
>;
/**
 * What registering answers.
 *
 * `alreadyRegistered` is carried rather than inferred from a status code
 * because AC-4 makes the second attempt a SUCCESS that returns the first
 * registration. A caller that cannot tell the two apart either says "you are
 * registered" twice or reports an error for a thing that worked.
 */
export const TrainingRegistrationResult = z.object({
    registrationId: Uuid,
    status: TrainingRegistrationStatus,
    alreadyRegistered: z.boolean(),
    /** Copied from the session at registration. Collected by nothing yet. */
    feeRwf: RwfAmount,
    currency: Currency,
});
export type TrainingRegistrationResult = z.infer<
    typeof TrainingRegistrationResult
>;
/** One of my registrations, as `GET /api/v1/training/me` lists it. */
export const TrainingMyRegistration = z.object({
    id: Uuid,
    status: TrainingRegistrationStatus,
    source: TrainingRegistrationSource,
    registeredAt: z.string(),
    feeRwf: RwfAmount,
    currency: Currency,
    session: z.object({
        id: Uuid,
        startsAt: z.string(),
        endsAt: z.string(),
        status: TrainingSessionStatus,
        venue: TrainingVenueSummary,
    }),
    course: z.object({ id: Uuid, title: z.string(), slug: z.string() }),
    /** Set only once a trainer ticked them present. */
    certificateId: Uuid.nullable(),
});
export type TrainingMyRegistration = z.infer<typeof TrainingMyRegistration>;
/**
 * One of my certificates.
 *
 * Every field is read off the certificate row, never joined to a live profile
 * (AC-14). A person who changes their name keeps a certificate naming who
 * attended on the day, which is the only claim it was ever making.
 */
export const TrainingMyCertificate = z.object({
    id: Uuid,
    serial: z.string(),
    /** The absolute URL a stranger scans. Also what the QR on the PDF encodes. */
    verifyUrl: z.string(),
    courseTitle: z.string(),
    courseVersion: z.number().int().positive(),
    holderName: z.string(),
    sessionDate: z.string(),
    venueName: z.string(),
    districtName: z.string(),
    leadTrainerName: z.string(),
    issuedAt: z.string(),
    revokedAt: z.string().nullable(),
    revocationReason: z.string().nullable(),
    /** False when the PDF is still being rendered or failed to store. */
    hasPdf: z.boolean(),
});
export type TrainingMyCertificate = z.infer<typeof TrainingMyCertificate>;
/** Query params for `GET /api/v1/training/me`. */
export const TrainingMeQuery = z.object({ ...pageQuery });
export type TrainingMeQuery = z.infer<typeof TrainingMeQuery>;
/** What `GET /api/v1/training/me` answers. Both halves page. */
export const TrainingMeResponse = z.object({
    registrations: listOf(TrainingMyRegistration),
    certificates: listOf(TrainingMyCertificate),
});
export type TrainingMeResponse = z.infer<typeof TrainingMeResponse>;
/**
 * What `GET /api/v1/training/certificates/:id/pdf` answers.
 *
 * A URL with an expiry, never the bytes. `expiresInSeconds` is reported so a
 * client can re-ask rather than hand a stale link to a download that starts a
 * minute later; AC-13 caps it at 900.
 */
export const TrainingCertificatePdfLink = z.object({
    url: z.string(),
    expiresInSeconds: z.number().int().positive().max(900),
});
export type TrainingCertificatePdfLink = z.infer<
    typeof TrainingCertificatePdfLink
>;
// ---------------------------------------------------------------------------
// Public verification
// ---------------------------------------------------------------------------
/** Whether the code names a live certificate, a withdrawn one, or nothing. */
export const TrainingVerificationStatus = z.enum([
    "valid",
    "revoked",
    "unknown",
]);
export type TrainingVerificationStatus = z.infer<
    typeof TrainingVerificationStatus
>;
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
export const TrainingVerification = z.object({
    status: TrainingVerificationStatus,
    serial: z.string().nullable(),
    holderName: z.string().nullable(),
    courseTitle: z.string().nullable(),
    courseVersion: z.number().int().positive().nullable(),
    sessionDate: z.string().nullable(),
    venueName: z.string().nullable(),
    districtName: z.string().nullable(),
    leadTrainerName: z.string().nullable(),
    issuedAt: z.string().nullable(),
    revokedAt: z.string().nullable(),
});
export type TrainingVerification = z.infer<typeof TrainingVerification>;
/** The one answer for a code that names nothing. Defined once so it cannot drift. */
export const UNKNOWN_TRAINING_VERIFICATION: TrainingVerification = {
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
export const AdminTrainingCourse = z.object({
    id: Uuid,
    slug: z.string(),
    title: z.string(),
    summary: z.string(),
    version: z.number().int().positive(),
    isPublished: z.boolean(),
    sessionCount: z.number().int().nonnegative(),
    createdAt: z.string(),
    updatedAt: z.string(),
});
export type AdminTrainingCourse = z.infer<typeof AdminTrainingCourse>;
export const AdminTrainingCourseListQuery = z.object({ ...pageQuery });
export type AdminTrainingCourseListQuery = z.infer<
    typeof AdminTrainingCourseListQuery
>;
export const AdminTrainingCourseListResponse = listOf(AdminTrainingCourse);
export type AdminTrainingCourseListResponse = z.infer<
    typeof AdminTrainingCourseListResponse
>;
/**
 * Creating a course.
 *
 * The slug is the stable public handle and is taken rather than derived from
 * the title, because a title gets corrected and a URL somebody printed must
 * not move when it does.
 */
export const CreateAdminTrainingCourse = z.object({
    slug: z
        .string()
        .trim()
        .min(2)
        .max(80)
        .regex(
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            "A slug is lower case words joined by single hyphens.",
        ),
    title: z.string().trim().min(2).max(200),
    summary: z.string().trim().min(2).max(2000),
});
export type CreateAdminTrainingCourse = z.infer<
    typeof CreateAdminTrainingCourse
>;
/**
 * Editing a course.
 *
 * `bumpVersion` is explicit rather than automatic on any edit. The version is
 * printed on certificates and means "this is the syllabus they sat through",
 * so fixing a typo must not claim a new one was taught. Whoever edits decides
 * which kind of change they just made.
 */
export const UpdateAdminTrainingCourse = z.object({
    title: z.string().trim().min(2).max(200).optional(),
    summary: z.string().trim().min(2).max(2000).optional(),
    bumpVersion: z.boolean().optional(),
});
export type UpdateAdminTrainingCourse = z.infer<
    typeof UpdateAdminTrainingCourse
>;
/** Publishing or unpublishing a course. Several may be published at once (AC-30). */
export const PublishAdminTrainingCourse = z.object({ published: z.boolean() });
export type PublishAdminTrainingCourse = z.infer<
    typeof PublishAdminTrainingCourse
>;
// ---------------------------------------------------------------------------
// The admin console: venues
// ---------------------------------------------------------------------------
/** A venue as staff see it, retired ones included when asked for. */
export const AdminTrainingVenue = TrainingVenueSummary.extend({
    retiredAt: z.string().nullable(),
    createdAt: z.string(),
});
export type AdminTrainingVenue = z.infer<typeof AdminTrainingVenue>;
export const AdminTrainingVenueListQuery = z.object({
    includeRetired: z.coerce.boolean().optional(),
    ...pageQuery,
});
export type AdminTrainingVenueListQuery = z.infer<
    typeof AdminTrainingVenueListQuery
>;
export const AdminTrainingVenueListResponse = listOf(AdminTrainingVenue);
export type AdminTrainingVenueListResponse = z.infer<
    typeof AdminTrainingVenueListResponse
>;
/**
 * Creating a venue.
 *
 * `districtId` is an integer smart code from the geography reference data (D11)
 * and carries its province, so no province is sent: accepting both would let a
 * caller claim a district is somewhere it is not.
 */
export const CreateAdminTrainingVenue = z.object({
    name: z.string().trim().min(2).max(200),
    address: z.string().trim().min(2).max(400),
    districtId: z.coerce.number().int().positive(),
    isOffice: z.boolean().optional(),
});
export type CreateAdminTrainingVenue = z.infer<typeof CreateAdminTrainingVenue>;
export const UpdateAdminTrainingVenue = z.object({
    name: z.string().trim().min(2).max(200).optional(),
    address: z.string().trim().min(2).max(400).optional(),
    districtId: z.coerce.number().int().positive().optional(),
    isOffice: z.boolean().optional(),
});
export type UpdateAdminTrainingVenue = z.infer<typeof UpdateAdminTrainingVenue>;
/**
 * What retiring a venue answers.
 *
 * `draftsNowBlocked` is counted and reported because retiring is one way and
 * would otherwise be silent: the person retiring a hall should be told, then
 * and there, that three drafted sessions can no longer be published at it.
 */
export const RetireAdminTrainingVenueResult = z.object({
    venue: AdminTrainingVenue,
    draftsNowBlocked: z.number().int().nonnegative(),
});
export type RetireAdminTrainingVenueResult = z.infer<
    typeof RetireAdminTrainingVenueResult
>;
// ---------------------------------------------------------------------------
// The admin console: sessions
// ---------------------------------------------------------------------------
/** A trainer on a session. The lead's name is what a certificate prints. */
export const TrainingSessionTrainer = z.object({
    userId: Uuid,
    name: z.string(),
    isLead: z.boolean(),
});
export type TrainingSessionTrainer = z.infer<typeof TrainingSessionTrainer>;
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
export const AdminTrainingTrainer = z.object({
    id: Uuid,
    name: z.string().nullable(),
    email: z.string(),
});
export type AdminTrainingTrainer = z.infer<typeof AdminTrainingTrainer>;
export const AdminTrainingTrainerListQuery = z.object({ ...pageQuery });
export type AdminTrainingTrainerListQuery = z.infer<
    typeof AdminTrainingTrainerListQuery
>;
export const AdminTrainingTrainerListResponse = listOf(AdminTrainingTrainer);
export type AdminTrainingTrainerListResponse = z.infer<
    typeof AdminTrainingTrainerListResponse
>;
/** A session as staff see it, drafts and cancellations included. */
export const AdminTrainingSession = z.object({
    id: Uuid,
    status: TrainingSessionStatus,
    course: z.object({
        id: Uuid,
        title: z.string(),
        slug: z.string(),
        version: z.number().int().positive(),
        isPublished: z.boolean(),
    }),
    venue: AdminTrainingVenue,
    startsAt: z.string(),
    endsAt: z.string(),
    feeRwf: RwfAmount,
    currency: Currency,
    seatCount: z.number().int().nonnegative(),
    registrationCount: z.number().int().nonnegative(),
    trainers: z.array(TrainingSessionTrainer),
    publishedAt: z.string().nullable(),
    cancelledAt: z.string().nullable(),
    cancellationReason: z.string().nullable(),
    rescheduledFrom: z.string().nullable(),
    rosterClosedAt: z.string().nullable(),
    createdAt: z.string(),
});
export type AdminTrainingSession = z.infer<typeof AdminTrainingSession>;
export const AdminTrainingSessionListQuery = z.object({
    status: TrainingSessionStatus.optional(),
    courseId: Uuid.optional(),
    ...pageQuery,
});
export type AdminTrainingSessionListQuery = z.infer<
    typeof AdminTrainingSessionListQuery
>;
export const AdminTrainingSessionListResponse = listOf(AdminTrainingSession);
export type AdminTrainingSessionListResponse = z.infer<
    typeof AdminTrainingSessionListResponse
>;
/**
 * Drafting a session.
 *
 * `venueId` is PICKED from the active venue list and never typed (AC-32), and
 * `leadTrainerId` is required here rather than defaulted to the caller: a
 * platform admin drafts sessions they will not teach, and a session whose lead
 * is whoever happened to fill the form is a certificate signed by the wrong
 * name.
 */
export const CreateAdminTrainingSession = z
    .object({
        courseId: Uuid,
        venueId: Uuid,
        startsAt: z.string().datetime({ offset: true }),
        endsAt: z.string().datetime({ offset: true }),
        feeRwf: RwfAmount,
        seatCount: z.number().int().nonnegative().max(10_000),
        leadTrainerId: Uuid,
        coTrainerIds: z.array(Uuid).max(20).optional(),
    })
    .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
        message: "A session has to end after it starts.",
        path: ["endsAt"],
    })
    .refine((v) => !(v.coTrainerIds ?? []).includes(v.leadTrainerId), {
        message: "The lead trainer is already on the session.",
        path: ["coTrainerIds"],
    });
export type CreateAdminTrainingSession = z.infer<
    typeof CreateAdminTrainingSession
>;
/**
 * Editing a session.
 *
 * Moving `startsAt` on a PUBLISHED session is a reschedule and needs a reason,
 * because every registrant is mailed it. The API enforces that pairing; this
 * shape only carries it.
 */
export const UpdateAdminTrainingSession = z.object({
    venueId: Uuid.optional(),
    startsAt: z.string().datetime({ offset: true }).optional(),
    endsAt: z.string().datetime({ offset: true }).optional(),
    feeRwf: RwfAmount.optional(),
    seatCount: z.number().int().nonnegative().max(10_000).optional(),
    leadTrainerId: Uuid.optional(),
    coTrainerIds: z.array(Uuid).max(20).optional(),
    rescheduleReason: z.string().trim().min(3).max(500).optional(),
});
export type UpdateAdminTrainingSession = z.infer<
    typeof UpdateAdminTrainingSession
>;
/** Cancelling a session. The reason is required and is mailed to every registrant. */
export const CancelAdminTrainingSession = z.object({
    reason: z.string().trim().min(3).max(500),
});
export type CancelAdminTrainingSession = z.infer<
    typeof CancelAdminTrainingSession
>;
/**
 * What cancelling answers.
 *
 * `releasedCount` excludes anybody already marked present (AC-21). Somebody
 * who attended a session that was later cancelled still attended it, and still
 * holds their certificate.
 */
export const CancelAdminTrainingSessionResult = z.object({
    session: AdminTrainingSession,
    releasedCount: z.number().int().nonnegative(),
    keptAttendedCount: z.number().int().nonnegative(),
});
export type CancelAdminTrainingSessionResult = z.infer<
    typeof CancelAdminTrainingSessionResult
>;
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
export const TrainingRosterEntry = z.object({
    registrationId: Uuid,
    userId: Uuid,
    fullName: z.string(),
    /** The address given at registration. A record of the day, not a mailbox. */
    email: z.string(),
    phone: z.string(),
    orgId: Uuid.nullable(),
    businessName: z.string().nullable(),
    status: TrainingRegistrationStatus,
    source: TrainingRegistrationSource,
    registeredAt: z.string(),
    latestDecision: TrainingAttendanceDecision.nullable(),
    latestDecisionAt: z.string().nullable(),
    decisionCount: z.number().int().nonnegative(),
    certificateId: Uuid.nullable(),
    certificateSerial: z.string().nullable(),
    certificateRevokedAt: z.string().nullable(),
});
export type TrainingRosterEntry = z.infer<typeof TrainingRosterEntry>;
export const TrainingRosterQuery = z.object({ ...pageQuery });
export type TrainingRosterQuery = z.infer<typeof TrainingRosterQuery>;
export const TrainingRosterResponse = listOf(TrainingRosterEntry);
export type TrainingRosterResponse = z.infer<typeof TrainingRosterResponse>;
/**
 * Adding a walk-in.
 *
 * The email is typed HERE and only here, because the person it names is
 * standing in the room and has no session to read it from. It is matched
 * against existing accounts rather than used to make a new one (AC-8): a walk
 * in who already has an Injishi account must end up with one account, not two,
 * or their certificate lands on an identity they cannot sign in to.
 */
export const CreateTrainingWalkIn = z
    .object({
        fullName: z.string().trim().min(2).max(160),
        email: z.string().trim().toLowerCase().email().max(254),
        phone: z.string().trim().min(8).max(20),
        orgId: Uuid.optional(),
        businessName: z.string().trim().min(2).max(200).optional(),
    })
    .refine((v) => (v.orgId === undefined) !== (v.businessName === undefined), {
        message: "Name their business exactly one way.",
        path: ["businessName"],
    });
export type CreateTrainingWalkIn = z.infer<typeof CreateTrainingWalkIn>;
export const TrainingWalkInResult = z.object({
    registrationId: Uuid,
    source: z.literal("walk_in"),
    /** True when the email matched an account that already existed. */
    linkedExistingUser: z.boolean(),
});
export type TrainingWalkInResult = z.infer<typeof TrainingWalkInResult>;
/**
 * The tick.
 *
 * `idempotencyKey` is REQUIRED, not optional (AC-9). Marking somebody present
 * mints a certificate, and a trainer on a bad connection taps twice. Without a
 * key the second tap issues a second certificate with its own serial, and a
 * serial is a thing that gets printed and read down a phone line, so there is
 * no tidying that up afterwards.
 */
export const RecordTrainingAttendance = z.object({
    decision: TrainingAttendanceDecision,
    reason: z.string().trim().min(1).max(500).optional(),
    idempotencyKey: z.string().trim().min(8).max(200),
});
export type RecordTrainingAttendance = z.infer<typeof RecordTrainingAttendance>;
/**
 * What the tick answers.
 *
 * `certificateId` is null for an absent decision and for a replayed present
 * decision that issued nothing new. `issuedNow` separates "there is a
 * certificate" from "this call made it", which is what lets a client confirm
 * once rather than on every retry.
 */
export const RecordTrainingAttendanceResult = z.object({
    decisionId: Uuid,
    registrationStatus: TrainingRegistrationStatus,
    certificateId: Uuid.nullable(),
    certificateSerial: z.string().nullable(),
    issuedNow: z.boolean(),
});
export type RecordTrainingAttendanceResult = z.infer<
    typeof RecordTrainingAttendanceResult
>;
/** What closing a roster answers. One action, every undecided person (AC-10). */
export const CloseTrainingRosterResult = z.object({
    markedAbsent: z.number().int().nonnegative(),
    rosterClosedAt: z.string(),
});
export type CloseTrainingRosterResult = z.infer<
    typeof CloseTrainingRosterResult
>;
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
export const RevokeTrainingCertificate = z.object({
    reason: z.string().trim().min(3).max(500),
});
export type RevokeTrainingCertificate = z.infer<
    typeof RevokeTrainingCertificate
>;
/** A certificate as staff see it. The row is never deleted (AC-23). */
export const AdminTrainingCertificate = z.object({
    id: Uuid,
    serial: z.string(),
    registrationId: Uuid,
    sessionId: Uuid,
    holderName: z.string(),
    holderUserId: Uuid,
    courseTitle: z.string(),
    courseVersion: z.number().int().positive(),
    sessionDate: z.string(),
    venueName: z.string(),
    districtName: z.string(),
    leadTrainerName: z.string(),
    issuedAt: z.string(),
    issuedBy: Uuid,
    revokedAt: z.string().nullable(),
    revokedBy: Uuid.nullable(),
    revocationReason: z.string().nullable(),
    hasPdf: z.boolean(),
});
export type AdminTrainingCertificate = z.infer<typeof AdminTrainingCertificate>;
export const AdminTrainingCertificateListQuery = z.object({
    sessionId: Uuid.optional(),
    ...pageQuery,
});
export type AdminTrainingCertificateListQuery = z.infer<
    typeof AdminTrainingCertificateListQuery
>;
export const AdminTrainingCertificateListResponse = listOf(
    AdminTrainingCertificate,
);
export type AdminTrainingCertificateListResponse = z.infer<
    typeof AdminTrainingCertificateListResponse
>;
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
export const TRAINING_CREDENTIAL_WORDING = {
    /** The line under the holder's name on the PDF. */
    pdfClaim: "attended this live training session",
    /** What the public page says about a certificate that stands. */
    verifiedClaim:
        "This certificate is genuine. The person named attended the live session below.",
    /** What the public page says about one that was withdrawn. */
    revokedClaim:
        "This certificate has been withdrawn and should not be relied on.",
    /** What the public page says about a code that names nothing. */
    unknownClaim: "We cannot confirm a certificate from this code.",
    /** The honest label for a session price that nothing collects yet. */
    feeNotice:
        "Nothing is collected online yet. The session fee is shown so you know what it is.",
} as const;
/**
 * The words that must never appear on a training credential surface (AC-31).
 *
 * A list rather than a comment, so the wording pass can be checked mechanically
 * instead of read for. Every entry is a claim about competence, and this
 * credential is a claim about attendance.
 */
export const TRAINING_FORBIDDEN_CLAIMS: readonly string[] = [
    "qualified",
    "passed",
    "certified competent",
    "competent",
    "accredited",
    "licensed",
];
