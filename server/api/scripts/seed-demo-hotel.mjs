#!/usr/bin/env node
// Amahoro Boutique Hotel's working day (demo showcase, 2026-09-15).
//
// `seed-demo.mjs` gives the demo hotel its roster, twenty rooms and eight
// reservations. That is a desk, not a hotel: nobody had stayed there, no bill
// had ever been opened, and the Services, Maintenance and Finance screens had
// nothing to show. This script seeds the operation those screens read, as a
// hotel mid-morning would have it:
//
//   departments (USALI) -> department members -> outlets -> menu
//   -> a month of stays, each with its bill, charges, payments and ledger lines
//   -> tonight's in-house guests, today's departures and arrivals
//   -> the next fortnight's bookings and room holds
//   -> a conversation per booking, today's housekeeping board,
//      maintenance tickets, and this morning's orders
//
// Money is written the way the API writes it, because the demo's integrity
// checks (`verify-demo-story.mjs --db`) hold the seed to the same rules as the
// commands: one ledger transaction and one ledger entry per charge, signed like
// the charge; a bill's balance is the sum of its lines; a revenue line names a
// revenue centre; tax is its own line; a closed bill is at zero.
//
// Guests are accounts of their own (`@guests.demo.injishi.com`), because the
// reservations desk reads a guest's name from the account. They live OUTSIDE
// the persona namespace (`de300000-0000-4000-8001-0017…`), so the sign in
// picker still lists exactly the fifteen demo personas.
//
// Ids: every row this script writes is `de300000-0000-4000-8000-0017FFNNNNNN`
// (family FF, serial N). Deterministic, so a second run is a no-op.
//
// Dates are Africa/Kigali's calendar and clock times are Kigali wall clock
// (UTC+2). `DEMO_SEED_NOW=2026-09-14T23:30:00Z` fakes "now" for testing.
//
// Run with (after seed-demo.mjs and seed-demo-catalogue.mjs):
//   node scripts/seed-demo-hotel.mjs            seed
//   node scripts/seed-demo-hotel.mjs --purge    delete only this script's rows
//   node scripts/seed-demo-hotel.mjs --reset    purge, then seed
//
// `seed-demo.mjs --refresh` moves every date here too: it discovers the tables.
//
// SAFETY. Refuses any database without the sample marker (ADR-043), like every
// seed. There is no flag to override it.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';

// --- Fixed points owned by seed-demo.mjs ---------------------------------------

const W = 'de300000-0000-4000-8000-000000000201'; // Amahoro workspace
const ORG = 'de300000-0000-4000-8000-000000000101'; // Amahoro Hospitality Group
const PROPERTY = 'de300000-0000-4000-8000-000000000401'; // Amahoro Boutique Hotel
const STAFF = {
  yves: 'de300000-0000-4000-8000-000000000001',
  solange: 'de300000-0000-4000-8000-000000000002',
  denise: 'de300000-0000-4000-8000-000000000003',
  beatha: 'de300000-0000-4000-8000-000000000004',
};
const SAMUEL = 'de300000-0000-4000-8000-000000000006';
const RAYAN = 'de300000-0000-4000-8000-000000000011';
const BK_DEMO_004 = 'de300000-0000-4000-8000-000000000904';
const BK_DEMO_005 = 'de300000-0000-4000-8000-000000000905';
const BK_DEMO_006 = 'de300000-0000-4000-8000-000000000906';
const GS_SAMUEL = 'de300000-0000-4000-8000-000000001001';
const GS_RAYAN = 'de300000-0000-4000-8000-000000001002';

// --- Ids --------------------------------------------------------------------

const pad = (n, w) => String(n).padStart(w, '0');
/** A row this script owns: family (2 digits) then serial (6). */
const H = (family, n) => `de300000-0000-4000-8000-0017${family}${pad(n, 6)}`;
const GUEST_ID = (n) => `de300000-0000-4000-8001-001700${pad(n, 6)}`;
const OWNED_LIKE = 'de300000-0000-4000-8000-0017%';
const GUEST_LIKE = 'de300000-0000-4000-8001-0017%';

const F = {
  department: '01', member: '02', party: '03', outlet: '04', category: '05', item: '06',
  booking: '07', stay: '08', escrow: '09', thread: '10', message: '11', assignment: '12',
  folio: '13', charge: '14', ledgerTxn: '15', ledgerEntry: '16', task: '17', ticket: '18',
  ticketEvent: '19', order: '20', orderItem: '21', orderEvent: '22',
};

function counter(family) {
  let n = 0;
  return () => H(family, ++n);
}

/** Base32 without the letters a reader confuses, as the API mints its codes. */
const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function code(seed, length) {
  const bytes = crypto.createHash('sha256').update(seed).digest();
  let out = '';
  for (let i = 0; i < length; i += 1) out += BASE32[bytes[i] % 32];
  return out;
}
function digits(seed, length) {
  const bytes = crypto.createHash('sha256').update(seed).digest();
  let out = '';
  for (let i = 0; i < length; i += 1) out += String(bytes[i] % 10);
  return out;
}

// --- Time -------------------------------------------------------------------

/**
 * The seed's clock. `DEMO_SEED_NOW` (an ISO instant, e.g.
 * `2026-09-14T23:30:00Z`) stands in for "now", read ONLY by the demo seeds, so
 * the hour when the Kigali and UTC calendars disagree can be tested on purpose.
 * Unset, it is the real clock.
 */
const NOW = (() => {
  const fake = process.env.DEMO_SEED_NOW?.trim();
  if (!fake) return new Date();
  const d = new Date(fake);
  if (Number.isNaN(d.getTime())) throw new Error(`DEMO_SEED_NOW is not a date: ${fake}`);
  return d;
})();

/**
 * Days from today, as a bare YYYY-MM-DD the `date` columns take verbatim.
 *
 * TODAY IS KIGALI'S (Africa/Kigali, UTC+2, no daylight saving): every demo
 * property's desk, night audit and month run on it. The UTC calendar is a day
 * behind between 22:00 and 24:00 UTC, which put an arrival "today" on
 * yesterday's line of a Today screen.
 */
function day(offset) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(NOW);
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/**
 * A clock time in Kigali on a day relative to today. The demo is reseeded at
 * 03:00 and read during the day, so the hotel's moments are pinned to the
 * clock ("breakfast delivered at 07:55") rather than to when the seed ran.
 */
function at(offset, hm) {
  return new Date(`${day(offset)}T${hm}:00+02:00`);
}

// --- Environment ---------------------------------------------------------------

function loadDotEnv() {
  const file = path.join(process.cwd(), '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) process.env[match[1]] ??= match[2];
  }
}

// --- The guests -----------------------------------------------------------------
//
// Fictional people. A Kigali boutique hotel's month: Rwandan business travellers
// and families, visitors from the region, NGO and conference guests from
// further away. `key` is how the stays below name them.

const GUESTS = [
  ['g01', 'Eric', 'Mugisha'],
  ['g02', 'Sophie', 'Laurent'],
  ['g03', 'Brian', 'Otieno'],
  ['g04', 'Clarisse', 'Umutoni'],
  ['g05', 'Daniel', 'Becker'],
  ['g06', 'Aline', 'Ingabire'],
  ['g07', 'Kwabena', 'Asante'],
  ['g08', 'Priya', 'Raman'],
  ['g09', 'Jean-Claude', 'Bizimana'],
  ['g10', 'Hannah', 'Schmidt'],
  ['g11', 'Faith', 'Wanjiru'],
  ['g12', 'Pieter', 'De Smet'],
  ['g13', 'Amina', 'Nakato'],
  ['g14', 'Didier', 'Twagirayezu'],
  ['g15', 'Ngozi', 'Adeyemi'],
  ['g16', 'Joseph', 'Mwakyusa'],
  ['g17', 'Chloé', 'Dubois'],
  ['g18', 'Patrick', 'Niyonzima'],
  ['g19', 'Maria', 'Gonzalez'],
  ['g20', 'Diane', 'Uwimbabazi'],
  ['g21', 'Peter', 'Kamau'],
  ['g22', 'Liliane', 'Mutesi'],
  ['g23', 'Lucas', 'Moreau'],
  ['g24', 'Halima', 'Said'],
  ['g25', 'Fabrice', 'Irakoze'],
  ['g26', 'Esther', 'Nabirye'],
  ['g27', 'James', 'Whitfield'],
  ['g28', 'Kevin', 'Manzi'],
  ['g29', 'Josiane', 'Mukamurenzi'],
  ['g30', 'David', 'Okello'],
  ['g31', 'Elena', 'Rossi'],
  ['g32', 'Aimé', 'Ndikumana'],
  ['g33', 'Gloria', 'Isimbi'],
  ['g34', 'Tobias', 'Lindqvist'],
  ['g35', 'Arsène', 'Lukusa'],
  ['g36', 'Vestine', 'Nyiransabimana'],
  ['g37', 'Kenji', 'Watanabe'],
  ['g38', 'Chantal', 'Uwamahoro'],
  ['g39', 'Claude', 'Rukundo'],
  ['g40', 'Nadine', 'Umuhoza'],
  ['g41', 'Sarah', 'Mitchell'],
  ['g42', 'Moses', 'Kalisa'],
  ['g43', 'Rebecca', 'Achieng'],
  ['g44', 'Ahmed', 'Hassan'],
  ['g45', 'Isabelle', 'Fontaine'],
  ['g46', 'Joel', 'Mutabazi'],
  ['g47', 'Ruth', 'Namukasa'],
  ['g48', 'Thomas', 'Keller'],
  ['g49', 'Yvonne', 'Umurerwa'],
  ['g50', 'Benedict', 'Oduya'],
  ['g51', 'Anna', 'Kowalska'],
  ['g52', 'Robert', 'Mensah'],
  ['g53', 'Pacifique', 'Ishimwe'],
  ['g54', 'Lena', 'Hoffmann'],
  ['g55', 'Kwame', 'Boateng'],
  ['g56', 'Marco', 'Bianchi'],
  ['g57', 'Ivan', 'Petrov'],
].map(([key, first, last], i) => ({
  key,
  id: GUEST_ID(i + 1),
  name: `${first} ${last}`,
  email: `${`${first}.${last}`
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z.]+/g, '')}@guests.demo.injishi.com`,
}));
const GUEST = Object.fromEntries(GUESTS.map((g) => [g.key, g]));

// --- Departments ------------------------------------------------------------------
//
// The USALI set every property is born with (`usali-departments.ts`), mirrored
// in SQL as seed-content.mjs does for its hotel. Migration 0011 only backfilled
// properties that existed when it ran, and on a fresh database no property does.

