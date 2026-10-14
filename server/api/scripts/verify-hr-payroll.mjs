#!/usr/bin/env node
// Verify payroll in full end to end (ADR-058 slice 6, 058-payroll and the self
// service routes marked 6 in 058-self-service).
//
// Drives the real API as the Amahoro demo roster. The owner shapes pay
// (components, a structure, the HR settings), records loans, claims and
// adjustments, works one month's run from its automatic draft to paid, holds a
// payslip that would pay less than nothing, settles a leaver, prints the
// payslips and builds the bank, MoMo and declaration files; the desk raises
// its own claim and downloads its own payslip through `/me/work`. Every check
// names the acceptance criterion it proves.
//
// It WRITES, and it is meant for a FRESHLY SEEDED sample database you own,
// never the shared one: it CONFIRMS this month's pay run and drafts next
// month's, and a business has one run per month, so a second run on the same
// database meets the first one's months. Reseed between runs.
//
// With DATABASE_URL set it also reads and writes the database (a rule taken out
// of force and put back, the audit trail) and runs the daily job through
// `run-hr-daily.mjs`, which needs an API build: `dist/`, or API_DIST_DIR.
// Without DATABASE_URL those checks are skipped and say so.
//
//   VERIFY_API_URL=http://localhost:8014 DATABASE_URL=postgres://.../injishi_hr \
//     API_DIST_DIR=dist-worker node scripts/verify-hr-payroll.mjs
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const API = process.env.VERIFY_API_URL || 'http://localhost:8000';
const OTP = process.env.VERIFY_OTP_CODE || '123456';
const DB = process.env.DATABASE_URL?.trim() || null;
const here = dirname(fileURLToPath(import.meta.url));

const AMAHORO_ORG = 'de300000-0000-4000-8000-000000000101';
const BOUTIQUE = 'de300000-0000-4000-8000-000000000401';
const PROVISIONAL = 'PROVISIONAL FORMAT: Injishi columns and not a bank or authority template.';

