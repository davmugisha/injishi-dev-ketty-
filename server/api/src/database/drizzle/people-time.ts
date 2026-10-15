/**
 * Time (ADR-058, 058-time): publishing a roster, rotations that fill it ahead,
 * shift and swap requests, attendance requests for a missed or wrong punch,
 * the attendance policy and geofence of each branch, kiosks and their PINs,
 * a business's own holidays and weekly days off, and the comments every HR
 * request shares.
 *
 * The rules of people.ts hold here too. Every table carries `org_id`. Nothing a
 * person did or asked for is deleted: a request ends `cancelled`, a rotation
 * assignment ends on a date, a kiosk is `revoked`, a pattern is archived. A
 * holiday, a weekly day off and a policy are settings, edited in place.
 *
 * Three columns on slice 1's tables point INTO this file
 * (`roster_entries.rotation_assignment_id`, `roster_entries.shift_request_id`,
 * `attendance_records.kiosk_id`). Their foreign keys are hand written in
 * migration 0059, below its marker, because declaring them here would make
 * people.ts and this file import each other.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './auth';
import { timestamps } from './columns';
import { properties } from './inventory';
import { departments } from './operations';
import { orgs } from './org';
import { attendanceRecords, employees, hrCatalogStatusEnum, shiftTemplates } from './people';

export const hrRotationRuleEnum = pgEnum('hr_rotation_rule', ['every_n_days', 'weekly', 'monthly']);
export const hrShiftRequestKindEnum = pgEnum('hr_shift_request_kind', ['change', 'swap']);
export const hrShiftRequestStatusEnum = pgEnum('hr_shift_request_status', [
  'requested',
  'awaiting_colleague',
  'approved',
  'rejected',
  'cancelled',
]);
export const hrAttendanceRequestStatusEnum = pgEnum('hr_attendance_request_status', [
  'requested',
  'approved',
  'rejected',
  'cancelled',
]);
export const hrKioskStatusEnum = pgEnum('hr_kiosk_status', ['pairing', 'active', 'revoked']);
/** What a comment is on (index contract 12). Each later child's request joins this list. */
export const hrCommentSubjectEnum = pgEnum('hr_comment_subject', [
  'leave_request',
  'shift_request',
  'attendance_request',
  'allocation_request',
  'asset_request',
  'pay_claim',
  'ticket',
  'resignation',
]);

/** One publish of a branch's roster for a date range (AC-TM1). Append only. */
export const rosterPublications = pgTable(
  'roster_publications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    departmentId: uuid('department_id').references(() => departments.id),
    fromDate: date('from_date').notNull(),
    toDate: date('to_date').notNull(),
    /** How many draft entries this publish stamped. */
    entryCount: integer('entry_count').notNull(),
    publishedByUserId: uuid('published_by_user_id')
      .notNull()
      .references(() => users.id),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('roster_publications_range_ck', sql`${t.toDate} >= ${t.fromDate} AND ${t.toDate} - ${t.fromDate} <= 30`),
    index('roster_publications_property_idx').on(t.propertyId, t.fromDate),
  ],
);

/**
 * A rotation at a branch (AC-TM3): an ordered list of steps, each a shift
 * template id or `"off"`, and when the step advances.
 */
export const rotationPatterns = pgTable(
  'rotation_patterns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    name: text('name').notNull(),
    /** At least two; each a shift template id of this branch, or `"off"`. */
    steps: jsonb('steps').$type<string[]>().notNull(),
    rule: hrRotationRuleEnum('rule').notNull(),
    /** N days for `every_n_days` (1 to 28), a weekday 0 to 6 for `weekly`, a day 1 to 28 for `monthly`. */
    ruleValue: integer('rule_value').notNull(),
    status: hrCatalogStatusEnum('status').notNull().default('active'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('rotation_patterns_name_uk')
      .on(t.propertyId, sql`lower(${t.name})`)
      .where(sql`${t.status} = 'active'`),
    check('rotation_patterns_steps_ck', sql`jsonb_typeof(${t.steps}) = 'array' AND jsonb_array_length(${t.steps}) BETWEEN 2 AND 28`),
    check(
      'rotation_patterns_rule_ck',
      sql`(${t.rule} = 'every_n_days' AND ${t.ruleValue} BETWEEN 1 AND 28)
        OR (${t.rule} = 'weekly' AND ${t.ruleValue} BETWEEN 0 AND 6)
        OR (${t.rule} = 'monthly' AND ${t.ruleValue} BETWEEN 1 AND 28)`,
    ),
  ],
);