const USALI = [
  ['rooms', 'Rooms', 'operated', true, 10, 'Solange Uwera'],
  ['fnb', 'Food and Beverage', 'operated', true, 20, 'Emmanuel Habineza'],
  ['spa_recreation', 'Spa and Recreation', 'operated', true, 30, null],
  ['other_operated', 'Other Operated Departments', 'operated', false, 40, null],
  ['misc_income', 'Miscellaneous Income', 'operated', false, 50, null],
  ['admin_general', 'Administrative and General', 'undistributed', false, 60, 'Yves Rutayisire'],
  ['sales_marketing', 'Sales and Marketing', 'undistributed', false, 70, null],
  ['it', 'Information and Telecommunications', 'undistributed', false, 80, null],
  ['engineering', 'Engineering and Maintenance', 'undistributed', true, 90, 'Jean-Paul Munyaneza'],
  ['utilities', 'Utilities', 'undistributed', false, 100, null],
  ['hr', 'Human Resources', 'undistributed', false, 110, null],
];

// --- Outlets and the menu -----------------------------------------------------------
//
// Three hotel operated outlets, all Food and Beverage. Prices are TAX EXCLUSIVE,
// as the order service prices them; VAT (TAX_B) is added as its own line. The
// RRA classification codes are the two food and drink codes the sample list
// (`data/rra-item-classifications.sample.json`) carries, so every item is
// sellable on every channel.

const EVERY_DAY = (windows) =>
  Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, windows]));

const OUTLETS = [
  {
    key: 'R', name: 'Umuvumu Restaurant', kind: 'restaurant', access: 'both', sort: 10,
    hours: EVERY_DAY([['06:30', '10:30'], ['12:00', '15:00'], ['18:30', '22:30']]),
  },
  {
    key: 'B', name: 'Terrace Bar', kind: 'bar', access: 'both', sort: 20,
    hours: { ...EVERY_DAY(['11:00', '23:30']), fri: ['11:00', '01:00'], sat: ['11:00', '01:00'] },
  },
  {
    key: 'RS', name: 'Room Service', kind: 'room_service', access: 'in_house_only', sort: 30,
    hours: EVERY_DAY(['06:00', '23:00']),
  },
];

const FOOD = '1110160600';
const DRINK = '1110170400';

const MENU = [
  {
    key: 'breakfast', outlet: 'R', name: 'Breakfast', cls: FOOD, fulfil: 'onsite',
    items: [
      ['full-breakfast', 'Full breakfast', 12000, 'Two eggs your way, beef sausage, grilled tomato, fried plantain, fruit, bread and tea or coffee.', 15],
      ['omelette', 'Spanish omelette', 6500, 'Three eggs, potato, onion and peppers, with toast.', 12],
      ['fruit-yoghurt', 'Fruit plate with yoghurt', 5000, 'Pineapple, papaya, passion fruit and banana with local yoghurt.', 5],
      ['tea-mandazi', 'African tea and mandazi', 4000, 'Spiced milk tea with two fresh mandazi.', 5],
    ],
  },
  {
    key: 'mains', outlet: 'R', name: 'Lunch and dinner', cls: FOOD, fulfil: 'onsite',
    items: [
      ['tilapia', 'Grilled tilapia with plantain', 16000, 'Whole Lake Kivu tilapia, grilled, with fried plantain and kachumbari.', 30],
      ['brochettes', 'Goat brochettes with chips', 12000, 'Three skewers of marinated goat with chips and pili pili on the side.', 20],
      ['beef-fillet', 'Beef fillet with pepper sauce', 18000, 'Grilled fillet with green pepper sauce, sautéed potatoes and vegetables.', 25],
      ['chicken-stew', 'Chicken stew with rice', 13000, 'Slow cooked chicken in tomato and onion sauce, with rice.', 20],
      ['veg-curry', 'Vegetable curry with rice', 10000, 'Seasonal vegetables and beans in a mild coconut curry.', 20],
      ['isombe', 'Isombe with ugali', 9000, 'Cassava leaves cooked with aubergine and peanut paste, with ugali.', 20],
    ],
  },
  {
    key: 'drinks', outlet: 'B', name: 'Drinks', cls: DRINK, fulfil: 'onsite',
    items: [
      ['lager', 'Local lager (500 ml)', 2500, null, 2],
      ['imported-lager', 'Imported lager (330 ml)', 3500, null, 2],
      ['house-wine', 'Glass of house red wine', 6000, null, 2],
      ['passion-juice', 'Fresh passion juice', 3000, 'Pressed to order.', 5],
      ['americano', 'Rwandan coffee (Americano)', 2500, 'Single origin beans roasted in Kigali.', 5],
      ['cappuccino', 'Cappuccino', 3500, null, 5],
      ['soft-drink', 'Soft drink (300 ml)', 1500, null, 2],
      ['water', 'Still water (500 ml)', 1000, null, 1],
    ],
  },
  {
    key: 'bites', outlet: 'B', name: 'Bar bites', cls: FOOD, fulfil: 'onsite',
    items: [
      ['samosas', 'Beef samosas (three)', 4000, null, 10],
      ['wings', 'Chicken wings', 8000, 'Eight wings with a honey and chilli glaze.', 20],
      ['chips-masala', 'Chips masala', 4500, null, 12],
    ],
  },
  {
    key: 'in-room', outlet: 'RS', name: 'In-room dining', cls: FOOD, fulfil: 'in_room_delivery',
    items: [
      ['club-sandwich', 'Club sandwich with chips', 9500, 'Chicken, egg, tomato and lettuce on toasted bread.', 20],
      ['burger', 'Beef burger with chips', 11000, null, 25],
      ['breakfast-tray', 'Continental breakfast tray', 10000, 'Bread basket, butter and jam, fruit, yoghurt, juice and tea or coffee.', 20],
      ['tea-pot', 'Pot of African tea', 3500, null, 10],
      ['rs-passion-juice', 'Fresh passion juice', 3000, null, 5],
    ],
  },
];

// --- The month --------------------------------------------------------------------
//
// Every stay, as a room, a guest and the nights `[in, out)` relative to today.
// Rooms were planned one timeline at a time so no two stays or holds overlap,
// and `validate()` proves it again before anything is written.
//
// Tonight 14 of 20 rooms are occupied (70%): ten guests staying on, Samuel
// Kayitare in 101 (BK-DEMO-005, seed-demo.mjs), a walk in in 106, and three
// guests who leave today still owing on their bills. Five arrivals are due:
// BK-DEMO-004 and a04 with no room yet, a01 and a02 in rooms inspected and
// ready, and a03 held in 104, which its current guest vacates this morning.
// 307 is off sale with a ceiling leak.

const TYPE = { std: 'Standard Double', suite: 'Executive Suite', twin: 'Deluxe Twin' };

/** Stays that have ended. Extras follow a pattern by index; see `closedExtras`. */
const CLOSED = [
  ['c01', '101', 'std', 'g01', -27, -24],
  ['c02', '101', 'std', 'g02', -12, -9],
  ['c03', '102', 'std', 'g03', -25, -21],
  ['c04', '102', 'std', 'g04', -8, -5],
  ['c05', '103', 'std', 'g05', -19, -16],
  ['c06', '103', 'std', 'g06', -4, -1],
  ['c07', '104', 'std', 'g07', -29, -26],
  ['c08', '104', 'std', 'g08', -15, -12],
  ['c09', '105', 'std', 'g09', -20, -17],
  ['c10', '106', 'std', null, -10, -7, 'Jean-Pierre Nzeyimana'], // a walk in
  ['c11', '107', 'std', 'g10', -3, 0], // left at 06:15 for an early flight
  ['c12', '108', 'std', 'g11', -7, -4],
  ['c13', '201', 'suite', 'g12', -24, -20],
  ['c14', '202', 'suite', 'g13', -18, -15],
  ['c15', '203', 'suite', 'g14', -9, -6],
  ['c16', '204', 'suite', 'g15', -13, -10],
  ['c17', '301', 'twin', 'g16', -26, -23],
  ['c18', '302', 'twin', 'g17', -16, -13],
  ['c19', '303', 'twin', 'g18', -11, -8],
  ['c20', '304', 'twin', 'g19', -21, -18],
  ['c21', '305', 'twin', 'g20', -6, -2],
  ['c22', '306', 'twin', 'g21', -23, -19],
  ['c23', '307', 'twin', 'g22', -17, -14],
  ['c24', '308', 'twin', 'g23', -28, -25],
  ['c25', '308', 'twin', 'g24', -10, -6],
].map(([key, room, type, guest, from, to, walkInName]) => ({
  key, room, type, guest, in: from, out: to, stay: 'closed', status: 'confirmed', walkInName,
}));

/**
 * Guests in the house now. `lines` is their bill beyond the nightly room
 * charge: [kind, …] where kind is `pos` (outlet, description, amount, day,
 * time), `laundry` (description, amount, day, time), `room` (a manual room
 * charge: description, amount, day, time) or `pay` (method, amount, day, time).
 */
const IN_HOUSE = [
  { key: 'o01', room: '102', type: 'std', guest: 'g25', in: -2, out: 1, guests: 1,
    lines: [['pay', 'card', 150000, -2, '15:40'], ['laundry', 'Laundry, 4 items', 6000, -1, '09:30']] },
  { key: 'o02', room: '105', type: 'std', guest: 'g26', in: -1, out: 3, guests: 1,
    lines: [['pos', 'B', 'Terrace Bar: two local lagers', 5000, -1, '21:10']] },
  { key: 'o03', room: '106', type: 'std', guest: null, walkInName: 'Innocent Nsengiyumva', in: -1, out: 1, guests: 1,
    lines: [['pay', 'cash', 75000, -1, '18:05'], ['pos', 'B', 'Terrace Bar: soft drink and beef samosas', 5500, -1, '20:45']] },
  { key: 'o04', room: '201', type: 'suite', guest: 'g27', in: -2, out: 2, guests: 1,
    lines: [['pay', 'card', 300000, -2, '16:20'], ['pos', 'R', 'Dinner: beef fillet and a glass of house red', 24000, -2, '20:30']] },
  { key: 'o05', room: '202', type: 'suite', guest: 'g28', in: -1, out: 4, guests: 2,
    lines: [['pay', 'mobile_money', 150000, -1, '14:50']] },
  { key: 'o06', room: '301', type: 'twin', guest: 'g29', in: -5, out: 1, guests: 2,
    lines: [
      ['pay', 'mobile_money', 270000, -3, '09:15'],
      ['pos', 'R', 'Dinner for two: tilapia and chicken stew', 29000, -5, '20:00'],
      ['pos', 'B', 'Terrace Bar: juices and coffee', 11000, -3, '17:30'],
    ] },
  { key: 'o07', room: '303', type: 'twin', guest: 'g30', in: -2, out: 2, guests: 1,
    lines: [['pay', 'card', 90000, -2, '17:05']] },
  { key: 'o08', room: '304', type: 'twin', guest: 'g31', in: -1, out: 2, guests: 2,
    lines: [['pay', 'card', 90000, -1, '15:25'], ['pos', 'B', 'Terrace Bar: two glasses of house red', 12000, -1, '19:40']] },
  { key: 'o09', room: '306', type: 'twin', guest: 'g32', in: -4, out: 3, guests: 1,
    lines: [['pay', 'mobile_money', 180000, -4, '13:55'], ['pos', 'R', 'Dinner: grilled tilapia', 16000, -3, '19:50']] },
  { key: 'o10', room: '308', type: 'twin', guest: 'g33', in: -6, out: 1, guests: 1,
    lines: [
      ['pay', 'cash', 200000, -6, '16:10'],
      ['pay', 'mobile_money', 200000, -2, '08:40'],
      ['laundry', 'Laundry, 7 items', 9000, -3, '09:10'],
      ['pos', 'B', 'Terrace Bar: chicken wings and a lager', 10500, -4, '20:15'],
    ] },
  // Due out today, every one still owing: the desk settles these at the counter.
  { key: 'd01', room: '302', type: 'twin', guest: 'g34', in: -3, out: 0, guests: 1,
    lines: [['pay', 'card', 180000, -3, '15:10'], ['pos', 'R', 'Dinner: chicken stew with rice', 13000, -2, '20:05']] },
  { key: 'd02', room: '203', type: 'suite', guest: 'g35', in: -2, out: 0, guests: 1,
    lines: [
      ['pay', 'mobile_money', 150000, -2, '17:45'],
      ['pos', 'B', 'Terrace Bar: imported lagers with a client', 10500, -1, '19:30'],
      ['room', 'Late check-out until 16:00 (half day)', 75000, 0, '09:15'],
    ] },
  { key: 'd03', room: '104', type: 'std', guest: 'g36', in: -4, out: 0, guests: 2,
    lines: [['pay', 'cash', 150000, -4, '14:30'], ['laundry', 'Laundry, 6 items', 7500, -2, '09:45']] },
].map((s) => ({ ...s, stay: 'open', status: 'confirmed' }));

