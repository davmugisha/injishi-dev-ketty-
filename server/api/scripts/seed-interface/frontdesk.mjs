/**
 * frontdesk.*: the front desk's day at Isangano Lakeside Hotel, as the rows the desk reads through
 * `GET /api/v1/ops/front-desk` (Today, Check-in, Reservations and the request queue).
 *
 * The fixtures were drawn as several boards that do not agree with each other or with the world: the
 * world's rooms (operations.rooms) give 204 and 305 a Standard Queen where the desk boards drew a Deluxe
 * Lake View, and the guest at one desk board is in house on another. A database holds one day, so this
 * module writes ONE consistent day, keeping every record the desk boards name by its handle (booking
 * reference, stay reference, folio number, room) and taking every fact the world already decided (a
 * room's type, whether it is out of order) from the world:
 *
 *   - nine arrivals today, eight of them with a room held (`room_assignments`), Thomas Weber on a split
 *     stay (211 for two nights, then 311), Sarah Kimani the next guest at the desk (earliest ETA);
 *   - six guests in house and four leaving today (open `guest_stays`), two who checked out this morning
 *     and one yesterday (closed), each with the bill the platform would have written: the online
 *     prepayment credited at check in, one room charge per night the night audit has run, and the
 *     extras of the three who still owe something (posted before tax, with their VAT line);
 *   - a guest who did not arrive yesterday (the no-show the desk records), three requests to book
 *     waiting for an answer, a future booking and a cancelled one.
 *
 * Money follows the platform's rules, never the fixture's numbers: every booking is priced with
 * `computeBreakdown` (per guest, per night, plus the guest service fee) and was paid online when it was
 * made, as every booking on the platform is (escrow captured; a request's is held until the answer).
 * A pay-on-arrival booking has no model yet (no channel or phone booking is built), so the fixture's
 * "Pays on arrival" and "Deposit due" read as prepaid. Every folio line carries its ledger entry, as
 * `FolioRepository.postCharges` writes it.
 *
 * Guests are demo accounts (`@guests.app.demo.injishi.com`, ids under 1e000000-). Nothing here sends a
 * receipt to the VSDC: the demo declares nothing (ADR-043), and no EBM row is written.
 */
import { computeBreakdown, stayNightlyRateRwf } from '@injishi/contracts';

import { day, iid, kigaliAt, kigaliToday, userId } from './lib.mjs';
import { ORG, PROPERTY, roomId, roomTypeId, WORKSPACE } from './world.mjs';

const GUEST_DOMAIN = 'guests.app.demo.injishi.com';

/** A demo guest account: `guestUser('Sarah Kimani')`. */
export function guestUserId(name) {
  return iid('guest', slug(name));
}

function slug(name) {
  return name
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number} ]/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.');
}

export const bookingId = (reference) => iid('booking', reference);
export const stayId = (reference) => iid('stay', reference);

/**
 * The day. `in` is the arrival as days from today; `holds` are [room, fromDay, toDay); a `stay` makes
 * the guest arrived (open, or closed with `closedAt`). Room types follow the world's rooms.
 */
