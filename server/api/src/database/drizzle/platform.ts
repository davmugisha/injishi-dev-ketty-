/**
 * What this database IS, not what it holds (ADR-043).
 *
 * `database_identity` is empty in a real database and holds one `sample` row in
 * a database built to carry sample data (the demo, staging, a laptop). A demo
 * API process refuses to boot without that row, and the fixed sign in code only
 * exists in a demo process, so the row is what keeps a published code away from
 * real accounts.
 *
 * The row can only be written while `users` is empty, and once written only
 * `seeded_at` may change. Both rules are triggers in the migration that creates
 * this table (0030), because a rule the database enforces holds against every
 * client, a hand typed `psql` session included. Deleting the row is allowed on
 * purpose: it makes the database real, which is the safe direction.
 *
 * Only `scripts/mark-sample-database.mjs --sample` inserts it.
 */
import { sql } from 'drizzle-orm';
import { boolean, check, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const databaseIdentity = pgTable(
  'database_identity',
  {
    // Always `true`: with the check below, the primary key admits one row.
    id: boolean('id').primaryKey().default(true),
    kind: text('kind').notNull(),
    markedAt: timestamp('marked_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // `mark-sample-database@<INJISHI_COMMIT>`, or `@local`.
    markedBy: text('marked_by').notNull(),
    // Set by `seed-sample.mjs`; null until the first seed finishes.
    seededAt: timestamp('seeded_at', { withTimezone: true }),
  },
  (t) => [
    check('database_identity_one_row', sql`${t.id}`),
    // No row at all means real, so `sample` is the only kind a row can carry.
    check('database_identity_kind_sample', sql`${t.kind} = 'sample'`),
  ],
);
