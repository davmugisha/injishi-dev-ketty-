// Seed the marketplace catalogue as real database rows (C3, leaf 1.1.1).
//
//   rdb_classifications → orgs → workspaces → properties → room_types
//                              → rate_plans → rooms → listings
//
// ## Why this script exists
//
// `apps/web/src/data/properties.ts` is a hand-maintained fixture of thirty
// accommodations. Until now NONE of them existed behind the API, so the
// property page had no room to sell and `/book` said "not open for online
// booking yet" for every one of them. The single seeded room in
// `seed-content.mjs` (Umurage Guesthouse) was lent to all thirty by
// `apps/web/src/data/demo-listing.ts` whenever `NEXT_PUBLIC_DEMO_LISTING=1`,
// which meant opening checkout from "Copperleaf Grand Hotel" reserved a room in
// a guesthouse in Kacyiru. This script replaces that loan with inventory each
// property owns, and `demo-listing.ts` is retired in the same change.
//
// ## THE ROWS THIS WRITES ARE MARKED DEMO DATA, EVERY ONE OF THEM
//
// EVERY BUSINESS HERE IS FICTIONAL (2026-09-14). Thirty of these rows used to
// carry the names, street addresses and coordinates of real, operating Rwandan
// businesses, marked "not the real business". The demo publishes a sign in
// code and anyone can book these rooms, so a disclaimer was not enough: they
// were renamed to invented businesses (the web fixture `data/properties.ts`
// changed in the same commit), their addresses cut to the neighbourhood and
// their coordinates dropped. Do not add a real business back.
//
// The marking stays in the DATABASE itself rather than only in this comment:
//
//  1. `properties.name` ends in ` (demo)`, and that is the string the API
//     returns and the checkout screen renders.
//  2. `properties.description` opens with `DEMO SAMPLE DATA`, says
//     `FICTIONAL BUSINESS` and `SYNTHETIC RATE`.
//  3. `orgs.legal_name` ends in ` (Injishi demo seed — a fictional business)`.
//  4. `orgs.tin` is drawn from a reserved `999......` block, so none can collide
//     with a real taxpayer.
//  5. `orgs.tourism_license_number` is `DEMO-SEED-nnnn`, not a licence number.
//  6. `properties.address_text` and `house_rules` are prefixed `DEMO SAMPLE`.
//  7. Every row's PRIMARY KEY begins `de300000-`, the reserved uuid namespace
//     this script owns, which is what makes the marking checkable in one query
//     and `--reset` exact:
//
//        select id, name from properties where id::text like 'de300000-%';
//
// No photograph is attached; gallery images stay in the web fixture.
//
// ## The rates are invented, all fifty-two
//
// Every figure is a demo rate, so every row carries the three rate markers:
// `SYNTHETIC RATE` in the description, a rate plan named `Flexible (demo rate —
// not published by the business)`, and a room type name ending ` (demo rate)`,
// which is the marker that reaches the checkout screen. The three arrays below
// keep their historical split only because `index` is part of every id; the
// split no longer means anything about where a name or a rate came from.
//
// The price the card shows and the price checkout charges are the same figure:
// both fixtures carry the number this script seeds.
//
// Each property gets ONE room type, at that rate. The one exception is Sunbird
// Bay Hotel, which is seeded with a three room ladder (Superior, Family, Suite) — which is also what
// makes "the catalogue points at the CHEAPEST room type" a real choice rather
// than a tautology.
//
// A per person, per night rate (the gorilla and Akagera lodges) is seeded as
// the per night rate for the room. The platform prices per unit per night and
// has no per person basis, so the basis travels in the description instead of
// being silently multiplied.
//
// ## Ids, idempotency and reset
//
// IDs are deterministic (never `gen_random_uuid`) so the web fixture can point
// at them without a generated file and so a re-run is a no-op. Content rows are
// written `on conflict (id) do update`, so editing the table below and
// re-running RECONCILES the database rather than leaving it silently stale;
// `listings` is `do nothing` on the row itself so `published_at` does not walk
// forward on every run.
//
// One limit of that reconciliation, stated so nobody trips over it: GROWING a
// `roomCount` adds `rooms` rows on the next run, but SHRINKING one leaves the
// surplus units behind, because a `rooms` row can already carry a stay, a
// housekeeping task or an assignment and this script will not guess which are
// safe to drop. Use `--reset` when a room count has to come down.
//
// `--reset` deletes exactly the `de300000-` rows, in foreign key order, and
// refuses when a booking already points at one of them: dropping inventory out
// from under a booking is worse than leaving the seed in place.
//
// Run with (from `injishi/`, the pnpm workspace root — NOT the outer dev shell,
// which has no package.json):
//   pnpm --filter @injishi/api exec node scripts/seed-demo-catalogue.mjs
//   pnpm --filter @injishi/api exec node scripts/seed-demo-catalogue.mjs --reset
//
// or, from `injishi/server/api`, plain `node scripts/seed-demo-catalogue.mjs`.
// Either way the target is DATABASE_URL from the environment, falling back to
// `server/api/.env`, so the script always seeds the database the API serves.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';
import { syntheticCoordFor } from './synthetic-coords.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RESET = process.argv.includes('--reset');

/**
 * The uuid namespace this script owns, and the ONLY rows it may delete.
 *
 * Every seeded id is `de300000-<four digit property index>-4000-8000-<tail>`,
 * so one `like` predicate finds the whole seed and cannot reach a row written
 * by `seed-content.mjs` (`0f9a1b00-`) or by a person.
 */
const ID_PREFIX = 'de300000';

/** Tails, so the shape of every id is declared in one place. */
const TAIL = {
  org: '000000000001',
  workspace: '000000000002',
  property: '000000000003',
  listing: '000000000004',
  roomType: (n) => `0000000001${String(n).padStart(2, '0')}`,
  ratePlan: (n) => `0000000002${String(n).padStart(2, '0')}`,
  room: (n) => `0000000003${String(n).padStart(2, '0')}`,
};

function idFor(index, tail) {
  return `${ID_PREFIX}-${String(index).padStart(4, '0')}-4000-8000-${tail}`;
}

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(resolve(__dirname, '../.env'), 'utf8');
  // The FIRST uncommented assignment wins. `.env` keeps the retired Neon url on
  // a commented line below the live one, and a `#` prefix must not be read as a
  // setting.
  const m = env.match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error('DATABASE_URL not set and not found in server/api/.env');
  return m[1].trim();
}

/**
 * The first thirty stays, part one (indexes 1 to 20).
 *
 * These used to be real businesses with published rates; every one is now a
 * fictional business at a demo rate (see the header). The name is historical.
 *
 * `index` is fixed forever: it is the middle group of every id this row owns,
 * so REORDERING THIS ARRAY IS SAFE but renumbering it is not.
 *
 * `district` is the Rwandan district the neighbourhood sits in. `roomCount` is
 * capped at six units per room type: a demo depth, enough to book against.
 */
