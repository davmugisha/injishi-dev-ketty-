/**
 * The guest-messaging additions for the new interface (real-data, frontdesk leaf, stays area).
 *
 * `message_templates`: the replies a business keeps ready for its desk ("your late checkout is
 * confirmed", "your transfer leaves at…"), in the three languages its guests write in. Not
 * `email_templates` (governance), which is the platform's own mail to people; these are the business's
 * words to its guests, kept per business, edited by it, and only ever inserted into a draft the desk
 * then sends as an ordinary reply.
 */
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './columns';
import { orgs, workspaces } from './org';

export const messageTemplates = pgTable(
  'message_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    /** A stable handle within the business ("late", "transfer"), unique per business. */
    key: text('key').notNull(),
    label: text('label').notNull(),
    /** English is required; Kinyarwanda and French are offered when written. */
    bodyEn: text('body_en').notNull(),
    bodyRw: text('body_rw'),
    bodyFr: text('body_fr'),
    sortOrder: integer('sort_order').notNull().default(0),
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('message_templates_org_key_uk').on(t.orgId, t.key),
    index('message_templates_workspace_idx').on(t.workspaceId, t.active),
  ],
);
