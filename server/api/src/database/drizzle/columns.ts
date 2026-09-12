/**
 * Shared column helpers.
 *
 * Carved out of the single 3,956-line `schema.ts` along the section headers
 * that file already carried. Every declaration below is byte-identical to the
 * one it replaced; only the import lines are new.
 *
 * Unlike the domain modules, this one is NOT re-exported by `schema.ts`. These
 * three helpers were private to that module before the split, and keeping them
 * private to the schema directory means the barrel's export surface is exactly
 * what it was. They carry `export` only so the sibling modules can import them.
 */
import type { HasDefault, NotNull } from 'drizzle-orm';
import {
  bigint,
  char,
  timestamp,
  type PgBigInt53BuilderInitial,
  type PgCharBuilderInitial,
} from 'drizzle-orm/pg-core';

/** created_at + updated_at, spread into every mutable table. */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
};

/** RWF money amount (integer minor-unit-free franc). */
export const amount = (name: string): PgBigInt53BuilderInitial<string> =>
  bigint(name, { mode: 'number' });

/** currency tag riding alongside money amounts (v1 single-currency). */
export const currency = (): HasDefault<
  NotNull<PgCharBuilderInitial<'currency', [string, ...string[]], 3>>
> => char('currency', { length: 3 }).notNull().default('RWF');