const SOURCED_RATE_CATALOGUE = [
  {
    index: 1,
    slug: 'amberhill-convention-hotel',
    name: 'Amberhill Convention Hotel',
    accommodationClass: 'hotel',
    starGrade: 5,
    district: 'Gasabo',
    address: 'Kimihurura, Kigali',
    latitude: null,
    longitude: null,
    basis: 'per room, per night',
    roomTypes: [{ name: 'Standard Room', rateRwf: 187_500, capacity: 2, roomCount: 6 }],
  },
  {
    index: 2,
    slug: 'copperleaf-grand-hotel',
    name: 'Copperleaf Grand Hotel',
    accommodationClass: 'hotel',
    starGrade: 5,
    district: 'Nyarugenge',
    address: 'Nyarugenge, Kigali',
    latitude: null,
    longitude: null,
    basis: 'per room, per night',
    roomTypes: [{ name: 'Standard Room', rateRwf: 233_000, capacity: 2, roomCount: 4 }],
  },
  {
    index: 3,
    slug: 'lanternhouse-hotel-kiyovu',
    name: 'Lanternhouse Hotel Kiyovu',
    accommodationClass: 'hotel',
    starGrade: 5,
    district: 'Nyarugenge',
    address: 'Kiyovu, Kigali',
    latitude: null,
    longitude: null,
    basis: 'per room, per night',
    roomTypes: [{ name: 'Standard Room', rateRwf: 196_000, capacity: 2, roomCount: 6 }],
  },
  {
    index: 4,
    slug: 'hotel-des-sept-sentiers',
    name: 'Hôtel des Sept Sentiers',
    accommodationClass: 'hotel',
    starGrade: null,
    district: 'Nyarugenge',
    address: 'Kiyovu, Kigali',
    latitude: null,
    longitude: null,
    basis: 'per room, per night',
    roomTypes: [{ name: 'Standard Room', rateRwf: 200_500, capacity: 2, roomCount: 6 }],
  },
  {
    index: 5,
    slug: 'juniper-yard-hotel',
    name: 'Juniper Yard Hotel',
    accommodationClass: 'hotel',
    starGrade: 4,
    district: 'Nyarugenge',
    address: 'Kiyovu, Kigali',
    latitude: null,
    longitude: null,
    basis: 'per room, per night',
    roomTypes: [{ name: 'Standard Room', rateRwf: 127_000, capacity: 2, roomCount: 4 }],
  },
  {
    index: 6,
    slug: 'bluefinch-hotel-remera',
    name: 'Bluefinch Hotel Remera',
    accommodationClass: 'hotel',
    starGrade: 4,
    district: 'Gasabo',
    address: 'Remera, Kigali',
    latitude: null,
    longitude: null,
    basis: 'per room, per night',
    roomTypes: [{ name: 'Standard Room', rateRwf: 166_500, capacity: 2, roomCount: 4 }],
  },
  {
    index: 7,
    slug: 'fairway-crest-hotel',
    name: 'Fairway Crest Hotel',
    accommodationClass: 'hotel',
    starGrade: 4,
    district: 'Gasabo',
    address: 'Nyarutarama, Kigali',
    latitude: null,
    longitude: null,
    basis: 'per room, per night',
    roomTypes: [{ name: 'Standard Room', rateRwf: 132_500, capacity: 2, roomCount: 4 }],
  },
  {
    index: 8,
    slug: 'villa-marigold-kacyiru',
    name: 'Villa Marigold Kacyiru',
    accommodationClass: 'hotel',
    starGrade: 3,
    district: 'Gasabo',
    address: 'Kacyiru, Kigali',
    latitude: null,
    longitude: null,
    basis: 'per room, per night',
    roomTypes: [{ name: 'Standard Room', rateRwf: 66_500, capacity: 2, roomCount: 4 }],
  },
  {
    index: 9,
    slug: 'quillstone-hotel',
    name: 'Quillstone Hotel',
    accommodationClass: 'hotel',
    starGrade: 3,
    district: 'Gasabo',
    address: 'Remera, Kigali',
    latitude: null,
    longitude: null,
    basis: 'per room, per night',
    roomTypes: [{ name: 'Standard Room', rateRwf: 141_500, capacity: 2, roomCount: 4 }],
  },
  {
    index: 10,
    slug: 'willowbank-apartments-gacuriro',
    name: 'Willowbank Apartments Gacuriro',
    accommodationClass: 'apartment',
    starGrade: null,
    district: 'Gasabo',
    address: 'Gacuriro, Kigali',
    latitude: null,
    longitude: null,
    basis: 'per apartment, per night',
    roomTypes: [
      { name: 'Two-bedroom Apartment', rateRwf: 258_000, capacity: 4, roomCount: 4 },
    ],
  },
  {
    index: 11,
    slug: 'orchard-row-suites',
    name: 'Orchard Row Suites',
    accommodationClass: 'apartment',
    starGrade: null,
    district: 'Gasabo',
    address: 'Nyarutarama, Kigali',
    latitude: null,
    longitude: null,
    basis: 'per apartment, per night',
    roomTypes: [
      { name: 'Two-bedroom Apartment', rateRwf: 150_500, capacity: 4, roomCount: 4 },
    ],
  },
  {
    index: 12,
    slug: 'paperbark-apartments',
    name: 'Paperbark Apartments',
    accommodationClass: 'apartment',
    starGrade: null,
    district: 'Gasabo',
    address: 'Kacyiru, Kigali',
    latitude: null,
    longitude: null,
    basis: 'per apartment, per night',
    roomTypes: [
      { name: 'Two-bedroom Apartment', rateRwf: 88_500, capacity: 4, roomCount: 4 },
    ],
  },
  {
    index: 13,
    slug: 'mistridge-lodge',
    name: 'Mistridge Lodge',
    accommodationClass: 'lodge',
    starGrade: null,
    district: 'Musanze',
    address: 'Kinigi, Volcanoes National Park',
    latitude: null,
    longitude: null,
    basis: 'per person, per night, all inclusive',
    roomTypes: [{ name: 'Lodge Room', rateRwf: 3_788_000, capacity: 2, roomCount: 6 }],
  },
  {
    index: 14,
    slug: 'mistridge-reserve-villas',
    name: 'Mistridge Reserve Villas',
    accommodationClass: 'villa',
    starGrade: null,
    district: 'Musanze',
    address: 'Kinigi, Volcanoes National Park',
    latitude: null,
    longitude: null,
    basis: 'per person, per night, all inclusive',
    roomTypes: [{ name: 'Private Villa', rateRwf: 4_894_000, capacity: 2, roomCount: 4 }],
  },
  {
    index: 15,
    slug: 'bamboo-saddle-lodge',
    name: 'Bamboo Saddle Lodge',
    accommodationClass: 'lodge',
    starGrade: null,
    district: 'Musanze',
    address: 'Kinigi, Volcanoes National Park',
    latitude: null,
    longitude: null,
    basis: 'per person, per night, all inclusive',
    roomTypes: [{ name: 'Lodge Room', rateRwf: 2_242_500, capacity: 2, roomCount: 6 }],
  },
  {
    index: 16,
    slug: 'cloudline-lodge',
    name: 'Cloudline Lodge',
    accommodationClass: 'lodge',
    starGrade: null,
    district: 'Musanze',
    address: 'Musanze, Volcanoes National Park',
    latitude: null,
    longitude: null,
    basis: 'per person, per night, all inclusive',
    roomTypes: [{ name: 'Lodge Room', rateRwf: 1_799_000, capacity: 2, roomCount: 6 }],
  },
  {
    index: 17,
    slug: 'silverback-hollow-lodge',
    name: 'Silverback Hollow Lodge',
    accommodationClass: 'lodge',
    starGrade: null,
    district: 'Musanze',
    address: 'Kinigi, Musanze, Volcanoes National Park',
    latitude: null,
    longitude: null,
    basis: 'per person, per night',
    roomTypes: [{ name: 'Lodge Room', rateRwf: 4_010_500, capacity: 2, roomCount: 6 }],
  },
  {
    index: 18,
    slug: 'papyrus-shore-camp',
    name: 'Papyrus Shore Camp',
    accommodationClass: 'tented_camp',
    starGrade: null,
    district: 'Nyagatare',
    address: 'Nyagatare, Akagera National Park',
    latitude: null,
    longitude: null,
    basis: 'per person, per night, all inclusive',
    roomTypes: [{ name: 'Tented Suite', rateRwf: 1_421_500, capacity: 2, roomCount: 6 }],
  },
  {
    index: 19,
    slug: 'mossgrove-forest-house',
    name: "Mossgrove Forest House",
    accommodationClass: 'lodge',
    starGrade: null,
    district: 'Rusizi',
    address: 'Gisakura, Nyungwe Forest National Park',
    latitude: null,
    longitude: null,
    basis: 'per person, per night, all inclusive',
    roomTypes: [{ name: 'Lodge Room', rateRwf: 4_423_500, capacity: 2, roomCount: 6 }],
  },
  {
    // The one property whose own site publishes a room LADDER rather than a
    // single "from" rate: Superior and Family both from USD 190, Suite from
    // USD 330, converted at the fixture's 1 USD = 1474.51 RWF and rounded to
    // the nearest 500 the way every other rate in the catalogue is. Three real
    // tiers, so nothing here is invented, and the cheapest-wins rule that picks
    // the fixture's default has something to decide.
    index: 20,
    slug: 'sunbird-bay-hotel',
    name: 'Sunbird Bay Hotel',
    accommodationClass: 'hotel',
    starGrade: null,
    district: 'Rubavu',
    address: 'Gisenyi, Lake Kivu',
    latitude: null,
    longitude: null,
    basis: 'per room, per night',
    roomTypes: [
      { name: 'Superior Room', rateRwf: 280_000, capacity: 2, roomCount: 3 },
      { name: 'Family Room', rateRwf: 280_000, capacity: 4, roomCount: 2 },
      { name: 'Suite', rateRwf: 486_500, capacity: 2, roomCount: 1 },
    ],
  },
];

