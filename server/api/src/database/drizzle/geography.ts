/**
 * §5.1 GEOGRAPHY.
 *
 * Carved out of the single 3,956-line `schema.ts` along the section headers
 * that file already carried. Every declaration below is byte-identical to the
 * one it replaced; only the import lines are new. `schema.ts` re-exports this
 * module, so `drizzle.config.ts`, every migration and every importer still see
 * one schema at one path.
 */
import {
  integer,
  pgTable,
  text,
} from 'drizzle-orm/pg-core';

export const provinces = pgTable('provinces', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});


export const districts = pgTable('districts', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  provinceId: integer('province_id')
    .notNull()
    .references(() => provinces.id),
});


export const sectors = pgTable('sectors', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  districtId: integer('district_id')
    .notNull()
    .references(() => districts.id),
});


export const cells = pgTable('cells', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  sectorId: integer('sector_id')
    .notNull()
    .references(() => sectors.id),
});


export const villages = pgTable('villages', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  cellId: integer('cell_id')
    .notNull()
    .references(() => cells.id),
});

// ===========================================================================
// §4.3  ORG & onboarding
// ===========================================================================
