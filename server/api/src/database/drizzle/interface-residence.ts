/**
 * The residence screens of the new interface (real-data 1.3.1): what a landlord's building has that
 * the tenancy tables never modelled.
 *
 * Tenancies, rent charges, deposits, tickets and notices keep their existing owners in `residence.ts`;
 * these tables hang off them. Every one is scoped by `workspace_id` (the landlord's business) and,
 * where a screen is per building, by `property_id`. Money is whole francs.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
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
import { amount, timestamps } from './columns';
import { storedObjects } from './hospitality';
import { properties, rooms } from './inventory';
import { workspaces } from './org';
import { brokers, leases, maintenanceTickets, rentCharges } from './residence';

/** A building, wing or block of a residence ("Block A"): nothing in `rooms` or `spaces` modelled one. */
export const propertyBlocks = pgTable(
  'property_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    /** "A": what a unit label starts with. */
    code: text('code').notNull(),
    name: text('name').notNull(),
    /** The kind of units in it: "1 bedroom", "3 bedrooms and penthouses". */
    kind: text('kind').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [unique('property_blocks_property_code_uk').on(t.propertyId, t.code)],
);

/**
 * A rented unit: the room it is, the block it stands in, and the rent asked for it while vacant.
 * The rent a tenant pays is the LEASE's; this is what the landlord asks before there is one.
 */
export const residenceUnits = pgTable(
  'residence_units',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    blockId: uuid('block_id')
      .notNull()
      .references(() => propertyBlocks.id),
    askingRentRwf: amount('asking_rent_rwf').notNull(),
    /** The day the last tenancy ended; null while let. */
    vacantSince: date('vacant_since'),
    /** The manager's note on the unit ("repaint booked 14 Oct"). */
    note: text('note'),
    ...timestamps,
  },
  (t) => [
    unique('residence_units_room_uk').on(t.roomId),
    index('residence_units_scope_idx').on(t.workspaceId, t.propertyId),
    check('residence_units_asking_rent_positive', sql`${t.askingRentRwf} > 0`),
  ],
);

/**
 * A rent payment as its own record (real-data 1.3.1).
 *
 * Until now a payment was only a bump of `rent_charges.paid_amount_rwf`, so a provider reference, a
 * payment still waiting for the provider, or one whose result is unknown had nowhere to live, and a
 * landlord could not tell "paid" from "someone said they paid". `paid_amount_rwf` still counts
 * VERIFIED money only; a pending or unknown row here is evidence, never collection.
 *
 * `rent_charge_id` is the charge the payment is (or will be, once verified) allocated to: the oldest
 * open charge of the lease when it was recorded.
 */
export const rentPayments = pgTable(
  'rent_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id),
    rentChargeId: uuid('rent_charge_id')
      .notNull()
      .references(() => rentCharges.id),
    amountRwf: amount('amount_rwf').notNull(),
    /** mtn_momo, airtel_money, bank_transfer, cash. */
    method: text('method').notNull(),
    /** The bank slip, MoMo or Airtel reference: what Payments matches the statement against. */
    providerRef: text('provider_ref').notNull(),
    status: text('status').notNull().default('pending'),
    /** Null when the provider's callback wrote it rather than a person. */
    recordedByUserId: uuid('recorded_by_user_id').references(() => users.id),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    /** `<workspace>:<client key>`: one press of "Save as pending" is one row however often it is retried. */
    idempotencyKey: text('idempotency_key').notNull(),
    ...timestamps,
  },
  (t) => [
    unique('rent_payments_idempotency_key_uk').on(t.idempotencyKey),
    index('rent_payments_scope_status_idx').on(t.workspaceId, t.status, t.receivedAt),
    index('rent_payments_lease_idx').on(t.leaseId),
    check('rent_payments_amount_positive', sql`${t.amountRwf} > 0`),
    check('rent_payments_method_known', sql`${t.method} IN ('mtn_momo', 'airtel_money', 'bank_transfer', 'cash')`),
    check('rent_payments_status_known', sql`${t.status} IN ('pending', 'verified', 'unknown', 'failed')`),
    check('rent_payments_verified_shape', sql`(${t.status} = 'verified') = (${t.verifiedAt} IS NOT NULL)`),
  ],
);

/** Every reminder about rent owed, per lease: what was sent, how, and whether it was read. */
export const rentReminders = pgTable(
  'rent_reminders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id),
    channel: text('channel').notNull(),
    /** The message as sent, or what was said on a call. */
    note: text('note').notNull(),
    sentByUserId: uuid('sent_by_user_id').references(() => users.id),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (t) => [
    index('rent_reminders_scope_sent_idx').on(t.workspaceId, t.sentAt),
    index('rent_reminders_lease_idx').on(t.leaseId),
    check('rent_reminders_channel_known', sql`${t.channel} IN ('in_app', 'in_app_email', 'email', 'call', 'letter')`),
  ],
);

