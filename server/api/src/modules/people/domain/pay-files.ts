import type { PayslipLine } from '@injishi/contracts';

/**
 * The files a confirmed run produces (058-payroll AC-PY10, AC-PY12): the bank
 * and MoMo payment files and the PAYE and RSSB declarations. Pure: each takes
 * the frozen payslips and answers CSV text.
 *
 * None of these is a format a bank, RRA or RSSB has published to us yet. Each
 * file says `PROVISIONAL FORMAT` on its first line, so it cannot be mistaken for
 * the real thing, until the accountant's sheet (or a bank's own format) sets it.
 */

// No comma, so the line stays one bare cell rather than a quoted one.
export const PROVISIONAL = 'PROVISIONAL FORMAT: Injishi columns and not a bank or authority template.';

/** One CSV field, quoted when it must be, a leading formula character defused. */
export function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  // A spreadsheet runs a cell that starts with = + - @ as a formula; a name never
  // needs to. A sign before a digit is a number or a phone (+250…), and stays.
  if (typeof value === 'string' && /^(?:[=@\t\r]|[+-](?!\d))/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  return rows.map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

export interface PayeeRow {
  employeeId: string;
  employeeNumber: string;
  name: string;
  netRwf: number;
  account: { kind: 'bank' | 'momo'; bankName: string | null; branchName: string | null; accountNumber: string | null; momoPhone: string | null } | null;
}

/**
 * The bank file (AC-PY10): a row per person whose primary account is a bank
 * account, everyone else listed as left out and why. The reference is the run's.
 */
export function bankFile(rows: readonly PayeeRow[], reference: string): { text: string; included: PayeeRow[]; leftOut: { row: PayeeRow; reason: string }[] } {
  const included: PayeeRow[] = [];
  const leftOut: { row: PayeeRow; reason: string }[] = [];
  for (const r of rows) {
    if (r.netRwf <= 0) leftOut.push({ row: r, reason: 'Nothing to pay.' });
    else if (!r.account) leftOut.push({ row: r, reason: 'No primary pay account.' });
    else if (r.account.kind !== 'bank') leftOut.push({ row: r, reason: 'Paid by MoMo, not by bank.' });
    else included.push(r);
  }
  const text = csv([
    [PROVISIONAL],
    ['employee_number', 'name', 'bank', 'branch', 'account_number', 'amount_rwf', 'reference'],
    ...included.map((r) => [r.employeeNumber, r.name, r.account?.bankName, r.account?.branchName, r.account?.accountNumber, r.netRwf, reference]),
  ]);
  return { text, included, leftOut };
}

/** The MoMo file (AC-PY10): phone, name, amount, reference. */
export function momoFile(rows: readonly PayeeRow[], reference: string): { text: string; included: PayeeRow[]; leftOut: { row: PayeeRow; reason: string }[] } {
  const included: PayeeRow[] = [];
  const leftOut: { row: PayeeRow; reason: string }[] = [];
  for (const r of rows) {
    if (r.netRwf <= 0) leftOut.push({ row: r, reason: 'Nothing to pay.' });
    else if (!r.account) leftOut.push({ row: r, reason: 'No primary pay account.' });
    else if (r.account.kind !== 'momo') leftOut.push({ row: r, reason: 'Paid by bank, not by MoMo.' });
    else included.push(r);
  }
  const text = csv([[PROVISIONAL], ['phone', 'name', 'amount_rwf', 'reference'], ...included.map((r) => [r.account?.momoPhone, r.name, r.netRwf, reference])]);
  return { text, included, leftOut };
}

export interface DeclarantRow {
  employeeNumber: string;
  name: string;
  rssbNumber: string | null;
  idNumber: string | null;
  grossRwf: number;
  payeRwf: number;
  lines: readonly PayslipLine[];
}

/** The PAYE declaration (AC-PY12): gross, the base the bands were applied to, PAYE. */
export function payeDeclaration(rows: readonly DeclarantRow[], business: { name: string; tin: string | null }, period: string): string {
  return csv([
    [PROVISIONAL],
    ['employer', business.name, 'tin', business.tin, 'period', period],
    ['employee_number', 'name', 'id_number', 'gross_rwf', 'taxable_base_rwf', 'paye_rwf'],
    ...rows.map((r) => {
      const paye = r.lines.find((l) => l.code === 'paye');
      return [r.employeeNumber, r.name, r.idNumber, r.grossRwf, paye?.taxBase ?? r.grossRwf, r.payeRwf];
    }),
  ]);
}

/** The RSSB declaration (AC-PY12): each contribution's two shares, a column pair per code. */
export function rssbDeclaration(rows: readonly DeclarantRow[], business: { name: string; rssbEmployerNumber: string | null }, period: string): string {
  const codes = [...new Set(rows.flatMap((r) => r.lines.filter((l) => l.side === 'employee' && l.code !== 'paye').map((l) => l.code)))].sort();
  const share = (r: DeclarantRow, code: string, side: 'employee' | 'employer'): number =>
    r.lines.filter((l) => l.code === code && l.side === side).reduce((s, l) => s + l.amountRwf, 0);
  return csv([
    [PROVISIONAL],
    ['employer', business.name, 'rssb_employer_number', business.rssbEmployerNumber, 'period', period],
    ['employee_number', 'name', 'rssb_number', 'gross_rwf', ...codes.flatMap((c) => [`${c}_employee_rwf`, `${c}_employer_rwf`])],
    ...rows.map((r) => [r.employeeNumber, r.name, r.rssbNumber, r.grossRwf, ...codes.flatMap((c) => [share(r, c, 'employee'), share(r, c, 'employer')])]),
  ]);
}
