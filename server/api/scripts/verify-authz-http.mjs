// Verify that the API REFUSES — the enforcement half of the authorization
// model (ADR-012, ADR-035, ADR-029).
//
// `verify-authz.mjs` beside this one proves the model and the rows agree. That
// is a different claim from "the guard turns the wrong caller away", and only
// this script makes the second one: every case below is a real request over a
// real session, and what is asserted is the STATUS the API answered.
//
// The list a client is shown is an affordance. A permission set that resolves
// correctly and a route that serves it anyway is the bug this catches.
//
// Run against a database you control, with the API up:
//   VERIFY_API_URL=http://localhost:8000 node scripts/verify-authz-http.mjs
//
// ONE SIGN IN PER ACCOUNT, and that is not an optimisation. The OTP send cap is
// ten per email per hour and THIRTY PER IP PER HOUR (`OTP_MAX_PER_HOUR`,
// `OTP_MAX_PER_IP_HOUR` in `packages/auth/src/options.ts`), and locally every
// account shares one address. Signing in per case rather than per account would
// spend the machine's whole hourly budget in a single run and leave the next
// one answering 429 — which then surfaces as `400 INVALID_OTP` on the sign in
// after it, because no new code was ever issued. That reads exactly like a
// broken login and is not one.
//
// If a run does lock you out: the ledger is `auth_otp_requests`, keyed on
// `identifier` + `channel`, and on a SAMPLE database `delete from
// auth_otp_requests;` clears it. Never on a real one — it is a rate limit.
const API = process.env.VERIFY_API_URL || 'http://localhost:8000';
const OTP = process.env.VERIFY_OTP_CODE || '123456';

