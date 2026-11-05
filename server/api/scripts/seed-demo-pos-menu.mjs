#!/usr/bin/env node
/**
 * Tops up the POS demo for the presentation (POS spec sections 7, 8 and 13). Run it AFTER
 * `seed-demo-pos.mjs`; it adds, never replaces:
 *
 *   1. The menu categories the demo lacked: Wine, Spirits, Cocktails and Other services, with items,
 *      at both outlets (Kimihurura and Rubavu). Drinks go to the bar station; services print no ticket.
 *   2. Stock tracking for the drinks (beer, soft drinks, water, wine, spirits), with a few LOW items and
 *      one OUT item so the alerts have something to show. Only items whose `stock_qty` is still null are
 *      switched on, so a rerun never overwrites a balance that sales or counts have moved.
 *   3. A week of demo expenses, so the profit and loss has costs to subtract.
 *
 * Idempotent: ids are derived from keys and every insert is `ON CONFLICT DO NOTHING`.
 * Refuses any database that is not marked sample (ADR-043). It never touches orders, payments or shifts.
 *
 *   DATABASE_URL=postgres://... node scripts/seed-demo-pos-menu.mjs
 */
import { createHash } from 'node:crypto';
import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';

const BLOCK = 'de300000-0000-4000-8000-0b05';
const id = (key) => `${BLOCK}${createHash('sha256').update(key).digest('hex').slice(0, 8)}`;

// The same ids `seed-demo-pos.mjs` derived: the Ikirezi group, its two branches and their outlets.
const ORG = id('org');
const WORKSPACE = id('workspace');
const BRANCH = { kgl: id('property:kimihurura'), rbv: id('property:rubavu') };
const OUTLET = { kgl: id('outlet:kimihurura'), rbv: id('outlet:rubavu') };
const STATION_BAR = { kgl: id('station:kgl:bar'), rbv: id('station:rbv:bar') };
const OWNER = id('user:owner');

const DRINK = '1110170400';
const FOOD = '1110160600'; // the only other classification the demo's reference data carries

/** [key, name, priceRwf, stock (null = not tracked), description] */
const NEW_MENU = [
  {
    key: 'wine', name: 'Wine', sort: 90, cls: DRINK, type: '2', station: true, prep: 2,
    items: [
      ['red-glass', 'House red wine, glass', 4500, 36, 'South African Cabernet Sauvignon.'],
      ['red-bottle', 'House red wine, bottle', 18000, 14, 'A 75 cl bottle.'],
      ['white-glass', 'House white wine, glass', 4500, 30, 'Chenin Blanc, served chilled.'],
      ['white-bottle', 'House white wine, bottle', 18000, 9, 'A 75 cl bottle.'],
      ['rose-bottle', 'Rosé, bottle', 20000, 6, 'A 75 cl bottle, served chilled.'],
      ['sparkling', 'Sparkling wine, bottle', 28000, 0, 'A 75 cl bottle.'],
    ],
  },
  {
    key: 'spirits', name: 'Spirits', sort: 100, cls: DRINK, type: '2', station: true, prep: 2,
    items: [
      ['whisky', 'Whisky, tot', 3500, 48, 'A 25 ml measure.'],
      ['vodka', 'Vodka, tot', 3000, 52, 'A 25 ml measure.'],
      ['gin', 'Gin, tot', 3000, 7, 'A 25 ml measure.'],
      ['rum', 'Dark rum, tot', 3000, 40, 'A 25 ml measure.'],
      ['cognac', 'Cognac, tot', 6000, 24, 'A 25 ml measure.'],
      ['amarula', 'Amarula, tot', 3500, 30, 'A 25 ml measure.'],
    ],
  },
  {
    key: 'cocktails', name: 'Cocktails', sort: 110, cls: DRINK, type: '2', station: true, prep: 6,
    items: [
      ['mojito', 'Mojito', 6000, null, 'Rum, mint, lime and soda.'],
      ['pina-colada', 'Piña colada', 6500, null, 'Rum, coconut and pineapple.'],
      ['long-island', 'Long Island iced tea', 8000, null, 'Five spirits and cola.'],
      ['caipirinha', 'Passion fruit caipirinha', 6500, null, 'Cachaça, passion fruit and lime.'],
      ['sunrise', 'Tequila sunrise', 6500, null, 'Tequila, orange and grenadine.'],
    ],
  },
  {
    key: 'services', name: 'Other services', sort: 120, cls: FOOD, type: '3', station: false, prep: 0,
    items: [
      ['corkage', 'Corkage fee', 5000, null, 'For a bottle brought in.'],
      ['cake', 'Cake cutting', 3000, null, 'Cutting and plating a birthday cake.'],
      ['delivery', 'Delivery fee', 2000, null, 'Within Kigali.'],
      ['room-hire', 'Private room hire, per hour', 30000, null, 'The private dining room.'],
      ['setup', 'Birthday set-up', 15000, null, 'Table decoration and a small banner.'],
    ],
  },
];

/** Balances for items that already exist, by name. Anything not listed is given a comfortable stock. */
const STOCK_OVERRIDES = {
  'Primus, 72 cl': 8, // low
  'Mützig, 50 cl': 5, // low
  'Still water, 50 cl': 0, // out
};
const COMFORTABLE = (name) => 18 + (createHash('sha256').update(name).digest()[0] % 40); // 18 to 57

const TRACKED_CATEGORIES = ['Beer', 'Water', 'Juices and soft drinks'];

