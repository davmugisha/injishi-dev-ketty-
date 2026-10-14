// Verify the six org roles over HTTP (ADR-069): `finance` and `hr` are real in
// the database and the API, a pay run is drafted by one and confirmed by
// another, and the four roles that were there before are unchanged.
//
// Every check below is a real request over a real session, and what is asserted
// is the STATUS the API answered (plus, where it matters, what came back). The
// model alone is `verify-authz.mjs`; the older enforcement matrix is
// `verify-authz-http.mjs`. This one is the two new roles and what they moved.
//
// Run against a SAMPLE database and the API that serves it:
//
//   DATABASE_URL=... VERIFY_API_URL=http://localhost:8000 \
//     node scripts/verify-ui2-roles.mjs
//
// WHAT IT WRITES, so nobody is surprised:
//
//  - Two verification members on Amahoro Hospitality Group, one `finance` and
//    one `hr`, written straight to the database because a role needs an
//    account before anything can sign in as it. Ids sit in the `069e0000-`
//    block (ADR-069, verification), outside the demo seeds' `de300000-`
//    namespace, so `/api/v1/demo/personas` never lists them and no seed reset
//    reaches them. Each name carries `(demo)` and each address is
//    `@demo.injishi.com`, as AGENTS.md § Demo asks of anything a sample
//    database holds. Idempotent: a rerun converges on the same two rows. The
//    demo personas Grace Uwera and Diane Ingabire (ADR-069 D-h) are a separate
//    seed's, and this script never touches them.
//  - One pay run for the verification period (`VERIFY_UI2_PERIOD`, default
//    2020-01), drafted by hr and CONFIRMED by the owner: a month before every
//    seeded contract, so it computes no payslip and freezes nobody's pay. A
//    rerun finds it (409 on create, 409 on recompute) and confirms it again,
//    which answers the same run. A confirm needs the business's RSSB employer
//    number; when Amahoro has none the owner sets the marked placeholder
//    `DEMO-069-VERIFY` for the confirm and clears it again in a `finally`.
//  - Two staff invitations, revoked before the script ends.
//  - Role overrides on finance and manager, each put back to what it was before
//    the script touched it, in a `finally`, so a failed run leaves the business's
//    policy as it found it.
//
// SIX SIGN-INS PER RUN (the owner, the two verification members, the manager,
// the desk and the housekeeper). The OTP send cap is five per address and
// thirty per IP per hour; `verify-authz-http.mjs` explains the ledger and how to
// clear it on a sample database.
import pg from 'pg';
import { OrgRole, permissionsForRole } from '@injishi/contracts';

import { assertSampleDatabase, describeDatabase } from './sample-database.mjs';

const API = process.env.VERIFY_API_URL || 'http://localhost:8000';
const OTP = process.env.VERIFY_OTP_CODE || '123456';
const ORIGIN = process.env.VERIFY_ORIGIN || 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL;
const PERIOD = process.env.VERIFY_UI2_PERIOD || '2020-01';

/** Amahoro Hospitality Group's business workspace (`seed-demo.mjs`, W(1)). */
const AMAHORO_WORKSPACE = 'de300000-0000-4000-8000-000000000201';
const AMAHORO_NAME = 'Amahoro Hospitality Group';

const OWNER = 'yves@demo.injishi.com';
const MANAGER = 'solange@demo.injishi.com';
const DESK = 'denise@demo.injishi.com';
const HOUSEKEEPER = 'beatha@demo.injishi.com';

/** The two verification members. Never the D-h personas. */
const FIXTURES = {
  finance: {
    id: '069e0000-0000-4000-8000-0000000000f1',
    email: 'verify-ui2-finance@demo.injishi.com',
    name: 'Verify Finance (demo)',
    role: 'finance',
  },
  hr: {
    id: '069e0000-0000-4000-8000-0000000000f2',
    email: 'verify-ui2-hr@demo.injishi.com',
    name: 'Verify HR (demo)',
    role: 'hr',
  },
};
const FINANCE = FIXTURES.finance.email;
const HR = FIXTURES.hr.email;

/** Who the owner invites. Each invitation is revoked before the script ends. */
const INVITEES = {
  finance: 'verify-ui2-invite-finance@demo.injishi.com',
  hr: 'verify-ui2-invite-hr@demo.injishi.com',
};

