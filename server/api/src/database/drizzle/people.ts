/**
 * The HR module (ADR-058, first thread).
 *
 * Every table carries `org_id`, the employer: the business whose TIN declares
 * PAYE and whose RSSB number declares contributions. A person working for two
 * businesses has two files, one each (cross child contract 3).
 *
 * Nothing here is ever deleted. A file is offboarded, a contract ended, a roster
 * entry cancelled, an attendance record superseded, a leave taken reversed, and
 * a confirmed payslip frozen. The rules the database holds are declared below;
 * the two it holds that Drizzle cannot say (the no overlap rules on the roster
 * and on open leave, EXCLUDE constraints over `btree_gist`) are in the
 * migration that created these tables, `0053_hr_first_thread.sql`.
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
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { amount, timestamps } from './columns';
import { villages } from './geography';
import { properties } from './inventory';
import {
  departmentCategoryEnum,
  departmentMemberStatusEnum,
  departmentPositionEnum,
  departments,
} from './operations';
import { orgMemberships, orgs, workspaces } from './org';

// --- Vocabulary --------------------------------------------------------------

export const hrSexEnum = pgEnum('hr_sex', ['female', 'male']);

export const hrIdDocumentTypeEnum = pgEnum('hr_id_document_type', [
  'national_id',
  'passport',
]);

/** `active` then `offboarded`, and no way back. */
export const hrEmployeeStatusEnum = pgEnum('hr_employee_status', [
  'active',
  'offboarded',
]);

/** A job position, a shift template or a leave type: kept, never deleted. */
export const hrCatalogStatusEnum = pgEnum('hr_catalog_status', [
  'active',
  'archived',
]);

export const hrContractTypeEnum = pgEnum('hr_contract_type', [
  'permanent',
  'fixed_term',
  'casual',
]);

export const hrWageBasisEnum = pgEnum('hr_wage_basis', [
  'monthly',
  'daily',
  'hourly',
]);

/** For display and the one active contract index. Pay reads the dates. */
export const hrContractStatusEnum = pgEnum('hr_contract_status', [
  'scheduled',
  'active',
  'ended',
]);

export const hrRosterStatusEnum = pgEnum('hr_roster_status', [
  'scheduled',
  'cancelled',
]);

/** `058-time.md` adds `kiosk`. */
export const hrAttendanceSourceEnum = pgEnum('hr_attendance_source', [
  'supervisor',
  'self',
  // 058-time AC-TM9, AC-TM10: a person's own phone, and a shared kiosk with a PIN.
  'phone',
  'kiosk',
]);

/** What kind of day a record's work date was, for pricing overtime (058-time AC-TM7). */
export const hrDayKindEnum = pgEnum('hr_day_kind', ['weekday', 'weekly_off', 'public_holiday']);

export const hrAttendanceStatusEnum = pgEnum('hr_attendance_status', [
  'open',
  'closed',
  'superseded',
]);

/** Why a phone punch waits for validation (mobile spec 0003, D-ao): the location reasons, then a late arrival. */
export const attendancePendingReasonEnum = pgEnum('attendance_pending_reason', [
  'no_location',
  'no_branch_location',
  'poor_accuracy',
  'outside_fence',
  'late_sync',
]);

export const hrLeaveAccrualEnum = pgEnum('hr_leave_accrual', [
  'yearly_upfront',
  'monthly',
  'none',
]);

/**
 * What a ledger row records (058-leave AC-LV2). Credits are lots: `accrual`,
 * `carry_forward` and `adjustment`. Debits name the lot they draw from:
 * `taken`, `encashed` and `expiry`. A `reversal` undoes one `taken` row.
 */
export const hrLeaveEntryKindEnum = pgEnum('hr_leave_entry_kind', [
  'accrual',
  'taken',
  'reversal',
  'carry_forward',
  'expiry',
  'adjustment',
  'encashed',
]);

/** How a leave type is paid (058-leave AC-LV1): `partial` pays `payment_percent` of the day. */
export const hrLeavePaymentEnum = pgEnum('hr_leave_payment', ['paid', 'unpaid', 'partial']);

/** When a type's unused days stop: each year end, each month end, or never. */
export const hrLeaveResetEnum = pgEnum('hr_leave_reset', ['yearly', 'monthly', 'never']);

/** What a yearly reset carries into the new year. */
export const hrLeaveCarryEnum = pgEnum('hr_leave_carry', ['none', 'carry', 'carry_with_expiry']);

export const hrLeaveRequestStatusEnum = pgEnum('hr_leave_request_status', [
  'requested',
  'approved',
  'rejected',
  'cancelled',
]);

export const hrLeaveStartHalfEnum = pgEnum('hr_leave_start_half', [
  'full',
  'second_half',
]);

