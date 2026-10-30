/**
 * THE PSF PATH: PSF's sector catalogue, and the counters behind business codes.
 *
 * - `psf_clusters` and `psf_associations` are PSF's sectors as a catalogue
 *   admin edits: four clusters (agriculture, industry, trade, services), each
 *   with the associations a business actually belongs to. PSF restructured once
 *   already (ten chambers became five clusters in 2022), so a new association
 *   is an edit here, never a migration. The fifth cluster, Specialized, is not
 *   a row: it is `orgs.owner_groups`, a marker on a business of any sector.
 *
 * - `business_code_counters` numbers businesses per district for their codes
 *   (`KIC0001`). One row per district, bumped in the same transaction that
 *   settles a registration fee, so two businesses settling at once in the same
 *   district can never draw the same number.
 *
 * Its own module because `orgs` references the associations, and this file
 * imports nothing from `org.ts`: no import cycle between the two.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './auth';
import { timestamps } from './columns';
import { districts } from './geography';

export const psfClusters = pgTable('psf_clusters', {
  code: text('code').primaryKey(),
  nameEn: text('name_en').notNull(),
  // Null until PSF supplies it; the screens show English instead.
  nameRw: text('name_rw'),
  description: text('description'),
  sortOrder: smallint('sort_order').notNull(),
  active: boolean('active').notNull().default(true),
  updatedByUserId: uuid('updated_by_user_id').references(() => users.id),
  ...timestamps,
});

export const psfAssociations = pgTable(
  'psf_associations',
  {
    code: text('code').primaryKey(),
    clusterCode: text('cluster_code')
      .notNull()
      .references(() => psfClusters.code),
    nameEn: text('name_en').notNull(),
    acronym: text('acronym'),
    sortOrder: smallint('sort_order').notNull(),
    active: boolean('active').notNull().default(true),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [index('psf_associations_cluster_idx').on(t.clusterCode)],
);

export const businessCodeCounters = pgTable('business_code_counters', {
  districtId: integer('district_id')
    .primaryKey()
    .references(() => districts.id),
  // The number the last code in this district carried. The next is one more.
  lastNumber: integer('last_number').notNull().default(0),
  ...timestamps,
});

/**
 * A sector's subtypes (2026-10-20): Services is Hospitality, Tourism,
 * Transport and so on. The form asks Sector, then Subtype, then Association,
 * and the association list follows the subtype (`psf_subsector_associations`).
 *
 * WHO OWNS A ROW. `district_id` null is a national subtype, set by a national
 * PSF officer and offered everywhere. A district's own subtype (a province or
 * district officer adds it) is offered only to businesses registering in that
 * district. A business whose subtype is on neither list types its own, kept on
 * `orgs.psf_subsector_other`.
 */
export const psfSubsectors = pgTable(
  'psf_subsectors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clusterCode: text('cluster_code')
      .notNull()
      .references(() => psfClusters.code),
    nameEn: text('name_en').notNull(),
    districtId: integer('district_id').references(() => districts.id),
    sortOrder: smallint('sort_order').notNull().default(100),
    active: boolean('active').notNull().default(true),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index('psf_subsectors_cluster_idx').on(t.clusterCode),
    // One name per sector per place, whatever its case.
    uniqueIndex('psf_subsectors_name_uk').on(t.clusterCode, sql`lower(${t.nameEn})`, sql`coalesce(${t.districtId}, 0)`),
  ],
);

/** Which associations a subtype offers. An association may sit under several. */
export const psfSubsectorAssociations = pgTable(
  'psf_subsector_associations',
  {
    subsectorId: uuid('subsector_id')
      .notNull()
      .references(() => psfSubsectors.id, { onDelete: 'cascade' }),
    associationCode: text('association_code')
      .notNull()
      .references(() => psfAssociations.code),
  },
  (t) => [primaryKey({ columns: [t.subsectorId, t.associationCode] })],
);