/** Bookings with nobody in the house yet: today's arrivals, the fortnight ahead, and the odd one that went wrong. */
const AHEAD = [
  { key: 'a01', room: '305', type: 'twin', guest: 'g37', in: 0, out: 2, guests: 1 },
  { key: 'a02', room: '204', type: 'suite', guest: 'g38', in: 0, out: 3, guests: 2 },
  { key: 'a03', room: '104', type: 'std', guest: 'g39', in: 0, out: 2, guests: 2 },
  { key: 'a04', room: null, type: 'twin', guest: 'g40', in: 0, out: 1, guests: 1 },
  { key: 'f01', room: '103', type: 'std', guest: 'g41', in: 1, out: 4, guests: 2 },
  { key: 'f02', room: '108', type: 'std', guest: 'g42', in: 1, out: 3, guests: 1 },
  { key: 'f03', room: '203', type: 'suite', guest: 'g43', in: 3, out: 5, guests: 2 },
  { key: 'f04', room: '106', type: 'std', guest: 'g44', in: 2, out: 6, guests: 1 },
  { key: 'f05', room: '302', type: 'twin', guest: 'g45', in: 2, out: 4, guests: 2 },
  { key: 'f06', room: '102', type: 'std', guest: 'g46', in: 3, out: 5, guests: 1 },
  { key: 'f07', room: '105', type: 'std', guest: 'g47', in: 4, out: 6, guests: 1 },
  { key: 'f08', room: '101', type: 'std', guest: 'g48', in: 5, out: 8, guests: 1 },
  { key: 'f09', room: '107', type: 'std', guest: 'g49', in: 6, out: 9, guests: 2 },
  { key: 'f10', room: '307', type: 'twin', guest: 'g50', in: 8, out: 10, guests: 1 },
  { key: 'f11', room: null, type: 'twin', guest: 'g51', in: 9, out: 12, guests: 2 },
  { key: 'f12', room: null, type: 'suite', guest: 'g52', in: 11, out: 14, guests: 1 },
  { key: 'f13', room: null, type: 'std', guest: 'g53', in: 13, out: 15, guests: 2 },
  { key: 'f14', room: null, type: 'twin', guest: 'g54', in: 18, out: 21, guests: 2 },
  { key: 'f15', room: null, type: 'suite', guest: 'g01', in: 25, out: 27, guests: 2 }, // Eric, back again
  { key: 'p01', room: null, type: 'suite', guest: 'g55', in: 5, out: 8, guests: 2, status: 'pending_approval' },
  { key: 'x01', room: null, type: 'twin', guest: 'g56', in: 6, out: 8, guests: 1, status: 'cancelled' },
  { key: 'n01', room: null, type: 'std', guest: 'g57', in: -1, out: 1, guests: 1, status: 'no_show' },
].map((s) => ({ status: 'confirmed', stay: null, ...s }));

const STAYS = [...CLOSED, ...IN_HOUSE, ...AHEAD];

/**
 * A departed guest's bill beyond the room: a pattern by index, so the month
 * reads like a month (some dine, some drink, some only sleep) without every
 * bill being written out by hand.
 */
function closedExtras(i, s) {
  const second = Math.min(s.in + 1, s.out - 1);
  switch (i % 5) {
    case 0: return [['pos', 'R', 'Dinner for two: tilapia and goat brochettes', 28000, s.in, '20:15']];
    case 1: return [['pos', 'B', 'Terrace Bar tab', 9500, second, '21:30']];
    case 2: return [
      ['laundry', 'Laundry, 5 items', 7500, second, '10:00'],
      ['pos', 'R', 'Dinner: chicken stew with rice', 13000, s.in, '19:45'],
    ];
    case 3: return [['pos', 'RS', 'Room service: club sandwich and tea', 13000, s.in, '21:45']];
    default: return [['pos', 'R', 'Breakfast: full breakfast', 12000, second, '07:30']];
  }
}

const METHODS = ['mobile_money', 'card', 'cash', 'card', 'mobile_money'];

/** Today's orders. Two were delivered and charged to the room; the rest are on the board. */
const ORDERS = [
  { key: 'so1', outlet: 'RS', stay: 'o05', context: 'in_house_folio', channel: 'guest_app',
    items: [['breakfast-tray', 2], ['rs-passion-juice', 2]], note: 'Breakfast for two at 07:45, please.',
    trail: [['submitted', '07:18'], ['acknowledged', '07:20'], ['in_progress', '07:24'], ['ready', '07:48'], ['delivered', '07:55']] },
  { key: 'so2', outlet: 'R', stay: 'd01', context: 'in_house_folio', channel: 'front_desk',
    items: [['omelette', 1], ['tea-mandazi', 1]], note: null,
    trail: [['submitted', '07:05'], ['acknowledged', '07:06'], ['in_progress', '07:08'], ['ready', '07:20'], ['delivered', '07:22'], ['completed', '07:40']] },
  { key: 'so3', outlet: 'RS', stay: 'o07', context: 'in_house_folio', channel: 'guest_app',
    items: [['club-sandwich', 1], ['tea-pot', 1]], note: 'No mayonnaise, please.',
    trail: [['submitted', '12:10'], ['acknowledged', '12:12'], ['in_progress', '12:20']] },
  { key: 'so4', outlet: 'R', stay: 'o04', context: 'in_house_folio', channel: 'front_desk',
    items: [['tilapia', 1], ['veg-curry', 1]], note: 'Table on the terrace.',
    trail: [['submitted', '12:30'], ['acknowledged', '12:31'], ['in_progress', '12:35'], ['ready', '12:55']] },
  { key: 'so5', outlet: 'B', stay: 'o02', context: 'in_house_folio', channel: 'guest_app',
    items: [['passion-juice', 2], ['samosas', 1]], note: 'We are at the corner table on the terrace.',
    trail: [['submitted', '12:40']] },
  { key: 'so6', outlet: 'B', stay: null, context: 'pay_now', channel: 'staff',
    items: [['cappuccino', 2]], note: null,
    trail: [['pending_payment', '12:44'], ['submitted', '12:45'], ['acknowledged', '12:46']] },
  { key: 'so7', outlet: 'RS', stay: 'o03', context: 'in_house_folio', channel: 'front_desk',
    items: [['burger', 1]], note: 'Cancelled at the desk: the guest had to leave for a meeting.',
    trail: [['submitted', '09:10'], ['cancelled', '09:18']] },
];

/** Conversations worth opening. The rest of the bookings carry a quiet thread. */
const MESSAGES = {
  a01: [
    ['g37', -1, '18:02', 'Hello, I land at Kigali airport at 11:40 tomorrow on the Nairobi flight. Could someone meet me?'],
    ['denise', -1, '18:20', 'Welcome to Amahoro. Yes, our driver can meet you at arrivals with a name board. The transfer is 25,000 RWF and goes on your bill.'],
    ['g37', -1, '18:31', 'Perfect, please book it. See you tomorrow.'],
  ],
  a04: [
    ['g40', 0, '08:05', 'My bus from Huye gets in late, around 23:00. Please keep my room.'],
  ],
  d02: [
    ['g35', -1, '21:10', 'Could I keep the room until 16:00 tomorrow? My last meeting ends at 15:00.'],
    ['solange', -1, '21:25', 'Late check-out until 16:00 is confirmed. It is charged at half the nightly rate.'],
    ['g35', -1, '21:27', 'Thank you, that works.'],
  ],
  o05: [
    ['g28', 0, '07:10', 'Could we have breakfast in the room at 07:45?'],
    ['denise', 0, '07:13', 'Of course. Order from the room service menu and it will be with you by 07:45.'],
  ],
  o07: [
    ['g30', 0, '07:40', 'The air conditioning in 303 rattled most of the night.'],
    ['denise', 0, '07:52', 'Sorry about that. Engineering will look at it this morning, and if it is not fixed by tonight we will move you to another room.'],
  ],
  o06: [
    ['g29', -3, '08:00', 'Can our organisation pay the rest of the bill by bank transfer?'],
    ['solange', -3, '08:30', 'Yes. Send us the proof of transfer before check-out and we will settle the bill against it.'],
  ],
  f01: [
    ['g41', -2, '10:00', 'We are travelling with our two year old. Do you have a cot?'],
    ['denise', -2, '10:30', 'Yes, a cot will be set up in the room before you arrive, at no charge.'],
  ],
  f12: [
    ['g52', -1, '14:00', 'Please send a proforma invoice in our company name. We need it to approve the payment.'],
    ['solange', -1, '15:20', 'Sent to your email this afternoon. The rate is held until three days before arrival.'],
  ],
  c06: [
    ['g06', 0, '09:40', 'I think I left my phone charger in room 103 yesterday.'],
    ['denise', 0, '09:55', 'Housekeeping found it. It is at the front desk; we can keep it for you or send it with a moto driver.'],
  ],
  p01: [
    ['g55', -1, '19:00', 'Is airport pickup available, and is breakfast included in the suite rate?'],
  ],
  x01: [
    ['g56', -3, '09:00', 'Our conference has moved to next month. Please cancel this booking.'],
    ['denise', -3, '09:20', 'Cancelled and refunded in full. We hope to welcome you next month.'],
  ],
};

// --- Purge ----------------------------------------------------------------------------

