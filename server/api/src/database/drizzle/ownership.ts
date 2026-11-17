import { sql } from 'drizzle-orm';
import { check, index, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { orgRoleEnum } from './enums';
import { orgs } from './org';

/**
 * Ownership transfer requests (migration 0155). A business's owner asks for it to pass to another active,
 * identity-verified member; nothing changes hands until that member accepts. The change itself is the existing
 * `org_memberships` rows, rewritten in one transaction on acceptance; every step is in `audit_events` as well.
 */
export const ownershipTransferStatusEnum = pgEnum('ownership_transfer_status', [
  'pending',
  'accepted',
  'declined',
  'cancelled',
  'expired',
]);

export const ownershipTransfers = pgTable(
  'ownership_transfers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    /** The owner who asked. */
    fromUserId: uuid('from_user_id')
      .notNull()
      .references(() => users.id),
    /** The member who becomes owner if they accept. */
    toUserId: uuid('to_user_id')
      .notNull()
      .references(() => users.id),
    /** The role the person who asked keeps once the transfer is accepted (never `owner`). */
    previousOwnerRole: orgRoleEnum('previous_owner_role').notNull(),
    status: ownershipTransferStatusEnum('status').notNull().default('pending'),
    /** 7 days from the request, the life of every invitation. */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('ownership_transfers_two_people', sql`${t.fromUserId} <> ${t.toUserId}`),
    check('ownership_transfers_previous_role_not_owner', sql`${t.previousOwnerRole} <> 'owner'`),
    uniqueIndex('ownership_transfers_one_pending_uk').on(t.orgId).where(sql`${t.status} = 'pending'`),
    index('ownership_transfers_to_user_idx').on(t.toUserId, t.status),
  ],
);
