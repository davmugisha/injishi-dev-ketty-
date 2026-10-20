/**
 * staff.*: the staff phone (housekeeper, supervisor, technician). What the phone records beyond the
 * operations floor (`operations.mjs`) and the people files (`people.mjs`), both of which run first:
 *
 * - Isangano's cleaning and inspection checklists, and the steps Jeanne ticked on room 207, which she
 *   marked clean with the balcony glass skipped (the inspector's queue says so).
 * - The minibar stock of an Isangano room.
 * - Corridor F2, the one place on Jeanne's floor that is not a room, for reporting a fault.
 * - The papers on Jeanne's file besides her contract: ID copy, RSSB registration, food hygiene certificate.
 *
 * Time on a work order is not seeded: it is what the technician's timer writes. Rows a demo day added to
 * the new tables are removed when the seed converges (every table is kept below).
 */
import { day, iid, kigaliAt, shiftDate } from './lib.mjs';
import { ORG, PROPERTY, WORKSPACE } from './world.mjs';

const CLEANING = [
  { code: 'bathroom', title: 'Bathroom', items: ['b1', 'b2', 'b3', 'b4'] },
  { code: 'bedroom', title: 'Bedroom', items: ['r1', 'r2', 'r3', 'r4'] },
  { code: 'linen', title: 'Linen', items: ['l1', 'l2', 'l3'] },
  { code: 'amenities', title: 'Amenities', items: ['a1', 'a2', 'a3', 'a4'] },
];

/** The cleaning step Jeanne left unticked on 207. */
const SKIPPED_ON_207 = 'r2';

/** Inspection checks whose failure needs a photo before the room goes back to its cleaner. */
const PHOTO_ON_FAIL = new Set(['glass']);

const MINIBAR_CODES = { water: 'water', soda: 'soda', beer: 'beer', crisps: 'crisps' };

const itemId = (kind, code) => iid('hk-checklist-item', `isangano:${kind}:${code}`);

async function upsertChecklist(c, rows) {
  for (const r of rows) {
    await c.query(
      `INSERT INTO housekeeping_checklist_items
         (id, workspace_id, property_id, kind, section_code, section_title, code, label, requires_photo, sort_order, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
       ON CONFLICT (id) DO UPDATE SET section_code = EXCLUDED.section_code, section_title = EXCLUDED.section_title,
         label = EXCLUDED.label, requires_photo = EXCLUDED.requires_photo, sort_order = EXCLUDED.sort_order,
         status = 'active'`,
      [r.id, WORKSPACE.hotel, PROPERTY.isangano, r.kind, r.sectionCode, r.sectionTitle, r.code, r.label, r.requiresPhoto,
        r.sortOrder],
    );
  }
  return rows.map((r) => r.id);
}