/**
 * Delete this script's rows, and whatever a demo session built on top of them,
 * children first. Never touches seed-demo.mjs's rows (the roster, rooms, the
 * BK-DEMO bookings and their stays), and never truncates.
 *
 * "Built on top" is scoped by the parent it hangs off rather than by id: a
 * presenter who checks in today's arrival creates a stay and a bill with random
 * ids against a booking this script owns, and a night audit posts a room charge
 * against a department this script owns. Leaving those would make the delete
 * of the parent fail on a foreign key, which is how a reset stops working.
 *
 * Exported, so `seed-demo.mjs --reset` runs it before deleting the rows it
 * hangs off. Idempotent: on a database with none of it, it deletes nothing.
 */
export async function purgeHotel(c) {
  const q = (sql, params = []) => c.query(sql, params);
  await q('BEGIN');
  try {
    const temp = (name, sql, params) => q(`CREATE TEMP TABLE ${name} ON COMMIT DROP AS ${sql}`, params);
    await temp('_hd', `SELECT id FROM departments WHERE id::text LIKE $1`, [OWNED_LIKE]);
    await temp('_ho', `SELECT id FROM outlets WHERE id::text LIKE $1 OR department_id IN (SELECT id FROM _hd)`, [OWNED_LIKE]);
    await temp('_hb', `SELECT id FROM bookings WHERE id::text LIKE $1`, [OWNED_LIKE]);
    await temp('_hs', `SELECT id FROM guest_stays WHERE id::text LIKE $1 OR booking_id IN (SELECT id FROM _hb)`, [OWNED_LIKE]);
    await temp(
      '_hf',
      `SELECT id FROM folios
        WHERE id::text LIKE $1
           OR booking_id IN (SELECT id FROM _hb)
           OR guest_stay_id IN (SELECT id FROM _hs)
           OR id IN (SELECT folio_id FROM folio_charges
                      WHERE department_id IN (SELECT id FROM _hd) OR outlet_id IN (SELECT id FROM _ho))`,
      [OWNED_LIKE],
    );
    await temp(
      '_hso',
      `SELECT id FROM service_orders
        WHERE id::text LIKE $1 OR outlet_id IN (SELECT id FROM _ho) OR folio_id IN (SELECT id FROM _hf)
           OR guest_stay_id IN (SELECT id FROM _hs) OR department_id IN (SELECT id FROM _hd)
           OR booking_id IN (SELECT id FROM _hb)`,
      [OWNED_LIKE],
    );
    await temp('_hc', `SELECT id FROM folio_charges WHERE id::text LIKE $1 OR folio_id IN (SELECT id FROM _hf)`, [OWNED_LIKE]);
    await temp(
      '_hle',
      `SELECT id, transaction_id FROM ledger_entries
        WHERE id::text LIKE $1 OR (related_type = 'folio_charge' AND related_id IN (SELECT id FROM _hc))`,
      [OWNED_LIKE],
    );
    await temp('_ht', `SELECT id FROM maintenance_tickets WHERE id::text LIKE $1 OR department_id IN (SELECT id FROM _hd) OR guest_stay_id IN (SELECT id FROM _hs)`, [OWNED_LIKE]);
    await temp('_hth', `SELECT id FROM threads WHERE id::text LIKE $1 OR booking_id IN (SELECT id FROM _hb) OR guest_stay_id IN (SELECT id FROM _hs)`, [OWNED_LIKE]);
    await temp(
      '_hi',
      `SELECT id FROM service_items WHERE id::text LIKE $1 OR outlet_id IN (SELECT id FROM _ho) OR department_id IN (SELECT id FROM _hd)`,
      [OWNED_LIKE],
    );

    // Fiscal rows a demo close or a pay now order may have written.
    await q(`DELETE FROM ebm_invoice_lines WHERE folio_charge_id IN (SELECT id FROM _hc)
               OR service_order_item_id IN (SELECT id FROM service_order_items WHERE service_order_id IN (SELECT id FROM _hso))`);
    // ON DELETE RESTRICT since migration 0045: the lines go first, by hand.
    await temp(
      '_hinv',
      `SELECT id FROM ebm_invoices WHERE folio_id IN (SELECT id FROM _hf) OR service_order_id IN (SELECT id FROM _hso)
          OR booking_id IN (SELECT id FROM _hb) OR outlet_id IN (SELECT id FROM _ho)`,
    );
    await q(`DELETE FROM ebm_invoice_lines WHERE ebm_invoice_id IN (SELECT id FROM _hinv)`);
    await q(`DELETE FROM ebm_invoices WHERE id IN (SELECT id FROM _hinv)`);
    await q(`UPDATE service_orders SET payment_attempt_id = NULL WHERE id IN (SELECT id FROM _hso)`);
    await q(`DELETE FROM payment_attempts WHERE booking_id IN (SELECT id FROM _hb) OR service_order_id IN (SELECT id FROM _hso)`);

    // Threads this script does not own may still point at its orders, tickets or departments.
    await q(`UPDATE threads SET service_order_id = NULL WHERE service_order_id IN (SELECT id FROM _hso) AND id NOT IN (SELECT id FROM _hth)`);
    await q(`UPDATE threads SET maintenance_ticket_id = NULL WHERE maintenance_ticket_id IN (SELECT id FROM _ht) AND id NOT IN (SELECT id FROM _hth)`);
    await q(`UPDATE threads SET department_id = NULL WHERE department_id IN (SELECT id FROM _hd) AND id NOT IN (SELECT id FROM _hth)`);
    await q(`UPDATE service_orders SET thread_id = NULL WHERE thread_id IN (SELECT id FROM _hth)`);

    // Delivery bookkeeping for bills and orders about to disappear.
    await q(`DELETE FROM outbox_events WHERE aggregate_id IN (SELECT id FROM _hf) OR aggregate_id IN (SELECT id FROM _hso)`);
    await q(`DELETE FROM service_order_events WHERE service_order_id IN (SELECT id FROM _hso)`);
    await q(`DELETE FROM service_order_items WHERE service_order_id IN (SELECT id FROM _hso) OR service_item_id IN (SELECT id FROM _hi)`);
    await q(`DELETE FROM service_orders WHERE id IN (SELECT id FROM _hso)`);

    await q(`DELETE FROM ledger_entries WHERE id IN (SELECT id FROM _hle)`);
    await q(
      `DELETE FROM ledger_transactions t
        WHERE (t.id IN (SELECT transaction_id FROM _hle) OR t.id::text LIKE $1)
          AND NOT EXISTS (SELECT 1 FROM ledger_entries e WHERE e.transaction_id = t.id)`,
      [OWNED_LIKE],
    );
    // Refund requests and offer redemptions name a bill or a line with no
    // cascade (migration 0044), so a demo that raised one would block the bill.
    await q(`DELETE FROM stay_refund_requests WHERE folio_id IN (SELECT id FROM _hf) OR guest_stay_id IN (SELECT id FROM _hs) OR booking_id IN (SELECT id FROM _hb)`);
    await q(`DELETE FROM offer_redemptions WHERE folio_id IN (SELECT id FROM _hf) OR folio_charge_id IN (SELECT id FROM _hc) OR guest_stay_id IN (SELECT id FROM _hs)`);
    // Charges before bills, bills before anything else: both RESTRICT (0045).
    await q(`DELETE FROM folio_charges WHERE id IN (SELECT id FROM _hc)`);
    await q(`DELETE FROM folios WHERE id IN (SELECT id FROM _hf)`);

    await q(`DELETE FROM housekeeping_tasks WHERE id::text LIKE $1 OR guest_stay_id IN (SELECT id FROM _hs) OR department_id IN (SELECT id FROM _hd)`, [OWNED_LIKE]);
    await q(`DELETE FROM maintenance_events WHERE ticket_id IN (SELECT id FROM _ht)`);
    await q(`DELETE FROM maintenance_tickets WHERE id IN (SELECT id FROM _ht)`);

    await q(`DELETE FROM threads WHERE id IN (SELECT id FROM _hth)`); // messages and reads cascade
    await q(`DELETE FROM messages WHERE id::text LIKE $1`, [OWNED_LIKE]);
    await q(`DELETE FROM room_assignments WHERE id::text LIKE $1 OR booking_id IN (SELECT id FROM _hb)`, [OWNED_LIKE]);
    await q(`DELETE FROM escrows WHERE id::text LIKE $1 OR booking_id IN (SELECT id FROM _hb)`, [OWNED_LIKE]);
    await q(`DELETE FROM stay_identities WHERE guest_stay_id IN (SELECT id FROM _hs)`); // RESTRICT (0045)
    await q(`DELETE FROM guest_stays WHERE id IN (SELECT id FROM _hs)`);
    await q(`DELETE FROM bookings WHERE id IN (SELECT id FROM _hb)`);

    await q(`DELETE FROM service_items WHERE id IN (SELECT id FROM _hi)`);
    await q(`DELETE FROM service_categories WHERE id::text LIKE $1 OR outlet_id IN (SELECT id FROM _ho) OR department_id IN (SELECT id FROM _hd)`, [OWNED_LIKE]);
    await q(`DELETE FROM outlet_tenancies WHERE outlet_id IN (SELECT id FROM _ho)`);
    await q(`DELETE FROM outlets WHERE id IN (SELECT id FROM _ho)`);
    await q(
      `DELETE FROM outlet_parties p WHERE p.id::text LIKE $1
          AND NOT EXISTS (SELECT 1 FROM outlets o WHERE o.operator_party_id = p.id OR o.owner_party_id = p.id)`,
      [OWNED_LIKE],
    );
    await q(`DELETE FROM department_members WHERE id::text LIKE $1 OR department_id IN (SELECT id FROM _hd)`, [OWNED_LIKE]);
    await q(`UPDATE room_types SET department_id = NULL WHERE department_id IN (SELECT id FROM _hd)`);
    await q(`DELETE FROM departments WHERE id IN (SELECT id FROM _hd)`);

    // The guest accounts last, once nothing of this script's points at them.
    // A demo session could have signed one in; its sessions cascade.
    await q(`DELETE FROM users WHERE id::text LIKE $1`, [GUEST_LIKE]);

    await q('COMMIT');
    console.log('purge: removed the Amahoro hotel day this script owns');
  } catch (err) {
    await q('ROLLBACK');
    throw err;
  }
}

// --- Build ----------------------------------------------------------------------------

