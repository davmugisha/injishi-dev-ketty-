/**
 * The operations floor of the new interface (real-data leaf 1.2.3): room blocks and room history,
 * the housekeeping board's rules, allocations and escalations, maintenance assets, parts and
 * condition signals, and the lost and found register.
 *
 * Every table is scoped by `workspace_id` (and `property_id`, because each of these is a building's
 * record). Append-only where the record is evidence: `room_status_events` and `found_item_events`
 * are never updated, a block is released rather than deleted, a found item is disposed rather than
 * deleted.
 *
 * IMPORT RULE. `operations.ts` and `residence.ts` import this module for two foreign keys
 * (`housekeeping_tasks.rule_id`, `maintenance_tickets.asset_id`), so this module must never use
 * anything from them eagerly: only inside `references(() => …)`, which runs late. Its enums are its
 * own for that reason.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { timestamps } from './columns';
import { bookings } from './hospitality';
import { properties, rooms } from './inventory';
import { housekeepingTasks } from './operations';
import { orgs, workspaces } from './org';
import { assets, maintenanceTickets } from './residence';

// --- Rooms: blocks and history ----------------------------------------------

export const roomBlockStatusEnum = pgEnum('room_block_status', ['requested', 'active', 'declined', 'released']);

/**
 * A room taken off sale for repair (out of order), asked for by whoever works the order and decided
 * by a manager (`listing.manage`).
 *
 * While a block is ACTIVE the room's inventory status is `maintenance`, which is what
 * `sellable-capacity.query.ts` reads: an active block takes the room out of every night's count from
 * approval until release. That is wider than the block's own dates on purpose: availability is
 * counted per room, not per night, and selling a blocked night is the failure that must not happen.
 * One open (requested or active) block per room, held by a partial unique index rather than a read.
 */
export const roomBlocks = pgTable(
  'room_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    maintenanceTicketId: uuid('maintenance_ticket_id').references(() => maintenanceTickets.id, {
      onDelete: 'set null',
    }),
    status: roomBlockStatusEnum('status').notNull().default('requested'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    /** Null: until released. */
    endsAt: timestamp('ends_at', { withTimezone: true }),
    reason: text('reason').notNull(),
    requestedByUserId: uuid('requested_by_user_id').references(() => users.id),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: text('decision_note'),
    releasedByUserId: uuid('released_by_user_id').references(() => users.id),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('room_blocks_workspace_status_idx').on(t.workspaceId, t.status),
    index('room_blocks_room_idx').on(t.roomId),
    index('room_blocks_ticket_idx').on(t.maintenanceTicketId),
    uniqueIndex('room_blocks_open_uk')
      .on(t.roomId)
      .where(sql`${t.status} IN ('requested', 'active')`),
    check('room_blocks_dates_ck', sql`${t.endsAt} IS NULL OR ${t.endsAt} > ${t.startsAt}`),
  ],
);

export const roomEventKindEnum = pgEnum('room_event_kind', [
  'housekeeping',
  'inventory',
  'occupancy',
  'task_assigned',
  'task_created',
  'inspection_failed',
  'escalation',
  'fault_reported',
  'block',
]);

/**
 * Every recorded change of a room, append only: readiness (`Dirty → Clean`), inventory (off sale),
 * occupancy, task assignment, escalations and faults. `rooms` keeps only the latest state; this is
 * the "who, when and why" the board's Inspection Gate promises.
 */
export const roomStatusEvents = pgTable(
  'room_status_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    kind: roomEventKindEnum('kind').notNull(),
    fromValue: text('from_value'),
    toValue: text('to_value'),
    summary: text('summary').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    /** Who acted when no person did: "System", `Rule “Floor 2”`. */
    actorLabel: text('actor_label'),
    detail: text('detail'),
    housekeepingTaskId: uuid('housekeeping_task_id').references(() => housekeepingTasks.id, {
      onDelete: 'set null',
    }),
    maintenanceTicketId: uuid('maintenance_ticket_id').references(() => maintenanceTickets.id, {
      onDelete: 'set null',
    }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('room_status_events_room_idx').on(t.roomId, t.occurredAt),
    index('room_status_events_workspace_idx').on(t.workspaceId, t.occurredAt),
  ],
);

// --- Housekeeping: rules, allocations, escalations --------------------------


export const housekeepingAllocationRoleEnum = pgEnum('housekeeping_allocation_role', ['attendant', 'supervisor']);

