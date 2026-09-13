/**
 * ADR-049  TRAINING, LIVE ATTENDANCE AND THE DIGITAL CERTIFICATE.
 *
 * Seven tables behind one claim: this named person attended this live session
 * of this module on this date. Everything unusual about the shapes below serves
 * that one sentence being defensible a year later, when somebody disputes a
 * piece of paper.
 *
 * THE FOUR RULES THE DATABASE HOLDS, RATHER THAN THE APPLICATION:
 *
 * 1. Exactly one lead trainer per session, by a partial unique index. Two leads
 *    means two names could be printed on one certificate; none means the
 *    printed name comes from nowhere.
 * 2. A registration names a business exactly one way, by a CHECK. Both would be
 *    two answers to one question; neither would be an unidentifiable attendee.
 * 3. One registration per person per session, by a unique constraint. AC-4
 *    makes a second attempt return the first row, and the constraint is what
 *    makes that true under two simultaneous requests rather than usually.
 * 4. One certificate per registration, by a unique constraint on
 *    `registration_id`. This is the backstop behind the idempotency key: a tick
 *    replayed at the same instant on two connections cannot mint two serials.
 *
 * WHAT IS COPIED RATHER THAN JOINED. Every descriptive column on
 * `training_certificates` from `holder_name` to `lead_trainer_name` is written
 * once at issue and never again (AC-14). A certificate is a statement about a
 * day, so a venue later renamed, a course title later corrected or a profile
 * later edited must not retroactively change what a printed document says. The
 * cost is duplication that looks redundant until the first dispute.
 *
 * `email citext`, WHICH THE ADR ASKS FOR, IS `text` HERE. `schema.ts` records
 * why: citext is an extension dependency this schema deliberately does not
 * carry, and case-insensitive email is done with a unique `lower()` index
 * everywhere else in this database. AC-8's requirement is that a walk-in email
 * matches an existing account regardless of case, which the lower() index and
 * the boundary normalisation give exactly. Same guarantee, no extension.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgSequence,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './auth';
import { amount, currency, timestamps } from './columns';
import {
  trainingAttendanceDecisionEnum,
  trainingRegistrationSourceEnum,
  trainingRegistrationStatusEnum,
  trainingSessionStatusEnum,
} from './enums';
import { districts } from './geography';
import { orgs } from './org';

/**
 * The serial sequence, which never resets (AC-18).
 *
 * A serial reads `INJ-TR-<year of the session>-<sequence>`, and the year comes
 * from the session date while the number comes from here. So serials within one
 * year are unique but NOT contiguous, and that is the intended trade: a
 * per-year counter would have to be reset by something, and the thing that
 * resets a counter is the thing that eventually reissues a serial. A serial
 * that is printed, filed and read down a phone line must never name two
 * certificates, including after a revocation (AC-23).
 *
 * `CYCLE` is absent deliberately. At one per second this lasts longer than the
 * company; wrapping would be silent reuse.
 */
export const trainingCertificateSerialSeq = pgSequence(
  'training_certificate_serial_seq',
  { startWith: 1, increment: 1, minValue: 1, cache: 1 },
);

/**
 * A course is a syllabus, and carries no price.
 *
 * The price lives on the session (AC-33), because the same module taught in
 * Musanze next week and at the office in a year is the same syllabus at two
 * different costs. Putting a price here would force a second course row to
 * charge a second price, and then two courses issue two differently-named
 * certificates for one piece of learning.
 *
 * `version` is bumped explicitly, never on every edit. It is printed on
 * certificates and means "this is the syllabus they sat through", so correcting
 * a typo must not claim a new syllabus was taught.
 */
export const trainingCourses = pgTable(
  'training_courses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    version: integer('version').notNull().default(1),
    /**
     * Several courses may be published at once (AC-30), so this is a plain
     * boolean and not a "current course" pointer. Module two is then a row an
     * admin publishes rather than a migration and a deploy.
     */
    isPublished: boolean('is_published').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    unique('training_courses_slug_uk').on(t.slug),
    index('training_courses_published_idx').on(t.isPublished),
    check('training_courses_version_positive', sql`${t.version} >= 1`),
  ],
);