/** Everything the rows below need from the database, read once. */
async function readContext(c) {
  const one = async (sql, params) => (await c.query(sql, params)).rows;

  const property = await one('SELECT id FROM properties WHERE id = $1', [PROPERTY]);
  const booking = await one('SELECT id FROM bookings WHERE id = ANY($1::uuid[])', [[BK_DEMO_004, BK_DEMO_005, BK_DEMO_006]]);
  if (property.length === 0 || booking.length < 3) {
    throw new Error('Amahoro is not seeded. Run scripts/seed-demo.mjs against this database first (seed-sample.mjs runs it).');
  }

  // The day is the HEAD OFFICE's (ADR-054): Amahoro Boutique Hotel in Remera.
  // The workspace also holds the Musanze, Rubavu and archived Kicukiro
  // branches, whose rooms, bookings and stays seed-demo.mjs owns; nothing here
  // reads, counts or writes them.
  const rooms = await one('SELECT id, label, room_type_id, status FROM rooms WHERE property_id = $1', [PROPERTY]);
  if (rooms.length !== 20) {
    throw new Error(`Amahoro Boutique Hotel has ${rooms.length} rooms; this day is planned for 20. Re-run scripts/seed-demo.mjs (--reset) first.`);
  }
  const types = await one(
    `SELECT rt.id, rt.name, rt.base_price_rwf, rt.booking_mode, rt.cancellation_tier, rp.id AS rate_plan_id
       FROM room_types rt LEFT JOIN rate_plans rp ON rp.room_type_id = rt.id AND rp.is_default
      WHERE rt.property_id = $1`,
    [PROPERTY],
  );
  const typeByKey = {};
  for (const [key, name] of Object.entries(TYPE)) {
    const t = types.find((x) => x.name === name);
    if (!t) throw new Error(`Amahoro has no ${name} room type. Re-run scripts/seed-demo.mjs first.`);
    typeByKey[key] = { ...t, rate: Number(t.base_price_rwf) };
  }

  const accounts = Object.fromEntries(
    (await one('SELECT code, id FROM ledger_accounts WHERE workspace_id IS NULL')).map((r) => [r.code, r.id]),
  );
  for (const code of ['REVENUE_ROOMS', 'REVENUE_FNB', 'REVENUE_OTHER_OPERATED', 'TAX_PAYABLE', 'CASH_MOBILE_MONEY', 'CASH_CARD', 'CASH_ON_HAND']) {
    if (!accounts[code]) throw new Error(`Ledger account ${code} is missing. Run the migrations first.`);
  }

  const [rates] = await one(
    `SELECT value FROM config_entries
      WHERE config_type = 'tax_rates' AND (effective_from IS NULL OR effective_from <= now())
        AND (effective_to IS NULL OR effective_to > now())
      ORDER BY effective_from DESC NULLS LAST, version DESC LIMIT 1`,
  );
  const vat = Number(rates?.value?.TAX_B);
  if (!Number.isFinite(vat)) throw new Error('No effective TAX_B rate in config_entries. Run the migrations first.');

  const classifications = await one('SELECT code FROM rra_item_classifications WHERE code = ANY($1::text[]) AND active', [[FOOD, DRINK]]);
  if (classifications.length < 2) {
    throw new Error('The RRA classification codes are missing. Run scripts/sync-rra-classifications.mjs first (seed-sample.mjs runs it).');
  }

  const memberships = Object.fromEntries(
    (await one(`SELECT user_id, id FROM org_memberships WHERE org_id = $1 AND status = 'active'`, [ORG])).map((r) => [r.user_id, r.id]),
  );
  for (const who of ['solange', 'denise', 'beatha']) {
    if (!memberships[STAFF[who]]) throw new Error(`${who} holds no seat at Amahoro. Re-run scripts/seed-demo.mjs first.`);
  }

  const demoStays = Object.fromEntries(
    (await one('SELECT id, entry_at, actual_exit_at FROM guest_stays WHERE id = ANY($1::uuid[])', [[GS_SAMUEL, GS_RAYAN]])).map((r) => [r.id, r]),
  );
  if (!demoStays[GS_SAMUEL] || !demoStays[GS_RAYAN]) {
    throw new Error('The BK-DEMO-005 and 006 stays are missing. Re-run scripts/seed-demo.mjs first.');
  }

  // The reservations seed-demo.mjs already holds, so no night is sold twice over.
  const otherBookings = await one(
    `SELECT room_type_id, check_in::text AS check_in, check_out::text AS check_out FROM bookings
      WHERE room_type_id IN (SELECT id FROM room_types WHERE property_id = $1)
        AND status IN ('confirmed', 'pending_approval') AND id::text NOT LIKE $2`,
    [PROPERTY, OWNED_LIKE],
  );

  return { rooms, typeByKey, accounts, vat, memberships, demoStays, otherBookings };
}

