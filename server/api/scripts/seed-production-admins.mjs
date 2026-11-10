#!/usr/bin/env node
/**
 * The platform admins production starts with (2026-11-10).
 *
 *   DATABASE_URL=... node scripts/seed-production-admins.mjs
 *
 * Production's API runs this on every start, after `migrate.mjs` and `seed-reference.mjs`
 * (docker-compose.dokploy.yml). Before it, the first admin was a manual step:
 * the person signed in once, then someone with a shell on the VPS ran `bootstrap-admin.mjs`. This
 * names the admin in the repository instead, so a change of who it is goes through review.
 *
 * Each address in `PRODUCTION_ADMINS` is given, once:
 *  - an account, when the address has none. It is made the way the admin console makes one
 *    (`email_verified` false, no name), so it reads "invited" until the person signs in with the
 *    emailed code, which is what proves the mailbox. Better Auth needs nothing else to sign them in;
 *  - the staff roles listed (`admin_users`) and the `admin` and `guest` global roles, the shape
 *    `seed-users.mjs` gives its own admin;
 *  - a personal workspace, the one every account lands in after sign-in;
 *  - an `audit_events` row naming this script, so the grant is on the trail like every other.
 *
 * ONCE, and then the console owns it. A person who already has an `admin_users` row, live or
 * revoked, is left exactly as they are. A super admin who changes this person's roles, or revokes
 * them, in the console is not overruled at the next restart. Revocation keeps the row (it sets
 * `revoked_at`), so a revoked admin stays revoked. To take someone out for good, revoke them in the
 * console AND remove them from the list below.
 *
 * Never on a sample database (ADR-043): a demo or staging database is sample data, and a real
 * person's address does not belong in it. There the script says so and exits 0.
 *
 * Idempotent and safe to run by hand: a second run changes nothing.
 * `node scripts/verify-production-admins.mjs` proves it on a throwaway database.
 */
import pg from 'pg';

import { describeDatabase } from './sample-database.mjs';

/**
 * Who administers production. Staff roles are `super_admin`, `ops`, `compliance`, `finance` and
 * `trainer` (the `staff_role` enum). A super admin can grant everyone else from the console.
 */
const PRODUCTION_ADMINS = [{ email: 'mutuyimana002@gmail.com', staffRoles: ['super_admin'] }];

const GLOBAL_ROLES = ['admin', 'guest'];

/** Postgres `undefined_table`: the schema is not there yet. */
const UNDEFINED_TABLE = '42P01';

/** Is this database marked sample? Throws when it predates the marker table (no migrations). */
async function isSampleDatabase(client) {
  try {
    const { rows } = await client.query('SELECT kind FROM database_identity LIMIT 1');
    return rows[0]?.kind === 'sample';
  } catch (error) {
    if (error?.code === UNDEFINED_TABLE) {
      throw new Error('the schema is not there yet: run scripts/migrate.mjs first');
    }
    throw error;
  }
}

/** One admin, in the caller's transaction. Returns a line for the log. */
async function seedAdmin(client, admin) {
  const email = admin.email.trim().toLowerCase();

  let userId;
  let created = false;
  // `users_email_lower_uk`: one account per address, whatever its case.
  const found = await client.query('SELECT id FROM users WHERE lower(email) = $1', [email]);
  if (found.rows.length > 0) {
    userId = found.rows[0].id;
    // `::text[]`: node-postgres hands an enum array back as the raw string `{super_admin}`.
    const staff = await client.query(
      'SELECT staff_roles::text[] AS staff_roles, revoked_at FROM admin_users WHERE user_id = $1',
      [userId],
    );
    if (staff.rows.length > 0) {
      const { staff_roles: roles, revoked_at: revokedAt } = staff.rows[0];
      return revokedAt
        ? `${email}: staff grant revoked ${revokedAt.toISOString()}; left revoked (the console decides)`
        : `${email}: already staff [${roles.join(', ')}]; left as it is`;
    }
  } else {
    const inserted = await client.query(
      'INSERT INTO users (email, email_verified, name) VALUES ($1, false, NULL) RETURNING id',
      [email],
    );
    userId = inserted.rows[0].id;
    created = true;
  }

  for (const role of GLOBAL_ROLES) {
    const has = await client.query(
      'SELECT 1 FROM user_roles WHERE user_id = $1 AND global_role = $2 AND revoked_at IS NULL LIMIT 1',
      [userId, role],
    );
    if (has.rows.length === 0) {
      await client.query('INSERT INTO user_roles (user_id, global_role) VALUES ($1, $2)', [userId, role]);
    }
  }

  const personal = await client.query(`SELECT 1 FROM workspaces WHERE kind = 'personal' AND user_id = $1 LIMIT 1`, [
    userId,
  ]);
  if (personal.rows.length === 0) {
    await client.query(`INSERT INTO workspaces (kind, user_id) VALUES ('personal', $1)`, [userId]);
  }

  await client.query(
    `INSERT INTO admin_users (user_id, staff_roles, two_factor_enrolled)
     VALUES ($1, $2::staff_role[], false)`,
    [userId, admin.staffRoles],
  );
  await client.query(
    `INSERT INTO audit_events (actor_user_id, subject_type, subject_id, event_type, payload_diff, reason)
     VALUES (NULL, 'user', $1, 'staff.seeded', $2::jsonb, $3)`,
    [
      userId,
      JSON.stringify({ staffRoles: { from: null, to: admin.staffRoles } }),
      'Production admin named in scripts/seed-production-admins.mjs, granted on API start.',
    ],
  );

  return `${email}: ${created ? 'account created (invited) and' : 'existing account'} granted [${admin.staffRoles.join(', ')}]`;
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL is not set.');

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    if (await isSampleDatabase(client)) {
      console.log(
        `seed-production-admins: ${describeDatabase(url)} is a sample database; no production admin is written there.`,
      );
      return;
    }
    await client.query('BEGIN');
    // Two starts at once (a restart racing a deploy) must not both read "no grant yet".
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('seed-production-admins'))`);
    const lines = [];
    for (const admin of PRODUCTION_ADMINS) lines.push(await seedAdmin(client, admin));
    await client.query('COMMIT');
    for (const line of lines) console.log(`seed-production-admins: ${line}`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`seed-production-admins: ${error?.message ?? error}`);
  process.exitCode = 1;
});
