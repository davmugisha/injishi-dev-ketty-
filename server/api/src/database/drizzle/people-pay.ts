/**
 * Payroll in full (ADR-058, 058-payroll): pay components and structures, loans
 * and their installments, claims, pay adjustments, and the files a confirmed
 * run produces (bank and MoMo exports, PAYE and RSSB declarations).
 *
 * The rules of people.ts hold here too. Every table carries `org_id`. A loan's
 * installments always sum to its amount. An adjustment is paid at most once,
 * by the next unconfirmed run, which stamps its payslip on it at confirm; so do
 * claims and installments. Exports and declarations are append only.
 *
 * `employment_contracts.pay_structure_id` points INTO this file; its foreign
 * key is hand written in migration 0060, below its marker, because declaring
 * it here would make people.ts and this file import each other.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './auth';
import { amount, timestamps } from './columns';
import { orgs } from './org';
import { employees, hrCatalogStatusEnum, leaveTypes, payRuns, payslips } from './people';

export const hrPayComponentKindEnum = pgEnum('hr_pay_component_kind', ['allowance', 'deduction']);
/** How a component's amount is reached (AC-PY5). */
export const hrPayAmountTypeEnum = pgEnum('hr_pay_amount_type', [
  'fixed',
  'percent_basic',
  'percent_gross',
  'per_day_worked',
  'per_hour_worked',
  'per_child',
]);
/** The one field a component's condition may read: a closed list (AC-PY5). */
export const hrPayConditionFieldEnum = pgEnum('hr_pay_condition_field', [
  'sex',
  'marital_status',
  'children',
  'years_of_service',
  'prior_experience',
  'employee_type',
  'job_position',
  'department',
  'branch',
  'wage_basis',
]);
export const hrPayConditionOpEnum = pgEnum('hr_pay_condition_op', ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in']);
export const hrPayTargetModeEnum = pgEnum('hr_pay_target_mode', ['include', 'exclude']);
export const hrLoanKindEnum = pgEnum('hr_loan_kind', ['loan', 'advance']);
/** Paid out on a payslip (a pass through line) or outside Injishi. */
export const hrLoanPaidOutEnum = pgEnum('hr_loan_paid_out', ['payslip', 'outside']);
export const hrPayClaimKindEnum = pgEnum('hr_pay_claim_kind', ['reimbursement', 'leave_encashment']);
export const hrPayClaimStatusEnum = pgEnum('hr_pay_claim_status', ['requested', 'approved', 'rejected', 'cancelled']);
export const hrPayAdjustmentSideEnum = pgEnum('hr_pay_adjustment_side', ['earning', 'deduction']);
/** Who wrote an adjustment: a person, or the module whose event landed in a confirmed month. */
export const hrPayAdjustmentSourceEnum = pgEnum('hr_pay_adjustment_source', [
  'manual',
  'leave',
  'asset_fine',
  'held_payslip',
  'late_claim',
]);
export const hrPayAdjustmentStatusEnum = pgEnum('hr_pay_adjustment_status', ['open', 'waived', 'paid']);
export const hrPayExportKindEnum = pgEnum('hr_pay_export_kind', ['bank', 'momo']);
export const hrPayDeclarationKindEnum = pgEnum('hr_pay_declaration_kind', ['paye', 'rssb']);

/** `YYYY-MM`, as every period in this file is written. */
const PERIOD = `'^[0-9]{4}-(0[1-9]|1[0-2])$'`;

/**
 * An allowance or a deduction (AC-PY5). It applies to a person when it is in
 * their contract's pay structure, or targets all active staff, or includes them,
 * and it does not exclude them, and its condition (if any) holds for their file
 * as it is when the run computes.
 */
export const payComponents = pgTable(
  'pay_components',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    kind: hrPayComponentKindEnum('kind').notNull(),
    /** An allowance: whether it is taxed. */
    taxable: boolean('taxable').notNull().default(true),
    /** An allowance: whether it counts in the contribution base. */
    inContributionBase: boolean('in_contribution_base').notNull().default(false),
    /** A deduction: whether it is taken before tax. */
    beforeTax: boolean('before_tax').notNull().default(false),
    amountType: hrPayAmountTypeEnum('amount_type').notNull(),
    amountRwf: amount('amount_rwf'),
    /** A percentage, 0 to 100, for the two percent kinds. */
    rate: numeric('rate', { precision: 5, scale: 2, mode: 'number' }),
    capRwf: amount('cap_rwf'),
    conditionField: hrPayConditionFieldEnum('condition_field'),
    conditionOp: hrPayConditionOpEnum('condition_op'),
    /** Text; `in` takes a comma separated list. */
    conditionValue: text('condition_value'),
    appliesAllActive: boolean('applies_all_active').notNull().default(false),
    /** A one off: the only `YYYY-MM` it applies in. */
    oneOffPeriod: text('one_off_period'),
    status: hrCatalogStatusEnum('status').notNull().default('active'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('pay_components_code_uk').on(t.orgId, t.code).where(sql`${t.status} = 'active'`),
    check(
      'pay_components_amount_ck',
      sql`(${t.amountType} IN ('percent_basic', 'percent_gross') AND ${t.rate} IS NOT NULL AND ${t.rate} > 0 AND ${t.rate} <= 100 AND ${t.amountRwf} IS NULL)
        OR (${t.amountType} NOT IN ('percent_basic', 'percent_gross') AND ${t.amountRwf} IS NOT NULL AND ${t.amountRwf} > 0 AND ${t.rate} IS NULL)`,
    ),
    check('pay_components_cap_ck', sql`${t.capRwf} IS NULL OR ${t.capRwf} > 0`),
    check(
      'pay_components_condition_ck',
      sql`(${t.conditionField} IS NULL) = (${t.conditionOp} IS NULL) AND (${t.conditionField} IS NULL) = (${t.conditionValue} IS NULL)`,
    ),
    check('pay_components_before_tax_ck', sql`${t.kind} = 'deduction' OR NOT ${t.beforeTax}`),
    check('pay_components_period_ck', sql.raw(`one_off_period IS NULL OR one_off_period ~ ${PERIOD}`)),
  ],
);

/** People a component names directly: included, or left out whatever else applies. */
export const payComponentTargets = pgTable(
  'pay_component_targets',
  {
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    componentId: uuid('component_id')
      .notNull()
      .references(() => payComponents.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    mode: hrPayTargetModeEnum('mode').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'pay_component_targets_pk', columns: [t.componentId, t.employeeId] }),
    index('pay_component_targets_employee_idx').on(t.employeeId),
  ],
);

