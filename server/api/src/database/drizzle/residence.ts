/**
 * §7 RESIDENCE.
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
  check,
  date,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { amount, currency, timestamps } from './columns';
import { adapterModeEnum, brokerStatusEnum, paymentAttemptStateEnum, cautionStatusEnum, escrowSourceEnum, escrowStatusEnum, filingStatusEnum, invitationStatusEnum, leaseStatusEnum, maintenanceCategoryEnum, maintenancePriorityEnum, maintenanceRaisedByRoleEnum, maintenanceStatusEnum, placementStatusEnum, renewalStatusEnum, rentStatusEnum, signerRoleEnum } from './enums';
import { bookings, guestStays, storedObjects } from './hospitality';
import { listings, properties, rooms, spaces } from './inventory';
import { departments } from './operations';
import { orgs, workspaces } from './org';

export const brokers = pgTable(
  'brokers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    nationalId: text('national_id').notNull(),
    name: text('name'),
    phone: text('phone'),
    email: text('email'),
    status: brokerStatusEnum('status').notNull().default('active'),
    licenseInfo: jsonb('license_info'),
    ...timestamps,
  },
  (t) => [
    unique('brokers_user_uk').on(t.userId),
    unique('brokers_national_id_uk').on(t.nationalId),
  ],
);


export const leases = pgTable(
  'leases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    tenantUserId: uuid('tenant_user_id').references(() => users.id),
    brokerId: uuid('broker_id').references(() => brokers.id),
    monthlyRentRwf: amount('monthly_rent_rwf'),
    cautionRwf: amount('caution_rwf'),
    currency: currency(),
    startDate: date('start_date'),
    endDate: date('end_date'),
    status: leaseStatusEnum('status').notNull().default('draft'),
    contractContent: jsonb('contract_content'),
    contractObjectId: uuid('contract_object_id').references(
      () => storedObjects.id,
    ),
    landlordSignedAt: timestamp('landlord_signed_at', { withTimezone: true }),
    tenantSignedAt: timestamp('tenant_signed_at', { withTimezone: true }),
    supersedesLeaseId: uuid('supersedes_lease_id').references(
      (): AnyPgColumn => leases.id,
    ),
    tenantName: text('tenant_name'),
    tenantNationalId: text('tenant_national_id'),
    tenantEmail: text('tenant_email'),
    tenantPhone: text('tenant_phone'),
    version: integer('version').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('leases_active_room_uk')
      .on(t.roomId)
      .where(sql`${t.status} = 'active'`),
    index('leases_org_idx').on(t.orgId),
    index('leases_tenant_idx').on(t.tenantUserId),
    index('leases_workspace_status_idx').on(t.workspaceId, t.status),
  ],
);


export const leaseSignatures = pgTable('lease_signatures', {
  id: uuid('id').primaryKey().defaultRandom(),
  leaseId: uuid('lease_id')
    .notNull()
    .references(() => leases.id),
  signerRole: signerRoleEnum('signer_role').notNull(),
  signerUserId: uuid('signer_user_id').references(() => users.id),
  signerEmail: text('signer_email'),
  ipAddress: inet('ip_address'),
  signedAt: timestamp('signed_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});


export const rentCharges = pgTable(
  'rent_charges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id, { onDelete: 'cascade' }),
    periodMonth: date('period_month').notNull(),
    amountRwf: amount('amount_rwf'),
    paidAmountRwf: amount('paid_amount_rwf').default(0),
    currency: currency(),
    status: rentStatusEnum('status').notNull().default('due'),
    dueDate: date('due_date'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    /**
     * Recording a rent payment moves money, so it carries a client key
     * (ADR-012, AC-14; the idempotency rule in architecture-schema.md).
     *
     * The lease+period unique already stops a SECOND charge for one month. It
     * does not stop a retried PAYMENT from adding to `paid_amount_rwf` twice,
     * which is the failure that matters: a front desk on a property network
     * retries, and the tenant is then shown as having paid what they did not.
     */
    idempotencyKey: text('idempotency_key'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('rent_charges_lease_period_uk').on(t.leaseId, t.periodMonth),
    unique('rent_charges_idempotency_key_uk').on(t.idempotencyKey),
  ],
);


