/**
 * RENTALS: the leaf schema file of the rentals rebuild (blueprint 1.1).
 *
 * It replaces `interface-residence.ts`. Nothing in the schema imports it back,
 * so it may reference any table (leases, charges, payouts) without adding an
 * import cycle. What it holds:
 *
 *   - a landlord's rentals settings (`landlord_profiles`);
 *   - money on a lease: payments, their allocations to charges, the deposit,
 *     and reminders (charges themselves live with the lease in `residence.ts`);
 *   - the lease timeline (`lease_events`);
 *   - filings of a lease with the tax administration (`lease_filings`);
 *   - LEGACY tables of the first residence screens, kept only until migration
 *     0089 drops them once their rows are migrated and nothing reads them:
 *     `residence_units` (now `rental_units`), `lease_clause_templates`,
 *     `lease_applications` and `lease_application_documents` (dropped
 *     features).
 *
 * Statuses and kinds are enums built from `@injishi/contracts` rentals vocab.
 * Money is whole francs; calendar facts are `date` in Kigali.
 */
import { ExpenseCategory, ExpenseMethod, ExpenseSource, LoanPurpose, TaxDeclarationStatus } from '@injishi/contracts';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { amount, currency, timestamps } from './columns';
import {
  adapterModeEnum,
  brokerFeeKindEnum,
  depositRefundMethodEnum,
  filingStatusEnum,
  idKindEnum,
  leaseActorRoleEnum,
  leaseDepositStatusEnum,
  leaseEventKindEnum,
  leaseFilingKindEnum,
  leasePaymentChannelEnum,
  leasePaymentMethodEnum,
  leasePaymentStatusEnum,
  leaseReminderChannelEnum,
  leaseReminderKindEnum,
  taxpayerKindEnum,
} from './enums';
import { storedObjects } from './hospitality';
import { properties, propertyBlocks, rentalUnits, rooms } from './inventory';
import { payouts } from './money';
import { orgs, workspaces } from './org';
import { brokers, leaseCharges, leases, maintenanceTickets, tenants } from './residence';

// ===========================================================================
// Settings
// ===========================================================================

/**
 * A residence business's rentals settings: one row per landlord org, made
 * when the business is (or, for one that predates it, by migration 0074).
 *
 * The lease defaults are what a new lease starts from; each lease keeps its
 * own copy. `taxpayer_kind` stays null until the landlord answers whether they
 * let as a person or a company. `setup_completed_at` is when the setup steps
 * were finished, so the app knows whether to offer them.
 */