/** A person on a rotation from a date, at a starting step (AC-TM3). One open assignment per person. */
export const rotationAssignments = pgTable(
  'rotation_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    patternId: uuid('pattern_id')
      .notNull()
      .references(() => rotationPatterns.id),
    startsOn: date('starts_on').notNull(),
    /** Null while it runs; ending it cancels the drafts it generated after this day. */
    endsOn: date('ends_on'),
    /** Zero based index into the pattern's steps on `starts_on`. */
    startStep: integer('start_step').notNull().default(0),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('rotation_assignments_open_uk').on(t.employeeId).where(sql`${t.endsOn} IS NULL`),
    check('rotation_assignments_dates_ck', sql`${t.endsOn} IS NULL OR ${t.endsOn} >= ${t.startsOn}`),
    check('rotation_assignments_step_ck', sql`${t.startStep} >= 0`),
    index('rotation_assignments_pattern_idx').on(t.patternId),
  ],
);

/**
 * A request for a different shift, or a swap with a colleague, for a date or a
 * range (AC-TM5). Routed to the reporting manager at the moment it was asked
 * (index contract 12), decided by `roster.manage` for the person's branch.
 */
export const shiftRequests = pgTable(
  'shift_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    kind: hrShiftRequestKindEnum('kind').notNull(),
    /** The shift wanted instead (`change`). */
    shiftTemplateId: uuid('shift_template_id').references(() => shiftTemplates.id),
    /** The colleague to swap with (`swap`), at the same branch. */
    swapEmployeeId: uuid('swap_employee_id').references(() => employees.id),
    fromDate: date('from_date').notNull(),
    toDate: date('to_date').notNull(),
    reason: text('reason').notNull(),
    status: hrShiftRequestStatusEnum('status').notNull(),
    colleagueAcceptedAt: timestamp('colleague_accepted_at', { withTimezone: true }),
    /** Who accepted for a colleague with no account, when somebody did. */
    colleagueAcceptedByUserId: uuid('colleague_accepted_by_user_id').references(() => users.id),
    routedToEmployeeId: uuid('routed_to_employee_id').references(() => employees.id),
    requestedByUserId: uuid('requested_by_user_id').references(() => users.id),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: text('decision_note'),
    ...timestamps,
  },
  (t) => [
    check(
      'shift_requests_kind_ck',
      sql`(${t.kind} = 'change' AND ${t.shiftTemplateId} IS NOT NULL AND ${t.swapEmployeeId} IS NULL)
        OR (${t.kind} = 'swap' AND ${t.swapEmployeeId} IS NOT NULL AND ${t.shiftTemplateId} IS NULL)`,
    ),
    check('shift_requests_dates_ck', sql`${t.toDate} >= ${t.fromDate} AND ${t.toDate} - ${t.fromDate} <= 30`),
    check('shift_requests_self_ck', sql`${t.swapEmployeeId} IS NULL OR ${t.swapEmployeeId} <> ${t.employeeId}`),
    index('shift_requests_employee_idx').on(t.employeeId, t.fromDate),
    index('shift_requests_open_idx').on(t.orgId, t.status),
  ],
);

/** A missing or wrong punch asked to be put right (AC-TM6). */
export const attendanceRequests = pgTable(
  'attendance_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    workDate: date('work_date').notNull(),
    clockInAt: timestamp('clock_in_at', { withTimezone: true }).notNull(),
    clockOutAt: timestamp('clock_out_at', { withTimezone: true }).notNull(),
    /** The record to put right; null asks for a missing one. */
    recordId: uuid('record_id').references(() => attendanceRecords.id),
    reason: text('reason').notNull(),
    status: hrAttendanceRequestStatusEnum('status').notNull().default('requested'),
    routedToEmployeeId: uuid('routed_to_employee_id').references(() => employees.id),
    requestedByUserId: uuid('requested_by_user_id').references(() => users.id),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: text('decision_note'),
    /** The record an approval wrote. */
    resultRecordId: uuid('result_record_id').references(() => attendanceRecords.id),
    /** What backs the times asked for: a work order closed, a handover note signed. */
    evidence: text('evidence'),
    /** The line manager who confirmed the times before the request reached HR. */
    managerConfirmedByUserId: uuid('manager_confirmed_by_user_id').references(() => users.id),
    managerConfirmedAt: timestamp('manager_confirmed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check('attendance_requests_times_ck', sql`${t.clockOutAt} > ${t.clockInAt}`),
    index('attendance_requests_employee_idx').on(t.employeeId, t.workDate),
    index('attendance_requests_open_idx').on(t.orgId, t.status),
  ],
);

