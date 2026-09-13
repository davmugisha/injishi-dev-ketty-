#!/usr/bin/env node
/**
 * Load RRA's item classification list into `rra_item_classifications`
 * (ADR-050 D-m, slice 3 task 16).
 *
 * The one writer of that table. Nothing edits it by hand, because a code a
 * person typed in is a receipt line the Authority refuses.
 *
 *   RRA_CLASSIFICATION_SOURCE=path/to/list.json node scripts/sync-rra-classifications.mjs [--full]
 *
 * THE SOURCE is a file in v1 (the catalog child's Configuration), in the shape
 * the VSDC itself answers `/itemClass/selectItemsClass` with (§3.3.2.2):
 * `{ "data": { "itemClsList": [{ itemClsCd, itemClsNm, itemClsLvl, useYn }] } }`,
 * or that list on its own. Saving the device's answer is therefore the whole
 * export step, and pointing this at the Authority's endpoint later changes how
 * the file is fetched, not how it is read.
 *
 * WHAT IT DOES. Upserts every code, refreshing its name, level, `active`
 * (`useYn = "Y"`) and `synced_at`. The VSDC call is incremental (it takes a
 * `lastReqDt`), so by default a code missing from the file is left alone.
 * `--full` says the file IS the whole list, and marks every code missing from it
 * inactive. A code is never deleted: an item sold under it last month still
 * names it, and a receipt that cannot be re-read is worse than a stale row.
 * `parent_code` is not in the device's answer and is left as it is.
 *
 * A `*.sample.json` source is sample data, and is refused unless the database
 * carries the sample marker, so the VSDC specification's example codes can never
 * land in a database that holds real businesses.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import pg from 'pg';

import { assertSampleDatabase, describeDatabase } from './sample-database.mjs';

function fail(message) {
  console.error(`sync-rra-classifications: ${message}`);
  process.exit(1);
}

const url = process.env.DATABASE_URL?.trim();
if (!url) fail('DATABASE_URL is not set.');
const source = process.env.RRA_CLASSIFICATION_SOURCE?.trim();
if (!source) fail('RRA_CLASSIFICATION_SOURCE is not set. Point it at the saved selectItemsClass answer.');
const full = process.argv.includes('--full');

let parsed;
try {
  parsed = JSON.parse(readFileSync(source, 'utf8'));
} catch (error) {
  fail(`could not read ${source}: ${error instanceof Error ? error.message : String(error)}`);
}
const list = Array.isArray(parsed) ? parsed : parsed?.data?.itemClsList;
if (!Array.isArray(list)) fail(`${source} holds neither a list nor data.itemClsList.`);

/** Refuse the whole file on one bad row: a half loaded list is harder to notice than none. */
const rows = list.map((entry, i) => {
  const code = typeof entry?.itemClsCd === 'string' ? entry.itemClsCd.trim() : '';
  const name = typeof entry?.itemClsNm === 'string' ? entry.itemClsNm.replace(/\s+/g, ' ').trim() : '';
  const level = Number(entry?.itemClsLvl);
  // itemClsCd is CHAR, digits in every value the specification prints.
  if (!/^\d{1,200}$/.test(code)) fail(`row ${i}: itemClsCd ${JSON.stringify(entry?.itemClsCd)} is not a code.`);
  if (!name) fail(`row ${i} (${code}): itemClsNm is empty.`);
  if (!Number.isInteger(level) || level < 1) fail(`row ${i} (${code}): itemClsLvl is not a level.`);
  return { code, name, level, active: entry?.useYn !== 'N' };
});
if (new Set(rows.map((r) => r.code)).size !== rows.length) fail(`${source} names a code twice.`);

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  if (path.basename(source).includes('.sample.')) {
    await assertSampleDatabase(client, 'sync-rra-classifications.mjs (a sample source)');
  }

  await client.query('BEGIN');
  for (const row of rows) {
    await client.query(
      `INSERT INTO rra_item_classifications (code, name, level, active, synced_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (code) DO UPDATE
         SET name = EXCLUDED.name, level = EXCLUDED.level,
             active = EXCLUDED.active, synced_at = EXCLUDED.synced_at`,
      [row.code, row.name, row.level, row.active],
    );
  }
  let retired = 0;
  if (full) {
    const result = await client.query(
      `UPDATE rra_item_classifications SET active = false, synced_at = now()
        WHERE active AND NOT (code = ANY($1::text[]))`,
      [rows.map((r) => r.code)],
    );
    retired = result.rowCount ?? 0;
  }
  await client.query('COMMIT');

  console.log(
    `Loaded ${rows.length} classification code(s) from ${path.basename(source)} into ${describeDatabase(url)}` +
      (full ? `; ${retired} code(s) missing from the full list marked inactive.` : '.'),
  );
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await client.end().catch(() => {});
}