/**
 * The first thirty stays, part two (indexes 21 to 30). Fictional businesses at
 * demo rates, like part one; the name is historical. `rateNote` is written into
 * each description's `SYNTHETIC RATE` sentence.
 */
const SYNTHETIC_RATE_CATALOGUE = [
  {
    index: 21,
    slug: 'cobalt-tower-hotel',
    name: 'Cobalt Tower Hotel',
    accommodationClass: 'hotel',
    starGrade: 4,
    district: 'Nyarugenge',
    address: 'Nyarugenge, Kigali',
    latitude: null,
    longitude: null,
    basis: 'per room, per night',
    rateNote: 'as a round demo figure for a stay of this class and area',
    roomTypes: [{ name: 'Standard Room', rateRwf: 150_000, capacity: 2, roomCount: 4 }],
  },
  {
    index: 22,
    slug: 'saffron-terrace-hotel',
    name: 'Saffron Terrace Hotel',
    accommodationClass: 'hotel',
    starGrade: 4,
    district: 'Gasabo',
    address: 'Nyarutarama, Kigali',
    latitude: null,
    longitude: null,
    basis: 'per room, per night',
    rateNote: 'as a round demo figure for a stay of this class and area',
    roomTypes: [{ name: 'Standard Room', rateRwf: 140_000, capacity: 2, roomCount: 4 }],
  },
  {
    index: 23,
    slug: 'hummingbird-house-hotel',
    name: 'Hummingbird House Hotel',
    accommodationClass: 'hotel',
    starGrade: null,
    district: 'Nyarugenge',
    address: 'Kiyovu, Kigali',
    latitude: null,
    longitude: null,
    basis: 'per room, per night',
    rateNote: 'as a round demo figure for a stay of this class and area',
    roomTypes: [{ name: 'Standard Room', rateRwf: 110_000, capacity: 2, roomCount: 4 }],
  },
  {
    index: 24,
    slug: 'dawn-and-dusk-hotel',
    name: 'Dawn and Dusk Hotel',
    accommodationClass: 'hotel',
    starGrade: 3,
    district: 'Gasabo',
    address: 'Kacyiru, Kigali',
    latitude: null,
    longitude: null,
    basis: 'per room, per night',
    rateNote: 'as a round demo figure for a stay of this class and area',
    roomTypes: [{ name: 'Standard Room', rateRwf: 95_000, capacity: 2, roomCount: 4 }],
  },
  {
    index: 25,
    slug: 'treefern-nest-lodge',
    name: "Treefern Nest Lodge",
    accommodationClass: 'lodge',
    starGrade: null,
    district: 'Musanze',
    address: 'Kinigi, Volcanoes National Park',
    latitude: null,
    longitude: null,
    basis: 'per person, per night',
    rateNote: 'as a round demo figure for a stay of this class and area',
    roomTypes: [{ name: 'Lodge Room', rateRwf: 4_000_000, capacity: 2, roomCount: 4 }],
  },
  {
    index: 26,
    slug: 'seven-craters-boutique-hotel',
    name: 'Seven Craters Boutique Hotel',
    accommodationClass: 'hotel',
    starGrade: null,
    district: 'Musanze',
    address: 'Musanze, Volcanoes National Park',
    latitude: null,
    longitude: null,
    basis: 'per room, per night',
    rateNote: 'as a round demo figure for a stay of this class and area',
    roomTypes: [{ name: 'Standard Room', rateRwf: 250_000, capacity: 2, roomCount: 6 }],
  },
  {
    index: 27,
    slug: 'hippo-bend-tented-lodge',
    name: 'Hippo Bend Tented Lodge',
    accommodationClass: 'tented_camp',
    starGrade: null,
    district: 'Kayonza',
    address: 'Kayonza, Akagera National Park',
    latitude: null,
    longitude: null,
    basis: 'per person, per night',
    rateNote: 'as a round demo figure for a stay of this class and area',
    roomTypes: [{ name: 'Tented Suite', rateRwf: 400_000, capacity: 2, roomCount: 6 }],
  },
  {
    index: 28,
    slug: 'acacia-horizon-game-lodge',
    name: 'Acacia Horizon Game Lodge',
    accommodationClass: 'lodge',
    starGrade: null,
    district: 'Kayonza',
    address: 'Kayonza, Akagera National Park',
    latitude: null,
    longitude: null,
    basis: 'per room, per night',
    rateNote: 'as a round demo figure for a stay of this class and area',
    roomTypes: [{ name: 'Lodge Room', rateRwf: 300_000, capacity: 2, roomCount: 6 }],
  },
  {
    index: 29,
    slug: 'colobus-ridge-hotel',
    name: 'Colobus Ridge Hotel',
    accommodationClass: 'hotel',
    starGrade: 3,
    district: 'Rusizi',
    address: 'Gisakura village, Nyungwe Forest National Park',
    latitude: null,
    longitude: null,
    basis: 'per room, per night',
    rateNote: 'as a round demo figure for a stay of this class and area',
    roomTypes: [{ name: 'Standard Room', rateRwf: 120_000, capacity: 2, roomCount: 6 }],
  },
  {
    index: 30,
    slug: 'heronstone-lodge',
    name: 'Heronstone Lodge',
    accommodationClass: 'lodge',
    starGrade: null,
    district: 'Karongi',
    address: 'Kibuye, Lake Kivu',
    latitude: null,
    longitude: null,
    basis: 'per person, per night',
    rateNote: 'as a round demo figure for a stay of this class and area',
    roomTypes: [{ name: 'Lodge Room', rateRwf: 350_000, capacity: 2, roomCount: 5 }],
  },
];