export const landlordProfiles = pgTable(
  'landlord_profiles',
  {
    orgId: uuid('org_id')
      .primaryKey()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    taxpayerKind: taxpayerKindEnum('taxpayer_kind'),
    /** Who signs leases for the business, as their ID document names them. */
    signatoryName: text('signatory_name'),
    signatoryIdKind: idKindEnum('signatory_id_kind'),
    signatoryIdNumber: text('signatory_id_number'),
    /** E.164, shown to tenants. */
    contactPhone: text('contact_phone'),
    /** Lower case, shown to tenants. */
    contactEmail: text('contact_email'),
    defaultGraceDays: integer('default_grace_days').notNull().default(5),
    defaultNoticeDays: integer('default_notice_days').notNull().default(15),
    /** The day of the month rent falls due on a new lease (1 to 28). Null: the day the lease starts. */
    defaultRentDueDay: integer('default_rent_due_day'),
    /** When the landlord last saved the lease defaults; null while they are the starting values. */
    leaseDefaultsSetAt: timestamp('lease_defaults_set_at', { withTimezone: true }),
    /** The fee a unit starts with when brokers may offer it: a percent of the first month, or fixed. */
    brokerFeeKind: brokerFeeKindEnum('broker_fee_kind'),
    /** A broker's placement fee, as a percent of one month's rent. Null: not set. */
    brokerFeePercent: integer('broker_fee_percent'),
    brokerFeeRwf: amount('broker_fee_rwf'),
    /** Start a signed lease on its start date without the landlord pressing Start. */
    autoStartLeases: boolean('auto_start_leases').notNull().default(true),
    setupCompletedAt: timestamp('setup_completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('landlord_profiles_workspace_uk').on(t.workspaceId),
    check('landlord_profiles_grace_days_range', sql`${t.defaultGraceDays} BETWEEN 0 AND 31`),
    check('landlord_profiles_notice_days_range', sql`${t.defaultNoticeDays} BETWEEN 15 AND 180`),
    check(
      'landlord_profiles_due_day_range',
      sql`${t.defaultRentDueDay} IS NULL OR ${t.defaultRentDueDay} BETWEEN 1 AND 28`,
    ),
    check(
      'landlord_profiles_broker_fee_range',
      sql`${t.brokerFeePercent} IS NULL OR ${t.brokerFeePercent} BETWEEN 0 AND 200`,
    ),
    check(
      'landlord_profiles_broker_fee_shape',
      sql`${t.brokerFeeKind} IS NULL
          OR (${t.brokerFeeKind} = 'percent' AND ${t.brokerFeePercent} IS NOT NULL AND ${t.brokerFeeRwf} IS NULL)
          OR (${t.brokerFeeKind} = 'fixed' AND ${t.brokerFeeRwf} > 0 AND ${t.brokerFeePercent} IS NULL)`,
    ),
    check(
      'landlord_profiles_signatory_id_shape',
      sql`(${t.signatoryIdKind} IS NULL AND ${t.signatoryIdNumber} IS NULL)
        OR (${t.signatoryIdKind} = 'national_id' AND ${t.signatoryIdNumber} ~ '^[0-9]{16}$')
        OR (${t.signatoryIdKind} = 'passport' AND ${t.signatoryIdNumber} ~ '^[A-Z0-9]{5,20}$')`,
    ),
    check(
      'landlord_profiles_contact_shape',
      sql`(${t.contactEmail} IS NULL OR ${t.contactEmail} = lower(${t.contactEmail}))
        AND (${t.contactPhone} IS NULL OR ${t.contactPhone} ~ '^[+][1-9][0-9]{7,14}$')`,
    ),
  ],
);

// ===========================================================================
// The lease timeline
// ===========================================================================

/**
 * What happened on a lease, in order: its timeline (blueprint 1.2). Written in
 * the same transaction as the change it records. `visible_to_tenant` decides
 * whether the tenant's own timeline shows it; `payload` holds ids and figures
 * only, never personal data the row does not need.
 */
export const leaseEvents = pgTable(
  'lease_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    kind: leaseEventKindEnum('kind').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    actorRole: leaseActorRoleEnum('actor_role').notNull(),
    visibleToTenant: boolean('visible_to_tenant').notNull().default(false),
    payload: jsonb('payload').notNull().default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('lease_events_lease_idx').on(t.leaseId, t.occurredAt),
    index('lease_events_scope_idx').on(t.workspaceId, t.occurredAt),
    check(
      'lease_events_actor_shape',
      sql`${t.actorRole} = 'system' OR ${t.actorUserId} IS NOT NULL`,
    ),
  ],
);

// ===========================================================================
// Money on a lease: payments, allocations, the deposit, reminders
// ===========================================================================

/**
 * A payment on a lease: THE one payment record (blueprint 1.2; `rent_payments`
 * renamed by migration 0079). Only `succeeded` counts as money received.
 *
 *   gateway    paid through Injishi (MoMo, Airtel Money or card) by the tenant
 *              (`payer_user_id`): pending until the rail answers, then paid
 *              out to the landlord (`payout_id`).
 *   recorded   money the landlord already holds (cash, a bank slip, MoMo to
 *              their own number), written down by them (`recorded_by_user_id`,
 *              `received_on`, `reference`); never paid out.
 *
 * What it pays is in `lease_payment_allocations`; whatever is not allocated is
 * the tenant's credit, used first on the next charge. A mistake is reversed,
 * never edited or deleted. `legacy` marks a payment migration 0079 carried
 * over from the old rent roll: it may have no recorder, and an old claim that
 * was never confirmed is kept as `expired` (or `failed`).
 */
