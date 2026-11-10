/**
 * Talent (058-talent): hiring and reviews.
 *
 * A VACANCY is a role being filled at a branch. A CANDIDATE applies to one vacancy and moves
 * through its stages; their details carry a `keep_until` day after which an applicant who did not
 * join is deleted (consent, ADR-058). A SCORE is one person's mark for one part of the process.
 * An INTERVIEW is booked against a candidate. An OFFER ROUND is one figure in the salary talk, the
 * business's offer or what the candidate asks back. A CANDIDATE DOCUMENT is a file the applicant sent
 * from their progress page. A REVIEW CYCLE holds one REVIEW per person on staff.
 *
 * The rules of people.ts hold here: every table carries `org_id`, directly or through its parent.
 */
import { bigint, boolean, date, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { timestamps } from './columns';
import { properties } from './inventory';
import { orgs } from './org';
import { employees } from './people';

export const vacancyStatusEnum = pgEnum('vacancy_status', ['open', 'closed', 'filled']);
export const candidateStageEnum = pgEnum('candidate_stage', ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected']);
export const interviewStatusEnum = pgEnum('interview_status', ['scheduled', 'done', 'cancelled']);
export const reviewCycleStatusEnum = pgEnum('review_cycle_status', ['open', 'closed']);
export const offerSideEnum = pgEnum('offer_side', ['business', 'candidate']);

export const vacancies = pgTable(
  'vacancies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    propertyId: uuid('property_id').references(() => properties.id),
    openings: integer('openings').notNull().default(1),
    wageFromRwf: bigint('wage_from_rwf', { mode: 'number' }),
    wageToRwf: bigint('wage_to_rwf', { mode: 'number' }),
    closesOn: date('closes_on'),
    status: vacancyStatusEnum('status').notNull().default('open'),
    managerEmployeeId: uuid('manager_employee_id').references(() => employees.id),
    note: text('note'),
    /** What an applicant is asked to send, by name. */
    requiredDocuments: text('required_documents').array().notNull().default([]),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [index('vacancies_org_status_idx').on(t.orgId, t.status)],
);

export const candidates = pgTable(
  'candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    vacancyId: uuid('vacancy_id')
      .notNull()
      .references(() => vacancies.id, { onDelete: 'cascade' }),
    fullName: text('full_name').notNull(),
    phone: text('phone'),
    email: text('email'),
    source: text('source').notNull(),
    stage: candidateStageEnum('stage').notNull().default('applied'),
    note: text('note'),
    talentPool: boolean('talent_pool').notNull().default(false),
    appliedOn: date('applied_on').notNull(),
    keepUntil: date('keep_until').notNull(),
    /** What they asked for when they applied. */
    expectedWageRwf: bigint('expected_wage_rwf', { mode: 'number' }),
    offerWageRwf: bigint('offer_wage_rwf', { mode: 'number' }),
    offerStartsOn: date('offer_starts_on'),
    /** The wage both sides settled on. */
    agreedWageRwf: bigint('agreed_wage_rwf', { mode: 'number' }),
    rejectReason: text('reject_reason'),
    hiredEmployeeId: uuid('hired_employee_id').references(() => employees.id),
    /**
     * The applicant's own progress page: a long random link, opened with a six digit code sent to
     * their email. The code and the session are kept as hashes; the link is what HR shares.
     */
    accessToken: text('access_token').unique(),
    accessCodeHash: text('access_code_hash'),
    accessCodeExpiresAt: timestamp('access_code_expires_at', { withTimezone: true }),
    accessCodeAttempts: integer('access_code_attempts').notNull().default(0),
    accessSessionHash: text('access_session_hash'),
    accessSessionExpiresAt: timestamp('access_session_expires_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('candidates_vacancy_idx').on(t.vacancyId, t.stage), index('candidates_org_idx').on(t.orgId)],
);

export const offerRounds = pgTable(
  'offer_rounds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    side: offerSideEnum('side').notNull(),
    amountRwf: bigint('amount_rwf', { mode: 'number' }).notNull(),
    startsOn: date('starts_on'),
    note: text('note'),
    byUserId: uuid('by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('offer_rounds_candidate_idx').on(t.candidateId, t.createdAt)],
);

export const candidateDocuments = pgTable(
  'candidate_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    /** Which of the role's documents this is. */
    name: text('name').notNull(),
    objectKey: text('object_key').notNull(),
    filename: text('filename').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('candidate_documents_candidate_idx').on(t.candidateId)],
);

export const candidateScores = pgTable(
  'candidate_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    what: text('what').notNull(),
    score: integer('score').notNull(),
    note: text('note'),
    byUserId: uuid('by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('candidate_scores_candidate_idx').on(t.candidateId)],
);

export const interviews = pgTable(
  'interviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    place: text('place'),
    interviewerName: text('interviewer_name'),
    status: interviewStatusEnum('status').notNull().default('scheduled'),
    ...timestamps,
  },
  (t) => [index('interviews_org_starts_idx').on(t.orgId, t.startsAt)],
);

export const reviewCycles = pgTable(
  'review_cycles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on').notNull(),
    status: reviewCycleStatusEnum('status').notNull().default('open'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [index('review_cycles_org_idx').on(t.orgId, t.status)],
);

export const staffReviews = pgTable(
  'staff_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cycleId: uuid('cycle_id')
      .notNull()
      .references(() => reviewCycles.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    selfDone: boolean('self_done').notNull().default(false),
    managerDone: boolean('manager_done').notNull().default(false),
    rating: integer('rating'),
    note: text('note'),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [uniqueIndex('staff_reviews_cycle_employee_uk').on(t.cycleId, t.employeeId)],
);