/** A named set of components a contract may carry (Horilla's salary structure). */
export const payStructures = pgTable(
  'pay_structures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    status: hrCatalogStatusEnum('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [uniqueIndex('pay_structures_name_uk').on(t.orgId, sql`lower(${t.name})`).where(sql`${t.status} = 'active'`)],
);

export const payStructureComponents = pgTable(
  'pay_structure_components',
  {
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    structureId: uuid('structure_id')
      .notNull()
      .references(() => payStructures.id, { onDelete: 'cascade' }),
    componentId: uuid('component_id')
      .notNull()
      .references(() => payComponents.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ name: 'pay_structure_components_pk', columns: [t.structureId, t.componentId] })],
);

/**
 * A loan or a salary advance (AC-PY8), recorded once per `Idempotency-Key`.
 * Its schedule is written with it; `settled_at` is stamped when its last
 * installment is paid.
 */
export const employeeLoans = pgTable(
  'employee_loans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    kind: hrLoanKindEnum('kind').notNull(),
    amountRwf: amount('amount_rwf').notNull(),
    givenOn: date('given_on').notNull(),
    installments: integer('installments').notNull(),
    firstPeriod: text('first_period').notNull(),
    paidOut: hrLoanPaidOutEnum('paid_out').notNull(),
    reason: text('reason'),
    /** The payslip a loan paid out on a payslip was paid with. */
    paidOutPayslipId: uuid('paid_out_payslip_id').references(() => payslips.id),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    idempotencyKey: text('idempotency_key').notNull(),
    ...timestamps,
  },
  (t) => [
    unique('employee_loans_idempotency_uk').on(t.orgId, t.idempotencyKey),
    index('employee_loans_employee_idx').on(t.employeeId),
    check('employee_loans_amount_ck', sql`${t.amountRwf} > 0`),
    check('employee_loans_installments_ck', sql`${t.installments} BETWEEN 1 AND 120`),
    check('employee_loans_period_ck', sql.raw(`first_period ~ ${PERIOD}`)),
  ],
);

/** One month's repayment of a loan. Only one not yet paid moves (a deferral, an early settlement). */
export const loanInstallments = pgTable(
  'loan_installments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => employeeLoans.id),
    period: text('period').notNull(),
    amountRwf: amount('amount_rwf').notNull(),
    /** The period a deferral moved it from. */
    deferredFrom: text('deferred_from'),
    payslipId: uuid('payslip_id').references(() => payslips.id),
    ...timestamps,
  },
  (t) => [
    unique('loan_installments_period_uk').on(t.loanId, t.period),
    index('loan_installments_period_idx').on(t.orgId, t.period),
    check('loan_installments_amount_ck', sql`${t.amountRwf} > 0`),
    check('loan_installments_period_ck', sql.raw(`period ~ ${PERIOD}`)),
  ],
);