export const BOOKINGS = [
  // Today's arrivals.
  { ref: 'BK-20431', name: 'Sarah Kimani', type: 'queen', in: 0, nights: 2, adults: 2, channel: 'travel_agent', eta: '10:30', note: 'Arrived early · late checkout asked', holds: [['204', 0, 2]], id: { doc: 'passport', country: 'KE' } },
  { ref: 'BK-20433', name: 'Thomas Weber', type: 'dlv', in: 0, nights: 5, adults: 1, channel: 'corporate', eta: '13:30', note: 'Umurage Consulting corporate rate · split stay, 211 then 311', holds: [['211', 0, 2], ['311', 2, 5]] },
  { ref: 'BK-20436', name: 'Daniel Okafor', type: 'queen', in: 0, nights: 3, adults: 2, channel: 'direct', eta: '12:30', note: 'Airport pickup booked', holds: [['106', 0, 3]], id: { doc: 'passport', country: 'NG' } },
  { ref: 'BK-20438', name: 'Yuki Tanaka', type: 'queen', in: 0, nights: 1, adults: 1, channel: 'marketplace', eta: '14:00', note: 'Vegetarian breakfast', holds: [], id: { doc: 'passport', country: 'JP' } },
  { ref: 'BK-20440', name: 'Aisha Mohammed', type: 'twin', in: 0, nights: 4, adults: 1, channel: 'corporate', eta: '15:00', note: 'Room and tax to Umurage Consulting; extras to the guest', holds: [['310', 0, 4]], id: { doc: 'passport', country: 'KE' } },
  { ref: 'BK-20445', name: 'Jean Bosco Nkurunziza', type: 'queen', in: 0, nights: 2, adults: 1, channel: 'phone', eta: '16:00', note: 'Will pay extras by MTN MoMo', holds: [['102', 0, 2]] },
  { ref: 'BK-20444', name: 'Nadia Benali', type: 'twin', in: 0, nights: 1, adults: 2, channel: 'direct', eta: '17:00', note: 'Travelling with a colleague', holds: [['209', 0, 1]], id: { doc: 'passport', country: 'MA' } },
  { ref: 'BK-20443', name: 'Pierre Laurent', type: 'dlv', in: 0, nights: 3, adults: 2, channel: 'marketplace', mode: 'request_to_book', eta: '18:30', note: 'Anniversary · flowers in room', holds: [['212', 0, 3]], id: { doc: 'passport', country: 'FR' } },
  { ref: 'BK-20446', name: 'Kwame Mensah', type: 'twin', in: 0, nights: 2, adults: 1, channel: 'channel_manager', eta: '21:00', note: 'Late arrival guaranteed', holds: [['108', 0, 2]] },
  // In house, staying on.
  { ref: 'BK-20419', name: 'Marie Claire Uwimana', type: 'dlv', in: -3, nights: 4, adults: 2, channel: 'direct', stay: { ref: 'ST-8790', room: '403', folio: 'F-5498', note: 'Extra bed in room' } },
  { ref: 'BK-20429', name: 'Lucia Romero', type: 'queen', in: -3, nights: 5, adults: 2, channel: 'channel_manager', stay: { ref: 'ST-8801', room: '305', folio: 'F-5507', note: 'Quiet room requested' } },
  { ref: 'BK-20393', name: 'Jonas Lindqvist', type: 'twin', in: -4, nights: 5, adults: 1, channel: 'direct', stay: { ref: 'ST-8786', room: '110', folio: 'F-5495', note: 'Shower drains slowly · reported to maintenance' } },
  { ref: 'BK-20427', name: 'Kevin Otieno', type: 'queen', in: -2, nights: 4, adults: 1, channel: 'travel_agent', stay: { ref: 'ST-8799', room: '301', folio: 'F-5505', note: 'Asked for late checkout' } },
  { ref: 'BK-20430', name: 'Amina Uwase', type: 'queen', in: -1, nights: 4, adults: 2, channel: 'direct', stay: { ref: 'ST-8808', room: '206', folio: 'F-5515', note: 'Do not disturb until 11:00 · towels requested' } },
  { ref: 'BK-20432', name: 'Samuel Mugabo', type: 'queen', in: -1, nights: 2, adults: 1, channel: 'phone', stay: { ref: 'ST-8810', room: '306', folio: 'F-5518', note: 'Pays extras at checkout' } },
  // In house, leaving today.
  { ref: 'BK-20420', name: 'Chen Wei', type: 'queen', in: -3, nights: 3, adults: 1, channel: 'direct', stay: { ref: 'ST-8781', room: '105', folio: 'F-5486', note: 'Taxi booked 11:15', extras: [{ text: 'Lake Bar and laundry', gross: 46500 }] } },
  { ref: 'BK-20423', name: 'Eduardo Silva', type: 'twin', in: -4, nights: 4, adults: 2, channel: 'marketplace', stay: { ref: 'ST-8778', room: '207', folio: 'F-5482', note: 'Keys at desk' } },
  { ref: 'BK-20428', name: 'Rania Haddad', type: 'twin', in: -2, nights: 2, adults: 1, channel: 'travel_agent', stay: { ref: 'ST-8796', room: '109', folio: 'F-5503', note: 'Split bill', extras: [{ text: 'Extras, agent invoiced', gross: 212400 }] } },
  { ref: 'BK-20426', name: 'Nkechi Eze', type: 'queen', in: -3, nights: 3, adults: 1, channel: 'direct', stay: { ref: 'ST-8783', room: '303', folio: 'F-5488', note: 'Late checkout free under policy', leaves: '14:00', extras: [{ text: 'Terrace lunch', gross: 18500 }] } },
  // Checked out this morning, and yesterday.
  { ref: 'BK-20421', name: 'Ingrid Solberg', type: 'queen', in: -4, nights: 4, adults: 1, channel: 'direct', stay: { ref: 'ST-8779', room: '204', folio: 'F-5483', closedAt: '08:50', departureNote: 'Left feedback in the app' } },
  { ref: 'BK-20424', name: 'Moses Kariuki', type: 'dlv', in: -3, nights: 3, adults: 1, channel: 'phone', stay: { ref: 'ST-8784', room: '211', folio: 'F-5489', closedAt: '09:40', departureNote: 'Paid by MTN MoMo' } },
  { ref: 'BK-20411', name: 'Grace Achieng', type: 'twin', in: -4, nights: 3, adults: 1, channel: 'marketplace', stay: { ref: 'ST-8771', room: '208', folio: 'F-5474', closedAt: '10:15' } },
  // Did not arrive yesterday: the desk has not recorded the no-show yet.
  { ref: 'BK-20425', name: 'Ivan Petrov', type: 'queen', in: -1, nights: 2, adults: 1, channel: 'phone', note: 'No answer on the phone number given', holds: [['203', -1, 1]] },
  // Requests to book, waiting for an answer (minutes until each auto-declines).
  { ref: 'BK-20447', name: 'Meera Shah', type: 'dlv', in: 3, nights: 3, adults: 2, channel: 'marketplace', status: 'pending_approval', expiresIn: 150, message: 'We would like a quiet room, please. We arrive late, around 22:00, from Kigali.' },
  { ref: 'BK-20450', name: 'Olivia Grant', type: 'queen', in: 4, nights: 2, adults: 1, channel: 'marketplace', status: 'pending_approval', expiresIn: 35 * 60, message: 'Is there a quiet place to work? I will be on calls most afternoons.' },
  { ref: 'BK-20448', name: 'Ngozi Okoro', type: 'family', in: 5, nights: 3, adults: 2, children: 2, channel: 'travel_agent', status: 'pending_approval', expiresIn: 22 * 60, message: 'Children are 6 and 9. Can you add an extra bed? Booked through Akagera Horizon Travel.' },
  // Later this month.
  { ref: 'BK-20439', name: 'Hannah Becker', type: 'twin', in: 6, nights: 3, adults: 2, channel: 'direct', note: 'Asked whether she can arrive a day later' },
  // Cancelled yesterday by the guest, refunded in full under the flexible tier.
  { ref: 'BK-20418', name: 'Volcano View group', type: 'dlv', in: 2, nights: 2, adults: 2, channel: 'travel_agent', status: 'cancelled', note: 'Group of six rooms reduced to four; this room cancelled' },
];