export const hrLeaveEndHalfEnum = pgEnum('hr_leave_end_half', [
  'full',
  'first_half',
]);

export const hrPayRunStatusEnum = pgEnum('hr_pay_run_status', [
  'draft',
  'confirmed',
]);

// The people file (ADR-058, 058-people-file). The tables are in people-file.ts;
// the vocabulary sits here with the rest, and employee types beside the file
// that points at them.
export const hrMaritalStatusEnum = pgEnum('hr_marital_status', [
  'single',
  'married',
  'divorced',
  'widowed',
]);
/** A tag's colour, by the status vocabulary the screens already draw, never a hex. */
export const hrTagToneEnum = pgEnum('hr_tag_tone', ['neutral', 'info', 'ok', 'warn', 'bad']);
export const hrPayAccountKindEnum = pgEnum('hr_pay_account_kind', ['bank', 'momo']);
export const hrPayAccountStatusEnum = pgEnum('hr_pay_account_status', ['active', 'retired']);
export const hrDocumentStatusEnum = pgEnum('hr_document_status', [
  'requested',
  'submitted',
  'approved',
  'rejected',
]);
export const hrDocumentVersionStatusEnum = pgEnum('hr_document_version_status', [
  'submitted',
  'approved',
  'rejected',
]);
export const hrPublishStatusEnum = pgEnum('hr_publish_status', ['published', 'archived']);
export const hrAudienceEnum = pgEnum('hr_audience', ['all', 'targeted']);
export const hrDisciplinaryKindEnum = pgEnum('hr_disciplinary_kind', [
  'warning',
  'suspension',
  'dismissal',
]);
export const hrLengthUnitEnum = pgEnum('hr_length_unit', ['days', 'hours']);

// --- Positions and the file --------------------------------------------------

/**
 * A business's kinds of employment (full time, seasonal, intern...). Archived,
 * never deleted: an archived type stays on the files that carry it and is not
 * offered for new ones (058-people-file AC-PF11).
 */
export const employeeTypes = pgTable(
  'employee_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    status: hrCatalogStatusEnum('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('employee_types_title_uk')
      .on(t.orgId, sql`lower(${t.title})`)
      .where(sql`${t.status} = 'active'`),
  ],
);

/** A business's job titles. Slice 2 builds their screens; the table is here now. */
export const jobPositions = pgTable(
  'job_positions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    departmentCategory: departmentCategoryEnum('department_category'),
    status: hrCatalogStatusEnum('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('job_positions_title_uk')
      .on(t.orgId, sql`lower(${t.title})`)
      .where(sql`${t.status} = 'active'`),
  ],
);

/**
 * One person's HR file at one business (cross child contract 3).
 *
 * `org_membership_id` is how a file gets an account and a role; the file never
 * holds a role itself. A cook who never signs in has a file and no membership.
 *
 * The statutory columns are nullable only for files the first migration
 * backfilled from memberships; the create route requires them, and a contract
 * cannot start while one is missing.
 */
