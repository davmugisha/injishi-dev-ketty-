#!/usr/bin/env node
/**
 * THE POINT OF SALE DEMO (POS spec phase 1, §19 demo data).
 *
 * One fictional restaurant group, Ikirezi Bistro Group Ltd, with two branches
 * (Kimihurura in Kigali, Rubavu on the lake), a restaurant and bar outlet at
 * each, a kitchen and a bar station, 18 tables in five dining areas, 34 menu
 * items with sizes and extras, three registers, and a staff account for every
 * floor role. Then two days of trade: completed, open, ready, cancelled and
 * split orders; successful, pending, failed and refunded payments, every one
 * SIMULATED except cash; three cashier shifts, one of them short.
 *
 * EVERYTHING IS FICTIONAL. The TIN is in the 999 demo block, the phone
 * numbers are 0788 000 1xx, and every payment reference starts `DEMO-`.
 *
 * CONSISTENT BY CONSTRUCTION. Every order's lines, tax and totals are
 * computed with `orderAmounts`, the same function the API prices with, and
 * every closed shift's expected cash is computed from the payments seeded on
 * it. The numbers on the screens are the numbers the rows add up to.
 *
 * Ids live in the `de300000-0000-4000-8000-0b05` block, so the demo persona
 * picker lists the staff and `--reset` finds exactly what this script owns.
 *
 *   DATABASE_URL=... node scripts/seed-demo-pos.mjs           seed (keeps existing trade)
 *   DATABASE_URL=... node scripts/seed-demo-pos.mjs --reset   wipe this group's POS rows, seed again
 *
 * Refuses a database that is not marked sample (`sample-database.mjs`).
 */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

import pg from 'pg';

import { seedMissingDepartments } from './property-departments.mjs';
import { businessKindFor } from './business-kind.mjs';
import { assertSampleDatabase } from './sample-database.mjs';

const require = createRequire(import.meta.url);
const { orderAmounts, rateToBps } = require('@injishi/contracts');

const RESET = process.argv.includes('--reset');

// --- Ids ----------------------------------------------------------------------

const BLOCK = 'de300000-0000-4000-8000-0b05';
/** A stable id in this script's block, from a readable key. */
function id(key) {
  return `${BLOCK}${createHash('sha256').update(key).digest('hex').slice(0, 8)}`;
}

const ORG = id('org');
const WORKSPACE = id('workspace');
const BRANCH = { kgl: id('property:kimihurura'), rbv: id('property:rubavu') };
const OUTLET = { kgl: id('outlet:kimihurura'), rbv: id('outlet:rubavu') };

// --- Time (Africa/Kigali is UTC+2 all year) --------------------------------------

const NOW = new Date();
const kigaliDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(d);
const TODAY = kigaliDate(NOW);
/** `daysAgo` days before today, at `hhmm` Kigali time; never later than now. */
function at(daysAgo, hhmm) {
  const base = new Date(`${TODAY}T${hhmm}:00+02:00`);
  const t = new Date(base.getTime() - daysAgo * 86_400_000);
  return t > NOW ? new Date(NOW.getTime() - 60_000) : t;
}
/** `minutes` before now. */
const ago = (minutes) => new Date(NOW.getTime() - minutes * 60_000);
const period = (d) => kigaliDate(d).slice(2).replace(/-/g, '');

// --- People ---------------------------------------------------------------------

const STAFF = [
  { key: 'owner', name: 'Claudine Uwase', role: 'owner', branches: [] },
  { key: 'manager', name: 'Patrick Habimana', role: 'manager', branches: ['kgl'] },
  { key: 'cashier1', name: 'Aline Mukamana', role: 'cashier', branches: ['kgl'] },
  { key: 'cashier2', name: 'Eric Nshimiyimana', role: 'cashier', branches: ['kgl', 'rbv'] },
  { key: 'waiter1', name: 'Jean Bosco Ndayisaba', role: 'waiter', branches: ['kgl'] },
  { key: 'waiter2', name: 'Diane Ingabire', role: 'waiter', branches: ['rbv'] },
  { key: 'bartender', name: 'Olivier Mugisha', role: 'bartender', branches: ['kgl'] },
  { key: 'kitchen1', name: 'Emmanuel Twagirayezu', role: 'kitchen', branches: ['kgl'] },
  { key: 'kitchen2', name: 'Grace Uwimana', role: 'kitchen', branches: ['rbv'] },
  { key: 'stock', name: 'Samuel Niyonzima', role: 'stock_controller', branches: [] },
  { key: 'accountant', name: 'Josiane Umutoni', role: 'finance', branches: [] },
].map((s, i) => ({
  ...s,
  id: id(`user:${s.key}`),
  email: `${s.key === 'accountant' ? 'accounts' : s.key}@pos.demo.injishi.com`,
  phone: `+25078800${String(101 + i).padStart(4, '0')}`,
  nid: `11999${String(i + 1).padStart(2, '0')}800000000`.slice(0, 16),
  membership: id(`membership:${s.key}`),
}));
const U = Object.fromEntries(STAFF.map((s) => [s.key, s.id]));

// --- The floor, stations, registers ---------------------------------------------

const AREAS = {
  kgl: [
    { key: 'main', name: 'Main hall', tables: ['T1:4', 'T2:4', 'T3:2', 'T4:6', 'T5:4', 'T6:2'] },
    { key: 'terrace', name: 'Terrace', tables: ['T7:4', 'T8:4', 'T9:6', 'T10:8'] },
    { key: 'bar', name: 'Bar counter', tables: ['B1:2', 'B2:2'] },
  ],
  rbv: [
    { key: 'deck', name: 'Lakeside deck', tables: ['L1:4', 'L2:4', 'L3:6', 'L4:2'] },
    { key: 'indoor', name: 'Indoor', tables: ['I1:4', 'I2:8'] },
  ],
};
const table = (b, label) => id(`table:${b}:${label}`);
const STATION = {
  kgl: { kitchen: id('station:kgl:kitchen'), bar: id('station:kgl:bar') },
  rbv: { kitchen: id('station:rbv:kitchen'), bar: id('station:rbv:bar') },
};
const REGISTER = { kgl1: id('register:kgl:1'), kgl2: id('register:kgl:2'), rbv1: id('register:rbv:1') };

// --- The menu -------------------------------------------------------------------
//
// Prices are VAT INCLUSIVE (the outlets are seeded `inclusive`), as a Rwandan
// bar prints them; bottled water is exempt (TAX_A here, illustrative only).
// Rubavu prices differ where a lakeside bar would charge differently.

const FOOD = '1110160600';
const DRINK = '1110170400';
const SIZE = (small, large) => ({ name: 'Size', required: true, maxChoices: 1, choices: [{ label: 'Small', priceDeltaRwf: small }, { label: 'Large', priceDeltaRwf: large }] });
const SIDE = { name: 'Side', required: true, maxChoices: 1, choices: [{ label: 'Chips', priceDeltaRwf: 0 }, { label: 'Rice', priceDeltaRwf: 0 }, { label: 'Fried plantain', priceDeltaRwf: 500 }] };
const EXTRAS = { name: 'Extras', required: false, maxChoices: 3, choices: [{ label: 'Extra chips', priceDeltaRwf: 1000 }, { label: 'Kachumbari', priceDeltaRwf: 500 }, { label: 'Pili pili', priceDeltaRwf: 0 }] };
const BURGER = { name: 'Add on', required: false, maxChoices: 2, choices: [{ label: 'Cheese', priceDeltaRwf: 800 }, { label: 'Egg', priceDeltaRwf: 500 }] };
const MILK = { name: 'Milk', required: false, maxChoices: 1, choices: [{ label: 'Whole milk', priceDeltaRwf: 0 }, { label: 'No milk', priceDeltaRwf: 0 }] };
const CHILL = { name: 'Serve', required: false, maxChoices: 1, choices: [{ label: 'Cold', priceDeltaRwf: 0 }, { label: 'Warm', priceDeltaRwf: 0 }] };

