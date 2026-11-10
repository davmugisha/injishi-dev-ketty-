import { z } from 'zod';

/**
 * The ONE reader of Rwanda's HR rules (ADR-058, index contract 8).
 *
 * PAYE bands, RSSB contributions, leave defaults and public holidays are
 * `config_entries` rows, effective dated and versioned, read at compute time.
 * Their shapes are PROVISIONAL until the accountant's sheet arrives, and
 * `058-payroll.md` may reshape them; every consumer reads them through this
 * file, so a reshape touches one file.
 *
 * This file states no rate. The values come from the accountant's sheet, and
 * the production migration is written from it. A row that does not parse is
 * treated exactly like a missing one: anything that computes pay or counts
 * leave refuses with 409 naming the rule (fail closed).
 */

export const HR_RULE = {
  paye: 'hr.rw.paye',
  rssb: 'hr.rw.rssb',
  leaveDefaults: 'hr.rw.leave_defaults',
  publicHolidays: 'hr.rw.public_holidays',
  overtime: 'hr.rw.overtime',
  finalSettlement: 'hr.rw.final_settlement',
  declarationFormats: 'hr.rw.declaration_formats',
} as const;
export type HrRuleType = (typeof HR_RULE)[keyof typeof HR_RULE];

/** What a person reads when a rule is missing: never the config key alone. */
export const HR_RULE_LABEL: Readonly<Record<HrRuleType, string>> = {
  'hr.rw.paye': 'the PAYE tax bands',
  'hr.rw.rssb': 'the RSSB contribution rates',
  'hr.rw.leave_defaults': 'the default leave types',
  'hr.rw.public_holidays': 'the public holidays',
  'hr.rw.overtime': 'how overtime is paid',
  'hr.rw.final_settlement': 'what a leaver is paid at the end',
  'hr.rw.declaration_formats': 'the PAYE and RSSB declaration formats',
};

/**
 * How a line is rounded to the whole franc. Without a statement, half up
 * (index contract 9).
 */
const Rounding = z.enum(['half_up', 'down', 'up']);
export type Rounding = z.infer<typeof Rounding>;

/** A fraction of one, such as 0.03. Never a percentage. */
const Rate = z.number().min(0).max(1);

const PayeBand = z.object({
  fromRwf: z.number().int().nonnegative(),
  toRwf: z.number().int().positive().nullable(),
  rate: Rate,
});

/**
 * The taxable base is a closed list (index contract 8, grown by 058-payroll
 * AC-PY6). The accountant's sheet picks one; adding a value is a change to the
 * ADR, not to a row. `taxable` is the earnings marked taxable, less the
 * deductions taken before tax.
 */
const PayeTaxableBase = z.enum([
  'gross',
  'gross_less_employee_contributions',
  'taxable',
  'taxable_less_employee_contributions',
]);
export type PayeTaxableBase = z.infer<typeof PayeTaxableBase>;

export const PayeRule = z
  .object({
    bands: z.array(PayeBand).min(1),
    taxableBase: PayeTaxableBase,
    rounding: Rounding.optional(),
  })
  // Bands are progressive and must tile the line from zero with no gap and no
  // overlap, the last one open ended. A gap would tax nothing on the francs in
  // it, which is a mistake in the sheet, never a rule, so it is refused here.
  .refine(
    (r) =>
      r.bands[0].fromRwf === 0 &&
      r.bands.every((b, i) =>
        i === r.bands.length - 1
          ? b.toRwf === null
          : b.toRwf !== null && b.toRwf > b.fromRwf && r.bands[i + 1].fromRwf === b.toRwf,
      ),
    { message: 'PAYE bands must start at 0, touch end to end, and end open.' },
  );
export type PayeRule = z.infer<typeof PayeRule>;

/**
 * The base a contribution is charged on: another closed list. `contributable`
 * is the earnings that count in the contribution base (058-payroll AC-PY6).
 */
/**
 * What a contribution is a share of. `net` is pay after PAYE and the other contributions, taken
 * last: CBHI is 0.5% of net salary (Prime Minister's Order 034/01 of 2020).
 */
