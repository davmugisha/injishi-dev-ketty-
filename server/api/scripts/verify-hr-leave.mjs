#!/usr/bin/env node
// Verify leave in full end to end (ADR-058 slice 5, 058-leave and the self
// service routes marked 5 in 058-self-service).
//
// Drives the real API as the Amahoro demo roster: the owner shapes leave types
// (a carried type with seniority and two steps, a once in a lifetime type with
// no step), declares restricted periods and takes the national defaults; the
// manager files and decides requests at each step and decides asks for extra
// and compensatory days; the desk asks for its own leave, with a sick note,
// through `/me/work`; and the lots behind every balance are read back: a
// year's days expiring, the carried ones expiring after their months, leave
// booked ahead on days not yet earned, and cancellations giving days back to
// the lot they came from. Every check names the acceptance criterion it proves.
//
// It WRITES, and it is meant for a FRESHLY SEEDED sample database you own,
// never the shared one. The cooks and types it creates are new on each run,
// but it gives the demo personas' files a branch and a manager, takes days
// from their balances and confirms last month's pay run, so a second run on
// the same database meets the first run's rows. Reseed between runs.
//
// With DATABASE_URL set it also reads the database (ledger rows, the outbox,
// the audit trail), writes a newer sample defaults row for the defaults check,
// and runs the daily job through `run-hr-daily.mjs`, which needs an API build:
// `dist/`, or API_DIST_DIR. Without DATABASE_URL those checks are skipped and
// say so.
//
//   VERIFY_API_URL=http://localhost:8014 DATABASE_URL=postgres://.../injishi_hr \
//     API_DIST_DIR=dist-worker node scripts/verify-hr-leave.mjs
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const API = process.env.VERIFY_API_URL || 'http://localhost:8000';
const OTP = process.env.VERIFY_OTP_CODE || '123456';
const DB = process.env.DATABASE_URL?.trim() || null;
const here = dirname(fileURLToPath(import.meta.url));

const AMAHORO_ORG = 'de300000-0000-4000-8000-000000000101';
const BOUTIQUE = 'de300000-0000-4000-8000-000000000401';

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
const dow = (d) => new Date(`${d}T12:00:00Z`).getUTCDay();
const mondayOf = (d) => addDays(d, -((dow(d) + 6) % 7));
const isWeekend = (d) => dow(d) === 0 || dow(d) === 6;
/** The first date on or after `d` that is Monday to Friday. */
const weekdayFrom = (d) => {
  let x = d;
  while (isWeekend(x)) x = addDays(x, 1);
  return x;
};
/** The last date on or before `d` that is Monday to Friday. */
const weekdayUpTo = (d) => {
  let x = d;
  while (isWeekend(x)) x = addDays(x, -1);
  return x;
};
const monthStart = (d) => `${d.slice(0, 7)}-01`;
const nextMonthStart = (d) => {
  const x = new Date(`${monthStart(d)}T12:00:00Z`);
  x.setUTCMonth(x.getUTCMonth() + 1);
  return x.toISOString().slice(0, 10);
};
const prevMonthStart = (d) => {
  const x = new Date(`${monthStart(d)}T12:00:00Z`);
  x.setUTCMonth(x.getUTCMonth() - 1);
  return x.toISOString().slice(0, 10);
};
const addMonths = (d, n) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x.toISOString().slice(0, 10);
};
/** A Kigali wall clock time as an instant: Kigali is UTC+2 all year. */
const kigali = (date, hhmm) => new Date(`${date}T${hhmm}:00+02:00`).toISOString();

const today = kigaliToday();
const year = Number(today.slice(0, 4));
const thisMonth = monthStart(today);
const nextMonth = nextMonthStart(today);
const lastMonth = prevMonthStart(today);
const nextMonday = mondayOf(addDays(today, 7));
const weekAfter = addDays(nextMonday, 7);
const tenth = (n) => Math.round(n * 10) / 10;

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
const del = (s, p) => call(s, 'DELETE', p);
/** Self service carries no workspace header: ownership is the guard. */
const self = (s) => ({ cookie: s.cookie });
function listPath(path, { q, filters = [], size = 100 } = {}) {
  const params = new URLSearchParams({ size: String(size) });
  if (q) params.set('q', q);
  if (filters.length > 0) params.set('f', JSON.stringify(filters));
  return `${path}?${params}`;
}