/** The rows, in memory, before anything is written. */
function build(ctx, departmentIds, partyId, itemCodes) {
  const rows = {
    departmentMembers: [], outlets: [], categories: [], items: [], bookings: [], escrows: [],
    stays: [], assignments: [], threads: [], messages: [], folios: [], charges: [],
    ledgerTxns: [], ledgerEntries: [], orders: [], orderItems: [], orderEvents: [],
    tasks: [], tickets: [], ticketEvents: [],
  };
  const roomByLabel = Object.fromEntries(ctx.rooms.map((r) => [r.label, r]));
  const dept = (category) => departmentIds[category];
  const staff = (who) => STAFF[who];
  const guestOf = (key) => (key ? GUEST[key] : null);
  const vatOn = (amount) => Math.round(amount * ctx.vat);
  const vatRate = String(ctx.vat);

  // Department members: who works the boards.
  const memberId = counter(F.member);
  for (const [who, category, position, titles, primary] of [
    ['solange', 'rooms', 'department_head', ['General manager'], true],
    ['solange', 'fnb', 'supervisor', ['General manager'], false],
    ['denise', 'rooms', 'staff', ['Receptionist'], true],
    ['beatha', 'rooms', 'staff', ['Room attendant'], true],
  ]) {
    rows.departmentMembers.push({
      id: memberId(), department_id: dept(category), org_membership_id: ctx.memberships[staff(who)],
      user_id: staff(who), workspace_id: W, department_position: position,
      job_titles: JSON.stringify(titles), is_primary: primary, status: 'active',
      created_at: at(-300, '09:00'), updated_at: at(-300, '09:00'),
    });
  }

  // Outlets, categories and items.
  const outletIds = {};
  OUTLETS.forEach((o, i) => {
    outletIds[o.key] = H(F.outlet, i + 1);
    rows.outlets.push({
      id: outletIds[o.key], department_id: dept('fnb'), property_id: PROPERTY, workspace_id: W,
      operator_party_id: partyId, owner_party_id: partyId, relationship_type: 'hotel_operated',
      rra_branch_id: null, guest_visible: true, slug: null, address: null,
      // `taxEntityFor` (outlet-rules.ts): a hotel operated outlet sells under
      // its property's org.
      tax_entity_org_id: ORG, name: o.name, outlet_kind: o.kind, ordering_access: o.access,
      hours: JSON.stringify(o.hours), sort_order: o.sort, status: 'active',
      created_at: at(-240, '10:00'), updated_at: at(-240, '10:00'),
    });
  });
  const itemByKey = {};
  let itemSerial = 0;
  MENU.forEach((cat, ci) => {
    const categoryId = H(F.category, ci + 1);
    rows.categories.push({
      id: categoryId, department_id: dept('fnb'), outlet_id: outletIds[cat.outlet], property_id: PROPERTY,
      workspace_id: W, name: cat.name, sort_order: (ci + 1) * 10, guest_visible: true, status: 'active',
      default_rra_item_cls_cd: cat.cls, default_rra_item_ty_cd: '2', default_rra_pkg_unit_cd: 'NT',
      default_rra_qty_unit_cd: 'U', default_tax_code: 'TAX_B',
      created_at: at(-240, '10:05'), updated_at: at(-240, '10:05'),
    });
    cat.items.forEach(([key, name, price, description, prep]) => {
      itemSerial += 1;
      const id = H(F.item, itemSerial);
      itemByKey[key] = { id, name, price, outlet: cat.outlet, fulfil: cat.fulfil };
      rows.items.push({
        id, service_category_id: categoryId, department_id: dept('fnb'), outlet_id: outletIds[cat.outlet],
        property_id: PROPERTY, workspace_id: W, name, description, price_rwf: price, tax_code: 'TAX_B',
        fulfillment_type: cat.fulfil, prep_time_minutes: prep, options: JSON.stringify([]),
        guest_orderable: true, status: 'active', rra_item_cls_cd: cat.cls, rra_item_ty_cd: '2',
        rra_item_cd: itemCodes[id], rra_pkg_unit_cd: 'NT', rra_qty_unit_cd: 'U',
        created_at: at(-240, '10:10'), updated_at: at(-240, '10:10'),
      });
    });
  });

  // Money helpers: every line gets its ledger transaction and entry.
  const chargeId = counter(F.charge);
  const txnId = counter(F.ledgerTxn);
  const entryId = counter(F.ledgerEntry);
  const accountFor = (line) => {
    switch (line.charge_type) {
      case 'room': return 'REVENUE_ROOMS';
      case 'tax': return 'TAX_PAYABLE';
      case 'payment': return { mobile_money: 'CASH_MOBILE_MONEY', card: 'CASH_CARD', cash: 'CASH_ON_HAND' }[line.method];
      default: return { fnb: 'REVENUE_FNB', other_operated: 'REVENUE_OTHER_OPERATED' }[line.category];
    }
  };
  const post = (folio, line) => {
    const id = chargeId();
    const key = line.idempotency_key ?? `${W}:seed-hotel:${id}`;
    const { method, category, ...rest } = line;
    const charge = {
      id, folio_id: folio.id, workspace_id: W, department_id: null, outlet_id: null,
      tax_entity_org_id: ORG, payment_method_code: null, quantity: 1, unit_price_rwf: rest.amount_rwf,
      tax_code: null, tax_rate: null, tax_amount_rwf: null, source_ref_type: 'manual', source_ref_id: null,
      posted_by_user_id: null, business_date: null, ...rest, idempotency_key: key,
    };
    rows.charges.push(charge);
    folio.balance_rwf += charge.amount_rwf;
    const code = accountFor({ ...line, method, category });
    if (!code) throw new Error(`no ledger account for ${line.charge_type} ${line.description}`);
    const txn = txnId();
    rows.ledgerTxns.push({
      id: txn, kind: ['payment', 'deposit', 'refund'].includes(charge.charge_type) ? 'folio_settle' : 'folio_post',
      idempotency_key: key, adapter_mode: 'mock', memo: charge.description, occurred_at: charge.posted_at,
    });
    rows.ledgerEntries.push({
      id: entryId(), transaction_id: txn, account_id: ctx.accounts[code], amount_rwf: charge.amount_rwf,
      workspace_id: W, related_type: 'folio_charge', related_id: id, created_at: charge.posted_at,
    });
    return charge;
  };
  /** A manually posted revenue line and its VAT line, as FolioService.postCharge writes them. */
  const postTaxed = (folio, { chargeType, category, outletId, description, amount, when, by }) => {
    const tax = vatOn(amount);
    const parent = post(folio, {
      charge_type: chargeType, category, department_id: dept(category), outlet_id: outletId ?? null,
      description, amount_rwf: amount, unit_price_rwf: amount, tax_code: 'TAX_B', tax_rate: vatRate,
      tax_amount_rwf: tax, posted_by_user_id: by, posted_at: when,
    });
    post(folio, {
      charge_type: 'tax', description: `TAX_B on ${description}`, amount_rwf: tax, unit_price_rwf: tax,
      tax_code: 'TAX_B', tax_rate: vatRate, source_ref_type: 'tax', source_ref_id: parent.id,
      posted_by_user_id: by, posted_at: new Date(when.getTime() + 1000), idempotency_key: `${parent.idempotency_key}:tax`,
    });
  };
  const paymentRef = (method, seed) =>
    method === 'mobile_money' ? ` MoMo ref ${digits(seed, 10)}` : method === 'card' ? ` Visa ending ${digits(seed, 4)}` : '';
  const pay = (folio, method, amount, when, by) =>
    post(folio, {
      charge_type: 'payment', method, description: `Payment (${method})${paymentRef(method, `${folio.id}:${when.toISOString()}`)}`,
      amount_rwf: -amount, unit_price_rwf: -amount, payment_method_code: { cash: '01', card: '05', mobile_money: '06' }[method],
      posted_by_user_id: by, posted_at: when,
    });
  const deskAt = (hm) => (Number(hm.slice(0, 2)) >= 15 ? 'solange' : 'denise');
  const applyLine = (folio, line) => {
    const [kind, ...a] = line;
    if (kind === 'pay') {
      const [method, amount, d, hm] = a;
      pay(folio, method, amount, at(d, hm), staff('denise'));
    } else if (kind === 'pos') {
      const [outlet, description, amount, d, hm] = a;
      postTaxed(folio, { chargeType: 'pos', category: 'fnb', outletId: outletIds[outlet], description, amount, when: at(d, hm), by: staff(deskAt(hm)) });
    } else if (kind === 'laundry') {
      const [description, amount, d, hm] = a;
      postTaxed(folio, { chargeType: 'pos', category: 'other_operated', description, amount, when: at(d, hm), by: staff('denise') });
    } else if (kind === 'room') {
      const [description, amount, d, hm] = a;
      postTaxed(folio, { chargeType: 'room', category: 'rooms', description, amount, when: at(d, hm), by: staff('denise') });
    } else {
      throw new Error(`unknown bill line ${kind}`);
    }
  };
  // `postTaxed` with category rooms needs the rooms account, which `accountFor`
  // resolves by charge type before category.

  const folioId = counter(F.folio);
  const newFolio = ({ stayId, bookingId, guestUserId, openedAt }) => {
    const id = folioId();
    const folio = {
      id, folio_number: code(`folio:${id}`, 8), workspace_id: W, property_id: PROPERTY,
      guest_stay_id: stayId, booking_id: bookingId, lease_id: null, guest_user_id: guestUserId,
      folio_type: 'guest', status: 'open', folio_sequence: 1, locked_at: null, customer_tin: null,
      customer_name: null, balance_rwf: 0, opened_at: openedAt, closed_at: null,
      created_at: openedAt, updated_at: openedAt,
    };
    rows.folios.push(folio);
    return folio;
  };
  const postNights = (folio, from, to, rate) => {
    for (let night = from; night < to; night += 1) {
      post(folio, {
        charge_type: 'room', category: 'rooms', department_id: dept('rooms'), description: `Room charge for ${day(night)}`,
        amount_rwf: rate, unit_price_rwf: rate, source_ref_type: 'night_audit', business_date: day(night),
        posted_at: at(night, '23:50'), idempotency_key: `${W}:night:${folio.id}:${day(night)}`,
      });
    }
  };
  const close = (folio, when, customerName) => {
    folio.status = 'closed';
    folio.closed_at = when;
    folio.locked_at = when;
    folio.customer_name = customerName;
    folio.updated_at = when;
  };

  // Bookings, stays, holds, escrows, bills and threads.
  const bookingId = counter(F.booking);
  const stayId = counter(F.stay);
  const escrowId = counter(F.escrow);
  const assignmentId = counter(F.assignment);
  const threadId = counter(F.thread);
  const messageId = counter(F.message);
  const byKey = {};

  const assign = (booking, room, from, to, released, assignedAt) => {
    rows.assignments.push({
      id: assignmentId(), booking_id: booking, room_id: room.id, workspace_id: W,
      occupies: `[${day(from)},${day(to)})`, status: released ? 'released' : 'assigned',
      assigned_by_user_id: staff('denise'), released_at: released ?? null,
      created_at: assignedAt, updated_at: released ?? assignedAt,
    });
  };

  STAYS.forEach((s, i) => {
    const type = ctx.typeByKey[s.type];
    const room = s.room ? roomByLabel[s.room] : null;
    if (s.room && !room) throw new Error(`${s.key}: no room ${s.room}`);
    if (room && room.room_type_id !== type.id) throw new Error(`${s.key}: room ${s.room} is not a ${TYPE[s.type]}`);
    const guest = guestOf(s.guest);
    const nights = s.out - s.in;
    const entryAt = at(s.in, ['14:20', '15:05', '16:40', '18:10', '19:30'][i % 5]);
    const exitAt = s.key === 'c11' ? at(s.out, '06:15') : at(s.out, ['09:40', '10:15', '10:50', '08:55'][i % 4]);
    const record = { ...s, type, room, guest, entryAt, exitAt };
    byKey[s.key] = record;

    if (guest) {
      const id = bookingId();
      record.bookingId = id;
      const bookedAt = at(s.in - (7 + (i * 5) % 24), ['09:12', '13:47', '20:31', '11:05'][i % 4]);
      const gross = type.rate * nights;
      const cancelled = s.status === 'cancelled';
      rows.bookings.push({
        id, reference: `BK-${code(`ref:${id}`, 4)}-${code(`ref2:${id}`, 4)}`, room_type_id: type.id,
        rate_plan_id: type.rate_plan_id, guest_user_id: guest.id, workspace_id: W,
        check_in: day(s.in), check_out: day(s.out), guest_count: s.guests ?? 1, status: s.status,
        booking_mode: type.booking_mode, locked_nightly_rate_rwf: type.rate,
        locked_cancellation_tier: type.cancellation_tier, gross_rwf: gross,
        payment_status: cancelled ? 'refunded_full' : s.status === 'no_show' ? 'forfeited' : 'captured',
        approval_expires_at: s.status === 'pending_approval' ? new Date(NOW.getTime() + 24 * 3600 * 1000) : null,
        confirmed_at: ['confirmed', 'no_show'].includes(s.status) || cancelled ? new Date(bookedAt.getTime() + 60000) : null,
        cancelled_at: cancelled ? at(-3, '09:20') : null, cancelled_by: cancelled ? 'guest' : null,
        refund_rwf: cancelled ? gross : null, created_at: bookedAt, updated_at: cancelled ? at(-3, '09:20') : bookedAt,
      });
      rows.escrows.push({
        id: escrowId(), workspace_id: W, source: 'booking', booking_id: id, amount_rwf: gross,
        status: cancelled ? 'refunded_full' : s.status === 'no_show' ? 'forfeited' : s.stay === 'closed' ? 'released' : 'held',
        adapter_ref: `mock_escrow_capture_seed-demo-hotel:${id}`, adapter_mode: 'mock',
        idempotency_key: `seed-demo-hotel:${id}`, created_at: bookedAt, updated_at: bookedAt,
      });
      // One thread per booking (ADR-032). A stay that ended days ago, and a
      // booking that never happened, is read only.
      const archived = cancelled || s.status === 'no_show' || (s.stay === 'closed' && s.out <= -4);
      const said = MESSAGES[s.key] ?? [];
      const tid = threadId();
      const newest = said.length ? at(said.at(-1)[1], said.at(-1)[2]) : bookedAt;
      rows.threads.push({
        id: tid, workspace_id: W, booking_id: id, thread_kind: 'reservation',
        status: archived ? 'archived' : 'active', created_at: bookedAt, updated_at: newest,
      });
      for (const [who, d, hm, body] of said) {
        rows.messages.push({
          id: messageId(), thread_id: tid, sender_user_id: STAFF[who] ?? GUEST[who].id,
          body_type: 'text', body, created_at: at(d, hm),
        });
      }
      if (room && s.status === 'confirmed') {
        assign(id, room, s.in, s.out, s.stay === 'closed' ? exitAt : null, new Date(bookedAt.getTime() + 2 * 3600 * 1000));
      }
    }

    if (s.stay) {
      const sid = stayId();
      record.stayId = sid;
      rows.stays.push({
        id: sid, booking_id: record.bookingId ?? null, guest_user_id: guest?.id ?? null,
        guest_name: guest ? null : s.walkInName, room_id: room.id, workspace_id: W,
        check_in_mode: 'staffed', is_verified: true, entry_at: entryAt,
        planned_exit_at: at(s.out, '11:00'), actual_exit_at: s.stay === 'closed' ? exitAt : null,
        price_rwf: type.rate, lifecycle: s.stay, created_at: entryAt, updated_at: s.stay === 'closed' ? exitAt : entryAt,
      });

      const folio = newFolio({ stayId: sid, bookingId: record.bookingId ?? null, guestUserId: guest?.id ?? null, openedAt: entryAt });
      record.folio = folio;
      postNights(folio, s.in, s.stay === 'closed' ? s.out : Math.min(s.out, 0), type.rate);
      const lines = s.stay === 'closed' ? closedExtras(i, s) : s.lines;
      for (const line of lines) applyLine(folio, line);
      if (s.stay === 'closed') {
        const method = METHODS[i % METHODS.length];
        if (i % 3 === 0 && nights > 1) pay(folio, 'mobile_money', type.rate, at(s.in, '15:30'), staff('denise'));
        pay(folio, method, folio.balance_rwf, new Date(exitAt.getTime() - 5 * 60000), staff('denise'));
        close(folio, exitAt, guest?.name ?? s.walkInName);
      }
    }
  });

  // seed-demo.mjs's two stays get their bills and holds too: Samuel in 101
  // (BK-DEMO-005) and Rayan's finished stay in 201 (BK-DEMO-006).
  {
    const std = ctx.typeByKey.std;
    const samuelIn = ctx.demoStays[GS_SAMUEL].entry_at;
    const samuel = newFolio({ stayId: GS_SAMUEL, bookingId: BK_DEMO_005, guestUserId: SAMUEL, openedAt: samuelIn });
    postNights(samuel, -1, 0, std.rate);
    pay(samuel, 'mobile_money', std.rate, new Date(samuelIn.getTime() + 10 * 60000), staff('denise'));
    applyLine(samuel, ['pos', 'B', 'Terrace Bar: two local lagers', 5000, -1, '20:30']);
    assign(BK_DEMO_005, roomByLabel['101'], -1, 2, null, at(-3, '11:00'));

    const suite = ctx.typeByKey.suite;
    const rayanStay = ctx.demoStays[GS_RAYAN];
    const rayanOut = rayanStay.actual_exit_at ?? at(-2, '10:30');
    const rayan = newFolio({ stayId: GS_RAYAN, bookingId: BK_DEMO_006, guestUserId: RAYAN, openedAt: rayanStay.entry_at });
    postNights(rayan, -5, -2, suite.rate);
    applyLine(rayan, ['pos', 'R', 'Dinner: beef fillet with pepper sauce', 18000, -4, '20:10']);
    pay(rayan, 'card', rayan.balance_rwf, new Date(rayanOut.getTime() - 5 * 60000), staff('denise'));
    close(rayan, rayanOut, 'Rayan Iraguha');
    assign(BK_DEMO_006, roomByLabel['201'], -5, -2, rayanOut, at(-9, '16:00'));
  }

  // Today's orders.
  const orderId = counter(F.order);
  const orderItemId = counter(F.orderItem);
  const orderEventId = counter(F.orderEvent);
  for (const o of ORDERS) {
    const id = orderId();
    const stay = o.stay ? byKey[o.stay] : null;
    const lines = o.items.map(([key, qty]) => {
      const item = itemByKey[key];
      if (item.outlet !== o.outlet) throw new Error(`${o.key}: ${key} is not sold at ${o.outlet}`);
      return { item, qty, total: item.price * qty };
    });
    const subtotal = lines.reduce((sum, l) => sum + l.total, 0);
    const tax = lines.reduce((sum, l) => sum + vatOn(l.total), 0);
    const first = o.trail[0];
    const last = o.trail.at(-1);
    const orderNumber = code(`order:${id}`, 8);
    const guestUser = stay?.guest?.id ?? null;
    const actorFor = (status) =>
      status === 'submitted' && o.channel === 'guest_app' ? guestUser
        : status === 'cancelled' || status === 'submitted' || status === 'pending_payment' ? staff('denise')
          : staff('solange');
    rows.orders.push({
      id, order_number: orderNumber, workspace_id: W, property_id: PROPERTY, order_context: o.context,
      tax_entity_org_id: ORG, payment_attempt_id: null,
      paid_at: o.context === 'pay_now' ? at(0, o.trail[1][1]) : null,
      payment_method: o.context === 'pay_now' ? '01' : null,
      paid_marked_by_user_id: o.context === 'pay_now' ? staff('denise') : null,
      thread_id: null, customer_user_id: null, department_id: dept('fnb'), outlet_id: outletIds[o.outlet],
      folio_id: stay?.folio?.id ?? null, guest_stay_id: stay?.stayId ?? null, booking_id: null,
      ordered_by_user_id: o.channel === 'guest_app' ? guestUser : null, room_id: stay?.room?.id ?? null,
      channel: o.channel, status: last[0], fulfillment_type: lines[0].item.fulfil, requested_for_at: null,
      subtotal_rwf: subtotal, tax_rwf: tax, total_rwf: subtotal + tax, guest_note: o.note,
      assigned_to_user_id: null, idempotency_key: null,
      created_at: at(0, first[1]), updated_at: at(0, last[1]),
    });
    for (const l of lines) {
      rows.orderItems.push({
        id: orderItemId(), service_order_id: id, service_item_id: l.item.id, name_snapshot: l.item.name,
        quantity: l.qty, unit_price_rwf: l.item.price, selected_options: JSON.stringify([]),
        line_total_rwf: l.total, tax_code: 'TAX_B', tax_rate: vatRate, note: null, created_at: at(0, first[1]),
      });
    }
    for (const [status, hm] of o.trail) {
      rows.orderEvents.push({
        id: orderEventId(), service_order_id: id, status, actor_user_id: actorFor(status),
        note: status === 'cancelled' ? o.note : null, occurred_at: at(0, hm),
      });
    }
    // Delivered posts the bill line and its tax, once, as ServiceCatalogService.advanceOrder does.
    const delivered = o.trail.find(([status]) => status === 'delivered');
    if (delivered && o.context === 'in_house_folio') {
      const when = at(0, delivered[1]);
      post(stay.folio, {
        charge_type: 'service_order', category: 'fnb', description: `Order ${orderNumber}`, department_id: dept('fnb'),
        outlet_id: outletIds[o.outlet], amount_rwf: subtotal, unit_price_rwf: subtotal, tax_amount_rwf: tax,
        source_ref_type: 'service_order', source_ref_id: id, posted_at: when, idempotency_key: `${W}:order:${id}`,
      });
      post(stay.folio, {
        charge_type: 'tax', description: `Tax on order ${orderNumber}`, outlet_id: outletIds[o.outlet],
        amount_rwf: tax, unit_price_rwf: tax, source_ref_type: 'service_order', source_ref_id: id,
        posted_at: new Date(when.getTime() + 1000), idempotency_key: `${W}:order:${id}:tax`,
      });
    }
  }

  // Today's housekeeping board, and yesterday's finished work behind it.
  const taskId = counter(F.task);
  const task = (label, type, status, who, { priority = 0, note = null, stay = null, created = '06:30', started = null, done = null, d = 0 } = {}) => {
    rows.tasks.push({
      id: taskId(), room_id: roomByLabel[label].id, property_id: PROPERTY, department_id: dept('rooms'),
      workspace_id: W, guest_stay_id: stay, task_type: type, status, assigned_to_user_id: who ? staff(who) : null,
      priority, note, idempotency_key: null,
      started_at: started ? at(d, started) : null, completed_at: done ? at(d, done) : null,
      created_at: at(d, created), updated_at: at(d, done ?? started ?? created),
    });
  };
  task('103', 'checkout_clean', 'inspected', 'beatha', { d: -1, priority: 10, stay: byKey.c06.stayId, created: '10:15', started: '10:30', done: '11:20' });
  task('308', 'stayover_clean', 'done', 'beatha', { d: -1, created: '06:30', started: '11:40', done: '12:10' });
  task('107', 'checkout_clean', 'in_progress', 'beatha', { priority: 10, stay: byKey.c11.stayId, created: '06:15', started: '08:55', note: 'Guest left early for a flight. Booked again for arrival in 6 days.' });
  task('302', 'checkout_clean', 'pending', 'beatha', { priority: 10, stay: byKey.d01.stayId, note: 'Due out today. Next guest arrives in 2 days.' });
  task('203', 'checkout_clean', 'pending', 'beatha', { priority: 5, stay: byKey.d02.stayId, note: 'Late check-out until 16:00. Clean after the guest leaves.' });
  const turn = rows.bookings.find((b) => b.id === byKey.a03.bookingId);
  task('104', 'checkout_clean', 'pending', null, {
    priority: 20, stay: byKey.d03.stayId,
    note: `Same day turn: ${turn.reference} (${byKey.a03.guest.name}) arrives from 14:00. Take it first once the guest checks out.`,
  });
  task('101', 'stayover_clean', 'done', 'beatha', { started: '08:15', done: '08:40' });
  task('105', 'stayover_clean', 'done', 'beatha', { started: '08:42', done: '09:05' });
  task('301', 'stayover_clean', 'done', 'beatha', { started: '09:20', done: '09:50', note: 'Guests asked for extra towels; left four.' });
  task('202', 'stayover_clean', 'done', 'beatha', { started: '10:15', done: '10:45' });
  task('102', 'stayover_clean', 'pending', 'beatha', { note: 'Do not disturb until 11:00.' });
  task('201', 'stayover_clean', 'pending', 'beatha');
  task('304', 'stayover_clean', 'pending', 'beatha');
  task('303', 'stayover_clean', 'pending', null, { note: 'Engineering is looking at the air conditioning first. Clean after.' });
  task('306', 'stayover_clean', 'pending', 'beatha');
  task('106', 'stayover_clean', 'pending', null);
  task('308', 'stayover_clean', 'pending', null);
  task('305', 'inspection', 'inspected', 'solange', { priority: 8, created: '09:30', started: '10:00', done: '10:20', note: 'Ready for arrival today.' });
  task('204', 'inspection', 'inspected', 'solange', { priority: 8, created: '09:30', started: '10:25', done: '10:40', note: 'Ready for arrival today. Welcome fruit plate placed.' });
  task('307', 'deep_clean', 'blocked', 'beatha', { priority: 3, d: -1, created: '16:30', note: 'Blocked by the ceiling leak. Clean once engineering hands the room back.' });
  task('202', 'turndown', 'pending', null, { created: '06:30', note: 'Turndown from 18:00.' });

  // Maintenance tickets against rooms, owned by Engineering.
  const ticketId = counter(F.ticket);
  const ticketEventId = counter(F.ticketEvent);
  const ticket = (label, t) => {
    const id = ticketId();
    const created = at(t.d, t.hm);
    const events = (t.events ?? []).map(([who, d, hm, note]) => ({ who, when: at(d, hm), note }));
    const lastAt = events.at(-1)?.when ?? created;
    rows.tickets.push({
      id, lease_id: null, room_id: roomByLabel[label].id, space_id: null, guest_stay_id: t.stay ?? null,
      property_id: PROPERTY, org_id: ORG, workspace_id: W, department_id: dept('engineering'),
      raised_by_user_id: staff(t.by), raised_by_role: t.by === 'beatha' ? 'housekeeper' : 'staff',
      title: t.title, description: t.description, category: t.category, priority: t.priority,
      photo_object_keys: null, status: t.status,
      resolved_at: ['resolved', 'closed'].includes(t.status) ? (t.resolvedAt ?? lastAt) : null,
      created_at: created, updated_at: lastAt,
    });
    for (const e of events) {
      rows.ticketEvents.push({ id: ticketEventId(), ticket_id: id, author_user_id: staff(e.who), note: e.note, photo_object_id: null, created_at: e.when });
    }
  };
  ticket('307', {
    by: 'beatha', d: -1, hm: '16:20', status: 'in_progress', priority: 'urgent', category: 'plumbing',
    title: 'Water leaking through the bathroom ceiling',
    description: 'Water dripping from the ceiling above the shower. The ceiling board is stained and soft. Bucket placed, room not sold.',
    events: [
      ['solange', -1, '16:45', 'Room taken off sale. Plumber booked for 09:00 tomorrow.'],
      ['solange', 0, '10:10', 'Plumber replaced a cracked joint on the hot water pipe in the ceiling void. The board has to dry for 48 hours before it is replaced and painted.'],
    ],
  });
  ticket('303', {
    by: 'denise', d: 0, hm: '07:50', status: 'open', priority: 'normal', category: 'hvac', stay: byKey.o07.stayId,
    title: 'Air conditioning rattles at night',
    description: 'Guest reports the air conditioning unit rattles loudly when it cycles on. Guest is in house until the day after tomorrow.',
  });
  ticket('204', {
    by: 'beatha', d: 0, hm: '10:30', status: 'resolved', priority: 'high', category: 'it_tech',
    title: 'TV not connecting to the Wi-Fi',
    description: 'Found during the arrival inspection: the TV shows no network.',
    events: [['solange', 0, '10:55', 'Corridor access point restarted and the TV paired again. Streaming tested and working.']],
  });
  ticket('102', {
    by: 'beatha', d: -2, hm: '11:05', status: 'assigned', priority: 'low', category: 'furniture',
    title: 'Wardrobe door hinge loose',
    description: 'Left wardrobe door drops when opened. Guest not bothered; fix when the room is free.',
    events: [['solange', -2, '14:00', 'Given to Jean-Paul. Replacement hinges ordered from the hardware shop in Remera.']],
  });
  ticket('101', {
    by: 'denise', d: -6, hm: '19:20', status: 'closed', priority: 'normal', category: 'plumbing',
    title: 'Shower slow to run hot',
    description: 'Guest in 101 waited several minutes for hot water.',
    events: [
      ['solange', -5, '09:30', 'Thermostat on the second floor boiler reset; hot water within 30 seconds.'],
      ['solange', -4, '12:00', 'Checked again after two nights with guests in the room. Closing.'],
    ],
    resolvedAt: at(-5, '09:30'),
  });

  return rows;
}