export async function seed({ c, fx, log, keep }) {
  // --- Checklists -------------------------------------------------------------------------------
  const labels = new Map(fx('staff.checklistSections').flatMap((s) => s.items.map((i) => [i.id, i.label])));
  const rows = [];
  let order = 0;
  for (const section of CLEANING) {
    for (const code of section.items) {
      const label = labels.get(code);
      if (!label) throw new Error(`staff.checklistSections has no item "${code}"`);
      rows.push({ id: itemId('cleaning', code), kind: 'cleaning', sectionCode: section.code, sectionTitle: section.title,
        code, label, requiresPhoto: false, sortOrder: (order += 10) });
    }
  }
  order = 0;
  for (const check of fx('staff.inspectionChecks')) {
    rows.push({ id: itemId('inspection', check.id), kind: 'inspection', sectionCode: 'inspection',
      sectionTitle: 'Inspection', code: check.id, label: check.label, requiresPhoto: PHOTO_ON_FAIL.has(check.id),
      sortOrder: (order += 10) });
  }
  keep('housekeeping_checklist_items', await upsertChecklist(c, rows));

  // Jeanne's ticks on 207 (platform.mjs writes the task; she cleaned it this morning).
  const task207 = iid('hk-task', 'isangano:207:today');
  const { rows: [t207] } = await c.query(`SELECT assigned_to_user_id, completed_at FROM housekeeping_tasks WHERE id = $1`, [task207]);
  if (!t207) throw new Error('staff: room 207 task is missing; platform.mjs must run first');
  const tickIds = [];
  for (const section of CLEANING) {
    for (const code of section.items) {
      if (code === SKIPPED_ON_207) continue;
      const id = iid('hk-task-check', `isangano:207:today:${code}`);
      tickIds.push(id);
      await c.query(
        `INSERT INTO housekeeping_task_checks (id, workspace_id, task_id, item_id, result, checked_by_user_id, checked_at)
         VALUES ($1, $2, $3, $4, 'done', $5, $6)
         ON CONFLICT (id) DO UPDATE SET result = 'done', photo_object_key = NULL, checked_at = EXCLUDED.checked_at`,
        [id, WORKSPACE.hotel, task207, itemId('cleaning', code), t207.assigned_to_user_id,
          t207.completed_at ?? kigaliAt('09:50')],
      );
    }
  }
  keep('housekeeping_task_checks', tickIds);

  // --- Minibar ----------------------------------------------------------------------------------
  const minibarIds = [];
  for (const [i, m] of fx('staff.minibarItems').entries()) {
    const code = MINIBAR_CODES[m.id];
    if (!code) throw new Error(`staff.minibarItems: unknown item "${m.id}"`);
    const id = iid('minibar-item', `isangano:${code}`);
    minibarIds.push(id);
    await c.query(
      `INSERT INTO minibar_items (id, workspace_id, property_id, code, label, par_level, sort_order, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
       ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, par_level = EXCLUDED.par_level,
         sort_order = EXCLUDED.sort_order, status = 'active'`,
      [id, WORKSPACE.hotel, PROPERTY.isangano, code, m.label, m.stocked, (i + 1) * 10],
    );
  }
  keep('minibar_items', minibarIds);
  // Counts are what a clean reports; a demo day's go when the seed converges.
  keep('minibar_counts', []);
  keep('maintenance_time_logs', []);

  // --- Corridor F2 ------------------------------------------------------------------------------
  const corridor = fx('staff.reportPlaces').find((p) => !p.isRoom);
  const corridorId = iid('space', 'isangano:corridor-f2');
  await c.query(
    `INSERT INTO spaces (id, property_id, name, description, floor, sort_order) VALUES ($1, $2, $3, $4, 2, 900)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, floor = EXCLUDED.floor`,
    [corridorId, PROPERTY.isangano, corridor.label, 'Second floor corridor, rooms 201 to 212'],
  );
  keep('spaces', [corridorId], { column: 'property_id', values: [PROPERTY.isangano, PROPERTY.ishyamba, PROPERTY.kacyiru] });

  // --- Papers on Jeanne's file ------------------------------------------------------------------
  const jeanne = iid('employee', 'hospitality:jn');
  const { rows: [file] } = await c.query(`SELECT hired_on FROM employees WHERE id = $1`, [jeanne]);
  if (!file) throw new Error('staff: Jeanne has no file; people.mjs must run first');
  const hired = file.hired_on instanceof Date ? file.hired_on.toISOString().slice(0, 10) : String(file.hired_on);
  const papers = [
    { key: 'national-id', title: 'National ID copy', issued: hired, expires: null },
    { key: 'rssb', title: 'RSSB registration', issued: hired, expires: null },
    { key: 'food-hygiene', title: 'Food hygiene certificate', issued: shiftDate('2026-02-14'), expires: shiftDate('2027-02-14') },
  ];
  const paperIds = [];
  for (const p of papers) {
    const id = iid('employee-document', `jn:${p.key}`);
    paperIds.push(id);
    await c.query(
      `INSERT INTO employee_documents (id, org_id, employee_id, title, status, issued_on, expires_on, remind_days_before)
       VALUES ($1, $2, $3, $4, 'approved', $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, status = 'approved', reject_reason = NULL,
         issued_on = EXCLUDED.issued_on, expires_on = EXCLUDED.expires_on, remind_days_before = EXCLUDED.remind_days_before`,
      [id, ORG.hotel, jeanne, p.title, p.issued, p.expires, p.expires ? 30 : null],
    );
  }
  keep('employee_documents', paperIds, { column: 'org_id', values: [ORG.hotel, ORG.residences] });

  log(`staff: ${rows.length} checklist items, ${tickIds.length} ticks on 207, ${minibarIds.length} minibar items, ` +
    `Corridor F2, ${paperIds.length} papers on Jeanne's file (today ${day(0)})`);
}
