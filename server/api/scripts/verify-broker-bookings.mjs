// Verify broker deals and broker bookings over HTTP (0124, 0125; 2026-11-02).
//
// Every claim is a real request over a real session against a running API, with the database read on its
// own to check what was WRITTEN, not only what was answered. It proves:
//
//   - a broker proposes a deal to a hotel in their area; a second live deal for the pair is refused; the
//     hotel's owner sees it and accepts it; another broker cannot see the hotel's rooms without a deal;
//   - the rooms answer with rates and free counts, and a booking of more rooms than are free is refused
//     with nothing written;
//   - paid at the hotel, two rooms become two confirmed bookings at once: no payment, channel travel_agent,
//     the broker, deal and group on each, the guest's own name, and the hotel's reservations show it;
//   - paid by MoMo, one prompt for the group; nothing is booked until it lands, then every room is booked
//     with its own escrow share, and the shares add up to the one payment;
//   - a broker never reads another broker's booking.
//
// It WRITES deals and bookings, so it runs against a SAMPLE database only (refused otherwise), with the API
// serving that database up, in demo mode (the fixed code):
//
//   VERIFY_API_URL=http://localhost:8020 \
//   DATABASE_URL=postgres://injishi:injishi@127.0.0.1:5434/injishi_brokertest \
//   node scripts/verify-broker-bookings.mjs
//
// The broker must work in the hotel's district (the demo broker has no home district until one is set).
import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';

const API = process.env.VERIFY_API_URL || 'http://localhost:8000';
const OTP = process.env.VERIFY_OTP_CODE || '123456';
const DB = process.env.DATABASE_URL?.trim();

const BROKER = 'broker@injishi.com';
const OTHER_BROKER = 'samuel@demo.injishi.com';
const OWNER = 'host@injishi.com';
const HOTEL = '0f9a1b00-0000-4000-8000-000000000001';