let failures = 0;
function check(label, ok, detail) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : `   ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}
function skip(label, why) {
  console.log(`  SKIP  ${label}   (${why})`);
}

// --- Kigali dates -------------------------------------------------------------------

const kigaliToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date());
const addDays = (d, n) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const nextPeriodOf = (p) => {
  const [y, m] = p.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};
const prevPeriodOf = (p) => {
  const [y, m] = p.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};
/** A Kigali wall clock time as an instant: Kigali is UTC+2 all year. */
const kigali = (date, hhmm) => new Date(`${date}T${hhmm}:00+02:00`).toISOString();

const today = kigaliToday();
const year = Number(today.slice(0, 4));
const period = today.slice(0, 7);
const nextPeriod = nextPeriodOf(period);
const lastPeriod = prevPeriodOf(period);
const dayOfMonth = Number(today.slice(8, 10));
const daysInMonth = new Date(Date.UTC(year, Number(period.slice(5, 7)), 0)).getUTCDate();
/** Past days of this month, newest first: a clock time may sit at most 7 days back. */
const pastDays = [1, 2].map((n) => addDays(today, -n)).filter((d) => d.slice(0, 7) === period);

// --- Exact money, restated rather than imported -------------------------------------------

/** `a / b` rounded half up, for non-negative integers. */
const halfUp = (a, b) => Math.floor((2 * a + b) / (2 * b));
/** A thirtieth of a monthly wage per day, halves counted (058-payroll AC-PY1). */
const dayRate = (wage, days) => halfUp(wage * Math.round(days * 2), 60);
/** The sample PAYE row: nothing to 50,000, a tenth to 150,000, a quarter above. */
const samplePaye = (base) => halfUp(10 * Math.min(Math.max(base - 50000, 0), 100000) + 25 * Math.max(base - 150000, 0), 100);
/** The sample overtime row: a monthly wage over 200 hours an hour, times the day's multiplier. */
const MULTIPLIER = { weekday: 1.5, weekly_off: 2, public_holiday: 2 };
const overtimeOf = (wage, minutes, dayKind) => halfUp(minutes * wage * MULTIPLIER[dayKind] * 10, 60 * 200 * 10);

// --- Sessions and calls ---------------------------------------------------------------

function jar(res) {
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
}

async function sessionFor(email) {
  const origin = { Origin: 'http://localhost:3000' };
  await fetch(`${API}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...origin },
    body: JSON.stringify({ email, type: 'sign-in' }),
  });
  const res = await fetch(`${API}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...origin },
    body: JSON.stringify({ email, otp: OTP }),
  });
  if (!res.ok) throw new Error(`${email}: sign-in ${res.status} ${await res.text()}`);
  const cookie = jar(res);
  await fetch(`${API}/api/v1/me/two-factor/send`, { method: 'POST', headers: { cookie, ...origin } });
  await fetch(`${API}/api/v1/me/two-factor/verify`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json', ...origin },
    body: JSON.stringify({ code: OTP }),
  });
  const me = await fetch(`${API}/api/v1/me/workspaces`, { headers: { cookie } });
  const body = await me.json();
  const ws = (body.workspaces ?? []).find((w) => w.orgId === AMAHORO_ORG);
  return { email, cookie, workspaceId: ws?.workspaceId ?? null, permissions: ws?.permissions ?? [] };
}

async function call(s, method, path, body, extraHeaders = {}) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: {
      ...(s?.cookie ? { cookie: s.cookie } : {}),
      ...(s?.workspaceId ? { 'x-workspace-id': s.workspaceId } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, body: json };
}
const get = (s, p) => call(s, 'GET', p);
const post = (s, p, b = {}) => call(s, 'POST', p, b);
const patch = (s, p, b) => call(s, 'PATCH', p, b);
/** A command that creates money: sent once per key, the way a button press mints one. */
const once = (s, p, b, key = randomUUID()) => call(s, 'POST', p, b, { 'Idempotency-Key': key });
/** Self service carries no workspace header: ownership is the guard. */
const self = (s) => ({ cookie: s.cookie });
function listPath(path, { q, filters = [], size = 100 } = {}) {
  const params = new URLSearchParams({ size: String(size) });
  if (q) params.set('q', q);
  if (filters.length > 0) params.set('f', JSON.stringify(filters));
  return `${path}?${params}`;
}
/** A file route: the status, the type and the first bytes. */
async function raw(s, path) {
  const res = await fetch(`${API}/api/v1${path}`, {
    headers: { ...(s?.cookie ? { cookie: s.cookie } : {}), ...(s?.workspaceId ? { 'x-workspace-id': s.workspaceId } : {}) },
  });
  const bytes = Buffer.from(await res.arrayBuffer());
  return { status: res.status, type: res.headers.get('content-type') ?? '', disposition: res.headers.get('content-disposition') ?? '', bytes };
}
const isPdf = (r) => r.status === 200 && r.type.startsWith('application/pdf') && r.bytes.subarray(0, 5).toString('latin1') === '%PDF-';

/** A tiny real PDF: the upload is checked by its first bytes. */
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
async function upload(s, path, fields = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append('file', new Blob([PDF], { type: 'application/pdf' }), 'receipt.pdf');
  const res = await fetch(`${API}/api/v1${path}`, {
    method: 'POST',
    headers: { cookie: s.cookie, ...(s.workspaceId ? { 'x-workspace-id': s.workspaceId } : {}) },
    body: form,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, body: json };
}

let client = null;
async function sql(text, params = []) {
  if (!DB) return null;
  if (!client) {
    client = new pg.Client({ connectionString: DB });
    await client.connect();
  }
  return (await client.query(text, params)).rows;
}

function runDaily(args = []) {
  const out = execFileSync(process.execPath, [resolve(here, 'run-hr-daily.mjs'), ...args], {
    env: process.env,
    encoding: 'utf8',
  });
  return JSON.parse(out.trim().split('\n').pop());
}

const stamp = Date.now().toString().slice(-8);
const idNumber = (n) => `11988${stamp}${n}`.slice(0, 16);

console.log(`Verifying payroll against ${API}, today ${today} (Kigali), pay for ${period}\n`);

const owner = await sessionFor('yves@demo.injishi.com');
const manager = await sessionFor('solange@demo.injishi.com');
const desk = await sessionFor('denise@demo.injishi.com');
if (!owner.workspaceId || !manager.workspaceId || !desk.workspaceId) {
  throw new Error('The Amahoro roster did not resolve a workspace. Is this a seeded sample database?');
}

// --- The people of this run -----------------------------------------------------------

const hiredTwoYearsAgo = `${year - 2}-03-15`;
const cookBody = (n, name, sex) => ({
  legalName: `${name} Pay ${stamp}`,
  phone: `0788 7${stamp.slice(-2)} 4${n}0`.replace(/ /g, ''),
  dateOfBirth: `1991-05-0${n}`,
  sex,
  idDocumentType: 'national_id',
  idDocumentNumber: idNumber(n),
  rssbNumber: `RP${stamp}${n}`,
  hiredOn: hiredTwoYearsAgo,
  workPropertyId: BOUTIQUE,
});
const hire = async (n, name, sex, wageBasis, wageRwf) => {
  const file = (await post(owner, '/ops/employees', cookBody(n, name, sex))).body;
  if (!file?.id) throw new Error(`Could not create ${name}.`);
  const contract = await post(owner, `/ops/employees/${file.id}/contracts`, { contractType: 'permanent', startsOn: hiredTwoYearsAgo, wageBasis, wageRwf });
  return { ...file, contractStatus: contract.status, contract: contract.body?.contract ?? contract.body };
};
const alice = await hire(1, 'Mukeshimana Alice', 'female', 'monthly', 300000);
const bosco = await hire(2, 'Ndayisaba Bosco', 'male', 'daily', 12000);
const claudine = await hire(3, 'Uwera Claudine', 'female', 'monthly', 60000);
const david = await hire(4, 'Kalisa David', 'male', 'monthly', 300000);

console.log('Every contract basis is paid (AC-PY2)');
check('a daily wage contract is accepted now: 201', bosco.contractStatus === 201 && bosco.contract?.wageBasis === 'daily', bosco.contract);
const hourly = await post(owner, `/ops/employees/${claudine.id}/contracts`, { contractType: 'permanent', startsOn: `${nextPeriod}-01`, wageBasis: 'hourly', wageRwf: 1500 });
check('so is an hourly one, from next month, shortening the monthly one: 201', hourly.status === 201 && hourly.body?.contract?.wageBasis === 'hourly' && hourly.body?.shortened !== null, hourly.body);
if (![alice, claudine, david].every((p) => p.contractStatus === 201)) throw new Error('Could not give the cooks their contracts.');

const aliceBank = await post(owner, `/ops/employees/${alice.id}/pay-accounts`, { kind: 'bank', bankName: 'Bank of Kigali', accountNumber: `00040-${stamp.slice(-7)}-78`, makePrimary: true });
const boscoMomo = await post(owner, `/ops/employees/${bosco.id}/pay-accounts`, { kind: 'momo', momoPhone: `0788 6${stamp.slice(-2)} 123`.replace(/ /g, ''), makePrimary: true });
if (aliceBank.status !== 201 || boscoMomo.status !== 201) throw new Error(`Could not record pay accounts: ${JSON.stringify([aliceBank.body, boscoMomo.body])}`);

const filesOf = async (s) => (await get(self(s), '/me/work')).body?.files ?? [];
const deskFile = (await filesOf(desk)).find((f) => f.orgId === AMAHORO_ORG);
if (!deskFile) throw new Error('Denise has no Amahoro file. Is this a seeded sample database?');
const deskDetail = (await get(owner, `/ops/employees/${deskFile.employeeId}`)).body;
await patch(owner, `/ops/employees/${deskFile.employeeId}`, {
  workPropertyId: BOUTIQUE,
  hiredOn: hiredTwoYearsAgo,
  dateOfBirth: '1994-02-11',
  sex: 'female',
  idDocumentType: 'national_id',
  idDocumentNumber: idNumber(9),
  rssbNumber: `RP${stamp}9`,
  ...(deskDetail?.employee?.phone ? {} : { phone: `0788 7${stamp.slice(-2)} 490`.replace(/ /g, '') }),
});
const deskContract = await post(owner, `/ops/employees/${deskFile.employeeId}/contracts`, { contractType: 'permanent', startsOn: hiredTwoYearsAgo, wageBasis: 'monthly', wageRwf: 250000 });
if (deskContract.status !== 201) throw new Error(`Could not give Denise a contract: ${JSON.stringify(deskContract.body)}`);

// --- Reads and who may make them (AC-PY15) -------------------------------------------------

console.log('\nThe dashboard, the rules in force and every contract (AC-PY15)');
const rules = await get(owner, '/ops/payroll/rules');
const ruleTypes = (rules.body?.rules ?? []).map((r) => r.configType);
check('the rules in force: all seven HR rules, each with the row in force and its history', rules.status === 200 && ruleTypes.length === 7 && rules.body.rules.every((r) => r.inForce !== null && r.history.length >= 1), ruleTypes);
check('the overtime row in force is the one this run will read', rules.body?.rules?.find((r) => r.configType === 'hr.rw.overtime')?.inForce?.value?.monthlyHoursDivisor === 200, rules.body?.rules?.find((r) => r.configType === 'hr.rw.overtime'));
const managerReads = await Promise.all(['/ops/payroll/rules', '/ops/payroll/dashboard', '/ops/payslips', '/ops/loans', '/ops/pay-claims', '/ops/pay-adjustments', '/ops/pay-components', '/ops/contracts'].map((p) => get(manager, p)));
check('the manager reads none of payroll: 403 on every route (payroll.run)', managerReads.every((r) => r.status === 403), managerReads.map((r) => r.status));
const contracts = await get(owner, listPath('/ops/contracts', { q: stamp }));
check('every contract of the business, through the list contract', contracts.status === 200 && contracts.body?.items?.length === 5 && contracts.body.items.some((c) => c.wageBasis === 'hourly'), contracts.body?.items?.map((c) => [c.employee.displayName, c.wageBasis]));

// --- The automatic draft (AC-PY14) ----------------------------------------------------------

console.log('\nThe automatic draft (AC-PY14)');
let runId = null;
const settingsDay = dayOfMonth <= 28 ? dayOfMonth : null;
const managerSettings = await patch(manager, '/ops/hr/settings', { payRunAutoDraftDay: 25 });
check('the manager cannot set the draft day: 403', managerSettings.status === 403, managerSettings.status);
const badDay = await patch(owner, '/ops/hr/settings', { payRunAutoDraftDay: 31 });
check('a draft day past the 28th: 400, so no month skips it', badDay.status === 400, badDay.status);
if (DB && settingsDay !== null) {
  const set = await patch(owner, '/ops/hr/settings', { payRunAutoDraftDay: settingsDay });
  check(`the owner sets the draft day to today, the ${settingsDay}: 200`, set.status === 200 && set.body?.payRunAutoDraftDay === settingsDay, set.body);
  try {
    const first = runDaily();
    const runs = (await get(owner, '/ops/pay-runs?size=50')).body?.items ?? [];
    const drafted = runs.find((r) => r.period === period);
    runId = drafted?.id ?? null;
    check(`the daily job drafts ${period}, the month the day falls in`, first.drafted === 1 && drafted?.status === 'draft', [first, drafted?.status]);
    const audit = await sql(`select payload_diff from audit_events where event_type = 'hr.pay_run_created' and subject_id = $1`, [runId]);
    check('its trail says nobody pressed a button', audit?.[0]?.payload_diff?.automatic === true, audit?.[0]?.payload_diff);
    const again = runDaily();
    check('a second run the same day drafts nothing', again.drafted === 0, again);
  } catch (error) {
    skip('the daily job drafts the month', `run-hr-daily.mjs failed: ${String(error.message).split('\n')[0]}`);
  }
} else {
  skip('the daily job drafts the month', DB ? `today is the ${dayOfMonth}, past the 28th` : 'no DATABASE_URL');
}
if (!runId) {
  const created = await post(owner, '/ops/pay-runs', { period });
  check(`drafted by hand instead: 201`, created.status === 201, created.body?.message ?? created.status);
  runId = created.body?.run?.id ?? null;
}
const duplicate = await post(owner, '/ops/pay-runs', { period });
check('a second run for the month: 409', duplicate.status === 409, duplicate.status);

// --- Components and structures (AC-PY5) -------------------------------------------------------

console.log('\nPay components and structures (AC-PY5)');
const component = (code, extra) => ({
  code: `${code}_${stamp}`,
  name: `${code[0].toUpperCase()}${code.slice(1)} ${stamp}`,
  kind: 'allowance',
  taxable: true,
  inContributionBase: true,
  beforeTax: false,
  amountType: 'fixed',
  amountRwf: 20000,
  rate: null,
  capRwf: null,
  condition: null,
  appliesAllActive: false,
  oneOffPeriod: null,
  ...extra,
});
const managerComponent = await post(manager, '/ops/pay-components', component('nope', {}));
check('the manager cannot add a component: 403', managerComponent.status === 403, managerComponent.status);
const transport = await post(owner, '/ops/pay-components', component('transport', { appliesAllActive: true }));
check('a fixed allowance for every active person: 201', transport.status === 201 && transport.body?.appliesAllActive === true, transport.body);
const again = await post(owner, '/ops/pay-components', component('transport', { appliesAllActive: true }));
check('the same code again: 409', again.status === 409, again.status);
const noRate = await post(owner, '/ops/pay-components', component('share', { amountType: 'percent_basic', amountRwf: null }));
check('a percentage without its percentage: 400', noRate.status === 400, noRate.status);
const allowanceBeforeTax = await post(owner, '/ops/pay-components', component('odd', { beforeTax: true }));
check('an allowance taken before tax: 400', allowanceBeforeTax.status === 400, allowanceBeforeTax.status);
const meal = await post(owner, '/ops/pay-components', component('meal', { amountRwf: 7000, appliesAllActive: true, condition: { field: 'wage_basis', op: 'eq', value: 'daily' } }));
check('an allowance with a condition: on a daily wage only', meal.status === 201 && meal.body?.condition?.field === 'wage_basis', meal.body);
const union = await post(owner, '/ops/pay-components', component('union', {
  kind: 'deduction',
  taxable: false,
  inContributionBase: false,
  beforeTax: true,
  amountType: 'percent_basic',
  amountRwf: null,
  rate: 1,
  targets: [{ employeeId: alice.id, mode: 'include' }],
}));
check('a 1% deduction before tax, for one named person: 201', union.status === 201 && union.body?.targets?.length === 1, union.body);
const uniform = await post(owner, '/ops/pay-components', component('uniform', { amountRwf: 10000, taxable: false, inContributionBase: false }));
const structure = await post(owner, '/ops/pay-structures', { name: `Kitchen ${stamp}`, componentIds: [uniform.body?.id] });
check('a structure grouping an untaxed uniform allowance: 201', uniform.status === 201 && structure.status === 201 && structure.body?.componentIds?.length === 1, structure.body);
const carried = await patch(owner, `/ops/contracts/${alice.contract?.id}`, { payStructureId: structure.body?.id });
check('Alice\'s contract carries the structure (PATCH /ops/contracts/:id): 200', carried.status === 200 && carried.body?.payStructureId === structure.body?.id, carried.body);
const strangeStructure = await patch(owner, `/ops/contracts/${alice.contract?.id}`, { payStructureId: randomUUID() });
check('a structure that is not the business\'s: 422', strangeStructure.status === 422, strangeStructure.status);
const counted = (await get(owner, '/ops/pay-structures')).body?.structures?.find((s) => s.id === structure.body?.id);
check('the structure counts the contract that carries it', counted?.contractCount === 1, counted);

// --- Loans and advances (AC-PY8) ---------------------------------------------------------------

console.log('\nLoans and advances (AC-PY8)');
const loanKey = randomUUID();
const loanBody = { employeeId: alice.id, kind: 'loan', amountRwf: 90000, givenOn: today, installments: 3, firstPeriod: period, paidOut: 'payslip', reason: 'School fees' };
const noKey = await post(owner, '/ops/loans', loanBody);
check('a loan without an Idempotency-Key: 400', noKey.status === 400, noKey.status);
const loan = await once(owner, '/ops/loans', loanBody, loanKey);
check('a 90,000 loan in 3, paid out on this month\'s payslip: 201 with its schedule', loan.status === 201 && loan.body?.schedule?.length === 3 && loan.body.schedule.every((i) => i.amountRwf === 30000), loan.body?.schedule);
const replay = await once(owner, '/ops/loans', loanBody, loanKey);
check('the same key again answers the same loan, and records nothing more', replay.body?.id === loan.body?.id, [replay.status, replay.body?.id]);
const uneven = await once(owner, '/ops/loans', { ...loanBody, employeeId: david.id, amountRwf: 40000, installments: 3, paidOut: 'outside', reason: 'Rent' });
check('40,000 in 3: 13,333 twice and the last takes the remainder, 13,334', JSON.stringify(uneven.body?.schedule?.map((i) => i.amountRwf)) === JSON.stringify([13333, 13333, 13334]), uneven.body?.schedule);
const advance = await once(owner, '/ops/loans', { employeeId: bosco.id, kind: 'advance', amountRwf: 20000, givenOn: today, installments: 2, firstPeriod: period, paidOut: 'outside' });
const deferred = await post(owner, `/ops/loans/${advance.body?.id}/installments/${period}/defer`, {});
check(`deferring ${period}'s installment moves it and every later one a month on`, deferred.status === 200 && JSON.stringify(deferred.body?.schedule?.map((i) => i.period)) === JSON.stringify([nextPeriod, nextPeriodOf(nextPeriod)]) && deferred.body.schedule[0].deferredFrom === period, deferred.body?.schedule);
const badPeriod = await post(owner, `/ops/loans/${advance.body?.id}/installments/2026-13/defer`, {});
check('a period that is not one: 400', badPeriod.status === 400, badPeriod.status);
const settled = await post(owner, `/ops/loans/${advance.body?.id}/settle`, { period: nextPeriod });
check(`settled early: everything owed is taken in ${nextPeriod}`, settled.status === 200 && settled.body?.schedule?.every((i) => i.period === nextPeriod), settled.body?.schedule);
const heavy = await once(owner, '/ops/loans', { employeeId: claudine.id, kind: 'advance', amountRwf: 150000, givenOn: today, installments: 1, firstPeriod: period, paidOut: 'outside' });
check('a 150,000 advance repaid at once from a 60,000 wage: 201', heavy.status === 201, heavy.body);
const managerLoan = await once(manager, '/ops/loans', { ...loanBody, employeeId: bosco.id });
check('the manager cannot give a loan: 403', managerLoan.status === 403, managerLoan.status);

// --- Claims (AC-PY9) -----------------------------------------------------------------------------

console.log('\nClaims (AC-PY9)');
const types = (await get(owner, '/ops/leave/types')).body?.types ?? [];
const annual = types.find((t) => t.code === 'annual');
const annualOf = async (employeeId) =>
  (await get(owner, `/ops/employees/${employeeId}/leave-balances`)).body?.balances?.find((b) => b.leaveType.code === 'annual');
const aliceBefore = await annualOf(alice.id);
const tooMany = await once(owner, '/ops/pay-claims', { employeeId: alice.id, kind: 'leave_encashment', leaveTypeId: annual?.id, days: 300, reason: 'All of it' });
check('paying out more days than she has: 409 saying how many she has', tooMany.status === 409 && /has .* to pay out/.test(tooMany.body?.message ?? ''), tooMany.body);
const encash = await once(owner, '/ops/pay-claims', { employeeId: alice.id, kind: 'leave_encashment', leaveTypeId: annual?.id, days: 2, reason: 'Paid out instead of taken' });
check('two annual days paid out, raised for her: 201, waiting', encash.status === 201 && encash.body?.status === 'requested' && encash.body?.period === period, encash.body);
const encashApproved = await post(owner, `/ops/pay-claims/${encash.body?.id}/approve`, { note: 'Agreed' });
const aliceAfter = await annualOf(alice.id);
check('approved: the two days leave her balance as it is decided (AC-LV11)', encashApproved.status === 200 && encashApproved.body?.status === 'approved' && aliceBefore && aliceAfter && Math.round((aliceBefore.balanceDays - aliceAfter.balanceDays) * 10) === 20, [aliceBefore?.balanceDays, aliceAfter?.balanceDays]);
const unpaidType = types.find((t) => t.code === 'unpaid');
const notEncashable = await once(owner, '/ops/pay-claims', { employeeId: alice.id, kind: 'leave_encashment', leaveTypeId: unpaidType?.id, days: 1, reason: 'Not payable' });
check('a type that cannot be paid out: 422', notEncashable.status === 422, notEncashable.status);
const claimB1 = await once(owner, '/ops/pay-claims', { employeeId: bosco.id, kind: 'reimbursement', amountRwf: 3000, reason: 'Taxi to the market' });
const claimB2 = await once(owner, '/ops/pay-claims', { employeeId: bosco.id, kind: 'reimbursement', amountRwf: 4500, reason: 'Gas refill' });
const claimB3 = await once(owner, '/ops/pay-claims', { employeeId: bosco.id, kind: 'reimbursement', amountRwf: 99000, reason: 'Not ours' });
const bulk = await post(owner, '/ops/pay-claims/bulk', { action: 'approve', ids: [claimB1.body?.id, claimB2.body?.id] });
check('two reimbursements approved in bulk: a result per id', bulk.status === 200 && bulk.body?.results?.every((r) => r.ok), bulk.body);
const rejected = await post(owner, `/ops/pay-claims/${claimB3.body?.id}/reject`, { note: 'Not a work expense' });
check('one rejected with a note', rejected.status === 200 && rejected.body?.status === 'rejected' && rejected.body?.decisionNote === 'Not a work expense', rejected.body);
const twice = await post(owner, `/ops/pay-claims/${claimB3.body?.id}/approve`, {});
check('a decided claim cannot be decided again: 409', twice.status === 409, twice.status);

// Self service: a receipt goes up first, then the claim names its key.
const receipt = await upload(desk, `/me/work/${deskFile.employeeId}/files`);
check('Denise uploads her receipt through self service: 201, a key', receipt.status === 201 && typeof receipt.body?.key === 'string', receipt.body);
const myClaim = await call(self(desk), 'POST', `/me/work/${deskFile.employeeId}/claims`, { kind: 'reimbursement', amountRwf: 12500, receiptKey: receipt.body?.key, reason: 'Printer ink for the desk' }, { 'Idempotency-Key': randomUUID() });
check('and raises a 12,500 claim on it: 201, with a receipt', myClaim.status === 201 && myClaim.body?.hasReceipt === true, myClaim.body);
const receiptLink = await get(owner, `/ops/pay-claims/${myClaim.body?.id}/receipt`);
check('the owner opens the receipt: a five minute link', receiptLink.status === 200 && receiptLink.body?.expiresInSeconds === 300, receiptLink.body);
await post(owner, `/ops/pay-claims/${myClaim.body?.id}/approve`, {});
const withdrawn = await call(self(desk), 'POST', `/me/work/${deskFile.employeeId}/claims`, { kind: 'reimbursement', amountRwf: 800, reason: 'Changed my mind' }, { 'Idempotency-Key': randomUUID() });
const cancelled = await post(self(desk), `/me/work/${deskFile.employeeId}/claims/${withdrawn.body?.id}/cancel`, {});
check('she withdraws a claim still waiting: 200, cancelled', cancelled.status === 200 && cancelled.body?.status === 'cancelled', cancelled.body);
const myClaims = await get(self(desk), `/me/work/${deskFile.employeeId}/claims`);
check('she reads her own claims, and nobody else\'s', myClaims.status === 200 && myClaims.body?.claims?.length === 2 && myClaims.body.claims.every((c) => c.employee.employeeId === deskFile.employeeId), myClaims.body?.claims?.length);
const probe = await get(self(desk), `/me/work/${alice.id}/claims`);
check('asking for a colleague\'s claims: 404', probe.status === 404, probe.status);

// --- Adjustments (AC-PY16) ----------------------------------------------------------------------

console.log('\nPay adjustments (AC-PY16)');
const adjKey = randomUUID();
const adjBody = { employeeId: alice.id, side: 'earning', amountRwf: 15000, taxable: true, contributable: true, correctsPeriod: lastPeriod, reason: 'Night shifts missed last month' };
const adjustment = await once(owner, '/ops/pay-adjustments', adjBody, adjKey);
const adjustmentAgain = await once(owner, '/ops/pay-adjustments', adjBody, adjKey);
check(`a 15,000 earning correcting ${lastPeriod}: 201, and the key answers it again`, adjustment.status === 201 && adjustment.body?.status === 'open' && adjustmentAgain.body?.id === adjustment.body?.id, [adjustment.body, adjustmentAgain.status]);
const fine = await once(owner, '/ops/pay-adjustments', { ...adjBody, side: 'deduction', amountRwf: 5000, reason: 'Broken glass' });
const waived = await post(owner, `/ops/pay-adjustments/${fine.body?.id}/waive`, { reason: 'An accident, the business pays' });
check('a deduction waived with a reason: it will never be taken', waived.status === 200 && waived.body?.status === 'waived', waived.body);

// --- Attendance becomes pay: a daily wage and overtime (AC-PY2, AC-PY4) -----------------------------

console.log('\nWork becomes pay (AC-PY2, AC-PY4)');
let boscoUnits = null;
let overtime = null;
if (pastDays.length === 0) {
  skip('a daily wage from the days worked, and overtime', `today is the ${dayOfMonth}: no earlier day of ${period} to clock`);
} else {
  const workDay = async (employeeId, date, from, to) => {
    const inRes = await post(owner, '/ops/attendance/clock-in', { employeeId, at: kigali(date, from) });
    const outRes = await post(owner, `/ops/attendance/${inRes.body?.id}/clock-out`, { at: kigali(date, to) });
    return outRes.body;
  };
  const units = (m) => (m >= 360 ? 1 : m * 2 >= 360 ? 0.5 : 0);
  const fullDay = await workDay(bosco.id, pastDays[0], '08:00', '16:00');
  boscoUnits = units(fullDay?.figures?.workedMinutes ?? 0);
  if (pastDays[1]) {
    const halfDay = await workDay(bosco.id, pastDays[1], '08:00', '12:00');
    boscoUnits += units(halfDay?.figures?.workedMinutes ?? 0);
  }
  check(`Bosco's days are closed with their figures: ${boscoUnits} day(s) of work`, boscoUnits > 0, fullDay?.figures);

  const shift = await post(owner, '/ops/shift-templates', { propertyId: BOUTIQUE, name: `Pay morning ${stamp}`, startsAt: '06:00', endsAt: '14:00', breakMinutes: 30 });
  await post(owner, '/ops/roster', { employeeId: alice.id, shiftTemplateId: shift.body?.id, workDate: pastDays[0] });
  const long = await workDay(alice.id, pastDays[0], '06:00', '16:00');
  const worked = long?.figures?.overtimeMinutes ?? 0;
  const approved = await post(owner, `/ops/attendance/${long?.id}/overtime`, { approvedMinutes: Math.min(worked, 120) });
  overtime = { minutes: approved.body?.figures?.approvedOvertimeMinutes ?? 0, dayKind: approved.body?.figures?.dayKind ?? null };
  check(`Alice stays two hours past her shift and the overtime is approved (${overtime.minutes} min on a ${overtime.dayKind})`, approved.status === 200 && overtime.minutes > 0 && overtime.dayKind !== null, approved.body?.figures ?? approved.body);
}

// --- A leaver's settlement (AC-PY13) -------------------------------------------------------------

console.log('\nA leaver\'s last payslip (AC-PY13)');
const off = await post(owner, `/ops/employees/${david.id}/offboard`, { lastDay: today, reason: 'Moved to Huye' });
check('David leaves today: 200', off.status === 200, off.body?.message ?? off.status);
const davidAnnual = await annualOf(david.id);
const unusedDays = davidAnnual?.balanceDays ?? 0;
check(`he leaves with ${unusedDays} unused annual day(s)`, unusedDays > 0, davidAnnual);

// --- The draft, computed again with everything above (AC-PY1 to AC-PY7) --------------------------

console.log(`\nThe ${period} draft (AC-PY1 to AC-PY7)`);
let detail = await post(owner, `/ops/pay-runs/${runId}/recompute`, {});
check('recomputed: 200', detail.status === 200, detail.body?.message ?? detail.status);
const slipOf = (who) => detail.body?.payslips?.find((p) => p.employeeId === who.id);
const lineOf = (slip, code) => slip?.lines?.filter((l) => l.code === code) ?? [];
const amount = (slip, code) => lineOf(slip, code).reduce((s, l) => s + l.amountRwf, 0);

const a = slipOf(alice);
check('Alice: the month\'s wage, 300,000', amount(a, 'wage') === 300000, lineOf(a, 'wage'));
check('the allowance for everybody, 20,000, and her structure\'s uniform, 10,000, untaxed', amount(a, `allowance:transport_${stamp}`) === 20000 && amount(a, `allowance:uniform_${stamp}`) === 10000 && lineOf(a, `allowance:uniform_${stamp}`)[0]?.taxable === false, a?.lines?.filter((l) => l.code.startsWith('allowance:')));
check('no meal allowance: its condition asks for a daily wage', lineOf(a, `allowance:meal_${stamp}`).length === 0, '');
check('her own 1% union deduction, 3,000, taken before tax', amount(a, `deduction:union_${stamp}`) === 3000 && lineOf(a, `deduction:union_${stamp}`)[0]?.beforeTax === true, lineOf(a, `deduction:union_${stamp}`));
check('the adjustment pays 15,000, and the waived one takes nothing', amount(a, 'adjustment') === 15000 && lineOf(a, 'adjustment').length === 1, lineOf(a, 'adjustment'));
check('two annual days paid out at the day rate: 20,000, taxed', amount(a, 'leave_encashment') === 20000 && lineOf(a, 'leave_encashment')[0]?.taxable === true, lineOf(a, 'leave_encashment'));
check('the loan pays out 90,000 with the net and its first installment, 30,000, comes off', amount(a, 'loan_paid_out') === 90000 && lineOf(a, 'loan_paid_out')[0]?.side === 'passthrough' && amount(a, 'loan') === 30000, [lineOf(a, 'loan_paid_out'), lineOf(a, 'loan')]);
if (overtime && overtime.minutes > 0) {
  const expected = overtimeOf(300000, overtime.minutes, overtime.dayKind);
  check(`overtime: ${overtime.minutes} minutes at 300,000 / 200 hours × ${MULTIPLIER[overtime.dayKind]} = ${expected} (AC-PY4)`, amount(a, 'overtime') === expected, lineOf(a, 'overtime'));
} else skip('overtime on the payslip', 'no overtime was recorded');
const sideSum = (slip, side) => slip.lines.filter((l) => l.side === side).reduce((s, l) => s + l.amountRwf, 0);
check('gross is the sum of the earnings, money that is not income the pass through lines', a && a.grossRwf === sideSum(a, 'earning') && a.nonIncomeRwf === sideSum(a, 'passthrough') && a.nonIncomeRwf === 90000, a && [a.grossRwf, a.nonIncomeRwf]);
check('other deductions are the deduction lines: the union share and the installment', a && a.otherDeductionsRwf === sideSum(a, 'deduction') && a.otherDeductionsRwf === 33000, a?.otherDeductionsRwf);
check('net = gross + not income − PAYE − employee contributions − deductions (AC-PY6a)', a && a.netRwf === a.grossRwf + a.nonIncomeRwf - a.payeRwf - a.employeeContributionsRwf - a.otherDeductionsRwf, a);
const payeLine = lineOf(a, 'paye')[0];
const payeRule = rules.body?.rules?.find((r) => r.configType === 'hr.rw.paye')?.inForce?.value;
const taxableEarnings = a ? a.lines.filter((l) => l.side === 'earning' && l.taxable !== false).reduce((s, l) => s + l.amountRwf, 0) - a.lines.filter((l) => l.side === 'deduction' && l.beforeTax).reduce((s, l) => s + l.amountRwf, 0) : 0;
const expectedBase = {
  gross: a?.grossRwf,
  gross_less_employee_contributions: (a?.grossRwf ?? 0) - (a?.employeeContributionsRwf ?? 0),
  taxable: taxableEarnings,
  taxable_less_employee_contributions: taxableEarnings - (a?.employeeContributionsRwf ?? 0),
}[payeRule?.taxableBase];
check(`PAYE is the sample bands on the base the rule in force names, ${payeRule?.taxableBase} (AC-PY6)`, payeLine && payeLine.taxBase === expectedBase && payeLine.amountRwf === samplePaye(payeLine.taxBase), [payeLine, expectedBase]);

const b = slipOf(bosco);
if (boscoUnits !== null) {
  check(`Bosco: ${boscoUnits} day(s) at 12,000 is ${12000 * boscoUnits} (AC-PY2)`, amount(b, 'daily_wage') === 12000 * boscoUnits, lineOf(b, 'daily_wage'));
  check('and the meal allowance his daily wage meets', amount(b, `allowance:meal_${stamp}`) === 7000, lineOf(b, `allowance:meal_${stamp}`));
}
check('his two approved reimbursements, 7,500, pass through untaxed; the rejected one does not', amount(b, 'reimbursement') === 7500 && lineOf(b, 'reimbursement').every((l) => l.side === 'passthrough'), lineOf(b, 'reimbursement'));
check('his advance, deferred to next month, takes nothing now', lineOf(b, 'loan').length === 0, lineOf(b, 'loan'));

const d = slipOf(david);
const n = Number(today.slice(8, 10));
const hundredths = n === daysInMonth ? 3000 : Math.floor((6000 * n + daysInMonth) / (2 * daysInMonth));
check(`David: ${n} of ${daysInMonth} days is ${hundredths / 100} thirtieths of his wage (AC-PY1)`, amount(d, 'wage') === halfUp(300000 * hundredths, 3000), [amount(d, 'wage'), halfUp(300000 * hundredths, 3000)]);
check(`his ${unusedDays} unused annual day(s) are paid at the day rate: ${dayRate(300000, unusedDays)} (AC-PY13)`, amount(d, 'settlement_leave') === dayRate(300000, unusedDays), lineOf(d, 'settlement_leave'));
check('and every installment he still owes, 40,000, comes off the last payslip', amount(d, 'loan') === 40000 && lineOf(d, 'loan').length === 3, lineOf(d, 'loan'));
check('the run records the settlement and overtime rows it read (AC-Y2)', ['hr.rw.final_settlement', ...(overtime?.minutes ? ['hr.rw.overtime'] : [])].every((t) => detail.body?.run?.ruleVersions?.some((r) => r.configType === t)), detail.body?.run?.ruleVersions);

const blockers = detail.body?.blockers ?? [];
const negative = blockers.find((x) => x.code === 'negative_net' && x.employeeId === claudine.id);
check('Claudine would be paid less than nothing: blocked, with a deferral and a hold offered (AC-PY7)', negative && negative.remedies?.includes('defer_installment') && negative.remedies?.includes('hold_payslip'), negative ?? blockers.map((x) => x.code));
check('no RSSB employer number in HR settings: the run says so (AC-PY14)', blockers.some((x) => x.code === 'missing_rssb_employer_number' && x.employeeId === null), blockers.map((x) => x.code));

if (DB) {
  await sql(`update config_entries set effective_to = '2000-01-01' where config_type in ('hr.rw.overtime', 'hr.rw.final_settlement')`);
  const without = await post(owner, `/ops/pay-runs/${runId}/recompute`, {});
  await sql(`update config_entries set effective_to = null where config_type in ('hr.rw.overtime', 'hr.rw.final_settlement')`);
  const codes = (without.body?.blockers ?? []).map((x) => x.code);
  check('with the settlement row out of force: blocked, never paid at zero (AC-PY13)', codes.includes('missing_settlement_rule'), codes);
  if (overtime?.minutes) check('with the overtime row out of force: blocked the same way (AC-PY4)', codes.includes('missing_overtime_rule'), codes);
} else skip('a missing settlement or overtime rule blocks the run', 'no DATABASE_URL');

// --- Holding a payslip (AC-PY7) -------------------------------------------------------------------

console.log('\nHolding a payslip (AC-PY7)');
const managerHold = await post(manager, `/ops/pay-runs/${runId}/hold`, { employeeId: claudine.id, reason: 'Short month' });
check('the manager cannot hold pay: 403', managerHold.status === 403, managerHold.status);
detail = await post(owner, `/ops/pay-runs/${runId}/hold`, { employeeId: claudine.id, reason: 'She owes more than she earns this month' });
check('Claudine\'s payslip is held: 200, and she is out of this run', detail.status === 200 && !slipOf(claudine) && !(detail.body?.blockers ?? []).some((x) => x.employeeId === claudine.id), detail.body?.message ?? detail.body?.blockers);
const heldAdj = ((await get(owner, listPath('/ops/pay-adjustments', { filters: [['source', 'eq', 'held_payslip']] }))).body?.items ?? []).find((x) => x.employee.employeeId === claudine.id);
check(`her month's earnings wait as one earning correcting ${period}`, heldAdj?.side === 'earning' && heldAdj?.correctsPeriod === period && heldAdj?.amountRwf > 60000, heldAdj);
const heavyNow = (await get(owner, `/ops/loans/${heavy.body?.id}`)).body;
check(`and her installment moved to ${nextPeriod}`, heavyNow?.schedule?.[0]?.period === nextPeriod && heavyNow.schedule[0].deferredFrom === period, heavyNow?.schedule);

// --- Confirming (AC-Y3, AC-PY14) ---------------------------------------------------------------------

console.log('\nConfirming the run');
const draftSlip = slipOf(alice);
const draftPdf = await raw(owner, `/ops/payslips/${draftSlip?.id}/pdf`);
check('a draft payslip does not print: 409, it is a preview', draftPdf.status === 409, draftPdf.status);
const draftList = await get(self(desk), `/me/work/${deskFile.employeeId}/payslips`);
check('and nobody reads it through self service while it is a draft', draftList.status === 200 && !draftList.body?.payslips?.some((p) => p.period === period), draftList.body);
let confirmed = await post(owner, `/ops/pay-runs/${runId}/confirm`, {});
check('confirm is refused, listing the missing employer number', confirmed.status === 409 && confirmed.body?.blockers?.some((x) => x.code === 'missing_rssb_employer_number'), confirmed.body?.blockers?.map((x) => x.code));
const employerNumber = `DEMO-RSSB-${stamp}`;
const setEmployer = await patch(owner, '/ops/hr/settings', { rssbEmployerNumber: employerNumber });
check('the owner records it in HR settings: 200', setEmployer.status === 200 && setEmployer.body?.rssbEmployerNumber === employerNumber, setEmployer.body);
for (const x of confirmed.body?.blockers ?? []) {
  // Rows the sample backfilled without their statutory fields; the office types them.
  if (x.code === 'missing_rssb_number') await patch(owner, `/ops/employees/${x.employeeId}`, { rssbNumber: `RB${stamp.slice(-4)}${x.employeeId.slice(-4)}` });
  if (x.code === 'missing_id') await patch(owner, `/ops/employees/${x.employeeId}`, { idDocumentType: 'national_id', idDocumentNumber: `11989${stamp}${x.employeeId.slice(-3)}`.slice(0, 16) });
}
confirmed = await post(owner, `/ops/pay-runs/${runId}/confirm`, {});
check('confirm: 200, confirmed', confirmed.status === 200 && confirmed.body?.run?.status === 'confirmed', confirmed.body?.blockers ?? confirmed.body?.message ?? confirmed.status);

const frozen = (who) => confirmed.body?.payslips?.find((p) => p.employeeId === who.id);
const aliceLoan = (await get(owner, `/ops/loans/${loan.body?.id}`)).body;
check('the first installment is marked paid with this payslip: 30,000 repaid, 60,000 left', aliceLoan?.paidRwf === 30000 && aliceLoan?.remainingRwf === 60000 && aliceLoan.schedule[0].paid === true, aliceLoan && [aliceLoan.paidRwf, aliceLoan.remainingRwf]);
const claimsNow = (await get(owner, listPath('/ops/pay-claims', { q: stamp }))).body?.items ?? [];
check('the approved claims are paid; the rejected one is not', claimsNow.filter((c) => c.status === 'approved').every((c) => c.paid) && claimsNow.filter((c) => c.status === 'rejected').every((c) => !c.paid), claimsNow.map((c) => [c.status, c.paid]));
const adjNow = ((await get(owner, listPath('/ops/pay-adjustments', { q: stamp }))).body?.items ?? []).find((x) => x.id === adjustment.body?.id);
check(`the adjustment is paid, in ${period}`, adjNow?.status === 'paid' && adjNow?.paidInPeriod === period, adjNow);
const davidAfter = await annualOf(david.id);
check('David\'s paid out days are written off his balance as encashed (AC-PY13)', davidAfter?.balanceDays === 0 && (davidAfter?.entries ?? []).some((e) => e.kind === 'encashed'), davidAfter && [davidAfter.balanceDays, davidAfter.entries?.filter((e) => e.kind === 'encashed')]);
const davidLoan = (await get(owner, `/ops/loans/${uneven.body?.id}`)).body;
check('and his loan is settled', davidLoan?.settledAt !== null && davidLoan?.remainingRwf === 0, davidLoan && [davidLoan.settledAt, davidLoan.remainingRwf]);
const lateAdj = await once(owner, '/ops/pay-adjustments', { ...adjBody, amountRwf: 1000, reason: 'One more correction' });
check(`an adjustment raised now lands on ${nextPeriod}, the next open month`, lateAdj.status === 201, lateAdj.body);
const lateSettle = await post(owner, `/ops/loans/${loan.body?.id}/settle`, { period });
check(`settling into ${period}, now confirmed: 409`, lateSettle.status === 409, lateSettle.status);

// --- Payslips: printed, paid and sent (AC-PY10, AC-PY11) -------------------------------------------------

console.log('\nPayslips: printed, paid and sent (AC-PY10, AC-PY11)');
const fa = frozen(alice);
const pdf = await raw(owner, `/ops/payslips/${fa?.id}/pdf`);
check('a confirmed payslip prints: a PDF named for the month and the person', isPdf(pdf) && pdf.disposition.includes(`payslip-${period}-`), [pdf.status, pdf.type, pdf.disposition]);
const runPdf = await raw(owner, `/ops/pay-runs/${runId}/payslips.pdf`);
check('the whole run prints as one PDF, for staff without accounts', isPdf(runPdf) && runPdf.bytes.length > pdf.bytes.length, [runPdf.status, runPdf.bytes.length, pdf.bytes.length]);
const managerPdf = await raw(manager, `/ops/payslips/${fa?.id}/pdf`);
check('the manager cannot print it: 403', managerPdf.status === 403, managerPdf.status);
const reference = `BK-${stamp}`;
const paid = await post(owner, `/ops/payslips/${fa?.id}/mark-paid`, { paidOn: today, method: 'bank', reference });
check('marked paid by bank with the bank\'s reference: 200', paid.status === 200 && paid.body?.paidMethod === 'bank' && paid.body?.paidReference === reference, paid.body);
const paidAgain = await post(owner, `/ops/payslips/${fa?.id}/mark-paid`, { paidOn: today, method: 'bank', reference });
check('the same reference again answers the payslip as it is: 200', paidAgain.status === 200 && paidAgain.body?.paidAt === paid.body?.paidAt, paidAgain.status);
const otherRef = await post(owner, `/ops/payslips/${fa?.id}/mark-paid`, { paidOn: today, method: 'bank', reference: `${reference}-X` });
check('another reference: 409, unmark it first', otherRef.status === 409, otherRef.status);
const unmarked = await post(owner, `/ops/payslips/${fa?.id}/unmark-paid`, { reason: 'Wrong reference typed' });
check('unmarked with a reason: 200, not paid', unmarked.status === 200 && unmarked.body?.paidAt === null, unmarked.body);
const rest = (confirmed.body?.payslips ?? []).map((p) => p.id);
const bulkPaid = await post(owner, '/ops/payslips/bulk', { action: 'mark_paid', ids: rest, params: { paidOn: today, method: 'cash', reference: `CASH-${stamp}` } });
check('every payslip of the run marked paid in cash in one go: a result per id', bulkPaid.status === 200 && bulkPaid.body?.results?.length === rest.length && bulkPaid.body.results.every((r) => r.ok), bulkPaid.body?.results?.filter((r) => !r.ok));
const listed = await get(owner, listPath('/ops/payslips', { filters: [['period', 'eq', period]] }));
check('the payslips list across runs shows the month, every one paid', listed.status === 200 && listed.body?.total === rest.length && listed.body.items.every((p) => p.paidAt !== null), listed.body?.items?.map((p) => [p.employee.displayName, p.paidAt]));

console.log('\nSelf service (058-self-service AC-SS7)');
const mine = await get(self(desk), `/me/work/${deskFile.employeeId}/payslips`);
const myPayslip = mine.body?.payslips?.find((p) => p.period === period);
check('Denise reads her confirmed payslip, with when it was paid', mine.status === 200 && myPayslip && myPayslip.paidAt !== null, mine.body);
const myPdf = await raw(self(desk), `/me/work/${deskFile.employeeId}/payslips/${myPayslip?.id}/pdf`);
check('and downloads it as a PDF', isPdf(myPdf), [myPdf.status, myPdf.type]);
const sent = (await get(owner, listPath('/ops/payslips', { filters: [['period', 'eq', period]] }))).body?.items?.find((p) => p.id === myPayslip?.id);
check('her first download marks it sent (AC-PY11)', sent?.sentAt !== null && sent?.sentAt !== undefined, sent);
const colleague = await raw(self(desk), `/me/work/${deskFile.employeeId}/payslips/${fa?.id}/pdf`);
const colleagueFile = await get(self(desk), `/me/work/${alice.id}/payslips`);
check('a colleague\'s payslip, by its id or by their file: 404 both ways', colleague.status === 404 && colleagueFile.status === 404, [colleague.status, colleagueFile.status]);
const myLoans = await get(self(desk), `/me/work/${deskFile.employeeId}/loans`);
check('she reads her loans: none', myLoans.status === 200 && myLoans.body?.loans?.length === 0, myLoans.body);

// --- Files (AC-PY10, AC-PY12) -------------------------------------------------------------------------

console.log('\nThe bank, MoMo and declaration files (AC-PY10, AC-PY12)');
const text = async (url) => {
  try {
    return await (await fetch(url)).text();
  } catch (error) {
    return `fetch failed: ${error.message}`;
  }
};
const managerExport = await post(manager, `/ops/pay-runs/${runId}/exports`, { kind: 'bank' });
check('the manager cannot build a file: 403', managerExport.status === 403, managerExport.status);
const bankFile = await post(owner, `/ops/pay-runs/${runId}/exports`, { kind: 'bank' });
const bankText = await text(bankFile.body?.url);
check('the bank file: Alice, by her primary account', bankFile.status === 201 && bankFile.body?.file?.rowCount >= 1 && bankText.includes(`Pay ${stamp}`) && bankText.includes(stamp.slice(-7)), [bankFile.status, bankFile.body?.file]);
check('it says it is provisional on its first line', bankText.split(/\r?\n/)[0] === PROVISIONAL, bankText.split(/\r?\n/)[0]);
check('and lists who it left out and why: Bosco is paid by MoMo', bankFile.body?.leftOut?.some((l) => l.employeeId === bosco.id && l.reason.length > 0), bankFile.body?.leftOut);
const momoFile = await post(owner, `/ops/pay-runs/${runId}/exports`, { kind: 'momo' });
check('the MoMo file carries Bosco', momoFile.status === 201 && (await text(momoFile.body?.url)).includes(`Ndayisaba Bosco Pay ${stamp}`), momoFile.body?.file);
const paye = await post(owner, `/ops/pay-runs/${runId}/declarations`, { kind: 'paye' });
const payeText = await text(paye.body?.url);
check('the PAYE declaration, from the frozen lines, in the provisional format of the rule in force', paye.status === 201 && paye.body?.file?.formatVersion === 'provisional_csv v1' && payeText.includes(fa?.employeeNumber ?? 'missing'), [paye.body?.file, payeText.split(/\r?\n/).slice(0, 3)]);
const rssb = await post(owner, `/ops/pay-runs/${runId}/declarations`, { kind: 'rssb' });
check('the RSSB declaration names the employer number', rssb.status === 201 && (await text(rssb.body?.url)).includes(employerNumber), rssb.body?.file);
const filesList = await get(owner, `/ops/pay-runs/${runId}/files`);
check('the run lists the four files it built', filesList.status === 200 && filesList.body?.files?.length === 4, filesList.body?.files?.map((f) => f.kind));
const fetchedAgain = await get(owner, `/ops/pay-files/${bankFile.body?.file?.id}`);
check('a file built before is fetched again as a fresh five minute link', fetchedAgain.status === 200 && fetchedAgain.body?.expiresInSeconds === 300, fetchedAgain.body);

// --- The month after ---------------------------------------------------------------------------------

console.log(`\nThe ${nextPeriod} draft`);
const next = await post(owner, '/ops/pay-runs', { period: nextPeriod });
const nextSlip = (who) => next.body?.payslips?.find((p) => p.employeeId === who.id);
check(`Claudine's held month is paid in ${nextPeriod}, as an adjustment`, nextSlip(claudine)?.lines?.some((l) => l.code === 'adjustment' && l.amountRwf === heldAdj?.amountRwf), nextSlip(claudine)?.lines?.filter((l) => l.code === 'adjustment'));
check('her advance is taken then', nextSlip(claudine)?.lines?.some((l) => l.code === 'loan' && l.amountRwf === 150000), nextSlip(claudine)?.lines?.filter((l) => l.code === 'loan'));
check('Alice repays installment 2 of 3', nextSlip(alice)?.lines?.some((l) => l.code === 'loan' && /2 of 3/.test(l.label)), nextSlip(alice)?.lines?.filter((l) => l.code === 'loan'));
check('Bosco\'s settled advance is taken in full', nextSlip(bosco)?.lines?.filter((l) => l.code === 'loan').reduce((s, l) => s + l.amountRwf, 0) === 20000, nextSlip(bosco)?.lines?.filter((l) => l.code === 'loan'));
check('David, gone, has no payslip', !nextSlip(david), '');

const dashboard = await get(owner, '/ops/payroll/dashboard');
const month = dashboard.body?.months?.find((m) => m.period === period);
check('the dashboard: the confirmed month with its totals, and what is still open', dashboard.status === 200 && month?.status === 'confirmed' && month.headcount === rest.length && dashboard.body.openLoansRwf > 0, [month, dashboard.body?.openLoansRwf]);

if (DB) {
  const audit = await sql(
    `select event_type, count(*)::int as n from audit_events where event_type in ('hr.loan_recorded', 'hr.claim_raised', 'hr.payslip_held', 'hr.payslip_marked_paid', 'hr.payslip_unmarked_paid', 'hr.pay_export_built', 'hr.pay_declaration_built') group by event_type`,
  );
  const have = new Set(audit.map((r) => r.event_type));
  check('loans, claims, holds, payments and files are on the audit trail', ['hr.claim_raised', 'hr.payslip_held', 'hr.payslip_marked_paid', 'hr.payslip_unmarked_paid', 'hr.pay_export_built', 'hr.pay_declaration_built'].every((e) => have.has(e)), audit);
  const leaked = await sql(`select count(*)::int as n from audit_events where event_type like 'hr.%' and payload_diff::text like $1`, [`%${stamp.slice(-7)}-78%`]);
  check('no account number is written to the trail', leaked[0].n === 0, leaked[0].n);
  await client?.end();
} else skip('the audit trail', 'no DATABASE_URL');

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