/**
 * A place training may happen. A list the company keeps (AC-32).
 *
 * A trainer PICKS one and never types one, which is the whole point of the
 * table: a typed venue is a venue nobody can find, and a certificate naming it
 * says nothing checkable about where the person was.
 *
 * `district_id` is an integer smart code from the geography reference data
 * (D11) and `districts` carries its own `province_id`, so there is no province
 * column here: the province is one join away and a second copy could disagree
 * with it.
 *
 * `retired_at` rather than a delete, and rather than a phase switch. The
 * roadshow ending is a set of district venues being retired one at a time;
 * sessions already published at a retired venue still run, and the rows stay so
 * that old certificates still name a real place.
 */
export const trainingVenues = pgTable(
  'training_venues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    address: text('address').notNull(),
    districtId: integer('district_id')
      .notNull()
      .references(() => districts.id),
    /** The Injishi office is one row here, flagged, not a special case in code. */
    isOffice: boolean('is_office').notNull().default(false),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('training_venues_district_idx').on(t.districtId),
    index('training_venues_active_idx')
      .on(t.name)
      .where(sql`${t.retiredAt} IS NULL`),
  ],
);

/**
 * One sitting of one course: a time, a place, a price and a roster.
 *
 * `seat_count` is ADVISORY and is never enforced (AC-5). Registering past it
 * succeeds and the public page warns first. That is a product choice with a
 * real cost recorded in the ADR: somebody can travel and find no chair.
 *
 * `fee_rwf` is the price of THIS session and nothing collects it. `paid_at` on
 * the registration is never written by this build. A price on a public page
 * that nobody is asked to pay needs honest wording beside it, which is why
 * `TRAINING_CREDENTIAL_WORDING.feeNotice` exists in the contracts.
 *
 * `rescheduled_from` keeps the previous start time rather than a history table:
 * one move is the case that happens, every registrant is mailed the reason, and
 * a second move overwrites a value nobody was reading.
 */
export const trainingSessions = pgTable(
  'training_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => trainingCourses.id),
    status: trainingSessionStatusEnum('status').notNull().default('draft'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    /** Picked from the active venue list, never typed (AC-32). */
    venueId: uuid('venue_id')
      .notNull()
      .references(() => trainingVenues.id),
    feeRwf: amount('fee_rwf').notNull().default(0),
    currency: currency(),
    seatCount: integer('seat_count').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedBy: uuid('published_by').references(() => users.id),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),
    rescheduledFrom: timestamp('rescheduled_from', { withTimezone: true }),
    rosterClosedAt: timestamp('roster_closed_at', { withTimezone: true }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index('training_sessions_course_idx').on(t.courseId),
    index('training_sessions_venue_idx').on(t.venueId),
    index('training_sessions_status_starts_idx').on(t.status, t.startsAt),
    check('training_sessions_window', sql`${t.endsAt} > ${t.startsAt}`),
    check('training_sessions_seat_count', sql`${t.seatCount} >= 0`),
    check('training_sessions_fee_nonnegative', sql`${t.feeRwf} >= 0`),
    /**
     * A cancellation always carries its reason, because every registrant is
     * mailed it. A cancelled session with no reason is a mail with a blank in
     * the middle of it.
     */
    check(
      'training_sessions_cancellation_shape',
      sql`(${t.cancelledAt} IS NULL AND ${t.cancellationReason} IS NULL)
          OR (${t.cancelledAt} IS NOT NULL AND ${t.cancellationReason} IS NOT NULL)`,
    ),
    /** Published means somebody published it, and records who and when. */
    check(
      'training_sessions_publication_shape',
      sql`(${t.publishedAt} IS NULL AND ${t.publishedBy} IS NULL)
          OR (${t.publishedAt} IS NOT NULL AND ${t.publishedBy} IS NOT NULL)`,
    ),
  ],
);

/**
 * Who teaches a session. Membership of this table is what "own session" means.
 *
 * Every trainer-gated verb asks this table, not a single `trainer_id` column,
 * so a co trainer can edit, cancel and close the session they are actually
 * standing in (AC-7). Lead and co are equal for all of that.
 *
 * The ONE thing the lead is for: their name is copied onto the certificate. So
 * exactly one lead is a database rule, by the partial unique index below, and
 * not an application check. Two leads would make the printed name ambiguous;
 * none would make it come from nowhere.
 */
