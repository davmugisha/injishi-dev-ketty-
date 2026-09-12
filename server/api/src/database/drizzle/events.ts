/**
 * §9 EVENTS & NOTIFICATIONS.
 *
 * Carved out of the single 3,956-line `schema.ts` along the section headers
 * that file already carried. Every declaration below is byte-identical to the
 * one it replaced; only the import lines are new. `schema.ts` re-exports this
 * module, so `drizzle.config.ts`, every migration and every importer still see
 * one schema at one path.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { domainEventTypeEnum, notificationCategoryEnum, notificationChannelEnum, notificationDeliveryStatusEnum, outboxStatusEnum, workspaceKindEnum } from './enums';
import { workspaces } from './org';

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: uuid('aggregate_id'),
    eventType: domainEventTypeEnum('event_type').notNull(),
    payload: jsonb('payload'),
    workspaceId: uuid('workspace_id').references(() => workspaces.id),
    dedupeKey: text('dedupe_key').notNull(),
    status: outboxStatusEnum('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    availableAt: timestamp('available_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('outbox_events_dedupe_key_uk').on(t.dedupeKey),
    index('outbox_events_pending_idx')
      .on(t.availableAt)
      .where(sql`${t.status} = 'pending'`),
  ],
);


export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id),
    category: notificationCategoryEnum('category').notNull(),
    channel: notificationChannelEnum('channel').notNull(),
    title: text('title'),
    body: text('body'),
    deepLink: text('deep_link'),
    isTransactional: boolean('is_transactional').notNull().default(false),
    deliveryStatus: notificationDeliveryStatusEnum('delivery_status')
      .notNull()
      .default('pending'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('notifications_user_idx').on(t.userId)],
);


export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: notificationCategoryEnum('category').notNull(),
    channel: notificationChannelEnum('channel').notNull(),
    enabled: boolean('enabled').notNull().default(true),
  },
  (t) => [
    uniqueIndex('notification_preferences_uk').on(
      t.userId,
      t.category,
      t.channel,
    ),
  ],
);


export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventName: text('event_name').notNull(),
  opaqueActorId: text('opaque_actor_id'),
  districtId: integer('district_id'),
  workspaceKind: workspaceKindEnum('workspace_kind'),
  props: jsonb('props'),
  occurredAt: timestamp('occurred_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ===========================================================================
// §10  ADMIN & GOVERNANCE
// ===========================================================================
