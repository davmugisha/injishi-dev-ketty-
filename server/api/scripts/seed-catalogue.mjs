#!/usr/bin/env node
/**
 * Seed the marketplace catalogue as REAL inventory (ADR-047).
 *
 *   node scripts/seed-catalogue.mjs
 *   node scripts/seed-catalogue.mjs --reset   # delete what this script wrote
 *
 * Input is `scripts/data/catalogue.json`. It was exported from a directory of
 * fictional stays in `apps/web/src/data/`, which was removed on 2026-10-08:
 * the marketplace now lists only what the database holds, so this file is the
 * catalogue's one remaining copy. Edit it directly.
 *
 * ## What this replaces
 *
 * The database held TWO properties — Umurage Guesthouse and one residence
 * block — while the marketplace showed fifty-two. The gap was bridged by
 * `apps/web/src/data/demo-listing.ts`, which lent Umurage's cheapest room to
 * every property in the catalogue behind a build flag, so a checkout opened
 * from the Copperleaf Grand reserved a room in a guesthouse two kilometres away.
 * With the flag off — which is what `.env.production` set — nothing in the
 * catalogue was bookable at all.
 *
 * After this script, a property is bookable because it HAS a published listing
 * with an active room type, in every environment, with no flag.
 *
 * ## The identity it writes, stated plainly
 *
 * One org, one business workspace, one property, one room type and its rooms,
 * and one published listing, per catalogue entry. All ids are UUIDv5 derived
 * from the slug, so re-running is a no-op and the ids are the same on every
 * machine without a generated file to keep in step.
 *
 * **Two honesty rules, and neither is negotiable.**
 *
 * Every org this writes carries a TIN in the reserved `999` block, the same
 * marker `seed-demo-catalogue.mjs` uses, so a plausible-looking TIN can never
 * collide with a real taxpayer.
 *
 * Every entry is FICTIONAL. Thirty were real businesses until 2026-09-14, when
 * the web catalogue renamed them, so every org now gets `(sample)` appended to
 * its legal name and the row says what it is from inside the row.
 *
 * ## What it does NOT write
 *
 * Users, memberships, bookings or money. Nobody owns these workspaces, so the
 * operator app cannot be opened against them; that is correct until a real host
 * claims a business through registration (F-B01). This script publishes
 * inventory a guest can buy, and nothing about who staffs it.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { businessKindFor } from './business-kind.mjs';
import { assertSampleDatabase } from './sample-database.mjs';
import { apiEnvFile } from './env-file.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(apiEnvFile() ?? resolve(__dirname, '../.env'), 'utf8');
  const m = env.match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error('DATABASE_URL not set and not found in server/api/.env.test (or the APP_ENV file)');
  return m[1].trim();
}

/**
 * The id namespace this script owns: everything it writes starts `ca7a…`.
 *
 * `seed-demo.mjs` owns `de300000-`, and `seed-demo-catalogue.mjs --reset`
 * deletes everything under that prefix. A separate, recognisable prefix is what
 * keeps one seed's `--reset` from reaching another's rows — the hazard
 * AGENTS.md records between the two demo seeds.
 */
const NAMESPACE = 'ca7a';

/**
 * A deterministic UUID for (slug, role).
 *
 * UUIDv5-shaped: a SHA-1 of the name, with the version and variant bits set, so
 * it is a well-formed uuid Postgres accepts and two runs agree on. The first
 * four hex characters are replaced with the namespace marker so a row can be
 * recognised — and deleted — by prefix alone.
 */