/**
 * The FICTIONAL half of the catalogue, as inventory.
 *
 * `apps/web/src/data/filler-properties.ts` holds twenty-two invented stays that
 * pad the explore grid while the search endpoint is unbuilt. `catalogue.ts`
 * joins them into `ALL_PROPERTIES`, which is what `findCatalogueProperty` and
 * `generateStaticParams` both read — so they are reachable from explore, they
 * had no `listing`, and every one of them dead-ended at "not open for online
 * booking yet". That is the last of contract row C1.
 *
 * TWO THINGS ARE INVENTED HERE, NOT ONE, AND THEY ARE MARKED SEPARATELY:
 *
 *  - The NAME. No business of this name exists, so unlike all thirty rows
 *    above there is no real company a row could misrepresent. Their org name
 *    ends ` (Injishi demo seed — a fictional business)` rather than ` (Injishi
 *    demo seed — not the real business)`, because "not the real business"
 *    implies there is one. Both still match `legal_name like '%(Injishi demo
 *    seed%'`, so one query still finds every seeded org.
 *  - The RATE. Fictional does NOT mean the rate marking can be dropped: a
 *    number nobody published is a number nobody published, so these carry the
 *    same three markers the ten real-named synthetic rows carry —
 *    `SYNTHETIC RATE` in the description, ` (demo rate)` on the room type
 *    name, and the marked rate plan name.
 *
 * Twenty of the twenty-two rates were already in the fixture, invented by
 * whoever wrote it. Two (`akagera-plains-tented-camp`, `gorilla-gate-tented-
 * lodge`) had none and are priced here, anchored like the ten above. All
 * twenty-two are synthetic either way, so no marker distinguishes the two I
 * chose from the twenty I copied — there is nothing to distinguish.
 *
 * `classOther` is set for the one `other` class row: `orgs` carries a CHECK
 * (`orgs_accommodation_class_other_shape`) that REQUIRES
 * `accommodation_class_other` when the class is `other`, and forbids it
 * otherwise, so the column and the class have to move together.
 */