/** [key, daysAgo, category, amountRwf, method, payee, note] */
const EXPENSES = [
  ['electricity', 1, 'utilities', 24000, 'bank', 'REG (electricity)', 'DEMO: electricity, Kimihurura.'],
  ['cleaning', 1, 'cleaning', 8500, 'cash', 'Clean Kigali Supplies', 'DEMO: cleaning products and mops.'],
  ['fridge', 3, 'repairs', 15000, 'momo', 'Kigali Cooling Services', 'DEMO: repair of the bar fridge.'],
  ['security', 4, 'security', 18000, 'bank', 'Umutekano Guards Ltd', 'DEMO: night guard, weekly.'],
  ['water-bill', 2, 'utilities', 6000, 'bank', 'WASAC', 'DEMO: water bill.'],
];

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('seed-demo-pos-menu: DATABASE_URL is required.');
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await assertSampleDatabase(client, 'seed-demo-pos-menu.mjs');
  await client.query('BEGIN');

  const added = { categories: 0, items: 0, routes: 0, tracked: 0, expenses: 0 };
  for (const b of ['kgl', 'rbv']) {
    const outlet = await client.query('SELECT id FROM outlets WHERE id = $1', [OUTLET[b]]);
    if (outlet.rowCount === 0) throw new Error(`The demo outlet ${b} is missing: run seed-demo-pos.mjs first.`);
    const dept = (await client.query(
      `SELECT id FROM departments WHERE property_id = $1 AND department_category = 'fnb' LIMIT 1`, [BRANCH[b]],
    )).rows[0]?.id;
    if (!dept) throw new Error(`No Food and Beverage department at ${b}.`);

    for (const cat of NEW_MENU) {
      const categoryId = id(`category:${b}:${cat.key}`);
      const r = await client.query(
        `INSERT INTO service_categories (id, department_id, outlet_id, property_id, workspace_id, name, sort_order, guest_visible,
                                         default_rra_item_cls_cd, default_rra_item_ty_cd, default_rra_pkg_unit_cd, default_rra_qty_unit_cd, default_tax_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9, 'NT', 'U', 'TAX_B') ON CONFLICT (id) DO NOTHING`,
        [categoryId, dept, OUTLET[b], BRANCH[b], WORKSPACE, cat.name, cat.sort, cat.cls, cat.type],
      );
      added.categories += r.rowCount ?? 0;
      for (const [key, name, price, stock, description] of cat.items) {
        const itemId = id(`item:${b}:${cat.key}:${key}`);
        const sku = `RW${cat.type}NTU${String(Math.abs(parseInt(itemId.slice(-8), 16)) % 10_000_000).padStart(7, '0')}`;
        const ins = await client.query(
          `INSERT INTO service_items (id, service_category_id, department_id, outlet_id, property_id, workspace_id, name, description,
                                      price_rwf, tax_code, fulfillment_type, prep_time_minutes, options, guest_orderable, status, stock_qty,
                                      rra_item_cls_cd, rra_item_ty_cd, rra_item_cd, rra_pkg_unit_cd, rra_qty_unit_cd)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'TAX_B', 'onsite', $10, '[]'::jsonb, false, $11, $12, $13, $14, $15, 'NT', 'U')
           ON CONFLICT (id) DO NOTHING`,
          [itemId, categoryId, dept, OUTLET[b], BRANCH[b], WORKSPACE, name, description, price, cat.prep,
            stock === 0 ? 'out_of_stock' : 'active', stock, cat.cls, cat.type, sku],
        );
        added.items += ins.rowCount ?? 0;
        if (ins.rowCount && cat.station) {
          const route = await client.query(
            `INSERT INTO pos_item_routes (service_item_id, workspace_id, station_id) VALUES ($1, $2, $3) ON CONFLICT (service_item_id) DO NOTHING`,
            [itemId, WORKSPACE, STATION_BAR[b]],
          );
          added.routes += route.rowCount ?? 0;
        }
      }
    }

    // Switch stock tracking on for the existing drinks, only where it is still off.
    const existing = await client.query(
      `SELECT i.id, i.name FROM service_items i JOIN service_categories c ON c.id = i.service_category_id
        WHERE i.outlet_id = $1 AND i.stock_qty IS NULL AND c.name = ANY($2::text[])`,
      [OUTLET[b], TRACKED_CATEGORIES],
    );
    for (const row of existing.rows) {
      const qty = STOCK_OVERRIDES[row.name] ?? COMFORTABLE(row.name);
      const r = await client.query(
        `UPDATE service_items SET stock_qty = $2, status = CASE WHEN $2 = 0 THEN 'out_of_stock'::service_catalog_status ELSE status END, updated_at = now()
          WHERE id = $1 AND stock_qty IS NULL`,
        [row.id, qty],
      );
      added.tracked += r.rowCount ?? 0;
    }
  }

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date());
  for (const [key, daysAgo, category, amount, method, payee, note] of EXPENSES) {
    const paidOn = new Date(new Date(`${today}T12:00:00+02:00`).getTime() - daysAgo * 86_400_000);
    const r = await client.query(
      `INSERT INTO expenses (id, org_id, workspace_id, category, amount_rwf, currency, paid_on, method, payee_name, note, source, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, 'RWF', $6, $7, $8, $9, 'recorded', $10) ON CONFLICT (id) DO NOTHING`,
      [id(`expense:${key}`), ORG, WORKSPACE, category, amount,
        new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(paidOn), method, payee, note, OWNER],
    );
    added.expenses += r.rowCount ?? 0;
  }

  await client.query('COMMIT');
  console.log('seed-demo-pos-menu: added', JSON.stringify(added), '(a rerun adds nothing more)');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('seed-demo-pos-menu: rolled back.', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
