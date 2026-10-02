#!/usr/bin/env node
/**
 * A staff file for every seeded staff account (ADR-058 AC-P5, on a SAMPLE
 * database).
 *
 * Migration 0053 gives a file to every active, non owner membership that
 * exists WHEN IT RUNS. That covers production, whose memberships predate it,
 * but not a database built the way CI, the demo rebuild and
 * `dev:stack:reset` build one: every migration first, then the seed. There the
 * backfill meets an empty `org_memberships`, the seeded manager and receptionist
 * get no file, and the Staff screen opens on nobody.
 *
 * So this step applies the migration's own rule after the seeds that create
 * memberships: the legal name and phone from the user (the proved phone, or
 * nothing), the hire date the day the membership was created in Kigali, the
 * statutory fields left empty for `detailsMissing` to name. Numbers are minted
 * as the API mints them, from `hr_counters`, skipping any already on a file.
 * The department roster rows of those people are pointed at their file, as the
 * migration does.
 *
 * Idempotent: a membership that already has a file is skipped, so a rerun
 * writes nothing.
 *
 *   DATABASE_URL=... node scripts/seed-hr-files.mjs
 */
import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('seed-hr-files: DATABASE_URL is not set.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await assertSampleDatabase(client, 'seed-hr-files.mjs');
  await client.query('begin');

  const { rows: todo } = await client.query(
    `select om.org_id, om.id as membership_id,
            coalesce(nullif(btrim(u.name), ''), u.email) as legal_name,
            u.phone_number as phone,
            lower(u.email) as email,
            (om.created_at at time zone 'Africa/Kigali')::date::text as hired_on
       from org_memberships om
       join users u on u.id = om.user_id
      where om.status = 'active'
        and om.org_role <> 'owner'
        and not exists (select 1 from employees e where e.org_membership_id = om.id)
      order by om.org_id, om.created_at, om.id`,
  );

  let written = 0;
  for (const m of todo) {
    // The API's minting: take the counter, and skip a number somebody typed.
    let number = null;
    for (let attempt = 0; attempt < 1000 && number === null; attempt++) {
      const { rows } = await client.query(
        `insert into hr_counters (org_id, next_employee_number) values ($1, 2)
         on conflict (org_id) do update
           set next_employee_number = hr_counters.next_employee_number + 1, updated_at = now()
         returning next_employee_number - 1 as minted`,
        [m.org_id],
      );
      const candidate = String(rows[0].minted).padStart(4, '0');
      const { rowCount } = await client.query(
        'select 1 from employees where org_id = $1 and employee_number = $2',
        [m.org_id, candidate],
      );
      if (!rowCount) number = candidate;
    }
    if (number === null) throw new Error(`could not mint an employee number for org ${m.org_id}`);

    await client.query(
      `insert into employees (org_id, org_membership_id, employee_number, legal_name, phone, email, hired_on)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [m.org_id, m.membership_id, number, m.legal_name, m.phone, m.email, m.hired_on],
    );
    written += 1;
  }

  const { rowCount: linked } = await client.query(
    `update department_members dm
        set employee_id = e.id
       from employees e
      where e.org_membership_id = dm.org_membership_id
        and dm.employee_id is null`,
  );

  await client.query('commit');
  console.log(`HR staff files: ${written} written for seeded staff accounts, ${linked ?? 0} department row(s) linked.`);
} catch (error) {
  await client.query('rollback').catch(() => {});
  throw error;
} finally {
  await client.end().catch(() => {});
}