const MENU = [
  { key: 'grill', name: 'Grill and mains', cls: FOOD, station: 'kitchen', items: [
    ['brochette-goat', 'Goat brochettes', 3500, 3500, 'Two skewers of marinated goat.', [SIDE, EXTRAS]],
    ['brochette-beef', 'Beef brochettes', 3000, 3000, 'Two skewers of beef with onion.', [SIDE, EXTRAS]],
    ['tilapia', 'Grilled whole tilapia', 9000, 8000, 'Lake Kivu tilapia, grilled.', [SIDE]],
    ['chicken-quarter', 'Grilled chicken quarter', 5500, 5500, 'With pili pili butter.', [SIDE]],
    ['isombe', 'Isombe with beef', 4500, 4500, 'Cassava leaves stewed with beef.', []],
    ['beans-rice', 'Beans and rice', 2500, 2500, 'Red beans, rice and greens.', []],
    ['fish-fillet', 'Pan fried fish fillet', 7000, 6500, 'Nile perch fillet, lemon butter.', [SIDE]],
    ['goat-stew', 'Goat stew', 5000, 5000, 'Slow cooked, tomato and onion.', [SIDE]],
  ] },
  { key: 'burgers', name: 'Burgers', cls: FOOD, station: 'kitchen', items: [
    ['burger-beef', 'Beef burger', 6000, 6000, 'Beef patty, tomato, onion, chips.', [BURGER]],
    ['burger-chicken', 'Chicken burger', 6000, 6000, 'Crumbed chicken, slaw, chips.', [BURGER]],
    ['burger-veg', 'Bean burger', 5000, 5000, 'Spiced bean patty, avocado, chips.', [BURGER]],
  ] },
  { key: 'sides', name: 'Sides', cls: FOOD, station: 'kitchen', items: [
    ['chips', 'Chips', 1500, 1500, 'Hand cut.', []],
    ['rice', 'Rice', 1000, 1000, 'Steamed.', []],
    ['plantain', 'Fried plantain', 1500, 1500, 'Ripe plantain.', []],
    ['salad', 'Garden salad', 2000, 2000, 'Avocado, tomato, onion.', []],
    ['sambaza', 'Fried sambaza', 3000, 2500, 'Small lake fish, crisp.', []],
  ] },
  { key: 'desserts', name: 'Desserts', cls: FOOD, station: 'kitchen', items: [
    ['fruit-salad', 'Fruit salad', 2500, 2500, 'Pineapple, papaya, passion fruit.', []],
    ['pancakes', 'Banana pancakes', 3000, 3000, 'With honey.', []],
    ['ice-cream', 'Ice cream, two scoops', 2500, 2500, 'Vanilla or chocolate.', []],
  ] },
  { key: 'coffee', name: 'Coffee and tea', cls: DRINK, station: 'bar', items: [
    ['espresso', 'Espresso', 1500, 1500, 'Rwandan single origin.', []],
    ['cappuccino', 'Cappuccino', 2500, 2500, 'Double shot.', [SIZE(0, 1000), MILK]],
    ['african-tea', 'African tea', 1500, 1500, 'Spiced milk tea.', [SIZE(0, 500)]],
    ['black-tea', 'Black tea', 1000, 1000, 'Rwandan leaf.', []],
  ] },
  { key: 'juice', name: 'Juices and soft drinks', cls: DRINK, station: 'bar', items: [
    ['passion-juice', 'Passion fruit juice', 2000, 2000, 'Fresh.', [SIZE(0, 1000)]],
    ['pineapple-juice', 'Pineapple juice', 2000, 2000, 'Fresh.', [SIZE(0, 1000)]],
    ['tree-tomato', 'Tree tomato juice', 2000, 2000, 'Fresh.', [SIZE(0, 1000)]],
    ['soda', 'Soda, 30 cl', 1000, 1000, 'Fanta, Coca-Cola or Sprite.', [CHILL]],
  ] },
  { key: 'beer', name: 'Beer', cls: DRINK, station: 'bar', items: [
    ['primus', 'Primus, 72 cl', 1500, 1500, 'Bottle.', [CHILL]],
    ['mutzig', 'Mützig, 65 cl', 1800, 1800, 'Bottle.', [CHILL]],
    ['skol', 'Skol Lager, 50 cl', 1500, 1500, 'Bottle.', [CHILL]],
    ['virunga', 'Virunga Gold, 50 cl', 2000, 2000, 'Bottle.', [CHILL]],
  ] },
  // No station: a bottle of water is handed over the counter, so it sends no ticket.
  { key: 'water', name: 'Water', cls: DRINK, station: null, tax: 'TAX_A', items: [
    ['water-small', 'Bottled water, 50 cl', 800, 800, 'Still.', []],
    ['water-large', 'Bottled water, 1.5 l', 1500, 1500, 'Still.', []],
  ] },
];
const item = (b, key) => id(`item:${b}:${key}`);
const ITEMS = {};
for (const b of ['kgl', 'rbv']) {
  let serial = 0;
  for (const cat of MENU) {
    for (const [key, name, kgl, rbv, description, options] of cat.items) {
      serial += 1;
      ITEMS[`${b}:${key}`] = {
        id: item(b, key),
        name,
        price: b === 'kgl' ? kgl : rbv,
        options,
        tax: cat.tax ?? 'TAX_B',
        station: cat.station ? STATION[b][cat.station] : null,
        sku: `RW2NTU${b === 'kgl' ? '1' : '2'}${String(serial).padStart(6, '0')}`,
      };
    }
  }
}

// --- Writing ----------------------------------------------------------------------

async function lookup(c, sql, args, what) {
  const { rows } = await c.query(sql, args);
  if (rows.length === 0) throw new Error(`${what} not found. Run the sample recipe (seed-geography.mjs) first.`);
  return rows[0].id;
}

async function seedBusiness(c) {
  const rubavu = await lookup(c, `SELECT id FROM districts WHERE lower(name) = 'rubavu' LIMIT 1`, [], 'Rubavu district');
  const gasabo = await lookup(c, `SELECT id FROM districts WHERE lower(name) = 'gasabo' LIMIT 1`, [], 'Gasabo district');
  const kimihurura = await lookup(
    c,
    `SELECT s.id FROM sectors s JOIN districts d ON d.id = s.district_id WHERE lower(s.name) = 'kimihurura' AND d.id = $1 LIMIT 1`,
    [gasabo],
    'Kimihurura sector',
  );
  const gisenyi = await lookup(
    c,
    `SELECT s.id FROM sectors s JOIN districts d ON d.id = s.district_id WHERE lower(s.name) = 'gisenyi' AND d.id = $1 LIMIT 1`,
    [rubavu],
    'Gisenyi sector',
  );

  await c.query(
    `INSERT INTO orgs (id, legal_name, domain, accommodation_class, accommodation_class_other, tin, registration_status, district_id, business_kind)
     VALUES ($1, 'Ikirezi Bistro Group Ltd (demo)', 'hospitality', 'other', 'Restaurant and bar group', '999050501', 'active', $2, $3)
     ON CONFLICT (id) DO UPDATE SET registration_status = 'active'`,
    [ORG, gasabo, businessKindFor({ domain: 'hospitality', accommodationClass: 'other' })],
  );
  await c.query(`INSERT INTO workspaces (id, kind, org_id) VALUES ($1, 'business', $2) ON CONFLICT DO NOTHING`, [WORKSPACE, ORG]);

  const branches = [
    { b: 'kgl', name: 'Ikirezi Kimihurura', district: gasabo, sector: kimihurura, street: 'KG 7 Avenue, Kimihurura (fictional)', lat: -1.9536, lng: 30.0911, head: true, rra: '00' },
    { b: 'rbv', name: 'Ikirezi Rubavu Lakeside', district: rubavu, sector: gisenyi, street: 'Avenue de la Cooperation, Gisenyi (fictional)', lat: -1.7020, lng: 29.2560, head: false, rra: '01' },
  ];
  for (const br of branches) {
    await c.query(
      `INSERT INTO properties (id, org_id, workspace_id, name, description, sector_id, district_id, latitude, longitude,
                               address_text, slug, is_head_office, rra_branch_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO NOTHING`,
      [BRANCH[br.b], ORG, WORKSPACE, br.name, 'A fictional demo restaurant and bar.', br.sector, br.district, br.lat, br.lng,
        br.street, `${br.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-demo`, br.head, br.rra],
    );
  }
  await seedMissingDepartments(c);
}

