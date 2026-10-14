/**
 * The pure rules of payroll in full (058-payroll): which components apply to a
 * person (AC-PY5), a loan's schedule (AC-PY8), and how a pay account is shown
 * on a payslip (AC-PY11). Every input is a value.
 */

export type ConditionField =
  | 'sex'
  | 'marital_status'
  | 'children'
  | 'years_of_service'
  | 'prior_experience'
  | 'employee_type'
  | 'job_position'
  | 'department'
  | 'branch'
  | 'wage_basis';
export type ConditionOp = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';

/** A person's file as a component's condition reads it, on the month's first day. */
export interface ConditionSubject {
  sex: string | null;
  maritalStatus: string | null;
  childrenCount: number | null;
  /** Full years from the hire date to the month's first day. */
  yearsOfService: number;
  priorExperienceYears: number | null;
  employeeTypeId: string | null;
  jobPositionId: string | null;
  departmentIds: readonly string[];
  branchId: string | null;
  wageBasis: string;
}

export interface ApplicableComponent {
  id: string;
  appliesAllActive: boolean;
  oneOffPeriod: string | null;
  conditionField: ConditionField | null;
  conditionOp: ConditionOp | null;
  conditionValue: string | null;
}

/**
 * Does a component apply to this person this month (AC-PY5)? It is in their
 * contract's structure, or targets all active staff, or includes them; it does
 * not exclude them; a one off falls in this month; and its condition holds.
 */
export function componentApplies(
  component: ApplicableComponent,
  person: {
    subject: ConditionSubject;
    structureComponentIds: ReadonlySet<string>;
    target: 'include' | 'exclude' | null;
  },
  period: string,
): boolean {
  if (person.target === 'exclude') return false;
  if (component.oneOffPeriod !== null && component.oneOffPeriod !== period) return false;
  const reached = component.appliesAllActive || person.target === 'include' || person.structureComponentIds.has(component.id);
  if (!reached) return false;
  if (component.conditionField === null || component.conditionOp === null || component.conditionValue === null) return true;
  return conditionHolds(component.conditionField, component.conditionOp, component.conditionValue, person.subject);
}

const NUMERIC: ReadonlySet<ConditionField> = new Set(['children', 'years_of_service', 'prior_experience']);

/** One condition on one field, from a closed list of fields and operators. */
export function conditionHolds(field: ConditionField, op: ConditionOp, value: string, subject: ConditionSubject): boolean {
  const wanted = op === 'in' ? value.split(',').map((v) => v.trim()).filter(Boolean) : [value.trim()];
  if (field === 'department') {
    // A person may sit in several departments; the condition holds when any matches.
    const has = subject.departmentIds.some((d) => wanted.includes(d));
    return op === 'ne' ? !has : op === 'eq' || op === 'in' ? has : false;
  }
  const actual = valueOf(field, subject);
  if (NUMERIC.has(field)) {
    if (actual === null) return false;
    const n = Number(actual);
    const targets = wanted.map(Number);
    if (targets.some((t) => Number.isNaN(t))) return false;
    switch (op) {
      case 'eq':
        return n === targets[0];
      case 'ne':
        return n !== targets[0];
      case 'gt':
        return n > targets[0];
      case 'gte':
        return n >= targets[0];
      case 'lt':
        return n < targets[0];
      case 'lte':
        return n <= targets[0];
      case 'in':
        return targets.includes(n);
    }
  }
  if (op === 'in') return actual !== null && wanted.includes(String(actual));
  if (op === 'eq') return actual !== null && String(actual) === wanted[0];
  if (op === 'ne') return actual === null || String(actual) !== wanted[0];
  // An ordering on a field that has none matches nobody rather than guessing.
  return false;
}

function valueOf(field: ConditionField, s: ConditionSubject): string | number | null {
  switch (field) {
    case 'sex':
      return s.sex;
    case 'marital_status':
      return s.maritalStatus;
    case 'children':
      return s.childrenCount ?? 0;
    case 'years_of_service':
      return s.yearsOfService;
    case 'prior_experience':
      return s.priorExperienceYears;
    case 'employee_type':
      return s.employeeTypeId;
    case 'job_position':
      return s.jobPositionId;
    case 'branch':
      return s.branchId;
    case 'wage_basis':
      return s.wageBasis;
    case 'department':
      return null;
  }
}

/** The month after `YYYY-MM`. */
export function nextPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/**
 * A loan's schedule (AC-PY8): equal installments rounded down to the franc,
 * the last taking the remainder, so they always sum to the amount; one a month
 * from the first period.
 */
export function installmentSchedule(amountRwf: number, count: number, firstPeriod: string): { period: string; amountRwf: number }[] {
  if (!Number.isInteger(amountRwf) || amountRwf <= 0 || !Number.isInteger(count) || count < 1) {
    throw new Error(`Cannot schedule ${amountRwf} over ${count}.`);
  }
  if (count > amountRwf) throw new Error('More installments than francs.');
  const each = Math.floor(amountRwf / count);
  const out: { period: string; amountRwf: number }[] = [];
  let period = firstPeriod;
  for (let i = 0; i < count; i++) {
    out.push({ period, amountRwf: i === count - 1 ? amountRwf - each * (count - 1) : each });
    period = nextPeriod(period);
  }
  return out;
}

/**
 * Deferring an installment moves it and every later unpaid one a month on
 * (AC-PY8), so the schedule keeps its shape and its total. Answers the new
 * period of each, later ones first, the order a unique (loan, period) index can
 * take them in.
 */
export function deferredSchedule(
  unpaid: readonly { id: string; period: string }[],
  fromPeriod: string,
): { id: string; from: string; to: string }[] {
  return unpaid
    .filter((i) => i.period >= fromPeriod)
    .sort((a, b) => b.period.localeCompare(a.period))
    .map((i) => ({ id: i.id, from: i.period, to: nextPeriod(i.period) }));
}

/** A pay account as a payslip shows it: never the whole number (AC-PY11). */
export function maskAccount(account: { kind: 'bank' | 'momo'; bankName: string | null; accountNumber: string | null; momoPhone: string | null } | null): string | null {
  if (!account) return null;
  // The last four characters of the number itself, never a separator.
  const tail = (s: string | null): string => (s ? `•••• ${s.replace(/[^0-9a-z]/gi, '').slice(-4)}` : '');
  return account.kind === 'bank' ? `${account.bankName ?? 'Bank'} ${tail(account.accountNumber)}`.trim() : `MoMo ${tail(account.momoPhone)}`.trim();
}

/** Full years from `from` to `to` (both `YYYY-MM-DD`). */
export function fullYears(from: string, to: string): number {
  if (to < from) return 0;
  let years = Number(to.slice(0, 4)) - Number(from.slice(0, 4));
  if (to.slice(5) < from.slice(5)) years -= 1;
  return Math.max(0, years);
}
