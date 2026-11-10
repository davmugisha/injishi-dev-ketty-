#!/usr/bin/env node
// Verify time end to end (ADR-058 slice 4, 058-time and the self service
// routes marked 4 in 058-self-service).
//
// Drives the real API as the Amahoro demo roster: the owner sets the
// attendance policy, a branch's geofence, a business holiday and a weekly day
// off; the manager drafts next week's roster and publishes it, rotates two
// cooks morning and night every two days, and decides shift, swap and
// attendance requests; the desk files requests, pairs a kiosk and sets PINs;
// staff with accounts clock in by phone and ask for changes through
// `/me/work`; the sweep closes what was left open; and the insights answer
// only their three readers. Every check names the acceptance criterion it
// proves.
//
// It WRITES, and it is meant for a FRESHLY SEEDED sample database you own,
// never the shared one. The cooks it creates are new on each run, but it also
// gives the demo personas' files a branch, a manager, shifts next week, a PIN
// and a contract, and a second run on the same database meets the first run's
// shifts and PIN. Reseed between runs. Pairing is limited to 10 tries in 10
// minutes per address, and a run pairs four times, so wait between runs too.
//
// With DATABASE_URL set it also reads the database (audit rows, the outbox)
// and runs the sweep and the daily job through `run-hr-daily.mjs`, which needs
// an API build: `dist/`, or API_DIST_DIR. Without DATABASE_URL those checks
// are skipped and say so.
//
//   VERIFY_API_URL=http://localhost:8014 DATABASE_URL=postgres://.../injishi_hr \
//     API_DIST_DIR=dist-worker node scripts/verify-hr-time.mjs
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
const MUSANZE = 'de300000-0000-4000-8000-000000000404';
/** Kigali: where the Boutique's geofence is centred for this run. */
const CENTRE = { lat: -1.944, lng: 30.0619 };