/** Prove the day is coherent before a single row is written. */
function validate(rows, ctx) {
  const problems = [];
  const labelOf = Object.fromEntries(ctx.rooms.map((r) => [r.id, r.label]));

  // Holds: no two assigned holds on one room overlap (the database refuses it too).
  const holds = rows.assignments.filter((a) => a.status === 'assigned');
  const parse = (r) => r.slice(1, -1).split(',');
  for (let i = 0; i < holds.length; i += 1) {
    for (let j = i + 1; j < holds.length; j += 1) {
      const [a0, a1] = parse(holds[i].occupies);
      const [b0, b1] = parse(holds[j].occupies);
      if (holds[i].room_id === holds[j].room_id && a0 < b1 && b0 < a1) {
        problems.push(`room ${labelOf[holds[i].room_id]} holds overlap: ${holds[i].occupies} and ${holds[j].occupies}`);
      }
    }
  }
  // Stays: never two guests in one room at once, and at most one open stay a room.
  const stays = rows.stays.map((s) => ({ room: s.room_id, from: s.entry_at, to: s.actual_exit_at ?? new Date(8.64e15) }));
  for (let i = 0; i < stays.length; i += 1) {
    for (let j = i + 1; j < stays.length; j += 1) {
      if (stays[i].room === stays[j].room && stays[i].from < stays[j].to && stays[j].from < stays[i].to) {
        problems.push(`room ${labelOf[stays[i].room]} has two stays at once`);
      }
    }
  }
  // Inventory: on no night from today on does a room type hold more live
  // bookings (and walk ins) than it has rooms on sale. Past nights are history.
  const sellable = {};
  for (const r of ctx.rooms) if (r.status === 'available') sellable[r.room_type_id] = (sellable[r.room_type_id] ?? 0) + 1;
  const live = [
    ...rows.bookings.filter((b) => ['confirmed', 'pending_approval'].includes(b.status)),
    ...ctx.otherBookings,
  ];
  const roomType = Object.fromEntries(ctx.rooms.map((r) => [r.id, r.room_type_id]));
  const walkIns = rows.stays.filter((s) => !s.booking_id && s.lifecycle === 'open');
  for (let n = 0; n < 30; n += 1) {
    const night = day(n);
    const sold = {};
    for (const b of live) if (b.check_in <= night && night < b.check_out) sold[b.room_type_id] = (sold[b.room_type_id] ?? 0) + 1;
    for (const s of walkIns) if (n === 0) sold[roomType[s.room_id]] = (sold[roomType[s.room_id]] ?? 0) + 1;
    for (const [type, count] of Object.entries(sold)) {
      if (count > (sellable[type] ?? 0)) problems.push(`${night}: ${count} bookings for ${sellable[type] ?? 0} rooms of type ${type}`);
    }
  }
  // Bills: open means owing, closed means zero, and the cached balance is the sum.
  for (const f of rows.folios) {
    const sum = rows.charges.filter((ch) => ch.folio_id === f.id).reduce((s, ch) => s + ch.amount_rwf, 0);
    if (sum !== f.balance_rwf) problems.push(`folio ${f.folio_number} balance ${f.balance_rwf} is not its sum ${sum}`);
    if (f.status === 'closed' && f.balance_rwf !== 0) problems.push(`closed folio ${f.folio_number} carries ${f.balance_rwf}`);
    if (f.status === 'open' && f.balance_rwf <= 0) problems.push(`open folio ${f.folio_number} is not owing (${f.balance_rwf})`);
  }
  for (const ch of rows.charges) {
    if (['room', 'service_order', 'pos'].includes(ch.charge_type) && !ch.department_id) {
      problems.push(`revenue line "${ch.description}" names no department`);
    }
  }
  if (problems.length) throw new Error(`The planned day does not hold together:\n  ${problems.join('\n  ')}`);
}

