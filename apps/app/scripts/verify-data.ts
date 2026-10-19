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
 * A source declaring `parity: "shape"` (documents keyed by real dates) is held to the count and the shape only.
 * Prints "DATA PARITY OK <n> collections" only when all of them hold. Seed first:
 * `node server/api/scripts/seed-interface.mjs`.
 */
import type { PersonaId } from "@injishi/data";
import type { Doc } from "@injishi/data/types";
import { kigaliToday, sourceContextFor } from "../src/server/sources/context";
import { liveSources } from "../src/server/sources/index";
import type { SourceContext } from "../src/server/sources/types";
import { check, cookieFor, fail, fixtures, main, readersOf } from "./lib/harness";

/**
 * The fixtures are a snapshot of the prototype day at 12:20 in Kigali (the operations board's clock,
 * `NOW` in features/operations/shared.tsx; its events are stamped 12:20). The seed moves that day onto its
 * own day (DEMO_SEED_NOW when set, else today), so every context here takes "now" as that day at 12:20.
 * Time-of-day facts (absent once a shift has started, minutes left) then compare at any hour. "today" is
 * the same Kigali day either way.
 */
const FIXTURE_CLOCK = "12:20";
function fixtureMoment(): Date {
  const seedNow = process.env.DEMO_SEED_NOW ? new Date(process.env.DEMO_SEED_NOW) : new Date();
  return new Date(`${kigaliToday(seedNow).iso}T${FIXTURE_CLOCK}:00+02:00`);
}

/** The context a page gets when this persona is signed in, with its clock at the fixtures' moment. */
async function contextFor(persona: PersonaId | null): Promise<SourceContext> {
  return sourceContextFor(persona ? await cookieFor(persona) : null, fixtureMoment());
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

const kind = (v: unknown) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);

function compare(
  collection: string,
  live: Doc[],
  fixture: Doc[],
  naturalKey: string | undefined,
  parity: "identity" | "shape" = "identity",
): string[] {
  const problems: string[] = [];
  if (live.length !== fixture.length) problems.push(`${live.length} documents, the fixtures have ${fixture.length}`);
  if (parity === "shape") return [...problems, ...shapeProblems(live, fixture)].map((p) => `${collection}: ${p}`);
  const key = naturalKey ?? "id";
  const names = (docs: Doc[]) => docs.map((d) => String((d as Record<string, unknown>)[key])).sort();
  const want = names(fixture);
  const got = names(live);
  const missing = want.filter((n) => !got.includes(n));
  const extra = got.filter((n) => !want.includes(n));
  if (missing.length) problems.push(`missing ${key}: ${missing.join(", ")}`);
  if (extra.length) problems.push(`unexpected ${key}: ${extra.join(", ")}`);
  problems.push(...shapeProblems(live, fixture));
  return problems.map((p) => `${collection}: ${p}`);
}

/** Keys every fixture document carries, and the kinds of value they take. */
function shapeProblems(live: Doc[], fixture: Doc[]): string[] {
  const problems: string[] = [];
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
  return problems;
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
    if (source.accountParityPersona && personas.includes(null)) {
      const anonymous = await source.list(await contextFor(null));
      check(anonymous.length === 0, `${name}: anonymous account data must be exactly []`);
      console.log(`  ✓ ${name} as anonymous: no account data disclosed`);
      personas.splice(personas.indexOf(null), 1, source.accountParityPersona);
    }
    check(personas.length > 0, `${name} has a live source but no page reads it`);
    for (const persona of personas) {
      const ctx = await contextFor(persona);
      let live: Doc[];
      try {
        live = await source.list(ctx);
      } catch (error) {
        fail(`${name} as ${persona ?? "anonymous"}: ${error instanceof Error ? error.message : String(error)}`);
      }
      const found = compare(name, live, fixtures(name), source.naturalKey, source.parity);
      console.log(`  ${found.length ? "✗" : "✓"} ${name} as ${persona ?? "anonymous"}: ${live.length} documents`);
      problems.push(...found.map((p) => `${p} (as ${persona ?? "anonymous"})`));
    }
  }
  console.log(`  (read as of ${fixtureMoment().toISOString()}, the fixtures' 12:20 in Kigali on the seed day)`);
  if (problems.length) fail(`\n  ${problems.join("\n  ")}`);
  return `DATA PARITY OK ${names.length} collections`;
});
