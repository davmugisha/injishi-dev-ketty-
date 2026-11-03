#!/usr/bin/env node
/**
 * Three short-stay businesses for building and testing the stays product (2026-10-29): a small guest
 * house an owner runs alone, a large lodge with a team, and a block of serviced apartments let by the
 * night, week or month. Each has its owner's account, a business workspace, one property placed in a
 * real village (so a check-in reaches that village's leaders and DGIE), its room types with their rooms,
 * a default rate plan per room type, a published listing and the USALI departments a bill posts to.
 *
 * Bookings and stays are NOT written here: they come through the app (walk-in, reservations), so every
 * one of them follows the same rules a real one does.
 *
 *   DATABASE_URL=postgres://injishi:injishi@127.0.0.1:5434/injishi node scripts/seed-stays.mjs
 *   ... --purge   deletes only this script's rows (ids `5e5a0000-…`)
 *
 * Refuses a database without the sample marker, like every seed.
 */
import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';

const ID = (family, n) => `5e5a0000-0000-4000-8000-${family}${String(n).padStart(10, '0')}`;
const OWNED_LIKE = '5e5a0000-0000-4000-8000-%';

const BUSINESSES = [
  {
    key: 'guesthouse',
    org: ID('01', 1),
    workspace: ID('02', 1),
    property: ID('03', 1),
    listing: ID('04', 1),
    owner: { id: ID('05', 1), workspace: ID('06', 1), email: 'guesthouse.owner@injishi.test', name: 'Aline Mutoni' },
    legalName: 'Umuco Guest House Ltd',
    kind: 'guest_house',
    tin: '999700101',
    name: 'Umuco Guest House',
    slug: 'umuco-guest-house',
    description: 'Five quiet rooms around a garden in Kacyiru, run by the owner. Breakfast on request.',
    village: 102070111, // Urugwiro
    lat: '-1.9440',
    lng: '30.0890',
    address: 'KG 9 Ave, Urugwiro, Kamatamu, Kacyiru',
    checkIn: '13:00',
    checkOut: '10:30',
    rules: 'Valid ID or passport at check-in. Quiet after 22:00. No smoking indoors.',
    roomTypes: [
      { n: 1, name: 'Double room', rooms: ['Room 1', 'Room 2', 'Room 3'], guests: 2, price: 35_000, min: 1, max: 30 },
      { n: 2, name: 'Twin room', rooms: ['Room 4', 'Room 5'], guests: 2, price: 30_000, min: 1, max: 30 },
    ],
  },
  {
    key: 'lodge',
    org: ID('01', 2),
    workspace: ID('02', 2),
    property: ID('03', 2),
    listing: ID('04', 2),
    owner: { id: ID('05', 2), workspace: ID('06', 2), email: 'lodge.owner@injishi.test', name: 'Eric Ndayisaba' },
    legalName: 'Ishema Lodge Ltd',
    kind: 'lodge',
    tin: '999700102',
    name: 'Ishema Lodge',
    slug: 'ishema-lodge',
    description:
      'A 28-room lodge in Kamatamu with a restaurant, a bar and garden cottages. Front desk open day and night.',
    village: 102070112, // Uruhongore
    lat: '-1.9452',
    lng: '30.0921',
    address: 'KG 11 Ave, Uruhongore, Kamatamu, Kacyiru',
    checkIn: '14:00',
    checkOut: '11:00',
    rules: 'Valid ID or passport at check-in. Children welcome. Pets on request.',
    roomTypes: [
      {
        n: 1,
        name: 'Standard room',
        rooms: Array.from({ length: 18 }, (_, i) => `${100 + i + 1}`),
        guests: 2,
        price: 85_000,
        min: 1,
        max: 30,
      },
      {
        n: 2,
        name: 'Deluxe room',
        rooms: Array.from({ length: 8 }, (_, i) => `${200 + i + 1}`),
        guests: 3,
        price: 120_000,
        min: 1,
        max: 30,
      },
      { n: 3, name: 'Garden cottage', rooms: ['Cottage A', 'Cottage B'], guests: 4, price: 180_000, min: 2, max: 30 },
    ],
  },
  {
    key: 'apartments',
    org: ID('01', 3),
    workspace: ID('02', 3),
    property: ID('03', 3),
    listing: ID('04', 3),
    owner: { id: ID('05', 3), workspace: ID('06', 3), email: 'apartments.owner@injishi.test', name: 'Patrick Mugisha' },
    legalName: 'Kacyiru Serviced Apartments Ltd',
    kind: 'apartment',
    tin: '999700103',
    name: 'Kacyiru Serviced Apartments',
    slug: 'kacyiru-serviced-apartments',
    description:
      'Eight furnished apartments with kitchens, cleaned every week. By the night, or cheaper by the week and the month.',
    village: 102070111, // Urugwiro
    lat: '-1.9436',
    lng: '30.0902',
    address: 'KG 7 Ave, Urugwiro, Kamatamu, Kacyiru',
    checkIn: '14:00',
    checkOut: '11:00',
    rules: 'Valid ID or passport at check-in. Two nights minimum. Weekly cleaning; more on request.',
    roomTypes: [
      {
        n: 1,
        name: 'Studio',
        rooms: ['Studio 1', 'Studio 2', 'Studio 3', 'Studio 4'],
        guests: 2,
        price: 45_000,
        min: 2,
        max: 365,
        weekly: 10,
        monthly: 30,
      },
      {
        n: 2,
        name: 'One-bedroom apartment',
        rooms: ['Apt 1A', 'Apt 1B', 'Apt 2A', 'Apt 2B'],
        guests: 3,
        price: 65_000,
        min: 2,
        max: 365,
        weekly: 10,
        monthly: 30,
      },
    ],
  },
];