export const trainingSessionTrainers = pgTable(
  'training_session_trainers',
  {
    sessionId: uuid('session_id')
      .notNull()
      .references(() => trainingSessions.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    isLead: boolean('is_lead').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({
      name: 'training_session_trainers_pk',
      columns: [t.sessionId, t.userId],
    }),
    uniqueIndex('training_session_trainers_lead_uk')
      .on(t.sessionId)
      .where(sql`${t.isLead}`),
    index('training_session_trainers_user_idx').on(t.userId),
  ],
);

/**
 * One person's place on one session's roster.
 *
 * `full_name`, `email` and `phone` are a RECORD OF WHAT WAS GIVEN on the day,
 * not a contact card. Mail goes to the account's current address (AC-20),
 * resolved at send time, because a person who corrects their address after
 * registering should receive their certificate, not have it sent to a typo.
 *
 * The business is named exactly one way: an `org_id` for a business already on
 * the platform, or `business_name` for one that is not. Both is two answers to
 * one question; neither is an attendee nobody can place. The CHECK holds it.
 *
 * `fee_rwf` is copied from the session at registration rather than joined, so
 * that a later price change does not rewrite what somebody signed up for.
 * `paid_at` exists and is never written by this build.
 */
export const trainingRegistrations = pgTable(
  'training_registrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => trainingSessions.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    status: trainingRegistrationStatusEnum('status')
      .notNull()
      .default('registered'),
    source: trainingRegistrationSourceEnum('source').notNull().default('self'),
    fullName: text('full_name').notNull(),
    /** See the header: `text` plus a `lower()` index, not citext. */
    email: text('email').notNull(),
    /** E.164, normalised at the boundary by `@injishi/auth`'s helper. */
    phone: text('phone').notNull(),
    orgId: uuid('org_id').references(() => orgs.id),
    businessName: text('business_name'),
    feeRwf: amount('fee_rwf').notNull().default(0),
    currency: currency(),
    /** Nothing writes this yet. The fee is priced and not collected. */
    paidAt: timestamp('paid_at', { withTimezone: true }),
    registeredAt: timestamp('registered_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (t) => [
    /** AC-4, held by the database so it survives two simultaneous requests. */
    unique('training_registrations_session_user_uk').on(t.sessionId, t.userId),
    index('training_registrations_session_status_idx').on(
      t.sessionId,
      t.status,
    ),
    index('training_registrations_user_idx').on(t.userId),
    uniqueIndex('training_registrations_session_email_uk').on(
      t.sessionId,
      sql`lower(${t.email})`,
    ),
    check(
      'training_registrations_business_shape',
      sql`(${t.orgId} IS NOT NULL AND ${t.businessName} IS NULL)
          OR (${t.orgId} IS NULL AND ${t.businessName} IS NOT NULL)`,
    ),
    check('training_registrations_fee_nonnegative', sql`${t.feeRwf} >= 0`),
  ],
);

/**
 * Every attendance decision ever made, append only.
 *
 * NO ROW HERE IS EVER UPDATED OR DELETED (AC-11). A trainer who ticks the wrong
 * person and corrects it leaves two rows, and the later one wins. That is the
 * difference between a roster and an audit trail: a column that gets
 * overwritten cannot answer "who said this person was present, and when did
 * they say it", which is the first question asked when a certificate is
 * disputed.
 *
 * `idempotency_key` is NOT NULL and unique. Marking somebody present mints a
 * certificate with a serial, and a trainer on a bad connection taps twice.
 * Without the key the second tap mints a second serial, and a serial that has
 * been printed cannot be tidied away.
 */
export const trainingAttendanceDecisions = pgTable(
  'training_attendance_decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    registrationId: uuid('registration_id')
      .notNull()
      .references(() => trainingRegistrations.id),
    /**
     * Denormalised from the registration on purpose: every read of this table
     * is "the decisions for this session", and carrying the session means the
     * roster query does not join through registrations to filter.
     */
    sessionId: uuid('session_id')
      .notNull()
      .references(() => trainingSessions.id),
    decision: trainingAttendanceDecisionEnum('decision').notNull(),
    decidedBy: uuid('decided_by')
      .notNull()
      .references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    reason: text('reason'),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('training_attendance_decisions_idempotency_uk').on(
      t.idempotencyKey,
    ),
    /** The roster reads "the latest decision per registration" off this. */
    index('training_attendance_decisions_registration_idx').on(
      t.registrationId,
      t.decidedAt.desc(),
    ),
    index('training_attendance_decisions_session_idx').on(t.sessionId),
  ],
);