/**
 * A reimbursement or a leave encashment (AC-PY9), recorded once per
 * `Idempotency-Key`. `period` is the month it is paid in: its own month while
 * that run is open, the next one once it is confirmed.
 */
export const payClaims = pgTable(
  'pay_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    kind: hrPayClaimKindEnum('kind').notNull(),
    /** A reimbursement's amount. */
    amountRwf: amount('amount_rwf'),
    /** A leave encashment's type and days. */
    leaveTypeId: uuid('leave_type_id').references(() => leaveTypes.id),
    days: numeric('days', { precision: 5, scale: 1, mode: 'number' }),
    period: text('period').notNull(),
    receiptKey: text('receipt_key'),
    reason: text('reason').notNull(),
    status: hrPayClaimStatusEnum('status').notNull().default('requested'),
    requestedByUserId: uuid('requested_by_user_id').references(() => users.id),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: text('decision_note'),
    payslipId: uuid('payslip_id').references(() => payslips.id),
    idempotencyKey: text('idempotency_key').notNull(),
    ...timestamps,
  },
  (t) => [
    unique('pay_claims_idempotency_uk').on(t.orgId, t.idempotencyKey),
    index('pay_claims_employee_idx').on(t.employeeId),
    index('pay_claims_period_idx').on(t.orgId, t.period),
    check(
      'pay_claims_kind_ck',
      sql`(${t.kind} = 'reimbursement' AND ${t.amountRwf} IS NOT NULL AND ${t.amountRwf} > 0 AND ${t.leaveTypeId} IS NULL AND ${t.days} IS NULL)
        OR (${t.kind} = 'leave_encashment' AND ${t.leaveTypeId} IS NOT NULL AND ${t.days} IS NOT NULL AND ${t.days} > 0 AND ${t.amountRwf} IS NULL)`,
    ),
    check('pay_claims_period_ck', sql.raw(`period ~ ${PERIOD}`)),
  ],
);

/**
 * A correction a later run pays or deducts (AC-PY16, index contract 17): the
 * only remedy for a confirmed month. Paid at most once.
 */
export const payAdjustments = pgTable(
  'pay_adjustments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    side: hrPayAdjustmentSideEnum('side').notNull(),
    amountRwf: amount('amount_rwf').notNull(),
    taxable: boolean('taxable').notNull(),
    contributable: boolean('contributable').notNull(),
    /** The month it corrects. */
    correctsPeriod: text('corrects_period').notNull(),
    reason: text('reason').notNull(),
    source: hrPayAdjustmentSourceEnum('source').notNull(),
    /** The row behind it: a leave request, a held pay run, a claim. */
    sourceId: uuid('source_id'),
    status: hrPayAdjustmentStatusEnum('status').notNull().default('open'),
    payslipId: uuid('payslip_id').references(() => payslips.id),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    idempotencyKey: text('idempotency_key'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('pay_adjustments_idempotency_uk').on(t.orgId, t.idempotencyKey).where(sql`${t.idempotencyKey} IS NOT NULL`),
    index('pay_adjustments_employee_idx').on(t.employeeId, t.status),
    check('pay_adjustments_amount_ck', sql`${t.amountRwf} > 0`),
    check('pay_adjustments_period_ck', sql.raw(`corrects_period ~ ${PERIOD}`)),
    check('pay_adjustments_paid_ck', sql`(${t.status} = 'paid') = (${t.payslipId} IS NOT NULL)`),
  ],
);

/** A bank or MoMo file built from a confirmed run (AC-PY10). Append only. */
export const payExports = pgTable(
  'pay_exports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    payRunId: uuid('pay_run_id')
      .notNull()
      .references(() => payRuns.id),
    kind: hrPayExportKindEnum('kind').notNull(),
    fileKey: text('file_key').notNull(),
    rowCount: integer('row_count').notNull(),
    totalRwf: amount('total_rwf').notNull(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('pay_exports_run_idx').on(t.payRunId)],
);

/** A PAYE or RSSB declaration file built from a confirmed run (AC-PY12). Append only. */
export const payDeclarations = pgTable(
  'pay_declarations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    payRunId: uuid('pay_run_id')
      .notNull()
      .references(() => payRuns.id),
    kind: hrPayDeclarationKindEnum('kind').notNull(),
    /** `provisional` until the accountant's sheet names a format, else the rule row's version. */
    formatVersion: text('format_version').notNull(),
    fileKey: text('file_key').notNull(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('pay_declarations_run_idx').on(t.payRunId)],
);