export const leasePayments = pgTable(
  'lease_payments',
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
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    channel: leasePaymentChannelEnum('channel').notNull(),
    method: leasePaymentMethodEnum('method').notNull(),
    amountRwf: amount('amount_rwf').notNull(),
    currency: currency(),
    status: leasePaymentStatusEnum('status').notNull().default('pending'),
    /** The tenant who paid through the gateway. */
    payerUserId: uuid('payer_user_id').references(() => users.id),
    /** `078••••456`: never the whole number, never a card token. */
    payerMasked: text('payer_masked'),
    /** The rail's own reference for a gateway payment. */
    adapterRef: text('adapter_ref'),
    adapterMode: adapterModeEnum('adapter_mode'),
    /** When an unanswered gateway prompt stops being worth waiting for. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
    /** The bank slip, MoMo or Airtel reference the landlord wrote down. */
    reference: text('reference'),
    /** The day the landlord received a recorded payment. */
    receivedOn: date('received_on'),
    /** A photo or scan of the slip. */
    receiptObjectId: uuid('receipt_object_id').references(() => storedObjects.id),
    recordedByUserId: uuid('recorded_by_user_id').references(() => users.id),
    succeededAt: timestamp('succeeded_at', { withTimezone: true }),
    reversedAt: timestamp('reversed_at', { withTimezone: true }),
    reversedByUserId: uuid('reversed_by_user_id').references(() => users.id),
    reverseReason: text('reverse_reason'),
    /** The payout that sent this gateway payment on to the landlord. */
    payoutId: uuid('payout_id').references(() => payouts.id),
    /** "R-2026-0042": printed on the receipt. Unique per business. */
    receiptNumber: text('receipt_number'),
    /** `<workspace>:<op>:<client key>`: one press is one payment however often it is retried. */
    idempotencyKey: text('idempotency_key').notNull(),
    /**
     * The charges the tenant picked for a gateway payment (WP 1.6b, migration
     * 0086), applied when it settles. Null: the open ones, oldest due first.
     */
    requestedChargeIds: uuid('requested_charge_ids').array(),
    legacy: boolean('legacy').notNull().default(false),
    // --- LEGACY, dropped by migration 0089 ---
    /** @deprecated what it pays is in `lease_payment_allocations`. */
    rentChargeId: uuid('rent_charge_id').references(() => leaseCharges.id),
    /** @deprecated `received_on` / `succeeded_at`. */
    receivedAt: timestamp('received_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('lease_payments_idempotency_key_uk').on(t.idempotencyKey),
    unique('lease_payments_payout_uk').on(t.payoutId),
    uniqueIndex('lease_payments_receipt_number_uk')
      .on(t.workspaceId, t.receiptNumber)
      .where(sql`${t.receiptNumber} IS NOT NULL`),
    index('lease_payments_scope_status_idx').on(t.workspaceId, t.status, t.succeededAt),
    index('lease_payments_lease_idx').on(t.leaseId),
    index('lease_payments_adapter_ref_idx').on(t.adapterRef),
    index('lease_payments_pending_idx')
      .on(t.expiresAt)
      .where(sql`${t.status} = 'pending'`),
    check('lease_payments_amount_positive', sql`${t.amountRwf} > 0`),
    check(
      'lease_payments_channel_shape',
      sql`(${t.channel} = 'gateway' AND ${t.method} IN ('mtn_momo', 'airtel_money', 'card')
            AND ${t.payerUserId} IS NOT NULL AND ${t.adapterMode} IS NOT NULL AND NOT ${t.legacy})
        OR (${t.channel} = 'recorded' AND ${t.status} IN ('succeeded', 'reversed')
            AND ${t.receivedOn} IS NOT NULL AND (${t.recordedByUserId} IS NOT NULL OR ${t.legacy})
            AND ${t.payoutId} IS NULL)
        OR (${t.legacy} AND ${t.channel} = 'recorded' AND ${t.status} IN ('failed', 'expired'))`,
    ),
    check(
      'lease_payments_succeeded_shape',
      sql`(${t.status} IN ('succeeded', 'reversed')) = (${t.succeededAt} IS NOT NULL)`,
    ),
    check(
      'lease_payments_reversed_shape',
      sql`(${t.status} = 'reversed') = (${t.reversedAt} IS NOT NULL)
        AND (${t.reversedAt} IS NULL OR ${t.reverseReason} IS NOT NULL)`,
    ),
  ],
);