/**
 * How a branch counts lateness, early leaving and overtime, and when an open
 * record is stale (AC-TM4, AC-TM7, AC-TM8). A row with no branch is the
 * business default; a branch row overrides it.
 */
export const attendancePolicies = pgTable(
  'attendance_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id').references(() => properties.id),
    graceInMinutes: integer('grace_in_minutes').notNull().default(0),
    graceOutMinutes: integer('grace_out_minutes').notNull().default(0),
    /** The most overtime one record may count; null is no cap. */
    overtimeCutoffMinutes: integer('overtime_cutoff_minutes'),
    overtimeAutoApprove: boolean('overtime_auto_approve').notNull().default(false),
    /** Overtime under this is not approved automatically. */
    overtimeMinMinutes: integer('overtime_min_minutes').notNull().default(0),
    /** How long before a shift's start a clock in links to it. */
    linkWindowMinutes: integer('link_window_minutes').notNull().default(180),
    /** An open record older than this is closed by the sweep. */
    staleOpenHours: integer('stale_open_hours').notNull().default(16),
    /** The shift length a stale record is closed at. */
    defaultShiftMinutes: integer('default_shift_minutes').notNull().default(480),
    /** Worked minutes on a holiday or day off that earn a whole compensatory day; half earns half (058-leave AC-LV8). */
    compensationThresholdMinutes: integer('compensation_threshold_minutes').notNull().default(360),
    ...timestamps,
  },
  (t) => [
    unique('attendance_policies_scope_uk').on(t.orgId, t.propertyId).nullsNotDistinct(),
    check(
      'attendance_policies_ranges_ck',
      sql`${t.graceInMinutes} BETWEEN 0 AND 240 AND ${t.graceOutMinutes} BETWEEN 0 AND 240
        AND (${t.overtimeCutoffMinutes} IS NULL OR ${t.overtimeCutoffMinutes} BETWEEN 0 AND 1440)
        AND ${t.overtimeMinMinutes} BETWEEN 0 AND 1440
        AND ${t.linkWindowMinutes} BETWEEN 0 AND 720
        AND ${t.staleOpenHours} BETWEEN 1 AND 72
        AND ${t.defaultShiftMinutes} BETWEEN 30 AND 1440
        AND ${t.compensationThresholdMinutes} BETWEEN 30 AND 1440`,
    ),
  ],
);

/**
 * A branch's geofence for phone clock ins (AC-TM9): a radius, and a centre of
 * its own when the place staff clock in is not the property's map pin. With no
 * centre here the property's coordinates are used; with neither, every phone
 * punch waits for validation.
 */