/**
 * A time the story puts on a day, never later than now: a guest who "checked out at 08:50 today" has
 * not checked out yet when the seed runs at 07:00, so it moves to just before now, on the same day.
 */
function pastOnItsDay(at, now) {
  const latest = now.getTime() - 10 * 60_000;
  if (at.getTime() <= latest) return at;
  const dayStart = Date.parse(`${kigaliToday(at)}T00:01:00+02:00`);
  return new Date(Math.max(latest, dayStart));
}

/** The rate each Isangano room type sells at, from the world's room types (frontdesk.roomTypes). */
function ratesFrom(fx) {
  return Object.fromEntries(fx('frontdesk.roomTypes').map((t) => [t.id, t.rate]));
}

async function departmentOf(c, category) {
  const { rows } = await c.query(
    `SELECT id FROM departments WHERE property_id = $1 AND department_category = $2 ORDER BY sort_order LIMIT 1`,
    [PROPERTY.isangano, category],
  );
  if (!rows[0]) throw new Error(`Isangano has no ${category} department; run property-departments first.`);
  return rows[0].id;
}

async function accounts(c) {
  const { rows } = await c.query(
    `SELECT id, code FROM ledger_accounts WHERE code = ANY($1)`,
    [['REVENUE_ROOMS', 'REVENUE_FNB', 'TAX_PAYABLE', 'ESCROW_RECEIVABLE']],
  );
  const byCode = Object.fromEntries(rows.map((r) => [r.code, r.id]));
  for (const code of ['REVENUE_ROOMS', 'REVENUE_FNB', 'TAX_PAYABLE', 'ESCROW_RECEIVABLE']) {
    if (!byCode[code]) throw new Error(`Ledger account ${code} is missing; migrations have not run.`);
  }
  return byCode;
}

