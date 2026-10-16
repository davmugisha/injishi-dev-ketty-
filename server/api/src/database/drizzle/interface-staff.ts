/**
 * The staff phone of the new interface (real-data leaf 1.3.3): what a housekeeper, the housekeeping
 * supervisor and the maintenance technician record from their phones beyond the operations floor's
 * tables (`interface-operations.ts`).
 *
 * - CHECKLISTS. A property's cleaning and inspection checklists, item by item, and the result each
 *   item got on one task: ticked by the cleaner (`done`), or passed or failed by the inspector. The
 *   inspection itself stays the housekeeping board's command (`POST /ops/housekeeping/tasks/:id/
 *   inspection`); its per-check results are written in the same transaction.
 * - MINIBAR. The items a room's minibar is stocked with, and the count a housekeeper reports for one
 *   clean. A count is a REPORT: nothing here posts a charge, the front desk decides that on the folio.
 * - TIME ON A WORK ORDER. The sessions a technician spent on an order (diagnosis, repair), started
 *   and stopped from the phone. One running session per person per order.
 *
 * Every table is scoped by `workspace_id` (and `property_id` where it is a building's record). A
 * checklist item is archived, never deleted, because past tasks name it.
 *
 * IMPORT RULE. Like `interface-operations.ts`, this module only points INTO operations, inventory
 * and residence; nothing imports it back, so it is exported last from `schema.ts`.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { timestamps } from './columns';
import { properties, rooms } from './inventory';
import { housekeepingTasks, serviceItems } from './operations';
import { workspaces } from './org';
import { maintenanceTickets } from './residence';

// --- Checklists ---------------------------------------------------------------------------------

/**
 * One line of a property's checklist: a cleaning step ("Toilet cleaned and disinfected") or an
 * inspection check ("Balcony door and glass clear"). Grouped into sections by `section_code`, in
 * `sort_order`. `code` is stable within a property and kind, so a seed or an import names the same
 * item on every run.
 */
export const housekeepingChecklistItems = pgTable(
  'housekeeping_checklist_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    sectionCode: text('section_code').notNull(),
    sectionTitle: text('section_title').notNull(),
    code: text('code').notNull(),
    label: text('label').notNull(),
    /** A failed inspection check needs a photo before the room goes back to its cleaner. */
    requiresPhoto: boolean('requires_photo').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    status: text('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('housekeeping_checklist_items_code_uk').on(t.propertyId, t.kind, t.code),
    index('housekeeping_checklist_items_property_idx').on(t.propertyId, t.kind, t.status),
    check('housekeeping_checklist_items_kind_ck', sql`${t.kind} IN ('cleaning', 'inspection')`),
    check('housekeeping_checklist_items_status_ck', sql`${t.status} IN ('active', 'archived')`),
  ],
);

/**
 * The result one checklist item got on one task. A cleaning item is `done` (a tick; un-ticking
 * removes the row while the room is still being cleaned). An inspection item is `pass` or `fail`,
 * written once with the inspection decision and never changed: a re-inspection is of the re-clean,
 * which is its own task.
 */
export const housekeepingTaskChecks = pgTable(
  'housekeeping_task_checks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    taskId: uuid('task_id')
      .notNull()
      .references(() => housekeepingTasks.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => housekeepingChecklistItems.id),
    result: text('result').notNull(),
    /** The photo of a failed check, when one was taken. */
    photoObjectKey: text('photo_object_key'),
    checkedByUserId: uuid('checked_by_user_id').references(() => users.id),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('housekeeping_task_checks_task_item_uk').on(t.taskId, t.itemId),
    index('housekeeping_task_checks_workspace_idx').on(t.workspaceId),
    check('housekeeping_task_checks_result_ck', sql`${t.result} IN ('done', 'pass', 'fail')`),
  ],
);

// --- Minibar ------------------------------------------------------------------------------------

/**
 * What a room's minibar is stocked with at a property, and how many of each (`par_level`). The
 * item may name the service item the desk charges it as; the phone never prices anything.
 */
export const minibarItems = pgTable(
  'minibar_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    label: text('label').notNull(),
    parLevel: smallint('par_level').notNull(),
    serviceItemId: uuid('service_item_id').references(() => serviceItems.id, { onDelete: 'set null' }),
    sortOrder: integer('sort_order').notNull().default(0),
    status: text('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('minibar_items_code_uk').on(t.propertyId, t.code),
    index('minibar_items_property_idx').on(t.propertyId, t.status),
    check('minibar_items_par_ck', sql`${t.parLevel} BETWEEN 0 AND 99`),
    check('minibar_items_status_ck', sql`${t.status} IN ('active', 'archived')`),
  ],
);

/**
 * What was used from the minibar, counted during one clean. Sending the count again replaces it
 * (the counter's correction before the desk acts on it); `par_level` is copied at count time so a
 * later change of stocking never rewrites what was reported.
 */
export const minibarCounts = pgTable(
  'minibar_counts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => housekeepingTasks.id, { onDelete: 'cascade' }),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => minibarItems.id),
    parLevel: smallint('par_level').notNull(),
    used: smallint('used').notNull(),
    countedByUserId: uuid('counted_by_user_id').references(() => users.id),
    countedAt: timestamp('counted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('minibar_counts_task_item_uk').on(t.taskId, t.itemId),
    index('minibar_counts_workspace_idx').on(t.workspaceId, t.countedAt),
    check('minibar_counts_used_ck', sql`${t.used} >= 0 AND ${t.used} <= ${t.parLevel}`),
  ],
);

// --- Time on a work order -----------------------------------------------------------------------

/**
 * A session a person spent on a work order, timed from the phone. Closed by stopping the timer or by
 * resolving the order; one running session per person per order (a partial unique index, not a read).
 */
export const maintenanceTimeLogs = pgTable(
  'maintenance_time_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => maintenanceTickets.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull().default('repair'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('maintenance_time_logs_running_uk')
      .on(t.ticketId, t.userId)
      .where(sql`${t.endedAt} IS NULL`),
    index('maintenance_time_logs_ticket_idx').on(t.ticketId, t.startedAt),
    index('maintenance_time_logs_workspace_idx').on(t.workspaceId),
    check('maintenance_time_logs_kind_ck', sql`${t.kind} IN ('diagnosis', 'repair')`),
    check('maintenance_time_logs_dates_ck', sql`${t.endedAt} IS NULL OR ${t.endedAt} >= ${t.startedAt}`),
  ],
);