export const branchClockSettings = pgTable(
  'branch_clock_settings',
  {
    propertyId: uuid('property_id')
      .primaryKey()
      .references(() => properties.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    geofenceRadiusM: integer('geofence_radius_m').notNull().default(150),
    latitude: numeric('latitude', { precision: 9, scale: 6 }),
    longitude: numeric('longitude', { precision: 9, scale: 6 }),
    ...timestamps,
  },
  (t) => [
    check('branch_clock_settings_radius_ck', sql`${t.geofenceRadiusM} BETWEEN 25 AND 2000`),
    check(
      'branch_clock_settings_centre_ck',
      sql`(${t.latitude} IS NULL AND ${t.longitude} IS NULL)
        OR (${t.latitude} BETWEEN -90 AND 90 AND ${t.longitude} BETWEEN -180 AND 180)`,
    ),
  ],
);

/**
 * A shared tablet that clocks people in with their PIN (AC-TM10). The device
 * token and the pairing code exist only as hashes.
 */
export const attendanceKiosks = pgTable(
  'attendance_kiosks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    name: text('name').notNull(),
    /** SHA-256 of the device token; null until paired. */
    tokenHash: text('token_hash'),
    /** SHA-256 of the one time pairing code. */
    pairingCodeHash: text('pairing_code_hash'),
    pairingExpiresAt: timestamp('pairing_expires_at', { withTimezone: true }),
    /** Empty: any address. */
    allowedIps: text('allowed_ips').array().notNull().default(sql`'{}'::text[]`),
    status: hrKioskStatusEnum('status').notNull().default('pairing'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('attendance_kiosks_token_uk').on(t.tokenHash).where(sql`${t.tokenHash} IS NOT NULL`),
    index('attendance_kiosks_property_idx').on(t.propertyId),
  ],
);

/** A person's kiosk PIN (AC-TM11): scrypt, salted per person, peppered with `HR_PIN_PEPPER`. */
export const employeeKioskPins = pgTable('employee_kiosk_pins', {
  employeeId: uuid('employee_id')
    .primaryKey()
    .references(() => employees.id),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  /** `scrypt$N$r$p$salt$hash`, base64 parts. */
  pinHash: text('pin_hash').notNull(),
  setByUserId: uuid('set_by_user_id').references(() => users.id),
  setAt: timestamp('set_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Wrong PINs per person per kiosk (AC-TM10). Five lock that person on that
 * kiosk for 15 minutes; a self service PIN change counts on the row with no
 * kiosk.
 */
export const kioskPinLocks = pgTable(
  'kiosk_pin_locks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    kioskId: uuid('kiosk_id').references(() => attendanceKiosks.id),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    failedCount: integer('failed_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('kiosk_pin_locks_uk').on(t.kioskId, t.employeeId).nullsNotDistinct()],
);

/** A business's own holiday, at one branch or every branch, once or every year (AC-TM12). */
export const orgHolidays = pgTable(
  'org_holidays',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id').references(() => properties.id),
    name: text('name').notNull(),
    fromDate: date('from_date').notNull(),
    toDate: date('to_date').notNull(),
    recurringYearly: boolean('recurring_yearly').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    check('org_holidays_dates_ck', sql`${t.toDate} >= ${t.fromDate} AND ${t.toDate} - ${t.fromDate} <= 31`),
    index('org_holidays_org_idx').on(t.orgId, t.fromDate),
  ],
);

/** A weekly day off at one branch or every branch: every week, or chosen weeks of the month (AC-TM12). */
export const orgWeeklyOffs = pgTable(
  'org_weekly_offs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id').references(() => properties.id),
    /** 0 Sunday to 6 Saturday. */
    weekday: smallint('weekday').notNull(),
    /** Empty: every week; else which weeks of the month, 1 to 5. */
    weeks: integer('weeks').array().notNull().default(sql`'{}'::integer[]`),
    ...timestamps,
  },
  (t) => [
    unique('org_weekly_offs_uk').on(t.orgId, t.propertyId, t.weekday).nullsNotDistinct(),
    check('org_weekly_offs_weekday_ck', sql`${t.weekday} BETWEEN 0 AND 6`),
    check('org_weekly_offs_weeks_ck', sql`${t.weeks} <@ ARRAY[1,2,3,4,5]::integer[]`),
  ],
);

/**
 * A comment on any HR request (index contract 12), by an account or by a file.
 * Append only. An internal comment is read only by those who may decide.
 */
export const hrRequestComments = pgTable(
  'hr_request_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    subjectType: hrCommentSubjectEnum('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    authorUserId: uuid('author_user_id').references(() => users.id),
    authorEmployeeId: uuid('author_employee_id').references(() => employees.id),
    body: text('body').notNull(),
    fileKeys: text('file_keys').array().notNull().default(sql`'{}'::text[]`),
    internal: boolean('internal').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('hr_request_comments_author_ck', sql`${t.authorUserId} IS NOT NULL OR ${t.authorEmployeeId} IS NOT NULL`),
    index('hr_request_comments_subject_idx').on(t.subjectType, t.subjectId, t.createdAt),
  ],
);
