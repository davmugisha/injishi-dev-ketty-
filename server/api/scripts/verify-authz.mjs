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
  can,
  isOperational,
  permissionsForWorkspace,
  violatesSeparationOfDuties,
  districtScopeOf,
  scopeCoversDistrict,
} from '@injishi/contracts';

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
    console.log('\n=== The four org roles, from @injishi/contracts alone ===');
    const forRole = (role) =>
      permissionsForWorkspace({ kind: 'business', orgRole: role, registrationStatus: 'active' });
    check('owner holds all 26', forRole('owner').length, 26);
    check('manager holds 25', forRole('manager').length, 25);
    check('receptionist holds 9', forRole('receptionist').length, 9);
    check('housekeeper holds 2', forRole('housekeeper').length, 2);

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
      ['host@injishi.com', 'owner', 26, 'hospitality'],
      ['manager@injishi.com', 'manager', 25, 'hospitality'],
      ['reception@injishi.com', 'receptionist', 9, 'hospitality'],
      ['housekeeper@injishi.com', 'housekeeper', 2, 'hospitality'],
      ['landlord@injishi.com', 'owner', 26, 'residence'],
      ['resident-manager@injishi.com', 'manager', 25, 'residence'],
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
      // The whole rule: the role is held, the powers are not.
      check('the owner role is held', pending.orgRole, 'owner');
      check('and it resolves to ZERO permissions', pending.permissions.length, 0);
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
    check('with a manager permission set', dualBiz?.permissions.length ?? 0, 25);
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
    check('owner has all 26', owner.permissions.length, 26);
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
