#!/usr/bin/env node
/**
 * Proves the interface world is in Postgres and that seeding it twice changes nothing.
 *
 *   node scripts/verify-interface-world.mjs            check the world as it is
 *   node scripts/verify-interface-world.mjs --reseed   run seed-interface.mjs twice, then check, and
 *                                                      require identical row counts after each run
 *
 * Checks: the 18 personas exist at @app.demo.injishi.com under the seed's own ids; each holds the org role
 * the world gives it; the businesses, branches, room types and rooms are there; departments exist for
 * every branch. Prints "INTERFACE WORLD OK" only when every check holds.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { iid, loadFixtures, userId } from './seed-interface/lib.mjs';
import { ORG, PROPERTY, WORKSPACE } from './seed-interface/world.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('verify-interface-world: DATABASE_URL is not set.');
  process.exit(1);
}

const problems = [];
const expect = (ok, message) => {
  if (!ok) problems.push(message);
};

function seed() {
  const r = spawnSync(process.execPath, [path.join(here, 'seed-interface.mjs')], {
    cwd: path.join(here, '..'),
    env: process.env,
    encoding: 'utf8',
  });
  if (r.status !== 0 || !r.stdout.includes('INTERFACE SEED DONE')) {
    console.error(r.stdout, r.stderr);
    console.error('verify-interface-world: seed-interface.mjs failed');
    process.exit(1);
  }
}

/** Row counts in the interface world: [query, which ids it is scoped by]. */
const COUNTS = {
  users: [`SELECT count(*)::int AS n FROM users WHERE email LIKE '%@app.demo.injishi.com'`, null],
  orgs: ['SELECT count(*)::int AS n FROM orgs WHERE id = ANY($1::uuid[])', 'orgs'],
  memberships: [`SELECT count(*)::int AS n FROM org_memberships WHERE org_id = ANY($1::uuid[]) AND status = 'active'`, 'orgs'],
  branches: ['SELECT count(*)::int AS n FROM properties WHERE org_id = ANY($1::uuid[])', 'orgs'],
  roomTypes: ['SELECT count(*)::int AS n FROM room_types WHERE property_id IN (SELECT id FROM properties WHERE org_id = ANY($1::uuid[]))', 'orgs'],
  rooms: ['SELECT count(*)::int AS n FROM rooms WHERE property_id IN (SELECT id FROM properties WHERE org_id = ANY($1::uuid[]))', 'orgs'],
  departments: ['SELECT count(*)::int AS n FROM departments WHERE org_id = ANY($1::uuid[])', 'orgs'],
  housekeepingTasks: ['SELECT count(*)::int AS n FROM housekeeping_tasks WHERE workspace_id = ANY($1::uuid[])', 'workspaces'],
};

async function counts(c) {
  const scope = { orgs: Object.values(ORG), workspaces: [WORKSPACE.hotel, WORKSPACE.residences] };
  const out = {};
  for (const [name, [sql, by]] of Object.entries(COUNTS)) {
    const { rows } = await c.query(sql, by ? [scope[by]] : []);
    out[name] = rows[0].n;
  }
  return out;
}

const reseed = process.argv.includes('--reseed');
const c = new pg.Client({ connectionString: url });
await c.connect();
try {
  let first = null;
  if (reseed) {
    seed();
    first = await counts(c);
    seed();
  }
  const now = await counts(c);
  if (first) {
    for (const k of Object.keys(now)) expect(first[k] === now[k], `a second seed changed ${k}: ${first[k]} → ${now[k]}`);
  }

  const { personas, fx } = loadFixtures();
  const ids = Object.keys(personas);
  expect(now.users === ids.length, `${now.users} users at @app.demo.injishi.com, expected ${ids.length}`);
  for (const id of ids) {
    const { rows } = await c.query('SELECT id FROM users WHERE lower(email) = lower($1)', [personas[id].email]);
    expect(rows.length === 1, `${personas[id].email} is not a user`);
    expect(rows[0]?.id === userId(id), `${personas[id].email} is user ${rows[0]?.id}, not the seeded ${userId(id)}`);
  }

  const roleOf = async (persona, org) => {
    const { rows } = await c.query(
      `SELECT org_role FROM org_memberships WHERE user_id = $1 AND org_id = $2 AND status = 'active'`,
      [userId(persona), org],
    );
    return rows.map((r) => r.org_role).join(',');
  };
  const ROLES = [
    ['owner', ORG.hotel, 'owner'], ['manager', ORG.hotel, 'manager'], ['frontdesk', ORG.hotel, 'receptionist'],
    ['finance', ORG.hotel, 'finance'], ['hr', ORG.hotel, 'hr'], ['housekeeper', ORG.hotel, 'housekeeper'],
    ['owner', ORG.residences, 'owner'], ['residence', ORG.residences, 'manager'],
  ];
  for (const [persona, org, role] of ROLES) {
    const held = await roleOf(persona, org);
    expect(held === role, `${persona} holds "${held}" at ${org}, expected ${role}`);
  }
  const { rows: limits } = await c.query(
    `SELECT p.slug FROM org_membership_branches b JOIN org_memberships m ON m.id = b.org_membership_id
       JOIN properties p ON p.id = b.property_id WHERE m.user_id = $1 AND m.status = 'active'`,
    [userId('frontdesk')],
  );
  expect(limits.map((r) => r.slug).join() === 'isangano-lakeside-hotel', `the front desk is limited to ${limits.map((r) => r.slug).join() || 'no branch'}`);

  expect(now.orgs === 2, `${now.orgs} businesses, expected 2`);
  expect(now.branches === 3, `${now.branches} branches, expected 3`);
  const roomFixtures = fx('operations.rooms').length;
  expect(now.rooms === roomFixtures + 18, `${now.rooms} rooms, expected ${roomFixtures} at Isangano + 18 tents`);
  expect(now.roomTypes === fx('frontdesk.roomTypes').length + 1, `${now.roomTypes} room types`);
  expect(now.departments === 33, `${now.departments} departments, expected 11 per branch`);
  const { rows: ishyamba } = await c.query('SELECT name FROM properties WHERE id = $1', [PROPERTY.ishyamba]);
  expect(ishyamba[0]?.name === 'Ishyamba Forest Lodge', 'Ishyamba Forest Lodge is missing');
  const { rows: oversight } = await c.query(
    'SELECT oversight_role FROM oversight_assignments WHERE id = $1 AND revoked_at IS NULL',
    [iid('assignment', 'officer')],
  );
  expect(oversight[0]?.oversight_role === 'business_approver', 'the district officer holds no approver assignment');

  console.log(JSON.stringify(now));
  if (problems.length) {
    for (const p of problems) console.error(`PROBLEM ${p}`);
    process.exitCode = 1;
  } else {
    console.log('INTERFACE WORLD OK');
  }
} finally {
  await c.end().catch(() => {});
}