const FICTIONAL_CATALOGUE = [
  { index: 31, slug: 'umuganda-heights-suites', name: 'Umuganda Heights Suites', accommodationClass: 'apartment', starGrade: 4, district: 'Gasabo', address: 'Kacyiru, Kigali', basis: 'per apartment, per night', roomTypes: [{ name: 'Two-bedroom Apartment', rateRwf: 96_000, capacity: 4, roomCount: 6 }] },
  { index: 32, slug: 'kivu-shoreline-lodge', name: 'Kivu Shoreline Lodge', accommodationClass: 'lodge', starGrade: 4, district: 'Karongi', address: 'Kibuye, Karongi', basis: 'per room, per night', roomTypes: [{ name: 'Lodge Room', rateRwf: 128_000, capacity: 2, roomCount: 6 }] },
  { index: 33, slug: 'nyandungu-garden-rooms', name: 'Nyandungu Garden Rooms', accommodationClass: 'guest_house', starGrade: 3, district: 'Gasabo', address: 'Remera, Kigali', basis: 'per room, per night', roomTypes: [{ name: 'Guest Room', rateRwf: 38_000, capacity: 2, roomCount: 6 }] },
  { index: 34, slug: 'virunga-ridge-cottages', name: 'Virunga Ridge Cottages', accommodationClass: 'lodge', starGrade: 5, district: 'Musanze', address: 'Kinigi, Musanze', basis: 'per person, per night', roomTypes: [{ name: 'Lodge Room', rateRwf: 412_000, capacity: 4, roomCount: 6 }] },
  {
    index: 35,
    slug: 'akagera-plains-tented-camp',
    name: 'Akagera Plains Tented Camp',
    accommodationClass: 'tented_camp',
    starGrade: null,
    district: 'Nyagatare',
    address: 'Kayonza gate, Nyagatare',
    basis: 'per person, per itinerary',
    // No rate in the fixture. Anchored to the other Akagera camp in the same
    // file, akagera-riverside-camp (134,000 per person), and nudged up for the
    // twice-daily game drives its `includes` line carries.
    rateNote: 'as a round demo figure for a stay of this class and area',
    roomTypes: [{ name: 'Tented Suite', rateRwf: 150_000, capacity: 2, roomCount: 6 }],
  },
  { index: 36, slug: 'gisenyi-bay-apartments', name: 'Gisenyi Bay Apartments', accommodationClass: 'apartment', starGrade: 3, district: 'Rubavu', address: 'Rubavu town, Rubavu', basis: 'per apartment, per night', roomTypes: [{ name: 'Three-bedroom Apartment', rateRwf: 72_000, capacity: 6, roomCount: 6 }] },
  { index: 37, slug: 'nyungwe-canopy-retreat', name: 'Nyungwe Canopy Retreat', accommodationClass: 'lodge', starGrade: 4, district: 'Rusizi', address: 'Gisakura, Rusizi', basis: 'per person, per night', roomTypes: [{ name: 'Lodge Room', rateRwf: 245_000, capacity: 2, roomCount: 6 }] },
  { index: 38, slug: 'kimironko-market-rooms', name: 'Kimironko Market Rooms', accommodationClass: 'guest_house', starGrade: 2, district: 'Gasabo', address: 'Kimironko, Kigali', basis: 'per room, per night', roomTypes: [{ name: 'Guest Room', rateRwf: 24_000, capacity: 2, roomCount: 6 }] },
  { index: 39, slug: 'lake-muhazi-boathouse', name: 'Lake Muhazi Boathouse', accommodationClass: 'guest_house', starGrade: 3, district: 'Nyagatare', address: 'Rwesero, Nyagatare', basis: 'per room, per night', roomTypes: [{ name: 'Guest Room', rateRwf: 54_000, capacity: 4, roomCount: 6 }] },
  { index: 40, slug: 'ridgeview-loft-serviced-flats', name: 'Ridgeview Loft Serviced Flats', accommodationClass: 'apartment', starGrade: 5, district: 'Gasabo', address: 'Kimihurura, Kigali', basis: 'per apartment, per night', roomTypes: [{ name: 'Two-bedroom Apartment', rateRwf: 164_000, capacity: 4, roomCount: 6 }] },
  { index: 41, slug: 'musanze-farmstead-guesthouse', name: 'Musanze Farmstead Guesthouse', accommodationClass: 'guest_house', starGrade: 3, district: 'Musanze', address: 'Musanze town, Musanze', basis: 'per room, per night', roomTypes: [{ name: 'Guest Room', rateRwf: 46_000, capacity: 5, roomCount: 6 }] },
  { index: 42, slug: 'rusizi-border-hotel', name: 'Rusizi Border Hotel', accommodationClass: 'hotel', starGrade: 4, district: 'Rusizi', address: 'Kamembe, Rusizi', basis: 'per room, per night', roomTypes: [{ name: 'Standard Room', rateRwf: 88_000, capacity: 2, roomCount: 6 }] },
  { index: 43, slug: 'karongi-hillside-villas', name: 'Karongi Hillside Villas', accommodationClass: 'villa', starGrade: null, district: 'Karongi', address: 'Bwishyura, Karongi', basis: 'per villa, per night', roomTypes: [{ name: 'Private Villa', rateRwf: 218_000, capacity: 8, roomCount: 6 }] },
  { index: 44, slug: 'nyamirambo-townhouse', name: 'Nyamirambo Townhouse', accommodationClass: 'villa', starGrade: null, district: 'Nyarugenge', address: 'Nyamirambo, Kigali', basis: 'per house, per night', roomTypes: [{ name: 'Private Villa', rateRwf: 64_000, capacity: 6, roomCount: 1 }] },
  {
    index: 45,
    slug: 'gorilla-gate-tented-lodge',
    name: 'Gorilla Gate Tented Lodge',
    accommodationClass: 'tented_camp',
    starGrade: null,
    district: 'Musanze',
    address: 'Nyange, Musanze',
    basis: 'per person, per itinerary',
    // No rate in the fixture. Anchored to virunga-ridge-cottages (412,000 per
    // person), the other all-inclusive Musanze stay in the same file, a little
    // under it because that one is the 5-star of the pair.
    rateNote: 'as a round demo figure for a stay of this class and area',
    roomTypes: [{ name: 'Tented Suite', rateRwf: 380_000, capacity: 2, roomCount: 6 }],
  },
  { index: 46, slug: 'rubavu-beach-hotel', name: 'Rubavu Beach Hotel', accommodationClass: 'hotel', starGrade: 4, district: 'Rubavu', address: 'Gisenyi shore, Rubavu', basis: 'per room, per night', roomTypes: [{ name: 'Standard Room', rateRwf: 112_000, capacity: 3, roomCount: 6 }] },
  { index: 47, slug: 'kacyiru-business-inn', name: 'Kacyiru Business Inn', accommodationClass: 'hotel', starGrade: 3, district: 'Gasabo', address: 'Kacyiru, Kigali', basis: 'per room, per night', roomTypes: [{ name: 'Standard Room', rateRwf: 58_000, capacity: 2, roomCount: 6 }] },
  { index: 48, slug: 'tea-country-plantation-house', name: 'Tea Country Plantation House', accommodationClass: 'guest_house', starGrade: 3, district: 'Rusizi', address: 'Gisakura, Rusizi', basis: 'per room, per night', roomTypes: [{ name: 'Guest Room', rateRwf: 78_000, capacity: 4, roomCount: 6 }] },
  { index: 49, slug: 'muhabura-view-hostel', name: 'Muhabura View Hostel', accommodationClass: 'other', classOther: 'Hostel', starGrade: null, district: 'Musanze', address: 'Musanze town, Musanze', basis: 'per bed, per night', roomTypes: [{ name: 'Dormitory Bed', rateRwf: 16_000, capacity: 2, roomCount: 6 }] },
  { index: 50, slug: 'akagera-riverside-camp', name: 'Akagera Riverside Camp', accommodationClass: 'tented_camp', starGrade: null, district: 'Nyagatare', address: 'Rwempasha, Nyagatare', basis: 'per person, per night', roomTypes: [{ name: 'Tented Suite', rateRwf: 134_000, capacity: 3, roomCount: 6 }] },
  { index: 51, slug: 'gasabo-skyline-residences', name: 'Gasabo Skyline Residences', accommodationClass: 'apartment', starGrade: 4, district: 'Gasabo', address: 'Gacuriro, Kigali', basis: 'per apartment, per night', roomTypes: [{ name: 'One-bedroom Apartment', rateRwf: 68_000, capacity: 2, roomCount: 6 }] },
  { index: 52, slug: 'kivu-fishermans-rest', name: "Kivu Fisherman's Rest", accommodationClass: 'guest_house', starGrade: 2, district: 'Rubavu', address: 'Kinunu, Rubavu', basis: 'per room, per night', roomTypes: [{ name: 'Guest Room', rateRwf: 32_000, capacity: 4, roomCount: 6 }] },
];

/**
 * All three groups, with provenance attached STRUCTURALLY rather than by a flag.
 *
 * A per row `rateProvenance: 'published'` field would be one typo away from
 * labelling an invented price as sourced, and that mislabelling is the failure
 * this whole distinction exists to prevent. Deriving it from which array the
 * row was declared in makes it unforgeable. The same argument applies to
 * `nameProvenance`: a row that names a real company and a row that names
 * nobody must not be one careless edit apart.
 *
 * Neither field may be written by hand on a row. If you add a property, add it
 * to the array whose two truths it satisfies, and if it fits none of them, add
 * a fourth array rather than a flag.
 */
