// Seed the five geography reference tables (provinces -> districts -> sectors
// -> cells -> villages) into Postgres from the MySQL geography dump.
//
// Idempotent: ON CONFLICT (id) DO NOTHING. Run with DATABASE_URL set:
//   pnpm --filter @injishi/api exec node scripts/seed-geography.mjs
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// The geography dump sits beside this script, inside the same repository that
// reads it. One canonical path, no fallback. Keeping it here is what lets the
// published `injishi` repo run this seed standalone: a path reaching into
// `injishi.context` resolves only in the combined dev workspace, never in the
// split repo.
const SQL_PATH = resolve(__dirname, 'rw_geography.sql');

if (!existsSync(SQL_PATH)) {
  console.error(`Geography dump not found at ${SQL_PATH}`);
  process.exit(1);
}

/** Parse MySQL INSERT tuples starting right after the VALUES keyword; stops at
 *  the top-level ';'. Handles quoted strings, \-escapes, and NULL. */
function parseTuples(text, startIdx) {
  const rows = [];
  let i = startIdx;
  const n = text.length;
  while (i < n) {
    // advance to the next tuple's '(' or bail at the statement terminator
    while (i < n && text[i] !== '(' && text[i] !== ';') i++;
    if (i >= n || text[i] === ';') break;
    i++; // skip '('
    const fields = [];
    let cur = '';
    let inStr = false;
    for (; i < n; i++) {
      const c = text[i];
      if (inStr) {
        if (c === '\\') {
          cur += text[i + 1];
          i++;
        } else if (c === "'") {
          inStr = false;
        } else {
          cur += c;
        }
      } else if (c === "'") {
        inStr = true;
      } else if (c === ',') {
        fields.push(cur.trim());
        cur = '';
      } else if (c === ')') {
        fields.push(cur.trim());
        break;
      } else {
        cur += c;
      }
    }
    rows.push(fields.map((f) => (f === 'NULL' ? null : f)));
  }
  return rows;
}

/** Collect all rows for `INSERT INTO \`table\` ... VALUES` blocks (may repeat). */
function extractRows(sql, table) {
  const re = new RegExp('INSERT INTO `' + table + '`[^)]*\\)\\s*VALUES', 'g');
  const rows = [];
  let m;
  while ((m = re.exec(sql)) !== null) {
    rows.push(...parseTuples(sql, m.index + m[0].length));
  }
  return rows;
}

async function insertBatch(client, table, cols, rows) {
  if (rows.length === 0) return 0;
  const CHUNK = 1000;
  let inserted = 0;
  for (let start = 0; start < rows.length; start += CHUNK) {
    const slice = rows.slice(start, start + CHUNK);
    const params = [];
    const tuples = slice.map((row) => {
      const ph = cols.map((_, c) => `$${params.length + c + 1}`);
      params.push(...cols.map((_, c) => row[c]));
      return `(${ph.join(',')})`;
    });
    const res = await client.query(
      `INSERT INTO "${table}" (${cols.join(',')}) VALUES ${tuples.join(',')} ON CONFLICT (id) DO NOTHING`,
      params,
    );
    inserted += res.rowCount;
  }
  return inserted;
}

/**
 * Loads the five geography tables into an open client, idempotently, and returns rows per table.
 * Geography is reference data (Rwanda's administrative divisions), so the production reference seed
 * (`seed-reference.mjs`) calls this too; only running THIS file directly demands a sample database.
 */
export async function seedGeography(client, log = console.log) {
  const sql = readFileSync(SQL_PATH, 'utf8');
  const plan = [
    ['provinces', ['id', 'name'], extractRows(sql, 'provinces')],
    ['districts', ['id', 'name', 'province_id'], extractRows(sql, 'districts')],
    ['sectors', ['id', 'name', 'district_id'], extractRows(sql, 'sectors')],
    ['cells', ['id', 'name', 'sector_id'], extractRows(sql, 'cells')],
    ['villages', ['id', 'name', 'cell_id'], extractRows(sql, 'villages')],
  ];
  const totals = {};
  for (const [table, cols, rows] of plan) {
    const inserted = await insertBatch(client, table, cols, rows);
    const { rows: cnt } = await client.query(`SELECT count(*)::int AS n FROM "${table}"`);
    totals[table] = cnt[0].n;
    log(
      `${table.padEnd(10)} parsed=${String(rows.length).padStart(6)}  inserted=${String(inserted).padStart(6)}  total=${cnt[0].n}`,
    );
  }
  return totals;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  // ADR-043: run on its own, this is a step of the sample recipe, so it keeps the sample guard.
  await assertSampleDatabase(client, 'seed-geography.mjs');
  try {
    await seedGeography(client);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
