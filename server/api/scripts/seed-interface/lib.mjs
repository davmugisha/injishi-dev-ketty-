/**
 * Shared helpers for the interface demo seed (`seed-interface.mjs`).
 *
 * IDS. Every row this seed writes has an id under `1e000000-`, derived from what the row IS
 * (`iid('room', 'isangano:204')`), never from a counter. So a re run finds the same rows, a fixture
 * that names a record by its human reference resolves to the same uuid wherever it is mentioned,
 * and `1e000000-` marks a row as interface seed data the way `de300000-` marks the older demo.
 *
 * DATES. The fixtures were drawn on a prototype day, Monday 12 October 2026 ("TODAY = 12").
 * The seed moves that day to the day it runs, in Africa/Kigali, so the screens look current: a
 * fixture's "12 Oct" is today, "14 Oct" is in two days, "4 Mar 2024" stays where it is.
 * `DEMO_SEED_NOW` (an ISO instant) stands in for "now", as it does for the other demo seeds.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** The id prefix of every interface seed row. */
export const INTERFACE_ID_PREFIX = '1e000000-';

/** A stable uuid for one seeded thing: `iid('user', 'owner')`. */
export function iid(kind, key) {
  const h = createHash('sha256').update(`${kind}:${key}`).digest('hex');
  return `1e000000-${h.slice(0, 4)}-4${h.slice(4, 7)}-8${h.slice(7, 10)}-${h.slice(10, 22)}`;
}

/** The prototype day the fixtures were drawn on. */
export const FIXTURE_TODAY = '2026-10-12';

const SEED_NOW = process.env.DEMO_SEED_NOW ? new Date(process.env.DEMO_SEED_NOW) : new Date();
if (Number.isNaN(SEED_NOW.getTime())) throw new Error(`DEMO_SEED_NOW is not an ISO instant: ${process.env.DEMO_SEED_NOW}`);

/** Today in Kigali, as YYYY-MM-DD. */
export function kigaliToday(now = SEED_NOW) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kigali',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export const TODAY = kigaliToday();

/** A Kigali calendar day `offset` days from today, as YYYY-MM-DD. */
export function day(offset = 0) {
  const d = new Date(`${TODAY}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Whole days from the fixture's prototype day to an ISO date (negative before it). */
function offsetFromFixtureDay(iso) {
  return Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${FIXTURE_TODAY}T12:00:00Z`)) / 86_400_000);
}

/**
 * A fixture date moved onto the seed's calendar. Dates within 120 days of the prototype day move
 * with it (they are "this week" in the story); anything older is history and stays put.
 */
export function shiftDate(iso) {
  const offset = offsetFromFixtureDay(iso);
  return Math.abs(offset) <= 120 ? day(offset) : iso;
}

/** An instant at a Kigali clock time on a day relative to today: `kigaliAt('08:40')`, `kigaliAt('15:30', -1)`. */
export function kigaliAt(time, offset = 0) {
  return new Date(`${day(offset)}T${time.length === 5 ? `${time}:00` : time}+02:00`);
}

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

/** "4 Mar 2024" → "2024-03-04"; "12 Oct" → the prototype year. Throws on anything else. */
export function parseFixtureDate(text) {
  const m = String(text).trim().match(/^(\d{1,2}) ([A-Z][a-z]{2})(?: (\d{4}))?$/);
  if (!m || !MONTHS[m[2]]) throw new Error(`not a fixture date: "${text}"`);
  const year = m[3] ?? FIXTURE_TODAY.slice(0, 4);
  return `${year}-${String(MONTHS[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** The fixture snapshot `export-interface-fixtures.mjs` writes. */
export function loadFixtures() {
  const raw = JSON.parse(readFileSync(path.join(here, 'fixtures.generated.json'), 'utf8'));
  const personas = Object.fromEntries(raw.personas.map((p) => [p.id, p]));
  return {
    personas,
    /** All documents of a collection; throws on a name the snapshot does not hold. */
    fx(name) {
      const docs = raw.collections[name];
      if (!docs) throw new Error(`fixture collection "${name}" is not in the snapshot`);
      return docs;
    },
  };
}

/** The user id of a persona ("owner", "frontdesk", …). */
export const userId = (personaId) => iid('user', personaId);

export async function districtId(c, name) {
  const { rows } = await c.query('SELECT id FROM districts WHERE lower(name) = lower($1) LIMIT 1', [name]);
  if (rows.length === 0) throw new Error(`District not found: ${name}. Run seed-geography.mjs first.`);
  return rows[0].id;
}

export async function sectorId(c, district, sector) {
  const { rows } = await c.query(
    `SELECT s.id FROM sectors s JOIN districts d ON d.id = s.district_id
      WHERE lower(s.name) = lower($1) AND lower(d.name) = lower($2) LIMIT 1`,
    [sector, district],
  );
  if (rows.length === 0) throw new Error(`Sector not found: ${sector} in ${district}`);
  return rows[0].id;
}

/** Counts rows by table for the given ids, so a run can report what it wrote. */
export async function countRows(c, table, column, ids) {
  const { rows } = await c.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${column} = ANY($1::uuid[])`, [ids]);
  return rows[0].n;
}
