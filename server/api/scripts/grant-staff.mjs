#!/usr/bin/env node
/**
 * Make an email address Injishi staff (2026-10-24).
 *
 *   node scripts/grant-staff.mjs --email admin@injishi.test --role super_admin [--name "Injishi Admin"]
 *
 * Nothing else creates the first admin: a fresh database (production, or the
 * clean test database) has no one who can open the admin console, approve a
 * business or assign a local leader. This creates the account when the address
 * has none (email marked verified, so the first sign-in is the email code like
 * anyone else's) and grants the staff role. Roles: super_admin, ops,
 * compliance, finance, trainer (repeat --role for several).
 *
 * Signing in works as for anyone: request a code at /sign-in, read it in the
 * mailbox (locally, Mailpit at http://localhost:8025). The console then asks
 * for a fresh email code before any staff action, as it always does.
 *
 * Reads the env file like the other scripts (.env.test unless APP_ENV names
 * another). Against a database that is not on this machine it refuses unless
 * --yes is given, so a laptop can't grant staff on a shared database by
 * accident. Running it again changes nothing, or restores a revoked grant.
 */
import pg from 'pg';

import { loadApiEnv } from './env-file.mjs';
import { describeDatabase } from './sample-database.mjs';

const ROLES = ['super_admin', 'ops', 'compliance', 'finance', 'trainer'];
const LOCAL = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function args(argv) {
  const out = { roles: [], yes: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--email') out.email = argv[++i];
    else if (a === '--role') out.roles.push(argv[++i]);
    else if (a === '--name') out.name = argv[++i];
    else if (a === '--yes') out.yes = true;
    else throw new Error(`Unknown option ${a}`);
  }
  return out;
}

function fail(message) {
  console.error(`grant-staff: ${message}`);
  process.exit(1);
}

let opts;
try {
  opts = args(process.argv.slice(2));
} catch (error) {
  fail(error.message);
}
const email = opts.email?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('give --email with a valid address.');
const roles = opts.roles.length ? [...new Set(opts.roles)] : ['super_admin'];
const unknown = roles.filter((r) => !ROLES.includes(r));
if (unknown.length) fail(`unknown role ${unknown.join(', ')}. Roles: ${ROLES.join(', ')}.`);

loadApiEnv();
const url = process.env.DATABASE_URL?.trim();
if (!url) fail('DATABASE_URL is not set (and not in the env file).');
const host = new URL(url).hostname;
if (!LOCAL.has(host) && !opts.yes) {
  fail(`${describeDatabase(url)} is not on this machine. Add --yes if you mean it.`);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('BEGIN');
  const found = await client.query('SELECT id, name FROM users WHERE lower(email) = $1', [email]);
  let userId = found.rows[0]?.id;
  const created = !userId;
  if (!userId) {
    const name = opts.name?.trim() || 'Injishi Admin';
    const inserted = await client.query(
      'INSERT INTO users (email, email_verified, name) VALUES ($1, true, $2) RETURNING id',
      [email, name],
    );
    userId = inserted.rows[0].id;
    await client.query(
      `INSERT INTO user_profiles (user_id, display_name) VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, name],
    );
  }
  await client.query(
    `INSERT INTO admin_users (user_id, staff_roles, two_factor_enrolled)
     VALUES ($1, $2::staff_role[], false)
     ON CONFLICT (user_id) DO UPDATE SET staff_roles = EXCLUDED.staff_roles, revoked_at = NULL`,
    [userId, roles],
  );
  await client.query('COMMIT');
  console.log(
    `${created ? 'Created' : 'Found'} ${email} (${userId}) and granted ${roles.join(', ')} on ${describeDatabase(url)}.`,
  );
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  fail(error.message);
} finally {
  await client.end();
}