export const employees = pgTable(
  'employees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    orgMembershipId: uuid('org_membership_id').references(() => orgMemberships.id),
    employeeNumber: text('employee_number').notNull(),
    /** As on the ID. */
    legalName: text('legal_name').notNull(),
    preferredName: text('preferred_name'),
    /** E.164, normalised as ADR-039 normalises a sign in number. */
    phone: text('phone'),
    /** Lowercased. */
    email: text('email'),
    dateOfBirth: date('date_of_birth'),
    sex: hrSexEnum('sex'),
    idDocumentType: hrIdDocumentTypeEnum('id_document_type'),
    idDocumentNumber: text('id_document_number'),
    rssbNumber: text('rssb_number'),
    /** The branch they work at. Branch limits (ADR-054) narrow by this column. */
    workPropertyId: uuid('work_property_id').references(() => properties.id),
    jobPositionId: uuid('job_position_id').references(() => jobPositions.id),
    reportingManagerId: uuid('reporting_manager_id').references(
      (): AnyPgColumn => employees.id,
    ),
    hiredOn: date('hired_on').notNull(),
    status: hrEmployeeStatusEnum('status').notNull().default('active'),
    offboardedOn: date('offboarded_on'),
    offboardReason: text('offboard_reason'),
    // --- The people file (058-people-file AC-PF1). Personal fields are read in
    // the full view only (AC-PF2); the presenter, not this table, decides that.
    /** A stored object of kind `staff_photo`; read through a short signed link. */
    photoKey: text('photo_key'),
    maritalStatus: hrMaritalStatusEnum('marital_status'),
    childrenCount: integer('children_count'),
    villageId: integer('village_id').references(() => villages.id),
    street: text('street'),
    emergencyName: text('emergency_name'),
    /** E.164, as `phone`. */
    emergencyPhone: text('emergency_phone'),
    emergencyRelation: text('emergency_relation'),
    qualification: text('qualification'),
    priorExperienceYears: integer('prior_experience_years'),
    employeeTypeId: uuid('employee_type_id').references(() => employeeTypes.id),
    /** The file this one rehired, when a leaver came back (AC-PF14). */
    previousEmployeeId: uuid('previous_employee_id').references((): AnyPgColumn => employees.id),
    /**
     * Where service based rules count from: the hire date, unless a rehire is
     * credited with the earlier employment (AC-PF14). Backfilled from
     * `hired_on` by migration 0057, and written with it on every create.
     */
    serviceFrom: date('service_from').notNull(),
    /** The business's own pay grade ("H2"): a work field, free text until grades carry bands. */
    grade: text('grade'),
    ...timestamps,
  },
  (t) => [
    unique('employees_number_uk').on(t.orgId, t.employeeNumber),
    // One ACTIVE file per account per employer. A leaver's old file keeps the
    // membership it had, and a returning member reuses that same membership row
    // (staff-invitation.repository), so only the active file is unique.
    uniqueIndex('employees_membership_uk')
      .on(t.orgMembershipId)
      .where(sql`${t.orgMembershipId} IS NOT NULL AND ${t.status} = 'active'`),
    // One ACTIVE file per person per employer, whenever the ID is known (AC-P3).
    // Active only since 058-people-file AC-PF14: a leaver may be rehired as a
    // new file, which names the old one in `previous_employee_id`.
    uniqueIndex('employees_id_document_uk')
      .on(t.orgId, t.idDocumentType, t.idDocumentNumber)
      .where(sql`${t.idDocumentNumber} IS NOT NULL AND ${t.status} = 'active'`),
    check(
      'employees_children_ck',
      sql`${t.childrenCount} IS NULL OR ${t.childrenCount} BETWEEN 0 AND 30`,
    ),
    check(
      'employees_experience_ck',
      sql`${t.priorExperienceYears} IS NULL OR ${t.priorExperienceYears} BETWEEN 0 AND 60`,
    ),
    check('employees_service_from_ck', sql`${t.serviceFrom} <= ${t.hiredOn}`),
    index('employees_org_status_idx').on(t.orgId, t.status),
    index('employees_work_property_idx').on(t.workPropertyId),
    index('employees_reporting_manager_idx').on(t.reportingManagerId),
    check(
      'employees_offboarded_ck',
      sql`(${t.status} = 'offboarded') = (${t.offboardedOn} IS NOT NULL)`,
    ),
  ],
);

/**
 * The next employee number per business. Minting is `UPDATE … RETURNING`, so
 * two creates at once take two numbers.
 */
export const hrCounters = pgTable('hr_counters', {
  orgId: uuid('org_id')
    .primaryKey()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  nextEmployeeNumber: integer('next_employee_number').notNull().default(1),
  ...timestamps,
});

/**
 * What a person is paid, and from when. Pay lives here, never on the file, and
 * a wage change is a new contract.
 *
 * `status` is for display and for the index that allows one active contract per
 * person. Pay and leave read `starts_on` and `ends_on`, never the status.
 */
export const employmentContracts = pgTable(
  'employment_contracts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    contractType: hrContractTypeEnum('contract_type').notNull(),
    startsOn: date('starts_on').notNull(),
    /** Null: open ended. */
    endsOn: date('ends_on'),
    wageBasis: hrWageBasisEnum('wage_basis').notNull(),
    wageRwf: amount('wage_rwf').notNull(),
    status: hrContractStatusEnum('status').notNull(),
    endReason: text('end_reason'),
    // 058-payroll: the components the contract carries, its notice and its paper.
    /** Its foreign key to `pay_structures` is hand written in migration 0062 (people-pay.ts imports this file). */
    payStructureId: uuid('pay_structure_id'),
    noticeDays: integer('notice_days'),
    documentKey: text('document_key'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    /** The last day of probation, when the contract starts one. */
    probationEndsOn: date('probation_ends_on'),
    /** Why this contract was made: a hire, an annual review, a promotion. */
    changeReason: text('change_reason'),
    ...timestamps,
  },
  (t) => [
    check(
      'employment_contracts_probation_ck',
      sql`${t.probationEndsOn} IS NULL OR ${t.probationEndsOn} >= ${t.startsOn}`,
    ),
    uniqueIndex('employment_contracts_one_active_uk')
      .on(t.employeeId)
      .where(sql`${t.status} = 'active'`),
    index('employment_contracts_employee_idx').on(t.employeeId, t.startsOn),
    index('employment_contracts_org_dates_idx').on(t.orgId, t.startsOn),
    check('employment_contracts_wage_ck', sql`${t.wageRwf} > 0`),
    check(
      'employment_contracts_dates_ck',
      sql`${t.endsOn} IS NULL OR ${t.endsOn} >= ${t.startsOn}`,
    ),
    check(
      'employment_contracts_fixed_term_ck',
      sql`${t.contractType} <> 'fixed_term' OR ${t.endsOn} IS NOT NULL`,
    ),
    check('employment_contracts_notice_ck', sql`${t.noticeDays} IS NULL OR ${t.noticeDays} BETWEEN 0 AND 365`),
  ],
);

