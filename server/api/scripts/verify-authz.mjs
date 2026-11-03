// Verify the authorization MODEL against real rows.
//
// Runs the SAME resolution the API does: the two grant paths that reach a
// workspace, then @injishi/contracts to turn each into a permission set. If
// this passes, the model and the data agree. Read only; it makes no HTTP call
// and costs no OTP send. The live ENFORCEMENT matrix — does the API actually
// refuse — is `verify-authz-http.mjs` beside it.
//
// Point it at a database `seed-sample.mjs` filled (your `pnpm dev:stack`
// database, staging's, or the demo's):
//
//   DATABASE_URL=... node scripts/verify-authz.mjs
//
// TWO THINGS WERE WRONG WITH THIS SCRIPT UNTIL 2026-09-12, and both made it
// report a passing model it had not checked:
//
//   1. `listForUser` called `permissionsForWorkspace({ kind, orgRole })` and
//      never passed `registrationStatus`. That argument is required, and
//      `isOperational(undefined)` is false, so EVERY business workspace
//      resolved to an empty permission set. The owner assertion could only
//      ever have compared 0 against 21.
//   2. It asserted `owner has all 21`. There are 23: `department.manage`
//      (ADR-016) and `ebm.manage` (ADR-041) were added after it was written.
//
// It also read only the `@demo.injishi.com` roster, so the eleven `@injishi.com`
// accounts the apps are actually driven with — the ones `seed-users.mjs` seeds
// one per shape of access — were never checked at all. Both rosters are now.
import pg from 'pg';
import {
  OrgRole,
  Permission,
  can,
  canSetUpDuringReview,
  isOperational,
  permissionsForWorkspace,
  violatesSeparationOfDuties,
  districtScopeOf,
  scopeCoversDistrict,
  permissionsForRole,
} from '@injishi/contracts';

/**
 * Owner and manager are DERIVED, not typed out.
 *
 * They were literals — 26 and 25 — and adding two permissions (§6.8's
 * `refund.decide` and `offer.manage`) failed eight checks in this script while
 * the model itself was correct. "Owner holds everything" is a definition, not a
 * number: the number is whatever the contract's enum currently has in it, and
 * pinning it here just means every future permission breaks integration on a
 * count nobody meant to assert.
 *
 * Receptionist and housekeeper stay literal below, deliberately. Those two sets
 * are narrow ON PURPOSE, so a set that grew is the bug this script is for. So do
 * `finance` and `hr` (ADR-069 D-b), written out permission by permission: each
 * is a job's seven powers and nothing else, and a grown set is a leak.
 */
const OWNER_ALL = permissionsForRole('owner').length;
const MANAGER_ALL = permissionsForRole('manager').length;

/** ADR-069 D-b, exactly. Sorted, so a comparison reads the same either way round. */
// The seven ADR-069 D-b named, and since rentals blueprint 2.1 the rentals money:
// rent.record, expense.manage and tax.manage.
const FINANCE_SET = [
  'ebm.manage',
  'ebm.refund',
  'expense.manage',
  'folio.charge',
  'folio.close',
  'folio.payment',
  'money.view',
  'refund.decide',
  'rent.record',
  'tax.manage',
];
const HR_SET = [
  'attendance.approve',
  'attendance.record',
  'leave.approve',
  'payroll.draft',
  'people.manage',
  'people.view',
  'roster.manage',
];

/**
 * The bar and restaurant floor (POS spec, phase 1, `f4f91303`). Each is a
 * station's powers and nothing else, so these are written out too: a waiter
 * who can take payment, or a cashier who can read the books, is a leak.
 * `stock_controller` holds nothing until the inventory phase brings its
 * permissions; it signs in and that is all.
 */
const FLOOR_SETS = {
  cashier: ['pos.checkout', 'pos.discount', 'pos.sell', 'register.operate', 'table.manage'],
  waiter: ['pos.sell', 'table.manage'],
  bartender: ['kitchen.work', 'pos.sell', 'table.manage'],
  kitchen: ['kitchen.work'],
  stock_controller: [],
};

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