const CATALOGUE = [
  // Every business is fictional and every rate invented (see the header), so
  // all three arrays carry the same provenance.
  ...SOURCED_RATE_CATALOGUE.map((e) => ({
    ...e,
    nameProvenance: 'fictional',
    rateProvenance: 'synthetic',
    rateNote: 'as the figure the web fixture already carried for this invented stay',
  })),
  ...SYNTHETIC_RATE_CATALOGUE.map((e) => ({
    ...e,
    nameProvenance: 'fictional',
    rateProvenance: 'synthetic',
  })),
  ...FICTIONAL_CATALOGUE.map((e) => ({
    ...e,
    latitude: null,
    longitude: null,
    nameProvenance: 'fictional',
    rateProvenance: 'synthetic',
    // Twenty of these came priced from the fixture, so they have no anchor of
    // their own to record. Say that rather than leaving the sentence dangling.
    rateNote: e.rateNote ?? 'as the figure the fixture itself already carried for this invented stay',
  })),
];

/**
 * The RDB codes the orgs above point at.
 *
 * `orgs.accommodation_class` is a foreign key into `rdb_classifications`, and
 * that catalog is empty on a fresh database. These rows are the same ones
 * `seed-content.mjs` writes; they are repeated here so this script stands
 * alone rather than depending on another seed having run first, and every
 * insert is a no-op when it already exists.
 */
const RDB_CODES = [
  ['accommodation', 'entity_group', null, 'Accommodation establishments'],
  ['hotel', 'accommodation_class', 'accommodation', 'Hotel'],
  ['apartment', 'accommodation_class', 'accommodation', 'Apartment'],
  ['lodge', 'accommodation_class', 'accommodation', 'Lodge'],
  ['villa', 'accommodation_class', 'accommodation', 'Villa'],
  ['tented_camp', 'accommodation_class', 'accommodation', 'Tented Camp'],
  ['guest_house', 'accommodation_class', 'accommodation', 'Guest House'],
  ['other', 'accommodation_class', 'accommodation', 'Other'],
];

/** The demo marking, in the three strings a reader actually sees. */
const DEMO_NAME_SUFFIX = ' (demo)';

/**
 * The org suffix, in two truthful variants.
 *
 * Both begin ` (Injishi demo seed — `, so `legal_name like '%(Injishi demo
 * seed%'` still returns every seeded org and the revision 1 marking is intact.
 * The tails differ because the facts differ: "not the real business" is a
 * disclaimer that only means something when a real business of that name
 * exists, and saying it over an invented name implies one does.
 */
const DEMO_ORG_SUFFIX = {
  real: ' (Injishi demo seed — not the real business)',
  fictional: ' (Injishi demo seed — a fictional business)',
};

/** The rate marking, applied ONLY to rows whose price was invented. */
const SYNTHETIC_ROOM_TYPE_SUFFIX = ' (demo rate)';
const SYNTHETIC_RATE_PLAN_NAME = 'Flexible (demo rate — not published by the business)';

function isSynthetic(entry) {
  return entry.rateProvenance === 'synthetic';
}

function isFictional(entry) {
  return entry.nameProvenance === 'fictional';
}

/**
 * The property description, and the FIRST of the three rate provenance markers.
 *
 * The two branches must stay textually distinct, because the whole point is
 * that `like '%SYNTHETIC RATE%'` separates an invented price from a sourced one
 * in a single query. Do not converge their wording.
 */
function demoDescription(entry, cheapest) {
  const seededBy =
    `DEMO SAMPLE DATA — seeded by server/api/scripts/seed-demo-catalogue.mjs ` +
    `so the Injishi booking flow can be walked end to end. `;
  const preamble = isFictional(entry)
    ? `${seededBy}FICTIONAL BUSINESS — no accommodation of this name exists. ` +
      `The whole record is fixture data invented to fill the catalogue while ` +
      `the search endpoint is unbuilt. `
    : `${seededBy}This record is NOT operated by, affiliated with or endorsed ` +
      `by ${entry.name}, and nothing in it is a quote from that business. `;
  const rate = `${cheapest.rateRwf.toLocaleString('en-US')} RWF ${entry.basis}`;

  if (!isSynthetic(entry)) {
    return `${preamble}Reference rate ${rate}, taken from the public listing the web catalogue cites.`;
  }
  if (isFictional(entry)) {
    return (
      `${preamble}SYNTHETIC RATE — the ${rate} here was INVENTED to give the ` +
      `booking demo a price. There is no real rate, because there is no real ` +
      `business. It was picked ${entry.rateNote}.`
    );
  }
  return (
    `${preamble}SYNTHETIC RATE — this business publishes no rate the catalogue ` +
    `could cite, so the ${rate} here was INVENTED to give the booking demo a ` +
    `price. It is not this business's price and must never be read as a quote. ` +
    `It was picked ${entry.rateNote}.`
  );
}

const DEMO_HOUSE_RULES =
  'DEMO SAMPLE — placeholder rules for the booking walkthrough, not the ' +
  "accommodation's own. Check-in from 14:00, checkout by 11:00. Valid ID " +
  'required at check-in.';

/** The room type a property sells by default: cheapest, ties broken by order. */
function cheapestRoomType(entry) {
  return entry.roomTypes.reduce((best, rt) => (rt.rateRwf < best.rateRwf ? rt : best));
}

function syntheticCoordinateFor(entry) {
  if (entry.latitude != null && entry.longitude != null) {
    return [entry.latitude, entry.longitude];
  }
  return syntheticCoordFor({ district: entry.district, seed: entry.slug });
}

async function reset(client) {
  // A booking outlives the seed that made its room bookable. Deleting the room
  // type under it would either fail on the foreign key or, worse, succeed and
  // leave a booking pointing at nothing, so refuse and say so.
  const held = await client.query(
    `select count(*)::int n
       from bookings b
      where b.room_type_id::text like $1`,
    [`${ID_PREFIX}-%`],
  );
  if (held.rows[0].n > 0) {
    throw new Error(
      `${held.rows[0].n} booking(s) point at demo inventory; refusing to reset. ` +
        'Delete those bookings first if this is really what you want.',
    );
  }

  // Foreign key order, child first. Several of these would cascade from
  // `properties`, but naming each one keeps the blast radius of this script
  // readable rather than implied by the schema.
  const like = [`${ID_PREFIX}-%`];
  let removed = 0;
  for (const table of [
    'listings',
    'rooms',
    'rate_plans',
    'room_types',
    'properties',
    'workspaces',
    'orgs',
  ]) {
    const r = await client.query(`delete from ${table} where id::text like $1`, like);
    removed += r.rowCount;
    console.log(`  - ${table}: ${r.rowCount}`);
  }
  console.log(`Reset removed ${removed} row(s) from the ${ID_PREFIX}- namespace.`);
}

