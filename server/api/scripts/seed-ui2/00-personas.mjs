#!/usr/bin/env node
/**
 * Two people join Amahoro Hospitality Group, the demo hotel (ADR-069 D-h):
 *
 *   | Person         | Role      | Email                            |
 *   |----------------|-----------|----------------------------------|
 *   | Grace Uwera    | `finance` | grace.uwera@demo.injishi.com     |
 *   | Diane Ingabire | `hr`      | diane.ingabire@demo.injishi.com  |
 *
 * Each is written the way `seed-demo.mjs` writes Solange and Denise: a user
 * with a verified identity (a manual KYC check against a national ID, the ID
 * held as the primary identity document), the `guest` global role everyone
 * holds, and an active Amahoro membership in their role. Then what the rest of
 * the recipe gives Amahoro's staff: an HR file (ADR-058, the rule of migration
 * 0053 and `seed-hr-files.mjs`, which ran before this file and so never saw
 * these two memberships), a job position on it, and a place in a department of
 * the head office (Grace in Administrative and General, Diane heading Human
 * Resources), which is where USALI files an accountant and an HR officer.
 *
 * EVERY BRANCH. A membership with no `org_membership_branches` row covers every
 * branch (ADR-054), which is how Yves, Solange and Denise stand; only Clarisse
 * is limited. So any limit row is removed rather than one row per branch
 * written: a branch Amahoro opens later is covered without a reseed.
 *
 * IDS. The users are `de300000-0000-4000-8000-0069 00 NNNNNN`, the ui2 block
 * (`seed-ui2.mjs`), family `00`. Inside the `de300000-0000-4000-8000-` prefix,
 * so `/api/v1/demo/personas` lists them; outside every block another seed
 * mints: `seed-demo.mjs` takes `…0000000000NN` for its seventeen people and the
 * `0029` block for the hotel, `seed-demo-hotel.mjs` `0017`, the portfolio
 * `003x`, PSF `0056`, and `seed-users.mjs` lets Postgres pick. Neither email is
 * in use, though two names come close: `grace@demo.injishi.com` is Grace
 * Kwizera, a guest, and `reception@injishi.com` is also named Diane Ingabire.
 * The national IDs carry the female digit (7) in the sixth place, which no
 * seeded ID does, so no identity document can collide.
 *
 * Rows whose ids the database mints (membership, file, position, department
 * place) hang off these users and Amahoro's `de300000-` org, which is what
 * marks them demo; the job titles are ordinary ones an owner would type.
 *
 * IDEMPOTENT. Every insert is ON CONFLICT DO NOTHING or guarded on its natural
 * key, so a second run writes nothing. A membership somebody removed in the app
 * (an offboarding demonstrated on stage) is left removed and reported, never
 * quietly rehired: the nightly rebuild is what restores it.
 *
 * Runs as step 00 of `seed-ui2.mjs`; on its own:
 *   DATABASE_URL=... node scripts/seed-ui2/00-personas.mjs
 */
import pg from 'pg';

import { assertSampleDatabase } from '../sample-database.mjs';

/** The ui2 block, family 00: the personas. */
const ID = (n) => `de300000-0000-4000-8000-006900${String(n).padStart(6, '0')}`;

/** `seed-demo.mjs`: O(1), W(1) and PR(1), the head office in Remera. */
const AMAHORO_ORG = 'de300000-0000-4000-8000-000000000101';
const AMAHORO_WORKSPACE = 'de300000-0000-4000-8000-000000000201';
const AMAHORO_NAME = 'Amahoro Hospitality Group';
const HEAD_OFFICE = 'de300000-0000-4000-8000-000000000401';

