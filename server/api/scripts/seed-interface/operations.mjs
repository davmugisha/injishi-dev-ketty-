/**
 * operations.*: the manager's operations floor at Isangano (real-data leaf 1.2.3).
 *
 *   /housekeeping   room floors and do-not-disturb, the housekeeping rules, today's allocation sheet,
 *                   the board's tasks (Jeanne's seven are platform.mjs's and are not touched here),
 *                   the open escalations and the recorded history of rooms 204, 207 and 112
 *   /maintenance    spaces and equipment, seven work orders with parts, timelines and room blocks,
 *                   and the condition signals (two open, two reviewed)
 *   /lost-found     six found items with their custody chains
 *
 * Three housekeepers on the board are not personas (Vestine Mukarugwiza, Emmanuel Nsengimana and
 * Odette Uwamahoro): they get demo accounts at @app.demo.injishi.com and a housekeeper membership at
 * Isangano, because a task is assigned to an account. The interface's supervisor and technician are
 * seeded as housekeepers (world.mjs ROLE_GAPS).
 *
 * Clock times are the fixture's ("Cleaned 11:15") on the seed's day; dates move with the seed day
 * (`day`, `shiftDate`). Every row this module writes is declared with `keep`, so a demo day's work
 * goes on the next seed.
 */
import { iid, kigaliAt, day, userId } from './lib.mjs';
import { ORG, PROPERTY, roomId, WORKSPACE } from './world.mjs';

const W = WORKSPACE.hotel;
const P = PROPERTY.isangano;

/** Housekeepers on the board who are not personas: demo accounts. */
const EXTRA_STAFF = {
  vm: { key: 'vestine-mukarugwiza', name: 'Vestine Mukarugwiza' },
  en: { key: 'emmanuel-nsengimana', name: 'Emmanuel Nsengimana' },
  ou: { key: 'odette-uwamahoro', name: 'Odette Uwamahoro' },
};
const staffUser = (key) => iid('user', `staff:${key}`);
/** The board's staff ids → accounts. */
const STAFF = {
  jn: userId('housekeeper'),
  bm: userId('supervisor'),
  vm: staffUser(EXTRA_STAFF.vm.key),
  en: staffUser(EXTRA_STAFF.en.key),
  ou: staffUser(EXTRA_STAFF.ou.key),
};
/** People named in the fixtures' prose, by full name. */
const PERSON = {
  'Jeanne Nyiraneza': userId('housekeeper'),
  'Beatrice Mukandori': userId('supervisor'),
  'Jean-Paul Niyonsaba': userId('technician'),
  'Aline Uwase': userId('manager'),
  'Eric Habimana': userId('frontdesk'),
  'Patrick Nshimiyimana': userId('store'),
  'Joseph Habimana': userId('outlet'),
  'Claudine Mukamana': userId('waiter'),
  'Emmanuel Nsengimana': STAFF.en,
  'Vestine Mukarugwiza': STAFF.vm,
  'Odette Uwamahoro': STAFF.ou,
};

const RULE_CODE = { checkout: 'checkout', stayover: 'stayover', inspection: 'inspection', turndown: 'turndown', deep: 'deep_clean' };
const RULE_TRIGGER = {
  checkout: { event: 'checkout' },
  stayover: { schedule: '07:00', rooms: 'occupied', after: 'do_not_disturb_lifted' },
  inspection: { after: 'checkout_clean_done', assign: 'floor_supervisor' },
  turndown: { schedule: '17:00', roomTypes: ['Family Suite'], guests: 'vip' },
  deep_clean: { everyDays: 30 },
};
const RULE_MINUTES = { checkout: 45, stayover: 20, inspection: null, turndown: 15, deep_clean: 90 };
const KIND_RULE = { Checkout: 'checkout', Stayover: 'stayover', Turndown: 'turndown', 'Deep clean': 'deep_clean' };
const TASK_TYPE = {
  Checkout: 'checkout_clean',
  Stayover: 'stayover_clean',
  'Deep clean': 'deep_clean',
  Inspection: 'inspection',
  Turndown: 'turndown',
};
const SEVERITY = { Critical: 'urgent', High: 'high', Normal: 'normal', Low: 'low' };

const ruleId = (code) => iid('hk-rule', `isangano:${code}`);
/** Jeanne's tasks are platform.mjs's rows; this module only refers to them. */
const platformTask = (room) => iid('hk-task', `isangano:${room}:today`);
const boardTask = (room) => iid('hk-task', `isangano:${room}:board`);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDay = (iso) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
const longDay = (iso) => `${shortDay(iso)} ${iso.slice(0, 4)}`;
/** "9–12 Oct", or "30 Sep–2 Oct" across a month. */
const dayRange = (from, to) =>
  from.slice(0, 7) === to.slice(0, 7) ? `${Number(from.slice(8, 10))}–${shortDay(to)}` : `${shortDay(from)}–${shortDay(to)}`;
