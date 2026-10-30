#!/usr/bin/env node
/**
 * Everything a tester needs on a shared database, in one run (2026-10-30): the staff who review
 * businesses, an approved landlord business with its buildings, units, leases at every stage, months of
 * rent and expenses, a fault, a move-out notice, a broker on a Province plan with a placement, its fee
 * and a rating, the village, cell and district leaders and DGIE with their guests on both chains, three
 * stay businesses (a guest house, a lodge, serviced apartments) with a stay, and lease and placement
 * messages.
 *
 * The rows are the ones the product's own flows wrote on a laptop (`staging-seed/capture.mjs`), so every
 * domain rule they passed there they pass here: prorated first months, the notice period, the guest
 * route shapes, the check constraints. On top of them it adds what the laptop had no time for: six months
 * of history on an ended lease, expenses across those months, and a broker rating.
 *
 * People: each role's address comes from SEED_EMAILS (`landlord=a@b.c,tenant=...`), else
 * `kalisabelys+<role>@gmail.com`. An address that already has an account is that account: nothing new
 * is made for it, and its rows hang off it.
 *
 *   DATABASE_URL=... node scripts/seed-staging-all.mjs            seed (in one transaction)
 *   DATABASE_URL=... node scripts/seed-staging-all.mjs --dry-run  what would be written, nothing written
 *   DATABASE_URL=... node scripts/seed-staging-all.mjs --purge    delete only this script's rows
 *
 * Ids: every row is `5eed0000-0000-4000-8000-…`, so a second run writes nothing and `--purge` touches
 * nothing else. Files are NOT carried: unit photos, signed lease PDFs, receipts and ID scans stay on the
 * laptop's storage; their columns are empty, and the screens say a photo or a PDF is missing.
 *
 * Refuses a database without the sample marker, like every seed.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OWNED = '5eed0000-0000-4000-8000-%';
const ROLES = [
  'admin', 'field', 'approver', 'landlord', 'tenant', 'tenant2', 'tenant3', 'tenant4', 'tenant5', 'broker',
  'village', 'cell', 'district', 'dgievillage', 'dgiecell', 'dgiedistrict', 'guesthouse', 'lodge', 'apartments',
];

pg.types.setTypeParser(1082, (v) => v);

function emailsFrom(env) {
  const given = Object.fromEntries(
    (env ?? '')
      .split(',')
      .map((pair) => pair.split('=').map((x) => x.trim()))
      .filter(([k, v]) => k && v),
  );
  return Object.fromEntries(ROLES.map((r) => [r, (given[r] ?? `kalisabelys+${r}@gmail.com`).toLowerCase()]));
}

/** Fill `{{role}}` tokens with addresses, anywhere in a value. */
function fill(value, emails) {
  if (typeof value === 'string') return value.replace(/\{\{([a-z0-9]+)\}\}/g, (_, r) => emails[r] ?? `kalisabelys+${r}@gmail.com`);
  if (Array.isArray(value)) return value.map((v) => fill(v, emails));
  if (value && typeof value === 'object' && !value.$lookup) return JSON.parse(fill(JSON.stringify(value), emails));
  return value;
}

const ident = (n) => `"${n.replace(/"/g, '""')}"`;
const cast = (type) => (type.startsWith('_') ? `${type.slice(1)}[]` : type);

async function resolveLookups(client, tables) {
  const cache = new Map();
  for (const t of tables) {
    for (const row of t.rows) {
      for (const [k, v] of Object.entries(row)) {
        if (!v || typeof v !== 'object' || !v.$lookup) continue;
        const { table, key, value } = v.$lookup;
        const id = `${table}:${value}`;
        if (!cache.has(id)) {
          const found = await client.query(`select id from ${ident(table)} where ${ident(key)}::text = $1 order by 1 limit 1`, [String(value)]);
          if (!found.rows[0]) throw new Error(`This database has no ${table} with ${key} "${value}". Run its migrations and seed-reference first.`);
          cache.set(id, found.rows[0].id);
        }
        row[k] = cache.get(id);
      }
    }
  }
}