const PEOPLE = [
  {
    id: ID(1),
    email: 'grace.uwera@demo.injishi.com',
    name: 'Grace Uwera',
    role: 'finance',
    nid: '1198870069000101',
    position: { title: 'Accountant', category: 'admin_general' },
    department: { category: 'admin_general', position: 'staff', titles: ['Accountant'] },
  },
  {
    id: ID(2),
    email: 'diane.ingabire@demo.injishi.com',
    name: 'Diane Ingabire',
    role: 'hr',
    nid: '1199170069000202',
    position: { title: 'HR officer', category: 'hr' },
    department: { category: 'hr', position: 'department_head', titles: ['HR officer'] },
  },
];

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('00-personas: DATABASE_URL is not set.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

/** What this run wrote, per person, so a rerun visibly writes nothing. */
const wrote = [];
const note = (what) => wrote.push(what);

/** INSERT and report whether a row went in. */
async function insert(sql, params, what) {
  const { rowCount } = await client.query(sql, params);
  if (rowCount) note(what);
  return rowCount > 0;
}

/** Refuse rather than guess when an id, an email or an ID number is somebody else's. */
async function assertFree(p) {
  const { rows: byEmail } = await client.query('SELECT id FROM users WHERE lower(email) = lower($1)', [p.email]);
  if (byEmail[0] && byEmail[0].id !== p.id) {
    throw new Error(`${p.email} belongs to another account (${byEmail[0].id}); refusing to guess which is the persona.`);
  }
  const { rows: byId } = await client.query('SELECT email FROM users WHERE id = $1', [p.id]);
  if (byId[0] && byId[0].email.toLowerCase() !== p.email) {
    throw new Error(`${p.id} is already ${byId[0].email}; the ui2 persona block has been reused.`);
  }
  const { rows: byNid } = await client.query(
    `SELECT identity_id FROM identity_documents
      WHERE document_type = 'national_id' AND document_number = $1 AND issuing_country = 'RW'`,
    [p.nid],
  );
  if (byNid[0] && byNid[0].identity_id !== p.id) {
    throw new Error(`national ID ${p.nid} is held by ${byNid[0].identity_id}; pick another for ${p.name}.`);
  }
}

/** The account and its verified identity, as `seedPerson` in `seed-demo.mjs`. */
async function seedPerson(p) {
  await insert(
    `INSERT INTO users (id, email, email_verified, name) VALUES ($1, $2, true, $3)
     ON CONFLICT DO NOTHING`,
    [p.id, p.email, p.name],
    `${p.email}: user`,
  );
  await insert(
    `INSERT INTO user_profiles (user_id, display_name, national_id) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [p.id, p.name, p.nid],
    `${p.email}: profile`,
  );
  await insert(
    `INSERT INTO verified_identities (user_id, kyc_status, legal_full_name, verified_method, verified_at)
     VALUES ($1, 'verified', $2, 'manual', now())
     ON CONFLICT DO NOTHING`,
    [p.id, p.name],
    `${p.email}: verified identity`,
  );
  await insert(
    `INSERT INTO identity_documents
       (identity_id, document_type, document_number, issuing_country, status, is_primary, verified_at)
     VALUES ($1, 'national_id', $2, 'RW', 'active', true, now())
     ON CONFLICT DO NOTHING`,
    [p.id, p.nid],
    `${p.email}: national ID`,
  );
  await insert(
    `INSERT INTO user_roles (user_id, global_role)
     SELECT $1::uuid, 'guest'::global_role
      WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = $1 AND global_role = 'guest' AND revoked_at IS NULL)`,
    [p.id],
    `${p.email}: guest role`,
  );
}

/**
 * The Amahoro membership, on every branch. Returns it, or null when somebody
 * removed it in the app, which this seed leaves as they left it.
 */
async function seedMembership(p) {
  await insert(
    `INSERT INTO org_memberships (org_id, user_id, org_role) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [AMAHORO_ORG, p.id, p.role],
    `${p.email}: ${p.role} membership`,
  );
  const { rows } = await client.query(
    `SELECT id, org_role, status, (created_at AT TIME ZONE 'Africa/Kigali')::date::text AS joined_on
       FROM org_memberships WHERE org_id = $1 AND user_id = $2`,
    [AMAHORO_ORG, p.id],
  );
  const m = rows[0];
  if (m.status !== 'active') {
    console.log(`  ${p.email}: membership is ${m.status}; left as it is (the nightly rebuild restores it).`);
    return null;
  }
  // Nothing in the app changes a member's role, so a different one is an older
  // seed's; converge on the persona's.
  if (m.org_role !== p.role) {
    await client.query('UPDATE org_memberships SET org_role = $2, updated_at = now() WHERE id = $1', [m.id, p.role]);
    note(`${p.email}: role ${m.org_role} -> ${p.role}`);
  }
  const { rowCount } = await client.query('DELETE FROM org_membership_branches WHERE org_membership_id = $1', [m.id]);
  if (rowCount) note(`${p.email}: ${rowCount} branch limit(s) lifted`);
  return m;
}

/** The API's employee number minting (`seed-hr-files.mjs`): the counter, skipping a typed number. */
async function mintEmployeeNumber(orgId) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const { rows } = await client.query(
      `INSERT INTO hr_counters (org_id, next_employee_number) VALUES ($1, 2)
       ON CONFLICT (org_id) DO UPDATE
         SET next_employee_number = hr_counters.next_employee_number + 1, updated_at = now()
       RETURNING next_employee_number - 1 AS minted`,
      [orgId],
    );
    const candidate = String(rows[0].minted).padStart(4, '0');
    const { rowCount } = await client.query(
      'SELECT 1 FROM employees WHERE org_id = $1 AND employee_number = $2',
      [orgId, candidate],
    );
    if (!rowCount) return candidate;
  }
  throw new Error(`could not mint an employee number for org ${orgId}`);
}

/**
 * The HR file, migration 0053's rule: the name and email from the account, the
 * hire date the day the membership began in Kigali, the statutory fields left
 * empty for `detailsMissing` to name, as on every other seeded staff file.
 * Then the position the role suggests, added to Amahoro's list when missing.
 */