export const escrows = pgTable(
  'escrows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    source: escrowSourceEnum('source').notNull(),
    bookingId: uuid('booking_id').references(() => bookings.id),
    cautionHoldId: uuid('caution_hold_id').references(
      (): AnyPgColumn => cautionHolds.id,
    ),
    amountRwf: amount('amount_rwf'),
    currency: currency(),
    status: escrowStatusEnum('status').notNull().default('held'),
    adapterRef: text('adapter_ref'),
    adapterMode: adapterModeEnum('adapter_mode').notNull().default('mock'),
    idempotencyKey: text('idempotency_key'),
    /**
     * SHA-256 (first 16 hex) of the stay the attempt asked for: room type,
     * dates, guests, refundability (review 3.4). A replay on the same attempt
     * token with a DIFFERENT stay is refused rather than answered with the
     * first booking; without this a retried press could hand a guest dates
     * they never asked for.
     */
    attemptFingerprint: text('attempt_fingerprint'),
    ...timestamps,
  },
  (t) => [unique('escrows_idempotency_key_uk').on(t.idempotencyKey)],
);

/**
 * The durable record of money that still has to move (review 3.3).
 *
 * A compensating refund, void or release used to exist only as a Redis job,
 * and as a log line when Redis refused it. This row is written BEFORE the job
 * is queued, so a queue outage during a payment incident — exactly when these
 * spike — loses nothing. The worker stamps `done_at` when the provider
 * confirms; a one-minute sweep re-queues anything due and undone. Redis is the
 * wake-up; this table is the truth.
 */
export const paymentCompensations = pgTable(
  'payment_compensations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: text('kind').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    workspaceId: uuid('workspace_id').notNull(),
    originalRef: text('original_ref').notNull(),
    amountRwf: amount('amount_rwf').notNull(),
    bookingId: uuid('booking_id'),
    memo: text('memo').notNull(),
    attempts: integer('attempts').notNull().default(0),
    nextAt: timestamp('next_at', { withTimezone: true }).notNull().defaultNow(),
    lastError: text('last_error'),
    doneAt: timestamp('done_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('payment_compensations_key_uk').on(t.idempotencyKey),
    index('payment_compensations_due_idx')
      .on(t.nextAt)
      .where(sql`${t.doneAt} IS NULL`),
  ],
);


/**
 * One press of confirm on a rail that answers later (ADR-047 D-j).
 *
 * ## Why this table has to exist
 *
 * Every Rwandan mobile money rail pushes a prompt to a handset and settles
 * afterwards: the customer LEAVES our app, approves in the MoMo app or on
 * `*182#`, and the answer arrives by callback. Until now the API had nowhere to
 * put that interval. `BookingService` refused an unsettled capture with a 402
 * and told the guest to press the button again — a human being polling a
 * payment provider by hand — and the mock adapter's own comment explains that
 * it always reports `settled` because doing otherwise "would refuse every
 * booking in development". The async path every real payment on this platform
 * will take was therefore unreachable end to end.
 *
 * A row here is what the provider's callback lands on, what a poll reads, and
 * what the sweep expires. Without it the money is in flight with no record on
 * our side, and the only trace of a guest's charge is a token in their browser.
 *
 * It follows `payment_compensations` above: written BEFORE anyone waits on it,
 * so a crash, a closed tab or a Redis outage loses nothing.
 *
 * ## What it deliberately does not hold
 *
 * The payer's number, unmasked. `payer_masked` is `078••••456` — enough for
 * support to match a person to an attempt, never enough to charge anybody. A
 * card token is not stored at all: it is a bearer credential for one charge and
 * the capture already has it.
 *
 * ## Why the stay is copied onto the row
 *
 * Because the booking does not exist yet. When the callback arrives the server
 * has to write the reservation the guest actually asked for, and the only other
 * copy of that intent is in a browser that may be closed. `attempt_fingerprint`
 * is the same hash `escrows` carries, so a settled attempt cannot be completed
 * into a different stay from the one that was quoted.
 */
