#!/usr/bin/env node
// Verify the HR module's first thread end to end (ADR-058, slice 1).
//
// Drives the real API as the Amahoro demo roster: an owner puts a cook with no
// account on file, gives them a contract and a raise, a manager builds shifts
// and rosters them, the desk clocks them in and out, leave is requested,
// approved and refused, a month's pay run is created, blocked, fixed and
// confirmed, and a linked receptionist is offboarded and loses the workspace.
// Every step names the acceptance criterion it proves.
//
// It WRITES, and it is meant for a sample database you own, never the shared
// one. Everything it creates is new on each run (fresh ID numbers, fresh
// people), except the pay run: a business has one run per month, so run it
// against a freshly seeded sample database, or set VERIFY_HR_PERIOD to a month
// with no run yet.
//
// With DATABASE_URL set it also reads the database, to check audit rows and to
// prove pay fails closed without a PAYE rule. Without it those checks are
// skipped and say so.
//
//   VERIFY_API_URL=http://localhost:8011 DATABASE_URL=postgres://.../injishi_hr \
//     node scripts/verify-hr-thread.mjs
import pg from 'pg';

const API = process.env.VERIFY_API_URL || 'http://localhost:8000';
const OTP = process.env.VERIFY_OTP_CODE || '123456';
const DB = process.env.DATABASE_URL?.trim() || null;

const AMAHORO_ORG = 'de300000-0000-4000-8000-000000000101';
const BOUTIQUE = 'de300000-0000-4000-8000-000000000401';