/**
 * Which charges a payment paid, and how much of each. Every allocation and the
 * matching `lease_charges.paid_rwf` change are written in one transaction with
 * the charges locked, so the live allocations of a charge always add up to
 * its `paid_rwf`. Reversing a payment releases its allocations
 * (`released_at`); they are never deleted.
 */
export const leasePaymentAllocations = pgTable(
  'lease_payment_allocations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => leasePayments.id),
    chargeId: uuid('charge_id')
      .notNull()
      .references(() => leaseCharges.id),
    amountRwf: amount('amount_rwf').notNull(),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('lease_payment_allocations_live_uk')
      .on(t.paymentId, t.chargeId)
      .where(sql`${t.releasedAt} IS NULL`),
    index('lease_payment_allocations_charge_idx').on(t.chargeId),
    check('lease_payment_allocations_amount_positive', sql`${t.amountRwf} > 0`),
  ],
);

/**
 * The deposit of a lease: THE one deposit record (blueprint 1.2), replacing
 * `caution_holds`, `caution_settlements` and caution escrows. The landlord
 * holds the money.
 *
 *   awaiting   agreed; its charge (`charge_id`, kind deposit) is not paid yet
 *   held       paid, held by the landlord until the tenant moves out
 *   settled    split at move out into what the landlord kept (`deductions`,
 *              each a label and an amount, summing to `kept_rwf`) and what
 *              went back to the tenant (`refunded_rwf`, by gateway transfer,
 *              recorded, or none). The service checks kept + refunded equals
 *              what was paid on the charge.
 *
 * The tenant may dispute a settlement (`tenant_disputed_at`, `dispute_note`).
 */
export const leaseDeposits = pgTable(
  'lease_deposits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id),
    agreedRwf: amount('agreed_rwf').notNull(),
    chargeId: uuid('charge_id')
      .notNull()
      .references(() => leaseCharges.id),
    status: leaseDepositStatusEnum('status').notNull().default('awaiting'),
    keptRwf: amount('kept_rwf'),
    refundedRwf: amount('refunded_rwf'),
    /** `[{ "label": "Broken window", "amountRwf": 40000 }]`. */
    deductions: jsonb('deductions').notNull().default([]),
    refundMethod: depositRefundMethodEnum('refund_method'),
    refundPayoutId: uuid('refund_payout_id').references(() => payouts.id),
    /** The slip or MoMo reference of a recorded refund. */
    refundReference: text('refund_reference'),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    settledByUserId: uuid('settled_by_user_id').references(() => users.id),
    tenantDisputedAt: timestamp('tenant_disputed_at', { withTimezone: true }),
    disputeNote: text('dispute_note'),
    /** `<workspace>:deposit-settle:<client key>`. */
    idempotencyKey: text('idempotency_key'),
    ...timestamps,
  },
  (t) => [
    unique('lease_deposits_lease_uk').on(t.leaseId),
    unique('lease_deposits_charge_uk').on(t.chargeId),
    unique('lease_deposits_idempotency_key_uk').on(t.idempotencyKey),
    unique('lease_deposits_refund_payout_uk').on(t.refundPayoutId),
    index('lease_deposits_scope_status_idx').on(t.workspaceId, t.status),
    check('lease_deposits_agreed_positive', sql`${t.agreedRwf} > 0`),
    check(
      'lease_deposits_amounts_not_negative',
      sql`(${t.keptRwf} IS NULL OR ${t.keptRwf} >= 0) AND (${t.refundedRwf} IS NULL OR ${t.refundedRwf} >= 0)`,
    ),
    check(
      'lease_deposits_settled_shape',
      sql`(${t.status} = 'settled') = (${t.settledAt} IS NOT NULL AND ${t.keptRwf} IS NOT NULL
            AND ${t.refundedRwf} IS NOT NULL AND ${t.refundMethod} IS NOT NULL)`,
    ),
    check(
      'lease_deposits_refund_shape',
      sql`${t.refundMethod} IS NULL OR ((${t.refundMethod} = 'none') = (${t.refundedRwf} = 0))`,
    ),
    check(
      'lease_deposits_refund_payout_shape',
      sql`${t.refundPayoutId} IS NULL OR ${t.refundMethod} = 'gateway'`,
    ),
    check('lease_deposits_dispute_shape', sql`${t.tenantDisputedAt} IS NULL OR ${t.status} = 'settled'`),
    check('lease_deposits_deductions_list', sql`jsonb_typeof(${t.deductions}) = 'array'`),
  ],
);