/** A tiny real PDF: the upload is checked by its first bytes. */
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
async function upload(s, path, fields = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append('file', new Blob([PDF], { type: 'application/pdf' }), 'note.pdf');
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
const idNumber = (n) => `11987${stamp}${n}`.slice(0, 16);

console.log(`Verifying leave against ${API}, today ${today} (Kigali)\n`);

const owner = await sessionFor('yves@demo.injishi.com');
const manager = await sessionFor('solange@demo.injishi.com');
const desk = await sessionFor('denise@demo.injishi.com');
if (!owner.workspaceId || !manager.workspaceId || !desk.workspaceId) {
  throw new Error('The Amahoro roster did not resolve a workspace. Is this a seeded sample database?');
}

// --- The people of this run -----------------------------------------------------------

const hiredTwoYearsAgo = `${year - 2}-03-15`;
const cookBody = (n, name, sex, hiredOn) => ({
  legalName: `${name} Leave ${stamp}`,
  phone: `0788 8${stamp.slice(-2)} 3${n}0`.replace(/ /g, ''),
  dateOfBirth: `1990-04-0${n}`,
  sex,
  idDocumentType: 'national_id',
  idDocumentNumber: idNumber(n),
  rssbNumber: `RL${stamp}${n}`,
  hiredOn,
  workPropertyId: BOUTIQUE,
});
const cookF = (await post(owner, '/ops/employees', cookBody(1, 'Mukamana Fiona', 'female', hiredTwoYearsAgo))).body;
const cookM = (await post(owner, '/ops/employees', cookBody(2, 'Habimana Marc', 'male', hiredTwoYearsAgo))).body;
const cookN = (await post(owner, '/ops/employees', cookBody(3, 'Iradukunda Nadia', 'female', thisMonth))).body;
if (![cookF, cookM, cookN].every((c) => c?.id)) throw new Error('Could not create the cooks of this run.');
const contract = await post(owner, `/ops/employees/${cookF.id}/contracts`, {
  contractType: 'permanent',
  startsOn: hiredTwoYearsAgo,
  wageBasis: 'monthly',
  wageRwf: 300000,
});
if (contract.status !== 201) throw new Error(`Could not give the first cook a contract: ${JSON.stringify(contract.body)}`);

const filesOf = async (s) => (await get(self(s), '/me/work')).body?.files ?? [];
const amahoroFile = async (s) => (await filesOf(s)).find((f) => f.orgId === AMAHORO_ORG);
const deskFile = await amahoroFile(desk);
const managerFile = await amahoroFile(manager);
if (!deskFile || !managerFile) throw new Error('The demo personas have no Amahoro files. Is this a seeded sample database?');
// Denise works the Boutique's desk and reports to Solange. The backfill dated
// both files from the day the sample was seeded; they are moved two years back
// before anything accrues, since a hire date is history once leave is earned.
const backdate = async (employeeId, extra) => {
  const res = await patch(owner, `/ops/employees/${employeeId}`, { workPropertyId: BOUTIQUE, hiredOn: hiredTwoYearsAgo, ...extra });
  if (res.status !== 200) throw new Error(`Could not ready a persona's file: ${JSON.stringify(res.body)}`);
};
await backdate(managerFile.employeeId, {});
await backdate(deskFile.employeeId, { reportingManagerId: managerFile.employeeId });

const balancesOf = async (s, employeeId) => (await get(s, `/ops/employees/${employeeId}/leave-balances`)).body?.balances ?? [];
const balanceOf = async (employeeId, code) => (await balancesOf(manager, employeeId)).find((b) => b.leaveType.code === code);
const request = (s, employeeId, leaveTypeId, startsOn, endsOn, extra = {}) =>
  post(s, '/ops/leave/requests', { employeeId, leaveTypeId, startsOn, endsOn, ...extra });

// --- Leave types (AC-LV1, AC-L1) --------------------------------------------------------

console.log('Leave types (AC-LV1)');
const deskTypes = await get(desk, '/ops/leave/types');
check('the desk reads the leave types: 200 (any HR permission)', deskTypes.status === 200, deskTypes.status);
const types = deskTypes.body?.types ?? [];
const type = (code) => types.find((t) => t.code === code);
check(
  'the first read made the types from the national defaults row (AC-L1, AC-LV12)',
  ['annual', 'unpaid', 'sick', 'maternity', 'paternity', 'study', 'compensatory'].every((c) => !!type(c)),
  types.map((t) => t.code),
);
const sick = type('sick');
check('sick leave is partly paid, needs a note, may start in the past and is statutory', sick?.payment === 'partial' && sick?.paymentPercent === 60 && sick?.needsAttachment && sick?.allowsPastRequests && sick?.statutory, sick);
check('maternity counts weekly days off and holidays inside its range, women only', type('maternity')?.countsWeeklyOffs === true && type('maternity')?.countsHolidays === true && type('maternity')?.eligibleSex === 'female', type('maternity'));
check('time off in lieu never resets and its days live 3 months', type('compensatory')?.reset === 'never' && type('compensatory')?.carryExpiresMonths === 3 && type('compensatory')?.compensatory === true, type('compensatory'));
const annual = type('annual');
const unpaid = type('unpaid');
const study = type('study');

const carriedBody = {
  code: `carried_${stamp}`,
  name: `Carried leave ${stamp}`,
  payment: 'paid',
  paymentPercent: null,
  yearlyEntitlementDays: 12,
  accrual: 'yearly_upfront',
  reset: 'yearly',
  carry: 'carry_with_expiry',
  carryMaxDays: 5,
  carryExpiresMonths: 3,
  approvalSteps: 2,
  needsAttachment: false,
  countsWeeklyOffs: false,
  countsHolidays: false,
  eligibleSex: null,
  minServiceMonths: 0,
  oncePerEmployment: false,
  statutory: false,
  allowsPastRequests: false,
  encashable: false,
  compensatory: false,
  seniorityEveryYears: 1,
  seniorityExtraDays: 1,
  seniorityCapDays: 3,
};
const managerType = await post(manager, '/ops/leave/types', carriedBody);
check('the manager cannot make a type: 403 (people.manage)', managerType.status === 403, managerType.status);
const carriedRes = await post(owner, '/ops/leave/types', carriedBody);
const carried = carriedRes.body;
check('the owner makes a carried type: two steps, 5 days carried for 3 months, a day more a year of service', carriedRes.status === 201 && carried?.carry === 'carry_with_expiry' && carried?.approvalSteps === 2, carriedRes.body);
const dupType = await post(owner, '/ops/leave/types', carriedBody);
check('the same code again: 409', dupType.status === 409, dupType.status);
const monthlyCarry = await post(owner, '/ops/leave/types', { ...carriedBody, code: `bad_${stamp}`, reset: 'monthly' });
check('a type resetting monthly that carries days: 400', monthlyCarry.status === 400, monthlyCarry.status);
const secondInLieu = await post(owner, '/ops/leave/types', { ...carriedBody, code: `lieu_${stamp}`, carry: 'none', reset: 'never', approvalSteps: 1, seniorityEveryYears: null, seniorityExtraDays: null, seniorityCapDays: null, compensatory: true });
check('a second type taking compensatory days: 409', secondInLieu.status === 409, secondInLieu.body);
const partialNoShare = await patch(owner, `/ops/leave/types/${carried?.id}`, { payment: 'partial' });
check('partly paid without saying the share: 400', partialNoShare.status === 400, partialNoShare.status);
const weddingRes = await post(owner, '/ops/leave/types', {
  ...carriedBody,
  code: `wedding_${stamp}`,
  name: `Wedding leave ${stamp}`,
  yearlyEntitlementDays: 3,
  carry: 'none',
  carryMaxDays: 0,
  carryExpiresMonths: null,
  approvalSteps: 0,
  oncePerEmployment: true,
  seniorityEveryYears: null,
  seniorityExtraDays: null,
  seniorityCapDays: null,
});
const wedding = weddingRes.body;
check('the owner makes a once per employment type with no approval step: 201', weddingRes.status === 201 && wedding?.approvalSteps === 0 && wedding?.oncePerEmployment === true, weddingRes.body);

// --- Lots: a year's days expire, carried days expire after their months (AC-LV2 to AC-LV5)

console.log('\nLots behind a balance (AC-LV2, AC-LV3, AC-LV5)');
const carriedF = await balanceOf(cookF.id, carried?.code);
/** Rows of one kind, oldest first (the ledger reads newest first). */
const kinds = (entries, kind) =>
  (entries ?? []).filter((e) => e.kind === kind).sort((a, b) => a.effectiveOn.localeCompare(b.effectiveOn) || a.id.localeCompare(b.id));
check(
  `three years of accrual: 12, 12, then 13 with a year of service (AC-LV5)`,
  JSON.stringify(kinds(carriedF?.entries, 'accrual').map((e) => e.days)) === JSON.stringify([12, 12, 13]),
  kinds(carriedF?.entries, 'accrual').map((e) => [e.effectiveOn, e.days]),
);
check('each year end expires the closing year and carries 5 days (AC-LV2)', kinds(carriedF?.entries, 'carry_forward').length === 2 && kinds(carriedF?.entries, 'carry_forward').every((e) => e.days === 5 && e.expiresOn !== null), kinds(carriedF?.entries, 'carry_forward'));
const carriedExpiry = kinds(carriedF?.entries, 'carry_forward').map((e) => e.expiresOn);
check(`carried days expire 3 months into the year: ${year - 1}-04-01 and ${year}-04-01`, JSON.stringify(carriedExpiry) === JSON.stringify([`${year - 1}-04-01`, `${year}-04-01`]), carriedExpiry);
check('every expiry names its lot: two year ends and two carried lots (AC-LV2, AC-LV3)', kinds(carriedF?.entries, 'expiry').length === 4 && kinds(carriedF?.entries, 'expiry').every((e) => e.lotId !== null), kinds(carriedF?.entries, 'expiry').map((e) => [e.effectiveOn, e.days]));
check('the balance is what is left: 13, all of it this year\'s lot', carriedF?.balanceDays === 13 && carriedF?.lots?.length === 1 && carriedF.lots[0].remainingDays === 13 && carriedF.lots[0].usableUntil === `${year}-12-31`, carriedF && [carriedF.balanceDays, carriedF.lots]);
const sumEntries = (entries) => tenth((entries ?? []).reduce((s, e) => s + e.days, 0));
check('the balance is the sum of the ledger (AC-L4)', carriedF && sumEntries(carriedF.entries) === carriedF.balanceDays, carriedF?.balanceDays);
if (DB) {
  const before = await sql(`select count(*)::int as n from leave_ledger_entries where employee_id = $1`, [cookF.id]);
  await balanceOf(cookF.id, carried?.code);
  const after = await sql(`select count(*)::int as n from leave_ledger_entries where employee_id = $1`, [cookF.id]);
  check('reading again writes nothing twice (unique per lot and per period)', before[0].n === after[0].n, [before[0].n, after[0].n]);
} else skip('reading again writes nothing', 'no DATABASE_URL');

// --- Booked ahead on days not yet earned (AC-LV4a, AC-LV4) ---------------------------------

console.log('\nBooking ahead (AC-LV4a, AC-LV4)');
const annualN = await balanceOf(cookN.id, 'annual');
check('a cook hired on the 1st has earned this month\'s 1.5 days', annualN?.balanceDays === 1.5, annualN?.balanceDays);
const thisWeekTwo = weekdayFrom(addDays(today, 1));
const nowTwo = await request(manager, cookN.id, annual?.id, thisWeekTwo, weekdayFrom(addDays(thisWeekTwo, 1)));
check('two days before next month\'s accrual: 409 stating what is left', nowTwo.status === 409 && /left/.test(nowTwo.body?.message ?? ''), nowTwo.body);
let aheadReq = null;
if (nextMonth.slice(5, 7) === '01') {
  skip('booking next month on next month\'s accrual', 'next month starts a new leave year, whose lots this one cannot reach');
} else {
  const aheadStart = weekdayFrom(addDays(nextMonth, 1));
  const ahead = await request(manager, cookN.id, annual?.id, aheadStart, weekdayFrom(addDays(aheadStart, 1)));
  aheadReq = ahead.body;
  check('the same two days next month: 201, counted against what she will have then (AC-LV4a)', ahead.status === 201 && ahead.body?.days === 2, ahead.body);
  const approved = await post(owner, `/ops/leave/requests/${aheadReq?.id}/approve`, {});
  check('approved at its one step: 200', approved.status === 200 && approved.body?.status === 'approved', approved.body);
  const afterAhead = await balanceOf(cookN.id, 'annual');
  const taken = kinds(afterAhead?.entries, 'taken');
  check('the taken rows draw the lot she has, and the rest from days not yet earned (AC-LV4)', sumEntries(taken) === -2 && taken.some((t) => t.lotId !== null) && taken.some((t) => t.lotId === null), taken.map((t) => [t.days, t.lotId]));
  const cancelled = await post(manager, `/ops/leave/requests/${aheadReq?.id}/cancel`, { note: 'Plans changed' });
  const afterCancel = await balanceOf(cookN.id, 'annual');
  const reversals = kinds(afterCancel?.entries, 'reversal');
  check('cancelled: each taken row reversed, naming the same lot (AC-L5, AC-LV4)', cancelled.status === 200 && reversals.length === taken.length && taken.every((t) => reversals.some((r) => r.lotId === t.lotId && r.days === -t.days)), reversals.map((r) => [r.days, r.lotId]));
  check('and the balance is back to 1.5', afterCancel?.balanceDays === 1.5, afterCancel?.balanceDays);
}

// --- Eligibility, attachments and past dates (AC-LV6) ---------------------------------------

console.log('\nEligibility, notes and past dates (AC-LV6)');
const lateWeekday = weekdayFrom(addDays(nextMonday, 2));
const maternityM = await request(manager, cookM.id, type('maternity')?.id, lateWeekday, lateWeekday);
check('maternity leave for a man: 422 naming the rule', maternityM.status === 422 && /women|female/i.test(maternityM.body?.message ?? ''), maternityM.body);
const paternityF = await request(manager, cookF.id, type('paternity')?.id, lateWeekday, lateWeekday);
check('paternity leave for a woman: 422', paternityF.status === 422, paternityF.body);
const beforeHire = await request(manager, cookN.id, annual?.id, weekdayFrom(addDays(lastMonth, 9)), weekdayFrom(addDays(lastMonth, 9)));
check('leave before the hire date: 422 naming it', beforeHire.status === 422 && beforeHire.body?.message?.includes(thisMonth), beforeHire.body);
const studyN = await request(manager, cookN.id, study?.id, lateWeekday, lateWeekday);
check('study leave before 12 months of service: 422 naming the months', studyN.status === 422 && /12 months|month/i.test(studyN.body?.message ?? ''), studyN.body);
const sickNoNote = await request(manager, cookM.id, sick?.id, addDays(today, -1), addDays(today, 1));
check('sick leave without a note: 422', sickNoNote.status === 422 && /attachment|note/i.test(sickNoNote.body?.message ?? ''), sickNoNote.body);
const docKey = (await upload(owner, '/ops/hr/files', { purpose: 'document' })).body?.objectKey;
const wrongKind = await request(manager, cookM.id, sick?.id, addDays(today, -1), addDays(today, 1), { attachmentKey: docKey });
check('a document\'s key where an attachment belongs: 422', wrongKind.status === 422, wrongKind.body);
const noteUp = await upload(owner, '/ops/hr/files', { purpose: 'attachment' });
check('the office uploads a sick note: 201, a PDF by its bytes', noteUp.status === 201 && noteUp.body?.mime === 'application/pdf', noteUp.body);
const sickM = await request(manager, cookM.id, sick?.id, addDays(today, -1), addDays(today, 1), { attachmentKey: noteUp.body?.objectKey, reason: 'Flu' });
check('sick leave from yesterday with the note: 201, it has an attachment', sickM.status === 201 && sickM.body?.hasAttachment === true && sickM.body?.payment === 'partial' && sickM.body?.paymentPercent === 60, sickM.body);
const link = await get(manager, `/ops/leave/requests/${sickM.body?.id}/attachment`);
check('the manager opens the note: a five minute link', link.status === 200 && typeof link.body?.url === 'string' && link.body?.expiresInSeconds === 300, link.body);
const deskLink = await get(desk, `/ops/leave/requests/${sickM.body?.id}/attachment`);
check('the desk cannot open it: 403', deskLink.status === 403, deskLink.status);
const sickApproved = await post(manager, `/ops/leave/requests/${sickM.body?.id}/approve`, {});
check('approved: the cook is off from yesterday to tomorrow', sickApproved.status === 200 && sickApproved.body?.status === 'approved', sickApproved.body);
const weddingF = await request(manager, cookF.id, wedding?.id, lateWeekday, lateWeekday);
check('a type with no step is approved as it is asked (AC-LV7)', weddingF.status === 201 && weddingF.body?.status === 'approved', weddingF.body);
const weddingAgain = await request(manager, cookF.id, wedding?.id, addDays(lateWeekday, 7), addDays(lateWeekday, 7));
check('once per employment, a second time: 422', weddingAgain.status === 422 && /once/i.test(weddingAgain.body?.message ?? ''), weddingAgain.body);

// --- Two steps (AC-LV7) ---------------------------------------------------------------

console.log('\nTwo steps (AC-LV7)');
const studyDay = weekdayFrom(addDays(weekAfter, 1));
const studyF = await request(manager, cookF.id, study?.id, studyDay, studyDay, { reason: 'Exam' });
check('study leave is filed with its two steps copied onto it', studyF.status === 201 && studyF.body?.approvalSteps === 2 && studyF.body?.currentStep === 1, studyF.body);
const step1 = await post(manager, `/ops/leave/requests/${studyF.body?.id}/approve`, { note: 'Fine by the kitchen' });
check('the manager approves step 1: still waiting, now at step 2', step1.status === 200 && step1.body?.status === 'requested' && step1.body?.currentStep === 2 && step1.body?.approvals?.length === 1, step1.body);
const sameAgain = await post(manager, `/ops/leave/requests/${studyF.body?.id}/approve`, {});
check('the step 1 approver approving step 2 too: 403', sameAgain.status === 403, sameAgain.body);
const studyBalanceMid = await balanceOf(cookF.id, 'study');
check('nothing is taken before the final step', kinds(studyBalanceMid?.entries, 'taken').length === 0, studyBalanceMid?.entries);
const step2 = await post(owner, `/ops/leave/requests/${studyF.body?.id}/approve`, {});
check('the owner approves step 2: approved, two decisions on record', step2.status === 200 && step2.body?.status === 'approved' && step2.body?.approvals?.map((a) => a.decision).join() === 'approved,approved', step2.body);
check('only now is the day taken', kinds((await balanceOf(cookF.id, 'study'))?.entries, 'taken').length === 1, '');
const studyM = await request(manager, cookM.id, study?.id, studyDay, studyDay);
await post(manager, `/ops/leave/requests/${studyM.body?.id}/approve`, {});
const rejected2 = await post(owner, `/ops/leave/requests/${studyM.body?.id}/reject`, { note: 'Not this term' });
check('rejected at step 2: the request ends, both decisions on record', rejected2.status === 200 && rejected2.body?.status === 'rejected' && rejected2.body?.approvals?.map((a) => a.decision).join() === 'approved,rejected', rejected2.body);
if (DB) {
  const outbox = await sql(`select count(*)::int as n from outbox_events where event_type = 'leave.step2_pending' and payload->>'leaveRequestId' = $1`, [studyF.body?.id]);
  check('step 2 waiting is told once (leave.step2_pending)', outbox[0].n === 1, outbox[0].n);
  const others = await sql(
    `select count(*)::int as n from org_memberships m join users u on u.id = m.user_id
      where m.org_id = $1 and m.status = 'active' and m.org_role in ('owner', 'manager') and u.email not in ($2, $3)`,
    [AMAHORO_ORG, owner.email, manager.email],
  );
  const solangeCarried = await request(owner, managerFile.employeeId, carried?.id, studyDay, studyDay);
  const solangeStep1 = await post(owner, `/ops/leave/requests/${solangeCarried.body?.id}/approve`, {});
  if (others[0].n === 0) {
    check('the manager\'s own two step leave: nobody else decides at the branch, so step 2 is skipped and step 1 decides', solangeStep1.status === 200 && solangeStep1.body?.status === 'approved' && solangeStep1.body?.approvals?.some((a) => a.step === 2 && a.decision === 'skipped'), solangeStep1.body);
  } else {
    skip('step 2 skipped when nobody else decides', `${others[0].n} other owner or manager in this business`);
  }
} else skip('the outbox and the skipped step', 'no DATABASE_URL');

// --- Restricted periods (AC-LV9) -------------------------------------------------------

console.log('\nRestricted periods (AC-LV9)');
const seasonFrom = weekdayFrom(addDays(weekAfter, 7));
const seasonTo = addDays(seasonFrom, 6);
const managerPeriod = await post(manager, '/ops/leave/restricted-periods', { title: 'High season', fromDate: seasonFrom, toDate: seasonTo });
check('the manager cannot declare one: 403', managerPeriod.status === 403, managerPeriod.status);
const periodRes = await post(owner, '/ops/leave/restricted-periods', { title: `High season ${stamp}`, fromDate: seasonFrom, toDate: seasonTo, description: 'Conference week' });
check('the owner declares the high season: 201, every type', periodRes.status === 201 && periodRes.body?.typeMode === 'all', periodRes.body);
const inSeason = await request(manager, cookF.id, annual?.id, seasonFrom, seasonFrom);
check('annual leave in it: 422 naming the period', inSeason.status === 422 && inSeason.body?.message?.includes(`High season ${stamp}`), inSeason.body);
const sickInSeason = await request(manager, cookF.id, sick?.id, seasonFrom, seasonFrom, { attachmentKey: noteUp.body?.objectKey });
check('sick leave in it: 201, a statutory type is never restricted', sickInSeason.status === 201, sickInSeason.body);
const deskPeriods = await get(desk, '/ops/leave/restricted-periods');
check('the desk cannot read them: 403', deskPeriods.status === 403, deskPeriods.status);
const narrowed = await post(owner, '/ops/leave/restricted-periods', {
  title: `Stocktake ${stamp}`,
  fromDate: addDays(seasonTo, 1),
  toDate: addDays(seasonTo, 3),
  typeMode: 'only',
  leaveTypeIds: [unpaid?.id],
});
const narrowDay = weekdayFrom(addDays(seasonTo, 1)) <= addDays(seasonTo, 3) ? weekdayFrom(addDays(seasonTo, 1)) : addDays(seasonTo, 1);
const annualInNarrow = await request(manager, cookF.id, annual?.id, narrowDay, narrowDay);
check('a period covering only unpaid leave lets annual leave through', narrowed.status === 201 && annualInNarrow.status === 201, [narrowed.status, annualInNarrow.body]);
const waitingAnnual = await request(manager, cookM.id, annual?.id, addDays(seasonTo, 8), addDays(seasonTo, 8));
const later = await post(owner, '/ops/leave/restricted-periods', { title: `Late audit ${stamp}`, fromDate: addDays(seasonTo, 8), toDate: addDays(seasonTo, 8) });
const approveRestricted = await post(manager, `/ops/leave/requests/${waitingAnnual.body?.id}/approve`, {});
check('declared after the request: approving it is refused (422), checked again at the decision', approveRestricted.status === 422 && approveRestricted.body?.message?.includes(`Late audit ${stamp}`), approveRestricted.body);
const removed = await del(owner, `/ops/leave/restricted-periods/${later.body?.id}`);
const approveFree = await post(manager, `/ops/leave/requests/${waitingAnnual.body?.id}/approve`, {});
check('removed: 204, and the request goes through', removed.status === 204 && approveFree.status === 200, [removed.status, approveFree.status]);

// --- Extra and compensatory days (AC-LV8) -------------------------------------------------

console.log('\nExtra and compensatory days (AC-LV8)');
const annualBefore = (await balanceOf(cookF.id, 'annual'))?.balanceDays ?? 0;
const extra = await post(manager, '/ops/leave/allocation-requests', { kind: 'extra', employeeId: cookF.id, leaveTypeId: annual?.id, days: 2, reason: 'Worked the conference' });
check('the manager asks 2 extra annual days for the cook: 201, waiting', extra.status === 201 && extra.body?.status === 'requested' && extra.body?.days === 2, extra.body);
const noBalance = await post(manager, '/ops/leave/allocation-requests', { kind: 'extra', employeeId: cookF.id, leaveTypeId: unpaid?.id, days: 1, reason: 'Nothing to add to' });
check('extra days on a type that keeps no balance: 422', noBalance.status === 422, noBalance.body);
const deskAllocations = await get(desk, '/ops/leave/allocation-requests');
check('the desk has no allocation queue: 403', deskAllocations.status === 403, deskAllocations.status);
const extraApproved = await post(owner, `/ops/leave/allocation-requests/${extra.body?.id}/approve`, { note: 'Thank you' });
const annualAfterExtra = await balanceOf(cookF.id, 'annual');
check('approved: one adjustment lot of 2 days, and the balance 2 more', extraApproved.status === 200 && kinds(annualAfterExtra?.entries, 'adjustment').length === 1 && tenth(annualAfterExtra?.balanceDays - annualBefore) === 2, [extraApproved.status, annualBefore, annualAfterExtra?.balanceDays]);

// Days worked on a weekly day off and on a business holiday, from the desk.
const weekendDay = (() => {
  for (let n = 1; n <= 6; n++) if (isWeekend(addDays(today, -n))) return addDays(today, -n);
  return null;
})();
const holidayDay = (() => {
  for (let n = 1; n <= 6; n++) if (!isWeekend(addDays(today, -n))) return addDays(today, -n);
  return null;
})();
const plainDay = (() => {
  for (let n = 1; n <= 6; n++) if (!isWeekend(addDays(today, -n)) && addDays(today, -n) !== holidayDay) return addDays(today, -n);
  return null;
})();
const holiday = await post(owner, '/ops/hr/holidays', { name: `Founders day ${stamp}`, fromDate: holidayDay, toDate: holidayDay });
// On the first cook: the second is on sick leave from yesterday, and a day of approved leave refuses a clock in.
const worked = async (date, from, to) => {
  const ci = await post(desk, '/ops/attendance/clock-in', { employeeId: cookF.id, at: kigali(date, from) });
  const co = await post(desk, `/ops/attendance/${ci.body?.id}/clock-out`, { at: kigali(date, to) });
  return co.body ?? ci.body;
};
// The weekend day is rostered 08:00 to 12:00, so the seven hours worked carry three of overtime.
const weekendShift = (await post(manager, '/ops/shift-templates', { propertyId: BOUTIQUE, name: `Weekend ${stamp}`, startsAt: '08:00', endsAt: '12:00', breakMinutes: 0 })).body;
const weekendEntry = await post(manager, '/ops/roster', { employeeId: cookF.id, shiftTemplateId: weekendShift?.id, workDate: weekendDay });
const weekendRecord = await worked(weekendDay, '08:00', '15:00');
const holidayRecord = await worked(holidayDay, '08:00', '11:30');
const plainRecord = await worked(plainDay, '16:00', '18:00');
check('three closed, validated records: a weekend, a holiday and a working day', holiday.status === 201 && [weekendRecord, holidayRecord, plainRecord].every((r) => r?.status === 'closed' && r?.validated), [holiday.status, weekendRecord?.status, holidayRecord?.status, plainRecord?.status]);
if (DB) {
  const [ot] = await sql('select overtime_minutes, approved_overtime_minutes from attendance_records where id = $1', [weekendRecord?.id]);
  check('the weekend record carries 3 hours of overtime, not yet decided', weekendEntry.status === 201 && ot?.overtime_minutes === 180 && ot?.approved_overtime_minutes === null, [weekendEntry.status, ot]);
} else skip('the overtime of the weekend record', 'no DATABASE_URL');
const compFull = await post(manager, '/ops/leave/allocation-requests', { kind: 'compensatory', employeeId: cookF.id, attendanceRecordId: weekendRecord?.id, reason: 'Covered the weekend' });
check(`7 hours on ${weekendDay}, a weekly day off: a whole day asked in lieu`, compFull.status === 201 && compFull.body?.days === 1 && compFull.body?.workDate === weekendDay && compFull.body?.leaveType?.id === type('compensatory')?.id, compFull.body);
const compAgain = await post(manager, '/ops/leave/allocation-requests', { kind: 'compensatory', employeeId: cookF.id, attendanceRecordId: weekendRecord?.id, reason: 'Again' });
check('the same date again: 409, a date is compensated once', compAgain.status === 409, compAgain.body);
const compHalf = await post(manager, '/ops/leave/allocation-requests', { kind: 'compensatory', employeeId: cookF.id, attendanceRecordId: holidayRecord?.id, reason: 'Founders day' });
check('3.5 hours on a business holiday: half a day', compHalf.status === 201 && compHalf.body?.days === 0.5, compHalf.body);
const compPlain = await post(manager, '/ops/leave/allocation-requests', { kind: 'compensatory', employeeId: cookF.id, attendanceRecordId: plainRecord?.id, reason: 'Just a shift' });
check('a working day earns none: 422', compPlain.status === 422, compPlain.body);
const compApproved = await post(owner, `/ops/leave/allocation-requests/${compFull.body?.id}/approve`, {});
const lieu = await balanceOf(cookF.id, 'compensatory');
const lieuLot = kinds(lieu?.entries, 'adjustment')[0];
check('approved: a lot of 1 day in time off in lieu, expiring in 3 months', compApproved.status === 200 && lieu?.balanceDays === 1 && lieuLot?.expiresOn === addMonths(today, 3), lieu && [lieu.balanceDays, lieuLot]);
if (DB) {
  const rec = await sql(`select overtime_minutes, approved_overtime_minutes from attendance_records where id = $1`, [weekendRecord?.id]);
  check('the day is paid once: its 3 hours of overtime are now approved at 0', rec[0]?.overtime_minutes === 180 && rec[0]?.approved_overtime_minutes === 0, rec[0]);
} else skip('approved overtime set to 0', 'no DATABASE_URL');
const bulkOne = await post(manager, '/ops/leave/allocation-requests', { kind: 'extra', employeeId: cookN.id, leaveTypeId: annual?.id, days: 1, reason: 'First' });
const bulkTwo = await post(manager, '/ops/leave/allocation-requests', { kind: 'extra', employeeId: cookN.id, leaveTypeId: annual?.id, days: 1.5, reason: 'Second' });
const bulk = await post(manager, '/ops/leave/allocation-requests/bulk', { action: 'reject', ids: [bulkOne.body?.id, bulkTwo.body?.id, compHalf.body?.id], params: { note: 'Not now' } });
check('bulk reject: a result per id', bulk.status === 200 && bulk.body?.results?.length === 3 && bulk.body.results.every((r) => r.ok), bulk.body);
const queue = await get(manager, listPath('/ops/leave/allocation-requests', { filters: [['status', 'eq', 'rejected']] }));
check('the allocation queue filters by status', queue.status === 200 && queue.body?.items?.length >= 3 && queue.body.items.every((r) => r.status === 'rejected'), queue.body?.items?.length);

// --- Self service (058-self-service AC-SS6) --------------------------------------------------

console.log('\nSelf service (AC-SS6)');
const me = deskFile.employeeId;
const myTypes = await get(self(desk), `/me/work/${me}/leave/types`);
const deskSex = (await get(owner, `/ops/employees/${me}`)).body?.sex;
const opposite = deskSex === 'female' ? 'paternity' : deskSex === 'male' ? 'maternity' : null;
check('the types she may ask for leave out what she is not eligible for', myTypes.status === 200 && (opposite === null || !myTypes.body?.types?.some((t) => t.code === opposite)), myTypes.body?.types?.map((t) => t.code));
const myBalances = await get(self(desk), `/me/work/${me}/leave/balances`);
const myAnnual = myBalances.body?.balances?.find((b) => b.leaveType.code === 'annual');
check('she reads her balances with the lots behind them', myBalances.status === 200 && Array.isArray(myAnnual?.lots), myAnnual && [myAnnual.balanceDays, myAnnual.lots?.length]);
const probe = await get(self(desk), `/me/work/${cookF.id}/leave/balances`);
check('another file\'s balances under /me/work: 404', probe.status === 404, probe.status);
const myDay = weekdayFrom(addDays(weekAfter, 2));
const mine = await post(self(desk), `/me/work/${me}/leave/requests`, { leaveTypeId: annual?.id, startsOn: myDay, endsOn: myDay, reason: 'Wedding of a friend' });
check('she asks for a day: 201, routed to Solange', mine.status === 201 && mine.body?.routedToEmployeeId === managerFile.employeeId, mine.body);
const past = await post(self(desk), `/me/work/${me}/leave/requests`, { leaveTypeId: annual?.id, startsOn: weekdayUpTo(addDays(today, -1)), endsOn: weekdayUpTo(addDays(today, -1)) });
check('annual leave dated in the past, in self service: 422', past.status === 422, past.body);
const team = await get(self(manager), `/me/work/${managerFile.employeeId}/team/requests?kind=leave`);
check('Solange sees it under her team\'s requests', team.status === 200 && team.body?.leave?.some((r) => r.id === mine.body?.id), team.body?.leave?.length);
const teamOne = await get(self(manager), `/me/work/${managerFile.employeeId}/team/requests/leave/${mine.body?.id}`);
const notHers = await get(self(manager), `/me/work/${managerFile.employeeId}/team/requests/leave/${studyF.body?.id}`);
check('she reads it, and gets 404 for a request not routed to her', teamOne.status === 200 && notHers.status === 404, [teamOne.status, notHers.status]);
const myCancel = await post(self(desk), `/me/work/${me}/leave/requests/${mine.body?.id}/cancel`, {});
const myCancel2 = await post(self(desk), `/me/work/${me}/leave/requests/${mine.body?.id}/cancel`, {});
check('she withdraws it while it waits: 200, then 409', myCancel.status === 200 && myCancel.body?.status === 'cancelled' && myCancel2.status === 409, [myCancel.status, myCancel2.status]);
const mine2 = await post(self(desk), `/me/work/${me}/leave/requests`, { leaveTypeId: annual?.id, startsOn: myDay, endsOn: myDay });
await post(manager, `/ops/leave/requests/${mine2.body?.id}/approve`, {});
const cancelApproved = await post(self(desk), `/me/work/${me}/leave/requests/${mine2.body?.id}/cancel`, {});
check('approved leave is not withdrawn from self service: 409', cancelApproved.status === 409, cancelApproved.body);
const myUpload = await upload(self(desk), `/me/work/${me}/files`);
check('she uploads her own sick note: 201, a key', myUpload.status === 201 && typeof myUpload.body?.key === 'string' && myUpload.body?.contentType === 'application/pdf', myUpload.body);
// Two or more days back, a working day: not a weekend and not the holiday above.
const sickStart = (() => {
  let d = addDays(today, -2);
  while (isWeekend(d) || d === holidayDay) d = addDays(d, -1);
  return d;
})();
const mySick = await post(self(desk), `/me/work/${me}/leave/requests`, { leaveTypeId: sick?.id, startsOn: sickStart, endsOn: sickStart, attachmentKey: myUpload.body?.key });
check('sick leave two days back with it: 201 (a type that allows past dates)', mySick.status === 201 && mySick.body?.hasAttachment === true, mySick.body);
const tooFarBack = await post(self(desk), `/me/work/${me}/leave/requests`, { leaveTypeId: sick?.id, startsOn: addDays(today, -40), endsOn: addDays(today, -39), attachmentKey: myUpload.body?.key });
check('sick leave 40 days back: 422, 30 at most', tooFarBack.status === 422, tooFarBack.body);
const myLink = await get(self(desk), `/me/work/${me}/leave/requests/${mySick.body?.id}/attachment`);
check('she opens her own note', myLink.status === 200 && typeof myLink.body?.url === 'string', myLink.status);
const myExtra = await post(self(desk), `/me/work/${me}/leave/allocation-requests`, { kind: 'extra', leaveTypeId: annual?.id, days: 1, reason: 'Covered a night' });
const teamAlloc = await get(self(manager), `/me/work/${managerFile.employeeId}/team/requests?kind=allocation`);
check('she asks a day more: 201, and it shows in Solange\'s team requests', myExtra.status === 201 && teamAlloc.body?.allocation?.some((r) => r.id === myExtra.body?.id), [myExtra.status, teamAlloc.body?.allocation?.length]);
const ownDecision = await post(manager, `/ops/leave/allocation-requests/${(await post(owner, '/ops/leave/allocation-requests', { kind: 'extra', employeeId: managerFile.employeeId, leaveTypeId: annual?.id, days: 1, reason: 'Mine' })).body?.id}/approve`, {});
check('nobody decides their own days: 403', ownDecision.status === 403, ownDecision.body);
const myExtraCancel = await post(self(desk), `/me/work/${me}/leave/allocation-requests/${myExtra.body?.id}/cancel`, {});
check('she withdraws her ask: 200, cancelled', myExtraCancel.status === 200 && myExtraCancel.body?.status === 'cancelled', myExtraCancel.body);

// --- The dashboard and everybody's balances (AC-LV13) ----------------------------------------

console.log('\nThe dashboard and the balances (AC-LV13)');
const dash = await get(manager, '/ops/leave/dashboard');
check('on leave today: the sick cook', dash.status === 200 && dash.body?.onLeaveToday?.some((r) => r.requestId === sickM.body?.id), dash.body?.onLeaveToday);
check('what waits is counted', typeof dash.body?.waiting?.requests === 'number' && typeof dash.body?.waiting?.allocations === 'number', dash.body?.waiting);
const deskDash = await get(desk, '/ops/leave/dashboard');
const deskBalances = await get(desk, '/ops/leave/balances');
check('a receptionist asking for the dashboard or the balances: 403', deskDash.status === 403 && deskBalances.status === 403, [deskDash.status, deskBalances.status]);
const everyone = await get(manager, listPath('/ops/leave/balances', { q: `Mukamana Fiona Leave ${stamp}` }));
const fionaRow = everyone.body?.items?.find((r) => r.employee.employeeId === cookF.id);
const fionaAnnual = await balanceOf(cookF.id, 'annual');
check('the balances list has a row per person, each type the sum of the ledger', everyone.status === 200 && fionaRow?.balances?.find((b) => b.leaveTypeId === annual?.id)?.days === fionaAnnual?.balanceDays && fionaRow?.balances?.find((b) => b.leaveTypeId === unpaid?.id)?.days === null, fionaRow);

// --- Partly paid leave on the payslip (AC-LV1 payment) -------------------------------------

console.log('\nPartly paid leave on the payslip');
const sickDays = [weekdayFrom(thisMonth)];
sickDays.push(weekdayFrom(addDays(sickDays[0], 1)));
const inMonth = sickDays[1].slice(0, 7) === today.slice(0, 7);
const sickF = await request(manager, cookF.id, sick?.id, sickDays[0], inMonth ? sickDays[1] : sickDays[0], { attachmentKey: noteUp.body?.objectKey });
const sickFApproved = await post(owner, `/ops/leave/requests/${sickF.body?.id}/approve`, {});
const draft = await post(owner, '/ops/pay-runs', { period: today.slice(0, 7) });
const slip = draft.body?.payslips?.find((p) => p.employeeId === cookF.id);
const partial = slip?.lines?.find((l) => l.code === 'partly_paid_leave');
const sickDaysTaken = sickFApproved.body?.days ?? 0;
const expected = Math.floor((300000 * sickDaysTaken * 2 * 40 + 3000) / 6000);
check(`${sickDaysTaken} sick day${sickDaysTaken === 1 ? "" : "s"} at 60%: the payslip takes back 40% of each day, ${expected}`, draft.status === 201 && partial?.amountRwf === -expected, [draft.status, draft.body?.message, partial]);

// --- Offboarding returns the days after the last day to their lots (AC-O1, AC-LV4) ------------

console.log('\nOffboarding (AC-O1 with lots)');
const leaveFrom = weekdayFrom(addDays(seasonTo, 14));
const leaveTo = weekdayFrom(addDays(leaveFrom, 4));
const longLeave = await request(manager, cookM.id, annual?.id, leaveFrom, leaveTo);
const longApproved = await post(manager, `/ops/leave/requests/${longLeave.body?.id}/approve`, {});
const off = await post(owner, `/ops/employees/${cookM.id}/offboard`, { lastDay: leaveFrom, reason: 'Moved away' });
const mAnnual = await balanceOf(cookM.id, 'annual');
const reversed = kinds(mAnnual?.entries, 'reversal').filter((e) => e.leaveRequestId === longLeave.body?.id);
const takenForIt = kinds(mAnnual?.entries, 'taken').filter((e) => e.leaveRequestId === longLeave.body?.id);
check('the days after the last day come back, each to the lot it was drawn from', longApproved.status === 200 && off.status === 200 && reversed.length > 0 && tenth(-sumEntries(takenForIt) - sumEntries(reversed)) === 1 && reversed.every((r) => takenForIt.some((t) => t.lotId === r.lotId)), [off.status, off.body?.message, sumEntries(takenForIt), sumEntries(reversed)]);

// --- The daily job (AC-LV2, AC-LV3) ------------------------------------------------------

console.log('\nThe daily job');
if (DB) {
  try {
    runDaily();
    const before = await sql(`select count(*)::int as n from leave_ledger_entries`);
    runDaily();
    const after = await sql(`select count(*)::int as n from leave_ledger_entries`);
    check('a second run writes nothing: every lot event is unique', before[0].n === after[0].n, [before[0].n, after[0].n]);
  } catch (error) {
    skip('the daily job twice', `run-hr-daily.mjs failed: ${String(error.message).split('\n')[0]}`);
  }
  const lotless = await sql(`select count(*)::int as n from leave_ledger_entries where kind in ('expiry', 'encashed') and lot_id is null`);
  check('no expiry without its lot (the ledger check holds)', lotless[0].n === 0, lotless[0].n);
} else skip('the daily job', 'no DATABASE_URL');

// --- A type that is used keeps its shape; archiving (AC-LV1) --------------------------------

console.log('\nEditing a type that is in use (AC-LV1)');
const switchBalance = await patch(owner, `/ops/leave/types/${carried?.id}`, { yearlyEntitlementDays: null, accrual: 'none', carry: 'none', carryMaxDays: 0, carryExpiresMonths: null });
check('a used type cannot stop keeping a balance: 409', switchBalance.status === 409, switchBalance.body);
const renamed = await patch(owner, `/ops/leave/types/${carried?.id}`, { name: `Carried leave renamed ${stamp}` });
check('renaming it: 200, applies from now', renamed.status === 200 && renamed.body?.name === `Carried leave renamed ${stamp}`, renamed.body);
const archived = await patch(owner, `/ops/leave/types/${wedding?.id}`, { status: 'archived' });
const archivedAsk = await request(manager, cookN.id, wedding?.id, lateWeekday, lateWeekday);
check('an archived type is no longer offered: 404 on asking', archived.status === 200 && archived.body?.status === 'archived' && archivedAsk.status === 404, [archived.status, archivedAsk.status]);

// --- The national defaults against the business's types (AC-LV12) ----------------------------

console.log('\nThe national defaults (AC-LV12)');
const managerDiff = await get(manager, '/ops/leave/types/defaults');
check('the manager does not read the defaults: 403', managerDiff.status === 403, managerDiff.status);
if (DB) {
  const [latest] = await sql(`select version, value from config_entries where config_type = 'hr.rw.leave_defaults' order by version desc limit 1`);
  const nextValue = structuredClone(latest.value);
  const annualDefault = nextValue.types.find((t) => t.code === 'annual');
  annualDefault.yearlyEntitlementDays = (annualDefault.yearlyEntitlementDays ?? 18) + 1;
  nextValue.types.push({ code: `bereave_${stamp}`, name: `Bereavement ${stamp}`, payment: 'paid', yearlyEntitlementDays: 3, accrual: 'yearly_upfront', approvalSteps: 1 });
  await sql(
    `insert into config_entries (config_type, value, effective_from, version, locked_on_use) values ('hr.rw.leave_defaults', $1::jsonb, '2020-01-01T00:00:00+02:00', $2, false)`,
    [JSON.stringify(nextValue), latest.version + 1],
  );
  const diff = await get(owner, '/ops/leave/types/defaults');
  const annualChange = diff.body?.changed?.find((c) => c.code === 'annual' && c.field === 'yearlyEntitlementDays');
  check('a newer row in force: the owner sees the missing type and the changed entitlement', diff.status === 200 && diff.body?.missing?.some((m) => m.code === `bereave_${stamp}`) && annualChange?.defaults === annualDefault.yearlyEntitlementDays, diff.body);
  const accrualsBefore = await sql(`select count(*)::int as n, coalesce(sum(days), 0)::float as s from leave_ledger_entries where leave_type_id = $1 and kind = 'accrual'`, [annual?.id]);
  const applied = await post(owner, '/ops/leave/types/defaults/apply', { codes: ['annual', `bereave_${stamp}`] });
  const accrualsAfter = await sql(`select count(*)::int as n, coalesce(sum(days), 0)::float as s from leave_ledger_entries where leave_type_id = $1 and kind = 'accrual'`, [annual?.id]);
  check('applied: the type is added and the entitlement changes', applied.status === 200 && applied.body?.types?.some((t) => t.code === `bereave_${stamp}`) && applied.body?.types?.find((t) => t.code === 'annual')?.yearlyEntitlementDays === annualDefault.yearlyEntitlementDays, applied.body?.types?.map((t) => [t.code, t.yearlyEntitlementDays]));
  check('and no ledger row was rewritten', accrualsBefore[0].n === accrualsAfter[0].n && accrualsBefore[0].s === accrualsAfter[0].s, [accrualsBefore[0], accrualsAfter[0]]);
  const unknown = await post(owner, '/ops/leave/types/defaults/apply', { codes: ['nothing_like_it'] });
  check('a code the defaults do not have: 422', unknown.status === 422, unknown.status);
} else skip('the defaults diff and apply', 'no DATABASE_URL');

// --- A confirmed month stays as it was (AC-LV9a, index contract 17) -------------------------

console.log('\nA confirmed month (AC-LV9a)');
const lastMonthDay = weekdayFrom(addDays(lastMonth, 9));
const unpaidLast = await request(manager, cookF.id, unpaid?.id, lastMonthDay, lastMonthDay, { reason: 'Personal' });
const lastRun = await post(owner, '/ops/pay-runs', { period: lastMonth.slice(0, 7) });
let confirmed = lastRun.body?.run?.id ? await post(owner, `/ops/pay-runs/${lastRun.body.run.id}/confirm`, {}) : lastRun;
if (confirmed.status === 409 && Array.isArray(confirmed.body?.blockers)) {
  // Earlier rows of the sample may block it; the RSSB numbers the office can type.
  for (const b of confirmed.body.blockers.filter((x) => x.code === 'missing_rssb_number')) {
    await patch(owner, `/ops/employees/${b.employeeId}`, { rssbNumber: `RB${stamp.slice(-4)}${b.employeeId.slice(-4)}` });
  }
  confirmed = await post(owner, `/ops/pay-runs/${lastRun.body.run.id}/confirm`, {});
}
if (confirmed.status === 200) {
  const frozenDecision = await post(manager, `/ops/leave/requests/${unpaidLast.body?.id}/approve`, {});
  check('unpaid leave in a confirmed month: 409, it needs a pay adjustment', frozenDecision.status === 409 && /pay adjustment|confirmed/i.test(frozenDecision.body?.message ?? ''), frozenDecision.body);
} else {
  skip('unpaid leave in a confirmed month', `last month's run could not be confirmed here: ${JSON.stringify(confirmed.body?.blockers?.slice(0, 2) ?? confirmed.body?.message)}`);
}

if (DB) {
  const audit = await sql(`select count(*)::int as n from audit_events where event_type in ('hr.leave_step1_approved', 'hr.leave_allocation_approved', 'hr.restricted_period_created', 'hr.leave_type_created')`);
  check('decisions, periods and types are on the audit trail', audit[0].n >= 5, audit[0].n);
  await client?.end();
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
