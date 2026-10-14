/**
 * Parity: on a freshly seeded demo database, each live collection must hand its screen the same
 * documents the fixtures did, now read from Postgres through the API.
 *
 *   pnpm --filter @injishi/app exec tsx scripts/verify-data.ts --area platform [--only a.b,c.d]
 *
 * For every live source in the area it signs in as each persona whose screen reads the collection
 * and checks, against the fixture collection the source replaced:
 *   - the same number of documents;
 *   - the same documents, matched on the source's `naturalKey` (ids differ: fixture slugs vs uuids);
 *   - every key the fixtures always carry, with a value of the same kind (string, number, boolean,
 *     array, object; null where a fixture has null).
 * Prints "DATA PARITY OK <n> collections" only when all of them hold. Seed first:
 * `node server/api/scripts/seed-interface.mjs`.
 */
import type { PersonaId } from "@injishi/data";
import type { Doc } from "@injishi/data/types";
import { liveSources } from "../src/server/sources/index";
import { check, contextFor, fail, fixtures, main, readersOf } from "./lib/harness";

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

const kind = (v: unknown) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);

function compare(collection: string, live: Doc[], fixture: Doc[], naturalKey: string | undefined): string[] {
  const problems: string[] = [];
  if (live.length !== fixture.length) problems.push(`${live.length} documents, the fixtures have ${fixture.length}`);
  const key = naturalKey ?? "id";
  const names = (docs: Doc[]) => docs.map((d) => String((d as Record<string, unknown>)[key])).sort();
  const want = names(fixture);
  const got = names(live);
  const missing = want.filter((n) => !got.includes(n));
  const extra = got.filter((n) => !want.includes(n));
  if (missing.length) problems.push(`missing ${key}: ${missing.join(", ")}`);
  if (extra.length) problems.push(`unexpected ${key}: ${extra.join(", ")}`);
  // Keys every fixture document carries, and the kinds of value they take.
  const required = Object.keys(fixture[0] ?? {}).filter((k) => fixture.every((d) => k in d));
  for (const k of required) {
    const kinds = new Set(fixture.map((d) => kind((d as Record<string, unknown>)[k])));
    for (const d of live) {
      const v = (d as Record<string, unknown>)[k];
      if (!(k in d)) {
        problems.push(`a document lacks "${k}"`);
        break;
      }
      if (!kinds.has(kind(v))) {
        problems.push(`"${k}" is ${kind(v)}, the fixtures hold ${[...kinds].join("/")}`);
        break;
      }
    }
  }
  return problems.map((p) => `${collection}: ${p}`);
}

void main(async () => {
  const area = arg("--area");
  const only = arg("--only")?.split(",").filter(Boolean) ?? null;
  const names = Object.keys(liveSources)
    .filter((n) => (area ? n.startsWith(`${area}.`) : true))
    .filter((n) => (only ? only.includes(n) : true))
    .sort();
  check(names.length > 0, `no live sources match area=${area ?? "*"} only=${only?.join(",") ?? "*"}`);
  const problems: string[] = [];
  for (const name of names) {
    const source = liveSources[name];
    const readers = readersOf(name);
    const personas = [...new Set(readers.map((r) => r.persona))] as (PersonaId | null)[];
    check(personas.length > 0, `${name} has a live source but no page reads it`);
    for (const persona of personas) {
      const ctx = await contextFor(persona);
      let live: Doc[];
      try {
        live = await source.list(ctx);
      } catch (error) {
        fail(`${name} as ${persona ?? "anonymous"}: ${error instanceof Error ? error.message : String(error)}`);
      }
      const found = compare(name, live, fixtures(name), source.naturalKey);
      console.log(`  ${found.length ? "✗" : "✓"} ${name} as ${persona ?? "anonymous"}: ${live.length} documents`);
      problems.push(...found.map((p) => `${p} (as ${persona ?? "anonymous"})`));
    }
  }
  if (problems.length) fail(`\n  ${problems.join("\n  ")}`);
  return `DATA PARITY OK ${names.length} collections`;
});
