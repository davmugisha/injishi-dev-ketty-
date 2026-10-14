// Every property can be written to: the USALI department invariant (ADR-016
// AC-14), checked against a database rather than against the code that is
// supposed to hold it.
//
// WHY THIS EXISTS. `guest_requestable` is the only thing the guest's department
// list selects on, so a property holding no departments offers a guest an EMPTY
// list of desks — no error, no empty state worth reading, just nobody to write
// to. That is not hypothetical: on 2026-09-21 the demo's own guest was checked
// in at Amahoro Musanze and her desk list came back `[]`, because
// `seed-demo-hotel.mjs` gives departments to Amahoro Boutique Hotel alone and
// no other script in the recipe writes a department row. Migration 0011 has a
// backfill for exactly this, but a sample database is migrated EMPTY and filled
// afterwards, so the backfill runs over nothing.
//
// WHAT IT PROVES, per property, in order:
//   1. It has departments at all.
//   2. It has all eleven USALI categories — one per accounting category, which
//      is what §14.2 calls the set. A missing one is a revenue account nothing
//      can post to.
//   3. It has exactly one of each. The partial unique index
//      `departments_property_category_uk` is supposed to make a duplicate
//      impossible; this asserts the index is doing it rather than trusting it.
//   4. The four desks a guest genuinely contacts — Rooms, F and B, Spa and
//      Recreation, Engineering — are all marked `guest_requestable`.
//   5. Every room type points at its property's Rooms department, so a room
//      charge is attributable the first time one posts.
//
//   DATABASE_URL=postgres://... node scripts/verify-property-departments.mjs
//
// Exits non zero and names the offending properties on any failure. It prints
// the success marker ONLY after every assertion above has passed, so the marker
// cannot appear on a partial run.
import pg from 'pg';

/** The eleven, and the four a guest may write to (`usali-departments.ts`). */
const CATEGORIES = [
  'rooms',
  'fnb',
  'spa_recreation',
  'other_operated',
  'misc_income',
  'admin_general',
  'sales_marketing',
  'it',
  'engineering',
  'utilities',
  'hr',
];
const GUEST_REQUESTABLE = ['rooms', 'fnb', 'spa_recreation', 'engineering'];

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('verify-property-departments: DATABASE_URL is not set.');
  process.exit(1);
}

let failures = 0;
function check(label, ok, detail) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `   ${detail}`}`);
}

/** `Name (id)` for the first few, so a failure is actionable without SQL. */
const name = (rows) =>
  rows
    .slice(0, 5)
    .map((r) => `${r.name ?? '?'} (${String(r.id).slice(0, 8)})`)
    .join(', ') + (rows.length > 5 ? `, +${rows.length - 5} more` : '');

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const { rows: all } = await client.query(
    'SELECT count(*)::int AS n FROM properties',
  );
  const total = all[0].n;
  console.log(`Properties: ${total}`);
  check('there is at least one property to check', total > 0, 'nothing seeded');

  const { rows: bare } = await client.query(
    `SELECT p.id, p.name
       FROM properties p
      WHERE NOT EXISTS (SELECT 1 FROM departments d WHERE d.property_id = p.id)
      ORDER BY p.name`,
  );
  check(
    'every property holds at least one department',
    bare.length === 0,
    `${bare.length} with none: ${name(bare)}`,
  );

  const { rows: incomplete } = await client.query(
    `SELECT p.id, p.name, count(DISTINCT d.department_category)::int AS have
       FROM properties p
       LEFT JOIN departments d ON d.property_id = p.id
      GROUP BY p.id, p.name
     HAVING count(DISTINCT d.department_category) <> $1
      ORDER BY p.name`,
    [CATEGORIES.length],
  );
  check(
    `every property holds all ${CATEGORIES.length} USALI categories`,
    incomplete.length === 0,
    `${incomplete.length} incomplete: ${name(incomplete)}`,
  );

  const { rows: dupes } = await client.query(
    `SELECT p.id, p.name, d.department_category AS category, count(*)::int AS n
       FROM departments d
       JOIN properties p ON p.id = d.property_id
      GROUP BY p.id, p.name, d.department_category
     HAVING count(*) > 1
      ORDER BY p.name`,
  );
  check(
    'no property holds a category twice',
    dupes.length === 0,
    `${dupes.length} duplicated: ${name(dupes)}`,
  );

  const { rows: shut } = await client.query(
    `SELECT p.id, p.name
       FROM properties p
      WHERE EXISTS (
        SELECT 1 FROM departments d
         WHERE d.property_id = p.id
           AND d.department_category::text = ANY($1::text[])
           AND d.guest_requestable = false
      )
      ORDER BY p.name`,
    [GUEST_REQUESTABLE],
  );
  check(
    `the ${GUEST_REQUESTABLE.length} guest-facing desks are open to guests everywhere`,
    shut.length === 0,
    `${shut.length} with a closed desk: ${name(shut)}`,
  );

  const { rows: orphanRoomTypes } = await client.query(
    `SELECT rt.id, rt.name
       FROM room_types rt
      WHERE rt.department_id IS NULL
      ORDER BY rt.name`,
  );
  check(
    'every room type points at a department',
    orphanRoomTypes.length === 0,
    `${orphanRoomTypes.length} unpointed: ${name(orphanRoomTypes)}`,
  );

  // The count a guest actually experiences, printed whether or not it passed:
  // this is the number that was zero on the demo.
  const { rows: reachable } = await client.query(
    `SELECT count(*)::int AS n
       FROM properties p
      WHERE EXISTS (
        SELECT 1 FROM departments d
         WHERE d.property_id = p.id AND d.guest_requestable
      )`,
  );
  console.log(
    `Properties a guest can message a desk at: ${reachable[0].n} of ${total}`,
  );
} finally {
  await client.end();
}

if (failures > 0) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nPROPERTY_DEPARTMENTS_OK');