async function seed(client) {
  // 1. The classification codes the orgs point at.
  for (const [code, kind, parent, labelEn] of RDB_CODES) {
    await client.query(
      // label_rw is NOT NULL and Kinyarwanda copy is owned by F-A20, so the
      // English string stands in — the same placeholder seed-content.mjs uses.
      `insert into rdb_classifications (code, kind, parent_code, label_en, label_rw, active)
       values ($1, $2, $3, $4, $4, true)
       on conflict (code) do nothing`,
      [code, kind, parent, labelEn],
    );
  }

  // 2. Districts, resolved by name rather than by id. Geography is seeded by
  //    `seed-geography.mjs` and its ids are stable, but resolving by name means
  //    this script cannot silently file a property under the wrong district if
  //    that ever changes.
  const districtRows = await client.query('select id, lower(name) as name from districts');
  const districtId = new Map(districtRows.rows.map((r) => [r.name, r.id]));
  const missing = [
    ...new Set(CATALOGUE.map((e) => e.district.toLowerCase())),
  ].filter((n) => !districtId.has(n));
  if (missing.length > 0) {
    console.warn(
      `! districts not found (${missing.join(', ')}) — seed geography first. ` +
        'Those properties are seeded with a null district.',
    );
  }

  const mapping = [];

  for (const entry of CATALOGUE) {
    const orgId = idFor(entry.index, TAIL.org);
    const workspaceId = idFor(entry.index, TAIL.workspace);
    const propertyId = idFor(entry.index, TAIL.property);
    const listingId = idFor(entry.index, TAIL.listing);
    const cheapest = cheapestRoomType(entry);

    // 3. Org. `orgs_domain_shape` requires an accommodation class on a
    //    hospitality org and `orgs_identifier_shape` requires a TIN, so both
    //    are set. `registration_status` is `active` because
    //    `permissionsForWorkspace` returns an EMPTY set for anything else and
    //    an inactive org's inventory is not meant to be listed (D20, D23).
    await client.query(
      `insert into orgs (id, legal_name, domain, rdb_entity_group, accommodation_class,
                         accommodation_class_other, eac_star_grade,
                         tourism_license_number, tin,
                         registration_status, district_id, address_text)
       values ($1, $2, 'hospitality', 'accommodation', $3, $9, $4, $5, $6, 'active', $7, $8)
       on conflict (id) do update
         set legal_name = excluded.legal_name,
             accommodation_class = excluded.accommodation_class,
             accommodation_class_other = excluded.accommodation_class_other,
             eac_star_grade = excluded.eac_star_grade,
             tourism_license_number = excluded.tourism_license_number,
             tin = excluded.tin,
             registration_status = excluded.registration_status,
             district_id = excluded.district_id,
             address_text = excluded.address_text,
             updated_at = now()`,
      [
        orgId,
        `${entry.name}${DEMO_ORG_SUFFIX[entry.nameProvenance]}`,
        entry.accommodationClass,
        entry.starGrade,
        `DEMO-SEED-${String(entry.index).padStart(4, '0')}`,
        // Nine digits, so a receipt still formats as `TIN: nnnnnnnnn`, in a
        // 999 block no issued Rwandan TIN occupies.
        `999${String(entry.index).padStart(6, '0')}`,
        districtId.get(entry.district.toLowerCase()) ?? null,
        `DEMO SAMPLE — ${entry.address}`,
        // `orgs_accommodation_class_other_shape` requires this exactly when the
        // class is `other` and forbids it otherwise, so it is derived from the
        // class rather than trusted from the row.
        entry.accommodationClass === 'other' ? (entry.classOther ?? 'Other') : null,
      ],
    );

    // 4. Business workspace. Nobody is a member of it: these orgs exist to hold
    //    inventory, not to be operated, and an org with no membership cannot be
    //    opened in the PMS by anyone.
    await client.query(
      `insert into workspaces (id, kind, org_id) values ($1, 'business', $2)
       on conflict (id) do nothing`,
      [workspaceId, orgId],
    );

    // 5. Property. No photograph: ADR-053 moved them into `property_photos`, and
    //    this seed has no bytes to put in the bucket. So a catalogue property
    //    cannot be published until one is attached — see the header.
    const [demoLatitude, demoLongitude] = syntheticCoordinateFor(entry);
    await client.query(
      `insert into properties (id, org_id, workspace_id, name, description, district_id,
                               latitude, longitude, location_privacy, check_in_time,
                               check_out_time, house_rules, address_text)
       values ($1, $2, $3, $4, $5, $6, $7, $8, false, '14:00', '11:00', $9, $10)
       on conflict (id) do update
         set name = excluded.name,
             description = excluded.description,
             district_id = excluded.district_id,
             latitude = excluded.latitude,
             longitude = excluded.longitude,
             house_rules = excluded.house_rules,
             address_text = excluded.address_text,
             updated_at = now()`,
      [
        propertyId,
        orgId,
        workspaceId,
        `${entry.name}${DEMO_NAME_SUFFIX}`,
        demoDescription(entry, cheapest),
        districtId.get(entry.district.toLowerCase()) ?? null,
        demoLatitude,
        demoLongitude,
        DEMO_HOUSE_RULES,
        `DEMO SAMPLE — ${entry.address}`,
      ],
    );

    // 5b. The public address. `GET /properties/slug/:slug` is how web finds a
    //     property's rooms (ADR-053), and this seed predates the column, so for
    //     as long as it wrote none every one of the 52 pages read a 404 and
    //     told the guest the stay was "not open for online booking yet". The
    //     catalogue slug, not one minted from the name: the name carries
    //     ` (demo)`, and web's page and this row must agree on one address.
    //
    //     Claimed only while nobody else holds it. `properties_slug_uk` would
    //     otherwise abort the whole transaction over one collision (a host who
    //     published under the same name, or `seed-catalogue.mjs` run into the
    //     same database), and that is a fact to report, not a reason to seed
    //     nothing.
    const claimed = await client.query(
      `update properties set slug = $1, updated_at = now()
        where id = $2
          and slug is distinct from $1
          and not exists (select 1 from properties o where o.slug = $1 and o.id <> $2)`,
      [entry.slug, propertyId],
    );
    const held = await client.query('select slug from properties where id = $1', [propertyId]);
    if (claimed.rowCount === 0 && held.rows[0]?.slug !== entry.slug) {
      console.warn(
        `! ${entry.slug}: another property already holds this slug, so web's page ` +
          'for it cannot reach these rooms.',
      );
    }

    // 6. Room types, their default rate plan, and one `rooms` row per unit.
    //
    //    `room_count` and the `rooms` rows say the same thing twice on purpose:
    //    the first is what the room type advertises, the second is what the
    //    atomic availability count in BookingRepository counts.
    let roomSeq = 0;
    for (const [i, rt] of entry.roomTypes.entries()) {
      const roomTypeId = idFor(entry.index, TAIL.roomType(i + 1));
      const ratePlanId = idFor(entry.index, TAIL.ratePlan(i + 1));

      // The SECOND and THIRD provenance markers. The room type name is the one
      // that reaches a screen — checkout prints it — so a person looking at the
      // paywall can see that this price was invented without opening psql.
      const roomTypeName = isSynthetic(entry)
        ? `${rt.name}${SYNTHETIC_ROOM_TYPE_SUFFIX}`
        : rt.name;
      const ratePlanName = isSynthetic(entry) ? SYNTHETIC_RATE_PLAN_NAME : 'Flexible';

      // `instant_book` so the walkthrough ends on a confirmed booking rather
      // than a request awaiting an operator who does not exist for these orgs.
      // `room_types_approval_policy_shape` then requires a null approval policy.
      await client.query(
        `insert into room_types (id, property_id, workspace_id, name, domain, capacity,
                                 room_count, base_price_rwf, currency, booking_mode,
                                 approval_policy, cancellation_tier, nonrefundable_eligible,
                                 min_stay, check_in_method, max_guests, status)
         values ($1, $2, $3, $4, 'hospitality', $5, $6, $7, 'RWF', 'instant_book',
                 null, 'moderate', true, 1, 'front_desk', $5, 'active')
         on conflict (id) do update
           set name = excluded.name,
               capacity = excluded.capacity,
               max_guests = excluded.max_guests,
               room_count = excluded.room_count,
               base_price_rwf = excluded.base_price_rwf,
               status = 'active',
               updated_at = now()`,
        [roomTypeId, propertyId, workspaceId, roomTypeName, rt.capacity, rt.roomCount, rt.rateRwf],
      );

      // The default flexible plan, carrying the SAME number as the room type.
      // `room_types.base_price_rwf` is deprecated in favour of this row (F-L03)
      // and the booking path still reads the room type, so seeding them apart
      // would show a reader a contradiction. `single_occupancy_price_rwf` stays
      // null: no source publishes one for these properties.
      await client.query(
        `insert into rate_plans (id, room_type_id, workspace_id, name, status, is_default,
                                 base_price_rwf, currency, base_occupancy,
                                 cancellation_tier, non_refundable, booking_mode,
                                 approval_policy, min_stay)
         values ($1, $2, $3, $5, 'active', true, $4, 'RWF', 2,
                 'moderate', false, 'instant_book', null, 1)
         on conflict (id) do update
           set name = excluded.name,
               base_price_rwf = excluded.base_price_rwf,
               status = 'active',
               updated_at = now()`,
        [ratePlanId, roomTypeId, workspaceId, rt.rateRwf, ratePlanName],
      );

      for (let n = 1; n <= rt.roomCount; n++) {
        roomSeq += 1;
        await client.query(
          `insert into rooms (id, room_type_id, property_id, workspace_id, label, status)
           values ($1, $2, $3, $4, $5, 'available')
           on conflict (id) do update
             set room_type_id = excluded.room_type_id,
                 label = excluded.label,
                 updated_at = now()`,
          [
            idFor(entry.index, TAIL.room(roomSeq)),
            roomTypeId,
            propertyId,
            workspaceId,
            `${rt.name} ${n}`,
          ],
        );
      }
    }

    // 7. The published listing. `listings_property_uk` is one row per property,
    //    so the id conflict and the property conflict are the same conflict.
    //    `do nothing` on the row, then a targeted status update, so re-running
    //    does not walk `published_at` forward on every run.
    await client.query(
      `insert into listings (id, property_id, workspace_id, status, published_at, version)
       values ($1, $2, $3, 'published', now(), 1)
       on conflict (id) do nothing`,
      [listingId, propertyId, workspaceId],
    );
    await client.query(
      `update listings set status = 'published', updated_at = now()
        where id = $1 and status <> 'published'`,
      [listingId],
    );

    mapping.push({
      slug: entry.slug,
      name: entry.name,
      propertyId,
      roomTypeId: idFor(entry.index, TAIL.roomType(entry.roomTypes.indexOf(cheapest) + 1)),
      rateRwf: cheapest.rateRwf,
      rateProvenance: entry.rateProvenance,
      nameProvenance: entry.nameProvenance,
      basis: entry.basis,
    });
  }

  return mapping;
}