export const paymentAttempts = pgTable(
  'payment_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * The capture's idempotency key — `<workspace>:booking-capture:<token>`.
     *
     * Unique, and it is the whole deduplication of this table: one press of
     * confirm is one attempt, however many times a client or a callback
     * arrives. It is also the key the void runs on if this expires.
     */
    idempotencyKey: text('idempotency_key').notNull(),
    /** The uuid the browser minted for this press, as the client addresses it. */
    attemptToken: text('attempt_token').notNull(),
    guestUserId: uuid('guest_user_id')
      .notNull()
      .references(() => users.id),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),

    // --- the stay this attempt is for, because no booking exists yet ---
    roomTypeId: uuid('room_type_id').notNull(),
    checkIn: date('check_in').notNull(),
    checkOut: date('check_out').notNull(),
    guestCount: integer('guest_count').notNull(),
    nonrefundable: boolean('nonrefundable').notNull().default(false),
    attemptFingerprint: text('attempt_fingerprint').notNull(),

    // --- the money, and the rail it is on ---
    amountRwf: amount('amount_rwf'),
    currency: currency(),
    adapterRef: text('adapter_ref'),
    adapterMode: adapterModeEnum('adapter_mode').notNull().default('mock'),
    /** `mobile_money` or `card`. */
    instrumentKind: text('instrument_kind').notNull(),
    /** `mtn_momo` / `airtel_money`, or null for a card. */
    network: text('network'),
    /** `078••••456`. Never the whole number, never a card token. */
    payerMasked: text('payer_masked'),

    state: paymentAttemptStateEnum('state').notNull().default('prompting'),
    /**
     * When an unanswered prompt stops being worth waiting for.
     *
     * Both rails abandon an unanswered prompt within minutes, and a guest
     * staring at a spinner needs an end. Past this the sweep voids the capture
     * and the attempt reads `expired`.
     */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    /** Set when the attempt completed into a reservation. */
    bookingId: uuid('booking_id').references(() => bookings.id),
    /** Why it ended, when it ended badly. Shown to the guest as given. */
    failureReason: text('failure_reason'),
    ...timestamps,
  },
  (t) => [
    unique('payment_attempts_idempotency_key_uk').on(t.idempotencyKey),
    // The guest's own poll: "where did my payment get to".
    index('payment_attempts_guest_idx').on(t.guestUserId, t.attemptToken),
    // The provider's callback arrives with its own reference and nothing else.
    index('payment_attempts_adapter_ref_idx').on(t.adapterRef),
    // The sweep reads only what is still waiting, so the index stays the size
    // of prompts in flight rather than of every payment ever made.
    index('payment_attempts_expiry_idx')
      .on(t.expiresAt)
      .where(sql`${t.state} = 'prompting'`),
  ],
);


