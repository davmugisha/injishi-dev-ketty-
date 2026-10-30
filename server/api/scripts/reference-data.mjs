/**
 * Platform reference data: the catalogues every Injishi database needs before a business can register or a
 * charge can post, whatever else it holds. Real, not sample: production gets them from
 * `seed-reference.mjs`, and the sample seeds (`seed-content.mjs`, `seed-demo.mjs`) import the same lists
 * from here, so there is one copy of each.
 *
 * What is deliberately NOT here, because its values are a business decision nobody has made yet:
 * registration fees (`seed-content.mjs` writes dev defaults, O-11), subscription plans and prices, PSF
 * membership tiers, marketplace commission, and the HR rules (PAYE, RSSB, leave, public holidays), whose
 * real rates come from the accountant's sheet into a production migration (ADR-058).
 */

import { COUNTRY_NAMES, GUEST_RELATIONSHIPS } from '@injishi/contracts';

/** §1 entity groups + §2 accommodation classes + §3 residence classes
 *  (dox_context/rdb-classification.md). The catalog table is empty on a fresh
 *  DB; orgs.accommodation_class FKs into it, so it must exist first. */
export const RDB_CLASSIFICATIONS = [
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

/*
 * The platform amenity catalogue (ADR-035, D-f wave 2).
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
export const AMENITY_CATALOGUE = [
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
  // 0118 (2026-10-30): the facilities the booking platforms ask of a hotel that the catalogue lacked.
  // Their Kinyarwanda labels are owed: null until someone who writes it supplies them, never a guess.
  ['bar', "Food & drink", "Bar", null],
  ['gym', "Leisure & business", "Fitness room", null],
  ['spa', "Leisure & business", "Spa", null],
  ['meeting', "Leisure & business", "Meeting room", null],
  ['stepfree', "Accessibility", "Step-free entrance", null],
  ['accessible_room', "Accessibility", "Accessible room", null],
  ['lift', "Accessibility", "Lift", null],
];

/** The government bodies an oversight assignment can name. DGIE is the district immigration officer's (P5). */
export const GOVERNMENT_BODIES = [
  ['PSF', 'Private Sector Federation', 'Ihuriro ry’Abikorera', 'PSF'],
  ['MINALOC', 'Ministry of Local Government', 'Minisiteri y’Ubutegetsi bw’Igihugu', 'MINALOC'],
  ['DGIE', 'Directorate General of Immigration and Emigration', 'Ubuyobozi Bukuru bw’Abinjira n’Abasohoka', 'DGIE'],
];

/**
 * The national tax rates (ADR-016 D-m, AC-5).
 * 
 * Reference data, not a fixture: these are Rwanda's VAT codes, the same for
 * every property, which is why `config_entries` carries no workspace column.
 * A folio charge REFUSES to post when no row is effective rather than
 * defaulting to 18%, so this row is what makes charging work at all on a
 * fresh database.
 * 
 * Effective dated on purpose. A rate change is an operator action with a
 * date, never a deploy: the new rate gets a new row and posted charges keep
 * the rate they snapshotted.
 */
export const NATIONAL_TAX_RATES = { TAX_A: 0, TAX_B: 0.18, TAX_C: 0, TAX_D: 0 };

/** RDB entity groups and classes. label_rw is NOT NULL and not authored yet (F-A20), so it carries the English. */
export async function upsertRdbClassifications(client) {
  for (const [code, kind, parent, labelEn, active = true] of RDB_CLASSIFICATIONS) {
    await client.query(
      `insert into rdb_classifications (code, kind, parent_code, label_en, label_rw, active)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (code) do update set active = excluded.active`,
      [code, kind, parent, labelEn, labelEn, active],
    );
  }
  return RDB_CLASSIFICATIONS.length;
}

export async function upsertAmenities(client) {
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
  return AMENITY_CATALOGUE.length;
}

export async function upsertGovernmentBodies(client) {
  for (const [code, en, rw, abbr] of GOVERNMENT_BODIES) {
    await client.query(
      `insert into government_bodies (code, name_en, name_rw, abbreviation, active)
       values ($1, $2, $3, $4, true) on conflict (code) do nothing`,
      [code, en, rw, abbr],
    );
  }
  return GOVERNMENT_BODIES.length;
}

/**
 * The countries a guest's nationality and origin are picked from (P5): contracts' `COUNTRY_NAMES`, the
 * same list the kit's country picker offers, Rwanda first. Migration 0085 inserts them; this keeps the
 * names current when the list changes.
 */
export async function upsertCountries(client) {
  const entries = Object.entries(COUNTRY_NAMES);
  for (const [code, name] of entries) {
    await client.query(
      `insert into countries (code, name, sort_order, active) values ($1, $2, $3, true)
       on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order`,
      [code, name, code === 'RW' ? 0 : 100],
    );
  }
  return entries.length;
}

/** Who a guest is to the host, in the order the form offers them (contracts `GUEST_RELATIONSHIPS`). */
export async function upsertGuestRelationships(client) {
  let order = 0;
  for (const { code, label, needsDetail } of GUEST_RELATIONSHIPS) {
    order += 10;
    await client.query(
      `insert into guest_relationships (code, label, sort_order, needs_detail, active) values ($1, $2, $3, $4, true)
       on conflict (code) do update set label = excluded.label, sort_order = excluded.sort_order, needs_detail = excluded.needs_detail`,
      [code, label, order, needsDetail],
    );
  }
  return GUEST_RELATIONSHIPS.length;
}

/** Writes the first tax_rates row when there is none. A later rate is a new effective-dated row, never an edit. */
export async function ensureTaxRates(client) {
  const { rowCount } = await client.query(
    `insert into config_entries (config_type, value, effective_from, version, locked_on_use)
     select 'tax_rates', $1::jsonb, now(), 1, true
     where not exists (select 1 from config_entries where config_type = 'tax_rates')`,
    [JSON.stringify(NATIONAL_TAX_RATES)],
  );
  return rowCount ?? 0;
}
