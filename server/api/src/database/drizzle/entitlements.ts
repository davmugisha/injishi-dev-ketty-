/**
 * Which products each business has switched on (ADR-074 access model, data
 * model; built early by ADR-076 slice G).
 *
 * Owned by `platform/billing` in ADR-074's map, which Account reads. Two
 * tables:
 *
 * - `products`: the eleven product ids, seeded by migration 0134. A new
 *   product is a migration (ADR-074 D-q), so an entitlement can never name a
 *   product the release does not know.
 * - `org_product_entitlements`: one OPEN row per org, product and branch, where
 *   `property_id` null means every branch. Switching a product off stamps
 *   `disabled_at` on its row; switching it on opens a new row. Nothing is ever
 *   deleted, so the closed rows plus one audit row per real change are the
 *   history.
 *
 * A product is on at branch B when an open row exists for (product, B) or for
 * (product, every branch) (ADR-076 G5). `EntitlementsService` is the one
 * writer.
 */
import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { entitlementSourceEnum } from './enums';
import { properties } from './inventory';
import { orgs } from './org';

export const products = pgTable('products', {
  /** The product id (`ProductId` in `@injishi/contracts`), never a brand name. */
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const orgProductEntitlements = pgTable(
  'org_product_entitlements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    /** Null means every branch, the only shape a business level product takes. */
    propertyId: uuid('property_id').references(() => properties.id),
    source: entitlementSourceEnum('source').notNull(),
    enabledAt: timestamp('enabled_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Set when the row is closed. An open row is one where this is null. */
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    /** Who opened it, when a person did. Null for the migration and activation. */
    setByUserId: uuid('set_by_user_id').references(() => users.id),
    reason: text('reason'),
  },
  (t) => [
    // One OPEN row per org, product and branch, the every branch row included.
    // Postgres treats nulls as distinct in a unique index, so the null
    // `property_id` is folded to the nil uuid first; that is NULLS NOT DISTINCT
    // written in a form the schema can carry.
    uniqueIndex('org_product_entitlements_open_uk')
      .on(
        t.orgId,
        t.productId,
        sql`coalesce(${t.propertyId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      )
      .where(sql`${t.disabledAt} IS NULL`),
    index('org_product_entitlements_org_idx').on(t.orgId),
  ],
);
