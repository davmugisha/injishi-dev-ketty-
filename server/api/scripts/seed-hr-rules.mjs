#!/usr/bin/env node
/**
 * Placeholder HR rules for a SAMPLE database (ADR-058, first thread, slice 1
 * task 6).
 *
 * Pay and leave read four `config_entries` rows and refuse to compute without
 * them (index contract 8): `hr.rw.paye`, `hr.rw.rssb`, `hr.rw.leave_defaults`
 * and one `hr.rw.public_holidays` row per year. The real values come from an
 * accountant's sheet, checked against current RRA and RSSB rules and Labour Law
 * N° 66/2018, and the production migration is written from that sheet.
 *
 * THESE ARE NOT THOSE VALUES. Every figure below is an invented round number,
 * chosen so a payslip can be checked by hand, and every row says so in its own
 * value (`DEMO SAMPLE DATA`). They exist so the HR thread can run on a sample
 * database before the sheet arrives. Production never carries them: this
 * script refuses any database without the `sample` marker, like every seed.
 *
 * Idempotent: a type (or a holiday year) that already has a row is skipped, so
 * a real row written later is never overwritten by a rerun.
 *
 *   DATABASE_URL=... node scripts/seed-hr-rules.mjs
 */
import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';

const NOTE = 'DEMO SAMPLE DATA. Invented placeholder values, not Rwanda\'s rates. Replace from the accountant\'s sheet.';

const RULES = [
  {
    type: 'hr.rw.paye',
    value: {
      note: NOTE,
      taxableBase: 'gross',
      bands: [
        { fromRwf: 0, toRwf: 50000, rate: 0 },
        { fromRwf: 50000, toRwf: 150000, rate: 0.1 },
        { fromRwf: 150000, toRwf: null, rate: 0.25 },
      ],
    },
  },
  {
    type: 'hr.rw.rssb',
    value: {
      note: NOTE,
      contributions: [
        { code: 'pension', label: 'Pension (placeholder)', base: 'gross', employeeRate: 0.05, employerRate: 0.05 },
        { code: 'maternity', label: 'Maternity (placeholder)', base: 'basic', employeeRate: 0.004, employerRate: 0.004 },
      ],
    },
  },
  {
    type: 'hr.rw.leave_defaults',
    value: {
      note: NOTE,
      types: [
        {
          code: 'annual',
          name: 'Annual leave',
          paid: true,
          yearlyEntitlementDays: 18,
          accrual: 'monthly',
          carryForwardMaxDays: 0,
          needsApproval: true,
        },
        {
          code: 'unpaid',
          name: 'Unpaid leave',
          paid: false,
          yearlyEntitlementDays: null,
          accrual: 'none',
          carryForwardMaxDays: 0,
          needsApproval: true,
        },
      ],
    },
  },
];

/** Two dates a year, so a leave over one of them visibly counts less. Not the national calendar. */
const HOLIDAY_YEARS = [2025, 2026, 2027];

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('seed-hr-rules: DATABASE_URL is not set.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await assertSampleDatabase(client, 'seed-hr-rules.mjs');
  let written = 0;
  for (const rule of RULES) {
    const { rowCount } = await client.query(
      `insert into config_entries (config_type, value, effective_from, version, locked_on_use)
       select $1, $2::jsonb, '2020-01-01T00:00:00+02:00', 1, false
       where not exists (select 1 from config_entries where config_type = $1)`,
      [rule.type, JSON.stringify(rule.value)],
    );
    written += rowCount ?? 0;
  }
  for (const year of HOLIDAY_YEARS) {
    const { rowCount } = await client.query(
      `insert into config_entries (config_type, value, effective_from, version, locked_on_use)
       select 'hr.rw.public_holidays', $1::jsonb, '2020-01-01T00:00:00+02:00', 1, false
       where not exists (
         select 1 from config_entries
         where config_type = 'hr.rw.public_holidays' and value ->> 'year' = $2
       )`,
      [
        JSON.stringify({
          note: NOTE,
          year,
          dates: [
            { date: `${year}-01-01`, name: 'New Year (placeholder)' },
            { date: `${year}-12-25`, name: 'Christmas (placeholder)' },
          ],
        }),
        String(year),
      ],
    );
    written += rowCount ?? 0;
  }
  console.log(`HR placeholder rules: ${written} row(s) written (DEMO SAMPLE DATA).`);
} finally {
  await client.end().catch(() => {});
}
