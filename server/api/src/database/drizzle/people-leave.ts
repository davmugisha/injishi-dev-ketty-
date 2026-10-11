/**
 * Leave in full (ADR-058, 058-leave): each decision of a two step request,
 * requests for extra or compensatory days, and restricted periods.
 *
 * The rules of people.ts hold here too. Every table carries `org_id`. A
 * decision and an allocation request end decided or cancelled, never deleted.
 * A restricted period is a setting, edited in place.
 *
 * `leave_ledger_entries.allocation_request_id` points INTO this file; its
 * foreign key is hand written in migration 0060, below its marker, because
 * declaring it here would make people.ts and this file import each other.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './auth';
import { timestamps } from './columns';
import { departments } from './operations';
import { orgs } from './org';
import { attendanceRecords, employees, jobPositions, leaveRequests, leaveTypes } from './people';

/** One step's decision; `skipped` when no second, different decider exists for the branch (AC-LV7). */
export const hrLeaveDecisionEnum = pgEnum('hr_leave_decision', ['approved', 'rejected', 'skipped']);
export const hrLeaveAllocationKindEnum = pgEnum('hr_leave_allocation_kind', ['extra', 'compensatory']);
export const hrLeaveAllocationStatusEnum = pgEnum('hr_leave_allocation_status', [
  'requested',
  'approved',
  'rejected',
  'cancelled',
]);
/** Which types a restricted period covers: all of them, only the listed ones, or all but those. */
export const hrRestrictedTypeModeEnum = pgEnum('hr_restricted_type_mode', ['all', 'only', 'except']);

/** Each decision of a leave request, one per step (058-leave AC-LV7). Append only. */
export const leaveRequestApprovals = pgTable(
  'leave_request_approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    requestId: uuid('request_id')
      .notNull()
      .references(() => leaveRequests.id),
    step: integer('step').notNull(),
    decision: hrLeaveDecisionEnum('decision').notNull(),
    /** Null for a skipped step: nobody decided it. */
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    note: text('note'),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('leave_request_approvals_step_uk').on(t.requestId, t.step),
    check('leave_request_approvals_step_ck', sql`${t.step} IN (1, 2)`),
    check(
      'leave_request_approvals_decider_ck',
      sql`(${t.decision} = 'skipped') = (${t.decidedByUserId} IS NULL)`,
    ),
  ],
);

/**
 * A request for days added to a balance (058-leave AC-LV8): extra days on a
 * type, or compensatory days for one worked holiday or day off. Approval writes
 * one `adjustment` lot naming it.
 */
export const leaveAllocationRequests = pgTable(
  'leave_allocation_requests',
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
    kind: hrLeaveAllocationKindEnum('kind').notNull(),
    days: numeric('days', { precision: 5, scale: 1, mode: 'number' }).notNull(),
    /** The worked holiday or day off a compensatory request is for. */
    attendanceRecordId: uuid('attendance_record_id').references(() => attendanceRecords.id),
    /** Its work date: a person earns compensation once per date, whatever corrections follow. */
    workDate: date('work_date'),
    reason: text('reason').notNull(),
    status: hrLeaveAllocationStatusEnum('status').notNull().default('requested'),
    routedToEmployeeId: uuid('routed_to_employee_id').references(() => employees.id),
    requestedByUserId: uuid('requested_by_user_id').references(() => users.id),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: text('decision_note'),
    ...timestamps,
  },
  (t) => [
    check('leave_allocation_requests_days_ck', sql`${t.days} > 0 AND ${t.days} <= 366`),
    check(
      'leave_allocation_requests_kind_ck',
      sql`(${t.kind} = 'compensatory') = (${t.attendanceRecordId} IS NOT NULL AND ${t.workDate} IS NOT NULL)`,
    ),
    uniqueIndex('leave_allocation_requests_compensated_uk')
      .on(t.employeeId, t.workDate)
      .where(sql`${t.kind} = 'compensatory' AND ${t.status} IN ('requested', 'approved')`),
    index('leave_allocation_requests_open_idx').on(t.orgId, t.status),
  ],
);

/**
 * A period in which leave is refused (058-leave AC-LV9): high season, an
 * inspection. A department and job positions narrow it together; the type mode
 * and its listed types say which leave it covers. Statutory types never fall
 * under one.
 */
export const restrictedLeavePeriods = pgTable(
  'restricted_leave_periods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    fromDate: date('from_date').notNull(),
    toDate: date('to_date').notNull(),
    departmentId: uuid('department_id').references(() => departments.id),
    typeMode: hrRestrictedTypeModeEnum('type_mode').notNull().default('all'),
    description: text('description'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    check('restricted_leave_periods_dates_ck', sql`${t.toDate} >= ${t.fromDate} AND ${t.toDate} - ${t.fromDate} <= 366`),
    index('restricted_leave_periods_org_idx').on(t.orgId, t.fromDate),
  ],
);

/** A job position a restricted period narrows to, or a leave type its mode lists. */
export const restrictedLeaveScopes = pgTable(
  'restricted_leave_scopes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    periodId: uuid('period_id')
      .notNull()
      .references(() => restrictedLeavePeriods.id, { onDelete: 'cascade' }),
    jobPositionId: uuid('job_position_id').references(() => jobPositions.id),
    leaveTypeId: uuid('leave_type_id').references(() => leaveTypes.id),
  },
  (t) => [
    check('restricted_leave_scopes_one_ck', sql`(${t.jobPositionId} IS NULL) <> (${t.leaveTypeId} IS NULL)`),
    index('restricted_leave_scopes_period_idx').on(t.periodId),
  ],
);