/**
 * Every reminder about rent owed (blueprint 1.2; `rent_reminders` renamed by
 * migration 0079). The automatic kinds (upcoming, due, overdue) are sent by
 * the reminder job at most once per charge; `manual` is the landlord's own,
 * by app, email, SMS, a call or a letter.
 */
export const leaseReminders = pgTable(
  'lease_reminders',
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
    /** The charge it is about; required for the automatic kinds. */
    chargeId: uuid('charge_id').references(() => leaseCharges.id),
    kind: leaseReminderKindEnum('kind').notNull().default('manual'),
    /**
     * Which of a kind's reminders this is (WP 1.6a, migration 0086): the
     * overdue kind goes out on the first overdue day (0), then 7 (1) and 14
     * (2) days later (`OVERDUE_REMINDER_DAYS` in contracts). 0 for the rest.
     */
    stage: integer('stage').notNull().default(0),
    channel: leaseReminderChannelEnum('channel').notNull(),
    /** The message as sent, or what was said on a call. */
    note: text('note').notNull(),
    sentByUserId: uuid('sent_by_user_id').references(() => users.id),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (t) => [
    index('lease_reminders_scope_sent_idx').on(t.workspaceId, t.sentAt),
    index('lease_reminders_lease_idx').on(t.leaseId),
    uniqueIndex('lease_reminders_auto_uk')
      .on(t.chargeId, t.kind, t.stage)
      .where(sql`${t.kind} <> 'manual'`),
    check('lease_reminders_charge_shape', sql`${t.kind} = 'manual' OR ${t.chargeId} IS NOT NULL`),
    check('lease_reminders_stage_range', sql`${t.stage} BETWEEN 0 AND 9`),
  ],
);

// ===========================================================================
// Filings with the tax administration
// ===========================================================================

/**
 * A copy of a lease the landlord owes the tax administration (blueprint 1.2;
 * `contract_filings` renamed by migration 0082): within 15 days of signing a
 * new lease, 30 days of a change or an early end (`leaseFilingDueOn` in
 * contracts). The landlord files it on RRA's own portal and records it here
 * (`filed_on`, the RRA reference, a photo or PDF of the proof). Late is
 * worked out (pending past `due_on`), never stored.
 */
export const leaseFilings = pgTable(
  'lease_filings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id),
    kind: leaseFilingKindEnum('kind').notNull().default('new_lease'),
    dueOn: date('due_on').notNull(),
    status: filingStatusEnum('status').notNull().default('pending'),
    filedOn: date('filed_on'),
    /** The reference RRA gave the filing. */
    reference: text('reference'),
    proofObjectId: uuid('proof_object_id').references(() => storedObjects.id),
    filedByUserId: uuid('filed_by_user_id').references(() => users.id),
    /** How many reminders the landlord was sent while it was due: 1 five days before, 2 the day before (WP 4.4). */
    remindersSent: integer('reminders_sent').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    check('lease_filings_reminders_range', sql`${t.remindersSent} BETWEEN 0 AND 2`),
    // One new-lease filing and one termination per lease; changes may repeat.
    uniqueIndex('lease_filings_lease_kind_uk')
      .on(t.leaseId, t.kind)
      .where(sql`${t.kind} <> 'change'`),
    index('lease_filings_due_idx')
      .on(t.dueOn)
      .where(sql`${t.status} = 'pending'`),
    check('lease_filings_filed_shape', sql`(${t.status} = 'filed') = (${t.filedOn} IS NOT NULL)`),
  ],
);

