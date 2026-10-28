import { describe, expect, it } from 'vitest';

import { auditDiff } from '../infrastructure/hr-audit';
import { HR_RULE, missingRuleMessage, parseHrRule } from './hr-rules';

/** Invented values, shaped like the rules; not Rwanda's (index contract 8). */
const row = (value: unknown): { id: string; version: number; value: unknown } => ({
  id: '00000000-0000-4000-8000-000000000001',
  version: 3,
  value,
});

describe('HR rules parser (ADR-058 index contract 8)', () => {
  it('reads a PAYE row whose bands tile the line', () => {
    const parsed = parseHrRule(
      HR_RULE.paye,
      row({
        bands: [
          { fromRwf: 0, toRwf: 10, rate: 0 },
          { fromRwf: 10, toRwf: null, rate: 0.5 },
        ],
        taxableBase: 'gross',
      }),
    );
    expect(parsed?.version).toBe(3);
    expect(parsed?.value.bands).toHaveLength(2);
  });

  it('treats a gap between bands as unreadable, which fails closed', () => {
    expect(
      parseHrRule(
        HR_RULE.paye,
        row({
          bands: [
            { fromRwf: 0, toRwf: 10, rate: 0 },
            { fromRwf: 11, toRwf: null, rate: 0.5 },
          ],
          taxableBase: 'gross',
        }),
      ),
    ).toBeNull();
  });

  it('refuses a taxable base outside the closed list', () => {
    expect(
      parseHrRule(HR_RULE.paye, row({ bands: [{ fromRwf: 0, toRwf: null, rate: 0.1 }], taxableBase: 'net' })),
    ).toBeNull();
  });

  it('refuses a rate written as a percentage', () => {
    expect(
      parseHrRule(
        HR_RULE.rssb,
        row({ contributions: [{ code: 'pension', label: 'Pension', base: 'gross', employeeRate: 6, employerRate: 6 }] }),
      ),
    ).toBeNull();
  });

  it('treats a missing row as missing', () => {
    expect(parseHrRule(HR_RULE.rssb, null)).toBeNull();
    expect(missingRuleMessage(HR_RULE.rssb, '2026-09-01')).toContain('hr.rw.rssb');
  });
});

describe('HR audit diff (AC-U5)', () => {
  it('names a personal field as changed and never writes its value', () => {
    const diff = auditDiff(
      { idDocumentNumber: 'OLD', rssbNumber: null, hiredOn: '2026-01-01', legalName: 'A' },
      { idDocumentNumber: 'NEW', rssbNumber: 'R1', hiredOn: '2026-02-01', legalName: 'A' },
    );
    expect(diff).toEqual({
      idDocumentNumber: 'changed',
      rssbNumber: 'changed',
      hiredOn: { from: '2026-01-01', to: '2026-02-01' },
    });
    expect(JSON.stringify(diff)).not.toContain('NEW');
  });
});
