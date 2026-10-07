/**
 * The people file (ADR-058, 058-people-file): everything a business keeps about
 * a person beyond the file row itself. Pay accounts, notes, documents with their
 * versions, policies, disciplinary records, staff announcements, tags and the
 * business's HR settings.
 *
 * The rules of people.ts hold here too. Every table carries `org_id`. Nothing a
 * person did or was told is deleted: an account is retired, a document version
 * superseded by a newer one, a policy or announcement archived, a note followed
 * by another note. Two kinds of row are sets rather than history and do go: a
 * tag link and an audience row, which say who something applies to now.
 *
 * Personal data under Law N° 058/2021: notes, documents and disciplinary
 * records are read by `people.manage` only, pay accounts by `people.manage` and
 * `payroll.run` (AC-PF2), and files are stored through the storage module,
 * private, behind short signed links.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './auth';
import { timestamps } from './columns';
import { departments } from './operations';
import { orgs } from './org';
import {
  employees,
  hrAudienceEnum,
  hrCatalogStatusEnum,
  hrDisciplinaryKindEnum,
  hrDocumentStatusEnum,
  hrDocumentVersionStatusEnum,
  hrLengthUnitEnum,
  hrPayAccountKindEnum,
  hrPayAccountStatusEnum,
  hrPublishStatusEnum,
  hrTagToneEnum,
  jobPositions,
} from './people';

/**
 * One row per business of every business level HR switch (index contract 13).
 * Each child adds its own columns; this one starts with the number prefix.
 */
export const hrSettings = pgTable(
  'hr_settings',
  {
    orgId: uuid('org_id')
      .primaryKey()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    /** `EMP` makes the next number `EMP0007`; numbers already issued never change (AC-PF12). */
    employeeNumberPrefix: text('employee_number_prefix'),
    /** 058-payroll AC-PY14: the Kigali day (1 to 28) the daily job drafts the month's run. */
    payRunAutoDraftDay: integer('pay_run_auto_draft_day'),
    /** 058-payroll AC-PY14: printed on payslips and declarations; a run needs it to confirm. */
    rssbEmployerNumber: text('rssb_employer_number'),
    ...timestamps,
  },
  (t) => [
    check('hr_settings_draft_day_ck', sql`${t.payRunAutoDraftDay} IS NULL OR ${t.payRunAutoDraftDay} BETWEEN 1 AND 28`),
    check(
      'hr_settings_prefix_ck',
      sql`${t.employeeNumberPrefix} IS NULL OR ${t.employeeNumberPrefix} ~ '^[A-Z0-9-]{1,8}$'`,
    ),
  ],
);

/** A business's own labels for people ("first aid", "speaks French"). */
export const employeeTags = pgTable(
  'employee_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    tone: hrTagToneEnum('tone').notNull().default('neutral'),
    status: hrCatalogStatusEnum('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('employee_tags_title_uk')
      .on(t.orgId, sql`lower(${t.title})`)
      .where(sql`${t.status} = 'active'`),
  ],
);

/** Which tags a file carries now. A set, so a removed tag's link goes. */
export const employeeTagLinks = pgTable(
  'employee_tag_links',
  {
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => employeeTags.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ name: 'employee_tag_links_pk', columns: [t.employeeId, t.tagId] }), index('employee_tag_links_tag_idx').on(t.tagId)],
);

/**
 * Where a person's pay goes: a bank account or MoMo (AC-PF3). At most one
 * active primary account per person, held by the database.
 */
export const employeePayAccounts = pgTable(
  'employee_pay_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    kind: hrPayAccountKindEnum('kind').notNull(),
    bankName: text('bank_name'),
    accountNumber: text('account_number'),
    branchName: text('branch_name'),
    /** E.164. */
    momoPhone: text('momo_phone'),
    isPrimary: boolean('is_primary').notNull().default(false),
    status: hrPayAccountStatusEnum('status').notNull().default('active'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    check(
      'employee_pay_accounts_kind_ck',
      sql`(${t.kind} = 'bank' AND ${t.bankName} IS NOT NULL AND ${t.accountNumber} IS NOT NULL AND ${t.momoPhone} IS NULL)
        OR (${t.kind} = 'momo' AND ${t.momoPhone} IS NOT NULL AND ${t.bankName} IS NULL AND ${t.accountNumber} IS NULL)`,
    ),
    check('employee_pay_accounts_primary_active_ck', sql`NOT (${t.isPrimary} AND ${t.status} = 'retired')`),
    uniqueIndex('employee_pay_accounts_primary_uk')
      .on(t.employeeId)
      .where(sql`${t.isPrimary} AND ${t.status} = 'active'`),
    index('employee_pay_accounts_employee_idx').on(t.employeeId),
  ],
);

