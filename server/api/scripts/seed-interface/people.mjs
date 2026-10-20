/**
 * people.*: the HR workforce of the interface world (People home, Employees, Roster, Attendance,
 * Leave), as the ADR-058 tables and the real-data additions (`interface-people.ts`) hold it.
 *
 *   - one file per person the people fixtures name (38), at Amahoro Hospitality Ltd or, for the
 *     residence's staff, Amahoro Residences Ltd; files of people with an account are linked to
 *     their membership, and Diane Ingabire (HR) is given an `hr` membership at the residences
 *     business too, because the prototype's HR officer keeps both employers' files;
 *   - teams inside the USALI departments, contracts (a pay change is a new contract), allowances
 *     as fixed pay components in a pay structure, pay accounts, kiosk PINs;
 *   - shift templates, rotations, two weeks of roster from today, minimum cover, swap requests;
 *   - today's and yesterday's clock records, correction requests;
 *   - leave types, this year's requests with their two-step decisions and ledger rows.
 *
 * THE DAY. The prototype's story day (Monday 12 October) is TODAY, so "this week" on the roster is
 * the seven days from today and "next week" the seven after; dates move with `shiftDate`/`day` like
 * every interface seed. Clock times are the story's (06:00 to 08:00 this morning), so the board
 * reads as a morning in progress once the seed runs after about 08:00 Kigali.
 *
 * VALUES THE RULES REFUSE. Employee statuses `leave`, `leaving` and `probation` are not file states
 * (`hr_employee_status` is active/offboarded): the screens derive them from approved leave, a file
 * offboarded with a last day still ahead, and a probation end on the current contract. A missed
 * clock-out yesterday is a record the attendance sweep closed (`auto_closed`, unvalidated), because
 * a person holds one open record at a time. Accruals, year ends and expiries of leave are not
 * written here: the API writes them on the first balance read, from each type's rules, exactly as
 * the daily job would.
 */
import { createHmac, randomBytes, scryptSync } from 'node:crypto';

import { day, iid, kigaliAt, parseFixtureDate, shiftDate, TODAY, userId } from './lib.mjs';
import { ORG, PROPERTY, WORKSPACE } from './world.mjs';

const ORGS = [ORG.hotel, ORG.residences];
const BY_ORG = { column: 'org_id', values: ORGS };

/** Employees by fixture id: which persona's account the file belongs to. */
const ACCOUNT = {
  dm: 'owner', au: 'manager', gu: 'finance', di: 'hr', pn: 'store', eh: 'frontdesk', bm: 'supervisor',
  jn: 'housekeeper', jp: 'technician', cm: 'waiter', jh: 'outlet', su: 'residence',
};
const FEMALE = new Set(['au', 'gu', 'di', 'am', 'du', 'vu', 'jm', 'en', 'cu', 'lu', 'gm', 'yu', 'ci', 'ey', 'rm', 'jn', 'bm', 'od', 'cm', 'su']);

/** Teams: code, name, branch, USALI category, lead (fixture employee id), order. */
const TEAMS = [
  { code: 'mg', name: 'Management', property: 'isangano', category: 'admin_general', lead: 'dm', sort: 0 },
  { code: 'fo', name: 'Front office', property: 'isangano', category: 'rooms', lead: 'eh', sort: 1 },
  { code: 'hk', name: 'Housekeeping', property: 'isangano', category: 'rooms', lead: 'bm', sort: 2 },
  { code: 'fb', name: 'Food and beverage', property: 'isangano', category: 'fnb', lead: 'jh', sort: 3 },
  { code: 'mt', name: 'Maintenance', property: 'isangano', category: 'engineering', lead: 'jp', sort: 4 },
  { code: 'sc', name: 'Security', property: 'isangano', category: 'admin_general', lead: 'ek', sort: 5 },
  { code: 'st', name: 'Stores', property: 'isangano', category: 'admin_general', lead: null, sort: 6 },
  { code: 'lo', name: 'Lodge operations', property: 'ishyamba', category: 'rooms', lead: 'th', sort: 7 },
  { code: 'lk', name: 'Lodge kitchen', property: 'ishyamba', category: 'fnb', lead: 'th', sort: 8 },
  { code: 'rs', name: 'Residence services', property: 'kacyiru', category: 'rooms', lead: 'su', sort: 9 },
];
/** The directory's department name → team code. The kitchen brigade works inside Food and beverage. */
const TEAM_OF_DEPT = {
  Management: 'mg', 'Front office': 'fo', Housekeeping: 'hk', 'Food and beverage': 'fb', Kitchen: 'fb',
  Maintenance: 'mt', Security: 'sc', Stores: 'st', 'Lodge operations': 'lo', 'Lodge kitchen': 'lk',
  'Residence services': 'rs',
};

/** Shift templates per branch, by key: [name, starts, ends]. */
const TEMPLATES = {
  isangano: {
    M: ['Morning', '07:00', '15:00'], E: ['Evening', '15:00', '23:00'], N: ['Night', '23:00', '07:00'],
    day: ['Day', '06:00', '18:00'], early: ['Early', '06:00', '14:00'], kitchen: ['Kitchen early', '06:30', '14:30'],
  },
  ishyamba: {
    M: ['Morning', '07:00', '15:00'], early: ['Early', '06:00', '14:00'], lodge: ['Lodge day', '06:30', '15:30'],
    E: ['Evening', '14:00', '22:00'],
  },
  kacyiru: { office: ['Office day', '08:00', '17:00'] },
};
const orgOfProperty = (p) => (p === 'kacyiru' ? ORG.residences : ORG.hotel);
const workspaceOfProperty = (p) => (p === 'kacyiru' ? WORKSPACE.residences : WORKSPACE.hotel);
const templateId = (property, key) => iid('shift-template', `${property}:${key}`);

/** "06:00–14:00" → the template of that branch with those times. */
function templateByTimes(property, shift) {
  const [from, to] = shift.split('–');
  const found = Object.entries(TEMPLATES[property]).find(([, [, s, e]]) => s === from && e === to);
  if (!found) throw new Error(`no ${property} shift template runs ${shift}`);
  return found[0];
}

/** A shift on a Kigali day as two instants; an end at or before the start runs past midnight. */
function shiftInstants(date, starts, ends) {
  const start = new Date(`${date}T${starts}:00+02:00`);
  let end = new Date(`${date}T${ends}:00+02:00`);
  if (end <= start) end = new Date(end.getTime() + 86_400_000);
  return { start, end };
}