const ContributionBase = z.enum(['gross', 'basic', 'contributable', 'net']);
export type ContributionBase = z.infer<typeof ContributionBase>;

export const RssbRule = z.object({
  /** Where the figures come from, and whether they are confirmed. */
  note: z.string().optional(),
  contributions: z
    .array(
      z.object({
        code: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/),
        label: z.string().min(1),
        base: ContributionBase,
        employeeRate: Rate,
        employerRate: Rate,
        /** A ceiling on the base, when the contribution has one. */
        capRwf: z.number().int().positive().optional(),
        /**
         * A scheme a business chooses (RSSB's medical scheme is a private employer's choice).
         * It applies only where the business switched it on, or by `defaultOn` where it made no
         * choice.
         */
        optional: z.boolean().optional(),
        defaultOn: z.boolean().optional(),
      }),
    )
    .min(1),
  rounding: Rounding.optional(),
});
export type RssbRule = z.infer<typeof RssbRule>;

/**
 * One default leave type: every rule of 058-leave AC-LV1 (AC-LV12). A row
 * written for slice 1 carries only `paid`, `carryForwardMaxDays` and
 * `needsApproval` beside the entitlement; it reads with them mapped onto
 * `payment`, `carryMaxDays` and `approvalSteps`, and every newer rule at its
 * default.
 */
const LeaveDefaultType = z
  .object({
    code: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/),
    name: z.string().min(1),
    payment: z.enum(['paid', 'unpaid', 'partial']).optional(),
    paymentPercent: z.number().int().min(0).max(100).nullable().default(null),
    /** Null: no balance is kept (unpaid leave). */
    yearlyEntitlementDays: z.number().min(0).max(366).nullable(),
    accrual: z.enum(['yearly_upfront', 'monthly', 'none']),
    reset: z.enum(['yearly', 'monthly', 'never']).optional(),
    carry: z.enum(['none', 'carry', 'carry_with_expiry']).optional(),
    carryMaxDays: z.number().min(0).max(366).optional(),
    carryExpiresMonths: z.number().int().min(1).max(12).nullable().default(null),
    approvalSteps: z.number().int().min(0).max(2).optional(),
    needsAttachment: z.boolean().default(false),
    countsWeeklyOffs: z.boolean().default(false),
    countsHolidays: z.boolean().default(false),
    eligibleSex: z.enum(['female', 'male']).nullable().default(null),
    minServiceMonths: z.number().int().min(0).max(600).default(0),
    oncePerEmployment: z.boolean().default(false),
    statutory: z.boolean().default(false),
    allowsPastRequests: z.boolean().default(false),
    encashable: z.boolean().default(false),
    compensatory: z.boolean().default(false),
    seniorityEveryYears: z.number().int().min(1).max(50).nullable().default(null),
    seniorityExtraDays: z.number().min(0).max(366).nullable().default(null),
    seniorityCapDays: z.number().min(0).max(366).nullable().default(null),
    // Slice 1's names, read when the newer ones are absent.
    paid: z.boolean().optional(),
    carryForwardMaxDays: z.number().min(0).max(366).optional(),
    needsApproval: z.boolean().optional(),
  })
  .transform(({ paid, carryForwardMaxDays, needsApproval, ...t }) => {
    const keepsBalance = t.yearlyEntitlementDays !== null;
    const carryMaxDays = t.carryMaxDays ?? carryForwardMaxDays ?? 0;
    const reset = t.reset ?? (keepsBalance ? 'yearly' : 'never');
    const payment = t.payment ?? (paid === false ? 'unpaid' : 'paid');
    return {
      ...t,
      payment,
      paymentPercent: payment === 'partial' ? t.paymentPercent : null,
      reset,
      carry: t.carry ?? (carryMaxDays > 0 && keepsBalance && reset === 'yearly' ? 'carry' : 'none'),
      carryMaxDays,
      approvalSteps: t.approvalSteps ?? (needsApproval === false ? 0 : 1),
    };
  });

