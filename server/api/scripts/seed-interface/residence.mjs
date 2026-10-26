/**
 * residence.*: Kacyiru Court Residences as the residence manager's screens read it.
 *
 *   blocks and units   three blocks and the 24 units (rooms of residence room types) with their asking
 *                      rent (residence.blocks, residence.units, residence.vacancies)
 *   leases             the register: 22 tenancies in force, Sandrine's draft for A-05, and the two
 *                      tenancies that ended this quarter (A-05, C-03), with their caution deposits and
 *                      filings (residence.leases, the filing stage of each)
 *   rent               every month of this year each tenancy owed, as `rent_charges`, paid as the rent
 *                      roll's history says; the payments the ledgers name (verified, pending, unknown)
 *                      and the reminders sent (residence.rentRoll, residence.rentLedgers, the KPIs)
 *   renewals           the landlord's offers: Olivier's open one, Ange's accepted one, two signed
 *   notices            Esperance's move-out notice for A-02
 *   repairs            the board's six tickets with their conversations and the internal note
 *   gate               the codes, the visitor log and the two access requests
 *   pipeline           the clause templates and the three applications
 *   settlement         the landlord's two rent settlements (residence.payouts)
 *
 * Dates. Contract dates (a lease's term, a rent month, a notice's move-out day) stay on the calendar.
 * What happened "this week" in the story (a repair reported last night, a code for today, a payment
 * started at 09:41) moves with the seed day through `shiftDate`/`kigaliAt`, and rent months are counted
 * back from the seed day's month, so the roll always shows the last four months.
 *
 * Money is whole francs. Tenants other than Olivier (the resident persona) have no account: the lease
 * names them. Everything written here is in the residences workspace and converges on a re-run.
 */
import { day, iid, kigaliAt, parseFixtureDate, shiftDate, TODAY, userId } from './lib.mjs';
import { ORG, PROPERTY, roomId, roomTypeId, WORKSPACE } from './world.mjs';

const WS = WORKSPACE.residences;
const P = PROPERTY.kacyiru;
const SOLANGE = userId('residence');
const OLIVIER = userId('resident');
/** Every table this module keeps is scoped to the residences workspace: the hotel's rows are never in reach. */
const MINE = { column: 'workspace_id', values: [WS] };

export const leaseId = (ref) => iid('lease', `kacyiru:${ref}`);
export const ticketId = (ref) => iid('residence-ticket', `kacyiru:${ref}`);
export const threadId = (ref) => iid('residence-thread', `kacyiru:${ref}`);
export const unitRoom = (label) => roomId('kacyiru', label);

/**
 * Insert or update rows by id (the column list comes from this module, never from input).
 * Returns the ids written. jsonb values must already be JSON strings.
 */
