// Verify the operator screens' endpoints answer, and refuse the right people
// (ADR-035, D-f wave 1).
//
// The third verify script, and it asks the third question. `verify-authz.mjs`
// checks the MODEL against rows. `verify-role-nav.mjs` checks that each role
// gets its own set of DOORS. This one checks that what is behind those doors
// actually opens: every read a wave 1 screen makes, signed in as a real person,
// against a real database.
//
// WHY A READ AND NOT A WRITE. A read proves the whole path — session, guard,
// repository, contract — without leaving rows behind, so this is safe to run
// repeatedly against a database you control. The commands are exercised by
// driving the app.
//
// WHAT "EMPTY" MEANS HERE. A seeded database has no tickets, threads, leases or
// cleaning tasks, so most of these come back with zero rows. That is a PASS: the
// question is whether the endpoint answers 200 with a shape the contract
// accepts, not whether somebody has seeded content into it. A 500 or a 404 is
// the failure this catches, and an unwired screen would show one.
//
// Run against a database you control, never the shared one:
//   VERIFY_API_URL=http://localhost:8000 node scripts/verify-ops-reads.mjs
const API = process.env.VERIFY_API_URL || 'http://localhost:8000';
const OTP = process.env.VERIFY_OTP_CODE || '123456';

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  ${label}` + (ok ? '' : `   expected ${expected}, got ${actual}`),
  );
}

function jar(res) {
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
}

async function sessionFor(email) {
  await fetch(`${API}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, type: 'sign-in' }),
  });
  const res = await fetch(`${API}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp: OTP }),
  });
  if (!res.ok) throw new Error(`${email}: sign-in ${res.status}`);
  const cookie = jar(res);

  await fetch(`${API}/api/v1/me/two-factor/send`, { method: 'POST', headers: { cookie } });
  await fetch(`${API}/api/v1/me/two-factor/verify`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: OTP }),
  });

  const me = await fetch(`${API}/api/v1/me/workspaces`, { headers: { cookie } });
  const body = await me.json();
  const ws = (body.workspaces ?? []).find((w) => w.kind === 'business');
  return { cookie, workspaceId: ws?.workspaceId ?? null, role: ws?.orgRole ?? null };
}

/** Every read a wave 1 screen makes, and the array it is expected to carry. */
const READS = [
  ['Housekeeping', '/ops/housekeeping-tasks', 'tasks'],
  ['Maintenance', '/ops/tickets', 'tickets'],
  ['Inbox', '/ops/threads', 'threads'],
  ['Leases', '/ops/leases', 'leases'],
  ['Move-outs (deposits)', '/ops/deposits', 'deposits'],
  // Wave 2.
  ['Departments', '/ops/departments', 'departments'],
  ['Menu', '/ops/service-catalog', 'categories'],
  ['Live orders', '/ops/service-orders', 'orders'],
  ['Bills', '/ops/folios', 'folios'],
  ['Team', '/ops/team', 'members'],
  ['Stays', '/ops/stays', 'stays'],
  // Takes no `workspaceId` parameter, unlike its neighbours on the same
  // controller: the header is what the guard reads.
  ['Rate plans', '/inventory/rate-plans', 'ratePlans'],
  // Inventory validates a workspaceId query parameter and then discards it;
  // the header is authoritative. Sent anyway, per the contract.
  ['Inventory', '/inventory/properties?workspaceId=WORKSPACE', 'properties'],
  // Already live before this wave; included so a regression in the three that
  // were working shows up in the same run.
  ['Reservations', '/ops/reservations', 'reservations'],
  ['Room status', '/ops/rooms', 'rooms'],
  ['Rent roll', '/ops/rent-roll', 'charges'],
];

console.log(`Verifying operator reads against ${API}\n`);

const owner = await sessionFor('host@injishi.com');
if (!owner.workspaceId) throw new Error('the owner holds no business workspace');

console.log(`host@injishi.com (${owner.role}) — every screen's read answers`);
for (const [screen, path, key] of READS) {
  const res = await fetch(`${API}/api/v1${path.replace("WORKSPACE", owner.workspaceId)}`, {
    headers: { cookie: owner.cookie, 'x-workspace-id': owner.workspaceId },
  });
  let shape = `HTTP ${res.status}`;
  if (res.ok) {
    const body = await res.json();
    shape = Array.isArray(body?.[key]) ? 'ok' : `missing "${key}" array`;
  }
  check(`${screen.padEnd(22)} GET ${path}`, shape, 'ok');
}

/*
 * The same reads, as somebody who should not have them.
 *
 * A read is not permission gated the way a command is — `WorkspaceGuard`
 * refuses on the WORKSPACE, and every seeded operator holds this one — so these
 * are expected to answer. That is worth stating rather than assuming: the
 * control that stops a receptionist reaching Finance is the nav-derived route
 * guard (verify-role-nav.mjs) plus the permission on each COMMAND, not the read.
 */
console.log('\nreception@injishi.com — reads answer, because the guard is on the workspace');
const reception = await sessionFor('reception@injishi.com');
for (const [screen, path, key] of READS.slice(0, 9)) {
  const res = await fetch(`${API}/api/v1${path}`, {
    headers: { cookie: reception.cookie, 'x-workspace-id': reception.workspaceId },
  });
  const body = res.ok ? await res.json() : null;
  check(`${screen.padEnd(22)} GET ${path}`, res.ok && Array.isArray(body?.[key]) ? 'ok' : `HTTP ${res.status}`, 'ok');
}

/*
 * A workspace the caller does not hold is refused, whoever they are.
 *
 * The one check here that is about the boundary rather than the wiring. A made
 * up uuid must not read as "not found in your workspace" — it must be refused
 * the same way a real workspace somebody else holds is, so a probe learns
 * nothing either way.
 */
console.log('\nA workspace nobody here holds is refused');
const stranger = '00000000-0000-4000-8000-000000000000';
const res = await fetch(`${API}/api/v1/ops/tickets`, {
  headers: { cookie: reception.cookie, 'x-workspace-id': stranger },
});
check('GET /ops/tickets with an unheld workspace id', res.status, 403);

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
