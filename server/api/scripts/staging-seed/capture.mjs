#!/usr/bin/env node
/**
 * Capture the local stack's tested data into `data.json` for `seed-staging-all.mjs` (2026-10-30).
 *
 * A DEVELOPER tool, run against the LOCAL Docker database only, after the product was walked through
 * its real flows (registration, leases, payments, faults, guests, stays). It copies the rows those flows
 * wrote for one residence business, its people, its broker, the local leaders and DGIE, and the three
 * stay businesses of `seed-stays.mjs`, then:
 *
 * - gives every row a new id in the `5eed0000-…` family, deterministically, so a second seed is a no-op;
 * - replaces each person's email with a role token (`{{landlord}}`), which the seed fills from SEED_EMAILS;
 * - refers to reference rows that each database mints itself (broker plans, registration fees, rate
 *   plan templates) by their natural key, never by a local id;
 * - leaves out what must not travel: sessions, one-time codes, invitation tokens, audit and outbox rows,
 *   and stored files (photos, signed PDFs): every column that points at `stored_objects` is emptied.
 *
 *   DATABASE_URL=postgres://injishi:injishi@127.0.0.1:5434/injishi node scripts/staging-seed/capture.mjs
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));

// Days stay days (`2026-11-05`), never a midnight in the laptop's zone.
pg.types.setTypeParser(1082, (v) => v);

const UUID_IN_TEXT = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Local accounts and the role each becomes (SEED_EMAILS keys). Anyone else referenced is an error. */
const ROLES = {
  'admin@injishi.test': 'admin',
  'field.officer@injishi.test': 'field',
  'approver.officer@injishi.test': 'approver',
  'amani.landlord@injishi.test': 'landlord',
  'tenant@injishi.test': 'tenant',
  'tenant2@injishi.test': 'tenant2',
  'tenant3@injishi.test': 'tenant3',
  'tenant4@injishi.test': 'tenant4',
  'tenant5@injishi.test': 'tenant5',
  'broker@injishi.test': 'broker',
  'leader@injishi.test': 'village',
  'cell.executive@injishi.test': 'cell',
  'district.officer@injishi.test': 'district',
  'dgie.village@injishi.test': 'dgievillage',
  'dgie.cell@injishi.test': 'dgiecell',
  'dgie.district@injishi.test': 'dgiedistrict',
  'guesthouse.owner@injishi.test': 'guesthouse',
  'lodge.owner@injishi.test': 'lodge',
  'apartments.owner@injishi.test': 'apartments',
};

const RESIDENCE_ORG_NAME = 'Amani Residences';
const STAY_ORG_LIKE = '5e5a0000-0000-4000-8000-01%';

/** Reference tables each database fills itself: a uuid pointing at one is written as its natural key. */
const LOOKUPS = { broker_plans: 'code', registration_fees: 'business_type' };

/**
 * What is copied, in insert order, and which rows. `$U` is the people, `$O` the orgs, `$W` their
 * workspaces (business and personal), filled in as the capture goes.
 */