export async function upsert(c, table, rows, { keepCreated = false } = {}) {
  if (rows.length === 0) return [];
  const cols = Object.keys(rows[0]);
  const ids = [];
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const params = [];
    const values = chunk
      .map((r) => {
        const keys = Object.keys(r);
        if (keys.length !== cols.length || keys.some((k, j) => k !== cols[j])) {
          throw new Error(`${table}: every row must carry the same columns in the same order`);
        }
        return `(${cols.map((col) => { params.push(r[col]); return `$${params.length}`; }).join(', ')})`;
      })
      .join(', ');
    const set = cols
      .filter((col) => col !== 'id' && !(keepCreated && col === 'created_at'))
      .map((col) => `${col} = EXCLUDED.${col}`)
      .join(', ');
    const { rows: out } = await c.query(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES ${values}
       ON CONFLICT (id) DO ${set ? `UPDATE SET ${set}` : 'NOTHING'} RETURNING id`,
      params,
    );
    ids.push(...out.map((r) => r.id));
  }
  return ids;
}

// ── Calendar helpers ──────────────────────────────────────────────────────────────────────────────

/** "15 Nov 2025" as a calendar date that does not move (a contract date). */
const onCalendar = (text) => parseFixtureDate(text);
/** "11 Oct" as a day of this week's story: moves with the seed day. */
const story = (text) => shiftDate(parseFixtureDate(text));
/** The first day of the month `offset` months from the seed day's month, YYYY-MM-01. */
export function monthStart(offset = 0) {
  const d = new Date(`${TODAY.slice(0, 7)}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 10);
}
/** Day `n` of the month that starts on `month`. */
const dayOf = (month, n) => `${month.slice(0, 8)}${String(n).padStart(2, '0')}`;
const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const at = (iso, time) => new Date(`${iso}T${time}:00+02:00`);
/** Whole months between two YYYY-MM-01 dates. */
const monthsBetween = (a, b) =>
  (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
const dueDayOf = (text) => Number.parseInt(text, 10);

// ── What the fixtures leave implicit ──────────────────────────────────────────────────────────────

/** The tenancies that ended this quarter: the previous residents of the two vacant units. */
const ENDED = [
  { ref: 'L-KC-011', unit: 'A-05', name: 'Gilbert Nshuti', rent: 700000, start: '25 Sep 2025', end: '24 Sep 2026', signed: '20 Sep 2025' },
  { ref: 'L-KC-006', unit: 'C-03', name: 'Aimable Karangwa', rent: 1050000, start: '1 Sep 2025', end: '1 Sep 2026', signed: '27 Aug 2025' },
];

/** A-05's previous resident is still being settled; C-03's was refunded on 18 Sep (residence.depositKpis). */
const SETTLED = { 'L-KC-006': { refunded: 2075000, forfeited: 25000, on: '18 Sep', reason: 'End-of-tenancy cleaning, agreed at inspection' } };

/** Leases whose filing is still open: sent and unacknowledged, or a draft (residence.filings). */
const OPEN_FILINGS = { 'L-KC-014': { due: '25 Nov 2025' }, 'L-KC-021': { due: '12 Sep 2026' }, 'L-KC-022': { due: '17 Oct 2026' } };

/** Payments the ledgers name, by unit and rent month offset (0 = this month). */
const PAYMENTS = [
  { unit: 'A-03', month: -1, amount: 400000, method: 'mtn_momo', ref: 'MP260909.1422.C11873', status: 'verified', when: ['9 Sep', '14:22'] },
  { unit: 'C-05', month: -2, amount: 800000, method: 'airtel_money', ref: 'AM260820.0915.77310', status: 'verified', when: ['20 Aug', '09:15'] },
  { unit: 'B-07', month: -1, amount: 950000, method: 'mtn_momo', ref: 'MP260914.0812.B55210', status: 'verified', when: ['14 Sep', '08:12'] },
  { unit: 'B-07', month: 0, amount: 950000, method: 'mtn_momo', ref: 'MP261012.0941.B77162', status: 'pending', when: ['12 Oct', '09:41'] },
  { unit: 'C-07', month: 0, amount: 1200000, method: 'airtel_money', ref: 'AM261012.0812.77158', status: 'unknown', when: ['12 Oct', '08:12'] },
];

/** The reminders the ledgers list, as channels. */
const REMINDER_CHANNEL = [
  [/^In-app and email/, 'in_app_email'],
  [/^In-app/, 'in_app'],
  [/^Call/, 'call'],
  [/^Formal letter/, 'letter'],
  [/^Invoice/, 'email'],
];

/** The renewal offers behind the leases screen and the home feed. */
const OFFERS = [
  {
    lease: 'L-KC-014', status: 'open', rent: 980000, months: 12, starts: '15 Nov 2026', ends: '14 Nov 2027',
    topup: 60000, answerBy: story('15 Oct'), sent: at(story('1 Oct'), '10:00'), opened: at(story('2 Oct'), '18:40'),
    reminded: at(story('10 Oct'), '09:00'), answered: null, signed: null,
  },
  {
    lease: 'L-KC-009', status: 'accepted', rent: 870000, months: 12, starts: '1 Dec 2026', ends: '30 Nov 2027',
    topup: 40000, answerBy: story('15 Oct'), sent: at(story('25 Sep'), '10:00'), opened: at(story('26 Sep'), '08:30'),
    reminded: null, answered: at(story('8 Oct'), '09:12'), signed: null,
  },
  {
    lease: 'L-KC-015', status: 'signed', rent: 700000, months: 12, starts: '5 Sep 2026', ends: '4 Sep 2027',
    topup: 0, answerBy: story('20 Aug'), sent: at(story('1 Aug'), '10:00'), opened: at(story('2 Aug'), '19:00'),
    reminded: null, answered: at(story('14 Aug'), '11:30'), signed: at(story('20 Aug'), '16:05'),
  },
  {
    lease: 'L-KC-004', status: 'signed', rent: 1000000, months: 12, starts: '1 Aug 2026', ends: '31 Jul 2027',
    topup: 0, answerBy: onCalendar('10 Jul 2026'), sent: at(onCalendar('20 Jun 2026'), '10:00'),
    opened: at(onCalendar('21 Jun 2026'), '07:45'), reminded: null, answered: at(onCalendar('2 Jul 2026'), '12:10'),
    signed: at(onCalendar('9 Jul 2026'), '15:40'),
  },
];

/** The board's tickets, beyond what residence.tickets prints. */
const TICKETS = {
  'WO-347': { space: 'B', reporter: 'B-03', status: 'open', category: 'electrical', enter: null, via: 'resident app', reported: ['11 Oct', '21:05'] },
  'WO-345': {
    unit: 'B-07', reporter: 'B-07', status: 'assigned', category: 'plumbing', enter: true, via: 'resident app',
    reported: ['11 Oct', '19:12'], contractor: 'Kigali Plumbing Co.', visit: ['13 Oct', '10:00'], costNote: 'unless misuse is found',
  },
  'WO-343': {
    unit: 'C-01', reporter: 'C-01', status: 'assigned', category: 'doors_windows', enter: false, via: null,
    reported: ['10 Oct', '08:30'], contractor: 'Fidèle Ntawukuriryayo', visit: ['14 Oct', 'after 17:00'],
  },
  'WO-344': {
    unit: 'A-05', reporter: null, status: 'assigned', category: 'decoration', enter: null, via: 'move-out inspection',
    reported: ['25 Sep', '11:00'], contractor: 'Kigali Paint Works', visit: ['14 Oct', '08:00'],
    costNote: 'part recovered from caution if approved',
  },
  'WO-341': {
    unit: 'A-06', reporter: 'A-06', status: 'in_progress', category: 'plumbing', enter: true, via: null,
    reported: ['9 Oct', '07:10'], contractor: 'Fidèle Ntawukuriryayo', visit: ['13 Oct', null],
  },
  'WO-338': {
    unit: 'B-02', reporter: 'B-02', status: 'resolved', category: 'electrical', enter: true, via: null,
    reported: ['6 Oct', '18:00'], contractor: 'Fidèle Ntawukuriryayo', resolved: ['9 Oct', '15:10'], costNote: 'RWF 28,000 part',
  },
};

/** The gate's codes (residence.visitors, plus the ones already used, which the list leaves out). */
const PASSES = [
  { code: '4821', unit: 'B-07', name: 'Jean Uwizeye', kind: 'guest', byTenant: true, status: 'expected', from: [0, '14:00'], to: [0, '20:00'] },
  { code: '7730', unit: 'B-07', name: 'Kigali Plumbing Co.', kind: 'contractor', byTenant: false, status: 'approved', from: [1, '09:30'], to: [1, '12:30'], ticket: 'WO-345' },
  { code: '5114', unit: 'A-05', name: 'Kigali Paint Works, 2 people', kind: 'contractor', byTenant: false, status: 'approved', from: [2, '07:30'], to: [2, '17:00'], ticket: 'WO-344' },
  // Claude's guest came and left on Saturday; the code was never closed, so it reads expired.
  { code: '1956', unit: 'A-01', name: 'Claudette Umuhoza', kind: 'guest', byTenant: true, status: 'expected', from: [-2, '12:00'], to: [-2, '18:00'] },
  { code: '3302', unit: 'B-05', name: 'Delphine Mukeshimana', kind: 'guest', byTenant: true, status: 'used', from: [0, '08:00'], to: [0, '18:00'], used: [0, '09:12'], left: [0, '10:40'] },
];

/** The visitor log's rows, located: a unit, or a place in the compound. */
const LOG = {
  'log-1': { unit: 'B-05', pass: '3302', arrived: [0, '09:12'], left: [0, '10:40'] },
  'log-2': { unit: 'A-05', arrived: [0, '08:30'], left: [0, '09:05'] },
  'log-3': { unit: 'C-06', arrived: [-1, '18:05'], left: [-1, '22:30'] },
  'log-4': { unit: 'A-01', pass: '1956', arrived: [-2, '12:20'], left: [-2, '17:45'] },
  'log-5': { place: 'Block C · roof', arrived: [-3, '10:00'], left: [-3, '11:30'] },
};

/** The two things waiting for a decision at the gate (residence.accessRequests). */
const ACCESS = {
  amina: {
    unit: 'C-04', kind: 'overnight', visitor: 'Amina Abdallah', from: story('15 Oct'), to: story('29 Oct'),
    reason: 'Sister · ID to be shown at the gate on arrival', requested: at(story('11 Oct'), '17:20'),
  },
  dhl: {
    unit: 'C-02', kind: 'delivery', visitor: 'courier', from: TODAY, to: null,
    reason: 'DHL courier at 10:22 · Jean-Claude Habiyaremye not answering · guard Fidèle asks what to do',
    requested: at(story('12 Oct'), '10:22'),
  },
};

/** Applications beyond the profile the screen prints (residence.applicants). */
const APPLICATIONS = {
  sandrine: { stage: 'screening', email: 'sandrine.iradukunda@app.demo.injishi.com', phone: '+250 788 000 3107', term: 12, broker: true },
  florence: { stage: 'ready', email: 'florence.nyiransabimana@app.demo.injishi.com', phone: '+250 722 000 5890', term: 24, broker: false },
  peter: { stage: 'invited', email: 'peter.otieno@app.demo.injishi.com', phone: null, term: null, broker: false, invited: '10 Oct' },
};
const SCREENING = ['identity', 'income', 'employment', 'reference', 'balance', 'rules'];
const DOC_STATE = { Checked: 'checked', Uploaded: 'uploaded', Waiting: 'waiting', Requested: 'requested' };

const CATEGORY = { Plumbing: 'plumbing', Electrical: 'electrical', 'Doors and locks': 'doors_windows', Decoration: 'decoration', Appliances: 'appliance' };
const STATUS = { new: 'open', assigned: 'assigned', progress: 'in_progress', done: 'resolved' };

export async function seed(ctx) {
  const { c, fx, log, keep } = ctx;
  const blocks = fx('residence.blocks');
  const units = fx('residence.units');
  const register = fx('residence.leases');
  const roll = fx('residence.rentRoll');
  const unitByLabel = new Map(units.map((u) => [u.id, u]));
  const written = {};
  const kept = (table, ids, scope = MINE) => {
    written[table] = (written[table] ?? 0) + ids.length;
    keep(table, ids, scope);
  };

  // ── Blocks, the common areas they are, room types and units ─────────────────────────────────────
  const blockRows = blocks.map((b, i) => ({
    id: iid('block', `kacyiru:${b.id}`), workspace_id: WS, property_id: P, code: b.id, name: b.name, kind: b.kind, sort_order: i,
  }));
  kept('property_blocks', await upsert(c, 'property_blocks', blockRows));
  // Each block is a place a repair can be about ("Block B · stairwell"): a space of the property.
  const spaceRows = blocks.map((b, i) => ({
    id: iid('space', `kacyiru:${b.id}`), property_id: P, name: b.name, description: `Common areas of ${b.name}: stairs, landings, roof`, sort_order: i,
  }));
  kept('spaces', await upsert(c, 'spaces', spaceRows), { column: 'property_id', values: [P] });

  const types = [...new Set(units.map((u) => u.type))];
  const typeRows = types.map((type) => {
    const ofType = units.filter((u) => u.type === type);
    return {
      id: roomTypeId('kacyiru', type), property_id: P, workspace_id: WS, name: type, domain: 'residence',
      room_count: ofType.length, base_price_rwf: Math.min(...ofType.map((u) => u.rent)),
      max_guests: type.startsWith('1') ? 2 : type.startsWith('2') ? 4 : 6,
    };
  });
  kept('room_types', await upsert(c, 'room_types', typeRows));
  const roomRows = units.map((u) => ({
    id: unitRoom(u.id), room_type_id: roomTypeId('kacyiru', u.type), property_id: P, workspace_id: WS, label: u.id,
    status: 'available', housekeeping_status: 'clean',
  }));
  kept('rooms', await upsert(c, 'rooms', roomRows));
  const vacancies = new Map(fx('residence.vacancies').map((v) => [v.unit, v]));
  const unitRows = units.map((u) => {
    const vacancy = vacancies.get(u.id);
    return {
      id: iid('residence-unit', `kacyiru:${u.id}`), workspace_id: WS, property_id: P, room_id: unitRoom(u.id),
      block_id: iid('block', `kacyiru:${u.block}`), asking_rent_rwf: u.rent,
      vacant_since: vacancy ? day(-vacancy.days) : null,
      note: u.id === 'A-05' ? 'Previous resident’s caution settlement is in progress.' : u.id === 'C-03' ? 'Ready to let.' : null,
    };
  });
  kept('residence_units', await upsert(c, 'residence_units', unitRows));

  // ── The lease register ───────────────────────────────────────────────────────────────────────────
  const occupants = { 'L-KC-014': 'Ines Habineza' };
  const leaseRows = [
    ...register.map((l) => {
      const draft = !l.signedOn;
      const signed = draft ? null : onCalendar(l.signedOn);
      return {
        id: leaseId(l.id), room_id: unitRoom(l.unit), org_id: ORG.residences, workspace_id: WS,
        tenant_user_id: l.id === 'L-KC-014' ? OLIVIER : null, reference: l.id, tenant_name: l.resident,
        monthly_rent_rwf: l.rent, caution_rwf: l.rent * 2, start_date: onCalendar(l.start), end_date: onCalendar(l.end),
        status: draft ? 'draft' : 'active', rent_due_day: dueDayOf(l.dueDay), grace_days: 5, notice_period_days: 30,
        occupants: occupants[l.id] ?? null,
        tenant_signed_at: signed ? at(addDays(signed, -1), '19:31') : null,
        landlord_signed_at: signed ? at(signed, '08:14') : null,
        contract_content: JSON.stringify({ clauses: 'standard', edits: l.edits ?? [] }),
      };
    }),
    ...ENDED.map((l) => ({
      id: leaseId(l.ref), room_id: unitRoom(l.unit), org_id: ORG.residences, workspace_id: WS, tenant_user_id: null,
      reference: l.ref, tenant_name: l.name, monthly_rent_rwf: l.rent, caution_rwf: l.rent * 2,
      start_date: onCalendar(l.start), end_date: onCalendar(l.end), status: 'ended', rent_due_day: 1, grace_days: 5,
      notice_period_days: 30, occupants: null, tenant_signed_at: at(addDays(onCalendar(l.signed), -1), '18:00'),
      landlord_signed_at: at(onCalendar(l.signed), '09:00'), contract_content: JSON.stringify({ clauses: 'standard', edits: [] }),
    })),
  ];
  const leaseIds = await upsert(c, 'leases', leaseRows);
  kept('leases', leaseIds);
  const byLease = { column: 'lease_id', values: leaseIds };
  const leaseOfUnit = new Map(register.filter((l) => l.signedOn).map((l) => [l.unit, l]));

  // Filings: every signed tenancy was filed and acknowledged, except the three still open.
  const filingRows = leaseRows
    .filter((l) => l.landlord_signed_at)
    .map((l) => {
      const open = OPEN_FILINGS[l.reference];
      const signed = l.landlord_signed_at;
      return {
        id: iid('filing', l.reference), lease_id: l.id, status: open ? 'pending' : 'filed', clock_start_at: signed,
        due_by: open ? at(onCalendar(open.due), '17:00') : new Date(signed.getTime() + 15 * 86_400_000),
        attempts: open ? 0 : 1, adapter_mode: 'mock',
      };
    });
  kept('contract_filings', await upsert(c, 'contract_filings', filingRows), byLease);

  // Caution deposits: two months' rent held for every tenancy in force and for A-05's previous resident;
  // C-03's previous resident was refunded (less the cleaning they accepted).
  const holdRows = leaseRows
    .filter((l) => l.status !== 'draft')
    .map((l) => ({
      id: iid('caution', l.reference), lease_id: l.id, amount_rwf: l.caution_rwf,
      status: SETTLED[l.reference] ? 'refunded' : 'held', held_at: at(l.start_date, '10:00'),
    }));
  kept('caution_holds', await upsert(c, 'caution_holds', holdRows), byLease);
  const settlementRows = Object.entries(SETTLED).map(([ref, s]) => ({
    id: iid('caution-settlement', ref), lease_id: leaseId(ref), caution_hold_id: iid('caution', ref),
    refunded_rwf: s.refunded, forfeited_rwf: s.forfeited, reason: s.reason, settled_at: at(story(s.on), '11:03'),
    idempotency_key: `interface:${iid('caution-settlement', ref)}`,
  }));
  kept('caution_settlements', await upsert(c, 'caution_settlements', settlementRows), byLease);

  // ── Rent: every month of this year each tenancy owed ─────────────────────────────────────────────
  const MONTH_STATE = (row, offset) => (offset < -3 ? 'paid' : row.history[offset + 3]);
  const chargeRows = [];
  const chargeId = (ref, month) => iid('rent-charge', `${ref}:${month}`);
  for (const row of roll) {
    const lease = leaseOfUnit.get(row.id);
    if (!lease) throw new Error(`residence.rentRoll ${row.id} names no signed lease`);
    const due = dueDayOf(row.due);
    const start = `${onCalendar(lease.start).slice(0, 7)}-01`;
    const first = start > `${TODAY.slice(0, 4)}-01-01` ? start : `${TODAY.slice(0, 4)}-01-01`;
    for (let offset = monthsBetween(monthStart(0), first); offset <= 0; offset++) {
      const state = MONTH_STATE(row, offset);
      if (state === 'none') continue;
      const month = monthStart(offset);
      const dueDate = dayOf(month, due);
      let paid = state === 'paid' || state === 'late' ? row.rent : 0;
      // The part payments the ledgers show.
      if (row.id === 'A-03' && offset === -1) paid = 400000;
      if (row.id === 'C-05' && offset === -2) paid = 800000;
      const full = paid >= row.rent;
      chargeRows.push({
        id: chargeId(lease.id, month), lease_id: leaseId(lease.id), period_month: month, amount_rwf: row.rent,
        paid_amount_rwf: paid, status: full ? 'paid' : dueDate < TODAY ? 'overdue' : 'due', due_date: dueDate,
        paid_at: full ? at(addDays(dueDate, state === 'late' ? 9 : Math.min(2, Number(row.id.slice(2)) % 3)), '08:12') : null,
        idempotency_key: null,
      });
    }
  }
  kept('rent_charges', await upsert(c, 'rent_charges', chargeRows), byLease);

  const paymentRows = PAYMENTS.map((p) => {
    const lease = leaseOfUnit.get(p.unit);
    const received = at(story(p.when[0]), p.when[1]);
    const id = iid('rent-payment', `${lease.id}:${p.ref}`);
    return {
      id, workspace_id: WS, property_id: P, lease_id: leaseId(lease.id), rent_charge_id: chargeId(lease.id, monthStart(p.month)),
      amount_rwf: p.amount, method: p.method, provider_ref: p.ref, status: p.status, recorded_by_user_id: null,
      received_at: received, verified_at: p.status === 'verified' ? new Date(received.getTime() + 60_000) : null,
      idempotency_key: `${WS}:seed:${id}`,
    };
  });
  kept('rent_payments', await upsert(c, 'rent_payments', paymentRows));

  const reminderRows = [];
  for (const ledger of fx('residence.rentLedgers')) {
    const lease = leaseOfUnit.get(ledger.id);
    for (const [i, r] of ledger.reminders.entries()) {
      const channel = REMINDER_CHANNEL.find(([re]) => re.test(r.title))?.[1];
      if (!channel) throw new Error(`residence.rentLedgers ${ledger.id}: no channel for "${r.title}"`);
      const sentOn = story(r.when.split(' · ')[0]);
      const read = r.when.match(/read (\d{1,2} [A-Z][a-z]{2})/)?.[1];
      reminderRows.push({
        id: iid('rent-reminder', `${lease.id}:${i}`), workspace_id: WS, property_id: P, lease_id: leaseId(lease.id), channel,
        note: r.title.replace(/^Call by Solange · /, 'Call: ').replace(/^Invoice re-sent to accounts@…/, 'Invoice re-sent to the company accounts address'),
        sent_by_user_id: SOLANGE, sent_at: at(sentOn, '10:00'), read_at: read ? at(story(read), '18:30') : null,
      });
    }
  }
  kept('rent_reminders', await upsert(c, 'rent_reminders', reminderRows));

  // ── Renewals and notices ─────────────────────────────────────────────────────────────────────────
  const offerRows = OFFERS.map((o) => ({
    id: iid('renewal-offer', o.lease), lease_id: leaseId(o.lease), kind: 'landlord_offer', requested_by_user_id: SOLANGE,
    requested_end_date: onCalendar(o.ends), status: o.status === 'open' ? 'pending' : 'approved', offer_status: o.status,
    offered_rent_rwf: o.rent, term_months: o.months, starts_on: onCalendar(o.starts), answer_by: o.answerBy,
    deposit_topup_rwf: o.topup, other_terms: 'Unchanged', sent_at: o.sent, opened_at: o.opened, reminded_at: o.reminded,
    answered_at: o.answered, signed_at: o.signed, decided_at: o.answered, decided_by_user_id: null,
    created_at: o.sent,
  }));
  kept('lease_renewals', await upsert(c, 'lease_renewals', offerRows), byLease);

  const noticeRows = [
    {
      id: iid('move-out-notice', 'L-KC-003'), lease_id: leaseId('L-KC-003'), filed_by_user_id: SOLANGE,
      move_out_date: onCalendar('31 Oct 2026'), message: 'Notice by letter, confirmed in the resident app.',
      reason_code: 'kigali', filed_via: 'letter', notice_given_days: 30, is_short_notice: false,
      filed_at: at(onCalendar('1 Oct 2026'), '09:30'),
    },
  ];
  kept('move_out_notices', await upsert(c, 'move_out_notices', noticeRows), byLease);

  // ── Repairs, their conversations and the staff notes ────────────────────────────────────────────
  const ticketRows = [];
  const threadRows = [];
  const messageRows = [];
  const eventRows = [];
  for (const t of fx('residence.tickets')) {
    const plan = TICKETS[t.id];
    if (!plan) throw new Error(`residence.tickets ${t.id} has no seed plan`);
    const reporterLease = plan.reporter ? leaseOfUnit.get(plan.reporter) : null;
    const lease = plan.unit ? leaseOfUnit.get(plan.unit) : reporterLease;
    const reported = at(story(plan.reported[0]), plan.reported[1]);
    const reportedByOlivier = plan.reporter === 'B-07';
    const photos = t.photos.map((p) => ({ key: `stock:${p.key}`, caption: p.alt }));
    if (STATUS[t.status] !== plan.status) throw new Error(`residence.tickets ${t.id}: status ${t.status} is not ${plan.status}`);
    const category = CATEGORY[t.category.split(' · ')[0]];
    if (category !== plan.category) throw new Error(`residence.tickets ${t.id}: category ${t.category} is not ${plan.category}`);
    ticketRows.push({
      id: ticketId(t.id), workspace_id: WS, org_id: ORG.residences, property_id: P,
      room_id: plan.unit ? unitRoom(plan.unit) : null, space_id: plan.space ? iid('space', `kacyiru:${plan.space}`) : null,
      lease_id: lease ? leaseId(lease.id) : null, reference: t.id, title: t.title, description: t.thread[0]?.text ?? t.title,
      category, status: plan.status, priority: 'normal', staff_may_enter: plan.enter,
      raised_by_user_id: plan.reporter ? (reportedByOlivier ? OLIVIER : null) : SOLANGE,
      raised_by_role: plan.reporter ? 'tenant' : 'staff', raised_via: plan.via,
      assigned_contractor: plan.contractor ?? null,
      scheduled_for: plan.visit ? story(plan.visit[0]) : null, visit_window: plan.visit?.[1] ?? null,
      cost_bearer: 'landlord', cost_note: plan.costNote ?? null, photo_object_keys: JSON.stringify(photos),
      resolved_at: plan.resolved ? at(story(plan.resolved[0]), plan.resolved[1]) : null, created_at: reported,
    });
    eventRows.push({
      id: iid('residence-ticket-event', `${t.id}:reported`), ticket_id: ticketId(t.id),
      author_user_id: plan.reporter ? (reportedByOlivier ? OLIVIER : null) : SOLANGE, kind: 'reported', note: null, created_at: reported,
    });
    if (plan.status !== 'open') {
      eventRows.push({
        id: iid('residence-ticket-event', `${t.id}:assigned`), ticket_id: ticketId(t.id), author_user_id: SOLANGE,
        kind: 'assigned', note: plan.contractor ?? null, created_at: new Date(reported.getTime() + 25 * 60_000),
      });
    }
    // The conversation is with the tenancy that reported it; a vacant unit has none.
    const conversation = lease && !(plan.unit === 'A-05');
    if (conversation) {
      threadRows.push({
        id: threadId(t.id), workspace_id: WS, lease_id: leaseId(lease.id), maintenance_ticket_id: ticketId(t.id),
        thread_kind: 'reservation', subject: t.title, status: 'active', created_at: reported,
      });
    }
    for (const [i, m] of t.thread.entries()) {
      const when = m.meta.match(/(\d{1,2} [A-Z][a-z]{2}) (\d{2}:\d{2})$/);
      if (!when) throw new Error(`residence.tickets ${t.id}: no time in "${m.meta}"`);
      const sentAt = at(story(when[1]), when[2]);
      if (m.from === 'note') {
        eventRows.push({
          id: iid('residence-ticket-event', `${t.id}:note:${i}`), ticket_id: ticketId(t.id), author_user_id: SOLANGE,
          kind: 'note', note: m.text, created_at: sentAt,
        });
        continue;
      }
      if (!conversation) throw new Error(`residence.tickets ${t.id}: a message on a ticket with no tenancy`);
      messageRows.push({
        id: iid('residence-message', `${t.id}:${i}`), thread_id: threadId(t.id),
        sender_user_id: m.from === 'manager' ? SOLANGE : reportedByOlivier ? OLIVIER : null,
        body_type: 'text', body: m.text, created_at: sentAt,
      });
    }
  }
  const ticketIds = await upsert(c, 'maintenance_tickets', ticketRows, { keepCreated: false });
  kept('maintenance_tickets', ticketIds);
  kept('maintenance_events', await upsert(c, 'maintenance_events', eventRows), { column: 'ticket_id', values: ticketIds });
  const threadIds = await upsert(c, 'threads', threadRows);
  kept('threads', threadIds);
  kept('messages', await upsert(c, 'messages', messageRows), { column: 'thread_id', values: threadIds });
  // The conversation was last touched when its last message was sent.
  await c.query(
    `UPDATE threads t SET updated_at = m.last FROM (SELECT thread_id, max(created_at) AS last FROM messages
      WHERE thread_id = ANY($1::uuid[]) GROUP BY thread_id) m WHERE t.id = m.thread_id`,
    [threadIds],
  );

  // ── The gate ─────────────────────────────────────────────────────────────────────────────────────
  const passRows = PASSES.map((p) => {
    const lease = leaseOfUnit.get(p.unit);
    return {
      id: iid('visitor-pass', `kacyiru:${p.code}:${p.unit}`), workspace_id: WS, property_id: P, room_id: unitRoom(p.unit),
      lease_id: lease ? leaseId(lease.id) : null, maintenance_ticket_id: p.ticket ? ticketId(p.ticket) : null, kind: p.kind,
      visitor_name: p.name, code: p.code, valid_from: kigaliAt(p.from[1], p.from[0]), valid_to: kigaliAt(p.to[1], p.to[0]),
      overnight: false, status: p.status, created_by_user_id: p.byTenant ? (p.unit === 'B-07' ? OLIVIER : null) : SOLANGE,
      by_tenant: p.byTenant, used_at: p.used ? kigaliAt(p.used[1], p.used[0]) : null, left_at: p.left ? kigaliAt(p.left[1], p.left[0]) : null,
    };
  });
  const passIds = await upsert(c, 'visitor_passes', passRows);
  kept('visitor_passes', passIds);
  const passOf = (code) => passRows.find((p) => p.code === code)?.id ?? null;

  const logRows = fx('residence.visitorLog').map((v) => {
    const plan = LOG[v.id];
    if (!plan) throw new Error(`residence.visitorLog ${v.id} has no seed plan`);
    const lease = plan.unit ? leaseOfUnit.get(plan.unit) : null;
    return {
      id: iid('visitor-log', `kacyiru:${v.id}`), workspace_id: WS, property_id: P, room_id: plan.unit ? unitRoom(plan.unit) : null,
      lease_id: lease ? leaseId(lease.id) : null, visitor_pass_id: plan.pass ? passOf(plan.pass) : null, place: plan.place ?? null,
      visitor_name: v.name, visitor_phone: v.phone, relation: null, admitted_how: v.how, recorded_by: v.by,
      arrival_at: kigaliAt(plan.arrived[1], plan.arrived[0]), departure_at: kigaliAt(plan.left[1], plan.left[0]),
    };
  });
  kept('visitor_log_entries', await upsert(c, 'visitor_log_entries', logRows));

  const accessRows = fx('residence.accessRequests').map((r) => {
    const plan = ACCESS[r.id];
    if (!plan) throw new Error(`residence.accessRequests ${r.id} has no seed plan`);
    return {
      id: iid('access-request', `kacyiru:${r.id}`), lease_id: leaseId(leaseOfUnit.get(plan.unit).id), requested_by_user_id: null,
      for_date: plan.from, to_date: plan.to, reason: plan.reason, kind: plan.kind, visitor_name: plan.visitor,
      status: 'open', decided_by_user_id: null, decided_at: null, requested_at: plan.requested,
    };
  });
  kept('visitor_access_requests', await upsert(c, 'visitor_access_requests', accessRows), byLease);

  // ── The tenancy pipeline ─────────────────────────────────────────────────────────────────────────
  const clauseRows = fx('residence.leaseClauses').map((cl, i) => ({
    id: iid('lease-clause', `amahoro-residences:${cl.id}`), workspace_id: WS, code: cl.id, title: cl.title, note: cl.note,
    needs_review: cl.review ?? false, sort_order: i,
  }));
  kept('lease_clause_templates', await upsert(c, 'lease_clause_templates', clauseRows));

  const brokerId = await brokerOf(c, 'broker');
  const applicationRows = [];
  const documentRows = [];
  for (const a of fx('residence.applicants')) {
    const plan = APPLICATIONS[a.id];
    if (!plan) throw new Error(`residence.applicants ${a.id} has no seed plan`);
    const p = a.profile;
    const registered = p ? at(story(p.registered), '16:20') : at(story(plan.invited), '11:00');
    const id = iid('lease-application', `kacyiru:${a.id}`);
    applicationRows.push({
      id, workspace_id: WS, property_id: P, room_id: unitRoom(a.unit), name: a.name, email: plan.email, phone: plan.phone,
      stage: plan.stage, source: p?.sourceLong ?? 'Invitation',
      broker_id: plan.broker ? brokerId : null,
      broker_fee_rwf: plan.broker ? p.broker.fee : null, broker_terms: plan.broker ? p.broker.terms : null,
      referred_at: plan.broker ? registered : null,
      desired_move_in: p ? onCalendar(p.moveIn) : null, term_months: plan.term, occupants: p?.occupants ?? null,
      offered_rent_rwf: p?.rent ?? null, deposit_rwf: p?.deposit ?? null,
      screening: JSON.stringify(p ? SCREENING.filter((_, i) => p.checks[i]) : []),
      decline_reason: null, lease_id: null, created_at: registered,
    });
    for (const [i, d] of (p?.docs ?? []).entries()) {
      documentRows.push({
        id: iid('application-document', `${a.id}:${i}`), workspace_id: WS, application_id: id, name: d.name, note: d.meta,
        state: DOC_STATE[d.state] ?? 'uploaded', stored_object_id: null, sort_order: i,
      });
    }
  }
  const applicationIds = await upsert(c, 'lease_applications', applicationRows);
  kept('lease_applications', applicationIds);
  kept('lease_application_documents', await upsert(c, 'lease_application_documents', documentRows));

  // ── The landlord's settlements ───────────────────────────────────────────────────────────────────
  const payoutRows = [
    {
      id: iid('landlord-payout', 'kacyiru:last-month'), workspace_id: WS, payee_type: 'landlord', destination: 'bank',
      destination_ref: 'GT Bank ••••2210', amount_rwf: 18250000, source: 'rent', status: 'paid',
      scheduled_release_at: at(monthStart(0), '08:00'), settled_at: at(addDays(monthStart(0), 2), '11:00'),
      idempotency_key: `interface:${iid('landlord-payout', 'kacyiru:last-month')}`,
    },
    {
      id: iid('landlord-payout', 'kacyiru:this-month'), workspace_id: WS, payee_type: 'landlord', destination: 'bank',
      destination_ref: 'GT Bank ••••2210',
      // What has been verified so far this month; the two payments still in flight are excluded.
      amount_rwf: chargeRows.filter((ch) => ch.period_month === monthStart(0)).reduce((n, ch) => n + ch.paid_amount_rwf, 0),
      source: 'rent', status: 'queued', scheduled_release_at: at(monthStart(1), '08:00'), settled_at: null,
      idempotency_key: `interface:${iid('landlord-payout', 'kacyiru:this-month')}`,
    },
  ];
  kept('payouts', await upsert(c, 'payouts', payoutRows));

  log(
    `residence: ${unitRows.length} units in ${blockRows.length} blocks, ${leaseRows.length} leases, ${chargeRows.length} rent charges, ` +
      `${paymentRows.length} payments, ${ticketRows.length} repairs, ${passRows.length} gate codes, ${applicationRows.length} applications`,
  );
}

/** The broker persona's `brokers` row (the world gives him a broker workspace, not the broker record). */
async function brokerOf(c, persona) {
  const user = userId(persona);
  const { rows: profile } = await c.query(
    `SELECT u.name, u.email, p.national_id FROM users u JOIN user_profiles p ON p.user_id = u.id WHERE u.id = $1`,
    [user],
  );
  if (!profile[0]) throw new Error(`the ${persona} persona has no profile`);
  await c.query(
    `INSERT INTO brokers (id, user_id, national_id, name, email, status) VALUES ($1, $2, $3, $4, $5, 'active')
     ON CONFLICT (user_id) DO NOTHING`,
    [iid('broker', persona), user, profile[0].national_id, profile[0].name, profile[0].email],
  );
  const { rows } = await c.query('SELECT id FROM brokers WHERE user_id = $1', [user]);
  return rows[0].id;
}