/** Accounts that already exist by address are used as they are: every reference to ours points at theirs. */
async function aliasUsers(client, tables) {
  const users = tables.find((t) => t.table === 'users');
  const alias = new Map();
  for (const u of users.rows) {
    const found = await client.query('select id from users where lower(email) = lower($1)', [u.email]);
    if (found.rows[0] && found.rows[0].id !== u.id) alias.set(u.id, found.rows[0].id);
  }
  if (alias.size === 0) return alias;
  for (const t of tables) {
    for (const row of t.rows) {
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === 'string' && alias.has(v)) row[k] = alias.get(v);
      }
    }
  }
  users.rows = users.rows.filter((u) => !alias.has(u.id) && ![...alias.values()].includes(u.id));
  return alias;
}

async function insertRow(client, t, row) {
  const cols = t.columns.filter((c) => !t.deferred.includes(c.name) && row[c.name] !== undefined);
  const values = cols.map((c) => {
    const v = row[c.name];
    return c.type === 'jsonb' || c.type === 'json' ? (v === null ? null : JSON.stringify(v)) : v;
  });
  const params = cols.map((c, i) => `$${i + 1}::${cast(c.type)}`);
  const res = await client.query(
    `insert into ${ident(t.table)} (${cols.map((c) => ident(c.name)).join(', ')}) values (${params.join(', ')}) on conflict do nothing`,
    values,
  );
  return res.rowCount ?? 0;
}

async function seed(client, data, emails, dryRun) {
  for (const t of data.tables) for (const row of t.rows) for (const k of Object.keys(row)) row[k] = fill(row[k], emails);
  await resolveLookups(client, data.tables);
  const alias = await aliasUsers(client, data.tables);
  if (alias.size) console.log(`  ${alias.size} of the addresses already have accounts: their rows hang off those.`);
  let written = 0;
  for (const t of data.tables) {
    if (dryRun) {
      const present = t.columns.some((c) => c.name === 'id')
        ? (await client.query(`select count(*)::int as n from ${ident(t.table)} where id = any($1::uuid[])`, [t.rows.map((r) => r.id)])).rows[0].n
        : 0;
      console.log(`  ${t.table}: ${t.rows.length} rows, ${t.rows.length - present} new`);
      continue;
    }
    let n = 0;
    for (const row of t.rows) n += await insertRow(client, t, row);
    written += n;
    if (n) console.log(`  ${t.table}: ${n} new`);
  }
  if (dryRun) return 0;
  // The second pass: foreign keys to rows inserted after their own.
  for (const t of data.tables) {
    for (const col of t.deferred) {
      const type = cast(t.columns.find((c) => c.name === col).type);
      for (const row of t.rows) {
        if (row[col] === null || row[col] === undefined) continue;
        await client.query(
          `update ${ident(t.table)} set ${ident(col)} = $1::${type} where id = $2::uuid and ${ident(col)} is null`,
          [row[col], row.id],
        );
      }
    }
  }
  written += await history(client, data);
  return written;
}

/**
 * Six months the laptop never lived: an ended lease from April to September with its rent charged on the
 * due day and paid each month, its deposit returned in full, expenses across those months, and the
 * landlord's rating of the broker. Built from the captured rows as templates, so every column the domain
 * fills is filled the way it fills it.
 */