function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function upsertStaff(c) {
  for (const [id, s] of Object.entries(EXTRA_STAFF)) {
    const uid = STAFF[id];
    const email = `${s.key.replace('-', '.')}@app.demo.injishi.com`;
    await c.query(
      `INSERT INTO users (id, email, email_verified, name) VALUES ($1, $2, true, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [uid, email, s.name],
    );
    const { rows } = await c.query(
      `SELECT id FROM org_memberships WHERE org_id = $1 AND user_id = $2 LIMIT 1`,
      [ORG.hotel, uid],
    );
    const membershipId = rows[0]?.id ?? iid('membership', `${ORG.hotel}:staff:${s.key}`);
    await c.query(
      `INSERT INTO org_memberships (id, org_id, user_id, org_role, status) VALUES ($1, $2, $3, 'housekeeper', 'active')
       ON CONFLICT (id) DO UPDATE SET org_role = 'housekeeper', status = 'active', removed_at = NULL`,
      [membershipId, ORG.hotel, uid],
    );
    await c.query(
      `INSERT INTO org_membership_branches (org_membership_id, property_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [membershipId, P],
    );
  }
}

async function departmentOf(c, category) {
  const { rows } = await c.query(
    `SELECT id FROM departments WHERE property_id = $1 AND department_category = $2 ORDER BY sort_order LIMIT 1`,
    [P, category],
  );
  return rows[0]?.id ?? null;
}

// --- housekeeping ---------------------------------------------------------------------------------

async function seedRooms(c, fx) {
  for (const r of fx('operations.rooms')) {
    // The fixture's "DND" note is a sign on the door: a do-not-disturb flag.
    const dnd = r.note === 'DND';
    await c.query(
      `UPDATE rooms SET floor = $2, service_flag = $3, service_flag_set_at = $4 WHERE id = $1`,
      [roomId('isangano', r.id), r.floor, dnd ? 'dnd' : null, dnd ? kigaliAt('08:00') : null],
    );
  }
}

async function seedRules(c, fx, keep) {
  const ids = [];
  for (const [i, r] of fx('operations.housekeepingRules').entries()) {
    const code = RULE_CODE[r.id];
    if (!code) throw new Error(`operations.housekeepingRules ${r.id}: no rule code`);
    const id = ruleId(code);
    ids.push(id);
    await c.query(
      `INSERT INTO housekeeping_rules
         (id, workspace_id, property_id, code, name, description, trigger, estimated_minutes, active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
         trigger = EXCLUDED.trigger, estimated_minutes = EXCLUDED.estimated_minutes, active = true,
         sort_order = EXCLUDED.sort_order`,
      [id, W, P, code, r.kind, r.when, JSON.stringify(RULE_TRIGGER[code]), RULE_MINUTES[code], (i + 1) * 10],
    );
  }
  keep('housekeeping_rules', ids);
  return ids.length;
}

async function seedAllocations(c, fx, keep) {
  const ids = [];
  for (const s of fx('operations.housekeepingStaff')) {
    const uid = STAFF[s.id];
    if (!uid) throw new Error(`operations.housekeepingStaff ${s.id}: no account`);
    const floors = [...s.area.matchAll(/Floors? (\d)(?:–(\d))?/g)].flatMap((m) => {
      const from = Number(m[1]);
      const to = m[2] ? Number(m[2]) : from;
      return Array.from({ length: to - from + 1 }, (_, k) => from + k);
    });
    const ends = kigaliAt(s.shiftEnd);
    const starts = new Date(ends.getTime() - 8 * 60 * 60_000);
    const id = iid('hk-allocation', `isangano:${s.id}`);
    ids.push(id);
    await c.query(
      `INSERT INTO housekeeping_allocations
         (id, workspace_id, property_id, work_date, user_id, role, section, floors, shift_starts_at, shift_ends_at,
          created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET work_date = EXCLUDED.work_date, role = EXCLUDED.role, section = EXCLUDED.section,
         floors = EXCLUDED.floors, shift_starts_at = EXCLUDED.shift_starts_at, shift_ends_at = EXCLUDED.shift_ends_at`,
      [id, W, P, day(0), uid, s.role === 'supervisor' ? 'supervisor' : 'attendant', s.area, floors, starts, ends,
        userId('supervisor')],
    );
  }
  keep('housekeeping_allocations', ids);
  return ids.length;
}

/** The board's tasks that are not Jeanne's (hers are platform.mjs's rows). */
async function seedTasks(c, fx, keep) {
  const department = await departmentOf(c, 'rooms');
  const ids = [];
  for (const t of fx('operations.cleaningTasks')) {
    if (t.assignee === 'jn') continue;
    const type = TASK_TYPE[t.kind];
    if (!type) throw new Error(`operations.cleaningTasks ${t.id}: unknown kind "${t.kind}"`);
    const id = boardTask(t.room);
    ids.push(id);
    let dueAt = null;
    let note = null;
    let startedAt = null;
    let completedAt = null;
    let inspectedAt = null;
    let inspectedBy = null;
    let status = 'pending';
    if (t.column === 'todo') {
      const m = t.due.match(/^Due (\d{2}:\d{2})(?: · (.*))?$/);
      if (m) {
        dueAt = kigaliAt(m[1]);
        note = m[2] ?? null;
      } else {
        // A time window ("17:00 – 19:00 · suite, VIP") is the note; it is due at the window's end.
        const w = t.due.match(/^\d{2}:\d{2} – (\d{2}:\d{2})/);
        dueAt = w ? kigaliAt(w[1]) : null;
        note = t.due;
      }
    } else if (t.column === 'doing') {
      status = 'in_progress';
      const m = t.due.match(/^Started (\d{2}:\d{2})(?: · due (\d{2}:\d{2}))?/);
      startedAt = m ? kigaliAt(m[1]) : kigaliAt('12:00');
      dueAt = m?.[2] ? kigaliAt(m[2]) : null;
    } else if (t.column === 'clean') {
      status = 'done';
      const m = t.due.match(/^Cleaned (\d{2}:\d{2})/);
      completedAt = kigaliAt(m ? m[1] : '11:00');
      startedAt = new Date(completedAt.getTime() - 40 * 60_000);
    } else {
      status = 'inspected';
      const m = t.due.match(/^Passed (\d{2}:\d{2}) · (.+)$/);
      inspectedAt = kigaliAt(m ? m[1] : '10:00');
      inspectedBy = PERSON[m?.[2]] ?? userId('supervisor');
      completedAt = new Date(inspectedAt.getTime() - 25 * 60_000);
      startedAt = new Date(completedAt.getTime() - 40 * 60_000);
    }
    await c.query(
      `INSERT INTO housekeeping_tasks
         (id, room_id, property_id, department_id, workspace_id, task_type, status, assigned_to_user_id, priority, note,
          started_at, completed_at, due_at, estimated_minutes, rule_id, inspected_at, inspected_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, assigned_to_user_id = EXCLUDED.assigned_to_user_id,
         priority = EXCLUDED.priority, note = EXCLUDED.note, started_at = EXCLUDED.started_at,
         completed_at = EXCLUDED.completed_at, due_at = EXCLUDED.due_at, estimated_minutes = EXCLUDED.estimated_minutes,
         rule_id = EXCLUDED.rule_id, inspected_at = EXCLUDED.inspected_at, inspected_by_user_id = EXCLUDED.inspected_by_user_id,
         inspection_note = NULL, reopened_from_task_id = NULL`,
      [id, roomId('isangano', t.room), P, department, W, type, status, t.assignee ? STAFF[t.assignee] : null,
        type === 'checkout_clean' ? 10 : 0, note, startedAt, completedAt, dueAt, t.minutes ?? null,
        t.auto ? ruleId(KIND_RULE[t.kind]) : null, inspectedAt, inspectedBy],
    );
  }
  keep('housekeeping_tasks', ids);
  return ids.length;
}

/** The escalations the fixture's board shows: 204 not started (supervisor, then manager), 207 waiting. */
async function seedEscalations(c, keep) {
  const rows = [
    { key: '204:supervisor', task: platformTask('204'), kind: 'not_started', level: 'supervisor', to: userId('supervisor'), at: '12:05' },
    { key: '204:manager', task: platformTask('204'), kind: 'not_started', level: 'manager', to: userId('manager'), at: '12:15' },
    { key: '207:manager', task: platformTask('207'), kind: 'awaiting_inspection', level: 'manager', to: userId('manager'), at: '12:20' },
  ];
  const ids = [];
  for (const e of rows) {
    const id = iid('hk-escalation', `isangano:${e.key}`);
    ids.push(id);
    await c.query(
      `INSERT INTO housekeeping_escalations
         (id, workspace_id, property_id, task_id, kind, level, escalated_to_user_id, raised_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET raised_at = EXCLUDED.raised_at, resolved_at = NULL, resolution = NULL,
         reminded_at = NULL, reminded_by_user_id = NULL`,
      [id, W, P, e.task, e.kind, e.level, e.to, kigaliAt(e.at)],
    );
  }
  keep('housekeeping_escalations', ids);
  return ids.length;
}

/** The recorded history of rooms 204, 207 and 112, as the fixture tells it (oldest first here). */
async function seedRoomHistory(c, keep) {
  const blockEnds = kigaliAt('12:00', 2);
  const events = [
    // 204: checked out, assigned by the floor rule, then escalated twice.
    { room: '204', kind: 'occupancy', from: 'occupied', to: 'dirty', summary: 'Occupied → Dirty', actor: userId('frontdesk'), detail: 'checked the guest out', at: kigaliAt('09:41') },
    { room: '204', kind: 'task_assigned', to: userId('housekeeper'), summary: 'Checkout task assigned to Jeanne Nyiraneza', label: 'Rule “Floor 2”', at: kigaliAt('09:42'), task: platformTask('204') },
    { room: '204', kind: 'escalation', to: 'supervisor', summary: 'Escalated to Beatrice Mukandori', label: 'System', detail: 'not started', at: kigaliAt('12:05'), task: platformTask('204') },
    { room: '204', kind: 'escalation', to: 'manager', summary: 'Escalated to Aline Uwase', label: 'System', detail: 'overdue 15 min', at: kigaliAt('12:15'), task: platformTask('204') },
    // 207: cleaned at 09:50 and still waiting for inspection.
    { room: '207', kind: 'occupancy', from: 'occupied', to: 'dirty', summary: 'Occupied → Dirty', actor: userId('frontdesk'), detail: 'checked the guest out', at: kigaliAt('08:12') },
    { room: '207', kind: 'housekeeping', from: 'dirty', to: 'clean', summary: 'Dirty → Clean', actor: userId('housekeeper'), detail: 'staff app', at: kigaliAt('09:50'), task: platformTask('207') },
    { room: '207', kind: 'task_created', to: 'inspection', summary: 'Inspection task for Beatrice Mukandori', label: 'Rule “Inspect after checkout”', at: kigaliAt('09:51'), task: platformTask('207') },
    { room: '207', kind: 'escalation', to: 'manager', summary: 'Waiting for inspection 2 h 30 min', label: 'System', detail: 'escalated to Aline Uwase', at: kigaliAt('12:20'), task: platformTask('207') },
    // 112: inspected, then the basin leak, then the block.
    { room: '112', kind: 'housekeeping', from: 'clean', to: 'inspected', summary: 'Clean → Inspected', actor: userId('supervisor'), at: kigaliAt('08:30', -1) },
    { room: '112', kind: 'fault_reported', summary: 'Fault reported with 2 photos', actor: userId('housekeeper'), detail: 'leak under the basin', at: kigaliAt('10:12', -1), ticket: 'WO-318' },
    { room: '112', kind: 'inventory', from: 'available', to: 'maintenance', summary: `Out of order until ${shortDay(day(2))}, 12:00`, actor: userId('manager'), detail: 'approved block WO-318', at: kigaliAt('10:31', -1), ticket: 'WO-318', ends: blockEnds },
  ];
  const ids = [];
  for (const [i, e] of events.entries()) {
    const id = iid('room-event', `isangano:${e.room}:${i}`);
    ids.push(id);
    await c.query(
      `INSERT INTO room_status_events
         (id, workspace_id, property_id, room_id, kind, from_value, to_value, summary, actor_user_id, actor_label, detail,
          housekeeping_task_id, maintenance_ticket_id, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (id) DO UPDATE SET summary = EXCLUDED.summary, occurred_at = EXCLUDED.occurred_at,
         detail = EXCLUDED.detail`,
      [id, W, P, roomId('isangano', e.room), e.kind, e.from ?? null, e.to ?? null, e.summary, e.actor ?? null,
        e.label ?? null, e.detail ?? null, e.task ?? null, e.ticket ? iid('work-order', e.ticket) : null, e.at],
    );
  }
  keep('room_status_events', ids);
  return ids.length;
}

// --- maintenance ------------------------------------------------------------------------------------

const SPACES = [
  { key: 'lake-bar', name: 'Lake Bar', description: 'Bar and lake terrace, 30 seats.' },
  { key: 'kivu-hall', name: 'Kivu Hall', description: 'Conference and events hall.' },
  { key: 'plant-room', name: 'Plant room', description: 'Generator and main electrical boards.' },
  { key: 'floor-3-plant-cupboard', name: 'Floor 3 plant cupboard', description: 'Water heaters for floor 3.' },
  { key: 'lift-shaft', name: 'Lift shaft', description: 'Passenger lift machinery.' },
];
const spaceId = (key) => iid('space', `isangano:${key}`);

const ASSETS = [
  { key: 'ice-machine', name: 'Ice machine', kind: 'refrigeration', space: 'lake-bar' },
  { key: 'projector', name: 'Projector', kind: 'audio_visual', space: 'kivu-hall' },
  { key: 'generator', name: 'Generator', kind: 'power', space: 'plant-room' },
  { key: 'water-heater-b', name: 'Water heater B', kind: 'water_heating', space: 'floor-3-plant-cupboard' },
  { key: 'ac-305', name: 'Air conditioner', kind: 'hvac', room: '305' },
  { key: 'lift-motor', name: 'Lift motor', kind: 'lift', space: 'lift-shaft' },
];
const assetId = (key) => iid('asset', `isangano:${key}`);

/** Each fixture work order, in the model's terms. Clock times and day offsets are the fixture's. */
const WORK_ORDERS = {
  'WO-318': {
    room: '112', status: 'in_progress', assignee: 'Jean-Paul Niyonsaba', raisedBy: 'Jeanne Nyiraneza', via: 'staff app',
    raisedAt: kigaliAt('10:12', -1), category: 'plumbing',
    release: 'Release needs the repair closed and a passed housekeeping inspection.',
    events: [
      ['reported', null, 'Jeanne Nyiraneza', kigaliAt('10:12', -1)],
      ['assigned', 'Assigned to Jean-Paul Niyonsaba', 'Beatrice Mukandori', kigaliAt('10:20', -1)],
      ['block_approved', null, 'Aline Uwase', kigaliAt('10:31', -1)],
      ['parts', 'Parts issued from store', 'Patrick Nshimiyimana', kigaliAt('14:05', -1)],
      ['started', null, 'Jean-Paul Niyonsaba', kigaliAt('08:30')],
      ['next_step', '24-hour leak test, then housekeeping inspection', null, kigaliAt('08:31')],
    ],
    block: { status: 'active', starts: kigaliAt('14:00', -1), ends: kigaliAt('12:00', 2), reason: 'Leak under the basin; the bathroom cannot be used.', requestedBy: 'Jean-Paul Niyonsaba', requestedAt: kigaliAt('10:25', -1), decidedBy: 'Aline Uwase', decidedAt: kigaliAt('10:31', -1) },
    parts: [
      { name: 'Basin waste trap, 32 mm', qty: 1, state: 'issued', source: 'Store · issued by Patrick Nshimiyimana' },
      { name: 'Flexible connector, ½ inch', qty: 2, state: 'issued', source: 'Store · issued by Patrick Nshimiyimana' },
      { name: 'Cabinet base board', qty: 1, state: 'ordered', po: 'PO-26-0147', due: day(1), source: `PO-26-0147 · due ${shortDay(day(1))}` },
    ],
  },
  'WO-324': {
    room: '302', status: 'assigned', assignee: 'Jean-Paul Niyonsaba', raisedBy: 'Eric Habimana', via: 'front desk · guest complaint',
    raisedAt: kigaliAt('07:55'), category: 'furniture',
    events: [
      ['reported', null, 'Eric Habimana', kigaliAt('07:55')],
      ['assigned', 'Assigned to Jean-Paul Niyonsaba', 'Beatrice Mukandori', kigaliAt('08:05')],
      ['block_requested', 'The window cannot be locked; the room should not be sold until the latch is fixed.', 'Jean-Paul Niyonsaba', kigaliAt('09:10')],
    ],
    block: { status: 'requested', starts: kigaliAt('14:00'), ends: kigaliAt('12:00', 2), reason: 'The window cannot be locked; the room should not be sold until the latch is fixed.', requestedBy: 'Jean-Paul Niyonsaba', requestedAt: kigaliAt('09:10') },
    parts: [
      { name: 'Window latch, aluminium frame', qty: 1, state: 'requested', source: 'Not in store · purchase request sent to Patrick Nshimiyimana' },
    ],
  },
  'WO-326': {
    space: 'lake-bar', asset: 'ice-machine', status: 'open', raisedBy: 'Joseph Habimana', via: 'Lake Bar',
    raisedAt: kigaliAt('11:30'), category: 'appliance',
    impact: 'Outlet equipment. Lake Bar keeps trading; Joseph Habimana has put a wet-floor sign out.',
    events: [['reported', null, 'Joseph Habimana', kigaliAt('11:30')]],
  },
  'WO-325': {
    space: 'kivu-hall', asset: 'projector', status: 'assigned', assignee: 'Jean-Paul Niyonsaba', raisedBy: 'Aline Uwase',
    via: 'from a condition signal', raisedAt: kigaliAt('09:00', -3), category: 'it_tech',
    impact: 'Kivu Hall stays bookable. Needed for the EAC Health Forum from ' + shortDay(day(11)) + '.',
    events: [
      ['from_signal', 'Created from signal “Lamp near end of life”', 'Aline Uwase', kigaliAt('09:00', -3)],
      ['assigned', 'Assigned to Jean-Paul Niyonsaba', 'Aline Uwase', kigaliAt('09:05', -3)],
      ['parts', 'Lamp ordered', 'Patrick Nshimiyimana', kigaliAt('10:00', -2)],
    ],
    parts: [{ name: 'Projector lamp', qty: 1, state: 'ordered', po: 'PO-26-0144', due: day(8), source: `PO-26-0144 · due ${shortDay(day(8))}` }],
  },
  'WO-321': {
    room: '402', status: 'assigned', contractor: 'Kivu Paint Works', raisedBy: 'Jean-Paul Niyonsaba', via: null,
    raisedAt: kigaliAt('16:00', -3), scheduled: day(2), category: 'other',
    release: 'Release after the contractor signs off and housekeeping inspects.',
    events: [
      ['reported', null, 'Jean-Paul Niyonsaba', kigaliAt('16:00', -3)],
      ['block_approved', null, 'Aline Uwase', kigaliAt('17:30', -3)],
      ['scheduled', `Contractor booked for ${dayRange(day(2), day(3))}`, 'Aline Uwase', kigaliAt('10:00', -2)],
    ],
    block: { status: 'active', starts: kigaliAt('09:00', -2), ends: kigaliAt('12:00', 4), reason: 'Ceiling repaint after a damp patch.', requestedBy: 'Jean-Paul Niyonsaba', requestedAt: kigaliAt('16:10', -3), decidedBy: 'Aline Uwase', decidedAt: kigaliAt('17:30', -3) },
    parts: [{ name: 'Paint and sealant', qty: 1, unit: 'lot', state: 'contractor', source: 'Supplied by the contractor' }],
  },
  'WO-327': {
    space: 'plant-room', asset: 'generator', status: 'assigned', contractor: 'Rubavu Power Services', raisedBy: null,
    via: 'planned schedule', raisedAt: kigaliAt('09:00', -27), scheduled: day(3), category: 'electrical',
    impact: 'Planned maintenance. Power cut-over test 10:00–10:20; front desk informed.',
    events: [['planned', 'Created from the maintenance plan · every 30 days', null, kigaliAt('09:00', -27)]],
  },
  'WO-319': {
    room: '209', status: 'closed', assignee: 'Jean-Paul Niyonsaba', raisedBy: 'Jeanne Nyiraneza', via: 'staff app',
    raisedAt: kigaliAt('15:00', -2), category: 'furniture', resolvedAt: kigaliAt('09:15', -1),
    verifiedAt: kigaliAt('10:00', -1), verifiedBy: 'Beatrice Mukandori', impact: 'No block was needed.',
    events: [
      ['reported', null, 'Jeanne Nyiraneza', kigaliAt('15:00', -2)],
      ['fixed', null, 'Jean-Paul Niyonsaba', kigaliAt('09:15', -1)],
      ['verified', null, 'Beatrice Mukandori', kigaliAt('10:00', -1)],
    ],
    parts: [{ name: 'Hinge screws', qty: 4, state: 'issued', source: 'Store' }],
  },
};

async function seedMaintenance(c, fx, keep) {
  const engineering = await departmentOf(c, 'engineering');
  // Spaces and equipment the orders are about.
  const spaceIds = [];
  for (const [i, s] of SPACES.entries()) {
    const id = spaceId(s.key);
    spaceIds.push(id);
    await c.query(
      `INSERT INTO spaces (id, property_id, name, description, sort_order) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
      [id, P, s.name, s.description, (i + 1) * 10],
    );
  }
  keep('spaces', spaceIds, { column: 'property_id', values: [PROPERTY.isangano, PROPERTY.ishyamba, PROPERTY.kacyiru] });
  const assetIds = [];
  for (const a of ASSETS) {
    const id = assetId(a.key);
    assetIds.push(id);
    await c.query(
      `INSERT INTO assets (id, workspace_id, property_id, room_id, space_id, name, kind) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, kind = EXCLUDED.kind, room_id = EXCLUDED.room_id,
         space_id = EXCLUDED.space_id`,
      [id, W, P, a.room ? roomId('isangano', a.room) : null, a.space ? spaceId(a.space) : null, a.name, a.kind],
    );
  }
  keep('assets', assetIds);

  const fixtures = new Map(fx('operations.workOrders').map((w) => [w.id, w]));
  const ticketIds = [];
  const eventIds = [];
  const partIds = [];
  const blockIds = [];
  for (const [ref, o] of Object.entries(WORK_ORDERS)) {
    const f = fixtures.get(ref);
    if (!f) throw new Error(`operations.workOrders has no ${ref}`);
    const id = iid('work-order', ref);
    ticketIds.push(id);
    const photos = f.photos.map((p) => ({ key: `stock:${p.image}`, caption: p.caption }));
    await c.query(
      `INSERT INTO maintenance_tickets
         (id, room_id, space_id, asset_id, property_id, org_id, workspace_id, department_id, raised_by_user_id,
          raised_by_role, raised_via, title, description, category, priority, status, reference, assigned_to_user_id,
          assigned_contractor, scheduled_for, impact_note, release_note, photo_object_keys, resolved_at, verified_at,
          verified_by_user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'staff', $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
               $22, $23, $24, $25, $26)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, assigned_to_user_id = EXCLUDED.assigned_to_user_id,
         assigned_contractor = EXCLUDED.assigned_contractor, scheduled_for = EXCLUDED.scheduled_for,
         impact_note = EXCLUDED.impact_note, release_note = EXCLUDED.release_note, resolved_at = EXCLUDED.resolved_at,
         verified_at = EXCLUDED.verified_at, verified_by_user_id = EXCLUDED.verified_by_user_id,
         created_at = EXCLUDED.created_at, title = EXCLUDED.title, description = EXCLUDED.description,
         priority = EXCLUDED.priority, photo_object_keys = EXCLUDED.photo_object_keys`,
      [id, o.room ? roomId('isangano', o.room) : null, o.space ? spaceId(o.space) : null, o.asset ? assetId(o.asset) : null,
        P, ORG.hotel, W, engineering, o.raisedBy ? PERSON[o.raisedBy] : null, o.via, f.title, f.issue, o.category,
        SEVERITY[f.severity], o.status, ref, o.assignee ? PERSON[o.assignee] : null, o.contractor ?? null,
        o.scheduled ?? null, o.impact ?? null, o.release ?? null, JSON.stringify(photos), o.resolvedAt ?? null,
        o.verifiedAt ?? null, o.verifiedBy ? PERSON[o.verifiedBy] : null, o.raisedAt],
    );
    for (const [i, [kind, note, actor, at]] of o.events.entries()) {
      const eid = iid('work-order-event', `${ref}:${i}`);
      eventIds.push(eid);
      await c.query(
        `INSERT INTO maintenance_events (id, ticket_id, author_user_id, kind, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, note = EXCLUDED.note, created_at = EXCLUDED.created_at`,
        [eid, id, actor ? PERSON[actor] : null, kind, note, at],
      );
    }
    for (const [i, p] of (o.parts ?? []).entries()) {
      const pid = iid('work-order-part', `${ref}:${i}`);
      partIds.push(pid);
      await c.query(
        `INSERT INTO maintenance_parts
           (id, workspace_id, ticket_id, name, quantity, unit, state, source, purchase_order_reference, due_on, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, source = EXCLUDED.source, due_on = EXCLUDED.due_on`,
        [pid, W, id, p.name, p.qty, p.unit ?? null, p.state, p.source, p.po ?? null, p.due ?? null, i],
      );
    }
    if (o.block) {
      const b = o.block;
      const bid = iid('room-block', ref);
      blockIds.push(bid);
      await c.query(
        `INSERT INTO room_blocks
           (id, workspace_id, property_id, room_id, maintenance_ticket_id, status, starts_at, ends_at, reason,
            requested_by_user_id, requested_at, decided_by_user_id, decided_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, starts_at = EXCLUDED.starts_at,
           ends_at = EXCLUDED.ends_at, decided_by_user_id = EXCLUDED.decided_by_user_id,
           decided_at = EXCLUDED.decided_at, decision_note = NULL, released_by_user_id = NULL, released_at = NULL`,
        [bid, W, P, roomId('isangano', o.room), id, b.status, b.starts, b.ends, b.reason, PERSON[b.requestedBy],
          b.requestedAt, b.decidedBy ? PERSON[b.decidedBy] : null, b.decidedAt ?? null],
      );
    }
  }
  keep('maintenance_tickets', ticketIds);
  // Notes a demo day added to these orders go on the next seed; orders it created go with their events.
  keep('maintenance_events', eventIds, { column: 'ticket_id', values: ticketIds });
  keep('maintenance_parts', partIds);
  keep('room_blocks', blockIds);
  return { orders: ticketIds.length, events: eventIds.length, parts: partIds.length, blocks: blockIds.length };
}

/** Condition signals: the two open ones of the fixture, and the two it shows as reviewed. */
async function seedSignals(c, fx, keep) {
  const open = fx('operations.conditionSignals');
  const reviews = fx('operations.signalReviews');
  const draftLocation = { s1: 'Room 305', s2: 'Water heater B' };
  const assetOf = { s1: 'ac-305', s2: 'water-heater-b' };
  const confidence = { High: 'high', Medium: 'medium', Low: 'low' };
  const rows = [
    ...open.map((s) => ({
      id: iid('condition-signal', s.id),
      asset: assetOf[s.id],
      label: s.asset,
      rule: s.rule,
      ruleText: s.ruleText,
      headline: s.headline,
      confidence: confidence[s.confidence],
      evidence: s.evidence,
      dataQuality: s.dataQuality,
      recommendation: s.recommendation,
      draft: s.draft
        ? {
            title: s.draft.title,
            description: s.draft.issue,
            priority: SEVERITY[s.draft.severity],
            location: draftLocation[s.id],
          }
        : null,
      status: 'open',
      raisedAt: kigaliAt('06:00'),
    })),
    {
      id: iid('condition-signal', reviews[0].id),
      asset: 'projector',
      label: 'Kivu Hall projector',
      rule: 'LP-01',
      ruleText: 'Rule LP-01 v1: lamp hours above 95% of rated life',
      headline: reviews[0].what,
      confidence: 'high',
      evidence: ['Lamp hours read from the projector menu: 2,860 of 3,000 rated'],
      dataQuality: 'Read by hand from the projector menu.',
      recommendation: 'Order a replacement lamp before the next large event.',
      draft: null,
      status: 'actioned',
      workOrder: iid('work-order', 'WO-325'),
      reviewedBy: userId('manager'),
      reviewedAt: kigaliAt('09:00', -3),
      reviewNote: 'WO-325 created',
      raisedAt: kigaliAt('07:00', -3),
    },
    {
      id: iid('condition-signal', reviews[1].id),
      asset: 'lift-motor',
      label: 'Lift motor',
      rule: 'LF-03',
      ruleText: 'Rule LF-03 v1: vibration above threshold for 10 minutes',
      headline: reviews[1].what,
      confidence: 'medium',
      evidence: ['Vibration sensor above threshold for 14 minutes after the morning peak'],
      dataQuality: 'Sensor last calibrated before the lift service.',
      recommendation: 'Check the motor mounts at the next lift service.',
      draft: null,
      status: 'dismissed',
      reviewedBy: userId('technician'),
      reviewedAt: kigaliAt('16:00', -4),
      reviewNote: 'sensor fault, recalibrated after service',
      raisedAt: kigaliAt('08:00', -4),
    },
  ];
  for (const s of rows) {
    await c.query(
      `INSERT INTO condition_signals
         (id, workspace_id, property_id, asset_id, asset_label, rule_code, rule_text, headline, confidence, evidence,
          data_quality, recommendation, draft, status, work_order_id, raised_at, reviewed_by_user_id, reviewed_at,
          review_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, work_order_id = EXCLUDED.work_order_id,
         reviewed_by_user_id = EXCLUDED.reviewed_by_user_id, reviewed_at = EXCLUDED.reviewed_at,
         review_note = EXCLUDED.review_note, raised_at = EXCLUDED.raised_at, draft = EXCLUDED.draft`,
      [s.id, W, P, assetId(s.asset), s.label, s.rule, s.ruleText, s.headline, s.confidence, JSON.stringify(s.evidence),
        s.dataQuality, s.recommendation, s.draft ? JSON.stringify(s.draft) : null, s.status, s.workOrder ?? null,
        s.raisedAt, s.reviewedBy ?? null, s.reviewedAt ?? null, s.reviewNote ?? null],
    );
  }
  keep('condition_signals', rows.map((s) => s.id));
  return rows.length;
}

// --- lost and found ---------------------------------------------------------------------------------

const CATEGORY = {
  Electronics: 'electronics',
  Jewellery: 'jewellery',
  Clothing: 'clothing',
  Accessories: 'accessories',
  Documents: 'documents',
  Cash: 'cash',
  Other: 'other',
};
const RETENTION_RULE = '90-day rule configured · unverified';

/** What the fixture says, in the register's columns. Offsets are days from today. */
const FOUND = {
  'LF-26-041': {
    location: 'Room 204', spot: 'bedside drawer', foundAt: kigaliAt('10:05'), by: 'Jeanne Nyiraneza', custodian: 'Beatrice Mukandori',
    status: 'claimed', photos: 2,
    claim: { name: 'Daniel Okafor', ref: 'BK-20437', matched: true, stay: 'ST-8812', room: '204', from: -3, to: 0,
      statement: 'black phone, blue case, cracked top-left corner, beach photo on the lock screen', openedBy: 'Eric Habimana', at: kigaliAt('11:48') },
    events: [
      ['found', 'Found in Room 204, bedside drawer', 'Jeanne Nyiraneza', '2 photos', kigaliAt('10:05')],
      ['handed_over', 'Handed to Beatrice Mukandori, sealed in bag B-2291', 'Jeanne Nyiraneza', 'both confirmed in the staff app', kigaliAt('10:12')],
      ['stored', 'Stored in Safe A, shelf 1', 'Beatrice Mukandori', null, kigaliAt('10:30')],
      ['claim_opened', 'Claim opened: guest called from Kigali', 'Eric Habimana', null, kigaliAt('11:48')],
    ],
  },
  'LF-26-040': {
    location: 'Isangano Terrace', spot: 'table 7', foundAt: kigaliAt('21:40', -1), by: 'Claudine Mukamana', custodian: 'Eric Habimana',
    status: 'stored', valuableNote: true,
    events: [
      ['found', 'Found at Isangano Terrace, table 7', 'Claudine Mukamana', null, kigaliAt('21:40', -1)],
      ['handed_over', 'Handed to the night desk, sealed in bag B-2288', 'Eric Habimana', null, kigaliAt('21:55', -1)],
      ['stored', 'Stored in Safe A, shelf 1', 'Eric Habimana', null, kigaliAt('22:05', -1)],
    ],
  },
  'LF-26-039': {
    location: 'Lake Bar', spot: 'terrace', foundAt: kigaliAt('18:10', -2), by: 'Joseph Habimana', custodian: 'Beatrice Mukandori',
    status: 'stored', note: (until) => `Held until ${longDay(until)}, then donated with two-person sign-off.`,
    events: [
      ['found', 'Found on the Lake Bar terrace', 'Joseph Habimana', null, kigaliAt('18:10', -2)],
      ['stored', 'Stored in store room L-2, bin 4', 'Beatrice Mukandori', null, kigaliAt('08:00', -1)],
    ],
  },
  'LF-26-037': {
    location: 'Kivu Hall', spot: 'row C', foundAt: kigaliAt('17:30', -5), by: 'Jean-Paul Niyonsaba', custodian: 'Beatrice Mukandori',
    status: 'stored', note: (until) => `Held until ${longDay(until)}. The workshop organiser has been emailed.`,
    events: [
      ['found', 'Found in Kivu Hall after a workshop', 'Jean-Paul Niyonsaba', null, kigaliAt('17:30', -5)],
      ['stored', 'Stored in store room L-2, bin 1', 'Beatrice Mukandori', null, kigaliAt('08:10', -4)],
    ],
  },
  'LF-26-033': {
    location: 'Room 311', spot: 'balcony', foundAt: kigaliAt('11:20', -7), by: 'Emmanuel Nsengimana', custodian: null,
    status: 'returned',
    claim: { name: 'Yuki Tanaka', ref: 'BK-20391', matched: true, room: '311', from: -10, to: -7,
      statement: 'brown glasses case, sunglasses with a scratch on the left lens', openedBy: 'Eric Habimana', at: kigaliAt('15:30', -3) },
    release: { method: 'in_person', by: 'Eric Habimana', at: kigaliAt('16:40', -3) },
    events: [
      ['found', 'Found on the Room 311 balcony', 'Emmanuel Nsengimana', null, kigaliAt('11:20', -7)],
      ['stored', 'Stored in store room L-2, bin 2', 'Beatrice Mukandori', null, kigaliAt('12:00', -7)],
      ['returned', 'Returned to Yuki Tanaka in person', 'Eric Habimana', 'passport checked', kigaliAt('16:40', -3)],
    ],
  },
  'LF-26-021': {
    location: 'Lobby', spot: 'seating area', foundAt: kigaliAt('09:00', -91), by: 'Eric Habimana', custodian: 'Beatrice Mukandori',
    status: 'disposal_pending',
    disposal: { note: 'donate both items to a local charity', by: 'Beatrice Mukandori', at: kigaliAt('15:20', -1) },
    events: [
      ['found', 'Found in the lobby seating area', 'Eric Habimana', null, kigaliAt('09:00', -91)],
      ['stored', 'Stored in store room L-2, bin 7', 'Beatrice Mukandori', null, kigaliAt('10:00', -91)],
      ['disposal_proposed', 'Disposal proposed: donate to a local charity', 'Beatrice Mukandori', null, kigaliAt('15:20', -1)],
    ],
  },
};

async function seedLostFound(c, fx, keep) {
  const itemIds = [];
  const eventIds = [];
  for (const f of fx('operations.foundItems')) {
    const o = FOUND[f.id];
    if (!o) throw new Error(`operations.foundItems ${f.id}: not described`);
    const id = iid('found-item', f.id);
    itemIds.push(id);
    const foundDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(o.foundAt);
    const until = addDays(foundDay, 90);
    const retentionNote = o.valuableNote
      ? `Valuable: held in Safe A until ${longDay(until)}. The Terrace bookings for ${shortDay(foundDay)} are being checked for a match.`
      : o.note
        ? o.note(until)
        : 'Held 90 days from the day it was found, then handled under the disposal rule with two-person sign-off.';
    const claim = o.claim;
    const matchNote = claim
      ? `${claim.name} · ${claim.ref}${claim.stay ? ` · stay ${claim.stay}` : ''} · Room ${claim.room}, ${dayRange(day(claim.from), day(claim.to))}. Room and dates match where the item was found.`
      : null;
    const release = o.release;
    const closedNote = release
      ? `Returned to ${claim.name} (${claim.ref}, Room ${claim.room}, ${dayRange(day(claim.from), day(claim.to))}) in person on ${shortDay(day(-3))}. Passport checked by ${release.by}; signature captured.`
      : null;
    const roomLabel = o.location.match(/^Room (.+)$/)?.[1];
    await c.query(
      `INSERT INTO found_items
         (id, org_id, workspace_id, property_id, reference, description, category, valuable, found_location, found_spot,
          room_id, found_at, found_by_user_id, found_by_name, custodian_user_id, storage_location, photo_count, status,
          retention_until, retention_note, claimant_name, claim_booking_reference, claim_statement, claim_matched,
          claim_match_note, claim_opened_at, claim_opened_by_user_id, release_method, released_at, released_by_user_id,
          disposal_note, disposal_rule, disposal_proposed_by_user_id, disposal_proposed_at, closed_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
               $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, found_at = EXCLUDED.found_at,
         custodian_user_id = EXCLUDED.custodian_user_id, storage_location = EXCLUDED.storage_location,
         retention_until = EXCLUDED.retention_until, retention_note = EXCLUDED.retention_note,
         claimant_name = EXCLUDED.claimant_name, claim_booking_reference = EXCLUDED.claim_booking_reference,
         claim_statement = EXCLUDED.claim_statement, claim_matched = EXCLUDED.claim_matched,
         claim_match_note = EXCLUDED.claim_match_note, claim_opened_at = EXCLUDED.claim_opened_at,
         claim_opened_by_user_id = EXCLUDED.claim_opened_by_user_id, release_method = EXCLUDED.release_method,
         released_at = EXCLUDED.released_at, released_by_user_id = EXCLUDED.released_by_user_id,
         disposal_note = EXCLUDED.disposal_note, disposal_rule = EXCLUDED.disposal_rule,
         disposal_proposed_by_user_id = EXCLUDED.disposal_proposed_by_user_id,
         disposal_proposed_at = EXCLUDED.disposal_proposed_at, disposal_approved_by_user_id = NULL, disposed_at = NULL,
         closed_note = EXCLUDED.closed_note`,
      [id, ORG.hotel, W, P, f.id, f.item, CATEGORY[f.category] ?? 'other', f.valuable, o.location, o.spot,
        roomLabel ? roomId('isangano', roomLabel) : null, o.foundAt, PERSON[o.by] ?? null, o.by,
        o.custodian ? PERSON[o.custodian] : null, release ? null : f.storage, o.photos ?? 0, o.status, until,
        retentionNote, claim?.name ?? null, claim?.ref ?? null, claim?.statement ?? null, claim ? claim.matched : null,
        matchNote, claim?.at ?? null, claim ? PERSON[claim.openedBy] : null, release?.method ?? null, release?.at ?? null,
        release ? PERSON[release.by] : null, o.disposal?.note ?? null, o.disposal ? RETENTION_RULE : null,
        o.disposal ? PERSON[o.disposal.by] : null, o.disposal?.at ?? null, closedNote],
    );
    for (const [i, [kind, summary, actor, detail, at]] of o.events.entries()) {
      const eid = iid('found-item-event', `${f.id}:${i}`);
      eventIds.push(eid);
      await c.query(
        `INSERT INTO found_item_events (id, workspace_id, found_item_id, kind, summary, actor_user_id, actor_name, detail,
                                        occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET summary = EXCLUDED.summary, detail = EXCLUDED.detail,
           occurred_at = EXCLUDED.occurred_at`,
        [eid, W, id, kind, summary, PERSON[actor] ?? null, PERSON[actor] ? null : actor, detail, at],
      );
    }
  }
  keep('found_items', itemIds);
  keep('found_item_events', eventIds);
  return itemIds.length;
}

export async function seed({ c, fx, log, keep }) {
  await upsertStaff(c);
  await seedRooms(c, fx);
  const rules = await seedRules(c, fx, keep);
  const staff = await seedAllocations(c, fx, keep);
  const tasks = await seedTasks(c, fx, keep);
  // Work orders before room history: a history line names the order it came from.
  const maintenance = await seedMaintenance(c, fx, keep);
  const escalations = await seedEscalations(c, keep);
  const history = await seedRoomHistory(c, keep);
  const signals = await seedSignals(c, fx, keep);
  const found = await seedLostFound(c, fx, keep);
  log(
    `operations: ${rules} housekeeping rules, ${staff} on today's sheet, ${tasks} board tasks (plus Jeanne's from platform), ` +
      `${escalations} escalations, ${history} room history lines, ${maintenance.orders} work orders ` +
      `(${maintenance.parts} parts, ${maintenance.blocks} blocks), ${signals} condition signals, ${found} found items`,
  );
}
