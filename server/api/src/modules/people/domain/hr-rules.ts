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
} as const;
export type HrRuleType = (typeof HR_RULE)[keyof typeof HR_RULE];

/** What a person reads when a rule is missing: never the config key alone. */
export const HR_RULE_LABEL: Readonly<Record<HrRuleType, string>> = {
  'hr.rw.paye': 'the PAYE tax bands',
  'hr.rw.rssb': 'the RSSB contribution rates',
  'hr.rw.leave_defaults': 'the default leave types',
  'hr.rw.public_holidays': 'the public holidays',
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
 * The taxable base is a closed list (index contract 8). The accountant's sheet
 * picks one; adding a value is a change to the ADR, not to a row.
 */
const PayeTaxableBase = z.enum(['gross', 'gross_less_employee_contributions']);
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

/** The base a contribution is charged on: another closed list. */
const ContributionBase = z.enum(['gross', 'basic']);
export type ContributionBase = z.infer<typeof ContributionBase>;

export const RssbRule = z.object({
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
      }),
    )
    .min(1),
  rounding: Rounding.optional(),
});
export type RssbRule = z.infer<typeof RssbRule>;

export const LeaveDefaultsRule = z.object({
  types: z
    .array(
      z.object({
        code: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/),
        name: z.string().min(1),
        paid: z.boolean(),
        /** Null: no balance is kept (unpaid leave). */
        yearlyEntitlementDays: z.number().min(0).max(366).nullable(),
        accrual: z.enum(['yearly_upfront', 'monthly', 'none']),
        carryForwardMaxDays: z.number().min(0).max(366).default(0),
        needsApproval: z.boolean().default(true),
      }),
    )
    .min(1),
});
export type LeaveDefaultsRule = z.infer<typeof LeaveDefaultsRule>;

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
