/**
 * §HR / PAYROLL LAYER (new domain — no ADR yet; this is a first pass built to
 * match the schema's existing conventions, pending team review).
 *
 * Salary is versioned by INSERT, never UPDATE, mirroring `registration_fees`:
 * a raise must never rewrite what a past payslip was actually calculated
 * against. PAYE and RSSB rates are computed by app code (mocked for now,
 * ADR pending on the real Rwandan brackets) and stamped onto each payslip at
 * calculation time, for the same reason `folio_charges.tax_rate` is
 * snapshotted rather than joined.
 */
import { sql } from 'drizzle-orm';
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  jsonb,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { amount, currency, timestamps } from './columns';
import { departmentMembers } from './operations';
import { workspaces } from './org';

export const compensationStatusEnum = pgEnum('compensation_status', [
  'active',
  'archived',
]);

/**
 * One employee's pay rate, versioned by insert (mirrors `registration_fees`).
 * `archived` on the old row when a new one takes effect; never edited in place,
 * so a payslip calculated in March still points at what March actually paid.
 */
export const staffCompensation = pgTable(
  'staff_compensation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    departmentMemberId: uuid('department_member_id')
      .notNull()
      .references(() => departmentMembers.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    baseSalaryRwf: amount('base_salary_rwf').notNull(),
    currency: currency(),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
    status: compensationStatusEnum('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    index('staff_compensation_member_idx').on(t.departmentMemberId),
    index('staff_compensation_workspace_idx').on(t.workspaceId),
  ],
);

export const payrollRunStatusEnum = pgEnum('payroll_run_status', [
  'draft',
  'pending_approval',
  'approved',
  'paid',
  'cancelled',
]);

/**
 * One pay period for one workspace. Nothing pays without passing through
 * `approved` first — mirroring the booking approval flow elsewhere in this
 * app, money never moves off a single unreviewed click.
 */
export const payrollRuns = pgTable(
  'payroll_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    status: payrollRunStatusEnum('status').notNull().default('draft'),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    totalGrossRwf: amount('total_gross_rwf').notNull().default(0),
    totalNetRwf: amount('total_net_rwf').notNull().default(0),
    currency: currency(),
    ...timestamps,
  },
  (t) => [
    index('payroll_runs_workspace_idx').on(t.workspaceId, t.status),
    unique('payroll_runs_workspace_period_uk').on(
      t.workspaceId,
      t.periodStart,
      t.periodEnd,
    ),
  ],
);

export const payslipStatusEnum = pgEnum('payslip_status', [
  'pending',
  'paid',
  'failed',
]);

/**
 * One employee's line within a payroll run. PAYE and RSSB are stamped here at
 * calculation time (currently mocked flat rates — see PAYROLL_ADAPTER_MODE),
 * so a later rate change never re-prices a payslip already issued, the same
 * reasoning `folio_charges.tax_rate` documents.
 */
export const payslips = pgTable(
  'payslips',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    payrollRunId: uuid('payroll_run_id')
      .notNull()
      .references(() => payrollRuns.id, { onDelete: 'cascade' }),
    departmentMemberId: uuid('department_member_id')
      .notNull()
      .references(() => departmentMembers.id),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    grossRwf: amount('gross_rwf').notNull(),
    payeRwf: amount('paye_rwf').notNull().default(0),
    rssbEmployeeRwf: amount('rssb_employee_rwf').notNull().default(0),
    rssbEmployerRwf: amount('rssb_employer_rwf').notNull().default(0),
    netRwf: amount('net_rwf').notNull(),
    /**
     * How the figures above were reached, line by line: what was earned, what
     * was withheld, what the business added. Written when the payslip is
     * computed and never recomputed, so a payslip opened next year says what
     * it said the day it was approved, whatever the rates are by then. Empty
     * on a payslip computed before lines were kept; the five amounts still
     * stand.
     */
    lines: jsonb('lines')
      .$type<
        {
          code: string;
          label: string;
          side: 'earning' | 'employee' | 'employer';
          amountRwf: number;
          basis: string | null;
        }[]
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /**
     * What the roster and the clock said about the month when this was
     * computed. Null on a payslip from before payroll read attendance.
     */
    attendance: jsonb('attendance').$type<{
      rosteredDays: number;
      workedDays: number;
      missedDays: number;
      lateDays: number;
      unpaidLeaveDays: number;
      overtimeMinutes: number;
    } | null>(),
    currency: currency(),
    status: payslipStatusEnum('status').notNull().default('pending'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    idempotencyKey: text('idempotency_key'),
    ...timestamps,
  },
  (t) => [
    index('payslips_run_idx').on(t.payrollRunId),
    index('payslips_member_idx').on(t.departmentMemberId),
    unique('payslips_run_member_uk').on(t.payrollRunId, t.departmentMemberId),
    unique('payslips_idempotency_key_uk').on(t.idempotencyKey),
  ],
);