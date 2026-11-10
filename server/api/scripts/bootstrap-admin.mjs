#!/usr/bin/env node
/**
 * Make the FIRST platform admin on a database that has none.
 *
 *   DATABASE_URL=... node scripts/bootstrap-admin.mjs --email someone@injishi.com
 *
 * A production database is migrated and given reference data (`seed-reference.mjs`) and nothing
 * else, and every seeder that writes `admin_users` refuses a database without the sample marker. So
 * a fresh production stack had no one who could open the admin console, which meant nobody could set
 * a registration fee (`POST /admin/configuration/fees`) or appoint a field verifier and an approver
 * (`POST /admin/users/:userId/oversight`). Registration answered "not open yet" and no business
 * could ever reach `active`. This is the one door in, and it shuts behind the first person through:
 *
 *  - It grants to an account that ALREADY EXISTS. The person signs in once on the website with the
 *    emailed code, which is what makes them a user; Better Auth stays the only writer of identities.
 *  - It refuses while any staff grant is live. Every later grant goes through the admin console,
 *    which is audited and needs the console's own step up. A script that kept working would be a
 *    way round both.
 *  - It writes an `audit_events` row naming itself, so the first grant is on the trail like every
 *    other one.
 *
 * Production no longer needs it by default: `seed-production-admins.mjs` grants the admins named in
 * the repository on every API start, so this refuses there once that has run. It stays for a
 * database whose list is empty, or one that never ran the seed.
 *
 * Safe on a real or a sample database. It writes one person's grant and nothing else.
 */
import pg from 'pg';

import { describeDatabase } from './sample-database.mjs';

const args = process.argv.slice(2);
const emailAt = args.indexOf('--email');
const email = emailAt >= 0 ? args[emailAt + 1]?.trim().toLowerCase() : undefined;
if (!email || !email.includes('@')) {
  console.error('bootstrap-admin: pass the account to promote, e.g. --email someone@injishi.com');
  process.exit(1);
}

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('bootstrap-admin: DATABASE_URL is not set.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('BEGIN');
  // Serialise two runs, so both cannot read "no staff yet" and both grant.
  await client.query('LOCK TABLE admin_users IN EXCLUSIVE MODE');

  const live = await client.query(`SELECT count(*)::int AS n FROM admin_users WHERE revoked_at IS NULL`);
  if (live.rows[0].n > 0) {
    throw new Error(
      `${describeDatabase(url)} already has ${live.rows[0].n} platform staff. Grant further staff from the admin console, where the grant is audited.`,
    );
  }

  const found = await client.query(`SELECT id FROM users WHERE lower(email) = $1`, [email]);
  if (found.rows.length === 0) {
    throw new Error(
      `no account for ${email}. Sign in once on the website with that address (the emailed code makes the account), then run this again.`,
    );
  }
  const userId = found.rows[0].id;

  await client.query(
    `INSERT INTO admin_users (user_id, staff_roles, two_factor_enrolled)
     VALUES ($1, ARRAY['super_admin']::staff_role[], false)
     ON CONFLICT (user_id) DO UPDATE SET staff_roles = EXCLUDED.staff_roles, revoked_at = NULL, updated_at = now()`,
    [userId],
  );
  const role = await client.query(
    `SELECT 1 FROM user_roles WHERE user_id = $1 AND global_role = 'admin' AND revoked_at IS NULL LIMIT 1`,
    [userId],
  );
  if (role.rows.length === 0) {
    await client.query(`INSERT INTO user_roles (user_id, global_role) VALUES ($1, 'admin')`, [userId]);
  }
  await client.query(
    `INSERT INTO audit_events (actor_user_id, subject_type, subject_id, event_type, payload_diff, reason)
     VALUES (NULL, 'user', $1, 'staff.bootstrapped', $2::jsonb, $3)`,
    [
      userId,
      JSON.stringify({ staffRoles: { from: null, to: ['super_admin'] } }),
      'First platform admin, granted by scripts/bootstrap-admin.mjs on a database with no staff.',
    ],
  );
  await client.query('COMMIT');
  console.log(`${email} is now super_admin on ${describeDatabase(url)}.`);
  console.log('Next, in the admin console: set the registration fees, then appoint a field verifier and an approver.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(`bootstrap-admin: ${error?.message ?? error}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