const TABLES = [
  ['users', 'id = any($U)'],
  ['user_profiles', 'user_id = any($U)'],
  ['user_roles', 'user_id = any($U) and revoked_at is null'],
  ['admin_users', 'user_id = any($U) and revoked_at is null'],
  ['verified_identities', 'user_id = any($U)'],
  ['orgs', 'id = any($O)'],
  ['workspaces', '(org_id = any($O)) or (user_id = any($U) and kind in (\'personal\', \'broker\'))'],
  ['org_memberships', 'org_id = any($O) and user_id = any($U)'],
  ['org_registration_events', 'org_id = any($O)'],
  ['org_registration_reviews', 'org_id = any($O)'],
  ['oversight_assignments', 'user_id = any($U) and revoked_at is null'],
  ['landlord_profiles', 'org_id = any($O)'],
  ['payout_accounts', 'org_id = any($O)'],
  ['properties', 'org_id = any($O)'],
  ['property_blocks', 'workspace_id = any($W)'],
  ['rental_units', 'workspace_id = any($W)'],
  ['brokers', 'user_id = any($U)'],
  ['broker_subscriptions', 'broker_id in (select id from brokers where user_id = any($U))'],
  ['subscription_invoices', 'org_id = any($O) or subscription_id in (select s.id from broker_subscriptions s join brokers b on b.id = s.broker_id where b.user_id = any($U))'],
  ['broker_subscription_payments', 'broker_id in (select id from brokers where user_id = any($U))'],
  ['broker_registration_payments', 'user_id = any($U)'],
  ['tenants', 'org_id = any($O)'],
  ['listings', 'workspace_id = any($W)'],
  ['room_types', 'workspace_id = any($W)'],
  ['rooms', 'workspace_id = any($W)'],
  ['rate_plans', 'workspace_id = any($W)'],
  ['date_overrides', 'room_type_id in (select id from room_types where workspace_id = any($W))'],
  ['departments', 'workspace_id = any($W)'],
  ['tenant_placements', 'landlord_org_id = any($O)'],
  ['leases', 'org_id = any($O)'],
  ['lease_contract_versions', 'lease_id in (select id from leases where org_id = any($O))'],
  ['lease_signatures', 'lease_id in (select id from leases where org_id = any($O))'],
  ['lease_events', 'workspace_id = any($W)'],
  ['lease_charges', 'lease_id in (select id from leases where org_id = any($O))'],
  ['payouts', 'workspace_id = any($W)'],
  ['lease_payments', 'workspace_id = any($W)'],
  ['lease_payment_allocations', 'payment_id in (select id from lease_payments where workspace_id = any($W))'],
  ['lease_deposits', 'workspace_id = any($W)'],
  ['lease_reminders', 'workspace_id = any($W)'],
  ['lease_filings', 'lease_id in (select id from leases where org_id = any($O))'],
  ['placement_fees', 'workspace_id = any($W)'],
  ['contact_reveals', 'landlord_org_id = any($O)'],
  ['maintenance_tickets', 'workspace_id = any($W)'],
  ['maintenance_events', 'ticket_id in (select id from maintenance_tickets where workspace_id = any($W))'],
  ['maintenance_payouts', 'workspace_id = any($W)'],
  ['expenses', 'workspace_id = any($W)'],
  ['move_out_notices', 'lease_id in (select id from leases where org_id = any($O))'],
  ['threads', 'workspace_id = any($W)'],
  ['messages', 'thread_id in (select id from threads where workspace_id = any($W))'],
  ['guest_stays', 'workspace_id = any($W)'],
  ['stay_identities', 'guest_stay_id in (select id from guest_stays where workspace_id = any($W))'],
  ['folios', 'workspace_id = any($W)'],
  ['folio_charges', 'workspace_id = any($W)'],
  ['guest_registrations', 'workspace_id = any($W)'],
  ['guest_registration_routes', 'registration_id in (select id from guest_registrations where workspace_id = any($W))'],
];

/** Columns never copied: secrets and things a fresh database must mint itself. */
const DROP_COLUMNS = new Set(['users.image']);