/** Whole calendar days between two ISO dates, inclusive. */
function eachDay(from, to) {
  const out = [];
  for (let d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const addMonths = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const last = new Date(Date.UTC(Math.floor(total / 12), (total % 12) + 1, 0)).getUTCDate();
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
};
/** ISO weekday, Monday 0. */
const weekdayOf = (iso) => (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;
/** A fixture date ("4 Mar 2024", "20 Oct") on the seed's calendar. */
const story = (text) => shiftDate(parseFixtureDate(text));

/** Upsert rows by id: every column but the id and `created_at` is rewritten, so a re-run converges. */
async function upsert(c, table, rows, { conflict = '(id)', keepCreated = true } = {}) {
  if (rows.length === 0) return [];
  const cols = Object.keys(rows[0]);
  const ids = [];
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const params = [];
    const values = chunk
      .map((r) => `(${cols.map((col) => { params.push(r[col]); return `$${params.length}`; }).join(', ')})`)
      .join(', ');
    const set = cols
      .filter((col) => col !== 'id' && !(keepCreated && col === 'created_at'))
      .map((col) => `${col} = EXCLUDED.${col}`)
      .join(', ');
    const { rows: out } = await c.query(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES ${values}
       ON CONFLICT ${conflict} DO ${set ? `UPDATE SET ${set}` : 'NOTHING'} RETURNING id`,
      params,
    );
    ids.push(...out.map((r) => r.id));
  }
  return ids;
}

/** HMAC with the pepper, then scrypt with a salt of its own: `pin-hash.ts`'s format, so the kiosk accepts it. */
function hashPin(pin, pepper) {
  const salt = randomBytes(16);
  const key = scryptSync(createHmac('sha256', pepper).update(pin, 'utf8').digest(), salt, 32, { N: 16384, r: 8, p: 1 });
  return ['scrypt', 16384, 8, 1, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function seed({ c, fx, log, keep }) {
  const people = fx('people.employees');
  const byName = new Map(people.map((p) => [p.name, p]));
  const empId = (fixtureId) => {
    const p = people.find((x) => x.id === fixtureId);
    if (!p) throw new Error(`people.employees has no "${fixtureId}"`);
    return iid('employee', `${orgOfProperty(p.property) === ORG.residences ? 'residences' : 'hospitality'}:${p.id}`);
  };
  const idByName = (name) => {
    const p = byName.get(name);
    if (!p) throw new Error(`no employee file for "${name}"`);
    return empId(p.id);
  };
  const owner = userId('owner');
  const hr = userId('hr');

  // --- Diane keeps both employers' files: an hr membership at the residences business. ---------
  await c.query(
    `INSERT INTO org_memberships (id, org_id, user_id, org_role)
     SELECT $1, $2, $3, 'hr' WHERE NOT EXISTS (
       SELECT 1 FROM org_memberships WHERE org_id = $2 AND user_id = $3 AND status = 'active')
     ON CONFLICT (id) DO UPDATE SET status = 'active', org_role = 'hr'`,
    [iid('membership', `${ORG.residences}:hr`), ORG.residences, hr],
  );
  const memberships = new Map();
  for (const [fixtureId, persona] of Object.entries(ACCOUNT)) {
    const p = people.find((x) => x.id === fixtureId);
    const { rows } = await c.query(
      `SELECT id FROM org_memberships WHERE org_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
      [orgOfProperty(p.property), userId(persona)],
    );
    if (rows[0]) memberships.set(fixtureId, rows[0].id);
  }

  // --- Departments the teams sit in (seeded by property-departments.mjs, one per category). -----
  const { rows: deptRows } = await c.query(
    `SELECT id, property_id, department_category FROM departments WHERE property_id = ANY($1::uuid[])`,
    [Object.values(PROPERTY)],
  );
  const departmentOf = (property, category) =>
    deptRows.find((d) => d.property_id === PROPERTY[property] && d.department_category === category)?.id ?? null;

  // --- Job positions. ----------------------------------------------------------------------------
  const positions = new Map();
  for (const p of people) {
    const org = orgOfProperty(p.property);
    const key = `${org}:${p.position.toLowerCase()}`;
    if (!positions.has(key)) positions.set(key, { id: iid('job-position', key), org_id: org, title: p.position });
  }
  const positionIds = await upsert(
    c,
    'job_positions',
    [...positions.values()].map((x) => ({ ...x, status: 'active' })),
  );
  keep('job_positions', positionIds, BY_ORG);

  // --- Files. Pre-neutralise rows a demo day or a flow left behind, so the upserts below cannot
  // collide with them on the one-active and no-overlap rules (convergence removes them afterwards).
  await c.query(
    `UPDATE employment_contracts SET status = 'ended', ends_on = coalesce(ends_on, starts_on)
      WHERE org_id = ANY($1::uuid[]) AND status = 'active' AND id::text NOT LIKE '1e000000-%'`,
    [ORGS],
  );
  await c.query(
    `UPDATE roster_entries SET status = 'cancelled', cancel_reason = 'Reset by the interface seed'
      WHERE org_id = ANY($1::uuid[]) AND status = 'scheduled' AND id::text NOT LIKE '1e000000-%'`,
    [ORGS],
  );
  await c.query(
    `UPDATE attendance_records SET status = 'superseded'
      WHERE org_id = ANY($1::uuid[]) AND status = 'open' AND id::text NOT LIKE '1e000000-%'`,
    [ORGS],
  );
  await c.query(
    `UPDATE leave_requests SET status = 'cancelled'
      WHERE org_id = ANY($1::uuid[]) AND status IN ('requested', 'approved') AND id::text NOT LIKE '1e000000-%'`,
    [ORGS],
  );

  const today = TODAY;
  const lastDayOf = (p) => (p.status === 'leaving' ? story(p.contractShort.replace(/^Last day /, '')) : null);
  const employeeRows = people.map((p, i) => {
    const n = p.no.replace(/\D/g, '');
    const hired = story(p.since);
    const leavingOn = lastDayOf(p);
    return {
      id: empId(p.id),
      org_id: orgOfProperty(p.property),
      org_membership_id: memberships.get(p.id) ?? null,
      employee_number: p.no,
      legal_name: p.name,
      preferred_name: null,
      // Demo numbers in the +250 788 1xx xxx block: unique per person, never a real line.
      phone: `+250788${String(100000 + Number(n)).slice(-6)}`,
      // An account holder's file carries the account's email (read from users below); the rest have none.
      email: null,
      date_of_birth: `${1972 + ((Number(n) * 7) % 30)}-${String(1 + (i % 12)).padStart(2, '0')}-${String(3 + (i % 25)).padStart(2, '0')}`,
      sex: FEMALE.has(p.id) ? 'female' : 'male',
      id_document_type: 'national_id',
      id_document_number: `11990800${n.padStart(4, '0')}0000`,
      rssb_number: `999${n.padStart(5, '0')}`,
      work_property_id: PROPERTY[p.property],
      job_position_id: positions.get(`${orgOfProperty(p.property)}:${p.position.toLowerCase()}`).id,
      reporting_manager_id: null,
      hired_on: hired,
      service_from: hired,
      status: leavingOn ? 'offboarded' : 'active',
      offboarded_on: leavingOn,
      offboard_reason: leavingOn ? `Resigned on ${story('20 Sep')}; last day ${leavingOn}` : null,
      grade: p.grade,
    };
  });
  // Account holders' emails are the persona addresses (didier@, aline@, …).
  for (const row of employeeRows) {
    const fixtureId = people.find((p) => empId(p.id) === row.id).id;
    const persona = ACCOUNT[fixtureId];
    if (persona) {
      const { rows } = await c.query('SELECT email FROM users WHERE id = $1', [userId(persona)]);
      row.email = rows[0]?.email ?? row.email;
    }
  }
  const employeeIds = await upsert(c, 'employees', employeeRows);
  // Reporting lines, once every file exists. A line never crosses businesses (assertManager), so the
  // residence manager reports to nobody on file: the residences business is hers to run.
  for (const p of people) {
    const name = p.manager.split(',')[0].trim();
    const manager = byName.get(name);
    const sameOrg = manager && orgOfProperty(manager.property) === orgOfProperty(p.property);
    await c.query('UPDATE employees SET reporting_manager_id = $2 WHERE id = $1', [
      empId(p.id),
      sameOrg ? empId(manager.id) : null,
    ]);
  }
  keep('employees', employeeIds, BY_ORG);

  // --- Teams and who is in them. -----------------------------------------------------------------
  const teamId = (code) => iid('hr-team', code);
  const teamIds = await upsert(
    c,
    'hr_teams',
    TEAMS.map((t) => ({
      id: teamId(t.code),
      org_id: orgOfProperty(t.property),
      property_id: PROPERTY[t.property],
      department_id: departmentOf(t.property, t.category),
      code: t.code,
      name: t.name,
      lead_employee_id: t.lead ? empId(t.lead) : null,
      sort_order: t.sort,
      status: 'active',
    })),
  );
  keep('hr_teams', teamIds, BY_ORG);
  const teamOfPerson = (p) => {
    const code = TEAM_OF_DEPT[p.dept];
    if (!code) throw new Error(`no team for department "${p.dept}"`);
    return TEAMS.find((t) => t.code === code);
  };
  const memberIds = await upsert(
    c,
    'hr_team_members',
    people.map((p) => ({
      id: iid('hr-team-member', p.id),
      org_id: orgOfProperty(p.property),
      team_id: teamId(teamOfPerson(p).code),
      employee_id: empId(p.id),
      status: 'active',
    })),
  );
  keep('hr_team_members', memberIds, BY_ORG);

  // The HR roster boards route by (department_members), with the lead as the department's supervisor.
  // A leaver's rows went at offboarding, so the leaver has none.
  const deptMembers = [];
  for (const p of people.filter((x) => x.status !== 'leaving')) {
    const team = teamOfPerson(p);
    const departmentId = departmentOf(team.property, team.category);
    if (!departmentId) continue;
    const persona = ACCOUNT[p.id];
    deptMembers.push({
      id: iid('department-member', p.id),
      department_id: departmentId,
      org_membership_id: memberships.get(p.id) ?? null,
      user_id: persona && memberships.get(p.id) ? userId(persona) : null,
      employee_id: empId(p.id),
      workspace_id: workspaceOfProperty(team.property),
      department_position: team.lead === p.id ? 'supervisor' : 'staff',
      job_titles: JSON.stringify([p.position]),
      is_primary: true,
      status: 'active',
    });
  }
  // Another module may already route an account to the same department (department_members_active_uk):
  // that row stands, and this one is skipped; a row of ours from an earlier run is brought back to the seed.
  for (const row of deptMembers) {
    const cols = Object.keys(row);
    await c.query(
      `INSERT INTO department_members (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})
       ON CONFLICT DO NOTHING`,
      cols.map((col) => row[col]),
    );
    await c.query(
      `UPDATE department_members SET department_id = $2, department_position = $3, status = 'active', employee_id = $4
        WHERE id = $1`,
      [row.id, row.department_id, row.department_position, row.employee_id],
    );
  }
  const { rows: existingDm } = await c.query(
    'SELECT id FROM department_members WHERE id = ANY($1::uuid[])',
    [deptMembers.map((r) => r.id)],
  );
  keep('department_members', existingDm.map((r) => r.id), {
    column: 'workspace_id',
    values: [WORKSPACE.hotel, WORKSPACE.residences],
  });

  // --- Allowances: a fixed component per amount, carried by a pay structure of the same name. ---
  const allowanceAmounts = new Set();
  for (const ch of fx('people.compensation')) allowanceAmounts.add(ch.allowance);
  const componentRows = [];
  const structureRows = [];
  const links = [];
  for (const org of ORGS) {
    for (const amount of [...allowanceAmounts].sort((a, b) => a - b)) {
      const key = `${org}:${amount}`;
      componentRows.push({
        id: iid('pay-component', key),
        org_id: org,
        code: `allowance_${amount}`,
        name: `Transport and housing allowance (RWF ${amount.toLocaleString('en-US')})`,
        kind: 'allowance',
        taxable: true,
        in_contribution_base: false,
        before_tax: false,
        amount_type: 'fixed',
        amount_rwf: amount,
        applies_all_active: false,
        status: 'active',
        created_by_user_id: owner,
      });
      structureRows.push({ id: iid('pay-structure', key), org_id: org, name: `Allowance band RWF ${amount.toLocaleString('en-US')}`, status: 'active' });
      links.push([org, iid('pay-structure', key), iid('pay-component', key)]);
    }
  }
  keep('pay_components', await upsert(c, 'pay_components', componentRows), BY_ORG);
  keep('pay_structures', await upsert(c, 'pay_structures', structureRows), BY_ORG);
  for (const [org, structure, component] of links) {
    await c.query(
      `INSERT INTO pay_structure_components (org_id, structure_id, component_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [org, structure, component],
    );
  }

  // --- Contracts: each pay change is a contract; the one before it ends the day before. ----------
  const changes = fx('people.compensation');
  const contractRows = [];
  for (const p of people) {
    const mine = changes
      .filter((ch) => ch.employeeId === p.id)
      .map((ch) => ({ ...ch, startsOn: story(ch.effective) }))
      .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
    const fixedTerm = p.contract === 'Fixed-term';
    const termEnd = fixedTerm ? story(p.contractShort.replace(/^Ends /, '')) : null;
    const leavingOn = lastDayOf(p);
    const probationText = p.contractDates.match(/probation (?:ended|to) (\d{1,2} [A-Z][a-z]{2} \d{4})/)?.[1];
    mine.forEach((ch, i) => {
      const next = mine[i + 1];
      const isLast = !next;
      const endsOn = next ? addDays(next.startsOn, -1) : (leavingOn ?? termEnd);
      const org = orgOfProperty(p.property);
      const approved = ch.approvedBy.match(/, (\d{1,2} [A-Z][a-z]{2}(?: \d{4})?)$/)?.[1];
      const approvedOn = approved ? story(approved) : addDays(ch.startsOn, -7);
      const isHire = ch.reason === 'Hire';
      contractRows.push({
        id: iid('contract', ch.id),
        org_id: org,
        employee_id: empId(p.id),
        contract_type: fixedTerm ? 'fixed_term' : 'permanent',
        starts_on: ch.startsOn,
        ends_on: endsOn,
        wage_basis: 'monthly',
        // Fixture wages are whole francs already (the hire offer was rounded to the thousand).
        wage_rwf: Math.round(ch.base),
        status: isLast ? (ch.startsOn > today ? 'scheduled' : 'active') : 'ended',
        end_reason: isLast && leavingOn ? 'Resigned' : !isLast ? `Replaced by the ${next.reason.toLowerCase()} contract` : null,
        pay_structure_id: iid('pay-structure', `${org}:${ch.allowance}`),
        notice_days: 30,
        created_by_user_id: owner,
        probation_ends_on: isHire ? (probationText ? story(probationText) : addMonths(ch.startsOn, 3)) : null,
        change_reason: ch.reason,
        created_at: new Date(`${approvedOn}T09:00:00+02:00`),
      });
    });
  }
  const contractIds = await upsert(c, 'employment_contracts', contractRows, { keepCreated: false });
  keep('employment_contracts', contractIds, BY_ORG);

  // --- Pay accounts: "MTN MoMo ···412" → a MoMo number ending 412; a bank account ending 7781. ----
  const accountRows = people.map((p) => {
    const m = p.payMethod.match(/^(.*?) ···(\d+)$/);
    if (!m) throw new Error(`${p.name}: unreadable pay method "${p.payMethod}"`);
    const [, provider, last] = m;
    const momo = /MoMo|Airtel/.test(provider);
    const prefix = provider.startsWith('Airtel') ? '73' : '78';
    return {
      id: iid('pay-account', p.id),
      org_id: orgOfProperty(p.property),
      employee_id: empId(p.id),
      kind: momo ? 'momo' : 'bank',
      bank_name: momo ? null : provider,
      account_number: momo ? null : `00040${String(p.no.replace(/\D/g, '')).padStart(4, '0')}${last}`,
      branch_name: momo ? null : 'Gisenyi',
      momo_phone: momo ? `+250${prefix}${String(9000 + Number(p.no.replace(/\D/g, ''))).slice(-4)}${last.padStart(3, '0')}` : null,
      is_primary: true,
      status: 'active',
      created_by_user_id: hr,
    };
  });
  keep('employee_pay_accounts', await upsert(c, 'employee_pay_accounts', accountRows), BY_ORG);

  // --- Kiosk PINs (the last four digits of the employee number): everybody but the two people who
  // still clock in at the desk because theirs was never issued (Fabrice, Yvonne).
  const pepper = process.env.HR_PIN_PEPPER?.trim() || 'dev-only-insecure-pin-pepper';
  for (const p of people.filter((x) => !['fn', 'yu'].includes(x.id))) {
    await c.query(
      `INSERT INTO employee_kiosk_pins (employee_id, org_id, pin_hash, set_by_user_id, set_at)
       VALUES ($1, $2, $3, $4, now()) ON CONFLICT (employee_id) DO NOTHING`,
      [empId(p.id), orgOfProperty(p.property), hashPin(p.no.slice(-4), pepper), hr],
    );
  }

  // --- The attendance policy: a 5 minute grace, for both businesses. ----------------------------
  const policyIds = [];
  for (const org of ORGS) {
    const { rows } = await c.query(
      `INSERT INTO attendance_policies (id, org_id, property_id, grace_in_minutes, grace_out_minutes)
       VALUES ($1, $2, NULL, 5, 5)
       ON CONFLICT ON CONSTRAINT attendance_policies_scope_uk DO UPDATE SET grace_in_minutes = 5, grace_out_minutes = 5
       RETURNING id`,
      [iid('attendance-policy', org), org],
    );
    policyIds.push(rows[0].id);
  }
  keep('attendance_policies', policyIds, BY_ORG);

  // --- Shift templates. -------------------------------------------------------------------------
  const templateRows = [];
  for (const [property, set] of Object.entries(TEMPLATES)) {
    for (const [key, [name, starts, ends]] of Object.entries(set)) {
      templateRows.push({
        id: templateId(property, key),
        org_id: orgOfProperty(property),
        property_id: PROPERTY[property],
        department_id: null,
        name,
        starts_at: starts,
        ends_at: ends,
        break_minutes: 0,
        status: 'active',
      });
    }
  }
  keep('shift_templates', await upsert(c, 'shift_templates', templateRows), BY_ORG);

  // --- Rotations at Isangano: seven steps that advance every day, starting today. --------------
  const ROTATIONS = {
    A: ['Weekends off', 'MMMMMOO'],
    B: ['Wednesday and Thursday off', 'MMOOMMM'],
    C: ['Monday and Tuesday off', 'OOMMMMM'],
    D: ['Friday and Saturday off', 'MMMMOOM'],
    E: ['Evening turndown, Thursday and Friday off', 'EEEOOMM'],
    N1: ['Nights, Thursday and Friday off', 'NNNOONN'],
    N2: ['Nights, Sunday to Tuesday off', 'OONNNNO'],
  };
  const patternRows = Object.entries(ROTATIONS).map(([code, [name, steps]]) => ({
    id: iid('rotation-pattern', code),
    org_id: ORG.hotel,
    property_id: PROPERTY.isangano,
    name: `Rotation ${code} · ${name}`,
    steps: JSON.stringify(steps.split('').map((s) => (s === 'O' ? 'off' : templateId('isangano', s)))),
    rule: 'every_n_days',
    rule_value: 1,
    status: 'active',
    created_by_user_id: hr,
  }));
  keep('rotation_patterns', await upsert(c, 'rotation_patterns', patternRows), BY_ORG);
  const rosterStaff = fx('people.rosterStaff');
  const assignmentRows = rosterStaff.map((s) => ({
    id: iid('rotation-assignment', s.id),
    org_id: ORG.hotel,
    employee_id: idByName(s.name),
    pattern_id: iid('rotation-pattern', s.rotation),
    starts_on: day(0),
    ends_on: null,
    start_step: 0,
    created_by_user_id: hr,
  }));
  keep('rotation_assignments', await upsert(c, 'rotation_assignments', assignmentRows), BY_ORG);

  // --- Swap requests the colleagues already agreed to (the roster's panel). --------------------
  const swaps = fx('people.shiftSwaps');
  const staffName = (id) => rosterStaff.find((s) => s.id === id)?.name;
  const swapRows = swaps.map((w) => {
    const a = byName.get(staffName(w.a));
    const lead = TEAMS.find((t) => t.code === teamOfPerson(a).code)?.lead;
    return {
      id: iid('shift-request', w.id),
      org_id: ORG.hotel,
      employee_id: idByName(staffName(w.a)),
      kind: 'swap',
      shift_template_id: null,
      swap_employee_id: idByName(staffName(w.b)),
      from_date: day(w.day),
      to_date: day(w.day),
      reason: w.detail,
      status: 'requested',
      colleague_accepted_at: kigaliAt('20:15', -2),
      colleague_accepted_by_user_id: null,
      routed_to_employee_id: lead ? empId(lead) : null,
      requested_by_user_id: ACCOUNT[a.id] ? userId(ACCOUNT[a.id]) : hr,
      decided_by_user_id: null,
      decided_at: null,
      decision_note: null,
      created_at: kigaliAt('19:40', -2),
    };
  });
  keep('shift_requests', await upsert(c, 'shift_requests', swapRows), BY_ORG);

  // --- The roster. -------------------------------------------------------------------------------
  const publishedAt = kigaliAt('16:40', -4);
  const entries = [];
  const addEntry = (employeeKey, property, key, date, { published = true } = {}) => {
    const [, starts, ends] = TEMPLATES[property][key];
    const { start, end } = shiftInstants(date, starts, ends);
    entries.push({
      id: iid('roster', `${employeeKey}:${date}`),
      org_id: orgOfProperty(property),
      employee_id: employeeKey,
      shift_template_id: templateId(property, key),
      property_id: PROPERTY[property],
      department_id: null,
      work_date: date,
      starts_at: start,
      ends_at: end,
      status: 'scheduled',
      cancel_reason: null,
      created_by_user_id: hr,
      published_at: published ? publishedAt : null,
      rotation_assignment_id: null,
      shift_request_id: null,
    });
  };
  // Today's shifts as the attendance board has them (Emmanuel and Aimable work the 12-hour Day).
  const records = fx('people.clockRecords');
  const todays = new Map();
  for (const r of records.filter((x) => x.day === 'today')) {
    const p = byName.get(r.name);
    todays.set(p.id, templateByTimes(p.property, r.shift));
  }
  // The weekly grid of the roster branch: this week is published, next week is a draft.
  const weeks = fx('people.rosterWeeks');
  const lentKeys = new Set(weeks.flatMap((w) => w.lent.map((k) => `${w.id}:${k}`)));
  for (const s of rosterStaff) {
    const p = byName.get(s.name);
    for (const [w, offset] of [['this', 0], ['next', 7]]) {
      s.shifts[w].split('').forEach((code, i) => {
        if (code === 'O' || code === 'L') return;
        const date = day(offset + i);
        if (lentKeys.has(`${w}:${s.id}-${i}`)) {
          addEntry(empId(p.id), 'ishyamba', 'M', date, { published: w === 'this' });
          return;
        }
        const key = offset === 0 && i === 0 && todays.has(p.id) ? todays.get(p.id) : code;
        addEntry(empId(p.id), 'isangano', key, date, { published: w === 'this' });
      });
    }
  }
  const onGrid = new Set(rosterStaff.map((s) => byName.get(s.name).id));
  for (const [fixtureId, key] of todays) {
    if (onGrid.has(fixtureId)) continue;
    addEntry(empId(fixtureId), people.find((x) => x.id === fixtureId).property, key, day(0));
  }
  // (Damascene is among them: rostered this morning, and never came in.)
  // The lodge kitchen's evenings this week: Celestin is on leave from day 2 to day 4.
  for (const i of [1, 2, 3, 4, 5, 6]) addEntry(empId('rm'), 'ishyamba', 'E', day(i));
  for (const i of [1, 5]) addEntry(empId('cn'), 'ishyamba', 'E', day(i));
  // Yesterday's shifts behind yesterday's records, and Claudine's three days ago (the declined correction).
  for (const r of records.filter((x) => x.day === 'yesterday')) {
    const p = byName.get(r.name);
    addEntry(empId(p.id), p.property, templateByTimes(p.property, r.shift), day(-1));
  }
  addEntry(empId('cm'), 'isangano', 'M', day(-3));
  const entryIds = await upsert(c, 'roster_entries', entries);
  keep('roster_entries', entryIds, BY_ORG);
  const entryOf = (employeeKey, date) => entries.find((e) => e.employee_id === employeeKey && e.work_date === date);

  // Each branch's week from today was published four days ago.
  const publications = ['isangano', 'ishyamba', 'kacyiru'].map((property) => ({
    id: iid('roster-publication', property),
    org_id: orgOfProperty(property),
    property_id: PROPERTY[property],
    department_id: null,
    from_date: day(0),
    to_date: day(6),
    entry_count: entries.filter((e) => e.property_id === PROPERTY[property] && e.work_date >= day(0) && e.work_date <= day(6)).length,
    published_by_user_id: hr,
    published_at: publishedAt,
  }));
  keep('roster_publications', await upsert(c, 'roster_publications', publications), BY_ORG);

  // --- Clock records. ----------------------------------------------------------------------------
  const SOURCE = { kiosk: 'kiosk', phone: 'phone', desk: 'supervisor' };
  const recordRows = [];
  const minutes = (a, b) => Math.round((b.getTime() - a.getTime()) / 60_000);
  for (const r of records.filter((x) => x.source)) {
    const p = byName.get(r.name);
    const offset = r.day === 'today' ? 0 : -1;
    const date = day(offset);
    const entry = entryOf(empId(p.id), date);
    const clockIn = kigaliAt(r.clockIn, offset);
    const out = r.clockOut.match(/^(\d{2}:\d{2})/)?.[1];
    const missed = r.status === 'Missed clock-out';
    const clockOut = out ? kigaliAt(out, offset) : missed ? new Date(clockIn.getTime() + 480 * 60_000) : null;
    const late = entry ? Math.max(0, minutes(entry.starts_at, clockIn)) : null;
    const desk = r.source === 'desk';
    recordRows.push({
      id: iid('attendance', `${p.id}:${date}`),
      org_id: orgOfProperty(p.property),
      employee_id: empId(p.id),
      roster_entry_id: entry?.id ?? null,
      work_date: date,
      clock_in_at: clockIn,
      clock_out_at: clockOut,
      source: SOURCE[r.source],
      recorded_by_user_id: desk ? userId('outlet') : ACCOUNT[p.id] ? userId(ACCOUNT[p.id]) : null,
      validated: !missed,
      validated_by_user_id: desk ? userId('outlet') : null,
      // Yesterday's missed clock-outs were closed by the sweep at the default shift length.
      status: clockOut ? 'closed' : 'open',
      supersedes_id: null,
      note: desk || /offline/i.test(r.sourceNote) ? r.sourceNote : null,
      in_distance_m: r.source === 'phone' ? (/offline/i.test(r.sourceNote) ? 85 : 40) : null,
      in_accuracy_m: r.source === 'phone' ? 12 : null,
      late_minutes: clockOut ? late : null,
      early_minutes: clockOut ? 0 : null,
      worked_minutes: clockOut ? minutes(clockIn, clockOut) : null,
      overtime_minutes: clockOut ? 0 : null,
      approved_overtime_minutes: null,
      day_kind: clockOut ? 'weekday' : null,
      auto_closed: missed,
    });
  }
  // Claudine, three days ago: in at 07:18 for 07:00, the record her declined correction was about.
  {
    const date = day(-3);
    recordRows.push({
      id: iid('attendance', `cm:${date}`),
      org_id: ORG.hotel,
      employee_id: empId('cm'),
      roster_entry_id: entryOf(empId('cm'), date).id,
      work_date: date,
      clock_in_at: kigaliAt('07:18', -3),
      clock_out_at: kigaliAt('15:02', -3),
      source: 'kiosk',
      recorded_by_user_id: userId('waiter'),
      validated: true,
      validated_by_user_id: null,
      status: 'closed',
      supersedes_id: null,
      note: null,
      in_distance_m: null,
      in_accuracy_m: null,
      late_minutes: 18,
      early_minutes: 0,
      worked_minutes: 464,
      overtime_minutes: 0,
      approved_overtime_minutes: null,
      day_kind: 'weekday',
      auto_closed: false,
    });
  }
  const recordIds = await upsert(c, 'attendance_records', recordRows);
  keep('attendance_records', recordIds, BY_ORG);
  const recordOf = (fixtureId, offset) => iid('attendance', `${fixtureId}:${day(offset)}`);

  // --- Correction requests: asked by the employee (or for them), confirmed by their manager. ----
  const corrections = fx('people.corrections');
  const CORRECTION = {
    c1: { who: 'jp', offset: -1, inAt: '07:02', outAt: '15:20', askedAt: ['18:20', -1], manager: ['manager', '19:02', -1] },
    c2: { who: 'am', offset: -1, inAt: '14:58', outAt: '23:10', askedAt: ['23:30', -1], manager: ['frontdesk', '07:10', 0] },
    c3: { who: 'cm', offset: -3, inAt: '07:00', outAt: '15:02', askedAt: ['16:30', -3], manager: ['outlet', '11:00', -2] },
  };
  const requestRows = corrections.map((cr) => {
    const k = CORRECTION[cr.id];
    if (!k) throw new Error(`people.corrections ${cr.id}: no story`);
    const p = people.find((x) => x.id === k.who);
    const managerName = p.manager.split(',')[0].trim();
    const declined = cr.state === 'declined';
    return {
      id: iid('attendance-request', cr.id),
      org_id: ORG.hotel,
      employee_id: empId(p.id),
      work_date: day(k.offset),
      clock_in_at: kigaliAt(k.inAt, k.offset),
      clock_out_at: kigaliAt(k.outAt, k.offset),
      record_id: recordOf(p.id, k.offset),
      reason: cr.reason,
      status: declined ? 'rejected' : 'requested',
      routed_to_employee_id: byName.has(managerName) ? idByName(managerName) : null,
      requested_by_user_id: ACCOUNT[p.id] ? userId(ACCOUNT[p.id]) : userId(k.manager[0]),
      decided_by_user_id: declined ? hr : null,
      decided_at: declined ? kigaliAt('10:12', -2) : null,
      decision_note: declined ? 'The kiosk log shows a first attempt at 07:16, so 07:16 stands.' : null,
      result_record_id: null,
      evidence: cr.evidence,
      manager_confirmed_by_user_id: userId(k.manager[0]),
      manager_confirmed_at: kigaliAt(k.manager[1], k.manager[2]),
      created_at: kigaliAt(k.askedAt[0], k.askedAt[1]),
    };
  });
  keep('attendance_requests', await upsert(c, 'attendance_requests', requestRows, { keepCreated: false }), BY_ORG);

  // --- Leave types: the business's six, from the national defaults, unverified but unpaid leave. -
  const TYPE_RULES = {
    annual: { yearly: 18, accrual: 'monthly', carry: 'carry_with_expiry', carryMax: 6, carryMonths: 3, steps: 2, statutory: true, encashable: true },
    sick: { yearly: 30, accrual: 'yearly_upfront', steps: 2, statutory: true, past: true },
    maternity: { yearly: 84, accrual: 'yearly_upfront', steps: 1, statutory: true, weeklyOffs: true, holidays: true, sex: 'female' },
    paternity: { yearly: 4, accrual: 'yearly_upfront', steps: 2, statutory: true, sex: 'male' },
    circumstantial: { yearly: null, accrual: 'none', steps: 2, statutory: true, attachment: true },
    unpaid: { yearly: null, accrual: 'none', steps: 2, payment: 'unpaid' },
  };
  const typeRows = [];
  for (const org of ORGS) {
    for (const t of fx('people.leaveTypes')) {
      const r = TYPE_RULES[t.id];
      if (!r) throw new Error(`people.leaveTypes ${t.id}: no rules`);
      typeRows.push({
        id: iid('leave-type', `${org}:${t.id}`),
        org_id: org,
        code: t.id,
        name: t.name,
        yearly_entitlement_days: r.yearly,
        accrual: r.accrual,
        carry_forward_max_days: r.carryMax ?? 0,
        payment: r.payment ?? 'paid',
        payment_percent: null,
        reset: 'yearly',
        carry: r.carry ?? 'none',
        carry_expires_months: r.carryMonths ?? null,
        approval_steps: r.steps,
        needs_attachment: r.attachment ?? false,
        counts_weekly_offs: r.weeklyOffs ?? false,
        counts_holidays: r.holidays ?? false,
        eligible_sex: r.sex ?? null,
        min_service_months: 0,
        once_per_employment: false,
        statutory: r.statutory ?? false,
        allows_past_requests: r.past ?? false,
        encashable: r.encashable ?? false,
        compensatory: false,
        // The business's own policy the owner signed off; the statutory values await the payroll expert.
        verified_at: t.verified ? new Date(`${day(-30)}T10:00:00+02:00`) : null,
        verified_by_user_id: t.verified ? owner : null,
        status: 'active',
      });
    }
  }
  keep('leave_types', await upsert(c, 'leave_types', typeRows), BY_ORG);
  const typeId = (p, code) => iid('leave-type', `${orgOfProperty(p.property)}:${code}`);

  // --- Leave requests: the seven on the screens, Yvonne's on the calendar, and this year's history.
  const STORY = {
    l1: { who: 'jn', type: 'annual', from: 14, to: 16, days: 3, state: 'hr', asked: -3, lm: ['supervisor', -2, 'Cover arranged with Josiane'] },
    l2: { who: 'vu', type: 'annual', from: 5, to: 5, days: 1, state: 'hr', asked: -1, lm: ['supervisor', -1, 'Family event, she asked early'] },
    l3: { who: 'jp', type: 'sick', from: -3, to: -2, days: 2, state: 'hr', asked: -2, lm: ['manager', -2, null], attachment: 'medical-certificate' },
    l4: { who: 'fm', type: 'circumstantial', from: 21, to: 24, days: 4, state: 'lm', asked: -1, reason: 'own wedding', attachment: 'civil-marriage-notice' },
    l5: { who: 'cn', type: 'annual', from: 2, to: 4, days: 3, state: 'approved', asked: -11, lm: ['manager', -10, null], hr: [-9, null] },
    l6: { who: 'od', type: 'sick', from: 0, to: 1, days: 2, state: 'approved', asked: 0, by: 'supervisor', reason: 'Called in sick at 06:40, certificate to follow', lm: ['supervisor', 0, 'Recorded on her behalf'], hr: [0, null] },
    l7: { who: 'cm', type: 'annual', from: 18, to: 18, days: 1, state: 'lmdeclined', asked: -6, lm: ['outlet', -5, 'Kivu Hall conference that day'] },
    'cal-yvonne': { who: 'yu', type: 'annual', from: 9, to: 10, days: 2, state: 'approved', asked: -61, lm: ['outlet', -60, null], hr: [-59, null] },
  };
  // Earlier this year, decided long ago: what the balances' "taken" and "sick days used" count.
  const HISTORY = [
    ['h-jn-annual', 'jn', 'annual', '2026-06-08', '2026-06-12', 5, 'supervisor'],
    ['h-jn-sick', 'jn', 'sick', '2026-02-17', '2026-02-18', 2, 'supervisor'],
    ['h-vu-annual-1', 'vu', 'annual', '2026-04-13', '2026-04-16', 4, 'supervisor'],
    ['h-vu-annual-2', 'vu', 'annual', '2026-08-03', '2026-08-05', 2.5, 'supervisor'],
    ['h-vu-sick', 'vu', 'sick', '2026-03-10', '2026-03-10', 1, 'supervisor'],
    ['h-bm-annual', 'bm', 'annual', '2026-05-04', '2026-05-15', 10, 'manager'],
    ['h-cm-annual', 'cm', 'annual', '2026-07-06', '2026-07-15', 8, 'outlet'],
    ['h-cm-sick', 'cm', 'sick', '2026-01-19', '2026-01-21', 3, 'outlet'],
    ['h-jp-annual', 'jp', 'annual', '2026-08-03', '2026-08-18', 12, 'manager'],
    ['h-cn-annual', 'cn', 'annual', '2026-05-18', '2026-05-25', 6, 'manager'],
  ];
  const leaveRows = [];
  const approvalRows = [];
  const ledgerRows = [];
  const lineManagerOf = (p) => {
    const name = p.manager.split(',')[0].trim();
    return byName.has(name) && orgOfProperty(byName.get(name).property) === orgOfProperty(p.property) ? idByName(name) : null;
  };
  /** One taken row per calendar month the leave falls in, days shared by calendar day. */
  const takenRows = (key, p, code, from, to, days, decider) => {
    const all = eachDay(from, to);
    const months = new Map();
    for (const d of all) months.set(d.slice(0, 7), [...(months.get(d.slice(0, 7)) ?? []), d]);
    let left = days;
    [...months.values()].forEach((dates, i, arr) => {
      const share = i === arr.length - 1 ? left : Math.round((days * dates.length * 10) / all.length) / 10;
      left = Math.round((left - share) * 10) / 10;
      ledgerRows.push({
        id: iid('leave-ledger', `${key}:${i}`),
        org_id: orgOfProperty(p.property),
        employee_id: empId(p.id),
        leave_type_id: typeId(p, code),
        kind: 'taken',
        days: -share,
        effective_on: dates[0],
        period_key: null,
        leave_request_id: iid('leave-request', key),
        reverses_id: null,
        reason: null,
        expires_on: null,
        lot_id: null,
        allocation_request_id: null,
        created_by_user_id: decider,
      });
    });
  };
  for (const req of fx('people.leaveRequests').concat(fx('people.leaveCalendar'))) {
    const k = STORY[req.id];
    if (!k) throw new Error(`leave ${req.id}: no story`);
    const p = people.find((x) => x.id === k.who);
    const steps = TYPE_RULES[k.type].steps;
    const approved = k.state === 'approved';
    const lmDeclined = k.state === 'lmdeclined';
    const decidedAt = approved ? kigaliAt(k.id === 'l6' ? '07:20' : '11:00', k.hr[0]) : lmDeclined ? kigaliAt('16:00', k.lm[1]) : null;
    leaveRows.push({
      id: iid('leave-request', req.id),
      org_id: orgOfProperty(p.property),
      employee_id: empId(p.id),
      leave_type_id: typeId(p, k.type),
      starts_on: day(k.from),
      ends_on: day(k.to),
      start_half: 'full',
      end_half: 'full',
      days: k.days,
      reason: k.reason ?? null,
      status: approved ? 'approved' : lmDeclined ? 'rejected' : 'requested',
      routed_to_employee_id: lineManagerOf(p),
      requested_by_user_id: k.by ? userId(k.by) : ACCOUNT[p.id] ? userId(ACCOUNT[p.id]) : null,
      decided_by_user_id: approved ? hr : lmDeclined ? userId(k.lm[0]) : null,
      decided_at: decidedAt,
      decision_note: lmDeclined ? k.lm[2] : null,
      attachment_key: k.attachment ? `hr/demo/${k.attachment}.pdf` : null,
      current_step: k.state === 'hr' ? 2 : 1,
      approval_steps: steps,
      payment: k.type === 'unpaid' ? 'unpaid' : 'paid',
      payment_percent: null,
      created_at: kigaliAt('17:30', k.asked),
    });
    if (k.lm) {
      approvalRows.push({
        id: iid('leave-approval', `${req.id}:1`),
        org_id: orgOfProperty(p.property),
        request_id: iid('leave-request', req.id),
        step: 1,
        decision: lmDeclined ? 'rejected' : 'approved',
        decided_by_user_id: userId(k.lm[0]),
        note: k.lm[2],
        decided_at: kigaliAt(req.id === 'l6' ? '06:45' : '09:30', k.lm[1]),
      });
    }
    if (approved) {
      approvalRows.push({
        id: iid('leave-approval', `${req.id}:2`),
        org_id: orgOfProperty(p.property),
        request_id: iid('leave-request', req.id),
        step: 2,
        decision: 'approved',
        decided_by_user_id: hr,
        note: null,
        decided_at: decidedAt,
      });
      takenRows(req.id, p, k.type, day(k.from), day(k.to), k.days, hr);
    }
  }
  for (const [key, who, code, from, to, days, lm] of HISTORY) {
    const p = people.find((x) => x.id === who);
    const decided = new Date(`${addDays(from, -5)}T11:00:00+02:00`);
    leaveRows.push({
      id: iid('leave-request', key),
      org_id: orgOfProperty(p.property),
      employee_id: empId(p.id),
      leave_type_id: typeId(p, code),
      starts_on: from,
      ends_on: to,
      start_half: 'full',
      end_half: days % 1 ? 'first_half' : 'full',
      days,
      reason: null,
      status: 'approved',
      routed_to_employee_id: lineManagerOf(p),
      requested_by_user_id: ACCOUNT[p.id] ? userId(ACCOUNT[p.id]) : null,
      decided_by_user_id: hr,
      decided_at: decided,
      decision_note: null,
      attachment_key: null,
      current_step: 1,
      approval_steps: 2,
      payment: 'paid',
      payment_percent: null,
      created_at: new Date(`${addDays(from, -9)}T08:00:00+02:00`),
    });
    approvalRows.push(
      {
        id: iid('leave-approval', `${key}:1`), org_id: orgOfProperty(p.property), request_id: iid('leave-request', key), step: 1,
        decision: 'approved', decided_by_user_id: userId(lm), note: null, decided_at: new Date(`${addDays(from, -7)}T09:00:00+02:00`),
      },
      {
        id: iid('leave-approval', `${key}:2`), org_id: orgOfProperty(p.property), request_id: iid('leave-request', key), step: 2,
        decision: 'approved', decided_by_user_id: hr, note: null, decided_at: decided,
      },
    );
    takenRows(key, p, code, from, to, days, hr);
  }
  keep('leave_requests', await upsert(c, 'leave_requests', leaveRows, { keepCreated: false }), BY_ORG);
  keep('leave_request_approvals', await upsert(c, 'leave_request_approvals', approvalRows), BY_ORG);
  keep('leave_ledger_entries', await upsert(c, 'leave_ledger_entries', ledgerRows), BY_ORG);
  // Approved leave takes the person off their shifts in the range (Odette's this morning).
  await c.query(
    `UPDATE roster_entries r SET status = 'cancelled', cancel_reason = 'On approved leave'
       FROM leave_requests l
      WHERE l.id = ANY($1::uuid[]) AND l.status = 'approved' AND r.employee_id = l.employee_id
        AND r.work_date BETWEEN l.starts_on AND l.ends_on AND r.status = 'scheduled'`,
    [leaveRows.map((r) => r.id)],
  );

  // --- Minimum cover: the fixture's seven minimums are by story day, so today's weekday takes the first.
  const groups = fx('people.rosterGroups');
  const coverRows = groups.map((g, i) => {
    const byWeekday = new Array(7).fill(0);
    g.min.forEach((m, d) => { byWeekday[weekdayOf(day(d))] = m; });
    const setBy = (g.note.match(/^minimum set by (.+)$/) ?? [])[1];
    return {
      id: iid('roster-cover', g.id),
      org_id: ORG.hotel,
      property_id: PROPERTY.isangano,
      team_id: teamId(g.id),
      label: g.rule,
      shift_template_ids: JSON.stringify(g.shifts.map((s) => templateId('isangano', s))),
      min_by_weekday: byWeekday,
      // A note about particular days would lie once the story moves onto other weekdays.
      note: setBy ? null : 'two guards on the two busiest nights',
      set_by_employee_id: setBy && byName.has(setBy) ? idByName(setBy) : g.id === 'sc' ? empId('ek') : null,
      sort_order: i + 1,
      status: 'active',
    };
  });
  // The lodge kitchen's evenings at Ishyamba: two cooks on the third day, one on the others.
  {
    const byWeekday = new Array(7).fill(1);
    [0, 1, 2, 1, 1, 1, 1].forEach((m, d) => { byWeekday[weekdayOf(day(d))] = m; });
    coverRows.push({
      id: iid('roster-cover', 'lk'),
      org_id: ORG.hotel,
      property_id: PROPERTY.ishyamba,
      team_id: teamId('lk'),
      label: 'Evening cover',
      shift_template_ids: JSON.stringify([templateId('ishyamba', 'E')]),
      min_by_weekday: byWeekday,
      note: null,
      set_by_employee_id: empId('th'),
      sort_order: 1,
      status: 'active',
    });
  }
  keep('roster_cover_requirements', await upsert(c, 'roster_cover_requirements', coverRows), BY_ORG);

  // --- Pacifique's offboarding checklist. ------------------------------------------------------
  const leaver = people.find((p) => p.status === 'leaving');
  const lastDay = lastDayOf(leaver);
  const dm = (iso) => {
    const d = new Date(`${iso}T12:00:00Z`);
    return `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`;
  };
  const DETAIL = {
    letter: `Letter dated ${dm(story('20 Sep'))} · accepted by Joseph Habimana`,
    interview: `Scheduled for ${dm(day(4))} with Diane Ingabire · answers kept anonymous in reports`,
    settle: `Pro-rata pay to ${dm(lastDay)}, 6 untaken leave days, advance recovery RWF 35,000 · in this month's run`,
    assets: '1 of 3 back · uniforms returned; Lake Bar keys and locker key outstanding',
    access: `Owner action · Injishi access ends on ${dm(lastDay)} at 23:59 · kiosk PIN disabled at the same time`,
    cert: 'Generated from the file and signed by the owner on the last day',
  };
  const checklistRows = fx('people.offboarding').map((t, i) => ({
    id: iid('hr-checklist', `${leaver.id}:offboarding:${t.id}`),
    org_id: orgOfProperty(leaver.property),
    employee_id: empId(leaver.id),
    checklist: 'offboarding',
    code: t.id,
    title: t.title,
    detail: DETAIL[t.id] ?? t.detail,
    owner_only: t.ownerOnly,
    sort_order: i + 1,
    done_at: t.done ? kigaliAt('10:00', -20 + i) : null,
    done_by_user_id: t.done ? hr : null,
  }));
  keep('hr_checklist_items', await upsert(c, 'hr_checklist_items', checklistRows), BY_ORG);

  // --- Jeanne's family. ------------------------------------------------------------------------
  const FAMILY = {
    'jn-spouse': { relation: 'spouse', sex: 'male', dob: '1984-02-11', phone: '+250788100903', emergency: true, medical: false, share: 60 },
    'jn-kevine': { relation: 'child', sex: 'female', dob: '2017-05-14', phone: null, emergency: false, medical: true, share: 40 },
    'jn-gaelle': { relation: 'child', sex: 'female', dob: '2021-09-02', phone: null, emergency: false, medical: true, share: null },
  };
  const familyRows = fx('people.family').map((f) => {
    const k = FAMILY[f.id];
    if (!k) throw new Error(`people.family ${f.id}: no details`);
    const p = people.find((x) => x.id === f.employeeId);
    return {
      id: iid('dependant', f.id),
      org_id: orgOfProperty(p.property),
      employee_id: empId(p.id),
      name: f.name,
      relation: k.relation,
      sex: k.sex,
      date_of_birth: k.dob,
      phone: k.phone,
      is_emergency_contact: k.emergency,
      medical_dependant: k.medical,
      beneficiary_percent: k.share,
      status: 'active',
    };
  });
  keep('employee_dependants', await upsert(c, 'employee_dependants', familyRows), BY_ORG);

  // --- Documents kept on every file (requests), and Rose's food handler certificate. -----------
  const requestDocs = [];
  for (const org of ORGS) {
    for (const d of fx('people.fileDocuments')) {
      requestDocs.push({
        id: iid('document-request', `${org}:${d.id}`),
        org_id: org,
        title: d.title,
        // The prototype's "{since}" is a screen placeholder, not words a request should carry.
        description: d.meta.replace('{since}', 'at hire'),
        formats: ['pdf', 'jpg'],
        max_mb: 5,
        due_on: null,
        created_by_user_id: hr,
      });
    }
  }
  keep('document_requests', await upsert(c, 'document_requests', requestDocs), BY_ORG);
  const certificate = fx('people.expiring').find((x) => /certificate expires/.test(x.title));
  const certExpires = story(certificate.title.match(/expires (\d{1,2} [A-Z][a-z]{2})/)[1]);
  keep(
    'employee_documents',
    await upsert(c, 'employee_documents', [
      {
        id: iid('employee-document', 'rm:food-handler'),
        org_id: ORG.hotel,
        employee_id: idByName(certificate.title.split(' · ')[0]),
        request_id: null,
        title: 'Food handler certificate',
        status: 'approved',
        reject_reason: null,
        issued_on: addDays(certExpires, -365),
        expires_on: certExpires,
        remind_days_before: 30,
      },
    ]),
    BY_ORG,
  );

  log(
    `people: ${employeeRows.length} files, ${contractRows.length} contracts, ${entries.length} shifts, ` +
      `${recordRows.length} clock records, ${requestRows.length} corrections, ${leaveRows.length} leave requests, ` +
      `${ledgerRows.length} ledger rows (today ${today})`,
  );
}
