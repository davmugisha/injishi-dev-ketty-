#!/usr/bin/env node
// A working HR demo for a SAMPLE database: the Staff screens with people,
// contracts, shifts, attendance, leave and pay already in them (ADR-058).
//
// `seed-sample.mjs` gives every seeded staff account a file and stops there,
// so on a fresh sample database every Staff lens but Employees opens empty:
// nobody has a branch, a contract or a shift, nobody ever clocked in, nobody
// asked for leave and no month was ever paid. That is the right state for the
// verify scripts, which build their own rows, and the wrong one for showing
// the module to anybody.
//
// This fills it in, for the demo hotels named in BUSINESSES below, the way an
// HR office would have over its first weeks:
//
//   files       a branch, a manager, the statutory details and a hire date in
//               the past for each seeded account, and six more people with no
//               account (cooks, waiters, a guard, a room attendant)
//   pay         a monthly contract and a MoMo pay account each, the business's
//               RSSB employer number, last month's pay run confirmed and this
//               month's left in draft
//   time        four shifts, a geofence, an attendance policy with ten minutes
//               of grace, last week, this week and next week rostered and
//               published, a week of clock ins and outs with a few late
//               arrivals and a few shifts that ran long, and whoever is on
//               shift now clocked in
//   leave       one request approved, one waiting, one refused
//   checklists  a joining and a leaving list, and somebody who started three
//               days ago partway through hers
//   kiosk       one at the staff entrance, waiting for its tablet, and a PIN
//               for everybody: DEMO_PIN below, the same for all, so whoever
//               shows the kiosk can clock anybody in
//   the rest    a business holiday, a policy and an announcement
//
// IT DRIVES THE REAL API, as the verify scripts do, signed in as the demo
// owner, so every row is one the product itself agreed to write: the ledger,
// the lots, the pay lines and the audit trail are the product's, not this
// file's. That also keeps it off production without a check of its own: it
// signs in with the fixed demo code, which only a sample database's demo
// platform accepts.
//
// EVERY PERSON AND FIGURE HERE IS INVENTED. The ID and RSSB numbers are made
// up, the wages are round numbers, and pay is computed from the placeholder
// rules `seed-hr-rules.mjs` wrote, which say DEMO SAMPLE DATA themselves.
//
// Safe to run again: a step whose rows are already there is skipped and says
// so. Run it once the API is up on a freshly seeded sample database. On an
// older one it does what it still can: a hire date, for one, can no longer
// move once leave has been earned from it, and the script says so and goes on.
//
//   pnpm dev:stack && pnpm api:dev        (in another terminal)
//   node scripts/seed-hr-demo.mjs
//
//   SEED_API_URL=http://localhost:8000    where the API is
//   SEED_OTP_CODE=123456                  the demo platform's fixed code

const API = process.env.SEED_API_URL || process.env.VERIFY_API_URL || 'http://localhost:8000';
const OTP = process.env.SEED_OTP_CODE || process.env.VERIFY_OTP_CODE || '123456';

/** Wages by job, in RWF a month. Round numbers, so a payslip can be checked by hand. */
const WAGE = {
  'General manager': 900_000,
  Accountant: 520_000,
  'HR officer': 460_000,
  'Front desk agent': 260_000,
  'Line cook': 220_000,
  'Room attendant': 160_000,
  Waiter: 150_000,
  'Security guard': 130_000,
};

/**
 * Which shift a job works on each day of the week, Monday first. `-` is a day
 * off. Two people in one job take the two rows in turn, so the desk and the
 * kitchen are covered morning and evening.
 */
const PATTERN = {
  'General manager': ['OOOOO--'],
  Accountant: ['OOOOO--'],
  'HR officer': ['OOOOO--'],
  'Front desk agent': ['MMMEE-M', 'EE-MMME'],
  'Line cook': ['MMEE-MM', 'EEMM-EE'],
  'Room attendant': ['MMMMM-M', 'MMM-MMM'],
  Waiter: ['EEEE-EE', 'MM-MMMM'],
  'Security guard': ['NNNNN-N'],
};

const SHIFTS = [
  { key: 'M', name: 'Morning', startsAt: '07:00', endsAt: '15:00', breakMinutes: 30 },
  { key: 'E', name: 'Evening', startsAt: '15:00', endsAt: '23:00', breakMinutes: 30 },
  { key: 'N', name: 'Night', startsAt: '23:00', endsAt: '07:00', breakMinutes: 30 },
  { key: 'O', name: 'Office', startsAt: '08:00', endsAt: '17:00', breakMinutes: 60 },
];

