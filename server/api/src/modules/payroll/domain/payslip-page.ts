import type { PayFacts, PayslipLine } from './pay-rules';

/**
 * One payslip as a repository hands it over to be drawn: the stored figures,
 * and the few facts around them a page needs (whose it is, which month, which
 * business). Both sides read it: payroll for anybody's payslip, My HR for the
 * caller's own.
 */
export interface PayslipRecord {
  id: string;
  businessName: string | null;
  personName: string | null;
  jobTitle: string | null;
  departmentName: string | null;
  periodStart: Date;
  periodEnd: Date;
  runStatus: string;
  paidAt: Date | null;
  grossRwf: number;
  payeRwf: number;
  rssbEmployeeRwf: number;
  rssbEmployerRwf: number;
  netRwf: number;
  lines: readonly PayslipLine[];
  attendance: PayFacts | null;
}

/** One page of the PDF: a record, with every sentence already decided. */
export interface PayslipPage {
  businessName: string;
  /** `October 2026`. */
  month: string;
  /** `01 Oct to 31 Oct 2026`. */
  periodText: string;
  personName: string;
  jobTitle: string | null;
  departmentName: string | null;
  /** Where the run stands, as a sentence. */
  statusText: string;
  /** A draft is not a payslip yet, and the page says so across the top. */
  draft: boolean;
  grossRwf: number;
  withheldRwf: number;
  employerRwf: number;
  netRwf: number;
  lines: readonly PayslipLine[];
  /** The month's attendance as one sentence, when the payslip was computed from it. */
  attendanceText: string | null;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A stored UTC instant as that calendar day: `05 Oct 2026`. */
function day(at: Date): string {
  return `${String(at.getUTCDate()).padStart(2, '0')} ${MONTHS[at.getUTCMonth()].slice(0, 3)} ${at.getUTCFullYear()}`;
}

function hoursText(minutes: number): string {
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

/** The roster and the clock as the sentence a payslip carries. Null when there was nothing to read. */
export function attendanceText(facts: PayFacts | null): string | null {
  if (!facts || (facts.rosteredDays === 0 && facts.workedDays === 0 && facts.unpaidLeaveDays === 0)) return null;
  const parts = [`${facts.workedDays} of ${facts.rosteredDays} rostered ${facts.rosteredDays === 1 ? 'shift' : 'shifts'} worked`];
  if (facts.missedDays > 0) parts.push(`${facts.missedDays} missed`);
  if (facts.unpaidLeaveDays > 0) parts.push(`${facts.unpaidLeaveDays} ${facts.unpaidLeaveDays === 1 ? 'day' : 'days'} of unpaid leave`);
  if (facts.lateDays > 0) parts.push(`${facts.lateDays} late ${facts.lateDays === 1 ? 'arrival' : 'arrivals'}`);
  if (facts.overtimeMinutes > 0) parts.push(`${hoursText(facts.overtimeMinutes)} of overtime`);
  return parts.join(', ');
}

/**
 * The lines a payslip is drawn from. One computed before lines were kept has
 * only its five amounts, so it is drawn from those, each named for what the
 * amount was: the page is plainer, and no figure on it is invented.
 */
function linesOf(record: PayslipRecord): readonly PayslipLine[] {
  if (record.lines.length > 0) return record.lines;
  return [
    { code: 'basic', label: 'Salary', side: 'earning', amountRwf: record.grossRwf, basis: null },
    { code: 'paye', label: 'PAYE income tax', side: 'employee', amountRwf: record.payeRwf, basis: null },
    { code: 'rssb', label: 'RSSB contributions', side: 'employee', amountRwf: record.rssbEmployeeRwf, basis: null },
    { code: 'rssb', label: 'RSSB contributions', side: 'employer', amountRwf: record.rssbEmployerRwf, basis: null },
  ];
}

export function toPayslipPage(record: PayslipRecord): PayslipPage {
  const month = `${MONTHS[record.periodEnd.getUTCMonth()]} ${record.periodEnd.getUTCFullYear()}`;
  const statusText =
    record.runStatus === 'paid'
      ? `Paid${record.paidAt ? ` on ${day(record.paidAt)}` : ''}.`
      : record.runStatus === 'approved'
        ? 'Approved, not yet paid.'
        : 'DRAFT. Not approved: these figures may still change.';
  return {
    businessName: record.businessName ?? 'Payslip',
    month,
    periodText: `${day(record.periodStart).slice(0, 6)} to ${day(record.periodEnd)}`,
    personName: record.personName ?? 'Unknown',
    jobTitle: record.jobTitle,
    departmentName: record.departmentName,
    statusText,
    draft: record.runStatus !== 'paid' && record.runStatus !== 'approved',
    grossRwf: record.grossRwf,
    withheldRwf: record.payeRwf + record.rssbEmployeeRwf,
    employerRwf: record.rssbEmployerRwf,
    netRwf: record.netRwf,
    lines: linesOf(record),
    attendanceText: attendanceText(record.attendance),
  };
}

/** `payslip-2026-10-beatha-mukandayisenga.pdf`: safe in any file system and any header. */
export function payslipFilename(record: PayslipRecord): string {
  const period = record.periodEnd.toISOString().slice(0, 7);
  const who = (record.personName ?? 'employee')
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `payslip-${period}-${who || 'employee'}.pdf`;
}