/** The standard VAT rate in force now, from config (never typed from memory). */
async function vatRate(c) {
  const { rows } = await c.query(
    `SELECT value FROM config_entries
      WHERE config_type = 'tax_rates'
        AND (effective_from IS NULL OR effective_from <= now())
        AND (effective_to IS NULL OR effective_to > now())
      ORDER BY effective_from DESC NULLS LAST, version DESC LIMIT 1`,
  );
  const rate = rows[0]?.value?.TAX_B;
  if (typeof rate !== 'number') throw new Error('No effective TAX_B rate in config_entries (tax_rates).');
  return rate;
}

async function upsertGuest(c, name) {
  const id = guestUserId(name);
  const email = `${slug(name)}@${GUEST_DOMAIN}`;
  const { rows } = await c.query('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
  if (rows[0] && rows[0].id !== id) throw new Error(`${email} belongs to another account (${rows[0].id}).`);
  await c.query(
    `INSERT INTO users (id, email, email_verified, name) VALUES ($1, $2, true, $3)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [id, email, name],
  );
  await c.query(
    `INSERT INTO user_profiles (user_id, display_name) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name`,
    [id, name],
  );
  const { rows: role } = await c.query(
    `SELECT 1 FROM user_roles WHERE user_id = $1 AND global_role = 'guest' AND revoked_at IS NULL LIMIT 1`,
    [id],
  );
  if (role.length === 0) await c.query(`INSERT INTO user_roles (user_id, global_role) VALUES ($1, 'guest')`, [id]);
  return id;
}

export async function seed(ctx) {
  const { c, fx, log, keep } = ctx;
  const rates = ratesFrom(fx);
  const roomsDept = await departmentOf(c, 'rooms');
  const fnbDept = await departmentOf(c, 'fnb');
  const account = await accounts(c);
  const vat = await vatRate(c);
  const eric = userId('frontdesk');
  const now = new Date();

  const kept = {
    bookings: [], escrows: [], identities: [], holds: [], stays: [], folios: [], charges: [], entries: [],
  };

  // Rows a demo day or a flow made can stand in the way of the seeded day (an open stay in a room the
  // seed puts somebody in, a hold over a seeded hold). They are going anyway: convergence removes every
  // row no module keeps. Close and release just the ones in the way, so the seeded rows can be written.
  const seededStayIds = BOOKINGS.filter((b) => b.stay).map((b) => stayId(b.stay.ref));
  const seededOpenRooms = BOOKINGS.filter((b) => b.stay && !b.stay.closedAt).map((b) => roomId('isangano', b.stay.room));
  await c.query(
    `UPDATE guest_stays SET lifecycle = 'closed', actual_exit_at = now()
      WHERE workspace_id = $1 AND lifecycle = 'open' AND room_id = ANY($2::uuid[]) AND NOT (id = ANY($3::uuid[]))`,
    [WORKSPACE.hotel, seededOpenRooms, seededStayIds],
  );
  const seededHoldIds = BOOKINGS.flatMap((b) => [
    ...(b.holds ?? []).map(([room, from]) => iid('room-hold', `${b.ref}:${room}:${from}`)),
    ...(b.stay ? [iid('room-hold', `${b.ref}:${b.stay.room}:${b.in}`)] : []),
  ]);
  for (const b of BOOKINGS) {
    const ranges = [...(b.holds ?? []), ...(b.stay && !b.stay.closedAt ? [[b.stay.room, b.in, b.in + b.nights]] : [])];
    for (const [room, from, to] of ranges) {
      await c.query(
        `UPDATE room_assignments SET status = 'released', released_at = now()
          WHERE room_id = $1 AND status = 'assigned' AND occupies && daterange($2::date, $3::date)
            AND NOT (id = ANY($4::uuid[]))`,
        [roomId('isangano', room), day(from), day(to), seededHoldIds],
      );
    }
  }

  let lines = 0;
  for (const b of BOOKINGS) {
    const guest = await upsertGuest(c, b.name);
    const id = bookingId(b.ref);
    const guests = b.adults + (b.children ?? 0);
    const breakdown = computeBreakdown({ nightlyRateRwf: rates[b.type], nights: b.nights, nonRefundable: false, guests });
    const locked = stayNightlyRateRwf(breakdown);
    const gross = breakdown.grossRwf;
    const status = b.status ?? 'confirmed';
    const createdAt = kigaliAt('16:02', Math.min(b.in, 0) - 9);
    const cancelled = status === 'cancelled';
    const expires = status === 'pending_approval' ? new Date(now.getTime() + b.expiresIn * 60_000) : null;
    const paymentStatus = cancelled ? 'refunded_full' : 'captured';
    await c.query(
      `INSERT INTO bookings
         (id, reference, room_type_id, rate_plan_id, guest_user_id, workspace_id, check_in, check_out,
          guest_count, adults, children, status, booking_mode, locked_nightly_rate_rwf, locked_cancellation_tier,
          gross_rwf, payment_status, approval_expires_at, confirmed_at, cancelled_at, cancelled_by, refund_rwf,
          channel, eta, desk_note, no_show_at, no_show_by_user_id, no_show_reason, decline_reason, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'flexible', $15, $16, $17, $18, $19, $20, $21,
               $22, $23, $24, NULL, NULL, NULL, NULL, $25, $25)
       ON CONFLICT (id) DO UPDATE SET
         room_type_id = EXCLUDED.room_type_id, rate_plan_id = EXCLUDED.rate_plan_id, guest_user_id = EXCLUDED.guest_user_id,
         check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out, guest_count = EXCLUDED.guest_count,
         adults = EXCLUDED.adults, children = EXCLUDED.children, status = EXCLUDED.status,
         booking_mode = EXCLUDED.booking_mode, locked_nightly_rate_rwf = EXCLUDED.locked_nightly_rate_rwf,
         locked_cancellation_tier = EXCLUDED.locked_cancellation_tier, gross_rwf = EXCLUDED.gross_rwf,
         payment_status = EXCLUDED.payment_status, approval_expires_at = EXCLUDED.approval_expires_at,
         confirmed_at = EXCLUDED.confirmed_at, cancelled_at = EXCLUDED.cancelled_at, cancelled_by = EXCLUDED.cancelled_by,
         refund_rwf = EXCLUDED.refund_rwf, channel = EXCLUDED.channel, eta = EXCLUDED.eta, desk_note = EXCLUDED.desk_note,
         no_show_at = NULL, no_show_by_user_id = NULL, no_show_reason = NULL, decline_reason = NULL, cancel_reason = NULL,
         sweep_claimed_until = NULL, ebm_sign_at = NULL, updated_at = now()`,
      [id, b.ref, roomTypeId('isangano', b.type), iid('rate-plan', `isangano:${b.type}:standard`), guest, WORKSPACE.hotel,
        day(b.in), day(b.in + b.nights), guests, b.adults, b.children ?? 0, status,
        b.mode ?? (status === 'pending_approval' ? 'request_to_book' : 'instant_book'), locked, gross, paymentStatus, expires,
        status === 'confirmed' ? new Date(createdAt.getTime() + 60_000) : null,
        cancelled ? kigaliAt('17:20', -1) : null, cancelled ? 'guest' : null, cancelled ? gross : null,
        b.channel, b.eta ?? null, b.note ?? b.stay?.note ?? null, createdAt],
    );
    kept.bookings.push(id);

    // The money taken online when the booking was made, as the mock adapter records a capture.
    const escrowKey = `seed-interface:${b.ref}`;
    await c.query(
      `INSERT INTO escrows (id, workspace_id, source, booking_id, amount_rwf, status, adapter_ref, adapter_mode, idempotency_key)
       VALUES ($1, $2, 'booking', $3, $4, $5, $6, 'mock', $7)
       ON CONFLICT (id) DO UPDATE SET amount_rwf = EXCLUDED.amount_rwf, status = EXCLUDED.status, updated_at = now()`,
      [iid('escrow', b.ref), WORKSPACE.hotel, id, gross, cancelled ? 'refunded_full' : 'held',
        `mock_escrow_capture_${escrowKey}`, escrowKey],
    );
    kept.escrows.push(iid('escrow', b.ref));

    // The ID a guest sent from their phone before arriving (ADR-060).
    if (b.id) {
      const pid = iid('pre-arrival', b.ref);
      await c.query(
        `INSERT INTO pre_arrival_identities
           (id, booking_id, guest_user_id, document_type, document_number, issuing_country, address_text, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET document_type = EXCLUDED.document_type, submitted_at = EXCLUDED.submitted_at`,
        [pid, id, guest, b.id.doc, `DEMO-${b.ref.slice(3)}`, b.id.country, 'Demo address, not a real place', kigaliAt('19:12', -2)],
      );
      kept.identities.push(pid);
    }

    // Rooms held for the booking: the arrival's, and a guest in house's own room through checkout.
    const holds = [...(b.holds ?? [])];
    if (b.stay) holds.push([b.stay.room, b.in, b.in + b.nights]);
    for (const [room, from, to] of holds) {
      const hid = iid('room-hold', `${b.ref}:${room}:${from}`);
      // Holds run to checkout and are released by it (ADR-016 D-h).
      const releasedAt = b.stay?.closedAt ? pastOnItsDay(kigaliAt(b.stay.closedAt, b.in + b.nights), now) : null;
      await c.query(
        `INSERT INTO room_assignments (id, booking_id, room_id, workspace_id, occupies, status, assigned_by_user_id, released_at)
         VALUES ($1, $2, $3, $4, daterange($5::date, $6::date), $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET room_id = EXCLUDED.room_id, occupies = EXCLUDED.occupies,
           status = EXCLUDED.status, released_at = EXCLUDED.released_at, updated_at = now()`,
        [hid, id, roomId('isangano', room), WORKSPACE.hotel, day(from), day(to), releasedAt ? 'released' : 'assigned', eric, releasedAt],
      );
      kept.holds.push(hid);
    }

    if (!b.stay) continue;

    // The stay, as check in opened it, and as check out closed it.
    const s = b.stay;
    const sid = stayId(s.ref);
    const lastDay = b.in + b.nights;
    const entryAt = kigaliAt('14:12', b.in);
    const plannedExit = kigaliAt(s.leaves ?? '11:00', lastDay);
    const closedAt = s.closedAt ? pastOnItsDay(kigaliAt(s.closedAt, lastDay), now) : null;
    await c.query(
      `INSERT INTO guest_stays
         (id, booking_id, guest_user_id, room_id, workspace_id, check_in_mode, is_verified, entry_at, planned_exit_at,
          actual_exit_at, price_rwf, lifecycle, reference, desk_note, departure_note)
       VALUES ($1, $2, $3, $4, $5, 'staffed', true, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET room_id = EXCLUDED.room_id, entry_at = EXCLUDED.entry_at,
         planned_exit_at = EXCLUDED.planned_exit_at, actual_exit_at = EXCLUDED.actual_exit_at,
         price_rwf = EXCLUDED.price_rwf, lifecycle = EXCLUDED.lifecycle, reference = EXCLUDED.reference,
         desk_note = EXCLUDED.desk_note, departure_note = EXCLUDED.departure_note, updated_at = now()`,
      [sid, id, guest, roomId('isangano', s.room), WORKSPACE.hotel, entryAt, plannedExit, closedAt, locked,
        closedAt ? 'closed' : 'open', s.ref, s.note ?? null, s.departureNote ?? null],
    );
    kept.stays.push(sid);

    // The bill: what check in credited, what the night audit posted, and the extras still owed.
    const fid = iid('folio', s.ref);
    const charges = [];
    charges.push({
      key: `escrow-prepaid:${id}`, type: 'deposit', text: `Paid online, held in escrow (${b.ref})`, dept: null,
      amount: -(locked * b.nights), tax: null, src: 'booking', srcId: id, method: '06', at: entryAt, account: account.ESCROW_RECEIVABLE,
    });
    const nightsPosted = Math.min(b.nights, -b.in);
    for (let n = 0; n < nightsPosted; n++) {
      const night = day(b.in + n);
      charges.push({
        key: `${WORKSPACE.hotel}:night:${fid}:${night}`, type: 'room', text: `Room charge for ${night}`, dept: roomsDept,
        amount: locked, tax: null, src: 'night_audit', srcId: null, businessDate: night, at: kigaliAt('23:40', b.in + n),
        account: account.REVENUE_ROOMS,
      });
    }
    for (const [i, extra] of (s.extras ?? []).entries()) {
      // Typed before tax, as the desk types a charge; the VAT is its own line (D-n).
      const net = Math.round(extra.gross / (1 + vat));
      const taxAmount = Math.round(net * vat);
      const key = `seed-interface:${s.ref}:extra:${i}`;
      charges.push({
        key, type: 'pos', text: extra.text, dept: fnbDept, amount: net, taxCode: 'TAX_B', taxRate: vat, taxAmount,
        src: 'manual', srcId: null, at: kigaliAt('20:05', -1), account: account.REVENUE_FNB, by: eric,
      });
      charges.push({
        key: `${key}:tax`, type: 'tax', text: `TAX_B on ${extra.text}`, dept: null, amount: taxAmount, taxCode: 'TAX_B',
        taxRate: vat, src: 'tax', parentKey: key, at: kigaliAt('20:05', -1), account: account.TAX_PAYABLE, by: eric,
      });
    }
    const balance = charges.reduce((sum, ch) => sum + ch.amount, 0);
    if (closedAt && balance !== 0) throw new Error(`${s.ref} checked out owing ${balance}: a bill never closes owing money.`);
    const folioStatus = closedAt ? 'closed' : balance === 0 ? 'settled' : 'open';
    await c.query(
      `INSERT INTO folios
         (id, folio_number, workspace_id, property_id, guest_stay_id, booking_id, guest_user_id, folio_type, status,
          folio_sequence, locked_at, balance_rwf, opened_at, closed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'guest', $8, 1, $9, $10, $11, $9)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, locked_at = EXCLUDED.locked_at,
         balance_rwf = EXCLUDED.balance_rwf, opened_at = EXCLUDED.opened_at, closed_at = EXCLUDED.closed_at, updated_at = now()`,
      [fid, s.folio, WORKSPACE.hotel, PROPERTY.isangano, sid, id, guest, folioStatus, closedAt, balance, entryAt],
    );
    kept.folios.push(fid);

    for (const ch of charges) {
      const cid = iid('folio-charge', ch.key);
      const parent = ch.parentKey ? iid('folio-charge', ch.parentKey) : ch.srcId;
      await c.query(
        `INSERT INTO folio_charges
           (id, folio_id, workspace_id, department_id, tax_entity_org_id, payment_method_code, charge_type, description,
            quantity, unit_price_rwf, amount_rwf, tax_code, tax_rate, tax_amount_rwf, source_ref_type, source_ref_id,
            posted_by_user_id, business_date, idempotency_key, posted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         ON CONFLICT (id) DO NOTHING`,
        [cid, fid, WORKSPACE.hotel, ch.dept, ORG.hotel, ch.method ?? null, ch.type, ch.text, ch.amount,
          ch.taxCode ?? null, ch.taxRate == null ? null : String(ch.taxRate), ch.type === 'tax' ? null : (ch.taxAmount ?? null),
          ch.src, parent ?? null, ch.by ?? null, ch.businessDate ?? null, ch.key, ch.at],
      );
      kept.charges.push(cid);
      // The ledger entry `postCharges` writes with every line: same sign, one account.
      const tid = iid('ledger-txn', ch.key);
      await c.query(
        `INSERT INTO ledger_transactions (id, kind, idempotency_key, memo, occurred_at)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [tid, ch.type === 'deposit' ? 'folio_settle' : 'folio_post', ch.key, ch.text, ch.at],
      );
      const eid = iid('ledger-entry', ch.key);
      await c.query(
        `INSERT INTO ledger_entries (id, transaction_id, account_id, amount_rwf, workspace_id, related_type, related_id, created_at)
         VALUES ($1, $2, $3, $4, $5, 'folio_charge', $6, $7) ON CONFLICT (id) DO NOTHING`,
        [eid, tid, ch.account, ch.amount, WORKSPACE.hotel, cid, ch.at],
      );
      kept.entries.push(eid);
      lines++;
    }
  }

  // Every row of these tables in the interface world that the seed did not write goes at convergence:
  // parents first, so children are removed before them. Tables with no workspace column are scoped
  // through their parent, read now so a row a flow made is in scope too.
  const { rows: allBookings } = await c.query('SELECT id FROM bookings WHERE workspace_id = ANY($1::uuid[])', [[WORKSPACE.hotel, WORKSPACE.residences]]);
  const { rows: allStays } = await c.query('SELECT id FROM guest_stays WHERE workspace_id = ANY($1::uuid[])', [[WORKSPACE.hotel, WORKSPACE.residences]]);

  // A ledger transaction carries the idempotency key of the line it recorded, and outlives the line
  // (it has no workspace to converge by). Free the keys of the lines this convergence removes, and of
  // transactions already left without lines, so a check in or a charge repeated after a reseed posts
  // again instead of colliding with a ghost. Nothing is deleted here.
  const { rows: goingTxns } = await c.query(
    `SELECT DISTINCT le.transaction_id AS id
       FROM ledger_entries le
       JOIN folio_charges fc ON fc.id = le.related_id AND le.related_type = 'folio_charge'
      WHERE fc.workspace_id = ANY($1::uuid[]) AND NOT (fc.id = ANY($2::uuid[]))`,
    [[WORKSPACE.hotel, WORKSPACE.residences], kept.charges],
  );
  const { rows: ghostTxns } = await c.query(
    `SELECT lt.id FROM ledger_transactions lt
      WHERE lt.idempotency_key IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM ledger_entries le WHERE le.transaction_id = lt.id)
        AND (lt.idempotency_key LIKE $1 OR lt.idempotency_key = ANY($2::text[]))`,
    [`${WORKSPACE.hotel}:%`, allBookings.map((r) => `escrow-prepaid:${r.id}`)],
  );
  const freed = [...goingTxns, ...ghostTxns].map((r) => r.id);
  if (freed.length) await c.query('UPDATE ledger_transactions SET idempotency_key = NULL WHERE id = ANY($1::uuid[])', [freed]);

  // A row of another area that points at a stay or a bill this convergence removes (the cleaning task
  // a check out of a walk in raised, an order put on its bill) would stop the removal. Those stays and
  // bills were made by a demo day or a flow and are going; the pointer is let go first, never the row.
  const goingStays = allStays.map((r) => r.id).filter((sid) => !kept.stays.includes(sid));
  const { rows: allFolios } = await c.query('SELECT id FROM folios WHERE workspace_id = ANY($1::uuid[])', [[WORKSPACE.hotel, WORKSPACE.residences]]);
  const goingFolios = allFolios.map((r) => r.id).filter((fid) => !kept.folios.includes(fid));
  for (const [table, column, going] of [
    ['housekeeping_tasks', 'guest_stay_id', goingStays],
    ['maintenance_tickets', 'guest_stay_id', goingStays],
    ['service_orders', 'guest_stay_id', goingStays],
    ['service_orders', 'folio_id', goingFolios],
    ['stay_refund_requests', 'folio_id', goingFolios],
  ]) {
    if (going.length) await c.query(`UPDATE ${table} SET ${column} = NULL WHERE ${column} = ANY($1::uuid[])`, [going]);
  }
  keep('bookings', kept.bookings);
  keep('escrows', kept.escrows);
  keep('pre_arrival_identities', kept.identities, { column: 'booking_id', values: allBookings.map((r) => r.id) });
  keep('room_assignments', kept.holds);
  keep('guest_stays', kept.stays);
  keep('stay_identities', [], { column: 'guest_stay_id', values: allStays.map((r) => r.id) });
  keep('folios', kept.folios);
  keep('folio_charges', kept.charges);
  keep('ledger_entries', kept.entries);

  log(`frontdesk: ${kept.bookings.length} bookings, ${kept.holds.length} room holds, ${kept.stays.length} stays, ` +
    `${kept.folios.length} folios with ${lines} lines at Isangano`);
}