async function main() {
  const url = databaseUrl();
  const client = new pg.Client({
    connectionString: url,
    // A managed Postgres (Neon) presents a certificate this machine has no root
    // for; a local docker instance speaks plaintext. Deciding from the url keeps
    // the script runnable against either without a flag.
    ssl: /neon\.tech|sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  // ADR-043: sample data only ever goes into a database marked sample.
  await assertSampleDatabase(client, 'seed-demo-catalogue.mjs');

  try {
    await client.query('BEGIN');

    if (RESET) {
      console.log(`Resetting the ${ID_PREFIX}- namespace...`);
      await reset(client);
      await client.query('COMMIT');
      return;
    }

    const mapping = await seed(client);
    await client.query('COMMIT');

    const counts = {};
    for (const t of ['orgs', 'workspaces', 'properties', 'room_types', 'rate_plans', 'rooms', 'listings']) {
      const q = await client.query(
        `select count(*)::int total,
                count(*) filter (where id::text like $1)::int demo
           from ${t}`,
        [`${ID_PREFIX}-%`],
      );
      counts[t] = `${q.rows[0].demo} demo / ${q.rows[0].total} total`;
    }
    console.log('Seeded the demo catalogue. Row counts:', counts);
    console.log(
      '\nEvery row above is marked demo data: property names end " (demo)", ' +
        'org names end " (Injishi demo seed — a fictional business)", and every ' +
        `id begins "${ID_PREFIX}-". Check with:\n` +
        `  select id, name from properties where id::text like '${ID_PREFIX}-%';\n` +
        `  select count(*) from orgs where id::text like '${ID_PREFIX}-%'\n` +
        `    and legal_name not like '%(Injishi demo seed%';  -- must be 0\n`,
    );

    // The pointer the web catalogue needs, printed ready to paste. Cheapest
    // room type per property, which is what `PropertyDetail.listing` means.
    // The rate is printed beside it because `properties.ts` must show the SAME
    // number: a card that quotes one price over a paywall that charges another
    // is the first thing a reviewer finds.
    const origin = (m) => (m.rateProvenance === 'synthetic' ? 'INVENTED' : 'published');
    console.log('listing ids for apps/web/src/data/properties.ts:\n');
    for (const m of mapping) {
      console.log(
        `  ${m.slug}  ${m.rateRwf.toLocaleString('en-US')} RWF ${m.basis} [${origin(m)}]\n` +
          `    listing: { propertyId: "${m.propertyId}", roomTypeId: "${m.roomTypeId}" },`,
      );
    }
    const invented = mapping.filter((m) => m.rateProvenance === 'synthetic').length;
    const fictional = mapping.filter((m) => m.nameProvenance === 'fictional').length;
    console.log(
      `\n${mapping.length} properties: ${mapping.length - invented} priced from their own ` +
        `published rate, ${invented} from an INVENTED demo rate ` +
        `(${fictional} of those name a fictional business, ${invented - fictional} name a ` +
        `real one that publishes no rate). Separate them with:\n` +
        `  select name,\n` +
        `         case when description like '%SYNTHETIC RATE%' then 'invented' else 'published' end as rate_origin,\n` +
        `         case when description like '%FICTIONAL BUSINESS%' then 'fictional' else 'real' end as name_origin\n` +
        `    from properties where id::text like '${ID_PREFIX}-%' order by 2, 3, 1;\n`,
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