async function seedPeople(c) {
  for (const s of STAFF) {
    const { rows } = await c.query('SELECT id FROM users WHERE lower(email) = lower($1)', [s.email]);
    if (rows.length > 0 && rows[0].id !== s.id) {
      throw new Error(`${s.email} already belongs to user ${rows[0].id}. Reset this sample database and seed again.`);
    }
    await c.query(
      `INSERT INTO users (id, email, email_verified, name) VALUES ($1, $2, true, $3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [s.id, s.email, s.name],
    );
    await c.query(
      `INSERT INTO user_profiles (user_id, display_name, national_id, phone_e164) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO NOTHING`,
      [s.id, s.name, s.nid, s.phone],
    );
    await c.query(
      `INSERT INTO verified_identities (user_id, kyc_status, legal_full_name, verified_method, verified_at)
       VALUES ($1, 'verified', $2, 'manual', now()) ON CONFLICT (user_id) DO NOTHING`,
      [s.id, s.name],
    );
    const { rows: role } = await c.query(
      `SELECT 1 FROM user_roles WHERE user_id = $1 AND global_role = 'guest' AND revoked_at IS NULL LIMIT 1`,
      [s.id],
    );
    if (role.length === 0) await c.query(`INSERT INTO user_roles (user_id, global_role) VALUES ($1, 'guest')`, [s.id]);
    await c.query(`INSERT INTO workspaces (id, kind, user_id) VALUES ($1, 'personal', $2) ON CONFLICT DO NOTHING`, [id(`personal:${s.key}`), s.id]);
    await c.query(
      `INSERT INTO org_memberships (id, org_id, user_id, org_role, status) VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (id) DO UPDATE SET org_role = EXCLUDED.org_role, status = 'active'`,
      [s.membership, ORG, s.id, s.role],
    );
    for (const b of s.branches) {
      await c.query(
        `INSERT INTO org_membership_branches (org_membership_id, property_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [s.membership, BRANCH[b]],
      );
    }
  }
}

async function fnbDepartment(c, b) {
  return lookup(
    c,
    `SELECT id FROM departments WHERE property_id = $1 AND department_category = 'fnb' LIMIT 1`,
    [BRANCH[b]],
    'The Food and Beverage department',
  );
}