const USALI_DEPARTMENTS = [
  ['Rooms', 'operated', 'rooms', true, true, 10],
  ['Food and Beverage', 'operated', 'fnb', true, true, 20],
  ['Spa and Recreation', 'operated', 'spa_recreation', true, true, 30],
  ['Other Operated Departments', 'operated', 'other_operated', true, false, 40],
  ['Miscellaneous Income', 'operated', 'misc_income', true, false, 50],
  ['Administrative and General', 'undistributed', 'admin_general', false, false, 60],
  ['Sales and Marketing', 'undistributed', 'sales_marketing', false, false, 70],
  ['Information and Telecommunications', 'undistributed', 'it', false, false, 80],
  ['Engineering and Maintenance', 'undistributed', 'engineering', false, true, 90],
  ['Utilities', 'undistributed', 'utilities', false, false, 100],
  ['Human Resources', 'undistributed', 'hr', false, false, 110],
];

async function place(c, villageId) {
  const { rows } = await c.query(
    `select v.id as village, c.sector_id as sector, s.district_id as district
       from villages v join cells c on c.id = v.cell_id join sectors s on s.id = c.sector_id
      where v.id = $1`,
    [villageId],
  );
  if (!rows[0]) throw new Error(`Village ${villageId} is missing: seed geography first.`);
  return rows[0];
}

async function ensureOwner(c, o) {
  const found = await c.query('select id from users where lower(email) = lower($1)', [o.email]);
  const userId = found.rows[0]?.id ?? o.id;
  if (!found.rows[0]) {
    await c.query(
      `insert into users (id, email, name, email_verified, created_at, updated_at)
       values ($1, lower($2), $3, true, now(), now())`,
      [o.id, o.email, o.name],
    );
  }
  const personal = await c.query(`select 1 from workspaces where user_id = $1 and kind = 'personal'`, [userId]);
  if (!personal.rows[0]) {
    await c.query(`insert into workspaces (id, kind, user_id) values ($1, 'personal', $2)`, [o.workspace, userId]);
  }
  const role = await c.query(
    `select 1 from user_roles where user_id = $1 and global_role = 'guest' and revoked_at is null`,
    [userId],
  );
  if (!role.rows[0]) await c.query(`insert into user_roles (user_id, global_role) values ($1, 'guest')`, [userId]);
  return userId;
}

/**
 * Owners' addresses: `@injishi.test` on a laptop; on a shared database set `STAYS_OWNER_EMAILS`, e.g.
 * `guesthouse=a+guesthouse@gmail.com,lodge=a+lodge@gmail.com,apartments=a+apartments@gmail.com`, so the
 * sign in codes reach a real inbox.
 */
const OWNER_EMAILS = Object.fromEntries(
  (process.env.STAYS_OWNER_EMAILS ?? '')
    .split(',')
    .map((pair) => pair.split('=').map((x) => x.trim()))
    .filter(([k, v]) => k && v),
);