const pad = (n, w) => String(n).padStart(w, '0');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || /102\.202\.|staging|injishi\.com/.test(url)) {
    throw new Error('Run the capture against the LOCAL database only (DATABASE_URL on 127.0.0.1).');
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const users = (await client.query('select id, email from users where lower(email) = any($1)', [Object.keys(ROLES)])).rows;
    const U = users.map((u) => u.id);
    const role = Object.fromEntries(users.map((u) => [u.id, ROLES[u.email.toLowerCase()]]));
    const O = (
      await client.query(`select id from orgs where legal_name = $1 or id::text like $2`, [RESIDENCE_ORG_NAME, STAY_ORG_LIKE])
    ).rows.map((r) => r.id);
    const W = (
      await client.query(`select id from workspaces where org_id = any($1) or (user_id = any($2) and kind in ('personal', 'broker'))`, [O, U])
    ).rows.map((r) => r.id);

    // Columns, their types, which are generated, and the foreign keys of every captured table.
    const names = TABLES.map(([t]) => t);
    const columns = (
      await client.query(
        `select table_name, column_name, data_type, udt_name, is_nullable, is_generated, column_default
           from information_schema.columns where table_schema = 'public' and table_name = any($1)
          order by table_name, ordinal_position`,
        [names],
      )
    ).rows;
    const fks = (
      await client.query(
        `select tc.table_name, kcu.column_name, ccu.table_name as ref, ccu.column_name as ref_column
           from information_schema.table_constraints tc
           join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
           join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
          where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public' and tc.table_name = any($1)`,
        [names],
      )
    ).rows;
    const fkOf = new Map(fks.map((f) => [`${f.table_name}.${f.column_name}`, f]));

    // Rows, table by table.
    const rows = {};
    for (const [table, where] of TABLES) {
      const q = where.replaceAll('$U', '$1').replaceAll('$O', '$2').replaceAll('$W', '$3');
      const used = [where.includes('$U'), where.includes('$O'), where.includes('$W')];
      const params = [U, O, W];
      // Postgres wants every numbered parameter it is given to appear; pass the three always.
      rows[table] = (
        await client.query(
          `select * from ${table} where (${q}) and cardinality($1::uuid[]) >= 0 and cardinality($2::uuid[]) >= 0 and cardinality($3::uuid[]) >= 0 order by 1`,
          params,
        )
      ).rows;
      void used;
    }

    // New ids: the family, then the table's place in the order, then a counter.
    const idMap = new Map();
    TABLES.forEach(([table], ti) => {
      const pk = columns.find((c) => c.table_name === table && c.column_name === 'id');
      if (!pk || pk.data_type !== 'uuid') return;
      rows[table].forEach((r, i) => idMap.set(r.id, `5eed0000-0000-4000-8000-${pad(ti, 3)}${pad(i + 1, 9)}`));
    });

    // Natural keys of the reference rows a captured row points at.
    const lookup = new Map();
    for (const [table, key] of Object.entries(LOOKUPS)) {
      for (const r of (await client.query(`select id, ${key} as k from ${table}`)).rows) lookup.set(r.id, { table, key, value: r.k });
    }

    // Ids and people's addresses written inside text (keys, references, JSON) follow the rows they name.
    const emails = Object.entries(ROLES);
    const scrub = (text) => {
      let t = text.replace(UUID_IN_TEXT, (m) => idMap.get(m.toLowerCase()) ?? m);
      for (const [email, r] of emails) t = t.split(email).join(`{{${r}}}`);
      return t;
    };

    const out = { capturedAt: new Date().toISOString(), anchors: {}, tables: [] };
    // Named rows the seed's additions hang off (a history lease, a rating, the broker's plan).
    const residence = (await client.query('select id from orgs where legal_name = $1', [RESIDENCE_ORG_NAME])).rows[0]?.id;
    out.anchors = {
      residenceOrg: idMap.get(residence),
      residenceWorkspace: idMap.get(
        (await client.query(`select id from workspaces where org_id = $1 and kind = 'business'`, [residence])).rows[0]?.id,
      ),
      residenceProperty: idMap.get((await client.query('select id from properties where org_id = $1 limit 1', [residence])).rows[0]?.id),
      users: Object.fromEntries(users.map((u) => [role[u.id], idMap.get(u.id)])),
    };
    const unmapped = new Set();
    for (const [table] of TABLES) {
      const cols = columns.filter((c) => c.table_name === table && c.is_generated !== 'ALWAYS' && !DROP_COLUMNS.has(`${table}.${c.column_name}`));
      const cooked = rows[table].map((r) => {
        const row = {};
        for (const c of cols) {
          let v = r[c.column_name];
          const fk = fkOf.get(`${table}.${c.column_name}`);
          if (v !== null && v !== undefined && (c.data_type === 'uuid' || c.udt_name === 'uuid')) {
            if (fk?.ref === 'stored_objects') v = null;
            else if (idMap.has(v)) v = idMap.get(v);
            else if (lookup.has(v)) v = { $lookup: lookup.get(v) };
            else if (fk) {
              if (c.is_nullable === 'YES') v = null;
              else unmapped.add(`${table}.${c.column_name} -> ${fk.ref} ${v}`);
            }
          }
          if (table === 'users' && c.column_name === 'email') v = `{{${role[r.id]}}}`;
          else if (typeof v === 'string') v = scrub(v);
          else if (Array.isArray(v)) v = v.map((x) => (typeof x === 'string' ? (idMap.get(x) ?? scrub(x)) : x));
          else if (v && typeof v === 'object' && !(v instanceof Date) && !v.$lookup) v = JSON.parse(scrub(JSON.stringify(v)));
          if (v instanceof Date) v = v.toISOString();
          row[c.column_name] = v;
        }
        return row;
      });
      out.tables.push({
        table,
        columns: cols.map((c) => ({ name: c.column_name, type: c.udt_name })),
        // A foreign key to a table inserted later (or to itself) is written in a second pass.
        deferred: cols
          .filter((c) => {
            const fk = fkOf.get(`${table}.${c.column_name}`);
            if (!fk || !idMap.size) return false;
            const at = names.indexOf(fk.ref);
            return at >= names.indexOf(table) && c.is_nullable === 'YES';
          })
          .map((c) => c.column_name),
        rows: cooked,
      });
    }
    // The broker works on the Province plan (Kigali City): what the tester is told to expect.
    const subs = out.tables.find((t) => t.table === 'broker_subscriptions');
    for (const sub of subs?.rows ?? []) {
      if (sub.status === 'active') {
        sub.plan_id = { $lookup: { table: 'broker_plans', key: 'code', value: 'province' } };
        sub.scope_province_id = 1;
        sub.next_plan_id = null;
        sub.next_scope_province_id = null;
      }
    }

    if (unmapped.size > 0) {
      console.error('Rows point at rows that are not captured and cannot be emptied:');
      for (const u of unmapped) console.error(`  ${u}`);
      process.exitCode = 1;
    }
    const file = path.join(here, 'data.json');
    writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`);
    console.log(`Captured ${out.tables.reduce((n, t) => n + t.rows.length, 0)} rows from ${out.tables.length} tables into ${file}`);
    for (const t of out.tables) if (t.rows.length) console.log(`  ${t.table} ${t.rows.length}${t.deferred.length ? ` (later: ${t.deferred.join(', ')})` : ''}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