// ===========================================================================
// Expenses and paying a fault's fixer (WP 4.3, migration 0088)
// ===========================================================================

/** What an expense was for, how it was paid, whether through Injishi. Lists in contracts `rentals/expenses.ts`. */
export const expenseCategoryEnum = pgEnum('expense_category', ExpenseCategory.options);
export const expenseMethodEnum = pgEnum('expense_method', ExpenseMethod.options);
export const expenseSourceEnum = pgEnum('expense_source', ExpenseSource.options);
/** What a bank loan was for: only interest on a loan to build or buy the rented property lowers the tax. */
export const loanPurposeEnum = pgEnum('loan_purpose', LoanPurpose.options);

/**
 * Money a landlord spent (blueprint 1.2): one row per payment, by business,
 * building and unit, by Kigali day. A fixer paid for a fault names the fault
 * (category repairs). `gateway` rows were paid through Injishi and carry the
 * payout that moved the money; `recorded` ones were paid outside. A row is
 * never deleted: a recorded one is voided with a reason, a gateway one cannot
 * be. Loan interest says what the loan was for, and only loan interest does.
 */
export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    propertyId: uuid('property_id').references(() => properties.id),
    unitId: uuid('unit_id').references(() => rentalUnits.id),
    ticketId: uuid('ticket_id').references(() => maintenanceTickets.id),
    category: expenseCategoryEnum('category').notNull(),
    amountRwf: amount('amount_rwf').notNull(),
    currency: currency(),
    paidOn: date('paid_on').notNull(),
    method: expenseMethodEnum('method').notNull(),
    payeeName: text('payee_name'),
    /** E.164: a fixer's MoMo number, never a bank account. */
    payeePhone: text('payee_phone'),
    note: text('note'),
    receiptObjectId: uuid('receipt_object_id').references(() => storedObjects.id),
    source: expenseSourceEnum('source').notNull(),
    /** The transfer that paid it, for a payment through Injishi. */
    payoutId: uuid('payout_id').references(() => payouts.id),
    loanPurpose: loanPurposeEnum('loan_purpose'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedByUserId: uuid('voided_by_user_id').references(() => users.id),
    voidReason: text('void_reason'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('expenses_payout_uk').on(t.payoutId).where(sql`${t.payoutId} IS NOT NULL`),
    index('expenses_org_paid_on_idx').on(t.orgId, t.paidOn),
    index('expenses_workspace_paid_on_idx').on(t.workspaceId, t.paidOn),
    index('expenses_ticket_idx').on(t.ticketId).where(sql`${t.ticketId} IS NOT NULL`),
    check('expenses_amount_positive', sql`${t.amountRwf} > 0 AND ${t.amountRwf} <= 10000000000`),
    check('expenses_paid_on_floor', sql`${t.paidOn} >= DATE '2000-01-01'`),
    check('expenses_gateway_payout', sql`(${t.source} = 'gateway') = (${t.payoutId} IS NOT NULL)`),
    check('expenses_gateway_not_voided', sql`${t.source} <> 'gateway' OR ${t.voidedAt} IS NULL`),
    check(
      'expenses_void_shape',
      sql`(${t.voidedAt} IS NULL AND ${t.voidedByUserId} IS NULL AND ${t.voidReason} IS NULL)
        OR (${t.voidedAt} IS NOT NULL AND ${t.voidReason} IS NOT NULL AND length(btrim(${t.voidReason})) > 0)`,
    ),
    check('expenses_loan_purpose', sql`(${t.category} = 'loan_interest') = (${t.loanPurpose} IS NOT NULL)`),
    check('expenses_payee_phone_shape', sql`${t.payeePhone} IS NULL OR ${t.payeePhone} ~ '^[+][1-9][0-9]{7,14}$'`),
  ],
);