/** Private notes on a file (AC-PF6). Append only: a correction is the next note. */
export const employeeNotes = pgTable(
  'employee_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    body: text('body').notNull(),
    /** Stored objects of kind `hr_attachment`. */
    fileKeys: text('file_keys').array().notNull().default(sql`'{}'::text[]`),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('employee_notes_employee_idx').on(t.employeeId, t.createdAt)],
);

/**
 * A request for a document from one or many people (AC-PF4). The request is the
 * template; each person gets their own `employee_documents` row.
 */
export const documentRequests = pgTable(
  'document_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    /** From the closed list `pdf`, `jpg`, `png`, `heic`. */
    formats: text('formats').array().notNull(),
    maxMb: integer('max_mb').notNull(),
    dueOn: date('due_on'),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (t) => [
    check('document_requests_max_mb_ck', sql`${t.maxMb} BETWEEN 1 AND 10`),
    check(
      'document_requests_formats_ck',
      sql`cardinality(${t.formats}) >= 1 AND ${t.formats} <@ ARRAY['pdf','jpg','png','heic']::text[]`,
    ),
  ],
);

/** One document of one person: requested, or uploaded without a request. */
export const employeeDocuments = pgTable(
  'employee_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    requestId: uuid('request_id').references(() => documentRequests.id),
    title: text('title').notNull(),
    status: hrDocumentStatusEnum('status').notNull().default('requested'),
    rejectReason: text('reject_reason'),
    issuedOn: date('issued_on'),
    expiresOn: date('expires_on'),
    remindDaysBefore: integer('remind_days_before'),
    /** Set once when the expiry reminder is raised; cleared when the dates move (AC-PF5). */
    remindedAt: timestamp('reminded_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('employee_documents_request_uk')
      .on(t.requestId, t.employeeId)
      .where(sql`${t.requestId} IS NOT NULL`),
    check(
      'employee_documents_remind_ck',
      sql`${t.remindDaysBefore} IS NULL OR ${t.remindDaysBefore} BETWEEN 0 AND 365`,
    ),
    check(
      'employee_documents_dates_ck',
      sql`${t.issuedOn} IS NULL OR ${t.expiresOn} IS NULL OR ${t.expiresOn} >= ${t.issuedOn}`,
    ),
    check(
      'employee_documents_reject_ck',
      sql`(${t.status} = 'rejected') = (${t.rejectReason} IS NOT NULL)`,
    ),
    index('employee_documents_employee_idx').on(t.employeeId),
    index('employee_documents_expiry_idx').on(t.expiresOn).where(sql`${t.remindedAt} IS NULL`),
  ],
);

/**
 * Every file ever uploaded for a document (AC-PF4). Append only: a rejected
 * upload stays as its own row, and the document's current file is its newest.
 */
export const employeeDocumentVersions = pgTable(
  'employee_document_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => employeeDocuments.id),
    /** A stored object of kind `staff_document`. */
    fileKey: text('file_key').notNull(),
    uploadedByUserId: uuid('uploaded_by_user_id')
      .notNull()
      .references(() => users.id),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
    status: hrDocumentVersionStatusEnum('status').notNull().default('submitted'),
    rejectReason: text('reject_reason'),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (t) => [index('employee_document_versions_document_idx').on(t.documentId, t.uploadedAt)],
);

/** A house rule or handbook page (AC-PF7). Archived, never deleted. */
export const staffPolicies = pgTable('staff_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  body: text('body').notNull(),
  fileKeys: text('file_keys').array().notNull().default(sql`'{}'::text[]`),
  audience: hrAudienceEnum('audience').notNull().default('all'),
  status: hrPublishStatusEnum('status').notNull().default('published'),
  createdByUserId: uuid('created_by_user_id')
    .notNull()
    .references(() => users.id),
  ...timestamps,
});