// --- Bookkeeping ---------------------------------------------------------------

let checks = 0;
const failed = [];
function check(label, ok, detail) {
  checks += 1;
  if (!ok) failed.push(label);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : `   ${detail}`}`);
  return ok;
}
/** One status, exactly. */
function expectStatus(label, res, status) {
  return check(`${label} -> ${status}`, res.status === status, `got ${res.status} ${res.message}`);
}
/** Admitted by the guard: anything but a refusal, and not a server error. */
function expectAdmitted(label, res) {
  return check(
    `${label} -> admitted (not 403)`,
    res.status !== 401 && res.status !== 403 && res.status < 500,
    `got ${res.status} ${res.message}`,
  );
}
const sorted = (list) => [...list].sort();
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

// --- The verification members, in the database ---------------------------------

async function ensureFixtures() {
  if (!DATABASE_URL) throw new Error('DATABASE_URL is not set.');
  const c = new pg.Client({ connectionString: DATABASE_URL });
  await c.connect();
  try {
    await assertSampleDatabase(c, 'verify-ui2-roles.mjs');
    const { rows: ws } = await c.query(
      `SELECT w.org_id, o.legal_name FROM workspaces w JOIN orgs o ON o.id = w.org_id WHERE w.id = $1`,
      [AMAHORO_WORKSPACE],
    );
    if (ws[0]?.legal_name !== AMAHORO_NAME) {
      throw new Error(`workspace ${AMAHORO_WORKSPACE} is not ${AMAHORO_NAME}; seed the sample database first.`);
    }
    const orgId = ws[0].org_id;

    for (const f of Object.values(FIXTURES)) {
      const { rows: byEmail } = await c.query('SELECT id FROM users WHERE lower(email) = lower($1)', [f.email]);
      if (byEmail[0] && byEmail[0].id !== f.id) {
        throw new Error(`${f.email} belongs to another account (${byEmail[0].id}); refusing to guess which is the fixture.`);
      }
      await c.query(
        `INSERT INTO users (id, email, email_verified, name) VALUES ($1, $2, true, $3)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [f.id, f.email, f.name],
      );
      await c.query(
        `INSERT INTO user_profiles (user_id, display_name) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name`,
        [f.id, f.name],
      );
      const { rows: guest } = await c.query(
        `SELECT 1 FROM user_roles WHERE user_id = $1 AND global_role = 'guest' AND revoked_at IS NULL LIMIT 1`,
        [f.id],
      );
      if (guest.length === 0) {
        await c.query(`INSERT INTO user_roles (user_id, global_role) VALUES ($1, 'guest')`, [f.id]);
      }
      // One active membership in the fixture's role, covering every branch.
      const { rows: member } = await c.query(
        `SELECT id, org_role FROM org_memberships
          WHERE org_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
        [orgId, f.id],
      );
      let membershipId = member[0]?.id;
      if (!membershipId) {
        const { rows } = await c.query(
          `INSERT INTO org_memberships (org_id, user_id, org_role) VALUES ($1, $2, $3) RETURNING id`,
          [orgId, f.id, f.role],
        );
        membershipId = rows[0].id;
      } else if (member[0].org_role !== f.role) {
        await c.query(`UPDATE org_memberships SET org_role = $2, updated_at = now() WHERE id = $1`, [
          membershipId,
          f.role,
        ]);
      }
      await c.query('DELETE FROM org_membership_branches WHERE org_membership_id = $1', [membershipId]);
    }
    return orgId;
  } finally {
    await c.end();
  }
}

// --- Sessions --------------------------------------------------------------------

function jar(res) {
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
}

const SESSIONS = new Map();

/** One sign-in per account per run. Throws rather than handing back no cookie. */
async function sessionFor(email) {
  if (SESSIONS.has(email)) return SESSIONS.get(email);
  const headers = { 'Content-Type': 'application/json', Origin: ORIGIN };
  const sent = await fetch(`${API}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, type: 'sign-in' }),
  });
  if (sent.status === 429) {
    throw new Error(`${email} is rate limited (429); see verify-authz-http.mjs's header for the ledger.`);
  }
  const res = await fetch(`${API}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, otp: OTP }),
  });
  const cookie = jar(res);
  if (!res.ok || !cookie) {
    throw new Error(`could not sign in ${email}: ${res.status} ${await res.text().catch(() => '')}`);
  }
  SESSIONS.set(email, cookie);
  return cookie;
}

/** A request over one account's session, in Amahoro's workspace. */
async function as(email, method, path, body) {
  const cookie = await sessionFor(email);
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: {
      cookie,
      Origin: ORIGIN,
      'x-workspace-id': AMAHORO_WORKSPACE,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  const message = json && typeof json === 'object' ? String(json.message ?? json.code ?? '') : '';
  return { status: res.status, json, message };
}
const get = (email, path) => as(email, 'GET', path);
const post = (email, path, body = {}) => as(email, 'POST', path, body);
const put = (email, path, body) => as(email, 'PUT', path, body);

/** The caller's grant at Amahoro, from the API's own answer. */
async function grantOf(email) {
  const { json } = await get(email, '/me/workspaces');
  const rows = Array.isArray(json) ? json : (json?.workspaces ?? []);
  return rows.find((w) => w.workspaceId === AMAHORO_WORKSPACE) ?? null;
}

/** The verification run's id: from the create, else from the list. */
async function findRun(email) {
  for (let page = 1; page <= 20; page += 1) {
    const { status, json } = await get(email, `/ops/pay-runs?size=100&page=${page}`);
    if (status !== 200) return null;
    const hit = (json?.items ?? []).find((r) => r.period === PERIOD);
    if (hit) return hit;
    if ((json?.items ?? []).length < 100) return null;
  }
  return null;
}

// --- The checks --------------------------------------------------------------------

async function main() {
  console.log(`\nVerifying the six org roles (ADR-069) against ${API}`);
  const platform = await (await fetch(`${API}/api/v1/platform`)).json();
  console.log(`  environment=${platform.environment} sampleData=${platform.sampleData}`);
  console.log(`  database ${describeDatabase(DATABASE_URL ?? '')}, verification period ${PERIOD}\n`);

  console.log('=== The verification members exist (idempotent, marked demo) ===');
  await ensureFixtures();
  check('a finance and an hr member on Amahoro, written to the sample database', true);

  // -------------------------------------------------------------------------------
  console.log('\n=== Each resolves to its own default set, through WorkspaceService ===');
  for (const role of ['finance', 'hr']) {
    const grant = await grantOf(FIXTURES[role].email);
    check(`${role}: holds Amahoro`, grant !== null, 'no Amahoro workspace on /me/workspaces');
    check(`${role}: as ${role}`, grant?.orgRole === role, String(grant?.orgRole));
    check(
      `${role}: exactly the seven ADR-069 D-b names`,
      same(grant?.permissions ?? [], permissionsForRole(role)),
      JSON.stringify(sorted(grant?.permissions ?? [])),
    );
  }

  // -------------------------------------------------------------------------------
  console.log('\n=== finance reads the money and nothing of people or payroll ===');
  expectStatus('finance GET /ops/folios', await get(FINANCE, '/ops/folios'), 200);
  const finRes = await get(FINANCE, '/ops/reservations');
  expectStatus('finance GET /ops/reservations (D-d: money.view)', finRes, 200);
  const booking = (finRes.json?.reservations ?? [])[0];
  if (check('Amahoro has a reservation on the desk to open', Boolean(booking?.id), 'the list is empty')) {
    expectStatus('finance GET /ops/reservations/:id (D-d)', await get(FINANCE, `/ops/reservations/${booking.id}`), 200);
    // The read widened, never the write: approve stays the desk's.
    expectStatus('finance POST /ops/reservations/:id/approve', await post(FINANCE, `/ops/reservations/${booking.id}/approve`), 403);
  }
  expectStatus('finance GET /ops/revenue', await get(FINANCE, '/ops/revenue'), 200);
  expectStatus('finance GET /ops/ebm/connection', await get(FINANCE, '/ops/ebm/connection'), 200);
  // Only the two reservation reads widened: the room plan stays the desk's.
  expectStatus('finance GET /ops/room-assignments (not widened)', await get(FINANCE, '/ops/room-assignments'), 403);
  expectStatus('finance GET /ops/employees', await get(FINANCE, '/ops/employees'), 403);
  expectStatus('finance GET /ops/pay-runs', await get(FINANCE, '/ops/pay-runs'), 403);
  const finDraft = await post(FINANCE, '/ops/pay-runs', { period: PERIOD });
  expectStatus('finance POST /ops/pay-runs', finDraft, 403);
  check('and the refusal names the draft', /draft the pay run/i.test(finDraft.message), finDraft.message);
  expectStatus('finance GET /ops/payroll/dashboard', await get(FINANCE, '/ops/payroll/dashboard'), 403);
  expectStatus('finance GET /ops/threads', await get(FINANCE, '/ops/threads'), 403);
  expectStatus('finance GET /ops/roster', await get(FINANCE, '/ops/roster'), 403);
  expectStatus('finance GET /ops/team', await get(FINANCE, '/ops/team'), 403);

  // -------------------------------------------------------------------------------
  console.log('\n=== hr reads people, drafts the pay run, and is refused its confirm and the money ===');
  expectStatus('hr GET /ops/employees', await get(HR, '/ops/employees'), 200);
  const depts = await get(HR, '/ops/departments');
  expectStatus('hr GET /ops/departments (D-d: people.view)', depts, 200);
  const dept = (depts.json?.departments ?? [])[0];
  if (check('Amahoro has a department to open', Boolean(dept?.id), 'the list is empty')) {
    expectStatus('hr GET /ops/departments/:id/members (D-d)', await get(HR, `/ops/departments/${dept.id}/members`), 200);
    // Read only: staffing a department stays team.manage's.
    expectStatus(
      'hr POST /ops/departments/:id/members',
      await post(HR, `/ops/departments/${dept.id}/members`, { userId: FIXTURES.hr.id }),
      403,
    );
  }
  expectStatus('hr GET /ops/pay-runs', await get(HR, '/ops/pay-runs'), 200);
  expectStatus('hr GET /ops/payroll/dashboard', await get(HR, '/ops/payroll/dashboard'), 200);
  expectStatus('hr GET /ops/payroll/rules', await get(HR, '/ops/payroll/rules'), 200);

  const draft = await post(HR, '/ops/pay-runs', { period: PERIOD });
  // 2xx the first time; 409 once the month has its run. Either way the guard let
  // the drafter through, which is the claim.
  expectAdmitted(`hr POST /ops/pay-runs {period: ${PERIOD}}`, draft);
  const run = draft.status >= 200 && draft.status < 300 ? draft.json?.run : await findRun(HR);
  if (check(`the verification run for ${PERIOD} exists`, Boolean(run?.id), `create answered ${draft.status} ${draft.message}`)) {
    expectAdmitted('hr POST /ops/pay-runs/:id/recompute', await post(HR, `/ops/pay-runs/${run.id}/recompute`));
    const detail = await get(HR, `/ops/pay-runs/${run.id}`);
    expectStatus('hr GET /ops/pay-runs/:id', detail, 200);
    // payroll.draft sees wages on the run and never the file's sensitive fields.
    const text = JSON.stringify(detail.json ?? {});
    check(
      'the run carries no ID number, birth date, RSSB number or pay account',
      !/"(idNumber|idDocumentNumber|dateOfBirth|rssbNumber|payAccount)"/.test(text),
      text.slice(0, 200),
    );
    const hrConfirm = await post(HR, `/ops/pay-runs/${run.id}/confirm`);
    expectStatus('hr POST /ops/pay-runs/:id/confirm', hrConfirm, 403);
    check('and the refusal names the confirm', /confirm the pay run/i.test(hrConfirm.message), hrConfirm.message);
    expectStatus('hr GET /ops/pay-runs/:id/files', await get(HR, `/ops/pay-runs/${run.id}/files`), 403);

    // AC-5: a role granted payroll.run before the split still drafts the month.
    console.log('\n=== A payroll.run grant still drafts (ADR-069 AC-5) ===');
    const before = await get(OWNER, '/ops/roles');
    const managerRow = (before.json?.roles ?? []).find((r) => r.orgRole === 'manager');
    if (check('the owner reads the manager role', Boolean(managerRow), `got ${before.status}`)) {
      const original = managerRow.permissions;
      try {
        expectStatus(
          'owner PUT /ops/roles/manager granting payroll.run',
          await put(OWNER, '/ops/roles/manager', { permissions: [...original, 'payroll.run'] }),
          200,
        );
        expectAdmitted(
          'manager POST /ops/pay-runs/:id/recompute with payroll.run',
          await post(MANAGER, `/ops/pay-runs/${run.id}/recompute`),
        );
      } finally {
        const restored = await put(OWNER, '/ops/roles/manager', { permissions: original });
        expectStatus('owner PUT /ops/roles/manager back as it was', restored, 200);
        check(
          'the manager role is exactly what it was',
          same(restored.json?.permissions ?? [], original),
          JSON.stringify(restored.json?.permissions ?? []),
        );
      }
      expectStatus('manager POST /ops/pay-runs/:id/recompute without it', await post(MANAGER, `/ops/pay-runs/${run.id}/recompute`), 403);
    }

    console.log('\n=== The owner confirms the run hr drafted (ADR-069 AC-4) ===');
    // A run cannot confirm without the business's RSSB employer number, which a
    // fresh sample database does not carry. When it is missing the owner sets a
    // marked placeholder for the confirm and puts the setting back afterwards,
    // so the business's settings end as they began. The month confirmed is the
    // verification month, with no contract in it, so nobody's pay is frozen.
    const settings = await get(OWNER, '/ops/hr/settings');
    expectStatus('owner GET /ops/hr/settings', settings, 200);
    const employerBefore = settings.json?.rssbEmployerNumber ?? null;
    try {
      if (employerBefore === null) {
        expectStatus(
          'owner PATCH /ops/hr/settings with a placeholder RSSB employer number',
          await as(OWNER, 'PATCH', '/ops/hr/settings', { rssbEmployerNumber: 'DEMO-069-VERIFY' }),
          200,
        );
      }
      const confirmed = await post(OWNER, `/ops/pay-runs/${run.id}/confirm`);
      expectStatus('owner POST /ops/pay-runs/:id/confirm', confirmed, 200);
      check('and the run is confirmed', confirmed.json?.run?.status === 'confirmed', JSON.stringify(confirmed.json?.blockers ?? confirmed.message));
    } finally {
      if (employerBefore === null) {
        expectStatus(
          'owner PATCH /ops/hr/settings back to no employer number',
          await as(OWNER, 'PATCH', '/ops/hr/settings', { rssbEmployerNumber: null }),
          200,
        );
      }
    }
    // The drafter reads what was confirmed (the figures they computed) and can
    // no longer change it.
    const after = await get(HR, `/ops/pay-runs/${run.id}`);
    expectStatus('hr GET /ops/pay-runs/:id after the confirm', after, 200);
    check('hr reads it as confirmed', after.json?.run?.status === 'confirmed', String(after.json?.run?.status));
    expectStatus('hr POST /ops/pay-runs/:id/recompute after the confirm', await post(HR, `/ops/pay-runs/${run.id}/recompute`), 409);
  }
  expectStatus('hr GET /ops/payslips', await get(HR, '/ops/payslips'), 403);
  expectStatus('hr GET /ops/folios', await get(HR, '/ops/folios'), 403);
  expectStatus('hr GET /ops/reservations', await get(HR, '/ops/reservations'), 403);
  expectStatus('hr GET /ops/revenue', await get(HR, '/ops/revenue'), 403);
  expectStatus('hr GET /ops/threads', await get(HR, '/ops/threads'), 403);
  expectStatus('hr GET /ops/team', await get(HR, '/ops/team'), 403);

  // -------------------------------------------------------------------------------
  console.log('\n=== The owner invites a finance and an hr member ===');
  for (const role of ['finance', 'hr']) {
    const sent = await post(OWNER, '/ops/team/invitations', { email: INVITEES[role], orgRole: role });
    check(`owner POST /ops/team/invitations as ${role} -> 2xx`, sent.status >= 200 && sent.status < 300, `got ${sent.status} ${sent.message}`);
    check(`and the invitation carries ${role}`, sent.json?.orgRole === role, String(sent.json?.orgRole));
    if (sent.json?.id) {
      expectStatus(`owner revokes the ${role} invitation`, await post(OWNER, `/ops/team/invitations/${sent.json.id}/revoke`), 204);
    }
  }
  expectStatus(
    'owner POST /ops/team/invitations as owner (not invitable)',
    await post(OWNER, '/ops/team/invitations', { email: INVITEES.finance, orgRole: 'owner' }),
    400,
  );

  // -------------------------------------------------------------------------------
  console.log('\n=== Roles: finance and hr are listed and customisable, owner is not (ADR-055) ===');
  const roles = await get(OWNER, '/ops/roles');
  expectStatus('owner GET /ops/roles', roles, 200);
  const listed = (roles.json?.roles ?? []).map((r) => r.orgRole);
  check('all six roles, in the model\'s order', JSON.stringify(listed) === JSON.stringify(OrgRole.options), JSON.stringify(listed));
  for (const role of ['finance', 'hr']) {
    const row = (roles.json?.roles ?? []).find((r) => r.orgRole === role);
    check(`${role} is customisable`, row?.customisable === true, JSON.stringify(row?.customisable));
    check(`${role}'s platform default is its seven`, same(row?.basePermissions ?? [], permissionsForRole(role)), JSON.stringify(row?.basePermissions));
    check(`${role} counts its verification member`, (row?.memberCount ?? 0) >= 1, String(row?.memberCount));
  }

  const financeDefault = permissionsForRole('finance');
  const financeRow = (roles.json?.roles ?? []).find((r) => r.orgRole === 'finance');
  const financeBefore = financeRow?.permissions ?? financeDefault;
  try {
    const granted = await put(OWNER, '/ops/roles/finance', { permissions: [...financeBefore, 'message.send'] });
    expectStatus('owner PUT /ops/roles/finance granting message.send', granted, 200);
    check('the role now holds it', (granted.json?.permissions ?? []).includes('message.send'), JSON.stringify(granted.json?.permissions));
    // The override reaches the grant WorkspaceGuard resolves, on the next request.
    expectStatus('finance GET /ops/threads with the override', await get(FINANCE, '/ops/threads'), 200);
  } finally {
    const back = await put(OWNER, '/ops/roles/finance', { permissions: financeBefore });
    expectStatus('owner PUT /ops/roles/finance back as it was', back, 200);
  }
  expectStatus('finance GET /ops/threads without it', await get(FINANCE, '/ops/threads'), 403);

  const locked = await put(OWNER, '/ops/roles/hr', { permissions: [...permissionsForRole('hr'), 'team.manage'] });
  expectStatus('owner PUT /ops/roles/hr granting team.manage (locked)', locked, 409);
  const ownerEdit = await put(OWNER, '/ops/roles/owner', { permissions: permissionsForRole('owner') });
  expectStatus('owner PUT /ops/roles/owner (not customisable)', ownerEdit, 409);
  expectStatus('hr PUT /ops/roles/hr (team.manage is the owner\'s)', await put(HR, '/ops/roles/hr', { permissions: permissionsForRole('hr') }), 403);

  // -------------------------------------------------------------------------------
  console.log('\n=== The desk and the housekeeper are unchanged ===');
  expectStatus('receptionist GET /ops/folios', await get(DESK, '/ops/folios'), 200);
  expectStatus('receptionist GET /ops/reservations', await get(DESK, '/ops/reservations'), 200);
  expectStatus('receptionist GET /ops/employees', await get(DESK, '/ops/employees'), 403);
  expectStatus('receptionist GET /ops/pay-runs', await get(DESK, '/ops/pay-runs'), 403);
  expectStatus('housekeeper GET /ops/housekeeping-tasks', await get(HOUSEKEEPER, '/ops/housekeeping-tasks'), 200);
  // Neither widened read reached the housekeeper, who holds neither money.view
  // nor people.view.
  expectStatus('housekeeper GET /ops/reservations', await get(HOUSEKEEPER, '/ops/reservations'), 403);
  expectStatus('housekeeper GET /ops/departments', await get(HOUSEKEEPER, '/ops/departments'), 403);

  console.log(`\nUNIFIED: ${checks} checks, ${failed.length} failed (${SESSIONS.size} sign-ins)`);
  if (failed.length > 0) {
    console.log('FAILED:');
    for (const label of failed) console.log(`  - ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log('UI2_ROLES_OK');
}

main().catch((e) => {
  console.error(`\nverify-ui2-roles: ${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