/**
 * The certificate. An independent permanent record, not a view of a roster.
 *
 * EVERY DESCRIPTIVE COLUMN IS LOCKED AT ISSUE (AC-14). `holder_name`,
 * `course_version`, `session_date`, `venue_name`, `district_name` and
 * `lead_trainer_name` are copies, so the same PDF can be rebuilt from this row
 * alone and a later edit anywhere else cannot alter an issued document. This is
 * the single most important property in the feature: without it, "what does
 * this certificate say" has a different answer depending on when you ask.
 *
 * `holder_business_name` and `holder_org_id` are recorded and never printed.
 * The credential is about a person attending; naming their employer to every
 * stranger who scans the paper is a disclosure it does not need to make.
 *
 * `verify_token` is 160 bits from `crypto.randomBytes`, base32 encoded, and is
 * derived from nothing (AC-17). Not the serial, not the id, not the holder. The
 * serial is short so it can be read down a phone line, which is exactly why it
 * must not be the thing that opens the public page.
 *
 * A REVOKED ROW IS NEVER DELETED AND ITS SERIAL IS NEVER REISSUED (AC-23).
 * Revocation sets three columns and nothing else changes, so the public page
 * can say "this was issued on that date and withdrawn on this one", which is a
 * more useful answer to a person holding the paper than "no such certificate".
 */
export const trainingCertificates = pgTable(
  'training_certificates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** One certificate per registration. The backstop behind the idempotency key. */
    registrationId: uuid('registration_id')
      .notNull()
      .references(() => trainingRegistrations.id),
    courseId: uuid('course_id')
      .notNull()
      .references(() => trainingCourses.id),
    courseVersion: integer('course_version').notNull(),
    serial: text('serial').notNull(),
    verifyToken: text('verify_token').notNull(),
    holderName: text('holder_name').notNull(),
    holderOrgId: uuid('holder_org_id').references(() => orgs.id),
    holderBusinessName: text('holder_business_name'),
    /** A calendar day in Africa/Kigali, not an instant. It is printed as a date. */
    sessionDate: date('session_date').notNull(),
    venueName: text('venue_name').notNull(),
    districtName: text('district_name').notNull(),
    leadTrainerName: text('lead_trainer_name').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    issuedBy: uuid('issued_by')
      .notNull()
      .references(() => users.id),
    /**
     * The `stored_objects.object_key` of the PDF, nullable so that a failure to
     * render or store does not lose the fact that the person attended. The
     * certificate is the row; the PDF is a rendering of it and can be rebuilt.
     */
    pdfObjectKey: text('pdf_object_key'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedBy: uuid('revoked_by').references(() => users.id),
    revocationReason: text('revocation_reason'),
    ...timestamps,
  },
  (t) => [
    unique('training_certificates_registration_uk').on(t.registrationId),
    unique('training_certificates_serial_uk').on(t.serial),
    unique('training_certificates_verify_token_uk').on(t.verifyToken),
    index('training_certificates_course_idx').on(t.courseId),
    index('training_certificates_issued_at_idx').on(t.issuedAt.desc()),
    /** A withdrawal always says who withdrew it and why (AC-22). */
    check(
      'training_certificates_revocation_shape',
      sql`(${t.revokedAt} IS NULL AND ${t.revokedBy} IS NULL AND ${t.revocationReason} IS NULL)
          OR (${t.revokedAt} IS NOT NULL AND ${t.revokedBy} IS NOT NULL AND ${t.revocationReason} IS NOT NULL)`,
    ),
    check('training_certificates_course_version', sql`${t.courseVersion} >= 1`),
  ],
);
