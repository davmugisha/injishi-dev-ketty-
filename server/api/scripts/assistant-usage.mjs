#!/usr/bin/env node
/**
 * The support assistant's usage for one month (ADR-061 D-s): model requests,
 * tokens, estimated cost, how answers were produced (direct, by the model, or
 * a fallback), how turns ended, model calls per turn, and tool use. The same report as `GET /api/v1/admin/assistant/usage`.
 *
 * READ ONLY. It runs three SELECTs and writes nothing.
 *
 * The SQL, the report and the pricing come from
 * `src/modules/assistant/infrastructure/usage-queries.ts` and
 * `src/modules/assistant/domain/usage.ts`, the files the API itself uses, so
 * the two can never price or count a month differently. A month is a UTC
 * calendar month, as the provider bills; unset means the current one.
 *
 * Environment, read from the process and then from server/api/.env:
 *   DATABASE_URL                      the database to read
 *   ASSISTANT_PRICE_*_PER_MTOK_USD    the prices, defaulting as the API does
 *
 *   node scripts/assistant-usage.mjs            # this month
 *   node scripts/assistant-usage.mjs 2026-10    # a given month
 *   node scripts/assistant-usage.mjs 2026-10 --json
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');
const monthArg = args.find((a) => !a.startsWith('--'));

/** A value from the environment, else from server/api/.env, else undefined. */
function setting(name) {
  if (process.env[name] !== undefined) return process.env[name];
  const envFile = path.join(here, '..', '.env');
  if (!existsSync(envFile)) return undefined;
  const line = readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim() : undefined;
}

/**
 * One of the API's own modules: the TypeScript source under Node's type
 * stripping on a laptop, the compiled copy where only `dist/` is trusted.
 */
async function load(...segments) {
  const source = path.join(here, '..', 'src', ...segments) + '.ts';
  const compiled = path.join(here, '..', 'dist', ...segments) + '.js';
  if (existsSync(source)) {
    try {
      return await import(pathToFileURL(source).href);
    } catch (error) {
      if (!existsSync(compiled)) throw error;
    }
  }
  return createRequire(import.meta.url)(compiled);
}

const usd = (n) => `$${n.toFixed(n !== 0 && n < 0.01 ? 6 : 2)}`;
const int = (n) => n.toLocaleString('en-US');

function print(report) {
  console.log(`Support assistant usage, ${report.month} (UTC, ${report.from} to ${report.to})`);
  console.log('');
  console.log(`  Model requests        ${int(report.modelRequests)}`);
  console.log(`  Input tokens          ${int(report.tokens.input)}`);
  console.log(`  Output tokens         ${int(report.tokens.output)}`);
  console.log(`  Cache read tokens     ${int(report.tokens.cacheRead)}`);
  console.log(`  Cache write tokens    ${int(report.tokens.cacheWrite)}`);
  console.log(`  Estimated cost        ${usd(report.estimatedCostUsd)}`);
  console.log('');
  const a = report.answers;
  console.log(`  Answers               ${int(a.total)} (direct ${int(a.direct)}, by the model ${int(a.ai)}, fallback ${int(a.fallback)})`);
  const t = report.turns;
  const outcomes = Object.entries(t.byOutcome).filter(([, n]) => n > 0).map(([o, n]) => `${o} ${int(n)}`).join(', ');
  console.log(`  Turns                 ${int(t.total)}${outcomes ? ` (${outcomes})` : ''}`);
  const m = t.modelCallsPerModelTurn;
  console.log(`  Model calls per model answered turn: one ${int(m.one)}, two ${int(m.two)}, three or more ${int(m.threeOrMore)}`);
  console.log(`  Model turns answered from gathered data alone (router rule candidates): ${int(t.modelTurnsWithoutOwnToolCalls)}`);
  if (t.tools.length > 0) console.log(`  Tools run             ${t.tools.map((x) => `${x.tool} ${int(x.runs)}`).join(', ')}`);
  for (const [title, rows, key] of [
    ['By request type', report.byRequestType, 'requestType'],
    ['By caller role', report.byCallerRole, 'callerRole'],
    ['By model', report.byModel, 'model'],
  ]) {
    if (rows.length === 0) continue;
    console.log('');
    console.log(`  ${title}`);
    for (const row of rows) {
      console.log(`    ${String(row[key]).padEnd(22)}${int(row.modelRequests).padStart(8)} requests  ${usd(row.estimatedCostUsd)}`);
    }
  }
  const p = report.prices;
  console.log('');
  console.log(
    `  Priced at US$ per million tokens: input ${p.inputPerMTokUsd}, output ${p.outputPerMTokUsd}, ` +
      `cache read ${p.cacheReadPerMTokUsd}, cache write ${p.cacheWritePerMTokUsd}. An estimate, not an invoice.`,
  );
}

async function main() {
  const queries = await load('modules', 'assistant', 'infrastructure', 'usage-queries');
  const pricing = await load('modules', 'assistant', 'domain', 'usage');
  const month = monthArg ?? queries.monthOf(new Date());
  queries.monthRange(month); // refuses anything but YYYY-MM, before connecting
  const prices = pricing.pricesFrom(Object.fromEntries(Object.values(pricing.PRICE_VARIABLES).map((name) => [name, setting(name)])));

  const databaseUrl = setting('DATABASE_URL');
  if (!databaseUrl) throw new Error('DATABASE_URL is not set.');
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const usage = await pool.query(queries.monthUsage(month).text, queries.monthUsage(month).values);
    const turns = await pool.query(queries.monthTurns(month).text, queries.monthTurns(month).values);
    const tools = await pool.query(queries.monthTools(month).text, queries.monthTools(month).values);
    const report = queries.buildUsageReport({ month, prices, usage: usage.rows, turns: turns.rows, tools: tools.rows });
    if (JSON_OUT) console.log(JSON.stringify(report, null, 2));
    else print(report);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