// --- Write ------------------------------------------------------------------------------

async function insert(c, table, rows) {
  if (rows.length === 0) return 0;
  const columns = Object.keys(rows[0]);
  let written = 0;
  for (let start = 0; start < rows.length; start += 200) {
    const chunk = rows.slice(start, start + 200);
    const params = [];
    const values = chunk.map((row) => {
      const cells = columns.map((col) => {
        params.push(row[col] === undefined ? null : row[col]);
        return `$${params.length}`;
      });
      return `(${cells.join(', ')})`;
    });
    const res = await c.query(
      `INSERT INTO ${table} (${columns.map((col) => `"${col}"`).join(', ')}) VALUES ${values.join(', ')} ON CONFLICT DO NOTHING`,
      params,
    );
    written += res.rowCount ?? 0;
  }
  return written;
}

/** RRA item codes: kept once minted, otherwise the org's next serials (VSDC §4.17). */
async function itemCodesFor(c) {
  const ids = MENU.flatMap((cat) => cat.items).map((_, i) => H(F.item, i + 1));
  const { rows: mine } = await c.query('SELECT id, rra_item_cd FROM service_items WHERE id = ANY($1::uuid[])', [ids]);
  const codes = Object.fromEntries(mine.map((r) => [r.id, r.rra_item_cd]));
  const { rows: [top] } = await c.query(
    `SELECT coalesce(max(substring(si.rra_item_cd from '(\\d{7})$')::int), 0) AS serial
       FROM service_items si JOIN workspaces w ON w.id = si.workspace_id
      WHERE w.org_id = $1 AND si.rra_item_cd IS NOT NULL AND NOT (si.id = ANY($2::uuid[]))`,
    [ORG, ids],
  );
  let serial = Math.max(Number(top.serial), ...Object.values(codes).map((cd) => Number(cd?.slice(-7) ?? 0)));
  for (const id of ids) codes[id] ??= `RW2NTU${pad(++serial, 7)}`;
  return codes;
}

async function seed(c) {
  const ctx = await readContext(c);
  await c.query('BEGIN');
  try {
    await insert(c, 'users', GUESTS.map((g) => ({
      id: g.id, email: g.email, email_verified: true, name: g.name,
      created_at: at(-60, '12:00'), updated_at: at(-60, '12:00'),
    })));

    await insert(c, 'departments', USALI.map(([category, name, type, guest, sort, head], i) => ({
      id: H(F.department, i + 1), org_id: ORG, property_id: PROPERTY, workspace_id: W, name,
      department_type: type, department_category: category, is_revenue_center: type === 'operated',
      guest_requestable: guest, sort_order: sort, status: 'active', head_name: head,
      created_at: at(-365, '09:00'), updated_at: at(-365, '09:00'),
    })));
    // Read back by category: the partial unique index means a property that
    // already had its departments keeps them, and everything hangs off those.
    const { rows: depts } = await c.query('SELECT id, department_category FROM departments WHERE property_id = $1', [PROPERTY]);
    const departmentIds = Object.fromEntries(depts.map((d) => [d.department_category, d.id]));

    // The hotel's own party, which every hotel operated outlet names (ADR-050 D-h).
    await insert(c, 'outlet_parties', [{
      id: H(F.party, 1), workspace_id: W, org_id: ORG, legal_name: 'Amahoro Hospitality Group',
      tin: '102938001', status: 'active', created_at: at(-240, '10:00'), updated_at: at(-240, '10:00'),
    }]);
    const { rows: [party] } = await c.query('SELECT id FROM outlet_parties WHERE org_id = $1', [ORG]);

    const rows = build(ctx, departmentIds, party.id, await itemCodesFor(c));
    validate(rows, ctx);

    const order = [
      ['department_members', rows.departmentMembers], ['outlets', rows.outlets],
      ['service_categories', rows.categories], ['service_items', rows.items],
      ['bookings', rows.bookings], ['escrows', rows.escrows], ['threads', rows.threads],
      ['messages', rows.messages], ['guest_stays', rows.stays], ['room_assignments', rows.assignments],
      ['folios', rows.folios], ['folio_charges', rows.charges], ['ledger_transactions', rows.ledgerTxns],
      ['ledger_entries', rows.ledgerEntries], ['service_orders', rows.orders],
      ['service_order_items', rows.orderItems], ['service_order_events', rows.orderEvents],
      ['housekeeping_tasks', rows.tasks], ['maintenance_tickets', rows.tickets],
      ['maintenance_events', rows.ticketEvents],
    ];
    const written = {};
    for (const [table, list] of order) written[table] = await insert(c, table, list);
    await c.query('COMMIT');

    const total = Object.values(written).reduce((s, n) => s + n, 0);
    console.log(total === 0 ? '\nAmahoro hotel day: already seeded, nothing to do.' : '\nAmahoro hotel day seeded:');
    if (total > 0) for (const [table, n] of Object.entries(written)) console.log(`  ${table.padEnd(22)} ${n}`);
    return rows;
  } catch (err) {
    await c.query('ROLLBACK');
    throw err;
  }
}

async function summary(c) {
  const today = day(0);
  const { rows: [s] } = await c.query(
    `SELECT
       (SELECT count(*) FROM guest_stays g JOIN rooms r ON r.id = g.room_id WHERE r.property_id = $1 AND g.lifecycle = 'open')::int AS in_house,
       (SELECT count(*) FROM bookings b JOIN room_types t ON t.id = b.room_type_id WHERE t.property_id = $1 AND b.check_in = $2 AND b.status = 'confirmed'
          AND NOT EXISTS (SELECT 1 FROM guest_stays g WHERE g.booking_id = b.id))::int AS arrivals,
       (SELECT count(*) FROM bookings b JOIN guest_stays g ON g.booking_id = b.id AND g.lifecycle = 'open'
         JOIN room_types t ON t.id = b.room_type_id WHERE t.property_id = $1 AND b.check_out = $2)::int AS departures,
       (SELECT count(*) FROM folios WHERE property_id = $1)::int AS folios`,
    [PROPERTY, today],
  );
  console.log(`\nAmahoro Boutique Hotel (head office) tonight: ${s.in_house} of 20 rooms occupied. Today: ${s.arrivals} arrivals to check in, ${s.departures} departures to settle. ${s.folios} bills on file.`);
}

async function main() {
  loadDotEnv();
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL is not set.');
  const purge = process.argv.includes('--purge');
  const reset = process.argv.includes('--reset');

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await assertSampleDatabase(client, 'seed-demo-hotel.mjs');
    if (purge || reset) await purgeHotel(client);
    if (purge) return;
    await seed(client);
    await summary(client);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error(`\n${err.message}`);
    process.exit(1);
  });
}
