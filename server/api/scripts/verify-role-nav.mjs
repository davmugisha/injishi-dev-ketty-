// Verify that every role really gets a different surface (ADR-035, AC-1 to AC-3).
//
// The sibling of verify-authz.mjs, and it asks a different question. That one
// checks the MODEL against rows in a database. This one checks the whole path:
// it signs each seeded person in over HTTP through the real emailed-code flow,
// reads the grant the API actually returns, and feeds THAT to the operator
// app's own `navFor` and `allowedSegments`.
//
// WHY IT CAN IMPORT THE APP'S NAV. `apps/app/src/pms/lib/nav.ts` has no runtime
// imports — every import in it is `import type` — so it runs under Node's type
// stripping exactly as the app runs it. That matters: this is the SAME function
// the route guard in `app-shell.tsx` calls, not a copy of its rules. A copy
// would drift and this check would then pass while the app refused people.
//
// WHAT IT CAUGHT. A housekeeper was being handed the manager's nav — twelve
// screens including Finance, against the two permissions they hold — because
// `hostNav` had one role gate and it named only the receptionist. It was
// invisible in the app, since `AppShell` short-circuits a housekeeper to
// `HousekeeperPhone` and never renders that sidebar; but the nav is the guard's
// whole input and the command bar reads the same list.
//
// Run it against a database you control, never the shared one:
//   VERIFY_API_URL=http://localhost:8000 node scripts/verify-role-nav.mjs
import { allowedSegments, navFor } from '../../../apps/app/src/pms/lib/nav.ts';