export const LeaveDefaultsRule = z.object({ types: z.array(LeaveDefaultType).min(1) });
export type LeaveDefaultsRule = z.output<typeof LeaveDefaultsRule>;
export type LeaveDefaultType = z.output<typeof LeaveDefaultType>;

/** One row per year: the dates and their names. */
export const PublicHolidaysRule = z.object({
  year: z.number().int().min(2000).max(2100),
  dates: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      name: z.string().min(1),
    }),
  ),
});
export type PublicHolidaysRule = z.infer<typeof PublicHolidaysRule>;

/** How much more an hour of overtime pays, by the kind of day it was worked. */
const Multiplier = z.number().min(0).max(10);

/**
 * How approved overtime is paid (058-payroll AC-PY4): the hourly rate of a
 * monthly wage is the wage over `monthlyHoursDivisor`, a daily wage's is the
 * wage over 8, an hourly wage is its own; each day kind has its multiplier.
 */
export const OvertimeRule = z.object({
  monthlyHoursDivisor: z.number().positive().max(744),
  multipliers: z.object({ weekday: Multiplier, weekly_off: Multiplier, public_holiday: Multiplier }),
  taxable: z.boolean(),
  contributable: z.boolean(),
  rounding: Rounding.optional(),
});
export type OvertimeRule = z.infer<typeof OvertimeRule>;

const LineTreatment = z.object({ taxable: z.boolean(), contributable: z.boolean() });

/**
 * What a leaver's last payslip adds (058-payroll AC-PY13), and how each line is
 * taxed. Notice pay and severance arrive with exit cases (058-offboarding);
 * their parts are optional until then.
 */
export const FinalSettlementRule = z.object({
  unusedLeave: LineTreatment,
  notice: LineTreatment.optional(),
  severance: LineTreatment.extend({
    /** Months of the day rate × 30 per completed year band, from the first band a person reaches. */
    table: z.array(z.object({ fromYears: z.number().int().min(0).max(60), monthsOfPay: z.number().min(0).max(36) })).min(1),
  }).optional(),
});
export type FinalSettlementRule = z.infer<typeof FinalSettlementRule>;

/**
 * The formats the declaration files are written in (058-payroll AC-PY12).
 * Until the accountant's sheet sets the row, the files are Injishi's own CSV,
 * labelled provisional.
 */
export const DeclarationFormatsRule = z.object({
  paye: z.object({ format: z.literal('provisional_csv') }),
  rssb: z.object({ format: z.literal('provisional_csv') }),
});
export type DeclarationFormatsRule = z.infer<typeof DeclarationFormatsRule>;

/** A rule as read: the parsed value and the row it came from, for the trail. */
export interface HrRuleRow<T> {
  readonly configEntryId: string;
  readonly version: number;
  readonly value: T;
}

const PARSERS = {
  'hr.rw.paye': PayeRule,
  'hr.rw.rssb': RssbRule,
  'hr.rw.leave_defaults': LeaveDefaultsRule,
  'hr.rw.public_holidays': PublicHolidaysRule,
  'hr.rw.overtime': OvertimeRule,
  'hr.rw.final_settlement': FinalSettlementRule,
  'hr.rw.declaration_formats': DeclarationFormatsRule,
} as const;

/**
 * Parse one stored row, or null when it does not read. A null is refused by the
 * caller exactly as a missing row is.
 */
export function parseHrRule<K extends HrRuleType>(
  type: K,
  row: { id: string; version: number; value: unknown } | null,
): HrRuleRow<z.infer<(typeof PARSERS)[K]>> | null {
  if (!row) return null;
  const parsed = PARSERS[type].safeParse(row.value);
  if (!parsed.success) return null;
  return {
    configEntryId: row.id,
    version: row.version,
    value: parsed.data as z.infer<(typeof PARSERS)[K]>,
  };
}

/** The 409 sentence for a rule with no readable row in force. */
export function missingRuleMessage(type: HrRuleType, at: string): string {
  return `There is no rule for ${HR_RULE_LABEL[type]} in force on ${at} (${type}). Pay and leave cannot be counted until it is added.`;
}