/** People with no account: on file, rostered and paid, and never signing in. */
const NEW_PEOPLE = [
  { legalName: 'Jean-Paul Habimana', sex: 'male', dateOfBirth: '1989-03-14', job: 'Line cook', hiredYearsAgo: 4 },
  { legalName: 'Chantal Mukamana', sex: 'female', dateOfBirth: '1994-08-02', job: 'Line cook', hiredYearsAgo: 1 },
  { legalName: 'Eric Niyonzima', sex: 'male', dateOfBirth: '1998-11-23', job: 'Waiter', hiredYearsAgo: 2 },
  { legalName: 'Aline Umutoni', sex: 'female', dateOfBirth: '2000-01-09', job: 'Waiter', hiredYearsAgo: 0 },
  { legalName: 'Innocent Bizimana', sex: 'male', dateOfBirth: '1981-06-30', job: 'Security guard', hiredYearsAgo: 6 },
  { legalName: 'Josiane Uwamahoro', sex: 'female', dateOfBirth: '1992-12-17', job: 'Room attendant', hiredYearsAgo: 3 },
];

/** What a seeded account's file is given, by the job the seed already put on it. */
const SEEDED_BY_JOB = {
  'General manager': { sex: 'female', dateOfBirth: '1984-05-21', hiredYearsAgo: 5 },
  Accountant: { sex: 'female', dateOfBirth: '1990-09-12', hiredYearsAgo: 2 },
  'HR officer': { sex: 'female', dateOfBirth: '1991-02-27', hiredYearsAgo: 3 },
  'Front desk agent': { sex: 'female', dateOfBirth: '1996-07-04', hiredYearsAgo: 1 },
  'Room attendant': { sex: 'female', dateOfBirth: '1993-10-19', hiredYearsAgo: 2 },
};

/**
 * Every demo person's kiosk PIN. One PIN for all is wrong anywhere real and
 * right here: the point of a demo kiosk is that whoever is showing it can
 * clock in as the cook. A real office sets each person's own under Kiosks.
 */
const DEMO_PIN = '2468';

const BUSINESSES = [
  { name: 'Amahoro Hospitality Group', owner: 'yves@demo.injishi.com', code: '31' },
  { name: 'Umurage Hospitality Ltd', owner: 'host@injishi.com', code: '32' },
];

// --- Dates, in Kigali -----------------------------------------------------------

const KIGALI_OFFSET = '+02:00';
const kigaliDay = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(date);
const addDays = (day, n) => {
  const x = new Date(`${day}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
/** 0 for Monday to 6 for Sunday. */
const weekdayOf = (day) => (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
const mondayOf = (day) => addDays(day, -weekdayOf(day));
const at = (day, clock, plusMinutes = 0) => new Date(Date.parse(`${day}T${clock}:00${KIGALI_OFFSET}`) + plusMinutes * 60_000);
const monthOf = (day) => day.slice(0, 7);
const previousMonth = (month) => {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

const today = kigaliDay();
const now = new Date();

/** A small number that is the same on every run for the same words. */
function steady(text, modulo) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return Math.abs(h) % modulo;
}

// --- The API ----------------------------------------------------------------------

async function signIn(email) {
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
  if (!res.ok) {
    throw new Error(
      `${email} could not sign in with the demo code (${res.status}). This script only runs against a sample database's demo platform.`,
    );
  }
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  await fetch(`${API}/api/v1/me/two-factor/send`, { method: 'POST', headers: { cookie, ...origin } });
  await fetch(`${API}/api/v1/me/two-factor/verify`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json', ...origin },
    body: JSON.stringify({ code: OTP }),
  });
  const me = await (await fetch(`${API}/api/v1/me/workspaces`, { headers: { cookie } })).json();
  return { email, cookie, workspaces: me.workspaces ?? [] };
}

