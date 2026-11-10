/**
 * CUSTOMERS OF THE BAR AND RESTAURANT (CRM, phase 1).
 *
 * One row per person a business serves, keyed by PHONE. A customer belongs to the workspace (the business),
 * not to an outlet: the same person is one customer at every outlet the business runs. Which outlets' orders
 * a staff member may read about them is the order's own branch scope, not a column here.
 *
 * THE RULES THE DATABASE HOLDS:
 * 1. One ACTIVE customer per phone per business (partial unique index). Two spellings of a number never
 *    reach this table: the API normalises to E.164 first, and the check below refuses anything else.
 * 2. A Rwandan number (`+250`) must be a real mobile (72, 73, 78 or 79 + seven digits); any other country's
 *    number must be E.164-shaped. An ERASED customer keeps no number at all (it is replaced by a placeholder).
 * 3. A merged customer points at the one it was folded into, never at itself; an erased one holds no email,
 *    no notes and no phone (the personal details are gone, the order history and its money stay).
 * 4. An order may name a customer ONLY of its own business: `pos_orders (workspace_id, customer_id)` is a
 *    composite foreign key onto `customers (workspace_id, id)`, so even a bug cannot cross two businesses.
 *
 * Nothing here deletes a customer. "Removing" is `status = 'merged' | 'erased'`, so an order that names one
 * stays readable.
 *
 * IMPORT RULE. A leaf over auth and org. `pos.ts` imports it (an order carries a customer), never the reverse.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { timestamps } from './columns';
import { workspaces } from './org';

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    fullName: text('full_name').notNull(),
    /** E.164, normalised by the API. `erased:<id>` once the customer has been erased. */
    phoneE164: text('phone_e164').notNull(),
    /** Set only when the phone has been proved by a code (a later phase). Staff typing a number never sets it. */
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
    email: text('email'),
    marketingConsent: boolean('marketing_consent').notNull().default(false),
    consentAt: timestamp('consent_at', { withTimezone: true }),
    /** Who vouched for the consent: `pos_staff` (a staff member recorded it), later `qr`, `reservation`. */
    consentSource: text('consent_source'),
    source: text('source').notNull().default('pos'),
    status: text('status').notNull().default('active'),
    mergedIntoId: uuid('merged_into_id'),
    notes: text('notes'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    erasedAt: timestamp('erased_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    /** A merge can only fold a customer into one of the SAME business. */
    foreignKey({
      name: 'customers_merged_into_fk',
      columns: [t.workspaceId, t.mergedIntoId],
      foreignColumns: [t.workspaceId, t.id],
    }),
    /** The target of `pos_orders`' composite foreign key. */
    unique('customers_workspace_id_uk').on(t.workspaceId, t.id),
    uniqueIndex('customers_workspace_phone_uk')
      .on(t.workspaceId, t.phoneE164)
      .where(sql`${t.status} = 'active'`),
    index('customers_workspace_status_idx').on(t.workspaceId, t.status),
    index('customers_workspace_email_idx')
      .on(t.workspaceId, sql`lower(${t.email})`)
      .where(sql`${t.email} IS NOT NULL`),
    check('customers_source_valid', sql`${t.source} IN ('pos', 'qr', 'reservation', 'import')`),
    check('customers_status_valid', sql`${t.status} IN ('active', 'merged', 'erased')`),
    check('customers_name_length', sql`char_length(btrim(${t.fullName})) BETWEEN 1 AND 120`),
    check(
      'customers_phone_shape',
      sql`${t.status} = 'erased' OR (${t.phoneE164} ~ '^\\+[1-9][0-9]{7,14}$' AND (${t.phoneE164} NOT LIKE '+250%' OR ${t.phoneE164} ~ '^\\+250(72|73|78|79)[0-9]{7}$'))`,
    ),
    check(
      'customers_merge_shape',
      sql`(${t.status} = 'merged') = (${t.mergedIntoId} IS NOT NULL) AND ${t.mergedIntoId} IS DISTINCT FROM ${t.id}`,
    ),
    check(
      'customers_erase_shape',
      sql`(${t.status} = 'erased') = (${t.erasedAt} IS NOT NULL) AND (${t.status} <> 'erased' OR (${t.email} IS NULL AND ${t.notes} IS NULL AND ${t.marketingConsent} = false))`,
    ),
  ],
);