async function seedBusiness(c, b) {
  if (OWNER_EMAILS[b.key]) b.owner.email = OWNER_EMAILS[b.key];
  const p = await place(c, b.village);
  const owner = await ensureOwner(c, b.owner);
  await c.query(
    `insert into orgs (id, legal_name, domain, business_kind, rdb_entity_group, accommodation_class, tin,
                       registration_status, district_id, address_text)
     values ($1, $2, 'hospitality', $3::business_kind, 'accommodation', $3::text, $4, 'active', $5, $6)
     on conflict (id) do nothing`,
    [b.org, b.legalName, b.kind, b.tin, p.district, b.address],
  );
  await c.query(`insert into workspaces (id, kind, org_id) values ($1, 'business', $2) on conflict (id) do nothing`, [
    b.workspace,
    b.org,
  ]);
  const member = await c.query(
    `select 1 from org_memberships where org_id = $1 and user_id = $2 and status = 'active'`,
    [b.org, owner],
  );
  if (!member.rows[0]) {
    await c.query(`insert into org_memberships (org_id, user_id, org_role) values ($1, $2, 'owner')`, [b.org, owner]);
  }
  await c.query(
    `insert into properties (id, org_id, workspace_id, name, description, village_id, sector_id, district_id,
                             latitude, longitude, location_privacy, check_in_time, check_out_time, house_rules,
                             slug, address_text, is_head_office)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, $11, $12, $13, $14, $15, true)
     on conflict (id) do nothing`,
    [
      b.property,
      b.org,
      b.workspace,
      b.name,
      b.description,
      p.village,
      p.sector,
      p.district,
      b.lat,
      b.lng,
      b.checkIn,
      b.checkOut,
      b.rules,
      b.slug,
      b.address,
    ],
  );
  for (const rt of b.roomTypes) {
    const roomTypeId = ID(`1${b.org.slice(-1)}`, rt.n);
    await c.query(
      `insert into room_types (id, property_id, workspace_id, name, domain, capacity, max_guests, room_count,
                               base_price_rwf, currency, booking_mode, approval_policy, cancellation_tier,
                               nonrefundable_eligible, min_stay, max_stay, check_in_method,
                               weekly_discount_pct, monthly_discount_pct)
       values ($1, $2, $3, $4, 'hospitality', $5, $5, $6, $7, 'RWF', 'instant_book', null, 'moderate',
               false, $8, $9, 'front_desk', $10, $11)
       on conflict (id) do nothing`,
      [
        roomTypeId,
        b.property,
        b.workspace,
        rt.name,
        rt.guests,
        rt.rooms.length,
        rt.price,
        rt.min,
        rt.max,
        rt.weekly ?? null,
        rt.monthly ?? null,
      ],
    );
    for (const [i, label] of rt.rooms.entries()) {
      await c.query(
        `insert into rooms (id, room_type_id, property_id, workspace_id, label, status)
         values ($1, $2, $3, $4, $5, 'available') on conflict (id) do nothing`,
        [ID(`2${b.org.slice(-1)}`, rt.n * 100 + i + 1), roomTypeId, b.property, b.workspace, label],
      );
    }
    await c.query(
      `insert into rate_plans (id, room_type_id, workspace_id, name, status, is_default, base_price_rwf, currency,
                               base_occupancy, cancellation_tier, non_refundable, booking_mode, min_stay, max_stay,
                               weekly_discount_pct, monthly_discount_pct)
       values ($1, $2, $3, 'Standard rate', 'active', true, $4, 'RWF', $5, 'moderate', false, 'instant_book', $6, $7,
               $8, $9)
       on conflict (id) do nothing`,
      [ID(`3${b.org.slice(-1)}`, rt.n), roomTypeId, b.workspace, rt.price, rt.guests, rt.min, rt.max, rt.weekly ?? null, rt.monthly ?? null],
    );
  }
  await c.query(
    `insert into listings (id, property_id, workspace_id, status, published_at, version)
     values ($1, $2, $3, 'published', now(), 1) on conflict (id) do nothing`,
    [b.listing, b.property, b.workspace],
  );
  for (const [name, type, category, revenue, requestable, sort] of USALI_DEPARTMENTS) {
    await c.query(
      `insert into departments (org_id, property_id, workspace_id, name, department_type, department_category,
                                is_revenue_center, guest_requestable, sort_order)
       values ($1, $2, $3, $4, $5::department_type, $6::department_category, $7, $8, $9)
       on conflict do nothing`,
      [b.org, b.property, b.workspace, name, type, category, revenue, requestable, sort],
    );
  }
  const rooms = b.roomTypes.reduce((n, rt) => n + rt.rooms.length, 0);
  console.log(`  ${b.name} (${b.kind}, ${rooms} rooms), owner ${b.owner.email}`);
}

async function purge(c) {
  for (const table of ['listings', 'rate_plans', 'rooms', 'room_types', 'departments']) {
    const col = table === 'departments' ? 'workspace_id' : 'id';
    await c.query(`delete from ${table} where ${col}::text like $1`, [OWNED_LIKE]);
  }
  await c.query(`delete from properties where id::text like $1`, [OWNED_LIKE]);
  await c.query(`delete from org_memberships where org_id::text like $1`, [OWNED_LIKE]);
  await c.query(`delete from workspaces where id::text like $1`, [OWNED_LIKE]);
  await c.query(`delete from orgs where id::text like $1`, [OWNED_LIKE]);
  await c.query(`delete from user_roles where user_id::text like $1`, [OWNED_LIKE]);
  await c.query(`delete from users where id::text like $1`, [OWNED_LIKE]);
  console.log('  purged the stays seed');
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL required');
  const pool = new pg.Pool({ connectionString: url });
  const c = await pool.connect();
  try {
    await assertSampleDatabase(c);
    await c.query('begin');
    if (process.argv.includes('--purge')) await purge(c);
    else {
      console.log('Stays: a guest house, a lodge and serviced apartments…');
      for (const b of BUSINESSES) await seedBusiness(c, b);
    }
    await c.query('commit');
  } catch (error) {
    await c.query('rollback');
    throw error;
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
