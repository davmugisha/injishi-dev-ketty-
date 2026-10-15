/**
 * platform.*: the housekeeper's day on the staff phone (`/staff`, StaffToday). Jeanne's waiting rooms
 * and the rooms already cleaned this morning, as `housekeeping_tasks` at Isangano.
 */
import { iid, kigaliAt, userId } from './lib.mjs';
import { PROPERTY, roomId, WORKSPACE } from './world.mjs';

/** The interface's kinds, in the API's task types. */
export const TASK_TYPE = {
  Checkout: 'checkout_clean',
  Stayover: 'stayover_clean',
  'Deep clean': 'deep_clean',
  Inspection: 'inspection',
  Turndown: 'turndown',
};

async function roomsDepartment(c) {
  const { rows } = await c.query(
    `SELECT id FROM departments WHERE property_id = $1 AND department_category = 'rooms' ORDER BY sort_order LIMIT 1`,
    [PROPERTY.isangano],
  );
  return rows[0]?.id ?? null;
}

export async function seed({ c, fx, log, keep }) {
  const department = await roomsDepartment(c);
  const jeanne = userId('housekeeper');
  const seeded = [];
  let written = 0;
  for (const t of fx('platform.housekeepingTasks')) {
    const type = TASK_TYPE[t.kind];
    if (!type) throw new Error(`platform.housekeepingTasks ${t.id}: unknown kind "${t.kind}"`);
    // A "Due 12:00" flag is a priority on the board; the time itself is the note's to carry.
    const priority = t.flag ? 50 : 0;
    seeded.push(iid('hk-task', `isangano:${t.room}:today`));
    await c.query(
      `INSERT INTO housekeeping_tasks
         (id, room_id, property_id, department_id, workspace_id, task_type, status, assigned_to_user_id, priority, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note, started_at = NULL, completed_at = NULL`,
      [iid('hk-task', `isangano:${t.room}:today`), roomId('isangano', t.room), PROPERTY.isangano, department,
        WORKSPACE.hotel, type, t.status === 'active' ? 'in_progress' : 'pending', jeanne, priority,
        [t.flag, t.note].filter(Boolean).join(' · ')],
    );
    written++;
  }
  for (const d of fx('platform.housekeepingDone')) {
    const type = TASK_TYPE[d.kind];
    const cleaned = d.when.match(/Cleaned (\d{2}:\d{2})/)?.[1] ?? '08:00';
    const inspected = d.state === 'Inspected';
    const done = kigaliAt(cleaned);
    seeded.push(iid('hk-task', `isangano:${d.room}:today`));
    await c.query(
      `INSERT INTO housekeeping_tasks
         (id, room_id, property_id, department_id, workspace_id, task_type, status, assigned_to_user_id, priority,
          note, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, NULL, $9, $10)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, started_at = EXCLUDED.started_at,
         completed_at = EXCLUDED.completed_at`,
      [iid('hk-task', `isangano:${d.room}:today`), roomId('isangano', d.room), PROPERTY.isangano, department,
        WORKSPACE.hotel, type, inspected ? 'inspected' : 'done', jeanne,
        new Date(done.getTime() - 35 * 60_000), done],
    );
    written++;
  }
  // The seed is the truth for the interface world: tasks people made during a demo day go when the seed
  // converges (seed-interface.mjs removes every task in the interface workspaces no module kept).
  keep('housekeeping_tasks', seeded);
  log(`platform: ${written} housekeeping tasks at Isangano for Jeanne Nyiraneza`);
}