async function history(client, data) {
  const t = (name) => data.tables.find((x) => x.table === name);
  const H = (family, n) => `5eed0000-0000-4000-8000-9${family}${String(n).padStart(9, '0')}`;
  const a = data.anchors;
  const ended = t('leases').rows.find((r) => r.status === 'ended');
  const unit = t('rental_units').rows.find((u) => !t('leases').rows.some((l) => l.unit_id === u.id && ['active', 'signed', 'pending_signature', 'ending'].includes(l.status)) && u.workspace_id === a.residenceWorkspace);
  const tenant = t('tenants').rows.find((x) => x.id === ended?.tenant_id);
  const rentT = t('lease_charges').rows.find((r) => r.kind === 'rent');
  const payT = t('lease_payments').rows.find((r) => r.status === 'succeeded');
  const allocT = t('lease_payment_allocations').rows[0];
  const expT = t('expenses').rows[0];
  if (!ended || !unit || !tenant || !rentT || !payT || !allocT || !expT) {
    console.log('  history: no template rows, skipped');
    return 0;
  }
  const lease = H('10', 1);
  const rent = 250_000;
  const months = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
  const lastDay = (m) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate();
  const rows = [];
  const broker = t('brokers').rows[0];
  rows.push(['leases', {
    ...ended,
    id: lease,
    // The broker brought this tenant: the placement fee was paid, and the landlord rated them.
    broker_id: broker?.id ?? null,
    reference: 'L-H001',
    unit_id: unit.id,
    property_id: unit.property_id,
    monthly_rent_rwf: String(rent),
    deposit_rwf: String(rent * 2),
    start_date: '2026-04-01',
    billing_starts_on: '2026-04-01',
    end_date: '2026-09-30',
    ended_on: '2026-09-30',
    end_reason: 'Lease ran to its end date.',
    current_version_id: null,
    supersedes_lease_id: null,
    placement_id: null,
    broker_id: null,
    signed_at: '2026-03-25T09:00:00Z',
    activated_at: '2026-04-01T08:00:00Z',
    ending_since: '2026-08-30T08:00:00Z',
    created_at: '2026-03-20T09:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
  }]);
  months.forEach((m, i) => {
    const charge = H('11', i + 1);
    const payment = H('12', i + 1);
    const due = `${m}-05`;
    const paidOn = `${m}-0${3 + (i % 5)}`;
    rows.push(['lease_charges', {
      ...rentT,
      id: charge,
      lease_id: lease,
      kind: 'rent',
      period_start: `${m}-01`,
      period_end: `${m}-${lastDay(m)}`,
      due_on: due,
      amount_rwf: String(rent),
      paid_rwf: String(rent),
      status: 'paid',
      paid_at: `${paidOn}T10:00:00Z`,
      idempotency_key: `${lease}:rent:${m}`,
      created_at: `${m}-01T06:00:00Z`,
      updated_at: `${paidOn}T10:00:00Z`,
    }]);
    rows.push(['lease_payments', {
      ...payT,
      id: payment,
      lease_id: lease,
      tenant_id: tenant.id,
      property_id: unit.property_id,
      amount_rwf: String(rent),
      method: i % 2 ? 'airtel_money' : 'mtn_momo',
      status: 'succeeded',
      channel: 'gateway',
      succeeded_at: `${paidOn}T10:00:00Z`,
      created_at: `${paidOn}T09:58:00Z`,
      updated_at: `${paidOn}T10:00:00Z`,
      expires_at: `${paidOn}T10:08:00Z`,
      idempotency_key: `${lease}:rent-collect:${m}`,
      adapter_ref: `mock_rent_collect_history_${m}`,
      receipt_number: `R-2026-H${String(i + 1).padStart(3, '0')}`,
      requested_charge_ids: [charge],
      payout_id: null,
      rent_charge_id: null,
    }]);
    rows.push(['lease_payment_allocations', {
      ...allocT,
      id: H('13', i + 1),
      payment_id: payment,
      charge_id: charge,
      amount_rwf: String(rent),
      created_at: `${paidOn}T10:00:00Z`,
    }]);
    rows.push(['expenses', {
      ...expT,
      id: H('14', i + 1),
      unit_id: i % 2 ? unit.id : null,
      ticket_id: null,
      payout_id: null,
      category: ['cleaning', 'repairs', 'utilities', 'security', 'repairs', 'cleaning'][i],
      amount_rwf: String([40_000, 85_000, 32_000, 60_000, 120_000, 40_000][i]),
      paid_on: `${m}-15`,
      payee_name: ['Umutoni Cleaning', 'Eric (plumber)', 'REG electricity', 'Night guard', 'Roof repair', 'Umutoni Cleaning'][i],
      note: 'Recorded for the building',
      created_at: `${m}-15T12:00:00Z`,
      updated_at: `${m}-15T12:00:00Z`,
    }]);
  });
  const feeT = t('placement_fees').rows[0];
  if (broker && feeT) {
    rows.push(['placement_fees', {
      ...feeT,
      id: H('16', 1),
      lease_id: lease,
      broker_id: broker.id,
      amount_rwf: String(rent / 2),
      fee_kind: 'percent',
      percent: 50,
      status: 'disbursed',
      payout_id: null,
      disbursed_at: '2026-04-10T09:00:00Z',
      disbursed_by_user_id: a.users.landlord ?? null,
      created_at: '2026-03-25T09:00:00Z',
      updated_at: '2026-04-10T09:00:00Z',
    }]);
  }
  let n = 0;
  for (const [table, row] of rows) {
    const tt = t(table);
    try {
      n += await insertRow(client, { ...tt, deferred: [] }, row);
    } catch (error) {
      throw new Error(`history ${table}: ${error.message}`);
    }
  }
  // The broker's rating by the landlord, on the lease the broker placed.
  const placed = broker ? { id: lease, broker_id: broker.id } : null;
  if (placed && a.users.landlord) {
    const landlord = (await client.query('select id from users where id = $1 or lower(email) = lower($2) limit 1', [a.users.landlord, data.landlordEmail ?? ''])).rows[0]?.id ?? a.users.landlord;
    const r = await client.query(
      `insert into broker_ratings (id, broker_id, lease_id, rater_user_id, rater_role, stars, comment)
       values ($1, $2, $3, $4, 'landlord', 5, 'Brought a reliable tenant quickly.') on conflict do nothing`,
      [H('15', 1), placed.broker_id, placed.id, landlord],
    );
    n += r.rowCount ?? 0;
  }
  if (n) console.log(`  history: ${n} new (an ended April to September lease, its rent, expenses, a rating)`);
  return n;
}