async function seedOutletsAndMenu(c) {
  for (const b of ['kgl', 'rbv']) {
    const dept = await fnbDepartment(c, b);
    const name = b === 'kgl' ? 'Ikirezi Kimihurura Restaurant and Bar' : 'Ikirezi Lakeside Bar and Grill';
    await c.query(
      `INSERT INTO outlets (id, department_id, property_id, workspace_id, tax_entity_org_id, name, outlet_kind,
                            ordering_access, guest_visible, sort_order, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'restaurant', 'in_house_only', false, 10, 'active')
       ON CONFLICT (id) DO NOTHING`,
      [OUTLET[b], dept, BRANCH[b], WORKSPACE, ORG, name],
    );
    await c.query(
      `INSERT INTO pos_outlet_settings (outlet_id, workspace_id, tax_mode, discount_limit_bps, enabled_methods, receipt_header, receipt_footer)
       VALUES ($1, $2, 'inclusive', 1000, '{cash,mtn_momo,airtel_money,card,bank_transfer,voucher}', $3, $4)
       ON CONFLICT (outlet_id) DO NOTHING`,
      [OUTLET[b], WORKSPACE, `${name} · TIN 999050501 (demo)`, 'Murakoze! Prices include VAT (illustrative demo rate).'],
    );
    for (const [kind, label, printer] of [['kitchen', 'Kitchen', 'Kitchen printer (simulated)'], ['bar', 'Bar', 'Bar printer (simulated)']]) {
      await c.query(
        `INSERT INTO preparation_stations (id, workspace_id, outlet_id, name, kind, printer_name, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
        [STATION[b][kind], WORKSPACE, OUTLET[b], label, kind, printer, kind === 'kitchen' ? 10 : 20],
      );
    }
    let sort = 0;
    for (const cat of MENU) {
      sort += 10;
      const categoryId = id(`category:${b}:${cat.key}`);
      await c.query(
        `INSERT INTO service_categories (id, department_id, outlet_id, property_id, workspace_id, name, sort_order, guest_visible,
                                         default_rra_item_cls_cd, default_rra_item_ty_cd, default_rra_pkg_unit_cd, default_rra_qty_unit_cd, default_tax_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, '2', 'NT', 'U', $9) ON CONFLICT (id) DO NOTHING`,
        [categoryId, dept, OUTLET[b], BRANCH[b], WORKSPACE, cat.name, sort, cat.cls, cat.tax ?? 'TAX_B'],
      );
      for (const [key, name, , , description, options] of cat.items) {
        const it = ITEMS[`${b}:${key}`];
        await c.query(
          `INSERT INTO service_items (id, service_category_id, department_id, outlet_id, property_id, workspace_id, name, description,
                                      price_rwf, tax_code, fulfillment_type, prep_time_minutes, options, guest_orderable, status,
                                      rra_item_cls_cd, rra_item_ty_cd, rra_item_cd, rra_pkg_unit_cd, rra_qty_unit_cd)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'onsite', $11, $12, false, 'active', $13, '2', $14, 'NT', 'U')
           ON CONFLICT (id) DO NOTHING`,
          [it.id, categoryId, dept, OUTLET[b], BRANCH[b], WORKSPACE, name, description, it.price, it.tax,
            cat.station === 'kitchen' ? 15 : 3, JSON.stringify(options), cat.cls, it.sku],
        );
        if (it.station) {
          await c.query(
            `INSERT INTO pos_item_routes (service_item_id, workspace_id, station_id) VALUES ($1, $2, $3) ON CONFLICT (service_item_id) DO NOTHING`,
            [it.id, WORKSPACE, it.station],
          );
        }
      }
    }
    for (const [ai, area] of AREAS[b].entries()) {
      const areaId = id(`area:${b}:${area.key}`);
      await c.query(
        `INSERT INTO dining_areas (id, workspace_id, outlet_id, name, sort_order) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [areaId, WORKSPACE, OUTLET[b], area.name, (ai + 1) * 10],
      );
      for (const [ti, spec] of area.tables.entries()) {
        const [label, seats] = spec.split(':');
        await c.query(
          `INSERT INTO restaurant_tables (id, workspace_id, outlet_id, area_id, label, seats, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
          [table(b, label), WORKSPACE, OUTLET[b], areaId, label, Number(seats), (ti + 1) * 10],
        );
      }
    }
  }
  for (const [key, outlet, name, device] of [
    ['kgl1', OUTLET.kgl, 'Till 1', 'Front counter tablet'],
    ['kgl2', OUTLET.kgl, 'Till 2', 'Bar counter tablet'],
    ['rbv1', OUTLET.rbv, 'Till 1', 'Deck tablet'],
  ]) {
    await c.query(
      `INSERT INTO pos_registers (id, workspace_id, outlet_id, name, device_label) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [REGISTER[key], WORKSPACE, outlet, name, device],
    );
  }
}

// --- Two days of trade ------------------------------------------------------------

/** The tax rates in force now, as basis points, the way the API reads them. */
async function rates(c) {
  const { rows } = await c.query(
    `SELECT value FROM config_entries WHERE config_type = 'tax_rates'
       AND (effective_from IS NULL OR effective_from <= now()) AND (effective_to IS NULL OR effective_to > now())
     ORDER BY effective_from DESC NULLS LAST, version DESC LIMIT 1`,
  );
  if (!rows[0]) throw new Error('No tax rates are effective. Run seed-content.mjs first.');
  return Object.fromEntries(Object.entries(rows[0].value).map(([k, v]) => [k, rateToBps(v)]));
}

const counters = new Map();
/** The next number of `kind` in the day `d` falls in, as the API's counter would have handed it out. */
function next(kind, d) {
  const k = `${kind}:${period(d)}`;
  const n = (counters.get(k) ?? 0) + 1;
  counters.set(k, n);
  return { n, period: period(d) };
}

function priceOf(it, picks) {
  let delta = 0;
  const snapshot = [];
  for (const [name, labels] of Object.entries(picks ?? {})) {
    const opt = it.options.find((o) => o.name === name);
    if (!opt) throw new Error(`${it.name} has no option ${name}`);
    const choices = labels.map((l) => {
      const ch = opt.choices.find((x) => x.label === l);
      if (!ch) throw new Error(`${it.name}: ${name} has no ${l}`);
      delta += ch.priceDeltaRwf;
      return { label: ch.label, priceDeltaRwf: ch.priceDeltaRwf };
    });
    snapshot.push({ name, choices });
  }
  for (const o of it.options) {
    if (o.required && !snapshot.some((s) => s.name === o.name)) {
      const first = o.choices[0];
      delta += first.priceDeltaRwf;
      snapshot.push({ name: o.name, choices: [{ label: first.label, priceDeltaRwf: first.priceDeltaRwf }] });
    }
  }
  return { unit: it.price + delta, snapshot };
}

/**
 * One order, written whole: its lines priced and taxed by `orderAmounts`, its
 * tickets, items and their history, its print jobs, discounts, payments,
 * refunds and events. `o` describes the story; everything else is derived.
 */
async function writeOrder(c, R, o) {
  const b = o.branch;
  const orderId = id(`order:${o.key}`);
  const created = o.at;
  const num = next('order', created);
  const orderNumber = `POS-${num.period}-${String(num.n).padStart(4, '0')}`;
  const lines = o.lines.map(([key, qty, picks, opts = {}], i) => {
    const it = ITEMS[`${b}:${key}`];
    const { unit, snapshot } = priceOf(it, picks);
    return { i, it, qty, unit, snapshot, note: opts.note ?? null, voided: opts.voided ?? null, draft: !!opts.draft, lineDiscount: opts.discount ?? 0, id: id(`line:${o.key}:${i}`) };
  });
  const live = lines.filter((l) => !l.voided);
  const orderDiscount = (o.discounts ?? []).filter((d) => d.line === undefined && d.status === 'approved').reduce((a, d) => a + d.amount, 0);
  const bill = orderAmounts(
    live.map((l) => ({ unitPriceRwf: l.unit, quantity: l.qty, lineDiscountRwf: l.lineDiscount, taxRateBps: R[l.it.tax] })),
    orderDiscount,
    'inclusive',
  );
  let sessionId = null;
  if (o.table) {
    sessionId = id(`session:${o.key}`);
    const closedAt = o.sessionClosedAt ?? null;
    await c.query(
      `INSERT INTO table_sessions (id, workspace_id, outlet_id, table_id, status, guest_count, waiter_user_id, opened_by_user_id, opened_at, closed_at, closed_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10)`,
      [sessionId, WORKSPACE, OUTLET[b], table(b, o.table), closedAt ? 'closed' : 'open', o.guests ?? 2, U[o.waiter], new Date(created.getTime() - 3 * 60_000),
        closedAt, closedAt ? U[o.waiter] : null],
    );
    if (!closedAt) {
      await c.query(`UPDATE restaurant_tables SET status = $2 WHERE id = $1`, [table(b, o.table), o.tableStatus ?? 'occupied']);
    }
  }
  const sent = lines.filter((l) => !l.draft);
  const submittedAt = sent.length ? new Date(created.getTime() + 2 * 60_000) : null;
  await c.query(
    `INSERT INTO pos_orders (id, workspace_id, outlet_id, property_id, tax_entity_org_id, order_number, order_type, status, table_session_id,
                             waiter_user_id, created_by_user_id, guest_note, tax_mode, gross_rwf, discount_rwf, tax_rwf, total_rwf,
                             submitted_at, settled_at, completed_at, cancelled_at, cancelled_by_user_id, cancel_reason, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'inclusive', $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $23)`,
    [orderId, WORKSPACE, OUTLET[b], BRANCH[b], ORG, orderNumber, o.type ?? 'dine_in', o.status, sessionId,
      U[o.waiter], U[o.waiter], o.note ?? null, bill.grossRwf, bill.discountRwf, bill.taxRwf, bill.totalRwf,
      submittedAt, o.settledAt ?? null, o.status === 'completed' ? (o.completedAt ?? o.settledAt) : null,
      o.cancel ? o.cancel.at : null, o.cancel ? U[o.cancel.by] : null, o.cancel ? o.cancel.reason : null, created],
  );
  await c.query(`INSERT INTO pos_order_events (order_id, kind, to_status, actor_user_id, occurred_at) VALUES ($1, 'created', 'draft', $2, $3)`, [orderId, U[o.waiter], created]);

  let liveIndex = 0;
  for (const l of lines) {
    const priced = l.voided ? null : bill.lines[liveIndex++];
    const gross = l.unit * l.qty;
    await c.query(
      `INSERT INTO pos_order_lines (id, workspace_id, order_id, service_item_id, name_snapshot, sku_snapshot, quantity, unit_price_rwf,
                                    selected_options, note, status, tax_code, tax_rate_bps, line_discount_rwf, order_discount_share_rwf,
                                    gross_rwf, discount_rwf, tax_rwf, total_rwf, station_id, sent_at, voided_at, voided_by_user_id, void_reason,
                                    created_by_user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $26)`,
      [l.id, WORKSPACE, orderId, l.it.id, l.it.name, l.it.sku, l.qty, l.unit, JSON.stringify(l.snapshot), l.note,
        l.voided ? 'voided' : l.draft ? 'draft' : 'sent', l.it.tax, R[l.it.tax], l.lineDiscount,
        priced?.orderDiscountShareRwf ?? 0, gross, priced?.discountRwf ?? 0, priced?.taxRwf ?? 0, priced?.totalRwf ?? gross,
        l.draft ? null : l.it.station, l.draft ? null : submittedAt, l.voided ? l.voided.at : null, l.voided ? U[l.voided.by] : null,
        l.voided ? l.voided.reason : null, U[o.waiter], created],
    );
  }

  // Tickets: one per station of the sent lines, in round 1, moved along `o.tickets[kind]`.
  const byStation = new Map();
  for (const l of sent) if (l.it.station) byStation.set(l.it.station, [...(byStation.get(l.it.station) ?? []), l]);
  for (const [stationId, ls] of byStation) {
    const kind = stationId === STATION[b].bar ? 'bar' : 'kitchen';
    const status = o.tickets?.[kind] ?? 'served';
    const t = next(`ticket_${kind}`, submittedAt);
    const ticketNumber = `${kind === 'bar' ? 'B' : 'K'}-${t.period}-${String(t.n).padStart(4, '0')}`;
    const ticketId = id(`ticket:${o.key}:${kind}`);
    const started = ['preparing', 'ready', 'served'].includes(status) ? new Date(submittedAt.getTime() + 2 * 60_000) : null;
    const ready = ['ready', 'served'].includes(status) ? new Date(submittedAt.getTime() + (kind === 'bar' ? 5 : 16) * 60_000) : null;
    const served = status === 'served' ? new Date(ready.getTime() + 3 * 60_000) : null;
    const cancelled = status === 'cancelled' ? (o.cancel?.at ?? new Date(submittedAt.getTime() + 60_000)) : null;
    await c.query(
      `INSERT INTO kitchen_tickets (id, workspace_id, outlet_id, order_id, station_id, ticket_number, round, status, created_at, started_at, ready_at, served_at, cancelled_at)
       VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8, $9, $10, $11, $12)`,
      [ticketId, WORKSPACE, OUTLET[b], orderId, stationId, ticketNumber, status, submittedAt, started, ready, served, cancelled],
    );
    const trail = ['queued', ...(started ? ['preparing'] : []), ...(ready ? ['ready'] : []), ...(served ? ['served'] : []), ...(cancelled ? ['cancelled'] : [])];
    const stamps = { queued: submittedAt, preparing: started, ready, served, cancelled };
    for (const [ti, to] of trail.entries()) {
      await c.query(
        `INSERT INTO kitchen_ticket_events (ticket_id, from_status, to_status, actor_user_id, occurred_at) VALUES ($1, $2, $3, $4, $5)`,
        [ticketId, ti === 0 ? null : trail[ti - 1], to, kind === 'bar' ? U.bartender : U[b === 'kgl' ? 'kitchen1' : 'kitchen2'], stamps[to]],
      );
    }
    for (const l of ls) {
      const itemStatus = l.voided ? 'cancelled' : status;
      await c.query(
        `INSERT INTO kitchen_ticket_items (id, ticket_id, order_line_id, status, quantity, name, options, note) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id(`ticket-item:${l.id}`), ticketId, l.id, itemStatus, l.qty, l.it.name,
          l.snapshot.map((s) => `${s.name}: ${s.choices.map((x) => x.label).join(', ')}`), l.note],
      );
    }
    await c.query(
      `INSERT INTO pos_print_jobs (workspace_id, outlet_id, station_id, kind, source_id, copy_number, printer_name, payload, requested_by_user_id, created_at)
       VALUES ($1, $2, $3, 'kitchen_ticket', $4, 1, $5, $6, $7, $8)`,
      [WORKSPACE, OUTLET[b], stationId, ticketId, kind === 'bar' ? 'Bar printer (simulated)' : 'Kitchen printer (simulated)',
        JSON.stringify({ simulated: true, ticketNumber, orderNumber, table: o.table ?? null, round: 1, items: ls.map((l) => ({ quantity: l.qty, name: l.it.name })) }),
        U[o.waiter], submittedAt],
    );
  }
  if (submittedAt) {
    await c.query(
      `INSERT INTO pos_order_events (order_id, kind, actor_user_id, data, occurred_at) VALUES ($1, 'sent', $2, $3, $4)`,
      [orderId, U[o.waiter], JSON.stringify({ round: 1, lines: sent.length, tickets: byStation.size }), submittedAt],
    );
  }

  for (const d of o.discounts ?? []) {
    if (d.amount === 'auto') d.amount = Math.floor((bill.grossRwf * d.value + 5000) / 10000);
  }
  let collectedSoFar = 0;
  for (const p of o.payments ?? []) {
    if (p.amount === 'rest') p.amount = bill.totalRwf - collectedSoFar;
    if (p.tendered === 'round') p.tendered = Math.ceil((p.amount + (p.tip ?? 0)) / 1000) * 1000;
    if (p.status === 'successful') collectedSoFar += p.amount;
  }
  for (const [di, d] of (o.discounts ?? []).entries()) {
    const discountId = id(`discount:${o.key}:${di}`);
    await c.query(
      `INSERT INTO pos_order_discounts (id, workspace_id, order_id, order_line_id, kind, value, amount_rwf, reason, status,
                                        requested_by_user_id, decided_by_user_id, decided_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [discountId, WORKSPACE, orderId, d.line === undefined ? null : lines[d.line].id, d.kind ?? 'amount', d.value ?? d.amount, d.amount,
        d.reason, d.status, U[d.by], d.status === 'pending_approval' ? null : U[d.decidedBy ?? d.by],
        d.status === 'pending_approval' ? null : (d.at ?? created), d.at ?? created],
    );
    await audit(c, b, d.by, d.status === 'approved' ? 'discount.applied' : 'discount.requested', 'pos_order_discount', discountId,
      null, { orderNumber, amountRwf: d.amount, status: d.status }, d.reason, d.at ?? created);
  }

  for (const [pi, p] of (o.payments ?? []).entries()) {
    const paymentId = id(`payment:${o.key}:${pi}`);
    const ref = `DEMO-${{ cash: 'CASH', mtn_momo: 'MOMO', airtel_money: 'AIRTEL', card: 'CARD', bank_transfer: 'BANK', voucher: 'VCHR' }[p.method]}-${createHash('sha256').update(paymentId).digest('hex').slice(0, 8).toUpperCase()}`;
    const refunded = p.refund?.amount ?? 0;
    const status = refunded > 0 && refunded === p.amount ? 'refunded' : p.status;
    await c.query(
      `INSERT INTO pos_payments (id, workspace_id, outlet_id, order_id, shift_id, method, amount_rwf, tendered_rwf, change_rwf, tip_rwf, refunded_rwf,
                                 status, demo_reference, simulated, payer_phone_masked, voucher_code, failure_reason, idempotency_key,
                                 created_by_user_id, settled_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $21)`,
      [paymentId, WORKSPACE, OUTLET[b], orderId, p.shift ? id(`shift:${p.shift}`) : null, p.method, p.amount,
        p.method === 'cash' ? (p.tendered ?? null) : null, p.method === 'cash' && p.tendered ? p.tendered - p.amount - (p.tip ?? 0) : 0,
        p.tip ?? 0, refunded, status, ref, p.method !== 'cash',
        ['mtn_momo', 'airtel_money'].includes(p.method) ? '+250 7•• ••• 1' + String(10 + pi).slice(-2) : null,
        p.method === 'voucher' ? 'DEMO-VOUCHER-2026' : null, p.failure ?? null, `${WORKSPACE}:seed:${paymentId}`,
        U[p.by], p.status === 'successful' ? p.at : null, p.at],
    );
    const trail = p.status === 'successful' && ['mtn_momo', 'airtel_money', 'bank_transfer'].includes(p.method)
      ? [['pending', 'Simulated: waiting for the demo provider to answer.'], ['successful', 'Simulated: the demo provider confirmed.']]
      : [[p.status, p.status === 'successful' ? (p.method === 'cash' ? 'Recorded at the cash drawer.' : 'Simulated: approved.') : p.status === 'failed' ? 'Simulated: declined.' : 'Simulated: waiting for the demo provider to answer.']];
    for (const [ti, [to, note]] of trail.entries()) {
      await c.query(
        `INSERT INTO pos_payment_events (payment_id, from_status, to_status, note, actor_user_id, occurred_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        [paymentId, ti === 0 ? null : trail[ti - 1][0], to, note, U[p.by], new Date(p.at.getTime() + ti * 40_000)],
      );
    }
    await audit(c, b, p.by, 'payment.taken', 'pos_payment', paymentId, null,
      { orderNumber, method: p.method, amountRwf: p.amount, status: p.status, reference: ref, simulated: p.method !== 'cash' }, null, p.at);
    if (p.refund) {
      const refundId = id(`refund:${o.key}:${pi}`);
      await c.query(
        `INSERT INTO pos_refunds (id, workspace_id, payment_id, shift_id, amount_rwf, reason, demo_reference, idempotency_key, refunded_by_user_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [refundId, WORKSPACE, paymentId, p.method === 'cash' ? id(`shift:${p.refund.shift}`) : null, p.refund.amount, p.refund.reason,
          `DEMO-RFND-${createHash('sha256').update(refundId).digest('hex').slice(0, 8).toUpperCase()}`, `${WORKSPACE}:seed:${refundId}`,
          U[p.refund.by], p.refund.at],
      );
      await c.query(
        `INSERT INTO pos_payment_events (payment_id, from_status, to_status, note, actor_user_id, occurred_at) VALUES ($1, 'successful', $2, $3, $4, $5)`,
        [paymentId, status, `Refunded RWF ${p.refund.amount.toLocaleString('en-US')}${p.method !== 'cash' ? ' (simulated)' : ''}.`, U[p.refund.by], p.refund.at],
      );
      await audit(c, b, p.refund.by, 'payment.refunded', 'pos_payment', paymentId, { refundedRwf: 0 }, { refundedRwf: p.refund.amount, orderNumber },
        p.refund.reason, p.refund.at);
    }
  }
  if (o.cancel) {
    await c.query(
      `INSERT INTO pos_order_events (order_id, kind, from_status, to_status, actor_user_id, data, occurred_at) VALUES ($1, 'cancelled', $2, 'cancelled', $3, $4, $5)`,
      [orderId, submittedAt ? 'submitted' : 'draft', U[o.cancel.by], JSON.stringify({ reason: o.cancel.reason }), o.cancel.at],
    );
    await audit(c, b, o.cancel.by, 'order.cancelled', 'pos_order', orderId, { status: submittedAt ? 'submitted' : 'draft', totalRwf: bill.totalRwf },
      { status: 'cancelled' }, o.cancel.reason, o.cancel.at);
  }
  for (const l of lines.filter((x) => x.voided)) {
    await audit(c, b, l.voided.by, 'line.voided', 'pos_order_line', l.id, { name: l.it.name, quantity: l.qty, status: 'sent' }, { status: 'voided' },
      l.voided.reason, l.voided.at);
  }
  return { orderId, totalRwf: bill.totalRwf, orderNumber };
}

async function audit(c, b, actor, action, entityType, entityId, before, after, reason, at) {
  await c.query(
    `INSERT INTO pos_audit_events (workspace_id, outlet_id, actor_user_id, action, entity_type, entity_id, before, after, reason, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [WORKSPACE, OUTLET[b], U[actor], action, entityType, entityId, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null,
      reason, at],
  );
}

/** The cash a shift's drawer should hold, from the rows seeded on it, as `expectedFrom` computes it. */
async function expectedCashOf(c, shiftId, float) {
  const { rows } = await c.query(
    `SELECT
       coalesce((SELECT sum(amount_rwf + tip_rwf) FROM pos_payments WHERE shift_id = $1 AND method = 'cash' AND status IN ('successful', 'refunded')), 0)::bigint AS sales,
       coalesce((SELECT sum(r.amount_rwf) FROM pos_refunds r JOIN pos_payments p ON p.id = r.payment_id WHERE r.shift_id = $1 AND p.method = 'cash'), 0)::bigint AS refunds,
       coalesce((SELECT sum(amount_rwf) FROM cash_movements WHERE shift_id = $1 AND kind = 'paid_in' AND status = 'approved'), 0)::bigint AS paid_in,
       coalesce((SELECT sum(amount_rwf) FROM cash_movements WHERE shift_id = $1 AND kind = 'paid_out' AND status = 'approved'), 0)::bigint AS paid_out`,
    [shiftId],
  );
  const r = rows[0];
  return float + Number(r.sales) - Number(r.refunds) + Number(r.paid_in) - Number(r.paid_out);
}

async function seedTrade(c) {
  const R = await rates(c);
  const SHIFTS = [
    { key: 'kgl-y-1', register: 'kgl1', outlet: OUTLET.kgl, cashier: 'cashier1', float: 30000, opened: at(1, '10:00'), closed: at(1, '17:00'), shortBy: 0, review: { by: 'manager', at: at(1, '17:30'), note: 'Counted with Aline. Balanced.' } },
    { key: 'kgl-y-2', register: 'kgl2', outlet: OUTLET.kgl, cashier: 'cashier2', float: 20000, opened: at(1, '16:00'), closed: at(1, '23:00'), shortBy: 2000, closeNote: 'Two thousand short. Possibly change given twice on table T4.' },
    { key: 'kgl-t-1', register: 'kgl1', outlet: OUTLET.kgl, cashier: 'cashier1', float: 30000, opened: at(0, '10:00') },
    { key: 'rbv-t-1', register: 'rbv1', outlet: OUTLET.rbv, cashier: 'cashier2', float: 25000, opened: at(0, '11:00') },
  ];
  const openShifts = async (list) => {
    for (const s of list) {
      await c.query(
        `INSERT INTO cashier_shifts (id, workspace_id, outlet_id, register_id, cashier_user_id, status, opening_float_rwf, opened_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, $7, $7)`,
        [id(`shift:${s.key}`), WORKSPACE, s.outlet, REGISTER[s.register], U[s.cashier], s.float, s.opened],
      );
      await audit(c, s.outlet === OUTLET.kgl ? 'kgl' : 'rbv', s.cashier, 'shift.opened', 'cashier_shift', id(`shift:${s.key}`), null,
        { openingFloatRwf: s.float }, null, s.opened);
    }
  };
  /** Close with the expected cash computed from what was seeded on the shift, and the count `shortBy` under it. */
  const closeShifts = async (list) => {
    for (const s of list) {
      const shiftId = id(`shift:${s.key}`);
      const expected = await expectedCashOf(c, shiftId, s.float);
      const counted = expected - s.shortBy;
      await c.query(
        `UPDATE cashier_shifts SET status = $2, closed_at = $3, expected_cash_rwf = $4, counted_cash_rwf = $5, variance_rwf = $6,
                close_note = $7, handover_note = $8, reviewed_by_user_id = $9, reviewed_at = $10, review_note = $11, updated_at = $3
          WHERE id = $1`,
        [shiftId, s.review ? 'reviewed' : 'closed', s.closed, expected, counted, counted - expected, s.closeNote ?? null,
          'Till float left in the safe. Printer paper low.', s.review ? U[s.review.by] : null, s.review?.at ?? null, s.review?.note ?? null],
      );
      await audit(c, 'kgl', s.cashier, 'shift.closed', 'cashier_shift', shiftId, null,
        { expectedCashRwf: expected, countedCashRwf: counted, varianceRwf: counted - expected }, s.closeNote ?? null, s.closed);
      if (s.review) await audit(c, 'kgl', s.review.by, 'shift.reviewed', 'cashier_shift', shiftId, { varianceRwf: counted - expected }, null, s.review.note, s.review.at);
    }
  };
  // Cash movements: a paid in at the start of yesterday's evening shift, an approved paid out, and today's paid out waiting.
  const movements = [
    { shift: 'kgl-y-2', kind: 'paid_in', amount: 10000, reason: 'Extra change float from the safe', by: 'cashier2', status: 'approved', decidedBy: 'cashier2', at: at(1, '16:05') },
    { shift: 'kgl-y-2', kind: 'paid_out', amount: 6000, reason: 'Charcoal for the grill, Kimironko market', by: 'cashier2', status: 'approved', decidedBy: 'manager', at: at(1, '18:10') },
    { shift: 'kgl-t-1', kind: 'paid_out', amount: 4500, reason: 'Ice from the shop next door', by: 'cashier1', status: 'pending_approval', at: ago(25) },
  ];
  const writeMovements = async (shiftKeys) => {
    for (const [mi, m] of movements.entries()) {
      if (!shiftKeys.includes(m.shift)) continue;
      await c.query(
        `INSERT INTO cash_movements (id, workspace_id, shift_id, kind, amount_rwf, reason, status, requested_by_user_id, decided_by_user_id, decided_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [id(`movement:${mi}`), WORKSPACE, id(`shift:${m.shift}`), m.kind, m.amount, m.reason, m.status, U[m.by],
          m.decidedBy ? U[m.decidedBy] : null, m.status === 'pending_approval' ? null : m.at, m.at],
      );
      await audit(c, 'kgl', m.by, `cash.${m.kind}`, 'cash_movement', id(`movement:${mi}`), null, { amountRwf: m.amount, status: m.status }, m.reason, m.at);
    }
  };

  const ORDERS = [
    // Yesterday, Kimihurura. Morning shift: Aline.
    { key: 'y1', branch: 'kgl', table: 'T3', waiter: 'waiter1', guests: 2, at: at(1, '12:20'), status: 'completed', sessionClosedAt: at(1, '13:30'),
      lines: [['brochette-goat', 2, { Side: ['Chips'] }], ['primus', 2, {}], ['passion-juice', 1, { Size: ['Small'] }]],
      discounts: [{ amount: 1000, reason: 'Regular customer, manager approved', status: 'approved', by: 'manager', at: at(1, '13:05') }],
      payments: [{ method: 'cash', amount: 'rest', tendered: 'round', by: 'cashier1', shift: 'kgl-y-1', status: 'successful', at: at(1, '13:10') }],
      settledAt: at(1, '13:10') },
    { key: 'y2', branch: 'kgl', type: 'takeaway', waiter: 'cashier1', at: at(1, '13:00'), status: 'completed',
      lines: [['burger-beef', 2, { 'Add on': ['Cheese'] }], ['soda', 2, { Serve: ['Cold'] }]],
      payments: [{ method: 'mtn_momo', amount: 'rest', by: 'cashier1', shift: 'kgl-y-1', status: 'successful', at: at(1, '13:02') }],
      settledAt: at(1, '13:02'), completedAt: at(1, '13:25') },
    { key: 'y3', branch: 'kgl', table: 'T1', waiter: 'waiter1', guests: 4, at: at(1, '13:40'), status: 'completed', sessionClosedAt: at(1, '15:00'),
      lines: [['tilapia', 2, { Side: ['Fried plantain'] }], ['isombe', 1, {}], ['rice', 2, {}], ['mutzig', 3, {}], ['water-large', 1, {}]],
      payments: [
        { method: 'cash', amount: 15000, tendered: 15000, by: 'cashier1', shift: 'kgl-y-1', status: 'successful', at: at(1, '14:50') },
        { method: 'airtel_money', amount: 'rest', by: 'cashier1', shift: 'kgl-y-1', status: 'successful', at: at(1, '14:52') },
      ],
      settledAt: at(1, '14:52') },
    { key: 'y4', branch: 'kgl', table: 'T5', waiter: 'waiter1', guests: 2, at: at(1, '15:10'), status: 'cancelled', sessionClosedAt: at(1, '15:40'),
      lines: [['goat-stew', 2, { Side: ['Rice'] }, { draft: true }]],
      cancel: { by: 'waiter1', reason: 'Guests left before ordering was sent', at: at(1, '15:35') } },
    // Yesterday evening: Eric's shift, the one that closed short.
    { key: 'y5', branch: 'kgl', table: 'T4', waiter: 'waiter1', guests: 6, at: at(1, '19:00'), status: 'completed', sessionClosedAt: at(1, '21:30'),
      lines: [['brochette-beef', 6, { Side: ['Chips'] }, {}], ['chips', 2, {}], ['primus', 6, {}], ['virunga', 4, {}], ['fish-fillet', 1, { Side: ['Rice'] }, { voided: { by: 'manager', reason: 'Sent by mistake, guest ordered tilapia', at: at(1, '19:10') } }]],
      payments: [{ method: 'cash', amount: 'rest', tendered: 'round', tip: 1000, by: 'cashier2', shift: 'kgl-y-2', status: 'successful', at: at(1, '21:20') }],
      settledAt: at(1, '21:20') },
    { key: 'y6', branch: 'kgl', table: 'T8', waiter: 'waiter1', guests: 3, at: at(1, '20:15'), status: 'completed', sessionClosedAt: at(1, '22:10'),
      lines: [['burger-chicken', 1, {}], ['chicken-quarter', 2, { Side: ['Chips'] }], ['cappuccino', 2, { Size: ['Large'] }], ['ice-cream', 2, {}]],
      payments: [
        { method: 'card', amount: 'rest', by: 'cashier2', shift: 'kgl-y-2', status: 'failed', failure: 'Simulated decline: card not accepted.', at: at(1, '22:00') },
        { method: 'card', amount: 'rest', by: 'cashier2', shift: 'kgl-y-2', status: 'successful', at: at(1, '22:02'),
          refund: { amount: 2500, reason: 'One ice cream melted before serving', by: 'manager', at: at(1, '22:20') } },
      ],
      settledAt: at(1, '22:02') },
    { key: 'y7', branch: 'kgl', type: 'takeaway', waiter: 'cashier2', at: at(1, '21:40'), status: 'completed',
      lines: [['brochette-goat', 4, { Side: ['Chips'] }], ['skol', 4, {}]],
      payments: [{ method: 'cash', amount: 'rest', tendered: 'round', by: 'cashier2', shift: 'kgl-y-2', status: 'successful', at: at(1, '21:42') }],
      settledAt: at(1, '21:42'), completedAt: at(1, '22:00') },
    // Today, Kimihurura: Aline's open shift.
    { key: 't1', branch: 'kgl', table: 'T2', waiter: 'waiter1', guests: 4, at: ago(48), status: 'completed', sessionClosedAt: ago(6),
      lines: [['beans-rice', 2, {}], ['brochette-beef', 2, { Side: ['Rice'] }], ['african-tea', 4, { Size: ['Small'] }]],
      payments: [{ method: 'cash', amount: 'rest', tendered: 'round', by: 'cashier1', shift: 'kgl-t-1', status: 'successful', at: ago(10) }],
      settledAt: ago(10) },
    { key: 't2', branch: 'kgl', table: 'T1', waiter: 'waiter1', guests: 3, at: ago(26), status: 'in_progress',
      lines: [['tilapia', 1, { Side: ['Chips'] }], ['goat-stew', 2, { Side: ['Rice'] }, { note: 'One without chilli' }], ['primus', 2, {}], ['passion-juice', 1, { Size: ['Large'] }]],
      tickets: { kitchen: 'preparing', bar: 'ready' },
      discounts: [{ kind: 'percent', value: 1500, amount: 'auto', reason: 'Birthday table, 15%', status: 'pending_approval', by: 'cashier1', at: ago(5) }] },
    { key: 't3', branch: 'kgl', table: 'T4', waiter: 'waiter1', guests: 5, at: ago(34), status: 'in_progress',
      lines: [['burger-beef', 3, { 'Add on': ['Egg'] }], ['burger-veg', 1, {}], ['salad', 2, {}], ['virunga', 3, {}], ['soda', 2, {}]],
      tickets: { kitchen: 'queued', bar: 'served' },
      payments: [{ method: 'cash', amount: 10000, tendered: 10000, by: 'cashier1', shift: 'kgl-t-1', status: 'successful', at: ago(12) }] },
    { key: 't4', branch: 'kgl', table: 'T7', waiter: 'waiter1', guests: 2, at: ago(70), status: 'delivered', tableStatus: 'bill_requested',
      lines: [['fish-fillet', 2, { Side: ['Chips'] }], ['mutzig', 2, {}]],
      payments: [{ method: 'mtn_momo', amount: 'rest', by: 'cashier1', shift: 'kgl-t-1', status: 'pending', at: ago(3) }] },
    { key: 't5', branch: 'kgl', table: 'T9', waiter: 'waiter1', guests: 4, at: ago(4), status: 'draft',
      lines: [['brochette-goat', 4, { Side: ['Chips'] }, { draft: true }], ['primus', 4, {}, { draft: true }]] },
    { key: 't6', branch: 'kgl', type: 'takeaway', waiter: 'cashier1', at: ago(40), status: 'completed',
      lines: [['pancakes', 2, {}], ['espresso', 2, {}]],
      payments: [
        { method: 'airtel_money', amount: 'rest', by: 'cashier1', shift: 'kgl-t-1', status: 'failed', failure: 'Simulated decline: insufficient balance.', at: ago(38) },
        { method: 'cash', amount: 'rest', tendered: 'round', by: 'cashier1', shift: 'kgl-t-1', status: 'successful', at: ago(37) },
      ],
      settledAt: ago(37), completedAt: ago(28) },
    { key: 't7', branch: 'kgl', table: 'B1', waiter: 'bartender', guests: 2, at: ago(15), status: 'ready',
      lines: [['skol', 2, {}], ['sambaza', 1, {}]],
      tickets: { kitchen: 'ready', bar: 'ready' } },
    // Today, Rubavu: Eric's shift on the deck.
    { key: 'r1', branch: 'rbv', table: 'L1', waiter: 'waiter2', guests: 2, at: ago(95), status: 'completed', sessionClosedAt: ago(20),
      lines: [['tilapia', 2, { Side: ['Fried plantain'] }], ['primus', 2, {}]],
      payments: [{ method: 'bank_transfer', amount: 'rest', by: 'cashier2', shift: 'rbv-t-1', status: 'successful', at: ago(30) }],
      settledAt: ago(30) },
    { key: 'r2', branch: 'rbv', table: 'L3', waiter: 'waiter2', guests: 6, at: ago(22), status: 'submitted',
      lines: [['sambaza', 3, {}], ['brochette-goat', 6, { Side: ['Chips'] }], ['virunga', 6, {}], ['water-small', 2, {}]],
      tickets: { kitchen: 'queued', bar: 'queued' } },
    { key: 'r3', branch: 'rbv', type: 'takeaway', waiter: 'cashier2', at: ago(55), status: 'completed',
      lines: [['burger-chicken', 1, { 'Add on': ['Cheese'] }], ['tree-tomato', 1, { Size: ['Large'] }]],
      payments: [{ method: 'voucher', amount: 'rest', by: 'cashier2', shift: 'rbv-t-1', status: 'successful', at: ago(54) }],
      settledAt: ago(54), completedAt: ago(40) },
  ];
  // In time order, so a register is never open twice: yesterday's shifts open, their trade, they close;
  // then today's open and today's trade.
  const yesterday = SHIFTS.filter((x) => x.closed);
  const today = SHIFTS.filter((x) => !x.closed);
  const ordered = [...ORDERS.filter((x) => x.key.startsWith('y')), ...ORDERS.filter((x) => !x.key.startsWith('y'))];
  const written = [];
  await openShifts(yesterday);
  await writeMovements(yesterday.map((x) => x.key));
  for (const o of ordered.filter((x) => x.key.startsWith('y'))) written.push(await writeOrder(c, R, o));
  await closeShifts(yesterday);
  await openShifts(today);
  await writeMovements(today.map((x) => x.key));
  for (const o of ordered.filter((x) => !x.key.startsWith('y'))) written.push(await writeOrder(c, R, o));

  // Every payment amount above was written against the order's own total; prove it before committing.
  for (const [i, o] of ordered.entries()) {
    const collected = (o.payments ?? []).filter((p) => p.status === 'successful').reduce((a, p) => a + p.amount, 0);
    if (o.status === 'completed' && collected !== written[i].totalRwf) {
      throw new Error(`${o.key}: collected ${collected} but the bill is ${written[i].totalRwf}. Fix the seeded payment.`);
    }
    if (collected > written[i].totalRwf) throw new Error(`${o.key}: collected ${collected} over the bill of ${written[i].totalRwf}.`);
  }

  // The counters, so the next live order and ticket follow the seeded numbers instead of colliding with them.
  for (const [k, value] of counters) {
    const [kind, p] = [k.slice(0, k.lastIndexOf(':')), k.slice(k.lastIndexOf(':') + 1)];
    await c.query(
      `INSERT INTO pos_counters (workspace_id, kind, period, value) VALUES ($1, $2, $3, $4)
       ON CONFLICT (workspace_id, kind, period) DO UPDATE SET value = GREATEST(pos_counters.value, EXCLUDED.value)`,
      [WORKSPACE, kind, p, value],
    );
  }
  return ORDERS.length;
}

/** Every POS row of this group, in foreign key order. Never touches anything outside the workspace. */
async function wipeTrade(c) {
  const ws = [WORKSPACE];
  await c.query(`DELETE FROM pos_audit_events WHERE workspace_id = ANY($1)`, [ws]);
  await c.query(`DELETE FROM pos_refunds WHERE workspace_id = ANY($1)`, [ws]);
  await c.query(`DELETE FROM pos_payment_events WHERE payment_id IN (SELECT id FROM pos_payments WHERE workspace_id = ANY($1))`, [ws]);
  await c.query(`DELETE FROM pos_payments WHERE workspace_id = ANY($1)`, [ws]);
  await c.query(`DELETE FROM cash_movements WHERE workspace_id = ANY($1)`, [ws]);
  await c.query(`DELETE FROM cashier_shifts WHERE workspace_id = ANY($1)`, [ws]);
  await c.query(`DELETE FROM pos_print_jobs WHERE workspace_id = ANY($1)`, [ws]);
  await c.query(`DELETE FROM kitchen_tickets WHERE workspace_id = ANY($1)`, [ws]);
  await c.query(`DELETE FROM pos_order_discounts WHERE workspace_id = ANY($1)`, [ws]);
  await c.query(`DELETE FROM pos_orders WHERE workspace_id = ANY($1)`, [ws]);
  await c.query(`DELETE FROM table_sessions WHERE workspace_id = ANY($1)`, [ws]);
  await c.query(`DELETE FROM pos_counters WHERE workspace_id = ANY($1)`, [ws]);
  await c.query(`UPDATE restaurant_tables SET status = 'available' WHERE workspace_id = ANY($1)`, [ws]);
}

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('seed-demo-pos: DATABASE_URL is not set.');
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await assertSampleDatabase(client, 'seed-demo-pos.mjs');
  await client.query('BEGIN');
  try {
    await seedBusiness(client);
    await seedPeople(client);
    await seedOutletsAndMenu(client);
    if (RESET) await wipeTrade(client);
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM pos_orders WHERE workspace_id = $1`, [WORKSPACE]);
    const orders = rows[0].n === 0 ? await seedTrade(client) : 0;
    await client.query('COMMIT');
    const { rows: totals } = await client.query(
      `SELECT (SELECT count(*)::int FROM restaurant_tables WHERE workspace_id = $1) AS tables,
              (SELECT count(*)::int FROM service_items WHERE workspace_id = $1) AS items,
              (SELECT count(*)::int FROM pos_orders WHERE workspace_id = $1) AS orders,
              (SELECT count(*)::int FROM pos_payments WHERE workspace_id = $1) AS payments,
              (SELECT count(*)::int FROM cashier_shifts WHERE workspace_id = $1) AS shifts`,
      [WORKSPACE],
    );
    const t = totals[0];
    console.log(
      `POS: Ikirezi Bistro Group (demo), 2 branches, ${t.tables} tables, ${t.items} menu items, ${t.orders} orders, ` +
        `${t.payments} simulated payments, ${t.shifts} shifts${orders === 0 ? ' (trade kept; --reset to reseed it)' : ''}.`,
    );
    console.log(`Staff sign in with code 123456: ${STAFF.map((s) => s.email).join(', ')}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
} catch (error) {
  console.error(`seed-demo-pos: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