/**
 * A payment to a fault's fixer through Injishi, while it is on its way
 * (WP 4.3): which fault a repair payout is for. The payout row holds the
 * money (status, amount, adapter reference, where it went, masked); this
 * holds what the payout does not: the fault, the landlord's phone the prompt
 * went to (masked), and the fixer's MoMo number for the expense it becomes.
 * Rentals rows point at the payout, never the other way (blueprint 1.1).
 */
export const maintenancePayouts = pgTable(
  'maintenance_payouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => maintenanceTickets.id),
    payoutId: uuid('payout_id')
      .notNull()
      .references(() => payouts.id),
    /** `078••••456`: the landlord's phone the prompt went to. */
    payerMasked: text('payer_masked').notNull(),
    /** The fixer's MoMo number (E.164), kept for the expense. Null for a bank transfer. */
    payeePhone: text('payee_phone'),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('maintenance_payouts_payout_uk').on(t.payoutId),
    index('maintenance_payouts_ticket_idx').on(t.ticketId),
    check('maintenance_payouts_payee_phone_shape', sql`${t.payeePhone} IS NULL OR ${t.payeePhone} ~ '^[+][1-9][0-9]{7,14}$'`),
  ],
);

// ===========================================================================
// Rental income tax (WP 4.4, migration 0089)
// ===========================================================================

/** Where a year's rental income tax declaration stands. The list is `TaxDeclarationStatus` in contracts. */
export const taxDeclarationStatusEnum = pgEnum('tax_declaration_status', TaxDeclarationStatus.options);

/**
 * A year's rental income tax declaration, as the landlord tells it (they
 * declare and pay on RRA's own portal): one row per business and year. The
 * estimate is worked out on every read and never stored. `nudges_sent` counts
 * the January reminders (1, 15 and 25 January) so none goes twice.
 */
export const taxDeclarations = pgTable(
  'tax_declarations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    year: integer('year').notNull(),
    status: taxDeclarationStatusEnum('status').notNull().default('not_started'),
    declaredOn: date('declared_on'),
    paidOn: date('paid_on'),
    amountPaidRwf: amount('amount_paid_rwf'),
    /** The reference RRA gave the declaration or the payment. */
    rraReference: text('rra_reference'),
    receiptObjectId: uuid('receipt_object_id').references(() => storedObjects.id),
    nudgesSent: integer('nudges_sent').notNull().default(0),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    unique('tax_declarations_org_year_uk').on(t.orgId, t.year),
    check('tax_declarations_year_range', sql`${t.year} BETWEEN 2020 AND 2100`),
    check(
      'tax_declarations_shape',
      sql`(${t.status} = 'not_started' AND ${t.declaredOn} IS NULL AND ${t.paidOn} IS NULL AND ${t.amountPaidRwf} IS NULL)
        OR (${t.status} = 'declared' AND ${t.declaredOn} IS NOT NULL AND ${t.paidOn} IS NULL AND ${t.amountPaidRwf} IS NULL)
        OR (${t.status} = 'paid' AND ${t.declaredOn} IS NOT NULL AND ${t.paidOn} IS NOT NULL AND ${t.amountPaidRwf} IS NOT NULL)`,
    ),
    check('tax_declarations_declared_after_year', sql`${t.declaredOn} IS NULL OR ${t.declaredOn} >= make_date(${t.year} + 1, 1, 1)`),
    check('tax_declarations_paid_after_declared', sql`${t.paidOn} IS NULL OR ${t.paidOn} >= ${t.declaredOn}`),
    check('tax_declarations_amount_positive', sql`${t.amountPaidRwf} IS NULL OR (${t.amountPaidRwf} > 0 AND ${t.amountPaidRwf} <= 2000000000)`),
    check('tax_declarations_nudges_range', sql`${t.nudgesSent} BETWEEN 0 AND 3`),
  ],
);

// ===========================================================================
// LEGACY: dropped by migration 0089 (blueprint 1.2, "To drop at the end")
// ===========================================================================

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
