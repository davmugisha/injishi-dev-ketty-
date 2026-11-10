#!/usr/bin/env node
/**
 * Proves seed-production-admins.mjs on databases built the way production's is: fresh, migrated,
 * given reference data, UNMARKED.
 *
 *   DATABASE_URL=postgres://.../postgres node scripts/verify-production-admins.mjs
 *
 * Creates throwaway databases on the server DATABASE_URL names (it needs CREATE DATABASE there),
 * runs the same steps production's API runs on start, and checks:
 *   seeded            — the admin's account is made "invited" (unverified until the first sign-in),
 *                       holds a live super_admin grant, the admin and guest global roles, a
 *                       personal workspace, and one `staff.seeded` audit row; nobody else is made;
 *   idempotent        — a second run changes no row;
 *   revocation-kept   — roles changed, then revoked, in the console stay as the console left them
 *                       across a re-run, with no new audit row;
 *   existing-account  — an account that signed in before the seed is promoted in place: same id,
 *                       own name and verified email kept, no second account;
 *   sample-skipped    — on a sample-marked database the seed exits 0 and writes nothing.
 * Prints "CHECK <name> passed" for each check that holds, and "PRODUCTION ADMINS OK" only when all
 * of them do. Drops the databases afterwards.
 *
 * The address is written out here rather than imported from the seed, so a change to the seed's
 * list fails this check instead of quietly agreeing with itself.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const EXPECTED_ADMIN = 'mutuyimana002@gmail.com';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.DATABASE_URL?.trim();
if (!base) {
  console.error('verify-production-admins: DATABASE_URL is not set.');
  process.exit(1);
}

const prefix = `injishi_prodadmin_${process.pid}`;
const DBS = {
  template: `${prefix}_tpl`,
  fresh: `${prefix}_fresh`,
  existing: `${prefix}_existing`,
  sample: `${prefix}_sample`,
};

function urlFor(name) {
  const u = new URL(base);
  u.pathname = `/${name}`;
  return u.toString();
}
const adminUrl = urlFor('postgres');

function run(db, script, ...args) {
  return spawnSync(process.execPath, [path.join(here, script), ...args], {
    cwd: path.join(here, '..'),
    env: { ...process.env, DATABASE_URL: urlFor(db) },
    encoding: 'utf8',
  });
}

function mustRun(db, script, ...args) {
  const r = run(db, script, ...args);
  if (r.status !== 0) throw new Error(`${script} ${args.join(' ')} failed on ${db}:\n${r.stdout}\n${r.stderr}`);
  return r;
}

async function onDatabase(name, fn) {
  const c = new pg.Client({ connectionString: urlFor(name) });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function onServer(sql) {
  const c = new pg.Client({ connectionString: adminUrl });
  await c.connect();
  try {
    await c.query(sql);
  } finally {
    await c.end();
  }
}

const TABLES = ['users', 'user_profiles', 'user_roles', 'workspaces', 'admin_users', 'audit_events'];

/** Everything the seed could have touched, as plain values. */
function snapshot(db) {
  return onDatabase(db, async (c) => {
    const counts = {};
    for (const t of TABLES) counts[t] = (await c.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;
    const accounts = (
      await c.query('SELECT id, email, email_verified, name FROM users WHERE lower(email) = $1', [EXPECTED_ADMIN])
    ).rows;
    const id = accounts[0]?.id ?? null;
    const staff = id
      ? (await c.query('SELECT staff_roles::text[] AS roles, revoked_at FROM admin_users WHERE user_id = $1', [id]))
          .rows
      : [];
    const globalRoles = id
      ? (
          await c.query(
            'SELECT global_role::text AS r FROM user_roles WHERE user_id = $1 AND revoked_at IS NULL ORDER BY 1',
            [id],
          )
        ).rows.map((r) => r.r)
      : [];
    const personal = id
      ? (await c.query(`SELECT count(*)::int AS n FROM workspaces WHERE kind = 'personal' AND user_id = $1`, [id]))
          .rows[0].n
      : 0;
    const audits = id
      ? (
          await c.query(
            `SELECT count(*)::int AS n FROM audit_events WHERE subject_id = $1 AND event_type = 'staff.seeded'`,
            [id],
          )
        ).rows[0].n
      : 0;
    return { counts, accounts, id, staff, globalRoles, personal, audits };
  });
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const problems = new Map();
function check(name, ok, message) {
  if (!problems.has(name)) problems.set(name, []);
  if (!ok) problems.get(name).push(message);
}

const created = [];
try {
  // Production's start, up to the seed: migrate, then the reference data. Built once and copied,
  // so every case starts from the same database without migrating four times.
  await onServer(`CREATE DATABASE ${DBS.template}`);
  created.push(DBS.template);
  mustRun(DBS.template, 'migrate.mjs');
  mustRun(DBS.template, 'seed-reference.mjs');
  for (const name of [DBS.fresh, DBS.existing, DBS.sample]) {
    await onServer(`CREATE DATABASE ${name} TEMPLATE ${DBS.template}`);
    created.push(name);
  }

  // ── seeded ──────────────────────────────────────────────────────────────────
  const before = await snapshot(DBS.fresh);
  const first = run(DBS.fresh, 'seed-production-admins.mjs');
  check('seeded', first.status === 0, `the seed failed: ${first.stdout}${first.stderr}`);
  const once = await snapshot(DBS.fresh);
  check('seeded', before.counts.users === 0, `the fresh database already held ${before.counts.users} user(s)`);
  check('seeded', once.accounts.length === 1, `${once.accounts.length} account(s) for ${EXPECTED_ADMIN}, expected 1`);
  check('seeded', once.counts.users === 1, `${once.counts.users} users in all, expected only the admin`);
  check('seeded', once.accounts[0]?.email === EXPECTED_ADMIN, `stored address is ${once.accounts[0]?.email}`);
  check(
    'seeded',
    once.accounts[0]?.email_verified === false,
    'a new account should read invited (email_verified false)',
  );
  check(
    'seeded',
    once.staff.length === 1 && same(once.staff[0].roles, ['super_admin']) && once.staff[0].revoked_at === null,
    `staff grant is ${JSON.stringify(once.staff)}, expected one live [super_admin]`,
  );
  check('seeded', same(once.globalRoles, ['admin', 'guest']), `global roles are ${JSON.stringify(once.globalRoles)}`);
  check('seeded', once.personal === 1, `${once.personal} personal workspace(s), expected 1`);
  check('seeded', once.audits === 1, `${once.audits} staff.seeded audit row(s), expected 1`);

  // ── idempotent ──────────────────────────────────────────────────────────────
  const second = run(DBS.fresh, 'seed-production-admins.mjs');
  check('idempotent', second.status === 0, `a second run failed: ${second.stdout}${second.stderr}`);
  const twice = await snapshot(DBS.fresh);
  check(
    'idempotent',
    same(once, twice),
    `a second run changed rows: ${JSON.stringify(once)} → ${JSON.stringify(twice)}`,
  );

  // ── revocation-kept ─────────────────────────────────────────────────────────
  await onDatabase(DBS.fresh, (c) =>
    c.query(`UPDATE admin_users SET staff_roles = ARRAY['ops']::staff_role[] WHERE user_id = $1`, [once.id]),
  );
  const afterChange = run(DBS.fresh, 'seed-production-admins.mjs');
  check('revocation-kept', afterChange.status === 0, `a run after a role change failed: ${afterChange.stderr}`);
  const changed = await snapshot(DBS.fresh);
  check(
    'revocation-kept',
    same(changed.staff[0]?.roles, ['ops']),
    `roles set to [ops] came back as ${JSON.stringify(changed.staff)}`,
  );
  await onDatabase(DBS.fresh, (c) =>
    c.query('UPDATE admin_users SET revoked_at = now() WHERE user_id = $1', [once.id]),
  );
  const afterRevoke = run(DBS.fresh, 'seed-production-admins.mjs');
  check('revocation-kept', afterRevoke.status === 0, `a run after revocation failed: ${afterRevoke.stderr}`);
  const revoked = await snapshot(DBS.fresh);
  check(
    'revocation-kept',
    revoked.staff.length === 1 && revoked.staff[0].revoked_at !== null,
    `a revoked grant was restored: ${JSON.stringify(revoked.staff)}`,
  );
  check('revocation-kept', revoked.audits === 1, `${revoked.audits} staff.seeded rows after re-runs, expected still 1`);
  check('revocation-kept', same(revoked.counts, once.counts), 'a re-run after revocation wrote rows');

  // ── existing-account ────────────────────────────────────────────────────────
  // What a sign-in before the seed leaves behind: the address as the person typed it, verified.
  const signedIn = await onDatabase(DBS.existing, async (c) => {
    const r = await c.query(
      `INSERT INTO users (email, email_verified, name) VALUES ('Mutuyimana002@Gmail.com', true, 'Signed In Before') RETURNING id`,
    );
    return r.rows[0].id;
  });
  const promote = run(DBS.existing, 'seed-production-admins.mjs');
  check('existing-account', promote.status === 0, `the seed failed: ${promote.stdout}${promote.stderr}`);
  const promoted = await snapshot(DBS.existing);
  check(
    'existing-account',
    promoted.counts.users === 1,
    `${promoted.counts.users} users, expected the one that signed in`,
  );
  check('existing-account', promoted.id === signedIn, 'the grant went to a different account');
  check('existing-account', promoted.accounts[0]?.name === 'Signed In Before', "the person's own name was overwritten");
  check('existing-account', promoted.accounts[0]?.email_verified === true, 'a verified address was unverified');
  check(
    'existing-account',
    promoted.staff.length === 1 &&
      same(promoted.staff[0].roles, ['super_admin']) &&
      promoted.staff[0].revoked_at === null,
    `staff grant is ${JSON.stringify(promoted.staff)}`,
  );
  check(
    'existing-account',
    same(promoted.globalRoles, ['admin', 'guest']),
    `global roles are ${JSON.stringify(promoted.globalRoles)}`,
  );
  check('existing-account', promoted.personal === 1, `${promoted.personal} personal workspace(s)`);
  check('existing-account', promoted.audits === 1, `${promoted.audits} staff.seeded audit row(s)`);

  // ── sample-skipped ──────────────────────────────────────────────────────────
  mustRun(DBS.sample, 'mark-sample-database.mjs', '--sample');
  const sampleBefore = await snapshot(DBS.sample);
  const onSample = run(DBS.sample, 'seed-production-admins.mjs');
  check('sample-skipped', onSample.status === 0, `the seed failed on a sample database: ${onSample.stderr}`);
  check(
    'sample-skipped',
    /sample database/.test(onSample.stdout),
    `the seed did not say it skipped: ${onSample.stdout}`,
  );
  const sampleAfter = await snapshot(DBS.sample);
  check('sample-skipped', same(sampleBefore.counts, sampleAfter.counts), 'the seed wrote rows into a sample database');
  check('sample-skipped', sampleAfter.counts.users === 0, `${sampleAfter.counts.users} user(s) on the sample database`);
} catch (error) {
  check('setup', false, error?.message ?? String(error));
} finally {
  for (const name of created.reverse()) {
    await onServer(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`).catch((e) =>
      console.error(`could not drop ${name}: ${e?.message ?? e}`),
    );
  }
}

let failed = false;
for (const [name, list] of problems) {
  if (list.length === 0) {
    console.log(`CHECK ${name} passed`);
    continue;
  }
  failed = true;
  for (const p of list) console.error(`PROBLEM ${name}: ${p}`);
}
if (failed) process.exit(1);
console.log('PRODUCTION ADMINS OK');
