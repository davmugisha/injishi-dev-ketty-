#!/usr/bin/env node
/**
 * Rwanda's published payroll figures, for a SAMPLE database (ADR-058).
 *
 * `seed-hr-rules.mjs` writes invented round numbers so a payslip can be checked
 * by hand, and says so in every row. A demo shown to people who run hotels in
 * Rwanda reads better with the figures they know: a wage taxed in the four
 * bands, 6% to the pension. This script adds those as the NEXT VERSION of three
 * rules, beside the placeholders, never over them:
 *
 *   hr.rw.paye              the four monthly bands
 *   hr.rw.rssb              pension, maternity leave, occupational hazards
 *   hr.rw.public_holidays   the 2026 calendar
 *
 * THIS IS NOT THE ACCOUNTANT'S SHEET, and it does not replace it. The figures
 * were looked up in public sources on 12 October 2026 (named on each rule
 * below) and nobody qualified has signed them off. Every row says so in its
 * own value (`RESEARCHED, NOT CONFIRMED BY AN ACCOUNTANT`), and the Rules in
 * force screen repeats it. The production migration is still written from the
 * sheet. Three choices here are a reading, not a quotation, and are the first
 * things for an accountant to check:
 *
 *   - PAYE is charged on `taxable`: what is marked taxed, less what is taken
 *     before tax. In Rwanda that is the whole of ordinary pay.
 *   - Maternity is charged on `contributable`, because RSSB is reported to
 *     leave the transport allowance out of that base and no base here says
 *     "gross less transport". A transport allowance marked as not counting
 *     for RSSB is left out of it; pension, since 2025, includes it.
 *   - Occupational hazards is taken on the pension's base.
 *
 * NOT HERE, each for a reason:
 *   - Overtime: sources disagree on whether the law sets a premium at all.
 *   - The default leave types: they only shape a business created later.
 *   - A leaver's settlement and the declaration formats: nothing published to
 *     copy.
 *   - CBHI (0.5% of NET pay): no contribution base here is net pay.
 *   - RSSB's medical scheme (7.5% and 7.5% of basic): a private employer joins
 *     it by choice.
 *   - 2027's holidays: the Eid dates are not announced.
 * Those rules keep their placeholder rows and their DEMO SAMPLE DATA note.
 *
 * It never runs in the acceptance suites, which check payslips against the
 * placeholders' round numbers, and it refuses any database without the
 * `sample` marker, like every seed. Idempotent: a rule whose newest row
 * already holds these figures is left alone.
 *
 *   node --env-file=.env scripts/seed-hr-rules-rw.mjs
 */
import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';

const UNCONFIRMED = 'RESEARCHED, NOT CONFIRMED BY AN ACCOUNTANT.';
const LOOKED_UP = 'Looked up on 12 October 2026.';

const RULES = [
  {
    type: 'hr.rw.paye',
    // The four bands replaced the transitional three a year after the law came into force.
    effectiveFrom: '2023-11-01T00:00:00+02:00',
    value: {
      note: `${UNCONFIRMED} Monthly bands of Law 027/2022 on income tax, as printed in the HLB Rwanda Tax Guide 2025/2026. A casual worker is taxed differently (15% above RWF 60,000), which this rule does not carry. ${LOOKED_UP}`,
      taxableBase: 'taxable',
      bands: [
        { fromRwf: 0, toRwf: 60000, rate: 0 },
        { fromRwf: 60000, toRwf: 100000, rate: 0.1 },
        { fromRwf: 100000, toRwf: 200000, rate: 0.2 },
        { fromRwf: 200000, toRwf: null, rate: 0.3 },
      ],
    },
  },
  {
    type: 'hr.rw.rssb',
    // Presidential Order 086/01, gazetted 13 December 2024: the pension rate from January 2025.
    effectiveFrom: '2025-01-01T00:00:00+02:00',
    value: {
      note: `${UNCONFIRMED} Pension is 6% each since January 2025 (Presidential Order 086/01, as reported by EY and by RSSB), on pay including the transport allowance, and is due to rise each year from January 2027. Maternity leave is 0.3% each. Occupational hazards is 2%, paid by the business alone; one source says 1%. ${LOOKED_UP}`,
      contributions: [
        { code: 'pension', label: 'Pension', base: 'gross', employeeRate: 0.06, employerRate: 0.06 },
        { code: 'maternity', label: 'Maternity leave', base: 'contributable', employeeRate: 0.003, employerRate: 0.003 },
        { code: 'occupational_hazards', label: 'Occupational hazards', base: 'gross', employeeRate: 0, employerRate: 0.02 },
      ],
    },
  },
];