/**
 * Who works in which department (§14.3, D17), with or without an account.
 *
 * The HR module's one roster (ADR-058 cross child contract 5). It decides whose
 * board a task appears on and never what anybody may do: permission scope stays
 * on the membership's role. A row names a file (`employee_id`), a membership, or
 * both; boards route only to rows whose person has an account, which is why
 * `user_id` stays denormalised here and why the queries that feed a board join
 * on it.
 *
 * Moved from `operations.ts` with ADR-058, unchanged except for `employee_id`
 * and the two account columns becoming optional.
 */
export const departmentMembers = pgTable(
  'department_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'cascade' }),
    orgMembershipId: uuid('org_membership_id').references(
      () => orgMemberships.id,
      { onDelete: 'cascade' },
    ),
    /** Denormalized from the membership so a board query needs no join. */
    userId: uuid('user_id').references(() => users.id),
    employeeId: uuid('employee_id').references(() => employees.id),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    departmentPosition: departmentPositionEnum('department_position')
      .notNull()
      .default('staff'),
    /** Free text ranks the enum deliberately omits: therapist, waiter, concierge. */
    jobTitles: jsonb('job_titles'),
    /** The staffer's home department, the one their shift board defaults to. */
    isPrimary: boolean('is_primary').notNull().default(false),
    status: departmentMemberStatusEnum('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    index('department_members_department_idx').on(t.departmentId),
    index('department_members_user_idx').on(t.userId),
    index('department_members_employee_idx').on(t.employeeId),
    uniqueIndex('department_members_active_uk')
      .on(t.departmentId, t.userId)
      .where(sql`${t.status} = 'active'`),
    uniqueIndex('department_members_active_employee_uk')
      .on(t.departmentId, t.employeeId)
      .where(sql`${t.status} = 'active' AND ${t.employeeId} IS NOT NULL`),
    check(
      'department_members_person_ck',
      sql`${t.employeeId} IS NOT NULL OR ${t.orgMembershipId} IS NOT NULL`,
    ),
  ],
);

// --- Time --------------------------------------------------------------------

/** A named shift at one branch. An end at or before the start crosses midnight. */
export const shiftTemplates = pgTable(
  'shift_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    departmentId: uuid('department_id').references(() => departments.id),
    name: text('name').notNull(),
    startsAt: time('starts_at').notNull(),
    endsAt: time('ends_at').notNull(),
    breakMinutes: integer('break_minutes').notNull().default(0),
    /** Overtime counts only past this much work; null: the shift's length less its break (058-time AC-TM7). */
    minWorkMinutes: integer('min_work_minutes'),
    /** Minutes after the shift's end the sweep closes a record still open (AC-TM4); null: never. */
    autoClockOutMinutes: integer('auto_clock_out_minutes'),
    status: hrCatalogStatusEnum('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    check(
      'shift_templates_minutes_ck',
      sql`(${t.minWorkMinutes} IS NULL OR ${t.minWorkMinutes} BETWEEN 0 AND 1440)
        AND (${t.autoClockOutMinutes} IS NULL OR ${t.autoClockOutMinutes} BETWEEN 0 AND 720)`,
    ),
    uniqueIndex('shift_templates_name_uk')
      .on(t.propertyId, sql`lower(${t.name})`)
      .where(sql`${t.status} = 'active'`),
    check('shift_templates_times_ck', sql`${t.startsAt} <> ${t.endsAt}`),
    check('shift_templates_break_ck', sql`${t.breakMinutes} >= 0`),
  ],
);

/**
 * One person on one shift on one day. The instants are computed from the
 * template's times on `work_date` in `Africa/Kigali` when the row is written.
 *
 * Two SCHEDULED entries of one person may not overlap in time, and the database
 * refuses it even when two requests race: `roster_entries_no_overlap`, an
 * EXCLUDE constraint in migration 0053.
 */