/**
 * A gate code: who may come in, to which unit, between when and when.
 *
 * A code is four digits and unique among the codes still in use at the building (`expected` or
 * `approved`), which the partial index holds when two people ask at once. A used or expired code may
 * come round again. A management pass for a vacant unit has no lease.
 */
export const visitorPasses = pgTable(
  'visitor_passes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    leaseId: uuid('lease_id').references(() => leases.id),
    /** The repair a contractor's pass was arranged for. */
    maintenanceTicketId: uuid('maintenance_ticket_id').references(() => maintenanceTickets.id, {
      onDelete: 'set null',
    }),
    kind: text('kind').notNull().default('guest'),
    visitorName: text('visitor_name').notNull(),
    code: text('code').notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
    validTo: timestamp('valid_to', { withTimezone: true }).notNull(),
    overnight: boolean('overnight').notNull().default(false),
    status: text('status').notNull().default('expected'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    /** Registered by the tenant rather than by management. */
    byTenant: boolean('by_tenant').notNull().default(false),
    usedAt: timestamp('used_at', { withTimezone: true }),
    leftAt: timestamp('left_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('visitor_passes_live_code_uk')
      .on(t.propertyId, t.code)
      .where(sql`${t.status} IN ('expected', 'approved')`),
    index('visitor_passes_scope_status_idx').on(t.workspaceId, t.status, t.validFrom),
    index('visitor_passes_lease_idx').on(t.leaseId),
    check('visitor_passes_window', sql`${t.validTo} > ${t.validFrom}`),
    check('visitor_passes_code_shape', sql`${t.code} ~ '^[0-9]{4}$'`),
    check('visitor_passes_kind_known', sql`${t.kind} IN ('guest', 'contractor')`),
    check('visitor_passes_status_known', sql`${t.status} IN ('expected', 'approved', 'used', 'expired', 'revoked')`),
  ],
);

/** The landlord's standard lease clauses, in contract order. A lease copies them when it is drafted. */
export const leaseClauseTemplates = pgTable(
  'lease_clause_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    code: text('code').notNull(),
    title: text('title').notNull(),
    note: text('note').notNull(),
    /** Still waiting for counsel: a draft can use it, the screen flags it. */
    needsReview: boolean('needs_review').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [unique('lease_clause_templates_workspace_code_uk').on(t.workspaceId, t.code)],
);

/**
 * Someone applying to rent a unit, before there is any lease: an application, never an unsigned
 * fictional lease. It is screened by hand (the checks the screen lists) and, once every check is
 * recorded, turned into a lease DRAFT (`lease_id`).
 */
export const leaseApplications = pgTable(
  'lease_applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    stage: text('stage').notNull().default('invited'),
    /** How they came: "Invitation", "Referred by Emmanuel Twagira", "Walk-in". */
    source: text('source').notNull(),
    /** The broker who referred them; a placement fee is due only if a lease is signed. */
    brokerId: uuid('broker_id').references(() => brokers.id),
    brokerFeeRwf: amount('broker_fee_rwf'),
    brokerTerms: text('broker_terms'),
    referredAt: timestamp('referred_at', { withTimezone: true }),
    desiredMoveIn: date('desired_move_in'),
    termMonths: integer('term_months'),
    occupants: text('occupants'),
    offeredRentRwf: amount('offered_rent_rwf'),
    depositRwf: amount('deposit_rwf'),
    /** The manual checks recorded so far, by id (`ScreeningCheckId`). */
    screening: jsonb('screening').$type<string[]>().notNull().default([]),
    declineReason: text('decline_reason'),
    /** The lease draft it became. */
    leaseId: uuid('lease_id').references(() => leases.id),
    ...timestamps,
  },
  (t) => [
    index('lease_applications_scope_stage_idx').on(t.workspaceId, t.stage),
    check(
      'lease_applications_stage_known',
      sql`${t.stage} IN ('invited', 'screening', 'ready', 'declined', 'converted')`,
    ),
    check('lease_applications_converted_shape', sql`(${t.stage} = 'converted') = (${t.leaseId} IS NOT NULL)`),
    check(
      'lease_applications_broker_shape',
      sql`${t.brokerId} IS NOT NULL OR (${t.brokerFeeRwf} IS NULL AND ${t.brokerTerms} IS NULL)`,
    ),
  ],
);

/** A document an applicant owes or has given, and whether someone checked it against the original. */
export const leaseApplicationDocuments = pgTable(
  'lease_application_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => leaseApplications.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** "Uploaded 8 Oct · checked against the original by Solange, 11 Oct". */
    note: text('note').notNull().default(''),
    state: text('state').notNull().default('requested'),
    storedObjectId: uuid('stored_object_id').references(() => storedObjects.id),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index('lease_application_documents_application_idx').on(t.applicationId),
    check(
      'lease_application_documents_state_known',
      sql`${t.state} IN ('requested', 'waiting', 'uploaded', 'checked')`,
    ),
  ],
);
