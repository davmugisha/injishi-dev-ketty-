// Seed the platform's initial marketplace content (F-S04 inventory, F-B15).
//
// This promotes the prototype-capture copy (Umurage Guesthouse — the content the
// public /property page shipped as static markup) into real rows:
//
//   rdb_classifications → orgs → workspaces → properties → room_types → rooms → listings
//
// IDs are deterministic constants (not gen_random_uuid) so the web seed module
// and this script agree on the same room_type ids without a generated file, and
// so re-running is a no-op. Idempotent: every insert is ON CONFLICT DO NOTHING.
//
// Run with:  pnpm --filter @injishi/api exec node scripts/seed-content.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(resolve(__dirname, '../.env'), 'utf8');
  const m = env.match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error('DATABASE_URL not set and not found in server/api/.env');
  return m[1].trim();
}

// --- Deterministic ids (mirrored in apps/web/src/data/seed/properties.ts) ---
export const IDS = {
  org: '0f9a1b00-0000-4000-8000-000000000001',
  workspace: '0f9a1b00-0000-4000-8000-000000000002',
  property: '0f9a1b00-0000-4000-8000-000000000003',
  listing: '0f9a1b00-0000-4000-8000-000000000004',
  roomTypeStandard: '0f9a1b00-0000-4000-8000-000000000101',
  roomTypeDeluxe: '0f9a1b00-0000-4000-8000-000000000102',
  roomTypeSuite: '0f9a1b00-0000-4000-8000-000000000103',
  // Rate plans. The FLEXIBLE ids are fixed because the non-refundable plans
  // derive from them and a derivation needs its parent by id.
  flexStandard: '0f9a1b00-0000-4000-8000-000000000201',
  flexDeluxe: '0f9a1b00-0000-4000-8000-000000000202',
  flexSuite: '0f9a1b00-0000-4000-8000-000000000203',
  nonRefStandard: '0f9a1b00-0000-4000-8000-000000000211',
  nonRefDeluxe: '0f9a1b00-0000-4000-8000-000000000212',
  // The residence side. The ORG is seeded by `seed-users.mjs` (it has to be:
  // the landlord's workspace has to be something) and everything under it is
  // seeded here, because this is the script that owns content.
  residenceOrg: '0f9a1b00-0002-4000-8000-000000000001',
  residenceProperty: '0f9a1b00-0002-4000-8000-000000000301',
  residenceUnitType: '0f9a1b00-0002-4000-8000-000000000302',
  leaseActive: '0f9a1b00-0002-4000-8000-000000000401',
  leaseEnding: '0f9a1b00-0002-4000-8000-000000000402',
  leaseAwaiting: '0f9a1b00-0002-4000-8000-000000000403',
};

/** §1 entity groups + §2 accommodation classes + §3 residence classes
 *  (dox_context/rdb-classification.md). The catalog table is empty on a fresh
 *  DB; orgs.accommodation_class FKs into it, so it must exist first. */
const RDB = [
  // entity groups
  ['accommodation', 'entity_group', null, 'Accommodation establishments'],
  ['restaurant_bar_nightclub', 'entity_group', null, 'Restaurants, bars & nightclubs'],
  ['travel_services', 'entity_group', null, 'Travel services'],
  ['tourism_information_center', 'entity_group', null, 'Tourism information centers'],
  ['cultural_tourism', 'entity_group', null, 'Cultural tourism entities'],
  // accommodation classes — the 8 the registration wizard offers as cards (D24)
  ['hotel', 'accommodation_class', 'accommodation', 'Hotel'],
  ['motel', 'accommodation_class', 'accommodation', 'Motel'],
  ['tented_camp', 'accommodation_class', 'accommodation', 'Tented Camp'],
  ['guest_house', 'accommodation_class', 'accommodation', 'Guest House'],
  ['apartment', 'accommodation_class', 'accommodation', 'Apartment'],
  ['lodge', 'accommodation_class', 'accommodation', 'Lodge'],
  ['villa', 'accommodation_class', 'accommodation', 'Villa'],
  ['other', 'accommodation_class', 'accommodation', 'Other'],
  // Retired RDB codes (D24). Kept and SOFT-RETIRED rather than deleted: an org
  // may still reference one, and the catalog's whole point is that a vocabulary
  // change does not erase history. `active = false` hides them from the picker.
  ['town_hotel', 'accommodation_class', 'accommodation', 'Town Hotel', false],
  ['vacation_hotel_resort', 'accommodation_class', 'accommodation', 'Vacation Hotel & Resort', false],
  ['serviced_apartment', 'accommodation_class', 'accommodation', 'Serviced Apartment', false],
  ['cottage', 'accommodation_class', 'accommodation', 'Cottage', false],
  // residence classes
  ['residential_landlord', 'residence_class', null, 'Residential landlord'],
  ['residential_property_manager', 'residence_class', null, 'Residential property manager'],
];