function client(session, workspaceId) {
  const call = async (method, path, body) => {
    const res = await fetch(`${API}/api/v1${path}`, {
      method,
      headers: {
        cookie: session.cookie,
        'x-workspace-id': workspaceId,
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
    return { status: res.status, ok: res.ok, body: json };
  };
  return {
    get: (path) => call('GET', path),
    post: (path, body = {}) => call('POST', path, body),
    patch: (path, body) => call('PATCH', path, body),
    put: (path, body) => call('PUT', path, body),
  };
}

/** Every row of a list route (058-list-framework), a page of 100 at a time. */
async function all(api, path, filters = []) {
  const items = [];
  for (let page = 1; page <= 20; page += 1) {
    const params = new URLSearchParams({ size: '100', page: String(page) });
    if (filters.length > 0) params.set('f', JSON.stringify(filters));
    const res = await api.get(`${path}?${params}`);
    if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${res.body?.message ?? ''}`);
    items.push(...res.body.items);
    if (res.body.items.length < 100 || items.length >= res.body.total) break;
  }
  return items;
}

const notes = [];
const say = (line) => console.log(`  ${line}`);
/** Something that did not go through, kept for the summary rather than stopping the run. */
function note(what, res) {
  const line = `${what}: ${res.status} ${res.body?.message ?? ''}`.trim();
  notes.push(line);
  say(`NOTE  ${line}`);
}

// --- One business -----------------------------------------------------------------

async function seedBusiness(business) {
  console.log(`\n${business.name}`);
  const session = await signIn(business.owner);
  const workspace = session.workspaces.find((w) => w.name === business.name || w.orgName === business.name || w.label === business.name)
    ?? session.workspaces.find((w) => w.kind === 'business' && (w.permissions ?? []).includes('people.manage'));
  if (!workspace) {
    say(`SKIP  ${business.owner} holds no workspace that manages people here.`);
    return;
  }
  const api = client(session, workspace.workspaceId);

  // The branch everybody works at: the first one the clock settings list.
  const settings = await api.get('/ops/attendance/policies');
  const branch = settings.body?.clock?.[0];
  if (!settings.ok || !branch) {
    say('SKIP  no branch to put people at.');
    return;
  }
  say(`branch: ${branch.branchName}`);

  const people = await files(api, business, branch);
  await pay(api, business, people);
  await checklists(api, business, branch);
  const shifts = await time(api, branch, people, settings.body.policies ?? []);
  await leave(api, people);
  await kiosk(api, branch);
  await attendance(api, people, shifts);
  await payRuns(api);
  await notices(api);
}

/** Positions by title, adding the ones this demo needs and the business lacks. */
async function positions(api) {
  const listed = await api.get('/ops/hr/catalog/job-positions');
  const byTitle = new Map((listed.body?.items ?? []).filter((p) => p.status === 'active').map((p) => [p.title.toLowerCase(), p.id]));
  for (const title of Object.keys(WAGE)) {
    if (byTitle.has(title.toLowerCase())) continue;
    const made = await api.post('/ops/hr/catalog/job-positions', { title });
    if (made.ok) byTitle.set(title.toLowerCase(), made.body.id);
    else note(`position ${title}`, made);
  }
  return byTitle;
}

/** A made up, well formed national ID: sixteen digits, never a real person's. */
function nationalId(business, index, person) {
  const year = person.dateOfBirth.slice(0, 4);
  return `1${year}${person.sex === 'male' ? '8' : '7'}${business.code}${String(90000 + index).padStart(5, '0')}0${String(10 + index).slice(-2)}`;
}

async function files(api, business, branch) {
  const jobs = await positions(api);
  let existing = await all(api, '/ops/employees');
  const hiredOn = (yearsAgo, name) => {
    // A first of the month, so a whole month's pay needs no arithmetic to check.
    const [y, m] = today.split('-').map(Number);
    const months = yearsAgo * 12 + 2 + steady(name, 9);
    const total = y * 12 + (m - 1) - months;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
  };

  // Seeded accounts first: their files exist and lack everything a contract needs.
  let updated = 0;
  for (const [index, file] of existing.filter((e) => e.status === 'active').entries()) {
    const job = file.jobPositionTitle ?? 'Front desk agent';
    const profile = SEEDED_BY_JOB[job] ?? SEEDED_BY_JOB['Front desk agent'];
    const body = {};
    if (!file.workPropertyId) body.workPropertyId = branch.propertyId;
    if (file.detailsMissing.includes('phone')) body.phone = `0788 5${business.code} ${String(100 + index).padStart(3, '0')}`;
    if (file.detailsMissing.includes('dateOfBirth')) body.dateOfBirth = addDays(profile.dateOfBirth, steady(file.legalName, 300));
    if (file.detailsMissing.includes('sex')) body.sex = profile.sex;
    if (file.detailsMissing.includes('idDocument')) {
      body.idDocumentType = 'national_id';
      body.idDocumentNumber = nationalId(business, index, { ...profile, dateOfBirth: body.dateOfBirth ?? profile.dateOfBirth });
    }
    if (file.view === 'full' && !file.rssbNumber) body.rssbNumber = `RSSB-DEMO-${business.code}${String(index + 1).padStart(3, '0')}`;
    if (Object.keys(body).length > 0) {
      const res = await api.patch(`/ops/employees/${file.id}`, body);
      if (res.ok) updated += 1;
      else note(`details of ${file.legalName}`, res);
    }
    // The hire date on its own: it is refused once leave has been earned from
    // it (AC-P6), and that must not take the other fields down with it.
    if (file.hiredOn >= addDays(today, -31) && !file.currentContract) {
      const res = await api.patch(`/ops/employees/${file.id}`, { hiredOn: hiredOn(profile.hiredYearsAgo, file.legalName) });
      if (!res.ok) note(`hire date of ${file.legalName}`, res);
    }
  }

  let created = 0;
  for (const [index, person] of NEW_PEOPLE.entries()) {
    if (existing.some((e) => e.legalName === person.legalName)) continue;
    const res = await api.post('/ops/employees', {
      legalName: person.legalName,
      phone: `0788 6${business.code} ${String(200 + index).padStart(3, '0')}`,
      dateOfBirth: person.dateOfBirth,
      sex: person.sex,
      idDocumentType: 'national_id',
      idDocumentNumber: nationalId(business, 50 + index, person),
      hiredOn: hiredOn(person.hiredYearsAgo, person.legalName),
      workPropertyId: branch.propertyId,
      rssbNumber: `RSSB-DEMO-${business.code}${String(51 + index).padStart(3, '0')}`,
      jobPositionId: jobs.get(person.job.toLowerCase()) ?? null,
    });
    if (res.ok) created += 1;
    else note(`file for ${person.legalName}`, res);
  }

  // Everybody answers to the general manager, who answers to nobody.
  existing = (await all(api, '/ops/employees')).filter((e) => e.status === 'active');
  const manager = existing.find((e) => e.jobPositionTitle === 'General manager');
  let reporting = 0;
  if (manager) {
    for (const file of existing) {
      if (file.id === manager.id || file.reportingManagerId) continue;
      const res = await api.patch(`/ops/employees/${file.id}`, { reportingManagerId: manager.id });
      if (res.ok) reporting += 1;
      else note(`manager of ${file.legalName}`, res);
    }
  }
  say(`files: ${created} added, ${updated} completed, ${reporting} given a manager, ${existing.length} working`);
  return (await all(api, '/ops/employees')).filter((e) => e.status === 'active');
}

async function pay(api, business, people) {
  let contracts = 0;
  let accounts = 0;
  for (const person of people) {
    if (!person.currentContract) {
      const wageRwf = WAGE[person.jobPositionTitle ?? ''] ?? 180_000;
      const res = await api.post(`/ops/employees/${person.id}/contracts`, {
        contractType: 'permanent',
        startsOn: person.hiredOn,
        wageBasis: 'monthly',
        wageRwf,
      });
      if (res.ok) contracts += 1;
      else note(`contract of ${person.legalName}`, res);
    }
    const held = await api.get(`/ops/employees/${person.id}/pay-accounts`);
    if (held.ok && (held.body?.accounts ?? []).length === 0 && person.phone) {
      const res = await api.post(`/ops/employees/${person.id}/pay-accounts`, { kind: 'momo', momoPhone: person.phone, makePrimary: true });
      if (res.ok) accounts += 1;
      else note(`pay account of ${person.legalName}`, res);
    }
  }
  const hr = await api.get('/ops/hr/settings');
  if (hr.ok && !hr.body?.rssbEmployerNumber) {
    const res = await api.patch('/ops/hr/settings', { rssbEmployerNumber: `DEMO-${business.code}-0001` });
    if (!res.ok) note('RSSB employer number', res);
  }
  say(`pay: ${contracts} contract(s), ${accounts} pay account(s)`);
}

/** The tasks most hotels do. An owner rewords them under Staff, Checklists. */
const JOINING = [
  { label: 'Sign the contract and give a copy', dueAfterDays: 0 },
  { label: 'Bring a copy of your ID and your RSSB number', byEmployee: true, dueAfterDays: 0 },
  { label: 'Issue a uniform and a name tag', dueAfterDays: 0 },
  { label: 'Walk the fire exits and the assembly point', dueAfterDays: 1 },
  { label: 'Read the house rules', byEmployee: true, dueAfterDays: 3 },
  { label: 'First month review with their manager', dueAfterDays: 30 },
];
const LEAVING = [
  { label: "Take them off next week's roster", dueAfterDays: -3 },
  { label: 'Hand back the uniform, name tag and locker key', byEmployee: true, dueAfterDays: 0 },
  { label: 'Collect master keys and any hotel phone', dueAfterDays: 0 },
  { label: 'Certificate of service handed over', dueAfterDays: 7 },
  { label: 'Final pay settled on the next run', dueAfterDays: 30 },
];
/** Who joins this week, after the lists are written, so the product starts hers itself. */
const NEW_STARTER = { legalName: 'Divine Ishimwe', sex: 'female', dateOfBirth: '2001-04-18', job: 'Room attendant', startedDaysAgo: 3 };

/**
 * The two lists, then one hire. In that order on purpose: a file created once
 * a joining list is the default starts its own checklist, which is the thing
 * to show. The people above were put on file before any list existed, as a
 * real office's long standing staff were, and have none.
 */
async function checklists(api, business, branch) {
  const listed = await api.get('/ops/hr/checklist-templates');
  if (!listed.ok) {
    note('checklists', listed);
    return;
  }
  let written = 0;
  for (const [kind, name, items] of [['onboarding', 'Joining the hotel', JOINING], ['offboarding', 'Leaving the hotel', LEAVING]]) {
    if (listed.body.templates.some((t) => t.kind === kind)) continue;
    const res = await api.post('/ops/hr/checklist-templates', { kind, name, isDefault: true, items });
    if (res.ok) written += 1;
    else note(`${name} checklist`, res);
  }

  let started = 'nobody new';
  const everyone = await all(api, '/ops/employees');
  if (!everyone.some((e) => e.legalName === NEW_STARTER.legalName)) {
    const jobs = await positions(api);
    const hiredOn = addDays(today, -NEW_STARTER.startedDaysAgo);
    const file = await api.post('/ops/employees', {
      legalName: NEW_STARTER.legalName,
      phone: `0788 7${business.code} 300`,
      dateOfBirth: NEW_STARTER.dateOfBirth,
      sex: NEW_STARTER.sex,
      idDocumentType: 'national_id',
      idDocumentNumber: nationalId(business, 80, NEW_STARTER),
      hiredOn,
      workPropertyId: branch.propertyId,
      rssbNumber: `RSSB-DEMO-${business.code}081`,
      jobPositionId: jobs.get(NEW_STARTER.job.toLowerCase()) ?? null,
    });
    if (!file.ok) note(`file for ${NEW_STARTER.legalName}`, file);
    else {
      const contract = await api.post(`/ops/employees/${file.body.id}/contracts`, {
        contractType: 'permanent',
        startsOn: hiredOn,
        wageBasis: 'monthly',
        wageRwf: WAGE[NEW_STARTER.job],
      });
      if (!contract.ok) note(`contract of ${NEW_STARTER.legalName}`, contract);
      await api.post(`/ops/employees/${file.body.id}/pay-accounts`, { kind: 'momo', momoPhone: file.body.phone, makePrimary: true });
      // Day one was done on day one; the rest of her first week is still open.
      const board = await api.get('/ops/hr/checklists');
      const hers = (board.body?.checklists ?? []).find((c) => c.employee.employeeId === file.body.id && c.kind === 'onboarding');
      for (const task of (hers?.tasks ?? []).filter((t) => !t.byEmployee && t.dueOn <= hiredOn)) {
        await api.post(`/ops/hr/checklist-tasks/${task.id}/done`);
      }
      started = hers ? `${NEW_STARTER.legalName} on hers` : `${NEW_STARTER.legalName} on file, no checklist started`;
    }
  }
  say(`checklists: ${written} list(s) written, ${started}`);
}

async function time(api, branch, people, policies) {
  const listed = await api.get('/ops/shift-templates');
  const byName = new Map((listed.body?.templates ?? listed.body?.items ?? []).filter((t) => t.propertyId === branch.propertyId).map((t) => [t.name, t]));
  const shifts = {};
  for (const shift of SHIFTS) {
    let template = byName.get(shift.name);
    if (!template) {
      const res = await api.post('/ops/shift-templates', {
        propertyId: branch.propertyId,
        name: shift.name,
        startsAt: shift.startsAt,
        endsAt: shift.endsAt,
        breakMinutes: shift.breakMinutes,
      });
      if (!res.ok) {
        note(`shift ${shift.name}`, res);
        continue;
      }
      template = res.body;
    }
    shifts[shift.key] = { ...shift, id: template.id };
  }

  if (!branch.hasCoordinates || branch.geofenceRadiusM !== 200) {
    const res = await api.put(`/ops/attendance/clock-settings/${branch.propertyId}`, { geofenceRadiusM: 200 });
    if (!res.ok) note('geofence', res);
  }

  // The built in policy has no grace: a minute late is late, and a minute
  // before the end is leaving early. An office sets ten minutes of each on day
  // one, and a week of attendance reads true only with them. Before the clock
  // ins below: a record's figures are worked out as it closes. Left alone once
  // the business has saved a policy of its own.
  const standing = policies.find((p) => p.propertyId === null);
  if (standing && !standing.saved) {
    const res = await api.put('/ops/attendance/policies', {
      propertyId: null,
      graceInMinutes: 10,
      graceOutMinutes: 10,
      overtimeCutoffMinutes: standing.overtimeCutoffMinutes,
      overtimeAutoApprove: standing.overtimeAutoApprove,
      overtimeMinMinutes: standing.overtimeMinMinutes,
      linkWindowMinutes: standing.linkWindowMinutes,
      staleOpenHours: standing.staleOpenHours,
      defaultShiftMinutes: standing.defaultShiftMinutes,
      compensationThresholdMinutes: standing.compensationThresholdMinutes,
    });
    if (!res.ok) note('attendance policy', res);
  }

  // Last week, this week and next: the past for the attendance sheet to stand
  // on, the weeks ahead for people to read on their phones.
  const firstMonday = addDays(mondayOf(today), -7);
  const turn = new Map();
  let rostered = 0;
  for (const person of people) {
    const rows = PATTERN[person.jobPositionTitle ?? ''];
    if (!rows) continue;
    const taken = turn.get(person.jobPositionTitle) ?? 0;
    turn.set(person.jobPositionTitle, taken + 1);
    const row = rows[taken % rows.length];
    for (let d = 0; d < 21; d += 1) {
      const day = addDays(firstMonday, d);
      const shift = shifts[row[weekdayOf(day)]];
      if (!shift || day < person.hiredOn) continue;
      const res = await api.post('/ops/roster', { employeeId: person.id, shiftTemplateId: shift.id, workDate: day });
      if (res.ok) rostered += 1;
      // 409: already rostered then, or on approved leave. Both are a rerun.
      else if (res.status !== 409) note(`shift for ${person.legalName} on ${day}`, res);
    }
  }
  let published = 0;
  for (let w = 0; w < 3; w += 1) {
    const from = addDays(firstMonday, w * 7);
    const res = await api.post('/ops/roster/publish', { propertyId: branch.propertyId, from, to: addDays(from, 6) });
    if (res.ok) published += res.body?.entryCount ?? 0;
    else if (res.status !== 409 && res.status !== 422) note(`publish the week of ${from}`, res);
  }
  say(`time: ${Object.keys(shifts).length} shift(s), ${rostered} roster entr${rostered === 1 ? 'y' : 'ies'} written, ${published} published`);
  return shifts;
}

/**
 * A kiosk at the door and a PIN for everybody on file. The kiosk is left
 * waiting for its tablet: pairing trades a code for a cookie on one device,
 * which only somebody holding that device can do.
 */
async function kiosk(api, branch) {
  const listed = await api.get('/ops/attendance/kiosks');
  let added = 'already there';
  if (listed.ok && !(listed.body?.kiosks ?? []).some((k) => k.status !== 'revoked')) {
    const res = await api.post('/ops/attendance/kiosks', { propertyId: branch.propertyId, name: 'Staff entrance' });
    if (res.ok) added = 'Staff entrance added, waiting for its tablet';
    else note('kiosk', res);
  }
  let pins = 0;
  for (const person of (await all(api, '/ops/employees')).filter((e) => e.status === 'active')) {
    const state = await api.get(`/ops/employees/${person.id}/kiosk-pin`);
    if (!state.ok || state.body?.hasPin) continue;
    const res = await api.put(`/ops/employees/${person.id}/kiosk-pin`, { pin: DEMO_PIN });
    if (res.ok) pins += 1;
    else note(`PIN of ${person.legalName}`, res);
  }
  say(`kiosk: ${added}; ${pins} PIN(s) set${pins > 0 ? ` (everybody's is ${DEMO_PIN})` : ''}`);
}

async function leave(api, people) {
  const waiting = await all(api, '/ops/leave/requests');
  if (waiting.length > 0) {
    say(`leave: ${waiting.length} request(s) already there, left as they are`);
    return;
  }
  const byJob = (job, nth = 0) => people.filter((p) => p.jobPositionTitle === job)[nth];
  const typesOf = async (person) => (await api.get(`/ops/employees/${person.id}/leave-balances`)).body?.balances ?? [];
  const nextMonday = addDays(mondayOf(today), 7);
  const asks = [
    // Approved: three days next week. Approving takes them off those shifts.
    { who: byJob('Room attendant', 1) ?? byJob('Room attendant'), code: 'annual', from: addDays(nextMonday, 1), to: addDays(nextMonday, 3), reason: 'Family wedding in Musanze', decide: 'approve' },
    // Waiting: the one HR finds on its desk.
    { who: byJob('Line cook'), code: 'annual', from: addDays(nextMonday, 8), to: addDays(nextMonday, 9), reason: 'Moving house', decide: null },
    { who: byJob('Waiter'), code: 'annual', from: addDays(nextMonday, 4), to: addDays(nextMonday, 4), reason: 'Exam at the university', decide: null },
    // Refused, with the reason on record.
    { who: byJob('Front desk agent', 1) ?? byJob('Front desk agent'), code: 'unpaid', from: addDays(nextMonday, 5), to: addDays(nextMonday, 6), reason: 'A trip', decide: 'reject', note: 'A full house that weekend. Ask again for the week after.' },
  ];
  let filed = 0;
  for (const ask of asks) {
    if (!ask.who) continue;
    const type = (await typesOf(ask.who)).find((b) => b.leaveType.code === ask.code)?.leaveType;
    if (!type) continue;
    const res = await api.post('/ops/leave/requests', { employeeId: ask.who.id, leaveTypeId: type.id, startsOn: ask.from, endsOn: ask.to, reason: ask.reason });
    if (!res.ok) {
      note(`leave for ${ask.who.legalName}`, res);
      continue;
    }
    filed += 1;
    if (ask.decide) {
      const decided = await api.post(`/ops/leave/requests/${res.body.id}/${ask.decide}`, ask.note ? { note: ask.note } : {});
      if (!decided.ok) note(`${ask.decide} leave for ${ask.who.legalName}`, decided);
    }
  }
  say(`leave: ${filed} request(s) filed`);
}

/**
 * A week of the sheet: everybody rostered clocks in and out, a few of them a
 * little late, and whoever is on shift right now is in and not yet out. The
 * API takes a clock time up to seven days back, so that is how far this goes.
 */
async function attendance(api, people, shifts) {
  const byId = new Map(Object.values(shifts).map((s) => [s.id, s]));
  const entries = (await all(api, '/ops/roster', [['workDate', 'gte', addDays(today, -6)], ['workDate', 'lte', today]]))
    .filter((e) => e.status !== 'cancelled');
  const names = new Map(people.map((p) => [p.id, p.legalName]));
  // A day somebody already has a record for is left alone: the API would take
  // a second clock in on it, as it must for a split shift, and a rerun would
  // double the week.
  const recorded = new Set(
    (await all(api, '/ops/attendance', [['workDate', 'gte', addDays(today, -7)], ['workDate', 'lte', today]])).map(
      (r) => `${r.employee.employeeId}:${r.workDate}`,
    ),
  );
  let closed = 0;
  let open = 0;
  for (const entry of entries.sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const shift = byId.get(entry.shiftTemplate?.id ?? entry.shiftTemplateId);
    const start = new Date(entry.startsAt);
    const end = new Date(entry.endsAt);
    if (!shift || start > now) continue;
    const key = `${entry.employee.employeeId}:${entry.workDate}`;
    if (recorded.has(key)) continue;
    // One in seven arrives late, by up to 25 minutes; the rest a few minutes early.
    const late = steady(key, 7) === 0;
    const clockIn = new Date(start.getTime() + (late ? 11 + steady(key, 15) : -steady(key, 9)) * 60_000);
    // Today, one person on shift has not clocked in: the row a manager chases.
    if (entry.workDate === today && steady(`${key}:absent`, 6) === 0) continue;
    if (clockIn > now) continue;
    const inRes = await api.post('/ops/attendance/clock-in', { employeeId: entry.employee.employeeId, at: clockIn.toISOString(), rosterEntryId: entry.id });
    if (!inRes.ok) {
      // 409: already clocked in then. 422: older than the seven days allowed.
      if (inRes.status !== 409 && inRes.status !== 422) note(`clock in for ${names.get(entry.employee.employeeId)} on ${entry.workDate}`, inRes);
      continue;
    }
    if (end > now) {
      open += 1;
      continue;
    }
    // Every minute past a shift's end is overtime for a supervisor to decide
    // (058-time AC-TM8), so most people leave inside the grace before it, and
    // one in nine stays on about an hour: the queue holds those, not the week.
    const clockOut = new Date(end.getTime() + (steady(`${key}:out`, 9) === 0 ? 55 + steady(key, 30) : -steady(`${key}:out`, 7)) * 60_000);
    const outRes = await api.post(`/ops/attendance/${inRes.body.id}/clock-out`, { at: (clockOut > now ? now : clockOut).toISOString() });
    if (outRes.ok) closed += 1;
    else note(`clock out for ${names.get(entry.employee.employeeId)} on ${entry.workDate}`, outRes);
  }
  say(`attendance: ${closed} day(s) worked and closed, ${open} at work now`);
}

async function payRuns(api) {
  const last = previousMonth(monthOf(today));
  const runs = await all(api, '/ops/pay-runs');
  const lines = [];
  if (!runs.some((r) => r.period === last)) {
    const run = await api.post('/ops/pay-runs', { period: last });
    if (!run.ok) note(`the ${last} pay run`, run);
    else {
      const confirmed = await api.post(`/ops/pay-runs/${run.body.run.id}/confirm`, {});
      if (confirmed.ok) lines.push(`${last} confirmed, ${run.body.payslips.length} payslip(s)`);
      else {
        const blockers = (confirmed.body?.blockers ?? []).map((b) => b.message).slice(0, 3).join(' ');
        note(`confirm ${last}${blockers ? ` (${blockers})` : ''}`, confirmed);
        lines.push(`${last} left in draft`);
      }
    }
  }
  if (!(await all(api, '/ops/pay-runs')).some((r) => r.period === monthOf(today))) {
    const run = await api.post('/ops/pay-runs', { period: monthOf(today) });
    if (run.ok) lines.push(`${monthOf(today)} in draft, ${run.body.payslips.length} payslip(s)`);
    else note(`the ${monthOf(today)} pay run`, run);
  }
  say(`pay runs: ${lines.length > 0 ? lines.join('; ') : 'already there'}`);
}

async function notices(api) {
  const done = [];
  const holidays = await api.get('/ops/hr/holidays');
  const staffDay = `${Number(today.slice(0, 4)) + (today.slice(5) > '12-12' ? 1 : 0)}-12-12`;
  if (holidays.ok && !(holidays.body?.holidays ?? []).some((h) => h.name === 'Staff day')) {
    const res = await api.post('/ops/hr/holidays', { name: 'Staff day', fromDate: staffDay, toDate: staffDay, recurringYearly: true });
    if (res.ok) done.push('a holiday');
    else note('holiday', res);
  }
  const policies = await api.get('/ops/policies');
  if (policies.ok && !(policies.body?.policies ?? []).some((p) => p.title === 'Uniform and name badge')) {
    const res = await api.post('/ops/policies', {
      title: 'Uniform and name badge',
      body: 'Wear the uniform issued to you, clean and pressed, with your name badge on the left, from the moment you clock in. Housekeeping issues a second set on request. Tell your manager the same day if a uniform is damaged.',
      audience: 'all',
    });
    if (res.ok) done.push('a policy');
    else note('policy', res);
  }
  const announcements = await api.get('/ops/staff-announcements');
  if (announcements.ok && !(announcements.body?.announcements ?? []).some((a) => a.title === 'Fire drill on Thursday at 10:00')) {
    const res = await api.post('/ops/staff-announcements', {
      title: 'Fire drill on Thursday at 10:00',
      body: 'The alarm will sound at 10:00. Leave by the nearest stairs and meet at the car park. Guests have been told at check in. It takes fifteen minutes.',
      audience: 'all',
      expiresOn: addDays(today, 10),
      commentsAllowed: true,
    });
    if (res.ok) done.push('an announcement');
    else note('announcement', res);
  }
  say(`the rest: ${done.length > 0 ? done.join(', ') : 'already there'}`);
}

// --- Run --------------------------------------------------------------------------

console.log(`An HR demo through ${API}, today ${today} (Kigali). Every person and figure is invented.`);
const only = process.argv.slice(2);
for (const business of BUSINESSES) {
  if (only.length > 0 && !only.some((word) => business.name.toLowerCase().includes(word.toLowerCase()))) continue;
  await seedBusiness(business);
}
console.log(notes.length === 0 ? '\nDone.' : `\nDone, with ${notes.length} step(s) that did not go through (marked NOTE above).`);