export const rosterEntries = pgTable(
  'roster_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    shiftTemplateId: uuid('shift_template_id')
      .notNull()
      .references(() => shiftTemplates.id),
    /** Copied from the template, so a later edit of it never moves a past shift. */
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    departmentId: uuid('department_id').references(() => departments.id),
    workDate: date('work_date').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    status: hrRosterStatusEnum('status').notNull().default('scheduled'),
    cancelReason: text('cancel_reason'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    /**
     * Null: a draft only managers see (058-time AC-TM1). Migration 0059 stamps
     * every entry slice 1 wrote with its `created_at`.
     */
    publishedAt: timestamp('published_at', { withTimezone: true }),
    /** The rotation assignment that generated it (AC-TM3); its foreign key is hand written in 0059. */
    rotationAssignmentId: uuid('rotation_assignment_id'),
    /** The approved shift or swap request that wrote it (AC-TM5); its foreign key is hand written in 0059. */
    shiftRequestId: uuid('shift_request_id'),
    ...timestamps,
  },
  (t) => [
    index('roster_entries_property_date_idx').on(t.propertyId, t.workDate),
    index('roster_entries_rotation_idx')
      .on(t.rotationAssignmentId, t.workDate)
      .where(sql`${t.rotationAssignmentId} IS NOT NULL`),
    index('roster_entries_employee_date_idx').on(t.employeeId, t.workDate),
    check('roster_entries_times_ck', sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

/**
 * A clock in and, once closed, a clock out.
 *
 * A correction never edits a record: it writes a new closed one pointing at the
 * original (`supersedes_id`), and the original becomes `superseded`. One open
 * record per person, and one correction per original.
 */
export const attendanceRecords = pgTable(
  'attendance_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    rosterEntryId: uuid('roster_entry_id').references(() => rosterEntries.id),
    /** The roster entry's date when linked, else the clock in date in Kigali. */
    workDate: date('work_date').notNull(),
    clockInAt: timestamp('clock_in_at', { withTimezone: true }).notNull(),
    clockOutAt: timestamp('clock_out_at', { withTimezone: true }),
    source: hrAttendanceSourceEnum('source').notNull(),
    recordedByUserId: uuid('recorded_by_user_id').references(() => users.id),
    validated: boolean('validated').notNull().default(false),
    validatedByUserId: uuid('validated_by_user_id').references(() => users.id),
    status: hrAttendanceStatusEnum('status').notNull().default('open'),
    supersedesId: uuid('supersedes_id').references(
      (): AnyPgColumn => attendanceRecords.id,
    ),
    note: text('note'),
    // 058-time AC-TM9: where a phone punch was sent from, and how far from the
    // branch, for the clock in and the clock out apart. Personal data: read only
    // by `attendance.approve` holders working the validation queue.
    inLatitude: numeric('in_latitude', { precision: 9, scale: 6 }),
    inLongitude: numeric('in_longitude', { precision: 9, scale: 6 }),
    inAccuracyM: integer('in_accuracy_m'),
    inDistanceM: integer('in_distance_m'),
    outLatitude: numeric('out_latitude', { precision: 9, scale: 6 }),
    outLongitude: numeric('out_longitude', { precision: 9, scale: 6 }),
    outAccuracyM: integer('out_accuracy_m'),
    outDistanceM: integer('out_distance_m'),
    /** The kiosk a punch came from (AC-TM10); its foreign key is hand written in 0059. */
    kioskId: uuid('kiosk_id'),
    // AC-TM7, computed when the record closes, whole minutes; null while open.
    lateMinutes: integer('late_minutes'),
    earlyMinutes: integer('early_minutes'),
    workedMinutes: integer('worked_minutes'),
    overtimeMinutes: integer('overtime_minutes'),
    /** What of the overtime pay may count (AC-TM8): set by the policy or by a person. */
    approvedOvertimeMinutes: integer('approved_overtime_minutes'),
    dayKind: hrDayKindEnum('day_kind'),
    /** Closed by the sweep, not by a person (AC-TM4). */
    autoClosed: boolean('auto_closed').notNull().default(false),
    // Mobile spec 0003 (D-ac, D-ao): when a phone punch reached the server, the
    // tap the phone reported (its `occurredAt`), and why it waits for
    // validation. Null for kiosk and supervisor punches.
    inReceivedAt: timestamp('in_received_at', { withTimezone: true }),
    inDeviceAt: timestamp('in_device_at', { withTimezone: true }),
    outReceivedAt: timestamp('out_received_at', { withTimezone: true }),
    outDeviceAt: timestamp('out_device_at', { withTimezone: true }),
    inPendingReason: attendancePendingReasonEnum('in_pending_reason'),
    outPendingReason: attendancePendingReasonEnum('out_pending_reason'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('attendance_records_one_open_uk')
      .on(t.employeeId)
      .where(sql`${t.status} = 'open'`),
    uniqueIndex('attendance_records_supersedes_uk')
      .on(t.supersedesId)
      .where(sql`${t.supersedesId} IS NOT NULL`),
    index('attendance_records_employee_date_idx').on(t.employeeId, t.workDate),
    index('attendance_records_org_date_idx').on(t.orgId, t.workDate),
    check(
      'attendance_records_times_ck',
      sql`${t.clockOutAt} IS NULL OR ${t.clockOutAt} > ${t.clockInAt}`,
    ),
  ],
);

// --- Leave -------------------------------------------------------------------

/**
 * A business's leave types, created once from the `hr.rw.leave_defaults` row in
 * force on the business's first HR read (AC-L1).
 */
export const leaveTypes = pgTable(
  'leave_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    /** Null: no balance is kept, as for unpaid leave. */
    yearlyEntitlementDays: numeric('yearly_entitlement_days', {
      precision: 5,
      scale: 1,
      mode: 'number',
    }),
    accrual: hrLeaveAccrualEnum('accrual').notNull(),
    /** The most a yearly reset carries (AC-LV1); the column keeps slice 1's name. */
    carryMaxDays: numeric('carry_forward_max_days', {
      precision: 5,
      scale: 1,
      mode: 'number',
    })
      .notNull()
      .default(0),
    // --- 058-leave AC-LV1: one consolidated list of a type's rules ---
    payment: hrLeavePaymentEnum('payment').notNull().default('paid'),
    /** The share of a day's wage a `partial` type pays, 0 to 100. */
    paymentPercent: integer('payment_percent'),
    reset: hrLeaveResetEnum('reset').notNull().default('yearly'),
    carry: hrLeaveCarryEnum('carry').notNull().default('none'),
    /** How long a carried lot lives, 1 to 12 months; a compensatory type's days live as long. */
    carryExpiresMonths: integer('carry_expires_months'),
    /** 0: approved at request; 1 or 2 steps. */
    approvalSteps: integer('approval_steps').notNull().default(1),
    needsAttachment: boolean('needs_attachment').notNull().default(false),
    /** Inside a range, a weekly day off counts as a day of this leave. */
    countsWeeklyOffs: boolean('counts_weekly_offs').notNull().default(false),
    /** Inside a range, a holiday counts as a day of this leave. */
    countsHolidays: boolean('counts_holidays').notNull().default(false),
    eligibleSex: hrSexEnum('eligible_sex'),
    minServiceMonths: integer('min_service_months').notNull().default(0),
    oncePerEmployment: boolean('once_per_employment').notNull().default(false),
    /** Never restricted by a restricted period (AC-LV9). */
    statutory: boolean('statutory').notNull().default(false),
    /** Self service may start it up to 30 days back, as for sick leave. */
    allowsPastRequests: boolean('allows_past_requests').notNull().default(false),
    encashable: boolean('encashable').notNull().default(false),
    /** Where compensatory days land (AC-LV8). */
    compensatory: boolean('compensatory').notNull().default(false),
    /** Every N completed years of service... */
    seniorityEveryYears: integer('seniority_every_years'),
    /** ...M extra days a year... */
    seniorityExtraDays: numeric('seniority_extra_days', { precision: 5, scale: 1, mode: 'number' }),
    /** ...up to this many in all. */
    seniorityCapDays: numeric('seniority_cap_days', { precision: 5, scale: 1, mode: 'number' }),
    /** The defaults row this type came from. */
    configEntryId: uuid('config_entry_id'),
    /**
     * When the owner signed the type off as the business's policy. Null: still
     * the configured value nobody has verified (a national default awaiting the
     * payroll expert, or an edit awaiting the owner).
     */
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedByUserId: uuid('verified_by_user_id').references(() => users.id),
    status: hrCatalogStatusEnum('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    unique('leave_types_code_uk').on(t.orgId, t.code),
    check(
      'leave_types_payment_ck',
      sql`(${t.payment} = 'partial') = (${t.paymentPercent} IS NOT NULL)
        AND (${t.paymentPercent} IS NULL OR ${t.paymentPercent} BETWEEN 0 AND 100)`,
    ),
    check(
      'leave_types_carry_ck',
      sql`(${t.carry} <> 'carry_with_expiry' OR ${t.carryExpiresMonths} IS NOT NULL)
        AND (${t.carryExpiresMonths} IS NULL OR ${t.carryExpiresMonths} BETWEEN 1 AND 12)
        AND (${t.reset} = 'yearly' OR ${t.carry} = 'none')`,
    ),
    check('leave_types_steps_ck', sql`${t.approvalSteps} BETWEEN 0 AND 2`),
    check('leave_types_service_ck', sql`${t.minServiceMonths} BETWEEN 0 AND 600`),
    check(
      'leave_types_seniority_ck',
      sql`(${t.seniorityEveryYears} IS NULL) = (${t.seniorityExtraDays} IS NULL)
        AND (${t.seniorityEveryYears} IS NULL OR ${t.seniorityEveryYears} BETWEEN 1 AND 50)`,
    ),
  ],
);

/**
 * The append only leave ledger. A balance is the sum of its rows, never a stored
 * number, and no code path updates or deletes one.
 *
 * `period_key` (`YYYY-MM` or `YYYY`) makes the daily job's accruals idempotent:
 * a rerun, or a catch up after downtime, writes nothing twice.
 */
export const leaveLedgerEntries = pgTable(
  'leave_ledger_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    leaveTypeId: uuid('leave_type_id')
      .notNull()
      .references(() => leaveTypes.id),
    kind: hrLeaveEntryKindEnum('kind').notNull(),
    /** Signed. */
    days: numeric('days', { precision: 5, scale: 1, mode: 'number' }).notNull(),
    effectiveOn: date('effective_on').notNull(),
    periodKey: text('period_key'),
    leaveRequestId: uuid('leave_request_id').references(
      (): AnyPgColumn => leaveRequests.id,
    ),
    reversesId: uuid('reverses_id').references(
      (): AnyPgColumn => leaveLedgerEntries.id,
    ),
    reason: text('reason'),
    /** A credit's last chance (058-leave AC-LV2): a carried or compensatory lot. Credits only. */
    expiresOn: date('expires_on'),
    /**
     * The credit a debit draws from (AC-LV2). Always set on `expiry` and
     * `encashed`; set on `taken` when a written lot funds it, null for a part
     * funded by accrual not yet earned or a type that keeps no balance; a
     * `reversal` copies the row it reverses.
     */
    lotId: uuid('lot_id').references((): AnyPgColumn => leaveLedgerEntries.id),
    /** The allocation request an `adjustment` answers; its foreign key is in migration 0060. */
    allocationRequestId: uuid('allocation_request_id'),
    /** Null: the daily job wrote it. */
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('leave_ledger_employee_type_idx').on(t.employeeId, t.leaveTypeId),
    index('leave_ledger_lot_idx').on(t.lotId),
    uniqueIndex('leave_ledger_period_uk')
      .on(t.employeeId, t.leaveTypeId, t.kind, t.periodKey)
      .where(sql`${t.kind} IN ('accrual', 'carry_forward')`),
    uniqueIndex('leave_ledger_expiry_lot_uk')
      .on(t.lotId)
      .where(sql`${t.kind} = 'expiry'`),
    uniqueIndex('leave_ledger_reverses_uk')
      .on(t.reversesId)
      .where(sql`${t.reversesId} IS NOT NULL`),
    check(
      'leave_ledger_period_ck',
      sql`${t.kind} NOT IN ('accrual', 'carry_forward') OR ${t.periodKey} IS NOT NULL`,
    ),
    check(
      'leave_ledger_reversal_ck',
      sql`(${t.kind} = 'reversal') = (${t.reversesId} IS NOT NULL)`,
    ),
    // Worded without `encashed`: the value is added in the same migration, and
    // Postgres refuses a new enum value inside the transaction that added it.
    check(
      'leave_ledger_lot_ck',
      sql`(${t.kind} NOT IN ('accrual', 'carry_forward', 'adjustment') OR ${t.lotId} IS NULL)
        AND (${t.kind} IN ('accrual', 'carry_forward', 'adjustment', 'taken', 'reversal') OR ${t.lotId} IS NOT NULL)`,
    ),
    check(
      'leave_ledger_expires_ck',
      sql`${t.expiresOn} IS NULL OR ${t.kind} IN ('accrual', 'carry_forward', 'adjustment')`,
    ),
  ],
);

/**
 * A request for leave. Two OPEN requests (requested or approved) of one person
 * may not overlap: `leave_requests_no_overlap`, an EXCLUDE constraint in
 * migration 0053.
 */
export const leaveRequests = pgTable(
  'leave_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    leaveTypeId: uuid('leave_type_id')
      .notNull()
      .references(() => leaveTypes.id),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on').notNull(),
    startHalf: hrLeaveStartHalfEnum('start_half').notNull().default('full'),
    endHalf: hrLeaveEndHalfEnum('end_half').notNull().default('full'),
    /** The estimate, replaced by the approved figure. */
    days: numeric('days', { precision: 5, scale: 1, mode: 'number' }).notNull(),
    reason: text('reason'),
    status: hrLeaveRequestStatusEnum('status').notNull().default('requested'),
    /** The reporting manager at request time. Orders the queue; grants nothing. */
    routedToEmployeeId: uuid('routed_to_employee_id').references(
      (): AnyPgColumn => employees.id,
    ),
    requestedByUserId: uuid('requested_by_user_id').references(() => users.id),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: text('decision_note'),
    // --- 058-leave: copied from the type at request, so an edit never rewrites it ---
    /** A sick note or the like: a private object key (AC-LV6). */
    attachmentKey: text('attachment_key'),
    /** The step a waiting request is at, 1 or 2 (AC-LV7). */
    currentStep: integer('current_step').notNull().default(1),
    approvalSteps: integer('approval_steps').notNull().default(1),
    payment: hrLeavePaymentEnum('payment').notNull().default('paid'),
    paymentPercent: integer('payment_percent'),
    ...timestamps,
  },
  (t) => [
    index('leave_requests_org_status_idx').on(t.orgId, t.status),
    index('leave_requests_employee_idx').on(t.employeeId, t.startsOn),
    check('leave_requests_dates_ck', sql`${t.endsOn} >= ${t.startsOn}`),
    check(
      'leave_requests_steps_ck',
      sql`${t.approvalSteps} BETWEEN 0 AND 2 AND ${t.currentStep} BETWEEN 1 AND 2`,
    ),
  ],
);

// --- Pay ---------------------------------------------------------------------

/** How a confirmed payslip was paid (058-payroll AC-PY10). */
export const hrPaidMethodEnum = pgEnum('hr_paid_method', ['bank', 'momo', 'cash']);

/**
 * One month's pay for one business. A draft recomputes freely; confirming
 * computes once more and freezes; a confirmed run never changes.
 */
export const payRuns = pgTable(
  'pay_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    /** Always the first of the month. */
    periodStart: date('period_start').notNull(),
    status: hrPayRunStatusEnum('status').notNull().default('draft'),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull(),
    /** The `config_entries` rows and versions the figures came from. */
    ruleVersions: jsonb('rule_versions').notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    confirmedByUserId: uuid('confirmed_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    unique('pay_runs_period_uk').on(t.orgId, t.periodStart),
    check(
      'pay_runs_period_start_ck',
      sql`extract(day from ${t.periodStart}) = 1`,
    ),
  ],
);

/**
 * One person's pay for one run. Net is gross less what is withheld, and the
 * database refuses any row where it is not (AC-Y4). Employer contributions are
 * shown and declared, never deducted.
 */
export const payslips = pgTable(
  'payslips',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    payRunId: uuid('pay_run_id')
      .notNull()
      .references(() => payRuns.id),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    /** The contract in force on the person's last payable day in the month. */
    contractId: uuid('contract_id')
      .notNull()
      .references(() => employmentContracts.id),
    payableDays: numeric('payable_days', {
      precision: 6,
      scale: 2,
      mode: 'number',
    }).notNull(),
    grossRwf: amount('gross_rwf').notNull(),
    payeRwf: amount('paye_rwf').notNull(),
    employeeContributionsRwf: amount('employee_contributions_rwf').notNull(),
    employerContributionsRwf: amount('employer_contributions_rwf').notNull(),
    /** Deductions, loan installments and deduction adjustments (058-payroll AC-PY6). */
    otherDeductionsRwf: amount('other_deductions_rwf').notNull().default(0),
    /** Money paid with the net that is not income: a reimbursement, a loan paid out (AC-PY6a). */
    nonIncomeRwf: amount('non_income_rwf').notNull().default(0),
    netRwf: amount('net_rwf').notNull(),
    lines: jsonb('lines').notNull(),
    status: hrPayRunStatusEnum('status').notNull().default('draft'),
    /** The business and the person as they were on the day the run was confirmed (AC-PY11). */
    snapshot: jsonb('snapshot'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    paidMethod: hrPaidMethodEnum('paid_method'),
    paidReference: text('paid_reference'),
    markedPaidByUserId: uuid('marked_paid_by_user_id').references(() => users.id),
    /** When the person first had it: the message reached them, or they downloaded it. */
    sentAt: timestamp('sent_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('payslips_run_employee_uk').on(t.payRunId, t.employeeId),
    index('payslips_employee_idx').on(t.employeeId),
    check(
      'payslips_net_ck',
      sql`${t.netRwf} = ${t.grossRwf} + ${t.nonIncomeRwf} - ${t.payeRwf} - ${t.employeeContributionsRwf} - ${t.otherDeductionsRwf}`,
    ),
    check('payslips_paid_ck', sql`(${t.paidAt} IS NULL) = (${t.paidMethod} IS NULL) AND (${t.paidAt} IS NULL OR ${t.status} = 'confirmed')`),
  ],
);
