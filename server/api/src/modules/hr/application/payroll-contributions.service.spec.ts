import { describe, expect, it } from 'vitest';

import type { RssbRule } from '../domain/hr-rules';
import { applyChoices } from './payroll-contributions.service';

/** INVENTED rates, for the choice logic only. */
const RULE: RssbRule = {
  contributions: [
    { code: 'pension', label: 'Pension', base: 'gross', employeeRate: 0.06, employerRate: 0.06 },
    { code: 'cbhi', label: 'CBHI', base: 'net', employeeRate: 0.005, employerRate: 0, optional: true, defaultOn: true },
    { code: 'medical', label: 'RSSB medical scheme', base: 'basic', employeeRate: 0.075, employerRate: 0.075, optional: true },
  ],
};

type Choice = Parameters<typeof applyChoices>[1][number];
const row = (code: string, enabled: boolean, extra: Record<string, unknown> = {}): Choice =>
  ({
    id: code,
    orgId: 'org',
    code,
    enabled,
    employeeAmountRwf: null,
    employerAmountRwf: null,
    provider: null,
    updatedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  }) as Choice;

const codes = (choices: Parameters<typeof applyChoices>[1]): string[] => applyChoices(RULE, choices).rssb.contributions.map((c) => c.code);

describe('optional contributions (058-payroll)', () => {
  it('keeps what the law requires and the optional ones on by default when nothing was chosen', () => {
    expect(codes([])).toEqual(['pension', 'cbhi']);
  });

  it("follows the business's choice over the default, either way", () => {
    expect(codes([row('medical', true)])).toEqual(['pension', 'cbhi', 'medical']);
    expect(codes([row('cbhi', false)])).toEqual(['pension']);
  });

  it('never drops a required contribution, whatever a row says', () => {
    expect(codes([row('pension', false)])).toEqual(['pension', 'cbhi']);
  });

  it('turns a private insurer into fixed premiums only when it is on and priced', () => {
    expect(applyChoices(RULE, [row('private_health', true, { employeeAmountRwf: 4_000, employerAmountRwf: 12_000, provider: 'Radiant' })]).fixed).toEqual([
      { code: 'private_health', label: 'Health insurance (Radiant)', employeeRwf: 4_000, employerRwf: 12_000 },
    ]);
    expect(applyChoices(RULE, [row('private_health', false, { employeeAmountRwf: 4_000 })]).fixed).toEqual([]);
    expect(applyChoices(RULE, [row('private_health', true)]).fixed).toEqual([]);
  });
});
