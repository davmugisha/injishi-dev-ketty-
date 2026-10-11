/**
 * The list framework's two tables (ADR-058, 058-list-framework).
 *
 * `list_saved_views` holds a person's saved list views. They are preferences,
 * not business records, so unlike the HR tables they may be deleted. A view
 * stores configuration only (filters, sort, grouping, columns, the view kind):
 * whoever opens a shared one reads rows through their own permissions and
 * branch limits, so sharing a view never shares data.
 *
 * `report_runs` records every export, report run and subscription delivery,
 * because an export is the easiest way for HR data to leave a business
 * (AC-LF7). Append only. 058-reports-automations adds its report runs here.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './auth';
import { timestamps } from './columns';
import { orgs } from './org';

export const listSavedViews = pgTable(
  'list_saved_views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** A key of `LIST_READ` in `@injishi/contracts`. */
    listKey: text('list_key').notNull(),
    name: text('name').notNull(),
    /** `SavedViewConfig`, parsed on every read; parts that no longer fit are dropped. */
    config: jsonb('config').notNull(),
    shared: boolean('shared').notNull().default(false),
    isDefault: boolean('is_default').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('list_saved_views_name_uk').on(t.orgId, t.userId, t.listKey, sql`lower(${t.name})`),
    uniqueIndex('list_saved_views_default_uk')
      .on(t.orgId, t.userId, t.listKey)
      .where(sql`${t.isDefault}`),
    index('list_saved_views_shared_idx').on(t.orgId, t.listKey).where(sql`${t.shared}`),
  ],
);

export const reportRunKindEnum = pgEnum('report_run_kind', ['export', 'report', 'subscription']);

export const reportRuns = pgTable(
  'report_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    /** Null only for a subscription delivered by the worker. */
    userId: uuid('user_id').references(() => users.id),
    kind: reportRunKindEnum('kind').notNull(),
    /** The list key, or the report code. */
    subject: text('subject').notNull(),
    /** The `ListQuery` (or report parameters) it ran with. */
    filters: jsonb('filters').notNull(),
    rowCount: integer('row_count').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('report_runs_org_created_idx').on(t.orgId, t.createdAt)],
);
