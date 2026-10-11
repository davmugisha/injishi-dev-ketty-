/**
 * Give every property its USALI department set (ADR-016, AC-14).
 *
 * Migration 0011 applies the template to every property that exists WHEN IT
 * RUNS, and `seedPropertyDepartments` in `operations/domain/usali-departments.ts`
 * applies it inside the transaction that creates a property through
 * listing-setup. A sample database satisfies neither: it is migrated EMPTY and
 * then filled by seeds that INSERT properties directly, so every property a
 * seed writes arrives with no departments at all.
 *
 * The consequence is not cosmetic. `guest_requestable` is the only thing
 * `GET /me/departments` selects on, so a property with no departments offers a
 * guest an EMPTY list of desks to write to — on the demo, the guest checked in
 * at Amahoro Musanze had nobody to message, because `seed-demo-hotel.mjs` seeds
 * departments for Amahoro Boutique Hotel alone and nothing else in the recipe
 * writes a single department row.
 *
 * So this is the same rule applied a third time, to whatever the seeds wrote.
 * It is deliberately the migration's rule verbatim — the same eleven rows, the
 * same categories, the same four marked `guest_requestable` — because a seed
 * that disagreed with the migration would make a seeded database differ from a
 * migrated one in exactly the way nobody thinks to check.
 *
 * EVERY property, including a residence building, for the same reason: that is
 * what migration 0011 does, and narrowing it here is a product decision, not a
 * seeding one.
 *
 * Idempotent. The insert rides `departments_property_category_uk`, the partial
 * unique index on `(property_id, department_category)`, so a second run adds
 * nothing. Without it a second run would double every list and the Rooms lookup
 * a room charge does would stop returning one row.
 */

/** The eleven rows, as migration 0011 spells them. Names are editable after. */
const USALI_ROWS = `(VALUES
  ('Rooms',                              'operated',       'rooms',           true,  true,   10),
  ('Food and Beverage',                  'operated',       'fnb',             true,  true,   20),
  ('Spa and Recreation',                 'operated',       'spa_recreation',  true,  true,   30),
  ('Other Operated Departments',         'operated',       'other_operated',  true,  false,  40),
  ('Miscellaneous Income',               'operated',       'misc_income',     true,  false,  50),
  ('Administrative and General',         'undistributed',  'admin_general',   false, false,  60),
  ('Sales and Marketing',                'undistributed',  'sales_marketing', false, false,  70),
  ('Information and Telecommunications', 'undistributed',  'it',              false, false,  80),
  ('Engineering and Maintenance',        'undistributed',  'engineering',     false, true,   90),
  ('Utilities',                          'undistributed',  'utilities',       false, false, 100),
  ('Human Resources',                    'undistributed',  'hr',              false, false, 110)
) AS t(name, dept_type, dept_category, is_revenue, guest_requestable, sort_order)`;

/**
 * Fill the gaps and return what was filled.
 *
 * `{ departments, roomTypes }`: department rows written, and room types that
 * were pointed at their property's Rooms desk. Both are zero on a second run,
 * which is the cheapest evidence that this is safe to re-run.
 */
export async function seedMissingDepartments(client) {
  const inserted = await client.query(
    `INSERT INTO departments (
       org_id, property_id, workspace_id, name,
       department_type, department_category,
       is_revenue_center, guest_requestable, sort_order
     )
     SELECT
       p.org_id, p.id, p.workspace_id, t.name,
       t.dept_type::"public"."department_type",
       t.dept_category::"public"."department_category",
       t.is_revenue, t.guest_requestable, t.sort_order
       FROM properties p
       CROSS JOIN ${USALI_ROWS}
     ON CONFLICT DO NOTHING`,
  );

  // A room charge has to be attributable the first time one posts (AC-14), and
  // a room type written by a seed before its property had departments points at
  // nothing. Only the blanks, so a room type an operator repointed by hand
  // stays where they put it.
  const repointed = await client.query(
    `UPDATE room_types rt
        SET department_id = d.id
       FROM departments d
      WHERE d.property_id = rt.property_id
        AND d.department_category = 'rooms'
        AND rt.department_id IS NULL`,
  );

  return {
    departments: inserted.rowCount ?? 0,
    roomTypes: repointed.rowCount ?? 0,
  };
}

/**
 * How many properties still hold no department at all.
 *
 * Read AFTER the fill, as the assertion the fill is for: the number a guest
 * feels is not "rows written" but "properties that can still offer nobody to
 * write to". Zero, or the recipe has a hole in it.
 */
export async function propertiesWithoutDepartments(client) {
  const { rows } = await client.query(
    `SELECT count(*)::int AS n
       FROM properties p
      WHERE NOT EXISTS (
        SELECT 1 FROM departments d WHERE d.property_id = p.id
      )`,
  );
  return rows[0]?.n ?? 0;
}