let failures = 0;
let checks = 0;
function check(label, ok, detail) {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : `   ${detail}`}`);
}

const SESSIONS = new Map();
async function sessionFor(email) {
  if (SESSIONS.has(email)) return SESSIONS.get(email);
  const headers = { 'Content-Type': 'application/json', origin: 'http://localhost:3000' };
  const sent = await fetch(`${API}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, type: 'sign-in' }),
  });
  if (sent.status === 429) throw new Error(`${email} is OTP rate limited; on a sample database: delete from auth_otp_requests;`);
  const res = await fetch(`${API}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, otp: OTP }),
  });
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  if (!res.ok || !cookie) throw new Error(`could not sign in ${email}: ${res.status}`);
  SESSIONS.set(email, cookie);
  return cookie;
}

async function as(email, method, path, workspaceId, body) {
  const cookie = await sessionFor(email);
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json, message: String(json?.message ?? '') };
}

async function workspaceOf(email, kind, orgId) {
  const { json } = await as(email, 'GET', '/api/v1/me/workspaces');
  const rows = Array.isArray(json) ? json : (json?.workspaces ?? []);
  return rows.find((w) => w.kind === kind && (!orgId || w.orgId === orgId))?.workspaceId ?? null;
}

/** A Kigali calendar day `days` from today. */
function day(days) {
  const d = new Date(Date.now() + 2 * 3600_000);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!DB) throw new Error('DATABASE_URL is not set; point it at the database the API at VERIFY_API_URL serves.');
  const db = new pg.Client({ connectionString: DB });
  await db.connect();
  try {
    await assertSampleDatabase(db);
    // A clean slate for this pair, so the run can be repeated.
    const brokerRow = (await db.query(`select b.id from brokers b join users u on u.id = b.user_id where u.email = $1`, [BROKER])).rows[0];
    if (!brokerRow) throw new Error(`${BROKER} has no broker row; seed the sample world first.`);
    const stays = `select id from guest_stays where booking_id in (select id from bookings where broker_id = $1)`;
    const folios = `select id from folios where guest_stay_id in (${stays})`;
    // What a check-in files alongside the stay: the guest register (0114), the stay's ID, its tasks and thread.
    const registrations = `select id from guest_registrations where guest_stay_id in (${stays})`;
    await db.query(`delete from guest_registration_routes where registration_id in (${registrations})`, [brokerRow.id]);
    await db.query(`delete from guest_registrations where id in (${registrations})`, [brokerRow.id]);
    for (const table of ['stay_identities', 'housekeeping_tasks', 'threads']) {
      await db.query(`delete from ${table} where guest_stay_id in (${stays})`, [brokerRow.id]);
    }
    await db.query(`delete from folio_charges where folio_id in (${folios})`, [brokerRow.id]);
    await db.query(`delete from folios where id in (${folios})`, [brokerRow.id]);
    await db.query(`delete from room_assignments where booking_id in (select id from bookings where broker_id = $1)`, [brokerRow.id]);
    await db.query(`delete from guest_stays where id in (${stays})`, [brokerRow.id]);
    await db.query(`delete from escrows where booking_id in (select id from bookings where broker_id = $1)`, [brokerRow.id]);
    await db.query(`delete from threads where booking_id in (select id from bookings where broker_id = $1)`, [brokerRow.id]);
    await db.query(`delete from bookings where broker_id = $1`, [brokerRow.id]);
    const attempts = `select id from payment_attempts where broker_group_id in (select id from broker_booking_groups where broker_id = $1)`;
    await db.query(`delete from payment_transactions where payment_attempt_id in (${attempts})`, [brokerRow.id]);
    await db.query(`delete from payment_attempts where id in (${attempts})`, [brokerRow.id]);
    await db.query(`delete from broker_booking_groups where broker_id = $1`, [brokerRow.id]);
    await db.query(`delete from broker_hotel_deals where broker_id = $1`, [brokerRow.id]);
    await db.query(`delete from auth_otp_requests`);

    const brokerWs = await workspaceOf(BROKER, 'broker');
    const otherWs = await workspaceOf(OTHER_BROKER, 'broker');
    const hotelWs = await workspaceOf(OWNER, 'business', HOTEL);
    check('the broker, another broker and the hotel owner each have their workspace', Boolean(brokerWs && otherWs && hotelWs));

    console.log('\nDeals');
    const hotels = await as(BROKER, 'GET', '/api/v1/ops/broker/hotels', brokerWs);
    const listed = hotels.json?.hotels?.find((h) => h.orgId === HOTEL);
    check('the hotel is listed in the broker’s area', hotels.status === 200 && Boolean(listed), `${hotels.status} ${hotels.message}`);

    const proposed = await as(BROKER, 'POST', `/api/v1/ops/broker/hotels/${HOTEL}/deals`, brokerWs, {
      terms: { kind: 'percent', percent: 10 },
      note: 'A conference group in December.',
    });
    check('a 10% deal is proposed', proposed.status === 200 && proposed.json?.status === 'proposed', `${proposed.status} ${proposed.message}`);
    const again = await as(BROKER, 'POST', `/api/v1/ops/broker/hotels/${HOTEL}/deals`, brokerWs, {
      terms: { kind: 'bulk_fixed', amountRwf: 200000, minRooms: 10 },
    });
    check('a second live deal for the same hotel is refused (409)', again.status === 409, `${again.status}`);
    const noRooms = await as(BROKER, 'GET', `/api/v1/ops/broker/hotels/${HOTEL}/rooms?checkIn=${day(10)}&checkOut=${day(12)}`, brokerWs);
    check('rooms are not open before the hotel accepts (404)', noRooms.status === 404, `${noRooms.status}`);

    const inbox = await as(OWNER, 'GET', '/api/v1/ops/broker-deals', hotelWs);
    const waiting = inbox.json?.deals?.find((d) => d.id === proposed.json?.id);
    check('the owner sees the proposal with the broker’s note', waiting?.note === 'A conference group in December.', `${inbox.status}`);
    const accepted = await as(OWNER, 'POST', `/api/v1/ops/broker-deals/${proposed.json?.id}/decision`, hotelWs, { decision: 'accept' });
    check('the owner accepts it', accepted.json?.status === 'active', `${accepted.status} ${accepted.message}`);
    const twice = await as(OWNER, 'POST', `/api/v1/ops/broker-deals/${proposed.json?.id}/decision`, hotelWs, { decision: 'decline' });
    check('a second answer is refused (409)', twice.status === 409, `${twice.status}`);

    console.log('\nRooms');
    const checkIn = day(20);
    const checkOut = day(22);
    const offer = await as(BROKER, 'GET', `/api/v1/ops/broker/hotels/${HOTEL}/rooms?checkIn=${checkIn}&checkOut=${checkOut}`, brokerWs);
    const type = offer.json?.roomTypes?.find((t) => t.freeRooms >= 3);
    check('the rooms answer with rates and free counts', offer.status === 200 && Boolean(type), `${offer.status} ${offer.message} ${JSON.stringify(offer.json?.roomTypes?.map((t) => t.freeRooms))}`);
    const strangers = await as(OTHER_BROKER, 'GET', `/api/v1/ops/broker/hotels/${HOTEL}/rooms?checkIn=${checkIn}&checkOut=${checkOut}`, otherWs);
    check('a broker without a deal cannot read them (404)', strangers.status === 404, `${strangers.status}`);
    if (!type) throw new Error('No room type with 3 free rooms; nothing more to check.');

    const room = (guestName) => ({ roomTypeId: type.id, guestName, guestPhone: null, adults: 1, children: 0 });
    const before = Number((await db.query(`select count(*)::int n from bookings where room_type_id = $1`, [type.id])).rows[0].n);
    const tooMany = await as(BROKER, 'POST', `/api/v1/ops/broker/hotels/${HOTEL}/bookings`, brokerWs, {
      checkIn,
      checkOut,
      rooms: Array.from({ length: type.freeRooms + 1 }, (_, i) => room(`Guest ${i + 1}`)),
      contactPhone: '+250 788 000 111',
      payment: { method: 'at_hotel' },
    });
    const after = Number((await db.query(`select count(*)::int n from bookings where room_type_id = $1`, [type.id])).rows[0].n);
    check('more rooms than are free is refused (409), nothing written', tooMany.status === 409 && after === before, `${tooMany.status} ${tooMany.message}`);

    console.log('\nPaid at the hotel');
    const atHotel = await as(BROKER, 'POST', `/api/v1/ops/broker/hotels/${HOTEL}/bookings`, brokerWs, {
      checkIn,
      checkOut,
      rooms: [room('Aline Uwase'), room('Jean Mugabo')],
      contactPhone: '+250 788 000 111',
      note: 'Arriving after 20:00.',
      payment: { method: 'at_hotel' },
    });
    const g1 = atHotel.json;
    check('two rooms are booked at once', atHotel.status === 200 && g1?.status === 'booked' && g1?.rooms?.every((r) => r.booking), `${atHotel.status} ${atHotel.message}`);
    const rows1 = (await db.query(
      `select status::text, payment_status::text, channel::text, broker_id, broker_deal_id, guest_name, guest_user_id, desk_note, gross_rwf
         from bookings where broker_group_id = $1 order by guest_name`,
      [g1?.id],
    )).rows;
    check('…as two confirmed bookings', rows1.length === 2 && rows1.every((r) => r.status === 'confirmed'));
    check('…with no payment taken', rows1.every((r) => r.payment_status === null));
    check('…from a travel agent, under the broker and the deal', rows1.every((r) => r.channel === 'travel_agent' && r.broker_id === brokerRow.id && r.broker_deal_id === proposed.json?.id));
    check('…each with the guest’s own name and no account', rows1.map((r) => r.guest_name).join(',') === 'Aline Uwase,Jean Mugabo' && rows1.every((r) => r.guest_user_id === null));
    check('…and a desk note naming the broker and the group', rows1.every((r) => String(r.desk_note).includes(g1?.reference) && String(r.desk_note).includes('Arriving after 20:00.')));
    check('the total is the rooms’ prices added up', g1?.totalRwf === rows1.reduce((s, r) => s + Number(r.gross_rwf), 0));
    check('the commission is 10% of it, 85% to the broker', g1?.commission?.commissionRwf === Math.round(g1.totalRwf * 0.1) && g1?.commission?.brokerRwf === g1.commission.commissionRwf - Math.round(g1.commission.commissionRwf * 0.15));
    check('no escrow is held for it', Number((await db.query(`select count(*)::int n from escrows where booking_id in (select id from bookings where broker_group_id = $1)`, [g1?.id])).rows[0].n) === 0);

    const reservations = await as(OWNER, 'GET', `/api/v1/ops/reservations?from=${checkIn}&to=${checkOut}`, hotelWs);
    const list = Array.isArray(reservations.json) ? reservations.json : (reservations.json?.reservations ?? reservations.json?.items ?? []);
    const names = list.map((r) => r.guestName ?? r.guest?.name);
    check('the hotel’s reservations show the guests by name', names.includes('Aline Uwase') && names.includes('Jean Mugabo'), `${reservations.status} ${JSON.stringify(names).slice(0, 200)}`);

    console.log('\nPaid by MoMo');
    // Later dates, so the two rooms paid at the hotel above do not take this group's rooms.
    const momo = await as(BROKER, 'POST', `/api/v1/ops/broker/hotels/${HOTEL}/bookings`, brokerWs, {
      checkIn: day(30),
      checkOut: day(32),
      rooms: [room('Claude Habimana'), room('Diane Ingabire')],
      contactPhone: '+250 788 000 111',
      payment: {
        method: 'momo',
        instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn: '788123456' },
        attemptToken: crypto.randomUUID(),
      },
    });
    const g2 = momo.json;
    check('the group waits for its one payment', momo.status === 200 && g2?.status === 'awaiting_payment' && g2?.attempt?.state === 'prompting', `${momo.status} ${momo.message} ${g2?.status}`);
    check('…and nothing is booked yet', Number((await db.query(`select count(*)::int n from bookings where broker_group_id = $1`, [g2?.id])).rows[0].n) === 0);
    let polled = g2;
    for (let i = 0; i < 20 && polled?.status === 'awaiting_payment'; i++) {
      await sleep(1500);
      polled = (await as(BROKER, 'GET', `/api/v1/ops/broker/bookings/${g2?.id}`, brokerWs)).json;
    }
    check('once the phone approves, both rooms are booked', polled?.status === 'booked', `${polled?.status} ${polled?.failureReason ?? ''}`);
    const paid = (await db.query(
      `select b.payment_status::text, e.amount_rwf, e.status::text as escrow_status
         from bookings b join escrows e on e.booking_id = b.id where b.broker_group_id = $1`,
      [g2?.id],
    )).rows;
    check('…each captured, with its own share held in escrow', paid.length === 2 && paid.every((r) => r.payment_status === 'captured' && r.escrow_status === 'held'));
    check('…and the shares add up to the one payment', paid.reduce((s, r) => s + Number(r.amount_rwf), 0) === g2?.totalRwf);

    console.log('\nCheck-in');
    const tonight = await as(BROKER, 'POST', `/api/v1/ops/broker/hotels/${HOTEL}/bookings`, brokerWs, {
      checkIn: day(0),
      checkOut: day(1),
      rooms: [room('Eric Nshuti')],
      contactPhone: '+250 788 000 111',
      payment: { method: 'at_hotel' },
    });
    const tonightBooking = tonight.json?.rooms?.[0]?.booking?.id;
    check('a room for tonight is booked', tonight.json?.status === 'booked' && Boolean(tonightBooking), `${tonight.status} ${tonight.message}`);
    const freeRoom = (await db.query(
      `select r.id from rooms r
        where r.room_type_id = $1 and r.status = 'available'
          and not exists (select 1 from guest_stays s where s.room_id = r.id and s.lifecycle = 'open')
        order by r.label limit 1`,
      [type.id],
    )).rows[0]?.id;
    const checkedIn = await as(OWNER, 'POST', `/api/v1/ops/stays/${tonightBooking}/checkin`, hotelWs, { roomId: freeRoom });
    check('the desk checks the broker’s guest in', checkedIn.status === 200 || checkedIn.status === 201, `${checkedIn.status} ${checkedIn.message}`);
    const stay = (await db.query(`select id, guest_name, guest_user_id from guest_stays where booking_id = $1`, [tonightBooking])).rows[0];
    check('…and the stay carries the guest’s own name', stay?.guest_name === 'Eric Nshuti' && stay?.guest_user_id === null, JSON.stringify(stay));
    const deposit = Number((await db.query(
      `select count(*)::int n from folio_charges c join folios f on f.id = c.folio_id
        where f.guest_stay_id = $1 and c.charge_type = 'deposit'`,
      [stay?.id],
    )).rows[0].n);
    check('…with no online prepayment credited on the bill', deposit === 0);

    console.log('\nPrivacy');
    const peek = await as(OTHER_BROKER, 'GET', `/api/v1/ops/broker/bookings/${g1?.id}`, otherWs);
    check('another broker cannot read this broker’s booking (404)', peek.status === 404, `${peek.status}`);
    const mine = await as(BROKER, 'GET', '/api/v1/ops/broker/bookings', brokerWs);
    check('the broker’s list has all three groups', mine.json?.groups?.length === 3, `${mine.json?.groups?.length}`);
  } finally {
    await db.end();
  }
  console.log(`\n${checks - failures}/${checks} checks passed.`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