/** Room types, mirroring apps/web/src/data/seed/properties.ts. */
const ROOM_TYPES = [
  {
    id: IDS.roomTypeStandard,
    name: 'Standard Room',
    capacity: 2,
    roomCount: 3,
    basePriceRwf: 155_000,
    bookingMode: 'request_to_book',
    approvalPolicy: 'approve_first_three',
    cancellationTier: 'moderate',
  },
  {
    id: IDS.roomTypeDeluxe,
    name: 'Deluxe Room',
    capacity: 3,
    roomCount: 2,
    basePriceRwf: 175_000,
    bookingMode: 'request_to_book',
    approvalPolicy: 'approve_first_three',
    cancellationTier: 'moderate',
  },
  {
    id: IDS.roomTypeSuite,
    name: 'Garden Suite',
    capacity: 4,
    roomCount: 1,
    basePriceRwf: 240_000,
    bookingMode: 'instant_book',
    // approval_policy is a sub-field of request_to_book only (F-B03); the
    // room_types_approval_policy_shape check rejects it on instant_book.
    approvalPolicy: null,
    cancellationTier: 'flexible',
  },
];

async function main() {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  // ADR-043: sample data only ever goes into a database marked sample.
  await assertSampleDatabase(client, 'seed-content.mjs');

  try {
    await client.query('BEGIN');

    // 1. RDB catalog. label_rw is NOT NULL; Kinyarwanda copy is not authored yet
    // (F-A20 localization owns it), so seed the English string as the placeholder.
    for (const [code, kind, parent, labelEn, active = true] of RDB) {
      await client.query(
        `insert into rdb_classifications (code, kind, parent_code, label_en, label_rw, active)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (code) do update set active = excluded.active`,
        [code, kind, parent, labelEn, labelEn, active],
      );
    }

    // 1b. The national tax rates (ADR-016 D-m, AC-5).
    //
    // Reference data, not a fixture: these are Rwanda's VAT codes, the same for
    // every property, which is why `config_entries` carries no workspace column.
    // A folio charge REFUSES to post when no row is effective rather than
    // defaulting to 18%, so this row is what makes charging work at all on a
    // fresh database.
    //
    // Effective dated on purpose. A rate change is an operator action with a
    // date, never a deploy: the new rate gets a new row and posted charges keep
    // the rate they snapshotted.
    await client.query(
      `insert into config_entries (config_type, value, effective_from, version, locked_on_use)
       select 'tax_rates', $1::jsonb, now(), 1, true
       where not exists (
         select 1 from config_entries where config_type = 'tax_rates'
       )`,
      [JSON.stringify({ TAX_A: 0, TAX_B: 0.18, TAX_C: 0, TAX_D: 0 })],
    );

    // 2. District for Kacyiru, Kigali → Gasabo.
    const d = await client.query(
      `select id from districts where lower(name) = 'gasabo' limit 1`,
    );
    const districtId = d.rows[0]?.id ?? null;
    if (!districtId) {
      console.warn('! Gasabo district not found — seed geography first. Continuing with null district.');
    }

    // 3. Org (hospitality; accommodation_class is required by the check constraint).
    //    Umurage is a city guesthouse, which the D24 card set now names directly
    //    — it no longer has to borrow `town_hotel`.
    await client.query(
      `insert into orgs (id, legal_name, domain, rdb_entity_group, accommodation_class,
                         tourism_license_number, chamber_of_tourism_member, tin,
                         registration_status, district_id, address_text)
       values ($1, $2, 'hospitality', 'accommodation', 'guest_house',
               $3, true, $4, 'active', $5, $6)
       on conflict (id) do nothing`,
      [
        IDS.org,
        'Umurage Hospitality Ltd',
        'TRL-2025-0142',
        '102345678', // TIN (unique)
        districtId,
        'KG 7 Ave, Kacyiru, Kigali',
      ],
    );

    // 4. Business workspace for the org.
    await client.query(
      `insert into workspaces (id, kind, org_id) values ($1, 'business', $2)
       on conflict (id) do nothing`,
      [IDS.workspace, IDS.org],
    );

    // 5. Property.
    await client.query(
      `insert into properties (id, org_id, workspace_id, name, description, district_id,
                               latitude, longitude, location_privacy, check_in_time,
                               check_out_time, house_rules)
       values ($1, $2, $3, $4, $5, $6, $7, $8, false, $9, $10, $11)
       on conflict (id) do nothing`,
      [
        IDS.property,
        IDS.org,
        IDS.workspace,
        'Umurage Guesthouse',
        'Umurage Guesthouse, launched in 2025, redefines the high-performance ' +
          'guesthouse experience in Kacyiru. Its open-plan lounge features a chic ' +
          'sitting area, a stylish dining section, a breakfast room, and an elegant ' +
          'garden. Outside: a courtyard, a shared breakfast terrace and a rooftop ' +
          'terrace. Enjoy a brand-new guesthouse in the heart of Kigali.',
        districtId,
        '-1.9441',
        '30.0619',
        '14:00',
        '11:00',
        'No smoking indoors. Quiet hours after 22:00. Valid ID required at check-in.',
        // The two `/assets/...webp` paths that used to sit here were NOT object
        // keys. They were front end asset paths written into a column that was
        // supposed to hold `stored_objects` keys, which is why migration 0040 had
        // to skip them when photographs became rows with a foreign key. Nothing
        // replaces them: this seed has no bytes to put in the bucket.
      ],
    );

    // 6. Room types + their bookable rooms.
    for (const rt of ROOM_TYPES) {
      await client.query(
        `insert into room_types (id, property_id, workspace_id, name, domain, capacity,
                                 room_count, base_price_rwf, currency, booking_mode,
                                 approval_policy, cancellation_tier, nonrefundable_eligible,
                                 min_stay, check_in_method)
         values ($1, $2, $3, $4, 'hospitality', $5, $6, $7, 'RWF', $8, $9, $10, true, 1, 'front_desk')
         on conflict (id) do nothing`,
        [
          rt.id,
          IDS.property,
          IDS.workspace,
          rt.name,
          rt.capacity,
          rt.roomCount,
          rt.basePriceRwf,
          rt.bookingMode,
          rt.approvalPolicy,
          rt.cancellationTier,
        ],
      );

      // One `rooms` row per bookable unit (inventory the atomic hold counts).
      for (let i = 1; i <= rt.roomCount; i++) {
        await client.query(
          `insert into rooms (room_type_id, property_id, workspace_id, label, status)
           select $1, $2, $3, $4, 'available'
           where not exists (
             select 1 from rooms where room_type_id = $1 and label = $4
           )`,
          [rt.id, IDS.property, IDS.workspace, `${rt.name} ${i}`],
        );
      }
    }

    /*
     * 6b. Rate plans (ADR-035, wave 2 follow-up).
     *
     * `rate_plans` is one of the richest tables in the schema and NOTHING
     * seeded it, so the Rate plans lens had nothing to show even once its
     * endpoint existed.
     *
     * Each room type gets a DEFAULT flexible plan carrying the room type's own
     * price. `room_types.base_price_rwf` is deprecated in favour of this row
     * (F-L03) and the two are seeded to the same number on purpose: a reader
     * comparing them must not see a contradiction.
     *
     * The two cheaper room types also get a DERIVED non-refundable plan at ten
     * percent off. That relationship is the point of the feature — the child
     * MOVES when the parent moves — and a seed with no derived plan would let
     * the screen ship without ever rendering one.
     */
    const RATE_PLANS = [
      { id: IDS.flexStandard, roomTypeId: IDS.roomTypeStandard, name: 'Flexible', isDefault: true,
        priceRwf: 155_000, singleRwf: 130_000, baseOccupancy: 2, tier: 'moderate',
        nonRefundable: false, mode: 'request_to_book', minStay: 1, maxStay: 14,
        parentId: null, kind: null, value: null },
      { id: IDS.nonRefStandard, roomTypeId: IDS.roomTypeStandard, name: 'Non-refundable', isDefault: false,
        priceRwf: 139_500, singleRwf: 117_000, baseOccupancy: 2, tier: null,
        nonRefundable: true, mode: 'request_to_book', minStay: 1, maxStay: 14,
        parentId: IDS.flexStandard, kind: 'percentage', value: '-10' },
      { id: IDS.flexDeluxe, roomTypeId: IDS.roomTypeDeluxe, name: 'Flexible', isDefault: true,
        priceRwf: 175_000, singleRwf: 150_000, baseOccupancy: 2, tier: 'moderate',
        nonRefundable: false, mode: 'request_to_book', minStay: 1, maxStay: 21,
        parentId: null, kind: null, value: null },
      { id: IDS.nonRefDeluxe, roomTypeId: IDS.roomTypeDeluxe, name: 'Non-refundable', isDefault: false,
        priceRwf: 157_500, singleRwf: 135_000, baseOccupancy: 2, tier: null,
        nonRefundable: true, mode: 'request_to_book', minStay: 1, maxStay: 21,
        parentId: IDS.flexDeluxe, kind: 'percentage', value: '-10' },
      { id: IDS.flexSuite, roomTypeId: IDS.roomTypeSuite, name: 'Flexible', isDefault: true,
        priceRwf: 240_000, singleRwf: 210_000, baseOccupancy: 2, tier: 'flexible',
        nonRefundable: false, mode: 'instant_book', minStay: 2, maxStay: null,
        parentId: null, kind: null, value: null },
    ];

    // Parents first, so a child's `parent_rate_plan_id` always resolves.
    for (const rp of [...RATE_PLANS].sort((a, b) => Number(a.parentId !== null) - Number(b.parentId !== null))) {
      await client.query(
        `insert into rate_plans (id, room_type_id, workspace_id, name, status, is_default,
                                 base_price_rwf, currency, base_occupancy,
                                 single_occupancy_price_rwf, cancellation_tier,
                                 non_refundable, booking_mode, min_stay, max_stay,
                                 parent_rate_plan_id, derivation_kind, derivation_value)
         values ($1, $2, $3, $4, 'active', $5, $6, 'RWF', $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         on conflict (id) do nothing`,
        [
          rp.id, rp.roomTypeId, IDS.workspace, rp.name, rp.isDefault,
          rp.priceRwf, rp.baseOccupancy, rp.singleRwf, rp.tier,
          rp.nonRefundable, rp.mode, rp.minStay, rp.maxStay,
          rp.parentId, rp.kind, rp.value,
        ],
      );
    }

    // 7. Published listing (what Explore / the detail page read).
    await client.query(
      `insert into listings (id, property_id, workspace_id, status, published_at, version)
       values ($1, $2, $3, 'published', now(), 1)
       on conflict (id) do nothing`,
      [IDS.listing, IDS.property, IDS.workspace],
    );

    /*
     * 7b. The property's USALI departments (ADR-035, D-a).
     *
     * WHY THIS IS HERE AT ALL. Migration 0011 seeds these eleven rows for every
     * property that EXISTS WHEN IT RUNS. On a fresh database the migrations run
     * before any seed, so the backfill sweeps an empty `properties` table and
     * this property is born with none.
     *
     * That was invisible while the operator app read its departments out of
     * `data/demo.ts`. It is not invisible any more: the nav's sections come
     * from these rows now, so a property with no departments is a property with
     * no Services door and no Maintenance leaf — correct behaviour, wrong data.
     *
     * Two other things depend on them, and both fail closed rather than loudly:
     * `folio_charges.department_id` is a required foreign key, so no revenue
     * charge can post without a department to point at; and a room charge looks
     * up the `rooms` department by category.
     *
     * The list is the same eleven the migration writes, in the same order, with
     * the same names, types, revenue-centre flags and sort order. It is copied
     * rather than shared because a migration is frozen history and a seed is
     * current fixture; if they ever need to differ, they can.
     */
    const USALI_DEPARTMENTS = [
      ['Rooms', 'operated', 'rooms', true, true, 10],
      ['Food and Beverage', 'operated', 'fnb', true, true, 20],
      ['Spa and Recreation', 'operated', 'spa_recreation', true, true, 30],
      ['Other Operated Departments', 'operated', 'other_operated', true, false, 40],
      ['Miscellaneous Income', 'operated', 'misc_income', true, false, 50],
      ['Administrative and General', 'undistributed', 'admin_general', false, false, 60],
      ['Sales and Marketing', 'undistributed', 'sales_marketing', false, false, 70],
      ['Information and Telecommunications', 'undistributed', 'it', false, false, 80],
      ['Engineering and Maintenance', 'undistributed', 'engineering', false, true, 90],
      ['Utilities', 'undistributed', 'utilities', false, false, 100],
      ['Human Resources', 'undistributed', 'hr', false, false, 110],
    ];

    for (const [
      name,
      deptType,
      deptCategory,
      isRevenue,
      guestRequestable,
      sortOrder,
    ] of USALI_DEPARTMENTS) {
      // `departments_property_category_uk` is one row per category per
      // property, which is what makes a re-run a no-op rather than a doubling.
      await client.query(
        `insert into departments (
           org_id, property_id, workspace_id, name,
           department_type, department_category,
           is_revenue_center, guest_requestable, sort_order
         )
         values ($1, $2, $3, $4, $5::department_type, $6::department_category, $7, $8, $9)
         on conflict do nothing`,
        [
          IDS.org,
          IDS.property,
          IDS.workspace,
          name,
          deptType,
          deptCategory,
          isRevenue,
          guestRequestable,
          sortOrder,
        ],
      );
    }

    /*
     * 7c. A service menu, so the Services screens have something to be
     * (ADR-035, D-f wave 2).
     *
     * `/ops/service-catalog` and `/ops/service-orders` are wired and answer,
     * and against a freshly seeded database they answer with nothing, so both
     * lenses render their honest empty state and neither can be looked at. A
     * property with departments and no catalog is a real state, just not one
     * worth seeding a demo into.
     *
     * The names are deliberately the ones `pms/lib/media.ts` already holds
     * photographs for. That gallery exists to make a MISSING photo visible,
     * and seeding items it has no picture for would show the gap rather than
     * the screen.
     *
     * Items only, no orders. An order hangs off a real guest stay, and
     * inventing one would put a fictional guest on a real folio.
     */
    const FNB_CATEGORY = '0f9a1b00-0000-4000-8000-000000000201';
    const [fnbDept] = (
      await client.query(
        `select id from departments
         where property_id = $1 and department_category = 'fnb' limit 1`,
        [IDS.property],
      )
    ).rows;

    if (fnbDept) {
      await client.query(
        `insert into service_categories
           (id, department_id, property_id, workspace_id, name, sort_order, guest_visible)
         values ($1, $2, $3, $4, 'Room service', 10, true)
         on conflict (id) do nothing`,
        [FNB_CATEGORY, fnbDept.id, IDS.property, IDS.workspace],
      );

      const MENU = [
        ['Continental breakfast', 'Pastries, fruit, juice and coffee.', 12000, 25],
        ['Club sandwich', 'Chicken, bacon, egg and salad, with fries.', 9500, 20],
        ['Chicken brochette', 'Grilled skewers with plantain.', 11000, 30],
        ['Fresh juice', 'Pressed to order.', 3500, 8],
        ['Fanta', 'Chilled, 300ml.', 1500, 3],
        ['Espresso', 'Single or double.', 2500, 5],
        ['House wine', 'A glass of red or white.', 6000, 5],
      ];

      for (const [name, description, priceRwf, prepTimeMinutes] of MENU) {
        await client.query(
          `insert into service_items
             (service_category_id, department_id, property_id, workspace_id,
              name, description, price_rwf, prep_time_minutes)
           select $1, $2, $3, $4, $5, $6, $7, $8
           where not exists (
             select 1 from service_items
             where service_category_id = $1 and name = $5
           )`,
          [
            FNB_CATEGORY,
            fnbDept.id,
            IDS.property,
            IDS.workspace,
            name,
            description,
            priceRwf,
            prepTimeMinutes,
          ],
        );
      }
    } else {
      console.warn('! No fnb department on the property, so no menu was seeded.');
    }

    /*
     * 7d. The platform amenity catalogue (ADR-035, D-f wave 2).
     *
     * `amenities` is a SHARED catalogue with no workspace: every property picks
     * from the same coded vocabulary, which is what lets a listing publish to a
     * booking channel in both languages. Free text has nothing to translate and
     * nothing to map.
     *
     * It was empty, so `GET /ops/amenities` answered with an empty list and the
     * Amenities screen had nothing to show. The vocabulary already existed —
     * coded, bilingual and grouped — in the operator app's
     * `pms/data/catalog.ts`, which is where these 31 rows come from.
     *
     * TWO THINGS THIS DOES NOT CARRY, both deliberate:
     *
     *  - `ota_code` is null on every row. The column's own comment says a
     *    Rwanda specific entry MUST declare its nearest OpenTravel equivalent
     *    (F-L06), and nobody has mapped them. Inventing a mapping would put a
     *    wrong code on a channel feed, which is worse than an absent one. Owed.
     *  - The app catalogue tags each entry `p` (whole property) or `r` (in the
     *    room). The table has no scope column and `OperatorAmenity` has no room
     *    scope, so the tag is dropped here — which is the same finding the
     *    screen acts on by not offering room type tabs.
     */
    const AMENITY_CATALOGUE = [
  ['wifi', "Essentials", "Wi-Fi", "Interineti ya Wi-Fi"],
  ['tv', "Essentials", "Flat-screen TV", "Televiziyo"],
  ['desk', "Essentials", "Work desk", "Ameza yo gukorera"],
  ['net', "Essentials", "Mosquito net", "Inzitiramibu"],
  ['ac', "Essentials", "Air conditioning", "Icyuma gikonjesha"],
  ['wardrobe', "Essentials", "Wardrobe", "Akabati k'imyenda"],
  ['hotwater', "Bathroom", "Hot water", "Amazi ashyushye"],
  ['shower', "Bathroom", "Walk-in shower", "Dushe"],
  ['towels', "Bathroom", "Towels & linens", "Amashuka n'ibitambaro"],
  ['hairdry', "Bathroom", "Hair dryer", "Icyuma cyumisha umusatsi"],
  ['toiletries', "Bathroom", "Toiletries", "Ibikoresho by'isuku"],
  ['breakfast', "Food & drink", "Breakfast available", "Ifunguro rya mu gitondo"],
  ['restaurant', "Food & drink", "Restaurant", "Resitora"],
  ['kettle', "Food & drink", "Electric kettle", "Ibirika ry'amashanyarazi"],
  ['fridge', "Food & drink", "Mini-fridge", "Firigo ntoya"],
  ['water', "Food & drink", "Bottled water", "Amazi yo kunywa"],
  ['garden', "Outdoors & views", "Garden", "Ubusitani"],
  ['terrace', "Outdoors & views", "Terrace", "Varanda"],
  ['pool', "Outdoors & views", "Swimming pool", "Ipisine"],
  ['parking', "Outdoors & views", "Free parking", "Aho guhagarika imodoka ku buntu"],
  ['view', "Outdoors & views", "Lake or hill view", "Ahareba ikiyaga cyangwa imisozi"],
  ['laundry', "Services", "Laundry service", "Serivisi yo kumesa"],
  ['shuttle', "Services", "Airport shuttle", "Gutwara ku kibuga cy'indege"],
  ['front24', "Services", "24-hour front desk", "Icyakira abashyitsi amasaha 24"],
  ['housekeeping', "Services", "Daily housekeeping", "Isuku ya buri munsi"],
  ['momo', "Services", "Mobile money accepted", "Kwishyura kuri mobile money"],
  ['smoke', "Safety", "Smoke alarm", "Icyuma kimenya umwotsi"],
  ['safe', "Safety", "In-room safe", "Agasanduku k'umutekano"],
  ['guard', "Safety", "Security on site", "Umuzamu w'umutekano"],
  ['generator', "Safety", "Backup generator", "Jeneratori y'ingoboka"],
  ['firstaid', "Safety", "First-aid kit", "Agasanduku k'ubutabazi"],
    ];

    for (const [code, category, labelEn, labelRw] of AMENITY_CATALOGUE) {
      await client.query(
        `insert into amenities (code, category, label_en, label_rw, active)
         values ($1, $2, $3, $4, true)
         on conflict (code) do update
           set category = excluded.category,
               label_en = excluded.label_en,
               label_rw = excluded.label_rw`,
        [code, category, labelEn, labelRw],
      );
    }

    // 8. Registration fee catalog (D21 §8.3a, D23).
    //    DEV DEFAULTS ONLY. Real amounts are admin-set config (F-A10) and the
    //    per-type prices are still open (O-11). ADR-026 sets all three to 5,000
    //    RWF as an assumed decision; the broker row is seeded but unread while
    //    a broker registration is free (ADR-026, assumption 2).
    //    The catalog is effective-dated and APPEND-ONLY: changing a price
    //    INSERTS a row rather than updating one, so the old price stays
    //    readable against the registrations that were quoted it. The guard is
    //    therefore on the AMOUNT and not merely on the type — guarding on the
    //    type alone means a re-run can never correct a price, which is how the
    //    catalog carried 50,000 after the decision said 5,000.
    for (const [businessType, amountRwf] of [
      ['hospitality', 5000],
      ['residence', 5000],
      ['broker', 5000],
    ]) {
      await client.query(
        `insert into registration_fees (business_type, amount_rwf, effective_from, active)
         select $1::registration_business_type, $2, now(), true
         where not exists (
           select 1 from registration_fees
           where business_type = $1::registration_business_type
             and active = true
             and amount_rwf = $2
             and effective_from <= now()
         )`,
        [businessType, amountRwf],
      );
    }

    /*
     * 12. The residence side: a building, three units, three leases (ADR-035,
     * D-f wave 2 follow-up).
     *
     * **The residence org existed with nothing under it.** `seed-users.mjs`
     * creates it so the landlord's workspace has something to be, but no
     * property, no unit and no lease, so Leases, Rent roll, Move-outs and the
     * Lease record all answered 200 with an empty array. Four live screens that
     * can never be looked at are no better than four unwired ones.
     *
     * THE THREE LEASES ARE THREE STAGES ON PURPOSE. One `active` with rent
     * months behind it, one `ending` with a settled deposit, one
     * `pending_signature` carrying a single signature. The board has five
     * columns and the record has seven lenses; a seed with one lease in one
     * state exercises neither.
     *
     * Skipped entirely when the org is absent, so this script still runs on a
     * database where only the marketplace was seeded.
     */
    const resOrg = await client.query('select id from orgs where id = $1', [
      IDS.residenceOrg,
    ]);

    if (resOrg.rowCount > 0) {
      // The workspace is created by `seed-users.mjs` with a generated id, so it
      // is looked up rather than assumed.
      const resWs = await client.query(
        `select id from workspaces where kind = 'business' and org_id = $1 limit 1`,
        [IDS.residenceOrg],
      );

      if (resWs.rowCount > 0) {
        const residenceWorkspace = resWs.rows[0].id;

        await client.query(
          `insert into properties (id, org_id, workspace_id, name, description, district_id,
                                   latitude, longitude, location_privacy, check_in_time,
                                   check_out_time, house_rules)
           values ($1, $2, $3, $4, $5, $6, -1.9520, 30.0930, false, null, null, $7)
           on conflict (id) do nothing`,
          [
            IDS.residenceProperty,
            IDS.residenceOrg,
            residenceWorkspace,
            'Kigali Heights Residences',
            'Nine long-let apartments on two floors in Kimihurura, let unfurnished ' +
              'on twelve month terms.',
            101,
            'No subletting. Rent is due on the first of the month. Notice is one month.',
          ],
        );

        /*
         * A UNIT IS A `rooms` ROW, not a room type of its own.
         *
         * `leases.room_id` points at `rooms`, so a unit has to be one. The room
         * TYPE above it is the shape they share — a two bedroom apartment —
         * which is what a room type is for on the hospitality side too.
         */
        await client.query(
          `insert into room_types (id, property_id, workspace_id, name, domain, capacity,
                                   room_count, base_price_rwf, currency, booking_mode,
                                   approval_policy, cancellation_tier, nonrefundable_eligible,
                                   min_stay, check_in_method)
           values ($1, $2, $3, 'Two-bedroom apartment', 'residence', 4, 3, 450000, 'RWF',
                   'request_to_book', 'approve_first_three', null, false, 30, 'keypad')
           on conflict (id) do nothing`,
          [IDS.residenceUnitType, IDS.residenceProperty, residenceWorkspace],
        );

        const unitIds = [];
        for (const label of ['A1', 'A2', 'B1']) {
          const existing = await client.query(
            'select id from rooms where room_type_id = $1 and label = $2',
            [IDS.residenceUnitType, label],
          );
          if (existing.rowCount > 0) {
            unitIds.push(existing.rows[0].id);
            continue;
          }
          const made = await client.query(
            `insert into rooms (room_type_id, property_id, workspace_id, label, status)
             values ($1, $2, $3, $4, 'available') returning id`,
            [IDS.residenceUnitType, IDS.residenceProperty, residenceWorkspace, label],
          );
          unitIds.push(made.rows[0].id);
        }

        /*
         * `leases_active_room_uk` allows ONE active lease per unit, so each of
         * the three below sits on its own unit. Two active leases on A1 would
         * not be a richer seed, it would be a failed insert.
         */
        const LEASES = [
          {
            id: IDS.leaseActive,
            roomId: unitIds[0],
            tenant: 'Chantal Mukamana',
            email: 'chantal.mukamana@example.rw',
            phone: '+250788110022',
            rent: 450000,
            caution: 450000,
            start: '2026-01-01',
            end: '2026-12-31',
            status: 'active',
            landlordSigned: '2025-12-18',
            tenantSigned: '2025-12-19',
          },
          {
            id: IDS.leaseEnding,
            roomId: unitIds[1],
            tenant: 'Eric Habimana',
            email: 'eric.habimana@example.rw',
            phone: '+250788110033',
            rent: 420000,
            caution: 420000,
            start: '2025-10-01',
            end: '2026-09-30',
            status: 'ending',
            landlordSigned: '2025-09-20',
            tenantSigned: '2025-09-21',
          },
          {
            id: IDS.leaseAwaiting,
            roomId: unitIds[2],
            tenant: 'Solange Ingabire',
            email: 'solange.ingabire@example.rw',
            phone: '+250788110044',
            rent: 470000,
            caution: 470000,
            start: '2026-10-01',
            end: '2027-09-30',
            status: 'pending_signature',
            // Only the landlord has signed. WHICH signature is missing is the
            // one useful fact on a lease stuck at this stage.
            landlordSigned: '2026-09-01',
            tenantSigned: null,
          },
        ];

        for (const l of LEASES) {
          await client.query(
            `insert into leases (id, room_id, org_id, workspace_id, monthly_rent_rwf,
                                 caution_rwf, currency, start_date, end_date, status,
                                 landlord_signed_at, tenant_signed_at, tenant_name,
                                 tenant_email, tenant_phone)
             values ($1, $2, $3, $4, $5, $6, 'RWF', $7, $8, $9, $10, $11, $12, $13, $14)
             on conflict (id) do nothing`,
            [
              l.id, l.roomId, IDS.residenceOrg, residenceWorkspace, l.rent,
              l.caution, l.start, l.end, l.status,
              l.landlordSigned, l.tenantSigned, l.tenant, l.email, l.phone,
            ],
          );
        }

        /*
         * RENT MONTHS, one row per period. `rent_charges_lease_period_uk` is
         * what makes the period mandatory on a payment: "apply it to the oldest
         * unpaid month" is the source of the worst disputes in this domain.
         */
        const RENT = [
          { lease: IDS.leaseActive, month: '2026-07-01', amount: 450000, paid: 450000, status: 'paid' },
          { lease: IDS.leaseActive, month: '2026-08-01', amount: 450000, paid: 450000, status: 'paid' },
          { lease: IDS.leaseActive, month: '2026-09-01', amount: 450000, paid: 0, status: 'due' },
          { lease: IDS.leaseEnding, month: '2026-07-01', amount: 420000, paid: 420000, status: 'paid' },
          { lease: IDS.leaseEnding, month: '2026-08-01', amount: 420000, paid: 200000, status: 'overdue' },
          { lease: IDS.leaseEnding, month: '2026-09-01', amount: 420000, paid: 0, status: 'due' },
        ];

        for (const r of RENT) {
          await client.query(
            `insert into rent_charges (lease_id, period_month, amount_rwf, paid_amount_rwf,
                                       currency, status, due_date, paid_at)
             select $1, $2, $3, $4, 'RWF', $5::rent_status, $2,
                    case when $5 = 'paid' then now() else null end
             where not exists (
               select 1 from rent_charges where lease_id = $1 and period_month = $2
             )`,
            [r.lease, r.month, r.amount, r.paid, r.status],
          );
        }

        /*
         * CAUTIONS. The active lease's is still held; the ending lease's is
         * settled with a deduction and a REASON, which is the fact the Caution
         * lens exists to show and the one the demo store could not carry.
         */
        const HOLDS = [
          { lease: IDS.leaseActive, amount: 450000, status: 'held' },
          { lease: IDS.leaseEnding, amount: 420000, status: 'refunded' },
        ];

        for (const h of HOLDS) {
          await client.query(
            `insert into caution_holds (lease_id, amount_rwf, currency, status, held_at)
             select $1, $2, 'RWF', $3::caution_status, now()
             where not exists (select 1 from caution_holds where lease_id = $1)`,
            [h.lease, h.amount, h.status],
          );
        }

        const endingHold = await client.query(
          'select id from caution_holds where lease_id = $1 limit 1',
          [IDS.leaseEnding],
        );
        if (endingHold.rowCount > 0) {
          await client.query(
            `insert into caution_settlements (lease_id, caution_hold_id, refunded_rwf,
                                              forfeited_rwf, currency, reason, settled_at)
             select $1, $2, 350000, 70000, 'RWF', $3, now()
             where not exists (
               select 1 from caution_settlements where lease_id = $1
             )`,
            [
              IDS.leaseEnding,
              endingHold.rows[0].id,
              'Repainting the living room and replacing two interior door handles.',
            ],
          );
        }
      }
    }

    await client.query('COMMIT');

    const counts = {};
    for (const t of ['rdb_classifications', 'config_entries', 'registration_fees', 'orgs', 'workspaces', 'properties', 'room_types', 'rate_plans', 'rooms', 'listings', 'departments', 'service_categories', 'service_items', 'amenities', 'leases', 'rent_charges', 'caution_holds', 'caution_settlements']) {
      const q = await client.query(`select count(*)::int n from ${t}`);
      counts[t] = q.rows[0].n;
    }
    console.log('Seeded marketplace content. Row counts:', counts);
    console.log('Property id:', IDS.property);
    console.log('Room type ids:', {
      standard: IDS.roomTypeStandard,
      deluxe: IDS.roomTypeDeluxe,
      suite: IDS.roomTypeSuite,
    });
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