let failures = 0;
let checks = 0;
function check(label, ok, detail) {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `   ${detail}`}`);
}

/** Every cookie a response set, flattened into one request header. */
function jar(res) {
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
}

const SESSIONS = new Map();

/**
 * A session for this account, signed in at most once per run.
 *
 * Throws rather than returning an empty cookie, because an empty one produces
 * 401s that look like authorization failures and would be reported as such.
 */
async function sessionFor(email) {
  if (SESSIONS.has(email)) return SESSIONS.get(email);

  const sent = await fetch(`${API}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, type: 'sign-in' }),
  });
  if (sent.status === 429) {
    throw new Error(
      `${email} is rate limited (429). The OTP send cap is ten per hour per ` +
        'address and thirty per hour per IP; see this file\'s header for the ledger.',
    );
  }

  const res = await fetch(`${API}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp: OTP }),
  });
  const cookie = jar(res);
  if (!res.ok || !cookie) {
    throw new Error(
      `could not sign in ${email}: ${res.status}. A demo process issues the ` +
        'fixed code; a production one mails a random code, so set VERIFY_OTP_CODE ' +
        'or point this at a demo API (GET /api/v1/platform says which it is).',
    );
  }
  SESSIONS.set(email, cookie);
  return cookie;
}

/** A request over one account's session. Returns status plus the message. */
async function as(email, method, path, body) {
  const cookie = await sessionFor(email);
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { cookie, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let message = '';
  let json = null;
  try {
    json = await res.json();
    message = json?.message ?? json?.code ?? '';
  } catch {
    /* a body that is not json tells us nothing we need */
  }
  return { status: res.status, message: String(message), json };
}

/**
 * The workspace of a given kind this account holds, from the API's own answer.
 *
 * The id field is `workspaceId`, NOT `id` — `WorkspaceAccess` names it that in
 * `@injishi/contracts`. Reading `id` yields undefined, which reaches the guard
 * as a missing workspace and comes back "That workspace is not available to
 * you." — a refusal that looks exactly like a genuine authorization failure and
 * is not one. Normalised here so every caller gets `.id`.
 */
async function workspaceOf(email, kind) {
  const { json } = await as(email, 'GET', '/api/v1/me/workspaces');
  const rows = Array.isArray(json) ? json : (json?.workspaces ?? []);
  const found = rows.find((w) => w.kind === kind);
  if (!found) return null;
  if (!found.workspaceId) throw new Error('/me/workspaces returned no workspaceId');
  return { ...found, id: found.workspaceId };
}

async function main() {
  console.log(`\nVerifying authorization enforcement against ${API}`);

  const platform = await (await fetch(`${API}/api/v1/platform`)).json();
  console.log(
    `  environment=${platform.environment} sampleData=${platform.sampleData}\n`,
  );

  const hosp = await workspaceOf('host@injishi.com', 'business');
  const resi = await workspaceOf('landlord@injishi.com', 'business');
  if (!hosp || !resi) throw new Error('the seeded business workspaces are not there');

  // -----------------------------------------------------------------------
  console.log('=== A permission a role lacks is refused, and says why ===');
  {
    // Creating and assigning a task is a supervisor's act (`task.assign`);
    // marking one done is the cleaner's (`housekeeping.set`). A receptionist
    // holds neither.
    const r = await as('reception@injishi.com', 'POST', `/api/v1/ops/housekeeping-tasks?workspaceId=${hosp.id}`, {});
    check('receptionist cannot assign a cleaning task', r.status === 403, `got ${r.status}`);
    check('and the refusal names the capability', /assign cleaning tasks/i.test(r.message), r.message);

    // 400 is the pass here: the guard let it through and the BODY failed. A
    // 403 would mean the manager lost a power they are supposed to hold.
    const m = await as('manager@injishi.com', 'POST', `/api/v1/ops/housekeeping-tasks?workspaceId=${hosp.id}`, {});
    check('manager can (guard passes; empty body is a 400)', m.status !== 403, `got ${m.status}`);

    const h = await as('housekeeper@injishi.com', 'POST', `/api/v1/ops/stays/walk-in?workspaceId=${hosp.id}`, {});
    check('housekeeper cannot check a guest in', h.status === 403, `got ${h.status}`);

    const d = await as('reception@injishi.com', 'POST', `/api/v1/ops/stays/walk-in?workspaceId=${hosp.id}`, {});
    check('receptionist CAN check a guest in', d.status !== 403, `got ${d.status}`);
  }

  // -----------------------------------------------------------------------
  console.log('\n=== owner and manager are different roles (2026-09-12) ===');
  {
    // They were byte-identical until this change, so every assertion here is
    // new. `team.manage` moved to the owner; `ebm.manage` deliberately did
    // not (ADR-041 D-o).
    const t = await as('manager@injishi.com', 'GET', `/api/v1/ops/team?workspaceId=${hosp.id}`);
    check('manager is refused the team', t.status === 403, `got ${t.status}`);
    check('and the refusal names the team', /manage the team/i.test(t.message), t.message);

    const to = await as('host@injishi.com', 'GET', `/api/v1/ops/team?workspaceId=${hosp.id}`);
    check('owner reaches the team', to.status === 200, `got ${to.status}`);

    const e = await as('manager@injishi.com', 'GET', `/api/v1/ops/ebm/connection?workspaceId=${hosp.id}`);
    check('manager KEEPS the EBM account (ADR-041 D-o)', e.status === 200, `got ${e.status}`);

    const mv = await as('manager@injishi.com', 'GET', `/api/v1/ops/revenue?workspaceId=${hosp.id}`);
    check('manager keeps money', mv.status === 200, `got ${mv.status}`);

    const rv = await as('reception@injishi.com', 'GET', `/api/v1/ops/revenue?workspaceId=${hosp.id}`);
    check('receptionist is refused money', rv.status === 403, `got ${rv.status}`);
  }

  // -----------------------------------------------------------------------
  console.log('\n=== Another tenant is not reachable by naming its id ===');
  {
    const own = await as('host@injishi.com', 'GET', `/api/v1/ops/housekeeping-tasks?workspaceId=${hosp.id}`);
    check('host reads his own workspace', own.status === 200, `got ${own.status}`);

    const other = await as('host@injishi.com', 'GET', `/api/v1/ops/housekeeping-tasks?workspaceId=${resi.id}`);
    check('host cannot read the residence workspace', other.status === 403, `got ${other.status}`);
    check('and the refusal does not confirm it exists', /not available to you/i.test(other.message), other.message);

    const g = await as('guest@injishi.com', 'GET', `/api/v1/ops/housekeeping-tasks?workspaceId=${hosp.id}`);
    check('a guest holding no business workspace is refused', g.status === 403, `got ${g.status}`);

    const anon = await fetch(`${API}/api/v1/ops/housekeeping-tasks?workspaceId=${hosp.id}`);
    check('anonymous is 401, not 403', anon.status === 401, `got ${anon.status}`);
  }

  // -----------------------------------------------------------------------
  console.log('\n=== The registration gate refuses by STAGE, not by role ===');
  {
    const ws = await workspaceOf('pending@injishi.com', 'business');
    check('the pending business is LISTED to its owner', ws !== null, 'no business workspace returned');
    if (ws) {
      check('and it carries no permissions', (ws.permissions ?? []).length === 0, `${(ws.permissions ?? []).length}`);

      const w = await as('pending@injishi.com', 'POST', `/api/v1/ops/housekeeping-tasks?workspaceId=${ws.id}`, {});
      check('a guarded write is refused', w.status === 403, `got ${w.status}`);
      // The wording is the whole point. "Your role cannot..." would be a lie:
      // the owner role IS held. What is missing is an approved business.
      check(
        'the refusal names the registration stage, not the role',
        !/your role cannot/i.test(w.message),
        w.message,
      );

      // Reads too (platform audit, H1). Every operator read declares who may
      // make it, and an empty permission set holds none of the candidates. It
      // used to answer 200 here, which is what let a registrant read every list.
      for (const path of ['/ops/rooms', '/ops/reservations', '/ops/revenue', '/ops/threads']) {
        const r = await as('pending@injishi.com', 'GET', `/api/v1${path}?workspaceId=${ws.id}`);
        check(`a guarded READ is refused too (GET ${path})`, r.status === 403, `got ${r.status}`);
        check(
          `and names the stage (GET ${path})`,
          r.status === 403 && !/your role cannot/i.test(r.message),
          r.message,
        );
      }
    }
  }

  // -----------------------------------------------------------------------
  console.log('\n=== A read is refused to a role that holds none of its powers (H1) ===');
  {
    // The rent roll read went with the rentals rebuild; revenue is the money read every hotel has.
    const rr = await as('housekeeper@injishi.com', 'GET', `/api/v1/ops/revenue?workspaceId=${hosp.id}`);
    check('housekeeper cannot read revenue', rr.status === 403, `got ${rr.status}`);
    check('and the refusal names the capability', /view money/i.test(rr.message), rr.message);

    const th = await as('housekeeper@injishi.com', 'GET', `/api/v1/ops/threads?workspaceId=${hosp.id}`);
    check('housekeeper cannot read guest threads', th.status === 403, `got ${th.status}`);

    const hr = await as('housekeeper@injishi.com', 'GET', `/api/v1/ops/rooms?workspaceId=${hosp.id}`);
    check('housekeeper KEEPS the rooms list (any of its powers)', hr.status === 200, `got ${hr.status}`);

    const ht = await as('housekeeper@injishi.com', 'GET', `/api/v1/ops/housekeeping-tasks?workspaceId=${hosp.id}`);
    check('housekeeper KEEPS the cleaning board', ht.status === 200, `got ${ht.status}`);

    const rf = await as('reception@injishi.com', 'GET', `/api/v1/ops/folios?workspaceId=${hosp.id}`);
    check('receptionist KEEPS the bills', rf.status === 200, `got ${rf.status}`);

    const rh = await as('reception@injishi.com', 'GET', `/api/v1/ops/housekeeping-tasks?workspaceId=${hosp.id}`);
    check('receptionist is refused the cleaning board', rh.status === 403, `got ${rh.status}`);
  }

  // -----------------------------------------------------------------------
  console.log('\n=== Platform staff, and the roles inside it ===');
  {
    const n = await as('host@injishi.com', 'GET', '/api/v1/admin/finance/ledger');
    check('a hotelier is refused the Admin API', n.status === 403, `got ${n.status}`);
    check('and is told it is a staff console', /platform staff/i.test(n.message), n.message);

    const s = await as('admin@injishi.com', 'GET', '/api/v1/admin/finance/ledger');
    check('a super_admin reaches the ledger', s.status === 200, `got ${s.status}`);

    // Staff roles are enforced per permission at the API, not merely hidden in
    // the console sidebar. If this ever passes for `ops`, `StaffGuard` stopped
    // reading `@RequireStaffPermission`.
    const o = await as('ops@demo.injishi.com', 'GET', '/api/v1/admin/finance/ledger');
    check('an ops staffer is refused the same route', o.status === 403, `got ${o.status}`);
    const oo = await as('ops@demo.injishi.com', 'GET', '/api/v1/admin/overview');
    check('but reaches the overview they do hold', oo.status === 200, `got ${oo.status}`);
  }

  // -----------------------------------------------------------------------
  console.log('\n=== Both hats: an operator session on the oversight console ===');
  {
    // ADR-029 folded the government console into the operator app, so
    // `/me/oversight` carries `SessionGuard` alone and `OversightGuard` asks
    // only whether an assignment exists — never which door the session came
    // through. These two checks STATE that, so the exposure is measured
    // rather than assumed. A change of answer here is a change of posture.
    const plain = await as('host@injishi.com', 'GET', '/api/v1/me/oversight');
    check('an ordinary marketplace session reaches the endpoint', plain.status === 200, `got ${plain.status}`);
    check(
      'but is offered no console',
      (plain.json?.consoles ?? []).length === 0,
      JSON.stringify(plain.json?.consoles ?? []),
    );

    const dual = await as('dualhat@injishi.com', 'GET', '/api/v1/me/oversight');
    const consoles = dual.json?.consoles ?? [];
    check('a dual-hat operator session IS offered one', consoles.length === 1, JSON.stringify(consoles));
    check(
      'and it is the approval console',
      consoles[0]?.console === 'approval',
      String(consoles[0]?.console),
    );

    const biz = await workspaceOf('dualhat@injishi.com', 'business');
    check('the same session also holds an operator workspace', biz !== null, 'none');
    check('as a manager', biz?.orgRole === 'manager', String(biz?.orgRole));
  }

  console.log(
    failures === 0
      ? `\nAll ${checks} enforcement checks passed (${SESSIONS.size} sign-ins).\n`
      : `\n${failures} of ${checks} check(s) FAILED (${SESSIONS.size} sign-ins).\n`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(`\nverify-authz-http: ${e.message}\n`);
  process.exit(1);
});