export const cautionHolds = pgTable(
  'caution_holds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id),
    amountRwf: amount('amount_rwf'),
    currency: currency(),
    status: cautionStatusEnum('status').notNull().default('held'),
    escrowId: uuid('escrow_id').references(() => escrows.id),
    heldAt: timestamp('held_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [unique('caution_holds_lease_uk').on(t.leaseId)],
);


export const cautionSettlements = pgTable(
  'caution_settlements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id),
    cautionHoldId: uuid('caution_hold_id')
      .notNull()
      .references(() => cautionHolds.id),
    refundedRwf: amount('refunded_rwf'),
    forfeitedRwf: amount('forfeited_rwf'),
    currency: currency(),
    reason: text('reason'),
    evidence: jsonb('evidence'),
    isDisputed: boolean('is_disputed').notNull().default(false),
    settledAt: timestamp('settled_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /**
     * Returning a deposit moves money, so it carries a client key too
     * (ADR-012, AC-14).
     *
     * The one-settlement-per-lease unique below already makes a repeat fail,
     * but it fails with a constraint violation rather than returning what the
     * first call decided. The key is what lets a retry answer "here is the
     * settlement you already made" instead of an error the desk has to guess at.
     */
    idempotencyKey: text('idempotency_key'),
  },
  (t) => [
    unique('caution_settlements_lease_uk').on(t.leaseId),
    unique('caution_settlements_idempotency_key_uk').on(t.idempotencyKey),
  ],
);


export const moveOutNotices = pgTable('move_out_notices', {
  id: uuid('id').primaryKey().defaultRandom(),
  leaseId: uuid('lease_id')
    .notNull()
    .references(() => leases.id, { onDelete: 'cascade' }),
  filedByUserId: uuid('filed_by_user_id').references(() => users.id),
  moveOutDate: date('move_out_date').notNull(),
  message: text('message'),
  noticeGivenDays: integer('notice_given_days'),
  isShortNotice: boolean('is_short_notice').notNull().default(false),
  filedAt: timestamp('filed_at', { withTimezone: true }).notNull().defaultNow(),
});


export const leaseRenewals = pgTable('lease_renewals', {
  id: uuid('id').primaryKey().defaultRandom(),
  leaseId: uuid('lease_id')
    .notNull()
    .references(() => leases.id, { onDelete: 'cascade' }),
  requestedByUserId: uuid('requested_by_user_id').references(() => users.id),
  requestedEndDate: date('requested_end_date'),
  status: renewalStatusEnum('status').notNull().default('pending'),
  decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  ...timestamps,
});


export const maintenanceTickets = pgTable(
  'maintenance_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * ADR-016 D16: NULLABLE now. It was NOT NULL, which meant a maintenance
     * ticket could not exist without a lease and a hotel has no lease. The
     * `ticket.advance` command ADR-012 shipped was therefore residence only and
     * nobody reading its route would have guessed.
     */
    leaseId: uuid('lease_id').references(() => leases.id, {
      onDelete: 'cascade',
    }),
    /** The hospitality half: a work order raised against a room. */
    roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'cascade' }),
    spaceId: uuid('space_id').references(() => spaces.id, {
      onDelete: 'cascade',
    }),
    guestStayId: uuid('guest_stay_id').references(() => guestStays.id),
    propertyId: uuid('property_id').references(() => properties.id, {
      onDelete: 'cascade',
    }),
    orgId: uuid('org_id').references(() => orgs.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    /** Engineering. Stays nullable: a ticket raised before it exists is real. */
    departmentId: uuid('department_id').references(
      (): AnyPgColumn => departments.id,
    ),
    raisedByUserId: uuid('raised_by_user_id').references(() => users.id),
    raisedByRole: maintenanceRaisedByRoleEnum('raised_by_role'),
    title: text('title').notNull(),
    description: text('description'),
    category: maintenanceCategoryEnum('category'),
    priority: maintenancePriorityEnum('priority').notNull().default('normal'),
    photoObjectKeys: jsonb('photo_object_keys'),
    status: maintenanceStatusEnum('status').notNull().default('open'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('maintenance_tickets_workspace_status_idx').on(
      t.workspaceId,
      t.status,
    ),
    index('maintenance_tickets_property_idx').on(t.propertyId),
    index('maintenance_tickets_room_idx').on(t.roomId),
    index('maintenance_tickets_lease_idx').on(t.leaseId),
    /**
     * A ticket has to be ABOUT something. With `lease_id` now nullable, nothing
     * else would stop a row that names no subject at all, and a work order
     * nobody can locate is worse than no work order.
     */
    check(
      'maintenance_tickets_subject_at_least_one',
      sql`${t.roomId} IS NOT NULL OR ${t.spaceId} IS NOT NULL OR ${t.leaseId} IS NOT NULL`,
    ),
  ],
);


export const maintenanceEvents = pgTable('maintenance_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id')
    .notNull()
    .references(() => maintenanceTickets.id, { onDelete: 'cascade' }),
  authorUserId: uuid('author_user_id').references(() => users.id),
  note: text('note'),
  photoObjectId: uuid('photo_object_id').references(() => storedObjects.id),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});


