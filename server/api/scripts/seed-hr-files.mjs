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
 * Then every business with staff gets a starter set of its own HR lists (job
 * positions, employee types, tags and disciplinary types, 058-people-file
 * AC-PF11), the kind an owner would type on day one, and each seeded file with
 * no position takes the one its account's role suggests. They are ordinary
 * rows the owner may rename or archive under Staff, Configuration; nothing in
 * them is a fact about a real person.
 *
 * Idempotent: a membership that already has a file is skipped, a list row is
 * added only when no active row of that name exists, and a position is set
 * only on a file that has none, so a rerun writes nothing.
 *
 *   DATABASE_URL=... node scripts/seed-hr-files.mjs
 */
import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';

/** What an owner would type on day one (058-people-file AC-PF11). */
const STARTER = {
  job_positions: ['General manager', 'Front desk agent', 'Room attendant', 'Line cook', 'Waiter', 'Security guard'],
  employee_types: ['Permanent staff', 'Fixed term', 'Casual'],
  employee_tags: [
    ['First aid', 'ok'],
    ['Speaks French', 'info'],
    ['Night shift', 'neutral'],
  ],
  disciplinary_types: [
    ['Verbal warning', 'warning'],
    ['Written warning', 'warning'],
    ['Suspension', 'suspension'],
    ['Dismissal', 'dismissal'],
  ],
};

/** The position a seeded account's role suggests. */
const POSITION_FOR_ROLE = {
  manager: 'General manager',
  receptionist: 'Front desk agent',
  housekeeper: 'Room attendant',
};

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
      `insert into employees (org_id, org_membership_id, employee_number, legal_name, phone, email, hired_on, service_from)
       values ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [m.org_id, m.membership_id, number, m.legal_name, m.phone, m.email, m.hired_on],
    );
    written += 1;
  }

  // The starter lists, for every business that has staff on file.
  const { rows: orgs } = await client.query('select distinct org_id from employees');
  let listed = 0;
  for (const { org_id: orgId } of orgs) {
    for (const title of STARTER.job_positions) {
      const r = await client.query(
        `insert into job_positions (org_id, title)
         select $1, $2 where not exists
           (select 1 from job_positions where org_id = $1 and lower(title) = lower($2) and status = 'active')`,
        [orgId, title],
      );
      listed += r.rowCount ?? 0;
    }
    for (const title of STARTER.employee_types) {
      const r = await client.query(
        `insert into employee_types (org_id, title)
         select $1, $2 where not exists
           (select 1 from employee_types where org_id = $1 and lower(title) = lower($2) and status = 'active')`,
        [orgId, title],
      );
      listed += r.rowCount ?? 0;
    }
    for (const [title, tone] of STARTER.employee_tags) {
      const r = await client.query(
        `insert into employee_tags (org_id, title, tone)
         select $1, $2, $3::hr_tag_tone where not exists
           (select 1 from employee_tags where org_id = $1 and lower(title) = lower($2) and status = 'active')`,
        [orgId, title, tone],
      );
      listed += r.rowCount ?? 0;
    }
    for (const [title, kind] of STARTER.disciplinary_types) {
      const r = await client.query(
        `insert into disciplinary_types (org_id, title, kind)
         select $1, $2, $3::hr_disciplinary_kind where not exists
           (select 1 from disciplinary_types where org_id = $1 and lower(title) = lower($2) and status = 'active')`,
        [orgId, title, kind],
      );
      listed += r.rowCount ?? 0;
    }
  }

  // A position on each seeded file that has none, from its account's role.
  let placed = 0;
  for (const [role, title] of Object.entries(POSITION_FOR_ROLE)) {
    const r = await client.query(
      `update employees e
          set job_position_id = jp.id, updated_at = now()
         from org_memberships om, job_positions jp
        where om.id = e.org_membership_id
          and om.org_role = $1
          and jp.org_id = e.org_id and lower(jp.title) = lower($2) and jp.status = 'active'
          and e.job_position_id is null`,
      [role, title],
    );
    placed += r.rowCount ?? 0;
  }

  const { rowCount: linked } = await client.query(
    `update department_members dm
        set employee_id = e.id
       from employees e
      where e.org_membership_id = dm.org_membership_id
        and dm.employee_id is null`,
  );

  await client.query('commit');
  console.log(
    `HR staff files: ${written} written for seeded staff accounts, ${linked ?? 0} department row(s) linked, ${listed} starter list row(s), ${placed} position(s) set.`,
  );
} catch (error) {
  await client.query('rollback').catch(() => {});
  throw error;
} finally {
  await client.end().catch(() => {});
}