let failures = 0;
let checks = 0;
function check(label, actual, expected) {
  checks += 1;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  ${label}` +
      (ok
        ? ''
        : `\n         expected ${JSON.stringify(expected)}\n         got      ${JSON.stringify(actual)}`),
  );
}

/**
 * The two grant paths, exactly as `WorkspaceService.listForUser` does it.
 *
 * `orgs.registration_status` is selected on the SAME row as the org role, which
 * is the point: the guard resolves both from one read so the two can never come
 * from different ones. A workspace resolved without it is a workspace with no
 * registration gate.
 */
async function listForUser(c, userId) {
  const own = await c.query('SELECT id, kind FROM workspaces WHERE user_id = $1', [
    userId,
  ]);
  const viaOrg = await c.query(
    `SELECT w.id, w.kind, o.legal_name, o.domain, o.registration_status, m.org_role
       FROM org_memberships m
       JOIN orgs o ON o.id = m.org_id
       JOIN workspaces w ON w.org_id = o.id
      WHERE m.user_id = $1 AND m.status = 'active'`,
    [userId],
  );
  return [
    ...own.rows.map((w) => ({
      kind: w.kind,
      orgName: null,
      domain: null,
      orgRole: null,
      registrationStatus: null,
      permissions: permissionsForWorkspace({
        kind: w.kind,
        orgRole: null,
        registrationStatus: null,
      }),
    })),
    ...viaOrg.rows.map((w) => ({
      kind: w.kind,
      orgName: w.legal_name,
      domain: w.domain,
      orgRole: w.org_role,
      registrationStatus: w.registration_status,
      permissions: permissionsForWorkspace({
        kind: w.kind,
        orgRole: w.org_role,
        registrationStatus: w.registration_status,
      }),
    })),
  ];
}

/** `{a,b}` → `['a','b']`. Enum arrays arrive as a literal; see the caller. */
function parsePgArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  const inner = value.replace(/^\{|\}$/g, '');
  return inner === '' ? [] : inner.split(',');
}

async function byEmail(c, email) {
  const { rows } = await c.query('SELECT id FROM users WHERE lower(email) = lower($1)', [
    email,
  ]);
  if (!rows.length) throw new Error(`no such seeded user: ${email}`);
  return rows[0].id;
}

/** The business workspace of an account that holds exactly one. */
async function businessOf(c, email) {
  const all = await listForUser(c, await byEmail(c, email));
  return all.find((w) => w.kind === 'business');
}

async function main() {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    // ---------------------------------------------------------------------
    // The model itself, before any row is read. These hold on every database.
    // ---------------------------------------------------------------------
    // Six until the POS roles (`f4f91303`, 2026-10-25) appended the floor's five.
    console.log('\n=== The eleven org roles, from @injishi/contracts alone ===');
    check(
      'the roles, in the order the enum and the migration keep (ADR-069 D-a, POS phase 1)',
      OrgRole.options,
      [
        'owner',
        'manager',
        'receptionist',
        'finance',
        'hr',
        'housekeeper',
        'cashier',
        'waiter',
        'bartender',
        'kitchen',
        'stock_controller',
      ],
    );
    const forRole = (role) =>
      permissionsForWorkspace({ kind: 'business', orgRole: role, registrationStatus: 'active' });
    check(`owner holds all ${OWNER_ALL}`, forRole('owner').length, OWNER_ALL);
    check(`manager holds ${MANAGER_ALL}`, forRole('manager').length, MANAGER_ALL);
    // The definition behind the two numbers above, which is what actually
    // matters: owner is the whole enum, and manager is that minus team.manage
    // (OWNER_ONLY) and, since ADR-058, minus the HR disclosures an owner holds
    // by default and may grant (OWNER_BY_DEFAULT): the full file, and since
    // ADR-069 D-e both halves of the pay run, drafting it and confirming it.
    // Rentals blueprint 2.1 added signing a lease and choosing the payout account.
    check('owner is the whole permission enum', OWNER_ALL, Permission.options.length);
    const managerLacks = forRole('owner').filter((p) => !forRole('manager').includes(p)).sort();
    check(
      'manager is the owner minus team.manage, people.manage, payroll.draft, payroll.run, lease.sign and payout.manage',
      managerLacks,
      ['lease.sign', 'payout.manage', 'payroll.draft', 'payroll.run', 'people.manage', 'team.manage'],
    );
    // 9 until ADR-058, which gave the desk attendance.record: the desk is who is
    // at the door when the night shift arrives. 11 since ADR-072, which gave it
    // lostfound.manage: the desk takes the claim calls and does the hand-back.
    // 12 since rentals blueprint 2.1, which gave it guest.register.
    check('receptionist holds 12', forRole('receptionist').length, 12);
    check('receptionist may clock staff in (ADR-058)', can('receptionist', 'attendance.record'), true);
    check('receptionist keeps the lost and found register (ADR-072)', can('receptionist', 'lostfound.manage'), true);
    check('housekeeper holds 2', forRole('housekeeper').length, 2);

    console.log('\n=== finance and hr: a job each, and nothing beside it (ADR-069 D-b) ===');
    check('finance holds exactly its ten', [...forRole('finance')].sort(), FINANCE_SET);
    check('hr holds exactly its seven', [...forRole('hr')].sort(), HR_SET);
    // The lock on the door stays the owner's (OWNER_ONLY, LOCKED_PERMISSIONS).
    check('finance may NOT manage the team', can('finance', 'team.manage'), false);
    check('hr may NOT manage the team', can('hr', 'team.manage'), false);
    // The pay run is prepared by one person and signed by another (D-e).
    check('hr drafts the pay run', can('hr', 'payroll.draft'), true);
    check('hr may NOT confirm it', can('hr', 'payroll.run'), false);
    check(
      'finance neither drafts nor confirms it',
      [can('finance', 'payroll.draft'), can('finance', 'payroll.run')],
      [false, false],
    );
    // Each is refused the other's work, and the guest inbox, by default.
    check('finance reads no staff file', can('finance', 'people.view'), false);
    check('hr reads no money', [can('hr', 'money.view'), can('hr', 'folio.charge')], [false, false]);
    check(
      'neither replies to guests',
      [can('finance', 'message.send'), can('hr', 'message.send')],
      [false, false],
    );
    console.log('\n=== The floor: a station each, and nothing beside it (POS phase 1) ===');
    for (const [role, expected] of Object.entries(FLOOR_SETS)) {
      check(`${role} holds exactly its ${expected.length}`, [...forRole(role)].sort(), expected);
    }
    check(
      'no floor role reads money or manages the team',
      Object.keys(FLOOR_SETS).filter((r) => can(r, 'money.view') || can(r, 'team.manage')),
      [],
    );

    // The database holds the same eleven, in the same order (migrations 0063
    // and the POS roles').
    const { rows: enumRows } = await c.query(
      'SELECT unnest(enum_range(NULL::org_role))::text AS role',
    );
    check(
      'the org_role enum in this database is the same eleven, in order',
      enumRows.map((r) => r.role),
      [...OrgRole.options],
    );

    console.log('\n=== owner and manager are no longer the same role ===');
    // They were byte-identical until 2026-09-12 — `new Set(ALL)` twice — so
    // "a manager sees less" was an assertion nothing had ever checked.
    check('manager may NOT manage the team', can('manager', 'team.manage'), false);
    check('owner may manage the team', can('owner', 'team.manage'), true);
    // Deliberately still the manager's: ADR-041 D-o ratified `ebm.manage` as
    // owner-and-manager, and the Settings → Integrations door was built to
    // match. If this ever fails, the nav has a door that refuses.
    check('manager KEEPS the EBM account (ADR-041 D-o)', can('manager', 'ebm.manage'), true);

    // ---------------------------------------------------------------------
    // The @injishi.com roster: the accounts the apps are driven with.
    // ---------------------------------------------------------------------
    console.log('\n=== The driving roster: one account per shape of access ===');
    const EXPECTED = [
      ['host@injishi.com', 'owner', OWNER_ALL, 'hospitality'],
      ['manager@injishi.com', 'manager', MANAGER_ALL, 'hospitality'],
      // The same 12 as `receptionist holds 12` above; it said 11 until the
      // rentals blueprint's guest.register reached the model but not this row.
      ['reception@injishi.com', 'receptionist', 12, 'hospitality'],
      ['housekeeper@injishi.com', 'housekeeper', 2, 'hospitality'],
      ['landlord@injishi.com', 'owner', OWNER_ALL, 'residence'],
      ['resident-manager@injishi.com', 'manager', MANAGER_ALL, 'residence'],
    ];
    for (const [email, role, count, domain] of EXPECTED) {
      const w = await businessOf(c, email);
      if (!w) {
        check(`${email} holds a business workspace`, false, true);
        continue;
      }
      check(`${email.padEnd(28)} ${role} / ${domain}`, [w.orgRole, w.permissions.length, w.domain], [role, count, domain]);
    }

    console.log('\n=== The accounts that hold no business ===');
    const broker = await listForUser(c, await byEmail(c, 'broker@injishi.com'));
    check(
      'broker@ holds a broker workspace and a personal one',
      broker.map((w) => w.kind).sort(),
      ['broker', 'personal'],
    );
    const guest = await listForUser(c, await byEmail(c, 'guest@injishi.com'));
    check('guest@ holds personal only', guest.map((w) => w.kind), ['personal']);

    // ---------------------------------------------------------------------
    // The registration gate (D20, D23). Added 2026-09-12 with `pending@`.
    // ---------------------------------------------------------------------
    console.log('\n=== The registration gate: a role with none of its powers ===');
    const pending = await businessOf(c, 'pending@injishi.com');
    if (!pending) {
      check('pending@injishi.com holds a business workspace', false, true);
    } else {
      check('the business is NOT active', isOperational(pending.registrationStatus), false);
      check('its stage is submitted', pending.registrationStatus, 'submitted');
      // The whole rule: the role is held, the powers are not. Since `0c1dbfb1`
      // a business in review (`SETUP_DURING_REVIEW_STATUSES`) may build its
      // listing, so the one power it holds is `listing.manage`: no money, no
      // staff, and no publish, which still waits for `active`. This said ZERO
      // until then, and a set that grows past this one is the leak.
      check('the owner role is held', pending.orgRole, 'owner');
      check('submitted is a stage the listing may be set up in', canSetUpDuringReview(pending.registrationStatus), true);
      check('and it resolves to listing.manage ALONE', pending.permissions, ['listing.manage']);
      // Listed at every stage on purpose — the registrant opens it to watch
      // the pipeline. A gate that hid the workspace would hide the progress.
      check('the workspace is still LISTED', pending.kind, 'business');
    }

    // ---------------------------------------------------------------------
    // Both hats at once (ADR-029). Added 2026-09-12 with `dualhat@`.
    // ---------------------------------------------------------------------
    console.log('\n=== One person, an operator role AND an oversight console ===');
    const dualId = await byEmail(c, 'dualhat@injishi.com');
    const dualWs = await listForUser(c, dualId);
    const dualBiz = dualWs.find((w) => w.kind === 'business');
    check('holds a business workspace as manager', dualBiz?.orgRole ?? null, 'manager');
    check('with a manager permission set', dualBiz?.permissions.length ?? 0, MANAGER_ALL);
    const { rows: dualGrants } = await c.query(
      `SELECT oversight_role FROM oversight_assignments
        WHERE user_id = $1 AND revoked_at IS NULL`,
      [dualId],
    );
    check(
      'and an active oversight assignment at the same time',
      dualGrants.map((g) => g.oversight_role),
      ['business_approver'],
    );
    // This is the ADR-029 exposure stated as a fact rather than as a worry:
    // one session, on the operator origin, reaching both surfaces. Nothing in
    // the model refuses it — `OversightGuard` asks only whether an assignment
    // exists, never which door the session came through.
    check(
      'separation of duties still refuses self-approval',
      violatesSeparationOfDuties({ actorUserId: dualId, fieldVerifiedByUserId: dualId }),
      true,
    );

    // ---------------------------------------------------------------------
    // Platform staff.
    // ---------------------------------------------------------------------
    console.log('\n=== Platform staff is a different register from org roles ===');
    const { rows: staff } = await c.query(
      `SELECT u.email, a.staff_roles FROM admin_users a
         JOIN users u ON u.id = a.user_id
        WHERE a.revoked_at IS NULL ORDER BY u.email`,
    );
    check(
      'admin@ is the super_admin',
      // `staff_roles` is `staff_role[]`, an array of a CUSTOM enum, and
      // node-postgres ships no parser for one — it hands back the literal
      // `{super_admin}` rather than an array. Parsed here rather than
      // registered globally, because this script's only job is to read.
      parsePgArray(staff.find((s) => s.email === 'admin@injishi.com')?.staff_roles),
      ['super_admin'],
    );
    check(
      'admin@ holds NO business workspace',
      (await businessOf(c, 'admin@injishi.com')) ?? null,
      null,
    );

    // ---------------------------------------------------------------------
    // The demo roster. These were the script's original checks; they stay.
    // ---------------------------------------------------------------------
    console.log('\n=== Samuel Kayitare: one human, five seats ===');
    const his = await listForUser(c, await byEmail(c, 'samuel@demo.injishi.com'));
    // FIVE, not three. This assertion said 3 until 2026-09-12 and was simply
    // wrong: `seed-demo.mjs` prints "workspaces=2 memberships=3" and its own
    // note spells the switcher out — Personal, Kayitare Court, Broker, Kivu
    // Crest and the parked Umurage (AC-S11, AC-3). Two rows he owns, three he
    // is a member of.
    check('Samuel holds 5 workspaces', his.length, 5);
    check(
      'two he owns, three he belongs to',
      his.map((w) => w.kind).sort(),
      ['broker', 'business', 'business', 'business', 'personal'],
    );
    // He holds three different org roles at once, which is the thing this
    // persona exists to prove: a role is per workspace, never per person.
    check(
      'his three org roles, sorted',
      his.filter((w) => w.orgRole).map((w) => w.orgRole).sort(),
      ['housekeeper', 'owner', 'owner'],
    );
    check(
      'one of them is a residence business',
      his.some((w) => w.domain === 'residence'),
      true,
    );

    console.log('\n=== The receptionist is refused money, by the model ===');
    const desk = await businessOf(c, 'denise@demo.injishi.com');
    check('may check a guest in', desk.permissions.includes('stay.checkin'), true);
    check('may NOT view money', desk.permissions.includes('money.view'), false);
    check('may NOT manage the team', desk.permissions.includes('team.manage'), false);

    console.log('\n=== The housekeeper is the phone, not a trimmed desk ===');
    const hk = await businessOf(c, 'beatha@demo.injishi.com');
    check('exactly two permissions', hk.permissions.length, 2);
    check('may set room status', can('housekeeper', 'housekeeping.set'), true);
    check('may NOT check a guest in', can('housekeeper', 'stay.checkin'), false);

    console.log('\n=== The owner holds everything ===');
    const owner = await businessOf(c, 'yves@demo.injishi.com');
    check(`owner has all ${OWNER_ALL}`, owner.permissions.length, OWNER_ALL);
    check('and it is the hospitality domain', owner.domain, 'hospitality');

    console.log('\n=== Oversight: scope is a boundary ===');
    const { rows: grants } = await c.query(
      `SELECT u.email, oa.oversight_role, oa.scope_level, oa.province_id, oa.district_id
         FROM oversight_assignments oa JOIN users u ON u.id = oa.user_id
        WHERE oa.revoked_at IS NULL`,
    );
    const gasabo = (await c.query("SELECT id FROM districts WHERE name='Gasabo'")).rows[0].id;
    const karongi = (await c.query("SELECT id FROM districts WHERE name='Karongi'")).rows[0].id;

    const jb = grants.find((g) => g.email === 'jeanbosco@demo.injishi.com');
    const jbGrant = {
      scopeLevel: jb.scope_level,
      provinceId: jb.province_id,
      districtId: jb.district_id,
    };
    // The one definition of region scope (ADR-053, AC-G8). No province map is
    // needed for a district grant; an empty one proves it is not consulted.
    const jbScope = districtScopeOf([jbGrant], new Map());
    check(
      'Jean-Bosco reaches a Gasabo business',
      scopeCoversDistrict(jbScope, gasabo),
      true,
    );
    check(
      'Jean-Bosco CANNOT reach a Karongi business',
      scopeCoversDistrict(jbScope, karongi),
      false,
    );
    check(
      'the revoked officer has no active grant at all',
      grants.some((g) => g.email === 'fidele@demo.injishi.com'),
      false,
    );

    console.log('\n=== Separation of duties ===');
    const claudine = await byEmail(c, 'claudine@demo.injishi.com');
    check(
      'Claudine may not approve what she field-verified',
      violatesSeparationOfDuties({
        actorUserId: claudine,
        fieldVerifiedByUserId: claudine,
      }),
      true,
    );
    check(
      'but may approve what someone else verified',
      violatesSeparationOfDuties({
        actorUserId: claudine,
        fieldVerifiedByUserId: await byEmail(c, 'jeanbosco@demo.injishi.com'),
      }),
      false,
    );

    console.log(
      failures === 0
        ? `\nAll ${checks} authorization checks passed.\n`
        : `\n${failures} of ${checks} check(s) FAILED.\n`,
    );
    process.exitCode = failures === 0 ? 0 : 1;
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