/**
 * Who a targeted policy is for: departments, job positions or people, exactly
 * one per row. A department and positions together narrow it (both must match);
 * a person named is always in.
 */
export const staffPolicyAudiences = pgTable(
  'staff_policy_audiences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    policyId: uuid('policy_id')
      .notNull()
      .references(() => staffPolicies.id),
    departmentId: uuid('department_id').references(() => departments.id),
    jobPositionId: uuid('job_position_id').references(() => jobPositions.id),
    employeeId: uuid('employee_id').references(() => employees.id),
  },
  (t) => [
    check(
      'staff_policy_audiences_one_ck',
      sql`num_nonnulls(${t.departmentId}, ${t.jobPositionId}, ${t.employeeId}) = 1`,
    ),
    index('staff_policy_audiences_policy_idx').on(t.policyId),
  ],
);

/** The kinds of disciplinary action a business uses (AC-PF8). */
export const disciplinaryTypes = pgTable(
  'disciplinary_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    kind: hrDisciplinaryKindEnum('kind').notNull(),
    status: hrCatalogStatusEnum('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('disciplinary_types_title_uk')
      .on(t.orgId, sql`lower(${t.title})`)
      .where(sql`${t.status} = 'active'`),
  ],
);

/** One disciplinary action against one person: naming several writes one row each. */
export const disciplinaryActions = pgTable(
  'disciplinary_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    typeId: uuid('type_id')
      .notNull()
      .references(() => disciplinaryTypes.id),
    description: text('description').notNull(),
    unit: hrLengthUnitEnum('unit'),
    length: integer('length'),
    startsOn: date('starts_on').notNull(),
    /** A stored object of kind `hr_attachment`. */
    fileKey: text('file_key'),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('disciplinary_actions_length_ck', sql`(${t.unit} IS NULL) = (${t.length} IS NULL) AND (${t.length} IS NULL OR ${t.length} > 0)`),
    index('disciplinary_actions_employee_idx').on(t.employeeId),
  ],
);

/** A staff announcement (AC-PF9), separate from the platform's own `announcements`. */
export const staffAnnouncements = pgTable('staff_announcements', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  body: text('body').notNull(),
  fileKeys: text('file_keys').array().notNull().default(sql`'{}'::text[]`),
  audience: hrAudienceEnum('audience').notNull().default('all'),
  expiresOn: date('expires_on'),
  commentsAllowed: boolean('comments_allowed').notNull().default(true),
  status: hrPublishStatusEnum('status').notNull().default('published'),
  createdByUserId: uuid('created_by_user_id')
    .notNull()
    .references(() => users.id),
  ...timestamps,
});

/** Who a targeted announcement is for, read as `staff_policy_audiences` is. */
export const staffAnnouncementAudiences = pgTable(
  'staff_announcement_audiences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    announcementId: uuid('announcement_id')
      .notNull()
      .references(() => staffAnnouncements.id),
    departmentId: uuid('department_id').references(() => departments.id),
    jobPositionId: uuid('job_position_id').references(() => jobPositions.id),
    employeeId: uuid('employee_id').references(() => employees.id),
  },
  (t) => [
    check(
      'staff_announcement_audiences_one_ck',
      sql`num_nonnulls(${t.departmentId}, ${t.jobPositionId}, ${t.employeeId}) = 1`,
    ),
    index('staff_announcement_audiences_announcement_idx').on(t.announcementId),
  ],
);

/** A comment on an announcement, by an account (an owner without a file can reply). */
export const staffAnnouncementComments = pgTable(
  'staff_announcement_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    announcementId: uuid('announcement_id')
      .notNull()
      .references(() => staffAnnouncements.id),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('staff_announcement_comments_announcement_idx').on(t.announcementId, t.createdAt)],
);

/** A person's first view of an announcement, recorded once. */
export const staffAnnouncementViews = pgTable(
  'staff_announcement_views',
  {
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    announcementId: uuid('announcement_id')
      .notNull()
      .references(() => staffAnnouncements.id),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    viewedAt: timestamp('viewed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ name: 'staff_announcement_views_pk', columns: [t.announcementId, t.employeeId] })],
);