/**
 * The year's national days off. A holiday on a weekend gives the next working
 * day (the 7th of April aside), so both dates are listed: work on either is
 * work on a holiday.
 */
const HOLIDAYS = [
  {
    year: 2026,
    note: `${UNCONFIRMED} The 2026 list as published by officeholidays.com, with the day in lieu for each holiday on a weekend. The 28th of December follows that rule and is not on every published list. ${LOOKED_UP}`,
    dates: [
      { date: '2026-01-01', name: "New Year's Day" },
      { date: '2026-01-02', name: "Day after New Year's Day" },
      { date: '2026-02-01', name: "National Heroes' Day" },
      { date: '2026-02-02', name: "National Heroes' Day (day in lieu)" },
      { date: '2026-03-20', name: 'Eid al-Fitr' },
      { date: '2026-04-03', name: 'Good Friday' },
      { date: '2026-04-06', name: 'Easter Monday' },
      { date: '2026-04-07', name: 'Genocide against the Tutsi Memorial Day' },
      { date: '2026-05-01', name: 'Labour Day' },
      { date: '2026-05-27', name: 'Eid al-Adha' },
      { date: '2026-07-01', name: 'Independence Day' },
      { date: '2026-07-04', name: 'Liberation Day' },
      { date: '2026-07-06', name: 'Liberation Day (day in lieu)' },
      { date: '2026-08-07', name: 'Umuganura Day' },
      { date: '2026-08-15', name: 'Assumption Day' },
      { date: '2026-08-17', name: 'Assumption Day (day in lieu)' },
      { date: '2026-12-25', name: 'Christmas Day' },
      { date: '2026-12-26', name: 'Boxing Day' },
      { date: '2026-12-28', name: 'Boxing Day (day in lieu)' },
    ],
  },
];

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('seed-hr-rules-rw: DATABASE_URL is not set.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await assertSampleDatabase(client, 'seed-hr-rules-rw.mjs');
  let written = 0;

  /** The next version of a rule, unless its newest row already holds exactly this. */
  const write = async (type, value, effectiveFrom, sameYear) => {
    const year = sameYear ? ` and value ->> 'year' = '${Number(value.year)}'` : '';
    const { rows } = await client.query(
      `select version, value = $2::jsonb as same from config_entries
       where config_type = $1${year}
       order by effective_from desc nulls last, version desc limit 1`,
      [type, JSON.stringify(value)],
    );
    if (rows[0]?.same) return;
    const { rows: top } = await client.query(`select coalesce(max(version), 0) + 1 as next from config_entries where config_type = $1${year}`, [type]);
    await client.query(
      `insert into config_entries (config_type, value, effective_from, version, locked_on_use)
       values ($1, $2::jsonb, $3, $4, false)`,
      [type, JSON.stringify(value), effectiveFrom, top[0].next],
    );
    written += 1;
    console.log(`  ${type}${sameYear ? ` ${value.year}` : ''}: version ${top[0].next}, in force from ${effectiveFrom.slice(0, 10)}`);
  };

  for (const rule of RULES) await write(rule.type, rule.value, rule.effectiveFrom, false);
  for (const { year, note, dates } of HOLIDAYS) {
    await write('hr.rw.public_holidays', { note, year, dates }, `${year}-01-01T00:00:00+02:00`, true);
  }
  console.log(`HR researched rules: ${written} row(s) written (${UNCONFIRMED.toLowerCase()})`);
} finally {
  await client.end().catch(() => {});
}