function idFor(slug, role) {
  const hash = createHash('sha1').update(`injishi:catalogue:${role}:${slug}`).digest('hex');
  const bytes = hash.slice(0, 32).split('');
  // version 5
  bytes[12] = '5';
  // variant 10xx
  bytes[16] = '8';
  const hex = NAMESPACE + bytes.join('').slice(4);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * A TIN in the reserved `999` block, unique per slug.
 *
 * Nine digits, because that is the shape `orgs_tin_uk` and the RRA adapter
 * expect. `999` is the marker; the remaining six digits are derived from the
 * slug so the value is stable across runs and collisions are vanishingly
 * unlikely, and the unique index catches one if it happens.
 */
function reservedTin(slug) {
  const digits = BigInt(`0x${createHash('sha1').update(slug).digest('hex').slice(0, 12)}`) % 1000000n;
  return `999${String(digits).padStart(6, '0')}`;
}

/**
 * How a directory entry becomes a sellable room type.
 *
 * ONE room type per property, named for what the directory knows: a hotel sells
 * "rooms", an apartment sells "apartments". The catalogue does not describe a
 * property's room MIX — it carries one "from" rate and a room count — so
 * inventing three tiers with invented rates would be fabricating a rate card
 * for somebody's real business. One honest room type at the published rate is
 * what the source supports.
 *
 * `roomCount` is the denominator the availability hold counts against. A
 * property whose room count the directory does not carry gets 1, deliberately:
 * overselling a real hotel is worse than underselling it, and the number is
 * corrected the moment a host claims the business.
 */
function roomTypeFor(row) {
  const perClass = {
    apartment: { name: 'Apartment', checkIn: 'keypad' },
    villa: { name: 'Villa', checkIn: 'keypad' },
    lodge: { name: 'Lodge room', checkIn: 'front_desk' },
    tented_camp: { name: 'Tent', checkIn: 'front_desk' },
    guest_house: { name: 'Guest room', checkIn: 'front_desk' },
    motel: { name: 'Room', checkIn: 'front_desk' },
    hotel: { name: 'Standard room', checkIn: 'front_desk' },
  };
  const shape = perClass[row.kind] ?? { name: 'Room', checkIn: 'front_desk' };

  return {
    name: shape.name,
    checkInMethod: shape.checkIn,
    capacity: Math.max(1, Math.min(row.maxGuests ?? 2, 16)),
    roomCount: Math.max(1, Math.min(row.roomCount ?? 1, 60)),
    basePriceRwf: row.nightlyRateRwf,
    /*
     * `request_to_book`, uniformly, and this is a product call rather than a
     * default. Nobody at these businesses has agreed to sell a room on Injishi
     * yet. `instant_book` would confirm a stranger's reservation against real
     * inventory on nobody's authority; a request gives a human 24 hours to say
     * no, and auto-declines with a full refund if they never answer (F-B03).
     * The first host to claim their business can switch it.
     */
    bookingMode: 'request_to_book',
    approvalPolicy: 'approve_all',
    cancellationTier: 'moderate',
  };
}

/** The RDB accommodation class, mapped to a code the catalog actually holds. */
function accommodationClass(kind) {
  const known = new Set([
    'hotel', 'motel', 'tented_camp', 'guest_house',
    'apartment', 'lodge', 'villa', 'other',
  ]);
  return known.has(kind) ? kind : 'other';
}

async function main() {
  const reset = process.argv.includes('--reset');
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  await assertSampleDatabase(client, 'seed-catalogue.mjs');

  try {
    await client.query('BEGIN');

    if (reset) {
      /*
       * Ordered by dependency, and scoped to this script's id namespace so it
       * cannot reach another seed's rows — the hazard AGENTS.md records between
       * the two demo seeds, which share the `de300000-` block.
       *
       * Each table names the column that actually carries the namespace: `rooms`
       * has a generated id and is reached through its property, everything else
       * through its own. A `catch` and retry would be wrong here rather than
       * merely untidy — one failed statement aborts the whole transaction in
       * Postgres, so every delete after it would fail too and the reset would
       * report success having removed nothing.
       */
      const like = `${NAMESPACE}%`;
      const deletes = [
        ['listings', 'property_id'],
        ['rooms', 'property_id'],
        ['room_types', 'property_id'],
        ['properties', 'id'],
        ['workspaces', 'id'],
        ['orgs', 'id'],
      ];
      let removed = 0;
      for (const [table, column] of deletes) {
        const result = await client.query(
          `delete from ${table} where ${column}::text like $1`,
          [like],
        );
        removed += result.rowCount ?? 0;
      }
      await client.query('COMMIT');
      console.log(
        `Reset: removed ${removed} rows under the ${NAMESPACE}… namespace.`,
      );
      return;
    }

    const file = resolve(__dirname, 'data', 'catalogue.json');
    const { properties: rows } = JSON.parse(readFileSync(file, 'utf8'));

    // District names in the catalogue are slugs (`gasabo`, `musanze`); the
    // table holds display names. One lookup, so 52 properties cost one query.
    const { rows: districtRows } = await client.query('select id, name from districts');
    const districtBySlug = new Map(
      districtRows.map((d) => [d.name.toLowerCase().replace(/\s+/g, '-'), d.id]),
    );

    let written = 0;
    let skipped = 0;

    for (const row of rows) {
      /*
       * A property with no rate cannot be sold, so it is not seeded.
       *
       * Twelve of the fifty-two are like this — the directory has them but
       * never published a nightly rate. Writing a room type with a null price
       * would create inventory the booking service refuses at the last step
       * ("not priced for booking"), which is a worse answer than the property
       * simply not being listed.
       */
      if (row.nightlyRateRwf === null) {
        skipped += 1;
        continue;
      }

      const orgId = idFor(row.slug, 'org');
      const workspaceId = idFor(row.slug, 'workspace');
      const propertyId = idFor(row.slug, 'property');
      const roomTypeId = idFor(row.slug, 'room-type');
      const listingId = idFor(row.slug, 'listing');
      const districtId = districtBySlug.get(row.district) ?? null;

      // Every catalogue entry is fictional (see the header), not only `sample` ones.
      const legalName = `${row.name} (sample)`;

      await client.query(
        `insert into orgs (id, legal_name, domain, rdb_entity_group, accommodation_class,
                           chamber_of_tourism_member, tin, registration_status,
                           district_id, address_text, business_kind)
         values ($1, $2, 'hospitality', 'accommodation', $3, false, $4, 'active', $5, $6, $7)
         on conflict (id) do nothing`,
        [
          orgId,
          legalName,
          accommodationClass(row.kind),
          reservedTin(row.slug),
          districtId,
          row.addressLines ? row.addressLines.join(', ') : null,
          businessKindFor({ domain: 'hospitality', accommodationClass: accommodationClass(row.kind) }),
        ],
      );

      await client.query(
        `insert into workspaces (id, kind, org_id) values ($1, 'business', $2)
         on conflict (id) do nothing`,
        [workspaceId, orgId],
      );

      await client.query(
        `insert into properties (id, org_id, workspace_id, slug, name, description,
                                 district_id, latitude, longitude, location_privacy,
                                 check_in_time, check_out_time)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, '14:00', '11:00')
         on conflict (id) do update set slug = excluded.slug, name = excluded.name`,
        [
          propertyId,
          orgId,
          workspaceId,
          row.slug,
          row.name,
          row.summary ?? null,
          districtId,
          row.latitude === null ? null : String(row.latitude),
          row.longitude === null ? null : String(row.longitude),
        ],
      );

      const rt = roomTypeFor(row);
      await client.query(
        `insert into room_types (id, property_id, workspace_id, name, domain, capacity,
                                 room_count, base_price_rwf, currency, booking_mode,
                                 approval_policy, cancellation_tier,
                                 nonrefundable_eligible, min_stay, check_in_method, status)
         values ($1, $2, $3, $4, 'hospitality', $5, $6, $7, 'RWF', $8, $9, $10,
                 true, 1, $11, 'active')
         on conflict (id) do update set base_price_rwf = excluded.base_price_rwf,
                                        room_count = excluded.room_count,
                                        capacity = excluded.capacity`,
        [
          roomTypeId,
          propertyId,
          workspaceId,
          rt.name,
          rt.capacity,
          rt.roomCount,
          rt.basePriceRwf,
          rt.bookingMode,
          rt.approvalPolicy,
          rt.cancellationTier,
          rt.checkInMethod,
        ],
      );

      // One `rooms` row per bookable unit: this is the inventory the atomic
      // hold in `BookingRepository.create` counts against, and a room type with
      // no rooms is a room type that can never be sold.
      for (let i = 1; i <= rt.roomCount; i += 1) {
        await client.query(
          `insert into rooms (room_type_id, property_id, workspace_id, label, status)
           select $1, $2, $3, $4, 'available'
           where not exists (
             select 1 from rooms where room_type_id = $1 and label = $4
           )`,
          [roomTypeId, propertyId, workspaceId, `${rt.name} ${i}`],
        );
      }

      await client.query(
        `insert into listings (id, property_id, workspace_id, status, published_at, version)
         values ($1, $2, $3, 'published', now(), 1)
         on conflict (id) do update set status = 'published'`,
        [listingId, propertyId, workspaceId],
      );

      written += 1;
    }

    await client.query('COMMIT');

    console.log(`Seeded ${written} bookable properties from the catalogue.`);
    if (skipped > 0) {
      console.log(
        `  ${skipped} skipped: the directory carries no nightly rate for them, ` +
          'so there is nothing to sell.',
      );
    }
    console.log(
      '  Every org carries a TIN in the reserved 999 block and is NOT a real ' +
        'tax identity. Sample entries also say "(sample)" in their legal name.',
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