let failures = 0;
function check(label, ok, detail) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : `   ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}

// --- Dates, in Kigali ---------------------------------------------------------

const kigaliToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date());
const addDays = (d, n) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const today = kigaliToday();
const period = process.env.VERIFY_HR_PERIOD || today.slice(0, 7);
const first = `${period}-01`;
const sixteenth = `${period}-16`;
const [py, pm] = period.split('-').map(Number);
const nextFirst = pm === 12 ? `${py + 1}-01-01` : `${py}-${String(pm + 1).padStart(2, '0')}-01`;
/** The first Monday on or after a date. */
function mondayFrom(d) {
  let x = d;
  while (new Date(`${x}T12:00:00Z`).getUTCDay() !== 1) x = addDays(x, 1);
  return x;
}
const leaveDay = mondayFrom(nextFirst);

// --- Sessions -----------------------------------------------------------------

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

async function call(s, method, path, body) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: {
      cookie: s.cookie,
      'x-workspace-id': s.workspaceId,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
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

const stamp = Date.now().toString().slice(-8);
const idNumber = (n) => `11990${stamp}${n}`.slice(0, 16);

console.log(`Verifying the HR first thread against ${API}, period ${period}, today ${today} (Kigali)\n`);

const owner = await sessionFor('yves@demo.injishi.com');
const manager = await sessionFor('solange@demo.injishi.com');
const desk = await sessionFor('denise@demo.injishi.com');
const limitedDesk = await sessionFor('clarisse@demo.injishi.com');
const housekeeper = await sessionFor('beatha@demo.injishi.com');
if (!owner.workspaceId || !manager.workspaceId || !desk.workspaceId) {
  throw new Error('The Amahoro roster did not resolve a workspace. Is this a seeded sample database?');
}

// --- Permissions (AC-U6) ---------------------------------------------------------

console.log('The seven HR permissions, as the grant resolves them (AC-U6)');
const HR = ['people.view', 'people.manage', 'roster.manage', 'attendance.record', 'attendance.approve', 'leave.approve', 'payroll.run'];
const held = (s) => HR.filter((p) => s.permissions.includes(p));
check('owner holds all seven', held(owner).length === 7, held(owner));
check('manager holds five, not people.manage or payroll.run', JSON.stringify(held(manager)) === JSON.stringify(['people.view', 'roster.manage', 'attendance.record', 'attendance.approve', 'leave.approve']), held(manager));
check('receptionist holds attendance.record only', JSON.stringify(held(desk)) === JSON.stringify(['attendance.record']), held(desk));
check('housekeeper holds none', held(housekeeper).length === 0, held(housekeeper));

// --- Files (AC-P1 to AC-P3) --------------------------------------------------------

console.log('\nA cook with no account is put on file (AC-P1)');
const cookBody = {
  legalName: `Mugenzi Jean Verify ${stamp}`,
  phone: '0788 555 123',
  dateOfBirth: '1992-04-11',
  sex: 'male',
  idDocumentType: 'national_id',
  idDocumentNumber: idNumber(1),
  hiredOn: first,
  workPropertyId: BOUTIQUE,
};
const cookRes = await post(owner, '/ops/employees', cookBody);
check('owner creates the file: 201', cookRes.status === 201, cookRes);
const cook = cookRes.body;
check('listed active, full view, no account', cook?.status === 'active' && cook?.view === 'full' && cook?.hasAccount === false, cook);
check('an employee number was minted, at least four digits', /^\d{4,}$/.test(cook?.employeeNumber ?? ''), cook?.employeeNumber);
check('the phone was normalised to E.164', cook?.phone === '+250788555123', cook?.phone);
check('nothing statutory is missing', Array.isArray(cook?.detailsMissing) && cook.detailsMissing.length === 0, cook?.detailsMissing);

const managerCreate = await post(manager, '/ops/employees', { ...cookBody, idDocumentNumber: idNumber(9) });
check('a manager cannot create a file without people.manage: 403', managerCreate.status === 403, managerCreate.status);

console.log('\nOne file per ID per business (AC-P3)');
const dup = await post(owner, '/ops/employees', { ...cookBody, legalName: 'Someone Else' });
check('the same ID again: 409 naming the existing number', dup.status === 409 && String(dup.body?.message).includes(cook?.employeeNumber), dup.body);

console.log('\nWho reads which fields (AC-P2)');
const asManager = await get(manager, `/ops/employees/${cook?.id}`);
const mFile = asManager.body?.employee;
check('manager reads the file: 200, basic view', asManager.status === 200 && mFile?.view === 'basic', asManager.status);
check('basic view carries no date of birth, ID number or RSSB number', mFile && !('dateOfBirth' in mFile) && !('idDocumentNumber' in mFile) && !('rssbNumber' in mFile), Object.keys(mFile ?? {}));
const asOwner = await get(owner, `/ops/employees/${cook?.id}`);
check('owner reads the same route in full, with the ID', asOwner.body?.employee?.view === 'full' && asOwner.body?.employee?.idDocumentNumber === cookBody.idDocumentNumber, asOwner.body?.employee?.view);
const deskList = await get(desk, '/ops/employees');
check('the desk cannot read files: 403', deskList.status === 403, deskList.status);
const managerList = await get(manager, '/ops/employees?limit=200');
check('manager list is basic too', managerList.status === 200 && managerList.body.items.every((e) => e.view === 'basic' && !('idDocumentNumber' in e)), managerList.status);
check('backfilled files read detailsMissing', managerList.body?.items?.some((e) => e.hasAccount && e.detailsMissing.length > 0), '');

// --- Contracts (AC-P4) -------------------------------------------------------------

console.log('\nContracts (AC-P4)');
const fixedNoEnd = await post(owner, `/ops/employees/${cook?.id}/contracts`, { contractType: 'fixed_term', startsOn: first, wageBasis: 'monthly', wageRwf: 180000 });
check('a fixed term contract without an end: 422', fixedNoEnd.status === 422, fixedNoEnd.body);
const daily = await post(owner, `/ops/employees/${cook?.id}/contracts`, { contractType: 'casual', startsOn: first, wageBasis: 'daily', wageRwf: 5000 });
check('a daily wage is refused in the first thread: 422', daily.status === 422, daily.status);
const c1 = await post(owner, `/ops/employees/${cook?.id}/contracts`, { contractType: 'permanent', startsOn: first, wageBasis: 'monthly', wageRwf: 180000 });
check('a monthly contract from the first: 201, active', c1.status === 201 && c1.body?.contract?.status === 'active', c1.body);
const early = await post(owner, `/ops/employees/${cook?.id}/contracts`, { contractType: 'permanent', startsOn: first, wageBasis: 'monthly', wageRwf: 190000 });
check('a new contract must start after the current one: 422', early.status === 422, early.status);
const c2 = await post(owner, `/ops/employees/${cook?.id}/contracts`, { contractType: 'permanent', startsOn: sixteenth, wageBasis: 'monthly', wageRwf: 210000 });
check('a raise on the 16th: 201, and the old one now ends on the 15th', c2.status === 201 && c2.body?.shortened?.endsOn === `${period}-15`, c2.body?.shortened);
const managerContract = await get(manager, `/ops/employees/${cook?.id}`);
check('the manager sees contracts without a wage', managerContract.body?.contracts?.every((c) => !('wageRwf' in c)), managerContract.body?.contracts);
const solangeFile = (await get(owner, '/ops/employees?limit=200')).body.items.find((e) => e.legalName === 'Solange Uwera');
const noDetails = await post(owner, `/ops/employees/${solangeFile?.id}/contracts`, { contractType: 'permanent', startsOn: first, wageBasis: 'monthly', wageRwf: 300000 });
check('no contract for a file missing its date of birth, sex or ID: 422 naming them', noDetails.status === 422 && /date of birth/.test(noDetails.body?.message ?? ''), noDetails.body);

// --- Shifts and roster (AC-T1, AC-T2, AC-T6) --------------------------------------------

console.log('\nShift templates and the roster (AC-T1, AC-T2)');
const morning = await post(manager, '/ops/shift-templates', { propertyId: BOUTIQUE, name: `Morning ${stamp}`, startsAt: '07:00', endsAt: '15:00', breakMinutes: 30 });
check('manager creates a morning shift: 201', morning.status === 201, morning.body);
const night = await post(manager, '/ops/shift-templates', { propertyId: BOUTIQUE, name: `Night ${stamp}`, startsAt: '22:00', endsAt: '06:00' });
check('a night shift crosses midnight', night.status === 201 && night.body?.crossesMidnight === true, night.body);
const rosterDay = addDays(today, 3);
const r1 = await post(manager, '/ops/roster', { employeeId: cook?.id, shiftTemplateId: night.body?.id, workDate: rosterDay });
check('rostered on a night shift: 201', r1.status === 201, r1.body);
const startsUtc = new Date(`${rosterDay}T22:00:00+02:00`).toISOString();
check('its instants are Kigali wall clock, ending the next day', r1.body?.startsAt === startsUtc && r1.body?.endsAt === new Date(`${addDays(rosterDay, 1)}T06:00:00+02:00`).toISOString(), [r1.body?.startsAt, r1.body?.endsAt]);
check('a roster entry carries a roster card, nothing more', r1.body && Object.keys(r1.body.employee).sort().join() === 'displayName,employeeId,jobPositionTitle', r1.body?.employee);
const overlap = await post(manager, '/ops/roster', { employeeId: cook?.id, shiftTemplateId: night.body?.id, workDate: rosterDay });
check('the same shift again overlaps: 409', overlap.status === 409, overlap.status);
// A Wednesday, clear of the leave day (a Monday) and the night shift above.
const raceDay = addDays(leaveDay, 2);
const race = await Promise.all([1, 2, 3].map(() => post(manager, '/ops/roster', { employeeId: cook?.id, shiftTemplateId: morning.body?.id, workDate: raceDay })));
check('three racing roster writes: exactly one wins (the database refuses the rest)', race.filter((r) => r.status === 201).length === 1 && race.filter((r) => r.status === 409).length === 2, race.map((r) => r.status));
const limitedRoster = await get(limitedDesk, `/ops/roster?from=${rosterDay}&to=${rosterDay}`);
check('a desk limited to Musanze does not see the Boutique roster (AC-T6)', limitedRoster.status === 200 && limitedRoster.body.entries.every((e) => e.propertyId !== BOUTIQUE), limitedRoster.status);

// --- Attendance (AC-T4, AC-T6) -------------------------------------------------------

console.log('\nAttendance (AC-T4, AC-T6)');
const clockIn = await post(desk, '/ops/attendance/clock-in', { employeeId: cook?.id });
check('the desk clocks the cook in: 201, validated', clockIn.status === 201 && clockIn.body?.validated === true && clockIn.body?.status === 'open', clockIn.body);
check('the record is dated in Kigali', clockIn.body?.workDate === today, clockIn.body?.workDate);
const again = await post(desk, '/ops/attendance/clock-in', { employeeId: cook?.id });
check('a second clock in: 409 carrying the open record', again.status === 409 && again.body?.record?.id === clockIn.body?.id, again.body);
const limitedClock = await post(limitedDesk, '/ops/attendance/clock-in', { employeeId: cook?.id });
check('a desk limited to Musanze cannot clock a Boutique cook: 403', limitedClock.status === 403, limitedClock.status);
const tooOld = await post(owner, '/ops/attendance/clock-in', { employeeId: cook?.id, at: new Date(Date.now() - 8 * 86400000).toISOString() });
check('a clock time more than 7 days back: 422 (or 409 while one is open)', [409, 422].includes(tooOld.status), tooOld.status);
const outEarly = await post(desk, `/ops/attendance/${clockIn.body?.id}/clock-out`, { at: new Date(Date.parse(clockIn.body?.clockInAt) - 60000).toISOString() });
check('a clock out before the clock in: 422', outEarly.status === 422, outEarly.status);
const clockOut = await post(desk, `/ops/attendance/${clockIn.body?.id}/clock-out`, {});
check('clock out: 200, closed', clockOut.status === 200 && clockOut.body?.status === 'closed', clockOut.body);
const sheet = await get(desk, `/ops/attendance?date=${today}`);
check('the desk reads the day sheet as roster cards', sheet.status === 200 && sheet.body.records.some((r) => r.id === clockIn.body?.id), sheet.status);

// --- Leave (AC-L1, AC-L4, AC-L5, AC-T3) ------------------------------------------------

console.log('\nLeave (AC-L1, AC-L4, AC-L5, AC-T3)');
const balances = await get(manager, `/ops/employees/${cook?.id}/leave-balances`);
const annual = balances.body?.balances?.find((b) => b.leaveType.code === 'annual');
check('the first HR read made the leave types from the defaults row (AC-L1)', balances.status === 200 && !!annual, balances.body);
const balanceBefore = annual?.balanceDays ?? 0;
check('the cook has accrued this month (AC-L2)', balanceBefore > 0, balanceBefore);
const rosterLeaveDay = await post(manager, '/ops/roster', { employeeId: cook?.id, shiftTemplateId: morning.body?.id, workDate: leaveDay });
check('rostered on the leave day, before any leave', rosterLeaveDay.status === 201, rosterLeaveDay.status);
const req = await post(manager, '/ops/leave/requests', { employeeId: cook?.id, leaveTypeId: annual?.leaveType?.id, startsOn: leaveDay, endsOn: leaveDay, reason: 'Family' });
check('manager files one day of annual leave: 201, 1 day estimated', req.status === 201 && req.body?.days === 1 && req.body?.status === 'requested', req.body);
const tooMuch = await post(manager, '/ops/leave/requests', { employeeId: cook?.id, leaveTypeId: annual?.leaveType?.id, startsOn: addDays(leaveDay, 7), endsOn: addDays(leaveDay, 11) });
check('more than the balance: 409 stating it', tooMuch.status === 409 && /left/.test(tooMuch.body?.message ?? ''), tooMuch.body);
const approvals = await Promise.all([post(owner, `/ops/leave/requests/${req.body?.id}/approve`, {}), post(manager, `/ops/leave/requests/${req.body?.id}/approve`, {})]);
check('two racing approvals: one wins, one 409', approvals.filter((r) => r.status === 200).length === 1 && approvals.filter((r) => r.status === 409).length === 1, approvals.map((r) => r.status));
const after = await get(manager, `/ops/employees/${cook?.id}/leave-balances`);
const annualAfter = after.body?.balances?.find((b) => b.leaveType.code === 'annual');
check('the balance is the ledger: one day less, one taken row', Math.abs((annualAfter?.balanceDays ?? 0) - (balanceBefore - 1)) < 0.01 && annualAfter.entries.filter((e) => e.kind === 'taken').length === 1, annualAfter);
const rosterAfter = await get(manager, `/ops/roster?from=${leaveDay}&to=${leaveDay}`);
const leaveShift = rosterAfter.body?.entries?.find((e) => e.id === rosterLeaveDay.body?.id);
check('approving cancelled the shift in the range (AC-T3)', leaveShift?.status === 'cancelled', leaveShift);
const clash = await post(manager, '/ops/roster', { employeeId: cook?.id, shiftTemplateId: morning.body?.id, workDate: leaveDay });
check('rostering on approved leave: 409 naming it', clash.status === 409 && /leave/i.test(clash.body?.message ?? ''), clash.body);

const unpaidType = after.body?.balances?.find((b) => b.leaveType.code === 'unpaid')?.leaveType;
const ownLeave = await post(owner, '/ops/leave/requests', { employeeId: solangeFile?.id, leaveTypeId: unpaidType?.id, startsOn: addDays(leaveDay, 1), endsOn: addDays(leaveDay, 1) });
check('the owner files unpaid leave for the manager: 201', ownLeave.status === 201, ownLeave.body);
const selfApprove = await post(manager, `/ops/leave/requests/${ownLeave.body?.id}/approve`, {});
check('nobody decides their own leave: 403', selfApprove.status === 403, selfApprove.body);
const cancelOwn = await post(owner, `/ops/leave/requests/${ownLeave.body?.id}/cancel`, {});
check('the owner cancels it instead: 200', cancelOwn.status === 200 && cancelOwn.body?.status === 'cancelled', cancelOwn.status);
const deskQueue = await get(desk, '/ops/leave/requests');
check('the desk has no leave queue: 403', deskQueue.status === 403, deskQueue.status);

// --- Hire date lock (AC-P6) ---------------------------------------------------------

console.log('\nThe hire date is history once leave is earned (AC-P6)');
const moveHire = await patch(owner, `/ops/employees/${cook?.id}`, { hiredOn: addDays(first, 1) });
check('editing hiredOn after an accrual: 409', moveHire.status === 409, moveHire.status);

// --- A second cook who leaves before the month is paid (AC-O1 attendance) ---------------

console.log('\nA leaver cannot be clocked in after their last day (AC-O1)');
const cook2 = (await post(owner, '/ops/employees', { ...cookBody, legalName: `Uwase Aline Verify ${stamp}`, sex: 'female', idDocumentNumber: idNumber(2), rssbNumber: `RS${stamp}2` })).body;
await post(owner, `/ops/employees/${cook2?.id}/contracts`, { contractType: 'permanent', startsOn: first, wageBasis: 'monthly', wageRwf: 150000 });
const yesterday = addDays(today, -1);
const off2 = await post(owner, `/ops/employees/${cook2?.id}/offboard`, { lastDay: yesterday < first ? first : yesterday, reason: 'End of season' });
check('a manager-free file is offboarded by the owner: 200', off2.status === 200 && off2.body?.status === 'offboarded', off2.body);
if (yesterday >= first) {
  const lateClock = await post(desk, '/ops/attendance/clock-in', { employeeId: cook2?.id });
  check('clocking them in today, after their last day: 422', lateClock.status === 422, lateClock.status);
}

// --- Pay (AC-Y1 to AC-Y4) ------------------------------------------------------------

console.log(`\nThe ${period} pay run (AC-Y1 to AC-Y4)`);
const managerPay = await get(manager, '/ops/pay-runs');
check('a manager cannot see pay: 403', managerPay.status === 403, managerPay.status);
if (DB) {
  const client = new pg.Client({ connectionString: DB });
  await client.connect();
  const { rows } = await client.query(`select id, effective_to from config_entries where config_type = 'hr.rw.paye'`);
  await client.query(`update config_entries set effective_to = '2000-01-01' where config_type = 'hr.rw.paye'`);
  const closed = await post(owner, '/ops/pay-runs', { period });
  check('with no PAYE rule in force: 409 naming it (AC-Y2)', closed.status === 409 && String(closed.body?.message).includes('hr.rw.paye'), closed.body);
  for (const r of rows) await client.query('update config_entries set effective_to = $2 where id = $1', [r.id, r.effective_to]);
  await client.end();
} else {
  console.log('  SKIP  fails closed without PAYE (set DATABASE_URL to run it)');
}
const run = await post(owner, '/ops/pay-runs', { period });
check('owner creates the draft run: 201', run.status === 201 && run.body?.run?.status === 'draft', run.body?.message ?? run.status);
const slip = run.body?.payslips?.find((p) => p.employeeId === cook?.id);
check('the cook has one payslip with two wage line groups (the raise on the 16th)', slip?.lines?.filter((l) => l.code === 'wage').length === 2, slip?.lines);
const wage = slip?.lines?.filter((l) => l.code === 'wage').reduce((s, l) => s + l.amountRwf, 0);
// Index contract 9, restated here rather than imported: 30, less the days of
// the month before a start, less the days after an end. In a 31 day month the
// two halves of a raise on the 16th are 14/30 and 15/30; in a 30 day month,
// 15/30 each.
const monthDays = new Date(Date.UTC(py, pm, 0)).getUTCDate();
const firstHalf = 30 - (monthDays - 15);
const expectedGross = Math.round((180000 * firstHalf) / 30) + Math.round((210000 * 15) / 30);
check(`${firstHalf}/30 of 180,000 plus 15/30 of 210,000 is gross ${expectedGross}`, slip?.grossRwf === expectedGross && wage === expectedGross, slip?.grossRwf);
const sumSide = (side, pred = () => true) => slip.lines.filter((l) => l.side === side && pred(l)).reduce((s, l) => s + l.amountRwf, 0);
check('net is gross less PAYE and employee contributions (AC-Y4)', slip && slip.netRwf === slip.grossRwf - slip.payeRwf - slip.employeeContributionsRwf - slip.otherDeductionsRwf, slip);
check('each amount column equals the sum of its lines (AC-Y4)', slip && slip.payeRwf === sumSide('employee', (l) => l.code === 'paye') && slip.employeeContributionsRwf === sumSide('employee', (l) => l.code !== 'paye') && slip.employerContributionsRwf === sumSide('employer'), slip);
check('the leaver is covered too, whatever the file says (AC-Y1)', run.body?.payslips?.some((p) => p.employeeId === cook2?.id), '');
check('the run records the rule rows it used (AC-Y2)', run.body?.run?.ruleVersions?.length === 2, run.body?.run?.ruleVersions);
const blocked = await post(owner, `/ops/pay-runs/${run.body?.run?.id}/confirm`, {});
check('confirm is refused, listing the cook missing an RSSB number (AC-Y3)', blocked.status === 409 && blocked.body?.blockers?.some((b) => b.employeeId === cook?.id && b.code === 'missing_rssb_number'), blocked.body);
const fix = await patch(owner, `/ops/employees/${cook?.id}`, { rssbNumber: `RS${stamp}1` });
check('owner adds the RSSB number: 200', fix.status === 200, fix.status);
const others = blocked.body?.blockers?.filter((b) => b.employeeId !== cook?.id) ?? [];
if (others.length > 0) console.log(`  NOTE  ${others.length} other blocker(s) from earlier rows in this database; confirm may stay refused`);
const confirmed = await post(owner, `/ops/pay-runs/${run.body?.run?.id}/confirm`, {});
check('confirm: 200, confirmed', confirmed.status === 200 && confirmed.body?.run?.status === 'confirmed', confirmed.body?.message ?? confirmed.status);
const twice = await post(owner, `/ops/pay-runs/${run.body?.run?.id}/confirm`, {});
check('a second confirm answers 200 with the same run', twice.status === 200 && twice.body?.run?.confirmedAt === confirmed.body?.run?.confirmedAt, twice.status);
const recompute = await post(owner, `/ops/pay-runs/${run.body?.run?.id}/recompute`, {});
check('a confirmed run cannot be recomputed: 409', recompute.status === 409, recompute.status);
const listed = (await get(owner, '/ops/pay-runs')).body?.runs?.find((r) => r.id === run.body?.run?.id);
const slips = confirmed.body?.payslips ?? [];
check(
  'the run list totals its payslips (headcount, gross, net)',
  listed?.headcount === slips.length &&
    listed?.grossRwf === slips.reduce((s, p) => s + p.grossRwf, 0) &&
    listed?.netRwf === slips.reduce((s, p) => s + p.netRwf, 0),
  listed,
);

// --- Offboarding a linked receptionist (AC-O1, AC-O2) -----------------------------------

console.log('\nOffboarding a receptionist with an account (AC-O1, AC-O2)');
const denise = (await get(owner, '/ops/employees?limit=200')).body.items.find((e) => e.legalName === 'Denise Iribagiza');
const inFrozen = await post(owner, `/ops/employees/${denise?.id}/offboard`, { lastDay: today, reason: 'Dismissed' });
check('a last day inside a confirmed month: 409', inFrozen.status === 409, inFrozen.body);
const before = await get(desk, '/ops/rooms');
check('before: the receptionist reads rooms', before.status === 200, before.status);
const off = await post(owner, `/ops/employees/${denise?.id}/offboard`, { lastDay: nextFirst, reason: 'Dismissed' });
check('owner offboards her: 200, offboarded, no account any more', off.status === 200 && off.body?.status === 'offboarded' && off.body?.hasAccount === false, off.body);
const afterRooms = await get(desk, '/ops/rooms');
check('her next ops request: 403', afterRooms.status === 403, afterRooms.status);
const again2 = await post(owner, `/ops/employees/${denise?.id}/offboard`, { lastDay: nextFirst, reason: 'Again' });
check('offboarding twice: 409', again2.status === 409, again2.status);

// --- Audit (AC-U5) --------------------------------------------------------------------

if (DB) {
  console.log('\nAudit rows (AC-U5)');
  const client = new pg.Client({ connectionString: DB });
  await client.connect();
  const { rows } = await client.query(
    `select event_type, subject_type, payload_diff::text as diff from audit_events
     where subject_id = $1 order by occurred_at`,
    [cook?.id],
  );
  check('every action on the cook wrote a row against the file', rows.length >= 8 && rows.every((r) => r.subject_type === 'employee'), rows.map((r) => r.event_type));
  check('no audit row carries the ID number or a wage', rows.every((r) => !r.diff.includes(cookBody.idDocumentNumber) && !r.diff.includes('180000') && !r.diff.includes('210000')), '');
  const runRows = await client.query(`select event_type from audit_events where subject_type = 'pay_run' and subject_id = $1`, [run.body?.run?.id]);
  check('the pay run wrote its own rows (created, confirmed)', runRows.rows.map((r) => r.event_type).join() === 'hr.pay_run_created,hr.pay_run_confirmed', runRows.rows);
  await client.end();
} else {
  console.log('\n  SKIP  audit rows (set DATABASE_URL to read them)');
}

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
