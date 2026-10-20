#!/usr/bin/env node
/**
 * Accounts for every data collection of an area: each one that is not static configuration must be LIVE
 * (a source in src/server/sources/<area>.ts) or DEFERRED with a reason in the data map
 * (`"deferred": "<why>"` on its row in packages/data/src/data-map.json). Nothing is left quietly on fixtures.
 *
 *   node apps/app/scripts/area-done.mjs --area people [--area staff]
 *
 * Prints per collection where it stands, then "AREA ACCOUNTED <areas> live=<n> deferred=<n> static=<n>" only
 * when every collection is accounted for. A deferral is an honest "not yet", never completion: the report
 * counts it separately.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(app, "../..");
const areas = [];
for (let i = 2; i < process.argv.length; i++) if (process.argv[i] === "--area") areas.push(process.argv[++i]);
if (areas.length === 0) {
  console.error("usage: area-done.mjs --area <area> [--area <area>]");
  process.exit(2);
}

const map = JSON.parse(readFileSync(path.join(repo, "packages/data/src/data-map.json"), "utf8"));
const live = new Set();
for (const file of readdirSync(path.join(app, "src/server/sources")).filter((f) => f.endsWith(".ts"))) {
  const text = readFileSync(path.join(app, "src/server/sources", file), "utf8");
  for (const m of text.matchAll(/^\s*"([a-z]+\.[A-Za-z0-9]+)"\s*:/gm)) live.add(m[1]);
}

const problems = [];
const tally = { live: 0, deferred: 0, static: 0 };
for (const row of map.filter((r) => areas.includes(r.area))) {
  if (live.has(row.collection)) {
    tally.live++;
    console.log(`  live      ${row.collection}`);
  } else if (row.class === "static") {
    tally.static++;
  } else if (typeof row.deferred === "string" && row.deferred.trim().length >= 12) {
    tally.deferred++;
    console.log(`  deferred  ${row.collection}: ${row.deferred}`);
  } else {
    problems.push(`${row.collection} (${row.class}) is neither live nor deferred with a reason`);
  }
}
for (const p of problems) console.error(`PROBLEM ${p}`);
if (problems.length) process.exit(1);
console.log(`AREA ACCOUNTED ${areas.join(",")} live=${tally.live} deferred=${tally.deferred} static=${tally.static}`);