/**
 * The day's allocation sheet: who works housekeeping on this property today, which section they
 * cover and until when. One row per person per day. A supervisor writes it each morning; the board
 * measures each attendant's open work against the time left on their shift.
 */
export const housekeepingAllocations = pgTable(
  'housekeeping_allocations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    /** The Kigali calendar day. */
    workDate: date('work_date').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: housekeepingAllocationRoleEnum('role').notNull().default('attendant'),
    section: text('section').notNull(),
    floors: smallint('floors').array().notNull().default(sql`'{}'::smallint[]`),
    shiftStartsAt: timestamp('shift_starts_at', { withTimezone: true }).notNull(),
    shiftEndsAt: timestamp('shift_ends_at', { withTimezone: true }).notNull(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index('housekeeping_allocations_day_idx').on(t.propertyId, t.workDate),
    uniqueIndex('housekeeping_allocations_person_day_uk').on(t.propertyId, t.workDate, t.userId),
    check('housekeeping_allocations_shift_ck', sql`${t.shiftEndsAt} > ${t.shiftStartsAt}`),
  ],
);

export const housekeepingEscalationKindEnum = pgEnum('housekeeping_escalation_kind', [
  'not_started',
  'awaiting_inspection',
]);
export const housekeepingEscalationLevelEnum = pgEnum('housekeeping_escalation_level', ['supervisor', 'manager']);

/**
 * A task the board escalated (overdue 15 min to the supervisor, 30 min to the manager), and whether
 * it is still open. Resolved by the act it asked for: a not-started task is resolved when it is
 * started or given to someone else, an inspection when the room is passed or failed.
 */
export const housekeepingEscalations = pgTable(
  'housekeeping_escalations',
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
    kind: housekeepingEscalationKindEnum('kind').notNull(),
    level: housekeepingEscalationLevelEnum('level').notNull(),
    escalatedToUserId: uuid('escalated_to_user_id').references(() => users.id),
    raisedAt: timestamp('raised_at', { withTimezone: true }).notNull().defaultNow(),
    remindedAt: timestamp('reminded_at', { withTimezone: true }),
    remindedByUserId: uuid('reminded_by_user_id').references(() => users.id),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolution: text('resolution'),
    ...timestamps,
  },
  (t) => [
    index('housekeeping_escalations_open_idx').on(t.propertyId, t.resolvedAt),
    uniqueIndex('housekeeping_escalations_task_level_uk').on(t.taskId, t.kind, t.level),
  ],
);

// --- Maintenance: assets, parts, condition signals ---------------------------


export const maintenancePartStateEnum = pgEnum('maintenance_part_state', ['requested', 'ordered', 'issued', 'contractor']);

/** What a work order consumed or is waiting for. */
export const maintenanceParts = pgTable(
  'maintenance_parts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => maintenanceTickets.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    quantity: numeric('quantity', { precision: 10, scale: 2, mode: 'number' }).notNull().default(1),
    unit: text('unit'),
    state: maintenancePartStateEnum('state').notNull().default('requested'),
    /** Where it comes from, in words ("Store · issued by …", "PO-26-0147 · due 13 Oct"). */
    source: text('source').notNull(),
    purchaseOrderReference: text('purchase_order_reference'),
    dueOn: date('due_on'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('maintenance_parts_ticket_idx').on(t.ticketId)],
);

export const conditionSignalConfidenceEnum = pgEnum('condition_signal_confidence', ['high', 'medium', 'low']);
export const conditionSignalStatusEnum = pgEnum('condition_signal_status', ['open', 'actioned', 'dismissed']);

/**
 * A condition rule's recommendation about a piece of equipment, with its evidence and how good the
 * data behind it is. People decide: acting on one creates a work order, dismissing one needs a
 * reason, and both are kept as the review the next rule tuning reads.
 */
export const conditionSignals = pgTable(
  'condition_signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'set null' }),
    /** The asset as the signal named it, kept if the asset row goes. */
    assetLabel: text('asset_label').notNull(),
    ruleCode: text('rule_code').notNull(),
    ruleText: text('rule_text').notNull(),
    headline: text('headline').notNull(),
    confidence: conditionSignalConfidenceEnum('confidence').notNull(),
    evidence: jsonb('evidence').notNull(),
    dataQuality: text('data_quality').notNull(),
    recommendation: text('recommendation').notNull(),
    /** The work order it proposes: `{ title, description, priority, location }`. */
    draft: jsonb('draft'),
    status: conditionSignalStatusEnum('status').notNull().default('open'),
    workOrderId: uuid('work_order_id').references(() => maintenanceTickets.id, { onDelete: 'set null' }),
    raisedAt: timestamp('raised_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNote: text('review_note'),
    ...timestamps,
  },
  (t) => [index('condition_signals_property_status_idx').on(t.propertyId, t.status)],
);