let failures = 0;
function check(label, ok, detail) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : `   ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}
function skip(label, why) {
  console.log(`  SKIP  ${label}   (${why})`);
}

const kigaliToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date());
const addDays = (d, n) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const mondayOf = (d) => {
  const x = new Date(`${d}T12:00:00Z`);
  return addDays(d, -((x.getUTCDay() + 6) % 7));
};
/** A Kigali wall clock time as an instant: Kigali is UTC+2 all year. */
const kigali = (date, hhmm) => new Date(`${date}T${hhmm}:00+02:00`).toISOString();
const today = kigaliToday();
const yesterday = addDays(today, -1);
const twoDaysAgo = addDays(today, -2);
const nextMonday = mondayOf(addDays(today, 7));
const month = today.slice(0, 7);
const firstOfMonth = `${month}-01`;
const lastOfMonth = (() => {
  const x = new Date(`${firstOfMonth}T12:00:00Z`);
  x.setUTCMonth(x.getUTCMonth() + 1, 0);
  return x.toISOString().slice(0, 10);
})();

// --- Sessions and calls ---------------------------------------------------------

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
  return { status: res.status, body: json, headers: res.headers };
}
const get = (s, p) => call(s, 'GET', p);
const post = (s, p, b = {}) => call(s, 'POST', p, b);
const put = (s, p, b) => call(s, 'PUT', p, b);
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
const idNumber = (n) => `11986${stamp}${n}`.slice(0, 16);

console.log(`Verifying time against ${API}, today ${today} (Kigali), next week from ${nextMonday}\n`);

const owner = await sessionFor('yves@demo.injishi.com');
const manager = await sessionFor('solange@demo.injishi.com');
const desk = await sessionFor('denise@demo.injishi.com');
const limited = await sessionFor('clarisse@demo.injishi.com');
const housekeeper = await sessionFor('beatha@demo.injishi.com');
if (!owner.workspaceId || !manager.workspaceId || !desk.workspaceId) {
  throw new Error('The Amahoro roster did not resolve a workspace. Is this a seeded sample database?');
}

// --- The people of this run ---------------------------------------------------------

const cookBody = (n, name, branch) => ({
  legalName: `${name} Time ${stamp}`,
  phone: `0788 7${stamp.slice(-2)} 2${n}0`.replace(/ /g, ''),
  dateOfBirth: `1991-03-0${n}`,
  sex: n % 2 ? 'female' : 'male',
  idDocumentType: 'national_id',
  idDocumentNumber: idNumber(n),
  hiredOn: addDays(today, -90),
  workPropertyId: branch,
});
const cookA = (await post(owner, '/ops/employees', cookBody(1, 'Uwimana Alice', BOUTIQUE))).body;
const cookB = (await post(owner, '/ops/employees', cookBody(2, 'Nkurunziza Bosco', BOUTIQUE))).body;
const cookC = (await post(owner, '/ops/employees', cookBody(3, 'Ingabire Chantal', BOUTIQUE))).body;
const cookM = (await post(owner, '/ops/employees', cookBody(4, 'Mugisha Moses', MUSANZE))).body;
if (![cookA, cookB, cookC, cookM].every((c) => c?.id)) throw new Error('Could not create the cooks of this run.');

// The personas with accounts: their own files, through self service.
const filesOf = async (s) => (await get(self(s), '/me/work')).body?.files ?? [];
const amahoroFile = async (s) => (await filesOf(s)).find((f) => f.orgId === AMAHORO_ORG);
const deskFile = await amahoroFile(desk);
const managerFile = await amahoroFile(manager);
const keeperFile = await amahoroFile(housekeeper);
const limitedFile = await amahoroFile(limited);

console.log('Self service files (AC-SS1)');
check('the desk lists its own file through /me/work, with the business and status', !!deskFile && deskFile.businessName.length > 0 && deskFile.status === 'active', deskFile);
const ownerFiles = await filesOf(owner);
check('the owner holds no staff file, so lists none', ownerFiles.filter((f) => f.orgId === AMAHORO_ORG).length === 0, ownerFiles);
const probe = await get(self(desk), `/me/work/${cookA.id}/roster?from=${today}&to=${today}`);
check('another file\'s id under /me/work: 404', probe.status === 404, probe.status);
if (!deskFile || !managerFile || !keeperFile) throw new Error('The demo personas have no Amahoro files. Is this a seeded sample database?');

// Denise, Beatha and Solange work at the Boutique; Denise reports to Solange.
await patch(owner, `/ops/employees/${managerFile.employeeId}`, { workPropertyId: BOUTIQUE });
await patch(owner, `/ops/employees/${deskFile.employeeId}`, { workPropertyId: BOUTIQUE, reportingManagerId: managerFile.employeeId });
await patch(owner, `/ops/employees/${keeperFile.employeeId}`, { workPropertyId: BOUTIQUE });
check('Solange now has a direct report, so her file says so', (await amahoroFile(manager))?.hasReports === true, await amahoroFile(manager));

// --- Shift templates with a minimum and an automatic clock out (AC-TM4) -----------------------

console.log('\nShift templates (AC-TM4)');
const tpl = async (name, startsAt, endsAt, extra = {}) =>
  post(manager, '/ops/shift-templates', { propertyId: BOUTIQUE, name: `${name} ${stamp}`, startsAt, endsAt, breakMinutes: 30, ...extra });
const morningRes = await tpl('Morning', '06:00', '14:00', { autoClockOutMinutes: 30 });
const morning = morningRes.body;
const night = (await tpl('Night', '22:00', '06:00')).body;
const evening = (await tpl('Evening', '14:00', '22:00')).body;
const short = (await tpl('Short', '08:00', '10:00', { breakMinutes: 0, autoClockOutMinutes: 0 })).body;
const musanze = (await post(manager, '/ops/shift-templates', { propertyId: MUSANZE, name: `Musanze ${stamp}`, startsAt: '06:00', endsAt: '14:00' })).body;
check('a template carries its automatic clock out', morningRes.status === 201 && morning?.autoClockOutMinutes === 30 && morning?.minWorkMinutes === null, morningRes);
check('the night template crosses midnight', night?.crossesMidnight === true, night);
const badMinutes = await tpl('Bad', '06:00', '14:00', { autoClockOutMinutes: -5 });
check('a negative automatic clock out: 400', badMinutes.status === 400, badMinutes.status);

// --- The attendance policy and the geofence (AC-TM4, AC-TM7 to AC-TM9) ------------------------

console.log('\nThe attendance policy and the geofence');
const before = await get(desk, '/ops/attendance/policies');
check('the desk reads the settings: 200', before.status === 200, before.status);
const defaultPolicy = before.body?.policies?.find((p) => p.propertyId === null);
check('an unsaved business default reads the built in values', !!defaultPolicy && typeof defaultPolicy.saved === 'boolean' && defaultPolicy.linkWindowMinutes >= 0, defaultPolicy);
const policy = {
  propertyId: null,
  graceInMinutes: 5,
  graceOutMinutes: 5,
  overtimeCutoffMinutes: 240,
  overtimeAutoApprove: false,
  overtimeMinMinutes: 30,
  linkWindowMinutes: 180,
  staleOpenHours: 16,
  defaultShiftMinutes: 480,
};
const putPolicy = await put(owner, '/ops/attendance/policies', policy);
const savedDefault = putPolicy.body?.policies?.find((p) => p.propertyId === null);
check('the owner saves the business default: 200, saved', putPolicy.status === 200 && savedDefault?.saved === true && savedDefault?.graceInMinutes === 5, putPolicy);
const deskPolicy = await put(desk, '/ops/attendance/policies', policy);
check('the desk cannot change the policy: 403', deskPolicy.status === 403, deskPolicy.status);
const badPolicy = await put(owner, '/ops/attendance/policies', { ...policy, staleOpenHours: 0 });
check('a stale limit of 0 hours: 400', badPolicy.status === 400, badPolicy.status);
const fence = await put(manager, `/ops/attendance/clock-settings/${BOUTIQUE}`, { geofenceRadiusM: 150, centre: CENTRE });
const boutiqueFence = fence.body?.clock?.find((c) => c.propertyId === BOUTIQUE);
check('the manager centres the Boutique\'s geofence: 200', fence.status === 200 && boutiqueFence?.hasCoordinates === true && boutiqueFence?.centre?.lat === CENTRE.lat, boutiqueFence);
const tinyFence = await put(manager, `/ops/attendance/clock-settings/${BOUTIQUE}`, { geofenceRadiusM: 10 });
check('a radius under 25 m: 400', tinyFence.status === 400, tinyFence.status);
const limitedFence = await put(limited, `/ops/attendance/clock-settings/${BOUTIQUE}`, { geofenceRadiusM: 150 });
check('a receptionist cannot set a geofence: 403', limitedFence.status === 403, limitedFence.status);

// --- Holidays and weekly days off (AC-TM12) -----------------------------------------------

console.log('\nHolidays and weekly days off (AC-TM12)');
const holidayDay = addDays(nextMonday, 2);
const holiday = await post(owner, '/ops/hr/holidays', { name: `Staff day ${stamp}`, fromDate: holidayDay, toDate: holidayDay });
check('the owner adds a business holiday: 201', holiday.status === 201 && holiday.body?.propertyId === null, holiday);
const backwards = await post(owner, '/ops/hr/holidays', { name: 'Backwards', fromDate: holidayDay, toDate: addDays(holidayDay, -1) });
check('a holiday that ends before it starts: 400', backwards.status === 400, backwards.status);
const renamed = await patch(manager, `/ops/hr/holidays/${holiday.body?.id}`, { name: `Staff day out ${stamp}` });
check('the manager (roster.manage) renames it: 200', renamed.status === 200 && renamed.body?.name.startsWith('Staff day out'), renamed);
const weeklyOff = await post(manager, '/ops/hr/weekly-offs', { propertyId: BOUTIQUE, weekday: 0 });
check('the Boutique closes on Sundays: 201, every week', weeklyOff.status === 201 && weeklyOff.body?.weeks?.length === 0, weeklyOff);
const dupOff = await post(manager, '/ops/hr/weekly-offs', { propertyId: BOUTIQUE, weekday: 0, weeks: [1] });
check('Sunday again at the same branch: 409', dupOff.status === 409, dupOff.status);
const allWeeks = await patch(manager, `/ops/hr/weekly-offs/${weeklyOff.body?.id}`, { weeks: [1, 2, 3, 4, 5] });
check('all five weeks is stored as every week', allWeeks.status === 200 && allWeeks.body?.weeks?.length === 0, allWeeks);
const deskHolidays = await get(desk, '/ops/hr/holidays');
check('the desk does not read the holidays: 403', deskHolidays.status === 403, deskHolidays.status);
const holidays = await get(manager, '/ops/hr/holidays');
check('the manager reads them: 200', holidays.status === 200 && holidays.body?.holidays?.some((h) => h.id === holiday.body?.id), holidays.status);
const tmpOff = await post(owner, '/ops/hr/weekly-offs', { propertyId: BOUTIQUE, weekday: 6, weeks: [2, 4] });
const removed = await del(owner, `/ops/hr/weekly-offs/${tmpOff.body?.id}`);
check('a weekly day off added by mistake is removed: 204', tmpOff.status === 201 && removed.status === 204, [tmpOff.status, removed.status]);

// --- Drafts and publishing (AC-TM1, AC-TM2) --------------------------------------------------

console.log('\nDrafting next week and publishing it (AC-TM1, AC-TM2)');
const roster = (s, employeeId, shiftTemplateId, workDate) => post(s, '/ops/roster', { employeeId, shiftTemplateId, workDate });
const draft1 = await roster(manager, cookA.id, morning.id, nextMonday);
const draft2 = await roster(manager, cookA.id, morning.id, addDays(nextMonday, 1));
const draft3 = await roster(manager, deskFile.employeeId, night.id, addDays(nextMonday, 3));
const draft4 = await roster(manager, keeperFile.employeeId, morning.id, addDays(nextMonday, 3));
check('new shifts in an unpublished week are drafts', [draft1, draft2, draft3, draft4].every((d) => d.status === 201 && d.body?.publishedAt === null), [draft1, draft2, draft3, draft4].map((d) => [d.status, d.body?.publishedAt]));
const weekManager = await get(manager, `/ops/roster/week?propertyId=${BOUTIQUE}&from=${addDays(nextMonday, 2)}`);
check('the week grid runs Monday to Sunday from any day in it', weekManager.status === 200 && weekManager.body?.from === nextMonday && weekManager.body?.to === addDays(nextMonday, 6), weekManager.body && [weekManager.body.from, weekManager.body.to]);
check('the manager sees the drafts on the grid', weekManager.body?.entries?.filter((e) => e.publishedAt === null).length >= 4, weekManager.body?.entries?.length);
const weekDesk = await get(desk, `/ops/roster/week?propertyId=${BOUTIQUE}&from=${nextMonday}`);
check('the desk sees no drafts (AC-TM1)', weekDesk.status === 200 && weekDesk.body?.entries?.every((e) => e.publishedAt !== null), weekDesk.body?.entries?.length);
const selfBefore = await get(self(desk), `/me/work/${deskFile.employeeId}/roster?from=${nextMonday}&to=${addDays(nextMonday, 6)}`);
check('self service shows no draft (AC-TM2)', selfBefore.status === 200 && selfBefore.body?.entries?.length === 0, selfBefore.body);
const deskPublish = await post(desk, '/ops/roster/publish', { propertyId: BOUTIQUE, from: nextMonday, to: addDays(nextMonday, 6) });
check('the desk cannot publish: 403', deskPublish.status === 403, deskPublish.status);
const tooWide = await post(manager, '/ops/roster/publish', { propertyId: BOUTIQUE, from: nextMonday, to: addDays(nextMonday, 40) });
check('a range over 31 days: 400', tooWide.status === 400, tooWide.status);
const published = await post(manager, '/ops/roster/publish', { propertyId: BOUTIQUE, from: nextMonday, to: addDays(nextMonday, 6) });
check('the manager publishes next week: 201, counting its drafts', published.status === 201 && published.body?.entryCount >= 4, published);
const selfAfter = await get(self(desk), `/me/work/${deskFile.employeeId}/roster?from=${nextMonday}&to=${addDays(nextMonday, 6)}`);
check('the published shift now shows in self service', selfAfter.body?.entries?.some((e) => e.id === draft3.body?.id && e.publishedAt !== null), selfAfter.body?.entries?.length);
if (DB) {
  const told = await sql(`select payload->>'employeeId' as e from outbox_events where event_type = 'roster.published' and payload->>'publicationId' = $1`, [published.body?.id]);
  check('each person whose shifts were published is told once (roster.published)', told.length >= 3 && new Set(told.map((r) => r.e)).size === told.length, told.length);
} else skip('roster.published in the outbox', 'no DATABASE_URL');
const late = await roster(manager, cookA.id, evening.id, addDays(nextMonday, 4));
check('a shift added inside the published week is published at once', late.status === 201 && late.body?.publishedAt !== null, late.body);
const cancelled = await post(manager, `/ops/roster/${late.body?.id}/cancel`, { reason: 'Changed my mind' });
check('cancelling it is allowed: 200', cancelled.status === 200 && cancelled.body?.status === 'cancelled', cancelled.status);
if (DB) {
  const changed = await sql(`select count(*)::int as n from outbox_events where event_type = 'roster.changed' and payload->>'rosterEntryId' = $1`, [late.body?.id]);
  check('the person is told of the shift and of its cancellation (roster.changed)', changed[0].n === 2, changed[0].n);
} else skip('roster.changed in the outbox', 'no DATABASE_URL');

// --- Rotations (AC-TM3) ------------------------------------------------------------

console.log('\nRotations (AC-TM3)');
const rotationStart = addDays(nextMonday, 7);
const patternRes = await post(manager, '/ops/rotation-patterns', {
  propertyId: BOUTIQUE,
  name: `Two by two ${stamp}`,
  steps: [morning.id, night.id],
  rule: 'every_n_days',
  ruleValue: 2,
});
const pattern = patternRes.body;
check('the manager defines morning and night every two days: 201', patternRes.status === 201 && pattern?.stepNames?.length === 2, patternRes);
const offOnly = await post(manager, '/ops/rotation-patterns', { propertyId: BOUTIQUE, name: `All off ${stamp}`, steps: ['off', 'off'], rule: 'weekly', ruleValue: 1 });
check('a rotation with no shift in it: 422', offOnly.status === 422, offOnly.status);
const foreign = await post(manager, '/ops/rotation-patterns', { propertyId: BOUTIQUE, name: `Foreign ${stamp}`, steps: [musanze.id, 'off'], rule: 'weekly', ruleValue: 1 });
check('a step from another branch\'s shift: 422', foreign.status === 422, foreign.status);
const badRule = await post(manager, '/ops/rotation-patterns', { propertyId: BOUTIQUE, name: `Bad ${stamp}`, steps: [morning.id, 'off'], rule: 'monthly', ruleValue: 31 });
check('a monthly rule on day 31: 400', badRule.status === 400, badRule.status);
const assignB = await post(manager, '/ops/rotation-assignments', { employeeId: cookB.id, patternId: pattern?.id, startsOn: rotationStart, startStep: 0 });
const assignC = await post(manager, '/ops/rotation-assignments', { employeeId: cookC.id, patternId: pattern?.id, startsOn: rotationStart, startStep: 1 });
check('two cooks assigned, one a step ahead: 201 each', assignB.status === 201 && assignC.status === 201, [assignB, assignC]);
const twice = await post(manager, '/ops/rotation-assignments', { employeeId: cookB.id, patternId: pattern?.id, startsOn: rotationStart });
check('a second open assignment for the same cook: 409', twice.status === 409, twice.status);
const elsewhere = await post(manager, '/ops/rotation-assignments', { employeeId: cookM.id, patternId: pattern?.id, startsOn: rotationStart });
check('a cook of another branch on this rotation: 422', elsewhere.status === 422, elsewhere.status);
const rotWeek = await get(manager, `/ops/roster/week?propertyId=${BOUTIQUE}&from=${rotationStart}`);
const generated = (rotWeek.body?.entries ?? []).filter((e) => e.generated);
const shiftOf = (id, date) => generated.find((e) => e.employee.employeeId === id && e.workDate === date)?.shiftTemplateId;
check('assigning wrote that week\'s drafts at once', generated.length >= 10 && generated.every((e) => e.publishedAt === null), generated.length);
check('the step moves every two days', shiftOf(cookB.id, rotationStart) === morning.id && shiftOf(cookB.id, addDays(rotationStart, 1)) === morning.id && shiftOf(cookB.id, addDays(rotationStart, 2)) === night.id, [0, 1, 2].map((d) => shiftOf(cookB.id, addDays(rotationStart, d))));
check('the cook a step ahead works the other shift', shiftOf(cookC.id, rotationStart) === night.id, shiftOf(cookC.id, rotationStart));
const toCancel = generated.find((e) => e.employee.employeeId === cookB.id && e.workDate === addDays(rotationStart, 3));
const cancelGen = await post(manager, `/ops/roster/${toCancel?.id}/cancel`, { reason: 'Exception' });
check('a generated draft is cancelled like any shift: 200', cancelGen.status === 200, cancelGen.status);
if (DB) {
  const outcome = runDaily();
  check('the daily job runs and reports the rotation shifts it wrote', typeof outcome.generated === 'number', outcome);
  const again = await sql(`select count(*)::int as n from roster_entries where employee_id = $1 and work_date = $2 and rotation_assignment_id is not null`, [cookB.id, addDays(rotationStart, 3)]);
  check('a generated shift a manager cancelled is never written again', again[0].n === 1, again[0].n);
} else skip('the daily job keeps the horizon', 'no DATABASE_URL');
const archive = await patch(manager, `/ops/rotation-patterns/${pattern?.id}`, { status: 'archived' });
check('a pattern with people on it cannot be archived: 409', archive.status === 409, archive.status);
const endC = await post(manager, `/ops/rotation-assignments/${assignC.body?.id}/end`, { endsOn: addDays(rotationStart, 1) });
check('ending an assignment: 200', endC.status === 200 && endC.body?.endsOn === addDays(rotationStart, 1), endC);
const afterEnd = await get(manager, `/ops/roster/week?propertyId=${BOUTIQUE}&from=${rotationStart}`);
const cLeft = (afterEnd.body?.entries ?? []).filter((e) => e.employee.employeeId === cookC.id && e.generated && e.status === 'scheduled');
check('its drafts after the last day are cancelled', cLeft.length > 0 && cLeft.every((e) => e.workDate <= addDays(rotationStart, 1)), cLeft.map((e) => e.workDate));
const deskPatterns = await get(desk, `/ops/rotation-patterns?propertyId=${BOUTIQUE}`);
check('the desk reads the rotations it clocks people onto: 200', deskPatterns.status === 200 && deskPatterns.body?.patterns?.some((p) => p.id === pattern?.id), deskPatterns.status);
const deskAssign = await get(desk, '/ops/rotation-assignments');
check('the desk does not read the assignments: 403', deskAssign.status === 403, deskAssign.status);

// --- Shift and swap requests (AC-TM5) ---------------------------------------------------------

console.log('\nShift and swap requests (AC-TM5)');
const swapDay = addDays(nextMonday, 3);
const swap = await post(self(desk), `/me/work/${deskFile.employeeId}/shift-requests`, {
  kind: 'swap',
  swapEmployeeId: keeperFile.employeeId,
  from: swapDay,
  to: swapDay,
  reason: 'My sister is getting married',
});
check('Denise asks Beatha to swap through self service: 201, waiting for her', swap.status === 201 && swap.body?.status === 'awaiting_colleague', swap);
check('it is routed to Denise\'s reporting manager', swap.body?.routedTo?.employeeId === managerFile.employeeId, swap.body?.routedTo);
if (DB) {
  const asked = await sql(`select count(*)::int as n from outbox_events where event_type = 'swap.requested' and aggregate_id = $1`, [swap.body?.id]);
  check('Beatha is told (swap.requested)', asked[0].n === 1, asked[0].n);
} else skip('swap.requested in the outbox', 'no DATABASE_URL');
const early = await post(manager, `/ops/shift-requests/${swap.body?.id}/approve`, {});
check('the manager cannot decide before Beatha accepts: 409', early.status === 409, early.status);
const askedList = await get(self(housekeeper), `/me/work/${keeperFile.employeeId}/shift-requests`);
check('Beatha sees what she was asked', askedList.body?.askedOfMe?.some((r) => r.id === swap.body?.id), askedList.body);
const forColleague = await post(manager, `/ops/shift-requests/${swap.body?.id}/accept-for-colleague`, {});
check('nobody accepts for a colleague who has an account: 409', forColleague.status === 409, forColleague.status);
const accepted = await post(self(housekeeper), `/me/work/${keeperFile.employeeId}/shift-requests/${swap.body?.id}/accept`, {});
check('Beatha accepts: the request is now open for a decision', accepted.status === 200 && accepted.body?.status === 'requested' && accepted.body?.colleagueAcceptedAt, accepted);
const deskDecides = await post(desk, `/ops/shift-requests/${swap.body?.id}/approve`, {});
check('the desk cannot decide it: 403', deskDecides.status === 403, deskDecides.status);
const queue = await get(manager, listPath('/ops/shift-requests', { filters: [['routedToMe', 'eq', true]] }));
check('it is in the manager\'s queue, routed to her', queue.status === 200 && queue.body?.items?.some((r) => r.id === swap.body?.id && r.routedToMe), queue.status);
const approved = await post(manager, `/ops/shift-requests/${swap.body?.id}/approve`, { note: 'Fine by me' });
check('Solange approves: 200', approved.status === 200 && approved.body?.status === 'approved', approved);
const swapWeek = (await get(manager, `/ops/roster/week?propertyId=${BOUTIQUE}&from=${swapDay}`)).body?.entries ?? [];
const onDay = (id) => swapWeek.filter((e) => e.employee.employeeId === id && e.workDate === swapDay);
const deniseNow = onDay(deskFile.employeeId);
const beathaNow = onDay(keeperFile.employeeId);
check('the published grid shows the exchange: Denise has the morning', deniseNow.some((e) => e.status === 'scheduled' && e.shiftTemplateId === morning.id && e.fromRequest && e.publishedAt), deniseNow);
check('and Beatha the night', beathaNow.some((e) => e.status === 'scheduled' && e.shiftTemplateId === night.id && e.fromRequest), beathaNow);
check('the old shifts are cancelled, not deleted', deniseNow.some((e) => e.status === 'cancelled' && e.shiftTemplateId === night.id), deniseNow.map((e) => e.status));
if (DB) {
  const decided = await sql(`select count(*)::int as n from outbox_events where event_type = 'shift_request.decided' and aggregate_id = $1`, [swap.body?.id]);
  check('both people are told (shift_request.decided)', decided[0].n === 2, decided[0].n);
} else skip('shift_request.decided in the outbox', 'no DATABASE_URL');

const across = await post(manager, '/ops/shift-requests', { kind: 'swap', employeeId: cookA.id, swapEmployeeId: cookM.id, from: nextMonday, to: nextMonday, reason: 'Visiting family' });
check('a swap across branches: 422', across.status === 422, across.status);
const change = await post(manager, '/ops/shift-requests', { kind: 'change', employeeId: cookA.id, shiftTemplateId: evening.id, from: nextMonday, to: nextMonday, reason: 'Morning classes' });
check('the manager files a change for a cook with no account: 201, requested', change.status === 201 && change.body?.status === 'requested', change);
const changed = await post(manager, `/ops/shift-requests/${change.body?.id}/approve`, {});
const cookADay = ((await get(manager, `/ops/roster/week?propertyId=${BOUTIQUE}&from=${nextMonday}`)).body?.entries ?? []).filter((e) => e.employee.employeeId === cookA.id && e.workDate === nextMonday);
check('approving replaces the morning with the evening, published', changed.status === 200 && cookADay.some((e) => e.status === 'scheduled' && e.shiftTemplateId === evening.id && e.publishedAt) && cookADay.some((e) => e.status === 'cancelled' && e.shiftTemplateId === morning.id), cookADay.map((e) => [e.shiftTemplateId === evening.id ? 'evening' : 'morning', e.status]));
const swapNoAccounts = await post(manager, '/ops/shift-requests', { kind: 'swap', employeeId: cookA.id, swapEmployeeId: cookB.id, from: addDays(nextMonday, 1), to: addDays(nextMonday, 1), reason: 'Doctor' });
const acceptFor = await post(manager, `/ops/shift-requests/${swapNoAccounts.body?.id}/accept-for-colleague`, {});
check('for a colleague with no account, the manager accepts for them', acceptFor.status === 200 && acceptFor.body?.status === 'requested', acceptFor);
const nothingToSwap = await post(self(desk), `/me/work/${deskFile.employeeId}/shift-requests`, { kind: 'swap', swapEmployeeId: keeperFile.employeeId, from: addDays(nextMonday, 5), to: addDays(nextMonday, 5), reason: 'Exam' });
check('a swap on a day neither of them works: 422', nothingToSwap.status === 422, nothingToSwap);
const pastSwap = await post(self(desk), `/me/work/${deskFile.employeeId}/shift-requests`, { kind: 'swap', swapEmployeeId: keeperFile.employeeId, from: addDays(today, -1), to: addDays(today, -1), reason: 'Late' });
check('a swap of a day that has passed: 422', pastSwap.status === 422, pastSwap);
await roster(manager, deskFile.employeeId, morning.id, addDays(nextMonday, 5));
const declineMe = await post(self(desk), `/me/work/${deskFile.employeeId}/shift-requests`, { kind: 'swap', swapEmployeeId: keeperFile.employeeId, from: addDays(nextMonday, 5), to: addDays(nextMonday, 5), reason: 'Exam' });
const declined = await post(self(housekeeper), `/me/work/${keeperFile.employeeId}/shift-requests/${declineMe.body?.id}/decline`, {});
check('a swap the colleague declines is refused, with why', declined.status === 200 && declined.body?.status === 'rejected' && /said no/.test(declined.body?.decisionNote ?? ''), declined);
const own = await post(self(manager), `/me/work/${managerFile.employeeId}/shift-requests`, { kind: 'change', shiftTemplateId: evening.id, from: addDays(nextMonday, 2), to: addDays(nextMonday, 2), reason: 'School run' });
const ownDecide = await post(manager, `/ops/shift-requests/${own.body?.id}/approve`, {});
check('nobody decides their own request: 403', own.status === 201 && ownDecide.status === 403, [own.status, ownDecide.status]);
const ownCancel = await post(self(manager), `/me/work/${managerFile.employeeId}/shift-requests/${own.body?.id}/cancel`, {});
check('the person withdraws it through self service', ownCancel.status === 200 && ownCancel.body?.status === 'cancelled', ownCancel.status);
const bulkChange = await post(manager, '/ops/shift-requests', { kind: 'change', employeeId: cookB.id, shiftTemplateId: evening.id, from: addDays(nextMonday, 6), to: addDays(nextMonday, 6), reason: 'Bulk one' });
const bulk = await post(manager, '/ops/shift-requests/bulk', { action: 'reject', ids: [bulkChange.body?.id, swap.body?.id], params: { note: 'Not this week' } });
const results = bulk.body?.results ?? [];
check('bulk refuse: the open one is refused, the decided one says why', bulk.status === 200 && results.find((r) => r.id === bulkChange.body?.id)?.ok === true && results.find((r) => r.id === swap.body?.id)?.status === 409, results);

// --- Attendance figures and overtime (AC-TM7, AC-TM8, AC-TM15) ------------------------------------

console.log('\nFigures as a record closes (AC-TM7, AC-TM8, AC-TM15)');
const yMorning = await roster(manager, cookA.id, morning.id, yesterday);
check('a morning shift yesterday', yMorning.status === 201, yMorning);
const inA = await post(desk, '/ops/attendance/clock-in', { employeeId: cookA.id, at: kigali(yesterday, '06:12') });
check('the clock in links to yesterday\'s morning (AC-TM15)', inA.status === 201 && inA.body?.rosterEntryId === yMorning.body?.id && inA.body?.workDate === yesterday, inA.body);
const outA = await post(desk, `/ops/attendance/${inA.body?.id}/clock-out`, { at: kigali(yesterday, '15:10') });
check('the desk clocks out: 200, and reads no figures', outA.status === 200 && outA.body?.figures === null, outA.body?.figures);
const recA = (await get(manager, listPath('/ops/attendance', { filters: [['workDate', 'eq', yesterday]] }))).body?.items?.find((r) => r.id === inA.body?.id);
const f = recA?.figures;
check('late 12, counted from the start past a 5 minute grace', f?.lateMinutes === 12, f);
check('no early leaving', f?.earlyMinutes === 0, f);
check('worked 508: out less in less the 30 minute break', f?.workedMinutes === 508, f);
check('overtime 58 past the 450 the shift asks, pending a decision', f?.overtimeMinutes === 58 && f?.approvedOvertimeMinutes === null, f);
const deskSheet = (await get(desk, listPath('/ops/attendance', { filters: [['workDate', 'eq', yesterday]] }))).body?.items ?? [];
check('the desk\'s sheet carries no figures (AC-TM13)', deskSheet.length > 0 && deskSheet.every((r) => r.figures === null), deskSheet.map((r) => r.figures));
const sortFigure = await get(manager, '/ops/attendance?s=-lateMinutes');
check('a figure is never a sort key: 422', sortFigure.status === 422, sortFigure.status);
const tooMuch = await post(manager, `/ops/attendance/${inA.body?.id}/overtime`, { approvedMinutes: 90 });
check('approving more overtime than was worked: 422', tooMuch.status === 422, tooMuch.status);
const deskOvertime = await post(desk, `/ops/attendance/${inA.body?.id}/overtime`, { approvedMinutes: 40 });
check('the desk cannot decide overtime: 403', deskOvertime.status === 403, deskOvertime.status);
const reduced = await post(manager, `/ops/attendance/${inA.body?.id}/overtime`, { approvedMinutes: 40, note: 'The last 18 were a chat' });
check('the manager approves 40 of the 58 (AC-TM8)', reduced.status === 200 && reduced.body?.figures?.approvedOvertimeMinutes === 40, reduced.body?.figures);
const yNight = await roster(manager, cookC.id, night.id, twoDaysAgo);
const inNight = await post(desk, '/ops/attendance/clock-in', { employeeId: cookC.id, at: kigali(twoDaysAgo, '21:58') });
const outNight = await post(desk, `/ops/attendance/${inNight.body?.id}/clock-out`, { at: kigali(yesterday, '06:01') });
check('a night shift across midnight stays on the day it started (AC-TM15)', yNight.status === 201 && inNight.body?.workDate === twoDaysAgo && inNight.body?.rosterEntryId === yNight.body?.id && outNight.status === 200, [inNight.body?.workDate, outNight.status]);
const lateEvening = await roster(manager, cookA.id, evening.id, twoDaysAgo);
const lateIn = await post(desk, '/ops/attendance/clock-in', { employeeId: cookA.id, at: kigali(twoDaysAgo, '14:20') });
await post(desk, `/ops/attendance/${lateIn.body?.id}/clock-out`, { at: kigali(twoDaysAgo, '21:30') });
const lateRec = (await get(manager, listPath('/ops/attendance', { filters: [['workDate', 'eq', twoDaysAgo]] }))).body?.items?.find((r) => r.id === lateIn.body?.id);
check('late 20 and early 30 on an evening two days ago', lateEvening.status === 201 && lateRec?.figures?.lateMinutes === 20 && lateRec?.figures?.earlyMinutes === 30 && lateRec?.figures?.overtimeMinutes === 0, lateRec?.figures);
const unlinked = await post(desk, '/ops/attendance/clock-in', { employeeId: cookB.id, at: kigali(twoDaysAgo, '12:00') });
check('a clock in with no shift near it is unlinked, on its Kigali date', unlinked.status === 201 && unlinked.body?.rosterEntryId === null && unlinked.body?.workDate === twoDaysAgo, unlinked.body);
await post(desk, `/ops/attendance/${unlinked.body?.id}/clock-out`, { at: kigali(twoDaysAgo, '16:00') });

// --- Attendance requests (AC-TM6) ---------------------------------------------------------

console.log('\nAttendance requests (AC-TM6)');
const missed = await post(self(desk), `/me/work/${deskFile.employeeId}/attendance/requests`, {
  workDate: twoDaysAgo,
  clockInAt: kigali(twoDaysAgo, '07:00'),
  clockOutAt: kigali(twoDaysAgo, '15:00'),
  reason: 'The tablet was down',
});
check('Denise asks for a missed day: 201, routed to Solange', missed.status === 201 && missed.body?.status === 'requested' && missed.body?.routedTo?.employeeId === managerFile.employeeId, missed);
const wrongDay = await post(self(desk), `/me/work/${deskFile.employeeId}/attendance/requests`, {
  workDate: yesterday,
  clockInAt: kigali(twoDaysAgo, '07:00'),
  clockOutAt: kigali(twoDaysAgo, '15:00'),
  reason: 'Wrong day',
});
check('a clock in that is not on the day asked about: 422', wrongDay.status === 422, wrongDay.status);
const future = await post(self(desk), `/me/work/${deskFile.employeeId}/attendance/requests`, {
  workDate: addDays(today, 2),
  clockInAt: kigali(addDays(today, 2), '07:00'),
  clockOutAt: kigali(addDays(today, 2), '15:00'),
  reason: 'Ahead of time',
});
check('a day still to come: 422', future.status === 422, future.status);
const deskList = await get(desk, '/ops/attendance-requests');
check('the desk does not read the queue: 403', deskList.status === 403, deskList.status);
const missedOk = await post(manager, `/ops/attendance-requests/${missed.body?.id}/approve`, { note: 'Seen on the camera' });
check('Solange approves: a record is written with it', missedOk.status === 200 && missedOk.body?.status === 'approved' && !!missedOk.body?.resultRecordId, missedOk);
const written = (await get(manager, listPath('/ops/attendance', { filters: [['workDate', 'eq', twoDaysAgo]] }))).body?.items?.find((r) => r.id === missedOk.body?.resultRecordId);
check('the record is validated, by a supervisor, and names the request', written?.validated === true && written?.source === 'supervisor' && /Attendance request/.test(written?.note ?? ''), written);
const again = await post(manager, `/ops/attendance-requests/${missed.body?.id}/reject`, {});
check('a decided request cannot be decided again: 409', again.status === 409, again.status);
const fix = await post(desk, '/ops/attendance-requests', {
  employeeId: cookA.id,
  workDate: yesterday,
  clockInAt: kigali(yesterday, '06:02'),
  clockOutAt: kigali(yesterday, '15:10'),
  recordId: inA.body?.id,
  reason: 'She was here at 6, the tablet was slow',
});
check('the desk files a correction for a cook: 201', fix.status === 201 && fix.body?.recordId === inA.body?.id, fix);
const fixed = await post(manager, `/ops/attendance-requests/${fix.body?.id}/approve`, {});
const sheetAfter = (await get(manager, listPath('/ops/attendance', { filters: [['workDate', 'eq', yesterday]] }))).body?.items ?? [];
const corrected = sheetAfter.find((r) => r.id === fixed.body?.resultRecordId);
check('approving a correction supersedes the record (AC-T5)', fixed.status === 200 && corrected?.supersedesId === inA.body?.id && corrected?.figures?.lateMinutes === 0, corrected);
const ownAsk = await post(self(manager), `/me/work/${managerFile.employeeId}/attendance/requests`, {
  workDate: yesterday,
  clockInAt: kigali(yesterday, '08:00'),
  clockOutAt: kigali(yesterday, '16:00'),
  reason: 'Forgot to clock',
});
const ownApprove = await post(manager, `/ops/attendance-requests/${ownAsk.body?.id}/approve`, {});
check('nobody decides their own attendance request: 403', ownAsk.status === 201 && ownApprove.status === 403, [ownAsk.status, ownApprove.status]);
const ownWithdraw = await post(self(manager), `/me/work/${managerFile.employeeId}/attendance/requests/${ownAsk.body?.id}/cancel`, {});
check('and withdraws it herself', ownWithdraw.status === 200 && ownWithdraw.body?.status === 'cancelled', ownWithdraw.status);

// --- Phone clock in (AC-TM9) ----------------------------------------------------------------

console.log('\nPhone clock in (AC-TM9)');
const near = { lat: CENTRE.lat + 0.0005, lng: CENTRE.lng, accuracyM: 20 }; // about 55 m
const far = { lat: CENTRE.lat + 0.0036, lng: CENTRE.lng, accuracyM: 15 }; // about 400 m
const phoneIn = await post(self(desk), `/me/work/${deskFile.employeeId}/clock-in`, near);
check('Denise clocks in at the kitchen door: validated', phoneIn.status === 201 && phoneIn.body?.validated === true && phoneIn.body?.record?.source === 'phone' && phoneIn.body?.distanceM < 150, phoneIn.body);
const phoneTwice = await post(self(desk), `/me/work/${deskFile.employeeId}/clock-in`, near);
check('a second clock in: 409 naming the open one', phoneTwice.status === 409 && phoneTwice.body?.code === 'already_open', phoneTwice.body);
const files = await filesOf(desk);
check('her file says she is clocked in', files.find((x) => x.employeeId === deskFile.employeeId)?.openRecord?.id === phoneIn.body?.record?.id, files);
const phoneOut = await post(self(desk), `/me/work/${deskFile.employeeId}/clock-out`, far);
check('she clocks out 400 m away: recorded, not refused, waiting for validation', phoneOut.status === 200 && phoneOut.body?.validated === false && phoneOut.body?.distanceM >= 350 && /m from the branch/.test(phoneOut.body?.pendingReason ?? ''), phoneOut.body);
const noFix = await post(self(housekeeper), `/me/work/${keeperFile.employeeId}/clock-in`, {});
check('a clock in with location refused is still recorded, unvalidated', noFix.status === 201 && noFix.body?.validated === false && /No location/.test(noFix.body?.pendingReason ?? ''), noFix.body);
const vague = await post(self(housekeeper), `/me/work/${keeperFile.employeeId}/clock-out`, { ...near, accuracyM: 900 });
check('a fix too vague to trust stays unvalidated', vague.status === 200 && vague.body?.validated === false, vague.body);
if (DB) {
  const flagged = await sql(`select count(*)::int as n from outbox_events where event_type = 'attendance.flagged' and payload->>'employeeId' = $1`, [deskFile.employeeId]);
  check('the far clock out raises attendance.flagged', flagged[0].n >= 1, flagged[0].n);
} else skip('attendance.flagged in the outbox', 'no DATABASE_URL');
const withDistance = (await get(manager, listPath('/ops/attendance', { q: 'Iribagiza' }))).body?.items?.find((r) => r.id === phoneIn.body?.record?.id);
check('the validator reads how far each punch was, never where', withDistance?.location?.outDistanceM >= 350 && !('outLatitude' in (withDistance?.location ?? {})), withDistance?.location);
const deskRow = (await get(desk, listPath('/ops/attendance', { q: 'Iribagiza' }))).body?.items?.find((r) => r.id === phoneIn.body?.record?.id);
check('the desk reads no distance', deskRow && deskRow.location === null, deskRow?.location);
// A pay run covers the people with a contract in its month, and a contract
// needs the statutory details a backfilled file lacks (AC-P4).
await patch(owner, `/ops/employees/${deskFile.employeeId}`, {
  dateOfBirth: '1994-06-14',
  sex: 'female',
  idDocumentType: 'national_id',
  idDocumentNumber: idNumber(7),
  phone: `0788 8${stamp.slice(-2)} 370`.replace(/ /g, ''),
});
const deskDetail = (await get(owner, `/ops/employees/${deskFile.employeeId}`)).body;
const deskContracts = deskDetail?.contracts ?? [];
if (!deskContracts.some((c) => c.status !== 'ended')) {
  const hiredOn = deskDetail?.employee?.hiredOn ?? firstOfMonth;
  const contract = await post(owner, `/ops/employees/${deskFile.employeeId}/contracts`, {
    contractType: 'permanent',
    startsOn: hiredOn > firstOfMonth ? hiredOn : firstOfMonth,
    wageBasis: 'monthly',
    wageRwf: 250000,
  });
  check('Denise is given a monthly contract, so the run covers her', contract.status === 201, contract.body);
}
const payRun = await post(owner, '/ops/pay-runs', { period: month });
const run = payRun.status === 201 ? payRun.body : null;
const existing = run ? null : (await get(owner, '/ops/pay-runs?size=50')).body?.items?.find((r) => r.period === month);
const detail = run ?? (existing ? (await post(owner, `/ops/pay-runs/${existing.id}/recompute`, {})).body : null);
const blockers = detail?.blockers ?? [];
check('the unvalidated phone record blocks this month\'s pay run (AC-TM16)', blockers.some((b) => b.code === 'unvalidated_attendance' && b.employeeId === deskFile.employeeId && /by phone/.test(b.message)), blockers.filter((b) => b.code.includes('attendance')));
const validated = await post(manager, `/ops/attendance/${phoneIn.body?.record?.id}/validate`, {});
check('Solange validates it: 200', validated.status === 200 && validated.body?.validated === true, validated.status);
const runId = detail?.run?.id;
const after = runId ? (await post(owner, `/ops/pay-runs/${runId}/recompute`, {})).body?.blockers ?? [] : [];
check('and it no longer blocks the run', runId && !after.some((b) => b.code === 'unvalidated_attendance' && b.employeeId === deskFile.employeeId), after.filter((b) => b.code.includes('attendance')));

// --- Kiosks and PINs (AC-TM10, AC-TM11) ------------------------------------------------------

console.log('\nKiosks and PINs (AC-TM10, AC-TM11)');
const kioskRes = await post(desk, '/ops/attendance/kiosks', { propertyId: BOUTIQUE, name: `Back door ${stamp}` });
check('the desk adds a kiosk: 201 with an 8 digit code, shown once', kioskRes.status === 201 && /^\d{8}$/.test(kioskRes.body?.pairingCode ?? '') && kioskRes.body?.kiosk?.status === 'pairing', kioskRes);
const housekeeperKiosk = await post(housekeeper, '/ops/attendance/kiosks', { propertyId: BOUTIQUE, name: 'Nope' });
check('a housekeeper cannot: 403', housekeeperKiosk.status === 403, housekeeperKiosk.status);
const listed = await get(desk, '/ops/attendance/kiosks');
check('the list never carries a code', listed.status === 200 && !JSON.stringify(listed.body).includes(kioskRes.body?.pairingCode), listed.status);
const pinA = await put(manager, `/ops/employees/${cookA.id}/kiosk-pin`, { pin: '4821' });
const pinB = await put(desk, `/ops/employees/${cookB.id}/kiosk-pin`, { pin: '7310' });
const pinC = await put(desk, `/ops/employees/${cookC.id}/kiosk-pin`, { pin: '5566' });
check('the manager and the desk set PINs: never shown back', pinA.status === 200 && pinA.body?.hasPin === true && !JSON.stringify(pinA.body).includes('4821') && pinB.status === 200 && pinC.status === 200, [pinA.body, pinB.status, pinC.status]);
const shortPin = await put(desk, `/ops/employees/${cookA.id}/kiosk-pin`, { pin: '12' });
check('a 2 digit PIN: 400', shortPin.status === 400, shortPin.status);
if (DB) {
  const stored = await sql(`select pin_hash from employee_kiosk_pins where employee_id = $1`, [cookA.id]);
  check('a PIN is stored as a scrypt hash, never in the clear', stored[0]?.pin_hash?.startsWith('scrypt$') && !stored[0].pin_hash.includes('4821'), stored[0]?.pin_hash?.slice(0, 20));
  const audit = await sql(`select payload_diff::text as d from audit_events where event_type in ('hr.kiosk_pin_set', 'hr.kiosk_pin_reset') and subject_id = $1`, [cookA.id]);
  check('setting it is audited, without the PIN', audit.length === 1 && !audit[0].d.includes('4821'), audit);
} else skip('PIN storage and audit', 'no DATABASE_URL');

const pair = await fetch(`${API}/api/v1/kiosk/pair`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: kioskRes.body?.pairingCode }),
});
const setCookie = pair.headers.get('set-cookie') ?? '';
const pairBody = await pair.json();
check('the tablet pairs: 200, the branch name back', pair.status === 200 && pairBody?.branchName?.length > 0, pairBody);
check('the token is an HttpOnly, SameSite=Strict cookie on the kiosk routes only', /injishi_kiosk=/.test(setCookie) && /HttpOnly/i.test(setCookie) && /SameSite=Strict/i.test(setCookie) && /Path=\/api\/v1\/kiosk/i.test(setCookie), setCookie);
check('and never in the body', !Object.keys(pairBody ?? {}).some((k) => /token/i.test(k)), Object.keys(pairBody ?? {}));
const kioskCookie = setCookie.split(';')[0];
const kiosk = { cookie: kioskCookie };
const reuse = await post({}, '/kiosk/pair', { code: kioskRes.body?.pairingCode });
check('the code works once: 422', reuse.status === 422, reuse.status);
const session = await get(kiosk, '/kiosk/session');
check('the kiosk knows its branch and nothing else', session.status === 200 && Object.keys(session.body ?? {}).sort().join() === 'branchName,kioskName', session.body);
const noCookie = await get({}, '/kiosk/session');
check('without the cookie: 401 kiosk_unpaired', noCookie.status === 401 && noCookie.body?.code === 'kiosk_unpaired', noCookie.body);
const punch = (number, pin) => post(kiosk, '/kiosk/punch', { employeeNumber: number, pin });
const wrong = await punch(cookA.employeeNumber, '0000');
check('a wrong PIN: 422, no name', wrong.status === 422 && !JSON.stringify(wrong.body).includes('Uwimana'), wrong.body);
const unknown = await punch('ZZ9999', '4821');
check('an unknown number reads the same', unknown.status === 422 && unknown.body?.message === wrong.body?.message, unknown.body);
const otherBranch = await put(owner, `/ops/employees/${cookM.id}/kiosk-pin`, { pin: '9999' });
const fromMusanze = await punch(cookM.employeeNumber, '9999');
check('a person of another branch reads the same at this kiosk', otherBranch.status === 200 && fromMusanze.status === 422 && fromMusanze.body?.message === wrong.body?.message, fromMusanze.body);
const kin = await punch(cookA.employeeNumber, '4821');
check('the right PIN: 200, her name and "in"', kin.status === 200 && kin.body?.direction === 'in' && kin.body?.displayName?.includes('Uwimana'), kin.body);
const tap = await punch(cookA.employeeNumber, '4821');
check('again within a minute: 409, a double tap', tap.status === 409 && tap.body?.code === 'double_tap', tap.body);
const kioskRecord = (await get(manager, listPath('/ops/attendance', { q: 'Uwimana Alice' }))).body?.items?.find((r) => r.status === 'open');
check('the kiosk punch is validated as it is written', kioskRecord?.source === 'kiosk' && kioskRecord?.validated === true, kioskRecord);
let lockedAt = null;
for (let i = 0; i < 5; i += 1) lockedAt = await punch(cookB.employeeNumber, '1111');
check('the fifth wrong PIN in a row locks him: 423', lockedAt.status === 423 && lockedAt.body?.code === 'pin_locked', lockedAt.body);
const stillLocked = await punch(cookB.employeeNumber, '7310');
check('even the right PIN waits out the lock', stillLocked.status === 423, stillLocked.status);
const colleague = await punch(cookC.employeeNumber, '5566');
check('while a colleague still punches', colleague.status === 200 && colleague.body?.direction === 'in', colleague.body);
const unlock = await post(desk, `/ops/attendance/kiosks/${kioskRes.body?.kiosk?.id}/unlock-pin`, { employeeId: cookB.id });
const afterUnlock = await punch(cookB.employeeNumber, '7310');
check('the desk lifts the lock, and he punches', unlock.status === 204 && afterUnlock.status === 200, [unlock.status, afterUnlock.status]);
const deskSetsOwn = await put(self(desk), `/me/work/${deskFile.employeeId}/kiosk-pin`, { currentPin: '1234', pin: '2468' });
check('changing a PIN you were never given: 409', deskSetsOwn.status === 409, deskSetsOwn.status);
await put(manager, `/ops/employees/${deskFile.employeeId}/kiosk-pin`, { pin: '1357' });
const wrongCurrent = await put(self(desk), `/me/work/${deskFile.employeeId}/kiosk-pin`, { currentPin: '0000', pin: '2468' });
const changedPin = await put(self(desk), `/me/work/${deskFile.employeeId}/kiosk-pin`, { currentPin: '1357', pin: '2468' });
check('Denise changes her own PIN, proving the current one (AC-TM11)', wrongCurrent.status === 422 && changedPin.status === 200 && changedPin.body?.hasPin === true, [wrongCurrent.status, changedPin.status]);
const allowed = await post(desk, '/ops/attendance/kiosks', { propertyId: BOUTIQUE, name: `Locked down ${stamp}`, allowedIps: ['10.9.9.9'] });
const offList = await post({}, '/kiosk/pair', { code: allowed.body?.pairingCode });
check('a kiosk limited to an address refuses to pair from another: 403', allowed.status === 201 && offList.status === 403, [allowed.status, offList.status]);
const revoke = await post(desk, `/ops/attendance/kiosks/${kioskRes.body?.kiosk?.id}/revoke`, {});
const revoked = await get(kiosk, '/kiosk/session');
check('revoking stops the cookie at once', revoke.status === 200 && revoke.body?.status === 'revoked' && revoked.status === 401, [revoke.status, revoked.status]);
const throttleKiosk = await post(desk, '/ops/attendance/kiosks', { propertyId: BOUTIQUE, name: `Busy ${stamp}` });
const tpair = await fetch(`${API}/api/v1/kiosk/pair`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: throttleKiosk.body?.pairingCode }) });
const busy = { cookie: (tpair.headers.get('set-cookie') ?? '').split(';')[0] };
const flood = [];
for (let i = 0; i < 32; i += 1) flood.push((await post(busy, '/kiosk/punch', { employeeNumber: 'ZZ0000', pin: '0000' })).status);
check('a kiosk is limited to 30 PIN attempts a minute: 429 after', flood.slice(0, 30).every((s) => s === 422) && flood.slice(30).every((s) => s === 429), flood.join(','));

// --- The sweep (AC-TM4) -------------------------------------------------------------------

console.log('\nThe sweep (AC-TM4)');
// The kiosk left Bosco and Chantal clocked in; the desk clocks them out first.
for (const name of ['Nkurunziza Bosco', 'Ingabire Chantal']) {
  const open = (await get(manager, listPath('/ops/attendance', { q: name }))).body?.items?.find((r) => r.status === 'open');
  if (open) await post(desk, `/ops/attendance/${open.id}/clock-out`, {});
}
const shortEntry = await roster(manager, cookB.id, short.id, twoDaysAgo);
const shortIn = await post(desk, '/ops/attendance/clock-in', { employeeId: cookB.id, at: kigali(twoDaysAgo, '07:55') });
check('a short shift two days ago, clocked in and never out', shortEntry.status === 201 && shortIn.status === 201 && shortIn.body?.rosterEntryId === shortEntry.body?.id, [shortEntry.status, shortIn.body?.rosterEntryId]);
const staleIn = await post(desk, '/ops/attendance/clock-in', { employeeId: cookC.id, at: new Date(Date.now() - 20 * 3_600_000).toISOString() });
check('and a clock in 20 hours ago', staleIn.status === 201, staleIn);
if (DB) {
  const swept = runDaily(['--sweep']);
  check('the sweep closes them', swept.closed >= 2, swept);
  const rows = await sql(`select id, auto_closed, validated, clock_out_at, overtime_minutes, note from attendance_records where id = any($1::uuid[])`, [[shortIn.body?.id, staleIn.body?.id]]);
  const shortRow = rows.find((r) => r.id === shortIn.body?.id);
  const staleRow = rows.find((r) => r.id === staleIn.body?.id);
  check('at the shift\'s end plus its automatic clock out', shortRow?.auto_closed === true && new Date(shortRow.clock_out_at).toISOString() === new Date(kigali(twoDaysAgo, '10:00')).toISOString(), shortRow);
  check('or, stale, at clock in plus the default 8 hours', staleRow?.auto_closed === true && new Date(staleRow.clock_out_at).getTime() - new Date(staleIn.body?.clockInAt).getTime() === 480 * 60_000, staleRow);
  check('unvalidated, noted, and earning no overtime', [shortRow, staleRow].every((r) => r?.validated === false && /sweep/.test(r?.note ?? '') && (r?.overtime_minutes ?? 0) === 0), rows);
  const toValidate = await get(manager, listPath('/ops/attendance', { filters: [['validated', 'eq', false], ['status', 'eq', 'closed']] }));
  check('the validation queue reads across days, swept records with it', toValidate.status === 200 && toValidate.body?.items?.some((r) => r.id === shortIn.body?.id && r.autoClosed), toValidate.body?.items?.length);
  const overtimeQueue = await get(manager, listPath('/ops/attendance', { filters: [['overtimePending', 'eq', true]] }));
  check('so does the overtime still to decide', overtimeQueue.status === 200 && overtimeQueue.body?.items?.some((r) => r.figures?.overtimeMinutes > 0 && r.figures?.approvedOvertimeMinutes === null), overtimeQueue.body?.items?.length);
  const deskQueue = await get(desk, listPath('/ops/attendance', { filters: [['overtimePending', 'eq', true]] }));
  check('a figure filter from the desk, which reads no figures: refused', deskQueue.status === 422 || deskQueue.status === 400, deskQueue.status);
  const noValidate = await post(manager, `/ops/attendance/${shortIn.body?.id}/validate`, {});
  check('a swept record cannot be vouched for, only corrected: 409', noValidate.status === 409, noValidate.status);
  const sweptAgain = runDaily(['--sweep']);
  check('a second sweep finds nothing more to close', sweptAgain.closed === 0, sweptAgain);
} else skip('the sweep', 'no DATABASE_URL');

// --- Insights (AC-TM13) -----------------------------------------------------------------

console.log('\nInsights and their three readers (AC-TM13)');
const lateEarly = await get(owner, `/ops/attendance/insights/late-early?from=${twoDaysAgo}&to=${today}`);
const names = (lateEarly.body?.rows ?? []).map((r) => r.employee.displayName);
check('the owner reads lateness: rows in name order', lateEarly.status === 200 && names.length > 0 && names.every((n, i) => i === 0 || names[i - 1].localeCompare(n, 'en', { sensitivity: 'base' }) <= 0), names);
const lateRow = lateEarly.body?.rows?.find((r) => r.recordId === lateIn.body?.id);
check('with the shift it was late for', lateRow?.lateMinutes === 20 && lateRow?.earlyMinutes === 30 && lateRow?.shiftName === evening.name, lateRow);
const managerInsights = await get(manager, `/ops/attendance/insights/late-early?from=${twoDaysAgo}&to=${today}`);
check('a manager without people.manage does not: 403', managerInsights.status === 403, managerInsights.status);
const monthly = await get(owner, `/ops/attendance/insights/monthly?month=${month}`);
const rowA = monthly.body?.rows?.find((r) => r.employee.employeeId === cookA.id);
check('the monthly summary counts worked, expected and overtime minutes', monthly.status === 200 && rowA?.workedMinutes > 0 && rowA?.expectedMinutes > 0, rowA);
const mine = await get(self(desk), `/me/work/${deskFile.employeeId}/attendance/summary?month=${month}`);
check('Denise reads her own month', mine.status === 200 && mine.body?.summary?.daysWorked >= 1, mine.body);
const team = await get(self(manager), `/me/work/${managerFile.employeeId}/team`);
check('Solange reads her direct reports, cards only', team.status === 200 && team.body?.reports?.some((r) => r.employeeId === deskFile.employeeId) && team.body.reports.every((r) => Object.keys(r).sort().join() === 'displayName,employeeId,jobPositionTitle'), team.body);
const teamAtt = await get(self(manager), `/me/work/${managerFile.employeeId}/team/attendance?from=${firstOfMonth}&to=${lastOfMonth}`);
check('and their month, as their manager (contract 7\'s third reader)', teamAtt.status === 200 && teamAtt.body?.summaries?.some((s) => s.employee.employeeId === deskFile.employeeId), teamAtt.body?.summaries?.length);
const teamReq = await get(self(manager), `/me/work/${managerFile.employeeId}/team/requests?kind=attendance`);
check('and the requests routed to her, with their state', teamReq.status === 200 && teamReq.body?.attendance?.some((r) => r.id === missed.body?.id && r.status === 'approved') && teamReq.body?.shift?.length === 0, teamReq.body && [teamReq.body.attendance?.length, teamReq.body.shift?.length]);
const notMine = await get(self(manager), `/me/work/${managerFile.employeeId}/team/requests/attendance/${fix.body?.id}`);
check('a request routed to nobody she manages: 404', notMine.status === 404, notMine.status);
const grace = limitedFile ? await get(self(limited), `/me/work/${deskFile.employeeId}/attendance/summary?month=${month}`) : { status: 404 };
check('someone who is not Denise\'s manager asks for her month: 404', grace.status === 404, grace.status);
const clarisseTeam = limitedFile ? await get(self(limited), `/me/work/${limitedFile.employeeId}/team/attendance?from=${firstOfMonth}&to=${lastOfMonth}`) : null;
check('and her own team holds nobody', !clarisseTeam || (clarisseTeam.status === 200 && clarisseTeam.body?.records?.length === 0), clarisseTeam?.body);

if (client) await client.end();
console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check${failures === 1 ? '' : 's'} failed.`}`);
process.exit(failures === 0 ? 0 : 1);