async function seedFile(p, m) {
  const { rows: files } = await client.query(
    `SELECT id, status, job_position_id FROM employees WHERE org_membership_id = $1
      ORDER BY (status = 'active') DESC, created_at DESC LIMIT 1`,
    [m.id],
  );
  let file = files[0];
  if (!file) {
    const number = await mintEmployeeNumber(AMAHORO_ORG);
    const { rows } = await client.query(
      `INSERT INTO employees (org_id, org_membership_id, employee_number, legal_name, email, hired_on, service_from)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING id, status, job_position_id`,
      [AMAHORO_ORG, m.id, number, p.name, p.email, m.joined_on],
    );
    file = rows[0];
    note(`${p.email}: staff file ${number}`);
  }
  if (file.status !== 'active') {
    console.log(`  ${p.email}: staff file is ${file.status}; left as it is.`);
    return null;
  }

  await insert(
    `INSERT INTO job_positions (org_id, title, department_category)
     SELECT $1::uuid, $2::text, $3::department_category
      WHERE NOT EXISTS (SELECT 1 FROM job_positions WHERE org_id = $1 AND lower(title) = lower($2) AND status = 'active')`,
    [AMAHORO_ORG, p.position.title, p.position.category],
    `${AMAHORO_NAME}: job position ${p.position.title}`,
  );
  if (file.job_position_id === null) {
    const { rowCount } = await client.query(
      `UPDATE employees e SET job_position_id = jp.id, updated_at = now()
         FROM job_positions jp
        WHERE e.id = $1 AND e.job_position_id IS NULL
          AND jp.org_id = $2 AND lower(jp.title) = lower($3) AND jp.status = 'active'`,
      [file.id, AMAHORO_ORG, p.position.title],
    );
    if (rowCount) note(`${p.email}: position ${p.position.title}`);
  }
  return file;
}

/** Their department at the head office, on the roster boards read (`department_members`). */
async function seedDepartment(p, m, file) {
  const { rows } = await client.query(
    `SELECT id, name, head_name FROM departments
      WHERE property_id = $1 AND department_category = $2::department_category AND status = 'active'
      LIMIT 1`,
    [HEAD_OFFICE, p.department.category],
  );
  const dept = rows[0];
  if (!dept) {
    throw new Error(
      `Amahoro Boutique Hotel has no active ${p.department.category} department; seed-demo-hotel.mjs writes them and must run first.`,
    );
  }
  await insert(
    `INSERT INTO department_members
       (department_id, org_membership_id, user_id, employee_id, workspace_id,
        department_position, job_titles, is_primary)
     SELECT $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::department_position, $7::jsonb, true
      WHERE NOT EXISTS (
        SELECT 1 FROM department_members
         WHERE department_id = $1 AND status = 'active'
           AND (user_id = $3 OR org_membership_id = $2 OR employee_id = $4))
     ON CONFLICT DO NOTHING`,
    [dept.id, m.id, p.id, file.id, AMAHORO_WORKSPACE, p.department.position, JSON.stringify(p.department.titles)],
    `${p.email}: ${p.department.position.replace('_', ' ')}, ${dept.name}`,
  );
  // A head is also the department's contact card (`departments.head_name`),
  // filled only where nobody has typed one.
  if (p.department.position === 'department_head' && dept.head_name === null) {
    await client.query('UPDATE departments SET head_name = $2, updated_at = now() WHERE id = $1 AND head_name IS NULL', [
      dept.id,
      p.name,
    ]);
    note(`${dept.name}: head ${p.name}`);
  }
}

try {
  await assertSampleDatabase(client, 'seed-ui2/00-personas.mjs');

  const { rows: ws } = await client.query(
    `SELECT o.id, o.legal_name, o.registration_status FROM workspaces w JOIN orgs o ON o.id = w.org_id WHERE w.id = $1`,
    [AMAHORO_WORKSPACE],
  );
  if (ws[0]?.id !== AMAHORO_ORG || ws[0]?.legal_name !== AMAHORO_NAME) {
    throw new Error(`workspace ${AMAHORO_WORKSPACE} is not ${AMAHORO_NAME}; seed-demo.mjs must run first.`);
  }
  if (ws[0].registration_status !== 'active') {
    // A business still in the pipeline grants nobody anything (D20), so the
    // personas would sign in to an empty grant.
    throw new Error(`${AMAHORO_NAME} is ${ws[0].registration_status}, not active; its staff would hold no permission.`);
  }

  await client.query('BEGIN');
  for (const p of PEOPLE) {
    await assertFree(p);
    await seedPerson(p);
    const membership = await seedMembership(p);
    if (!membership) continue;
    const file = await seedFile(p, membership);
    if (!file) continue;
    await seedDepartment(p, membership, file);
  }
  await client.query('COMMIT');

  console.log(
    wrote.length === 0
      ? `ui2 personas: Grace Uwera (finance) and Diane Ingabire (hr) already at ${AMAHORO_NAME}; nothing written.`
      : `ui2 personas at ${AMAHORO_NAME}, ${wrote.length} write(s):\n${wrote.map((w) => `  ${w}`).join('\n')}`,
  );
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(`00-personas: ${error?.message ?? error}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