// --- Lost and found ---------------------------------------------------------

export const foundItemStatusEnum = pgEnum('found_item_status', [
  'stored',
  'claimed',
  'returned',
  'disposal_pending',
  'disposed',
]);
export const foundItemCategoryEnum = pgEnum('found_item_category', [
  'electronics',
  'jewellery',
  'clothing',
  'accessories',
  'documents',
  'cash',
  'other',
]);
export const foundItemReleaseMethodEnum = pgEnum('found_item_release_method', [
  'in_person',
  'authorised_person',
  'courier',
]);

/**
 * One found item, from the spot it was found to the hand that took it back (or the charity that
 * received it). Never deleted: a returned or disposed item is closed, and its custody chain stays.
 */
export const foundItems = pgTable(
  'found_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    /** "LF-26-041": on the tag and the bag. */
    reference: text('reference').notNull(),
    description: text('description').notNull(),
    category: foundItemCategoryEnum('category').notNull(),
    valuable: boolean('valuable').notNull().default(false),
    foundLocation: text('found_location').notNull(),
    foundSpot: text('found_spot'),
    roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),
    foundAt: timestamp('found_at', { withTimezone: true }).notNull(),
    foundByUserId: uuid('found_by_user_id').references(() => users.id),
    foundByName: text('found_by_name').notNull(),
    custodianUserId: uuid('custodian_user_id').references(() => users.id),
    storageLocation: text('storage_location'),
    photoCount: smallint('photo_count').notNull().default(0),
    status: foundItemStatusEnum('status').notNull().default('stored'),
    retentionUntil: date('retention_until').notNull(),
    retentionNote: text('retention_note'),
    claimantName: text('claimant_name'),
    claimBookingReference: text('claim_booking_reference'),
    claimBookingId: uuid('claim_booking_id').references(() => bookings.id, { onDelete: 'set null' }),
    claimStatement: text('claim_statement'),
    claimMatched: boolean('claim_matched'),
    claimMatchNote: text('claim_match_note'),
    claimOpenedAt: timestamp('claim_opened_at', { withTimezone: true }),
    claimOpenedByUserId: uuid('claim_opened_by_user_id').references(() => users.id),
    releaseMethod: foundItemReleaseMethodEnum('release_method'),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    releasedByUserId: uuid('released_by_user_id').references(() => users.id),
    disposalNote: text('disposal_note'),
    disposalRule: text('disposal_rule'),
    disposalProposedByUserId: uuid('disposal_proposed_by_user_id').references(() => users.id),
    disposalProposedAt: timestamp('disposal_proposed_at', { withTimezone: true }),
    disposalApprovedByUserId: uuid('disposal_approved_by_user_id').references(() => users.id),
    disposedAt: timestamp('disposed_at', { withTimezone: true }),
    closedNote: text('closed_note'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('found_items_workspace_reference_uk').on(t.workspaceId, t.reference),
    index('found_items_property_status_idx').on(t.propertyId, t.status),
    index('found_items_found_at_idx').on(t.workspaceId, t.foundAt),
    /** Two people, always: the approver of a disposal is never its proposer. */
    check(
      'found_items_disposal_two_people_ck',
      sql`${t.disposalApprovedByUserId} IS NULL OR ${t.disposalApprovedByUserId} IS DISTINCT FROM ${t.disposalProposedByUserId}`,
    ),
  ],
);

export const foundItemEventKindEnum = pgEnum('found_item_event_kind', [
  'found',
  'handed_over',
  'stored',
  'logged',
  'claim_opened',
  'verified',
  'returned',
  'disposal_proposed',
  'disposal_approved',
  'retention_extended',
  'note',
]);

/** The custody chain of a found item, append only. */
export const foundItemEvents = pgTable(
  'found_item_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    foundItemId: uuid('found_item_id')
      .notNull()
      .references(() => foundItems.id, { onDelete: 'cascade' }),
    kind: foundItemEventKindEnum('kind').notNull(),
    summary: text('summary').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    /** A name when the actor holds no account (a finder from an outside firm). */
    actorName: text('actor_name'),
    detail: text('detail'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('found_item_events_item_idx').on(t.foundItemId, t.occurredAt)],
);
