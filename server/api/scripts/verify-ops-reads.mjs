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
  // The old landlord reads (/ops/leases, /ops/deposits, /ops/rent-roll,
  // /ops/filings) went with the rentals rebuild (migrations 0073 to 0080); the
  // rentals module's reads replace them.
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
 * The same reads, as roles that hold less.
 *
 * Every read declares who may make it (platform audit, H1). This used to
 * assert the opposite — that a receptionist could read every list because
 * `WorkspaceGuard` refused only on the workspace — and that was the hole: a
 * housekeeper read the rent roll, and an owner whose business is still in the
 * registration pipeline, holding NO permission, read everything. Each role
 * below keeps exactly the reads its screens make, and is refused the rest.
 * `ops-read-permissions.spec.ts` pins the same table against the role model;
 * this proves it against a running API.
 */
const OK = 'ok';
const REFUSED = 'HTTP 403';

async function readAs(session, path, key) {
  const res = await fetch(`${API}/api/v1${path.replace('WORKSPACE', session.workspaceId)}`, {
    headers: { cookie: session.cookie, 'x-workspace-id': session.workspaceId },
  });
  if (!res.ok) return `HTTP ${res.status}`;
  const body = await res.json();
  return Array.isArray(body?.[key]) ? OK : `missing "${key}" array`;
}

async function expectReads(session, expected) {
  for (const [screen, path, key] of READS) {
    const want = expected[path] ?? REFUSED;
    check(`${screen.padEnd(22)} GET ${path}`, await readAs(session, path, key), want);
  }
}

console.log('\nreception@injishi.com — the desk\'s reads answer, the rest are refused');
const reception = await sessionFor('reception@injishi.com');
await expectReads(reception, {
  '/ops/threads': OK,
  '/ops/departments': OK,
  '/ops/service-catalog': OK,
  '/ops/service-orders': OK,
  '/ops/folios': OK,
  '/ops/stays': OK,
  '/ops/reservations': OK,
  '/ops/rooms': OK,
});

console.log('\nhousekeeper@injishi.com — rooms, the cleaning board and tickets only');
const housekeeper = await sessionFor('housekeeper@injishi.com');
await expectReads(housekeeper, {
  '/ops/housekeeping-tasks': OK,
  '/ops/tickets': OK,
  '/ops/rooms': OK,
});

/*
 * The registration gate, on reads.
 *
 * The owner of a business still in the pipeline holds the owner role and an
 * EMPTY permission set. The workspace is still listed — the pipeline is
 * rendered from the grant — but no operator list is readable from it.
 */
console.log('\npending@injishi.com — a business in the registration pipeline reads nothing');
const pending = await sessionFor('pending@injishi.com');
if (!pending.workspaceId) {
  check('pending@injishi.com holds a business workspace', 'none', 'one');
} else {
  await expectReads(pending, {});
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