export const visitorLogEntries = pgTable('visitor_log_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  leaseId: uuid('lease_id')
    .notNull()
    .references(() => leases.id, { onDelete: 'cascade' }),
  visitorName: text('visitor_name'),
  visitorPhone: text('visitor_phone'),
  relation: text('relation'),
  arrivalAt: timestamp('arrival_at', { withTimezone: true }),
  departureAt: timestamp('departure_at', { withTimezone: true }),
});


export const visitorAccessRequests = pgTable('visitor_access_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  leaseId: uuid('lease_id')
    .notNull()
    .references(() => leases.id, { onDelete: 'cascade' }),
  requestedByUserId: uuid('requested_by_user_id').references(() => users.id),
  forDate: date('for_date'),
  reason: text('reason'),
  requestedAt: timestamp('requested_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});


export const leaseInvitations = pgTable(
  'lease_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    token: text('token').notNull(),
    status: invitationStatusEnum('status').notNull().default('sent'),
    acceptedByUserId: uuid('accepted_by_user_id').references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [unique('lease_invitations_token_uk').on(t.token)],
);


export const contactReveals = pgTable('contact_reveals', {
  id: uuid('id').primaryKey().defaultRandom(),
  brokerId: uuid('broker_id')
    .notNull()
    .references(() => brokers.id),
  listingId: uuid('listing_id').references(() => listings.id),
  landlordOrgId: uuid('landlord_org_id').references(() => orgs.id),
  revealedPhone: text('revealed_phone'),
  revealedEmail: text('revealed_email'),
  revealedAt: timestamp('revealed_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});


/**
 * A broker's reveal credits, as a ledger rather than a counter (ADR-038 child 0,
 * AC-S13).
 *
 * The balance is `sum(delta)` for a broker. Positive rows grant, negative rows
 * spend. Nothing decrements a column, so a balance can always be explained by
 * the rows that produced it, and a bad spend is corrected by another row rather
 * than by editing history.
 *
 * `reveal_id` is unique, which is the whole double-spend defence: a second
 * attempt to charge the same reveal CONFLICTS instead of deducting twice, with
 * no lock and no read-modify-write. It is the same trick the booking capture
 * already plays with `idempotency_key`.
 */
export const brokerRevealCredits = pgTable(
  'broker_reveal_credits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brokerId: uuid('broker_id')
      .notNull()
      .references(() => brokers.id),
    /** Positive grants, negative spends. Credits, not money. */
    delta: integer('delta').notNull(),
    /** 'plan_grant' | 'reveal' | 'refund' | 'correction'. */
    reason: text('reason').notNull(),
    /** Set when `reason` is 'reveal'. Null for every other reason. */
    revealId: uuid('reveal_id').references(() => contactReveals.id),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('broker_reveal_credits_broker_idx').on(t.brokerId, t.createdAt),
    // One spend per reveal. This is the constraint, not an optimisation.
    unique('broker_reveal_credits_reveal_uk').on(t.revealId),
  ],
);


export const tenantPlacements = pgTable('tenant_placements', {
  id: uuid('id').primaryKey().defaultRandom(),
  brokerId: uuid('broker_id')
    .notNull()
    .references(() => brokers.id),
  listingId: uuid('listing_id').references(() => listings.id),
  landlordOrgId: uuid('landlord_org_id').references(() => orgs.id),
  status: placementStatusEnum('status').notNull().default('initiated'),
  leaseId: uuid('lease_id').references(() => leases.id),
  initiatedAt: timestamp('initiated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  ...timestamps,
});


export const contractFilings = pgTable(
  'contract_filings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id),
    status: filingStatusEnum('status').notNull().default('pending'),
    clockStartAt: timestamp('clock_start_at', { withTimezone: true }),
    dueBy: timestamp('due_by', { withTimezone: true }),
    filingCopyObjectId: uuid('filing_copy_object_id').references(
      () => storedObjects.id,
    ),
    attempts: integer('attempts').notNull().default(0),
    failureReason: text('failure_reason'),
    adapterMode: adapterModeEnum('adapter_mode').notNull().default('mock'),
    ...timestamps,
  },
  (t) => [unique('contract_filings_lease_uk').on(t.leaseId)],
);

// ===========================================================================
// Shared: MESSAGING (§6.7)
// ===========================================================================