async function purge(client, data) {
  const extra = ['broker_ratings'];
  for (const table of extra) await client.query(`delete from ${ident(table)} where id::text like $1`, [OWNED]);
  // Second-pass references first, so rows that point at each other can go.
  for (const t of data.tables) {
    for (const col of t.deferred) {
      await client.query(`update ${ident(t.table)} set ${ident(col)} = null where id::text like $1`, [OWNED]);
    }
  }
  for (const t of [...data.tables].reverse()) {
    const key = t.columns.some((c) => c.name === 'id') ? 'id' : t.columns[0].name;
    const res = await client.query(`delete from ${ident(t.table)} where ${ident(key)}::text like $1`, [OWNED]);
    if (res.rowCount) console.log(`  ${t.table}: ${res.rowCount} deleted`);
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL required');
  const data = JSON.parse(readFileSync(path.join(here, 'staging-seed', 'data.json'), 'utf8'));
  const emails = emailsFrom(process.env.SEED_EMAILS);
  data.landlordEmail = emails.landlord;
  const dryRun = process.argv.includes('--dry-run');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await assertSampleDatabase(client, 'seed-staging-all.mjs');
    await client.query('begin');
    if (process.argv.includes('--purge')) {
      console.log('Removing the staging seed…');
      await purge(client, data);
    } else {
      console.log(dryRun ? 'Dry run: nothing is written.' : 'Seeding the whole product…');
      console.log(`  people: ${ROLES.map((r) => `${r} ${emails[r]}`).join(', ')}`);
      const n = await seed(client, data, emails, dryRun);
      if (!dryRun) console.log(n ? `Done: ${n} rows written.` : 'Done: everything was already there.');
    }
    await client.query(dryRun ? 'rollback' : 'commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