const API = process.env.VERIFY_API_URL || 'http://localhost:8000';
// The demo environment's fixed sign-in code. It is a constructor argument on
// the demo Better Auth instance, so this only ever works against demo.
const OTP = process.env.VERIFY_OTP_CODE || '123456';

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  ${label}` +
      (ok
        ? ''
        : `\n         expected ${JSON.stringify(expected)}\n         got      ${JSON.stringify(actual)}`),
  );
}

/** Every Set-Cookie squashed into one Cookie header. */
function jar(res) {
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
}

/** Sign in for real and return the business grant, or null. */
async function grantFor(email) {
  // Better Auth refuses a request with no Origin (403 MISSING_OR_NULL_ORIGIN)
  // before it looks at the code, which reads exactly like a broken account.
  const origin = process.env.VERIFY_WEB_ORIGIN || 'http://localhost:3000';
  await fetch(`${API}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin },
    body: JSON.stringify({ email, type: 'sign-in' }),
  });
  const res = await fetch(`${API}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin },
    body: JSON.stringify({ email, otp: OTP }),
  });
  if (!res.ok) throw new Error(`${email}: sign-in ${res.status}`);
  const cookie = jar(res);

  // The step up is part of the path, so exercise it rather than route round it.
  await fetch(`${API}/api/v1/me/two-factor/send`, { method: 'POST', headers: { cookie } });
  const verified = await fetch(`${API}/api/v1/me/two-factor/verify`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: OTP }),
  });
  if (!verified.ok) throw new Error(`${email}: step-up ${verified.status}`);

  const me = await fetch(`${API}/api/v1/me/workspaces`, { headers: { cookie } });
  const body = await me.json();
  return (body.workspaces ?? []).find((w) => w.kind === 'business') ?? null;
}

/**
 * What each seeded operator must see. Screens are sorted, so a new leaf shows
 * up as a diff rather than passing quietly.
 *
 * SINCE ADR-053 THE NAV READS NO ROLE. Each leaf declares the permission it
 * needs and `navFor` filters on the grant's `permissions[]`; a leaf that gates
 * no capability (Today, Calendar, the tenancy lists) is offered to every member.
 * So the role below is checked only as the server's own label for the grant,
 * and the screens follow from the permission count beside it.
 */
const EXPECTED = [
  {
    email: 'host@injishi.com',
    role: 'owner',
    // 23 since `ebm.manage` (ADR-041, D-o).
    permissions: 23,
    screens: [
      'calendar', 'finance', 'housekeeping', 'inbox', 'inventory', 'maintenance',
      'people', 'reservations', 'rooms', 'services', 'settings', 'stays', 'today',
    ],
  },
  {
    email: 'manager@injishi.com',
    role: 'manager',
    // 22 since `team.manage` became the owner's alone (2026-09-12). This row
    // said 23 and listed People until ADR-053 corrected it: a stale expectation
    // that would have passed a manager a door that refuses them.
    permissions: 22,
    // The owner's surface without People. Settings stays: a manager holds
    // `ebm.manage` and Settings → Integrations is where it is used.
    screens: [
      'calendar', 'finance', 'housekeeping', 'inbox', 'inventory', 'maintenance',
      'reservations', 'rooms', 'services', 'settings', 'stays', 'today',
    ],
  },
  {
    email: 'reception@injishi.com',
    role: 'receptionist',
    permissions: 8,
    // Front desk and taking service orders. No Rooms, no Money, no admin.
    // Services because the leaf declares `order.advance` (ADR-053, ruled
    // 2026-09-13): it opens on Live orders, which a receptionist works.
    screens: ['calendar', 'inbox', 'reservations', 'services', 'stays', 'today'],
  },
  {
    email: 'housekeeper@injishi.com',
    role: 'housekeeper',
    permissions: 2,
    // Room status and maintenance tickets, matching the two permissions, plus
    // Today and Calendar, which gate no capability and so reach every member
    // (ADR-053). `AppShell` still renders the phone surface for a housekeeper.
    screens: ['calendar', 'housekeeping', 'maintenance', 'rooms', 'today'],
  },
  {
    email: 'landlord@injishi.rw',
    role: 'owner',
    permissions: 23,
    screens: [
      'finance', 'inbox', 'leases', 'listing', 'maintenance', 'move-outs',
      'people', 'rent-roll', 'settings', 'units',
    ],
  },
  {
    email: 'resident-manager@injishi.rw',
    role: 'manager',
    permissions: 22,
    // The landlord's surface without People, the same `team.manage` line as on
    // the hotel side. The residence nav used to offer People to every role.
    screens: [
      'finance', 'inbox', 'leases', 'listing', 'maintenance', 'move-outs',
      'rent-roll', 'settings', 'units',
    ],
  },
];

console.log(`Verifying role surfaces against ${API}\n`);

/** The grant each account was handed, kept for the checks that reuse it. */
const grants = {};

for (const want of EXPECTED) {
  console.log(`${want.email}`);
  const grant = await grantFor(want.email);
  if (!grant) {
    failures += 1;
    console.log('  FAIL  holds no business workspace');
    continue;
  }

  check('role from the server', grant.orgRole, want.role);
  check('permission count', grant.permissions.length, want.permissions);

  // Exactly the context `navContextOf` builds, from the same grant fields.
  const sections = navFor({
    ws: grant.domain === 'residence' ? 'landlord' : 'host',
    workspaceId: grant.workspaceId,
    permissions: grant.permissions,
    departments: grant.departments,
  });
  check('screens the nav grants', [...allowedSegments(sections)].sort(), want.screens);
  grants[want.email] = grant;
}

/*
 * AC-A2: a role's reachable screens are a function of its permission array and
 * NOTHING else. Driven by handing `navFor` the receptionist's real grant with
 * one permission added and one removed, which is what editing the role in
 * `@injishi/contracts` does to the array the server sends. No other input moves,
 * so if the screens move, no second file could have been involved.
 */
console.log('\nThe nav follows the permission array alone (AC-A2)');
{
  const reception = grants['reception@injishi.rw'];
  if (reception) {
    const base = {
      ws: 'host',
      workspaceId: reception.workspaceId,
      departments: reception.departments,
    };
    const withMoney = allowedSegments(navFor({ ...base, permissions: [...reception.permissions, 'money.view'] }));
    check('adding money.view opens Finance', withMoney.has('finance'), true);
    const withoutInbox = allowedSegments(
      navFor({ ...base, permissions: reception.permissions.filter((p) => p !== 'message.send') }),
    );
    check('removing message.send closes the Inbox', withoutInbox.has('inbox'), false);
    const none = [...allowedSegments(navFor({ ...base, permissions: [] }))].sort();
    check('an empty array (a business not active) leaves only the undeclared leaves', none, ['calendar', 'today']);
  }
}

/*
 * The nav's SHAPE is a function of the department list, not of a fixture
 * (ADR-035, D-a, AC-3). Driven here rather than by editing rows, because the
 * claim is about the function and a row edit would only prove one case.
 *
 * The empty case matters most: a grant that has not arrived yet must produce NO
 * optional section. A nav has to fail closed.
 */
console.log('\nSections follow the department list');
// The owner's real permission array, so this varies departments and nothing else.
const owner = { ws: 'host', workspaceId: 'ws', permissions: grants['host@injishi.rw']?.permissions ?? [] };
for (const [label, departments, services, maintenance] of [
  ['all eleven', ['rooms', 'fnb', 'spa_recreation', 'engineering'], true, true],
  ['no fnb, spa or engineering', ['rooms', 'admin_general'], false, false],
  ['fnb only', ['rooms', 'fnb'], true, false],
  ['engineering only', ['rooms', 'engineering'], false, true],
  ['empty — grant not arrived', [], false, false],
]) {
  const allowed = allowedSegments(navFor({ ...owner, departments }));
  check(`${label}: services`, allowed.has('services'), services);
  check(`${label}: maintenance`, allowed.has('maintenance'), maintenance);
}

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
