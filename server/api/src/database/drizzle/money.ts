/**
 * §8 MONEY.
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
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { amount, currency, timestamps } from './columns';
import { adapterModeEnum, brokerFeeKindEnum, ebmConnectionStatusEnum, ebmReceiptTypeEnum, ebmSourceEnum, ebmStatusEnum, ebmTransactionTypeEnum, invoiceKindEnum, ledgerAccountTypeEnum, ledgerTxnKindEnum, momoNetworkEnum, moneyOverrideActionEnum, moneyOverrideStateEnum, paymentDirectionEnum, paymentTransactionStatusEnum, payoutAccountKindEnum, payoutAccountStatusEnum, payoutDestinationEnum, payoutPayeeTypeEnum, payoutSourceEnum, payoutStatusEnum, placementFeeStatusEnum, planBillingPeriodEnum, reconciliationStatusEnum, registrationBusinessTypeEnum, subscriptionInvoiceStatusEnum, subscriptionStatusEnum, taxCodeEnum, tinTypeEnum } from './enums';
import { bookings } from './hospitality';
import { folioCharges, folios, outlets, serviceOrderItems, serviceOrders } from './operations';
import { orgs, workspaces } from './org';
import { brokers, leases, paymentAttempts } from './residence';

export const ledgerAccounts = pgTable(
  'ledger_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    type: ledgerAccountTypeEnum('type').notNull(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id),
    ...timestamps,
  },
  (t) => [index('ledger_accounts_workspace_idx').on(t.workspaceId)],
);


export const ledgerTransactions = pgTable(
  'ledger_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: ledgerTxnKindEnum('kind').notNull(),
    idempotencyKey: text('idempotency_key'),
    adapterMode: adapterModeEnum('adapter_mode').notNull().default('mock'),
    memo: text('memo'),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('ledger_transactions_idempotency_key_uk').on(t.idempotencyKey),
  ],
);


export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => ledgerTransactions.id),
    accountId: uuid('account_id')
      .notNull()
      .references(() => ledgerAccounts.id),
    amountRwf: amount('amount_rwf').notNull(),
    currency: currency(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id),
    relatedType: text('related_type'),
    relatedId: uuid('related_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('ledger_entries_transaction_idx').on(t.transactionId),
    index('ledger_entries_account_idx').on(t.accountId),
    index('ledger_entries_related_idx').on(t.relatedType, t.relatedId),
    index('ledger_entries_workspace_idx').on(t.workspaceId),
  ],
);


/**
 * Where a landlord's rent is paid out (blueprint 1.2, migration 0081): a bank
 * account, a MoMo number, or a MoMo Pay merchant code. Ported from
 * feat/rentals' `org_payout_accounts`.
 *
 * A bank account number is never stored as text: `account_number_ciphertext`
 * is AES-256-GCM under `PAYOUT_ACCOUNT_ENCRYPTION_KEY` (the EBM token cipher,
 * bound to the org and the row), and `account_last4` is what every screen
 * shows. One active primary account per org (`payout_accounts_primary_uk`):
 * every gateway payment is paid out to it, and with none it is held. An
 * account is retired, never deleted, so a payout can always say where it went.
 */
export const payoutAccounts = pgTable(
  'payout_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    kind: payoutAccountKindEnum('kind').notNull(),
    /** The name the account is in, as the bank or network holds it. */
    accountName: text('account_name').notNull(),
    bankName: text('bank_name'),
    accountNumberCiphertext: text('account_number_ciphertext'),
    accountLast4: text('account_last4'),
    momoNetwork: momoNetworkEnum('momo_network'),
    /** E.164, `+2507…`. */
    momoPhone: text('momo_phone'),
    merchantCode: text('merchant_code'),
    isPrimary: boolean('is_primary').notNull().default(false),
    status: payoutAccountStatusEnum('status').notNull().default('active'),
    /** The name the rail reported for the account, once a provider checks it. */
    verifiedName: text('verified_name'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
    retiredByUserId: uuid('retired_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('payout_accounts_primary_uk')
      .on(t.orgId)
      .where(sql`${t.isPrimary} AND ${t.status} = 'active'`),
    index('payout_accounts_org_idx').on(t.orgId, t.status),
    check('payout_accounts_name_present', sql`length(btrim(${t.accountName})) > 0`),
    check(
      'payout_accounts_kind_shape',
      sql`(${t.kind} = 'bank' AND ${t.bankName} IS NOT NULL AND ${t.accountNumberCiphertext} IS NOT NULL
            AND ${t.accountLast4} ~ '^[0-9]{4}$'
            AND ${t.momoNetwork} IS NULL AND ${t.momoPhone} IS NULL AND ${t.merchantCode} IS NULL)
        OR (${t.kind} = 'momo' AND ${t.momoNetwork} IS NOT NULL AND ${t.momoPhone} ~ '^[+]250(72|73|78|79)[0-9]{7}$'
            AND ${t.bankName} IS NULL AND ${t.accountNumberCiphertext} IS NULL AND ${t.accountLast4} IS NULL
            AND ${t.merchantCode} IS NULL)
        OR (${t.kind} = 'momo_pay' AND ${t.merchantCode} ~ '^[0-9]{4,10}$'
            AND ${t.bankName} IS NULL AND ${t.accountNumberCiphertext} IS NULL AND ${t.accountLast4} IS NULL
            AND ${t.momoNetwork} IS NULL AND ${t.momoPhone} IS NULL)`,
    ),
    check('payout_accounts_primary_active', sql`NOT (${t.isPrimary} AND ${t.status} = 'retired')`),
    check('payout_accounts_retired_shape', sql`(${t.status} = 'retired') = (${t.retiredAt} IS NOT NULL)`),
  ],
);

export const payouts = pgTable(
  'payouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    payeeType: payoutPayeeTypeEnum('payee_type').notNull(),
    destination: payoutDestinationEnum('destination'),
    destinationRef: text('destination_ref'),
    amountRwf: amount('amount_rwf'),
    currency: currency(),
    source: payoutSourceEnum('source').notNull(),
    status: payoutStatusEnum('status').notNull().default('scheduled'),
    scheduledReleaseAt: timestamp('scheduled_release_at', {
      withTimezone: true,
    }),
    // When the adapter confirmed the transfer landed, and why one that did not
    // was held (migration 0029). Before these existed the only timestamp was
    // `scheduled_release_at` — when a payout MAY leave — and reading that as
    // settlement rendered a held payout as "settled on <date>" on a finance
    // screen. Null on a row that has not settled or not failed, which is true
    // of every row written before this migration.
    settledAt: timestamp('settled_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
    idempotencyKey: text('idempotency_key'),
    // Rentals (migration 0081): which payout account it went to, and what the
    // landlord and the payee are shown without decrypting anything.
    payoutAccountId: uuid('payout_account_id').references(() => payoutAccounts.id),
    payeeName: text('payee_name'),
    /** "Bank of Kigali ••••5678": where it went, masked. */
    destinationMasked: text('destination_masked'),
    /** The rail's own reference for the transfer. */
    adapterRef: text('adapter_ref'),
    note: text('note'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    unique('payouts_idempotency_key_uk').on(t.idempotencyKey),
    index('payouts_workspace_status_idx').on(t.workspaceId, t.status),
    index('payouts_account_idx').on(t.payoutAccountId),
  ],
);

/**
 * Every instruction Injishi sends a payment provider, and every treasury
 * movement two people approved (073-gtbank-payments, the bank record).
 *
 * Hangaa holds every collection in one GTBank account (call 3), so this table
 * is what reconciliation, the available balance, reversals and the admin money
 * queue all read. A row is written BEFORE its call (`sending`, or `queued` when
 * it cannot go yet), so a crash between the call and the update leaves a row to
 * pull by `reference`, never a charge with no record (AC-9).
 *
 * `reference` is derived from `idempotency_key` (AC-6), so the same key always
 * sends the same reference. `payer_msisdn` and the `payee_*` columns sit in
 * plain columns on the encrypted volume (ADR-073 D-s), are read only by the
 * payments module, and never reach a log or a response unmasked. The available
 * balance is a sum over these rows, never a stored column (AC-14).
 */
export const paymentTransactions = pgTable(
  'payment_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Null only for an adjustment, which belongs to Hangaa's account, not a business. */
    workspaceId: uuid('workspace_id').references(() => workspaces.id),
    /** The registry provider key: `gtbank`, or `mock` for the mock adapter. */
    provider: text('provider').notNull(),
    /** Written from the bound adapter, never defaulted (ADR-020 AC-9). */
    adapterMode: adapterModeEnum('adapter_mode').notNull(),
    direction: paymentDirectionEnum('direction').notNull(),
    operation: text('operation').notNull(),

    paymentAttemptId: uuid('payment_attempt_id').references(
      (): AnyPgColumn => paymentAttempts.id,
    ),
    /** The collection a refund or guest release goes back to. */
    originalTransactionId: uuid('original_transaction_id').references(
      (): AnyPgColumn => paymentTransactions.id,
    ),
    payoutId: uuid('payout_id').references(() => payouts.id),
    bookingId: uuid('booking_id').references(() => bookings.id),
    /** The approved override a resend or an adjustment was written under. */
    moneyOverrideId: uuid('money_override_id').references(
      (): AnyPgColumn => moneyOverrides.id,
    ),

    idempotencyKey: text('idempotency_key').notNull(),
    reference: text('reference').notNull(),
    /** The provider's own transaction reference; an adjustment's bank reference. */
    providerReference: text('provider_reference'),

    amountRwf: amount('amount_rwf').notNull(),
    currency: currency(),
    /** The estimate at insert, then the provider's figure (`fee_reported`). */
    feeRwf: amount('fee_rwf').notNull().default(0),
    feeReported: boolean('fee_reported').notNull().default(false),

    status: paymentTransactionStatusEnum('status').notNull(),
    queueReason: text('queue_reason'),
    /** The provider's raw status word or code, for support. */
    providerStatus: text('provider_status'),
    failureReason: text('failure_reason'),

    // --- the payer, collections only (AC-10) ---
    payerMsisdn: text('payer_msisdn'),
    payerNetwork: text('payer_network'),
    payerPurgeAfter: timestamp('payer_purge_after', { withTimezone: true }),

    // --- the payee, disbursements only (AC-12) ---
    payeeFullName: text('payee_full_name'),
    payeeIdType: text('payee_id_type'),
    payeeIdNumber: text('payee_id_number'),
    payeeDestination: text('payee_destination'),
    payeeNetworkOrBank: text('payee_network_or_bank'),
    payeeAccount: text('payee_account'),
    payeePhone: text('payee_phone'),

    reversalFlaggedAt: timestamp('reversal_flagged_at', { withTimezone: true }),
    reversalKind: text('reversal_kind'),

    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    finalAt: timestamp('final_at', { withTimezone: true }),
    lastPulledAt: timestamp('last_pulled_at', { withTimezone: true }),

    resolvedByUserId: uuid('resolved_by_user_id').references(() => users.id),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionOutcome: text('resolution_outcome'),
    resolutionNote: text('resolution_note'),
    writtenOffAt: timestamp('written_off_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('payment_transactions_idempotency_key_uk').on(t.idempotencyKey),
    unique('payment_transactions_reference_uk').on(t.reference),
    uniqueIndex('payment_transactions_provider_reference_uk')
      .on(t.provider, t.providerReference)
      .where(sql`${t.providerReference} IS NOT NULL`),
    // One collection per attempt: the attempt's capture key is this row's key.
    uniqueIndex('payment_transactions_attempt_uk')
      .on(t.paymentAttemptId)
      .where(sql`${t.paymentAttemptId} IS NOT NULL`),
    // The dispatcher and the sweep read only what is still moving.
    index('payment_transactions_due_idx')
      .on(t.status, t.nextAttemptAt)
      .where(sql`${t.status} IN ('queued', 'sending', 'pending', 'unknown')`),
    index('payment_transactions_original_idx').on(t.originalTransactionId),
    index('payment_transactions_booking_idx').on(t.bookingId),
    index('payment_transactions_workspace_idx').on(t.workspaceId),
    index('payment_transactions_balance_idx').on(
      t.provider,
      t.adapterMode,
      t.status,
    ),
    // Every IN on a nullable column below is guarded by IS NOT NULL: a CHECK
    // that evaluates to NULL passes, so a bare `x IN (...)` lets a null x in.
    check(
      'payment_transactions_operation_shape',
      sql`(${t.direction} = 'collection'
            AND ${t.operation} IN ('escrow_capture', 'one_time_fee', 'recurring_charge'))
        OR (${t.direction} = 'disbursement'
            AND ${t.operation} IN ('refund', 'escrow_release_guest', 'escrow_release_host', 'payout'))
        OR (${t.direction} = 'adjustment' AND ${t.operation} = 'adjustment')`,
    ),
    check(
      'payment_transactions_amount_shape',
      sql`(${t.direction} = 'adjustment' AND ${t.amountRwf} <> 0)
        OR (${t.direction} <> 'adjustment' AND ${t.amountRwf} > 0)`,
    ),
    check('payment_transactions_fee_non_negative', sql`${t.feeRwf} >= 0`),
    check(
      'payment_transactions_workspace_shape',
      sql`${t.workspaceId} IS NOT NULL OR ${t.direction} = 'adjustment'`,
    ),
    // An adjustment is written only once approved, so it never moves again.
    check(
      'payment_transactions_adjustment_shape',
      sql`${t.direction} <> 'adjustment'
        OR (${t.status} = 'successful' AND ${t.moneyOverrideId} IS NOT NULL)`,
    ),
    check(
      'payment_transactions_queue_shape',
      sql`(${t.status} = 'queued' AND ${t.queueReason} IS NOT NULL
            AND ${t.queueReason} IN ('awaiting_dispatch', 'insufficient_funds', 'payee_details_missing',
             'provider_unavailable', 'over_limit'))
        OR (${t.status} <> 'queued' AND ${t.queueReason} IS NULL)`,
    ),
    check(
      'payment_transactions_payer_shape',
      sql`${t.direction} = 'collection'
        OR (${t.payerMsisdn} IS NULL AND ${t.payerNetwork} IS NULL
            AND ${t.payerPurgeAfter} IS NULL)`,
    ),
    // A disbursement always knows where it goes; its payee's name and ID may be
    // missing only while it waits for them, or on one refused before it was
    // ever sent (a collection another provider or mode took, AC-11).
    check(
      'payment_transactions_payee_shape',
      sql`(${t.direction} <> 'disbursement'
            AND ${t.payeeFullName} IS NULL AND ${t.payeeIdType} IS NULL
            AND ${t.payeeIdNumber} IS NULL AND ${t.payeeDestination} IS NULL
            AND ${t.payeeNetworkOrBank} IS NULL AND ${t.payeeAccount} IS NULL
            AND ${t.payeePhone} IS NULL)
        OR (${t.direction} = 'disbursement'
            AND ${t.payeeAccount} IS NOT NULL
            AND ${t.payeeDestination} IS NOT NULL
            AND ${t.payeeDestination} IN ('momo', 'bank')
            AND ((${t.status} = 'queued' AND ${t.queueReason} IS NOT NULL
                  AND ${t.queueReason} = 'payee_details_missing')
              OR (${t.status} = 'failed' AND ${t.sentAt} IS NULL)
              OR (${t.payeeFullName} IS NOT NULL
                  AND ${t.payeeIdType} IS NOT NULL
                  AND ${t.payeeIdType} IN ('national_id', 'passport')
                  AND ${t.payeeIdNumber} IS NOT NULL
                  AND ${t.payeePhone} IS NOT NULL)))`,
    ),
    check(
      'payment_transactions_reversal_shape',
      sql`(${t.reversalFlaggedAt} IS NULL AND ${t.reversalKind} IS NULL)
        OR (${t.reversalFlaggedAt} IS NOT NULL AND ${t.reversalKind} IS NOT NULL
            AND ${t.reversalKind} IN ('reversal', 'double_refund'))`,
    ),
    check(
      'payment_transactions_resolution_shape',
      sql`(${t.resolvedAt} IS NULL AND ${t.resolutionOutcome} IS NULL
            AND ${t.resolvedByUserId} IS NULL)
        OR (${t.resolvedAt} IS NOT NULL AND ${t.resolvedByUserId} IS NOT NULL
            AND ${t.resolutionOutcome} IS NOT NULL
            AND ${t.resolutionOutcome} IN ('failed', 'successful', 'stands', 'cancel_service')
            AND ${t.resolutionNote} IS NOT NULL)`,
    ),
  ],
);


export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  tier: integer('tier'),
  priceRwf: amount('price_rwf'),
  currency: currency(),
  billingPeriod: planBillingPeriodEnum('billing_period')
    .notNull()
    .default('monthly'),
  roomCountLimit: integer('room_count_limit'),
  featureSet: jsonb('feature_set'),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  ...timestamps,
});


/**
 * The one-time registration fee catalog (D21 §8.3a, retimed by D23).
 *
 * Mirrors `subscription_plans` in shape and governance for the same reason:
 * prices change, history must not. Admin-editable (F-A10) and versioned, never
 * destructive — changing a fee INSERTS a new effective-dated row, and the
 * charged amount is locked onto the invoice at charge time (D8), so a later
 * price change never rewrites what someone already paid.
 */
export const registrationFees = pgTable(
  'registration_fees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessType: registrationBusinessTypeEnum('business_type').notNull(),
    amountRwf: amount('amount_rwf'),
    currency: currency(),
    effectiveFrom: timestamp('effective_from', {
      withTimezone: true,
    }).notNull(),
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    // Reading the fee is "newest effective row for this type, as of now".
    index('registration_fees_lookup_idx').on(t.businessType, t.effectiveFrom),
  ],
);


export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    planId: uuid('plan_id').references(() => subscriptionPlans.id),
    workspaceId: uuid('workspace_id').references(() => workspaces.id),
    status: subscriptionStatusEnum('status').notNull().default('trialing'),
    currentPeriodStart: date('current_period_start'),
    currentPeriodEnd: date('current_period_end'),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [unique('subscriptions_org_uk').on(t.orgId)],
);


/**
 * Despite the name, the org's WHOLE invoice ledger (D21) — both the one-time
 * registration fee and every monthly subscription charge. Reusing this table
 * rather than adding a `registration_fee_payments` sibling is deliberate: a
 * registration fee needs exactly what a subscription charge needs — an amount,
 * pending/paid/failed with retry, and an EBM invoice under the Injishi TIN.
 */
export const subscriptionInvoices = pgTable(
  'subscription_invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Nullable since D23: the registration fee is charged at SUBMISSION, before
    // the org is active and therefore before any subscription exists to hang it
    // on. A NOT NULL here made a registration-fee row structurally impossible.
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    invoiceKind: invoiceKindEnum('invoice_kind')
      .notNull()
      .default('subscription'),
    amountRwf: amount('amount_rwf'),
    currency: currency(),
    // Null on a registration-fee row: it covers no period.
    periodStart: date('period_start'),
    periodEnd: date('period_end'),
    status: subscriptionInvoiceStatusEnum('status').notNull().default('pending'),
    ebmInvoiceId: uuid('ebm_invoice_id').references(
      (): AnyPgColumn => ebmInvoices.id,
    ),
    idempotencyKey: text('idempotency_key'),
    ...timestamps,
  },
  (t) => [
    unique('subscription_invoices_idempotency_key_uk').on(t.idempotencyKey),
    // THE rule that makes "one fee per org, ever" true by construction rather
    // than by application care: it is why a rejected registration can resubmit
    // free, and why a reinstated org is never charged twice (D23).
    uniqueIndex('subscription_invoices_registration_fee_uk')
      .on(t.orgId)
      .where(sql`${t.invoiceKind} = 'registration_fee'`),
    // A subscription charge must name its subscription; a registration fee
    // must not, and covers no period.
    check(
      'subscription_invoices_kind_shape',
      sql`(${t.invoiceKind} = 'subscription' AND ${t.subscriptionId} IS NOT NULL)
          OR (${t.invoiceKind} = 'registration_fee' AND ${t.subscriptionId} IS NULL
              AND ${t.periodStart} IS NULL AND ${t.periodEnd} IS NULL)`,
    ),
  ],
);


export const placementFees = pgTable(
  'placement_fees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id),
    brokerId: uuid('broker_id')
      .notNull()
      .references(() => brokers.id),
    workspaceId: uuid('workspace_id').references(() => workspaces.id),
    amountRwf: amount('amount_rwf'),
    currency: currency(),
    status: placementFeeStatusEnum('status').notNull().default('pending'),
    payoutId: uuid('payout_id').references(() => payouts.id),
    /**
     * What was agreed (2026-10-25): a percent of the first month or fixed francs. A RECORD only:
     * the money moves outside Injishi, and `disbursed` is the landlord marking it paid.
     */
    feeKind: brokerFeeKindEnum('fee_kind'),
    percent: integer('percent'),
    disbursedAt: timestamp('disbursed_at', { withTimezone: true }),
    disbursedByUserId: uuid('disbursed_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    unique('placement_fees_lease_uk').on(t.leaseId),
    check('placement_fees_disbursed_shape', sql`(${t.status} = 'disbursed') = (${t.disbursedAt} IS NOT NULL)`),
    check(
      'placement_fees_terms_shape',
      sql`${t.feeKind} IS NULL OR (${t.feeKind} = 'percent' AND ${t.percent} BETWEEN 1 AND 200) OR (${t.feeKind} = 'fixed' AND ${t.percent} IS NULL)`,
    ),
  ],
);


export const ebmInvoices = pgTable(
  'ebm_invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: ebmSourceEnum('source').notNull(),
    bookingId: uuid('booking_id').references(() => bookings.id),
    subscriptionInvoiceId: uuid('subscription_invoice_id').references(
      () => subscriptionInvoices.id,
    ),
    /**
     * The stay's bill this document declares. Set only when `source = folio`
     * (ADR-050 D-a). One `NS` per folio, covering the host's own undeclared
     * lines.
     */
    folioId: uuid('folio_id').references((): AnyPgColumn => folios.id),
    /**
     * The order this document declares. Set only when `source = outlet_order`:
     * a pay now sale, or a tenant outlet's own `NS` raised at fulfilment.
     */
    serviceOrderId: uuid('service_order_id').references(
      (): AnyPgColumn => serviceOrders.id,
    ),
    /** The branch the sale belongs to, for `rra_branch_id` and the reports. */
    outletId: uuid('outlet_id').references((): AnyPgColumn => outlets.id),
    tin: text('tin'),
    tinType: tinTypeEnum('tin_type').notNull(),
    /**
     * §15's receipt type. `proforma` is the specification's own advance
     * receipt, which is what a confirmed booking now raises instead of
     * declaring the room as a sale weeks before the guest arrives.
     */
    receiptType: ebmReceiptTypeEnum('receipt_type').notNull().default('normal'),
    transactionType: ebmTransactionTypeEnum('transaction_type')
      .notNull()
      .default('sale'),
    /**
     * `NS`, `NR`, `TS`, `TR` or `PS`, GENERATED from the two columns above so
     * the three can never disagree. `CS` and `CR` are render time labels for a
     * copy and are never stored here, because a copy has no VSDC answer of its
     * own (D-e).
     */
    receiptLabel: text('receipt_label')
      .notNull()
      .generatedAlwaysAs(
        sql`CASE
              WHEN "transaction_type" = 'refund' AND "receipt_type" = 'normal' THEN 'NR'
              WHEN "transaction_type" = 'refund' AND "receipt_type" = 'training' THEN 'TR'
              WHEN "receipt_type" = 'normal' THEN 'NS'
              WHEN "receipt_type" = 'training' THEN 'TS'
              ELSE 'PS'
            END`,
      ),
    /**
     * The original this refund withdraws (§7.17). Required when
     * `transaction_type = refund`, and an original may be cancelled only once,
     * which `ebm_refund_log`'s unique enforces in slice 2.
     */
    refundOfInvoiceId: uuid('refund_of_invoice_id').references(
      (): AnyPgColumn => ebmInvoices.id,
    ),
    /** `bhfId`. A taxpayer's branches each count their own receipts. */
    rraBranchId: text('rra_branch_id').notNull().default('00'),
    /**
     * The `RNum` Injishi minted (AC-9, §7.25). Ascending per receipt label per
     * taxpayer per branch, NEVER reused, and deliberately not gapless: a
     * transaction that rolls back after minting burns a number, which the Z
     * report counts as an incomplete sale (§19.1.20). Avoiding that would mean
     * holding one counter row for the length of a VSDC call, which serializes
     * every close for a busy taxpayer behind a single row.
     *
     * Nullable because rows written before ADR-050 have none.
     */
    cisReceiptNo: integer('cis_receipt_no'),
    status: ebmStatusEnum('status').notNull().default('held'),
    adapterMode: adapterModeEnum('adapter_mode').notNull().default('mock'),
    payload: jsonb('payload'),
    attempts: integer('attempts').notNull().default(0),
    idempotencyKey: text('idempotency_key'),
    /**
     * The taxpayer whose EBM account certifies this sale (ADR-041). Null on a
     * subscription row, which is invoiced under the Injishi TIN and so has no
     * business connection behind it.
     */
    orgId: uuid('org_id').references(() => orgs.id),
    /**
     * The EBM provider's own id for the certified invoice. Set only once the
     * Authority has answered, and never reused: it is the one handle on the
     * fiscal record that exists outside this database.
     */
    externalInvoiceId: integer('external_invoice_id'),
    /** Plain wording for why the last attempt did not emit. Null once emitted. */
    lastError: text('last_error'),
    /**
     * When the worker may try again. NULL means "do not retry automatically",
     * which is the answer for an outcome nobody can know — a request that timed
     * out after it was sent may already be a certified sale, and sending it a
     * second time would declare the stay twice. Such a row waits for a person.
     */
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    emittedAt: timestamp('emitted_at', { withTimezone: true }),
    /**
     * THE DEVICE'S OWN ANSWER, promoted out of `payload` into columns (D-f).
     *
     * §18 and §19 aggregate the X and Z reports by receipt type, tax rate and
     * means of payment, and a jsonb payload cannot be indexed for that at
     * volume. `payload` stays as the raw provider answer, for audit.
     *
     * The QR is NOT stored: it is derived at render from these values in the
     * §7.24.7 order, and a render refuses rather than printing a QR with a
     * blank segment (ADR-041 D-j).
     */
    sdcId: text('sdc_id'),
    /** The `A` of §7.25: the device's per type counter. */
    sdcReceiptNo: integer('sdc_receipt_no'),
    /** The `B` of §7.25: the device's total counter. */
    totalReceiptNo: integer('total_receipt_no'),
    internalData: text('internal_data'),
    receiptSignature: text('receipt_signature'),
    /** The VSDC's own clock, not ours. */
    vsdcReceiptDate: timestamp('vsdc_receipt_date', { withTimezone: true }),
    mrc: text('mrc'),
    /**
     * §6.5 and §7.14: the complete receipt in text form, written the instant it
     * is produced. This is the journal a certified system is obliged to keep.
     */
    journalText: text('journal_text'),
    /**
     * When the ONE original was rendered (§7.18, D-e). Set at most once. Every
     * render after this is a copy: `CS` or `CR`, watermarked, and logged in
     * `ebm_receipt_copies` so the X and Z can count them.
     */
    originalRenderedAt: timestamp('original_rendered_at', {
      withTimezone: true,
    }),
    /** §4 d and e: the client named on the receipt, taken from the folio. */
    customerTin: text('customer_tin'),
    customerPhone: text('customer_phone'),
    customerName: text('customer_name'),
    ...timestamps,
  },
  (t) => [
    unique('ebm_invoices_idempotency_key_uk').on(t.idempotencyKey),
    // The drain sweep's query: everything not yet emitted that is due.
    index('ebm_invoices_due_idx').on(t.status, t.nextAttemptAt),
    // A certified invoice is one fiscal record; two rows claiming it would be
    // two declarations of one sale.
    uniqueIndex('ebm_invoices_external_invoice_uk')
      .on(t.orgId, t.externalInvoiceId)
      .where(sql`${t.externalInvoiceId} IS NOT NULL`),
    // Emitted means certified: the row must name the certified invoice.
    check(
      'ebm_invoices_emitted_shape',
      sql`${t.status} <> 'emitted' OR (${t.emittedAt} IS NOT NULL AND ${t.externalInvoiceId} IS NOT NULL)`,
    ),
    /** The reports read by branch and label; the counter is minted per both. */
    index('ebm_invoices_report_idx').on(
      t.orgId,
      t.rraBranchId,
      t.receiptLabel,
      t.emittedAt,
    ),
    index('ebm_invoices_folio_idx').on(t.folioId),
    /**
     * invariant 4, widened by ADR-050: a fiscal document comes from exactly one
     * subject, and each source names ITS OWN reference column and no other. A
     * row that named two subjects would be two declarations wearing one id.
     */
    check(
      'ebm_invoices_source_shape',
      sql`(${t.source} = 'booking' AND ${t.bookingId} IS NOT NULL AND ${t.subscriptionInvoiceId} IS NULL AND ${t.folioId} IS NULL AND ${t.serviceOrderId} IS NULL)
          OR (${t.source} = 'subscription' AND ${t.subscriptionInvoiceId} IS NOT NULL AND ${t.bookingId} IS NULL AND ${t.folioId} IS NULL AND ${t.serviceOrderId} IS NULL)
          OR (${t.source} = 'folio' AND ${t.folioId} IS NOT NULL AND ${t.bookingId} IS NULL AND ${t.subscriptionInvoiceId} IS NULL AND ${t.serviceOrderId} IS NULL)
          OR (${t.source} = 'outlet_order' AND ${t.serviceOrderId} IS NOT NULL AND ${t.bookingId} IS NULL AND ${t.subscriptionInvoiceId} IS NULL AND ${t.folioId} IS NULL)`,
    ),
    /**
     * §14: a refund names the original it withdraws, and only a refund does.
     * A sale carrying a `refund_of_invoice_id` would be a withdrawal filed as
     * turnover.
     */
    check(
      'ebm_invoices_refund_shape',
      sql`(${t.transactionType} = 'refund' AND ${t.refundOfInvoiceId} IS NOT NULL)
          OR (${t.transactionType} = 'sale' AND ${t.refundOfInvoiceId} IS NULL)`,
    ),
    /**
     * There is no such document as a proforma refund: a proforma declares
     * nothing, so there is nothing to withdraw. Forbidding the pair is also
     * what makes `receipt_label`'s CASE exhaustive.
     */
    check(
      'ebm_invoices_no_proforma_refund',
      sql`NOT (${t.receiptType} = 'proforma' AND ${t.transactionType} = 'refund')`,
    ),
    /**
     * A counter series is per taxpayer, per branch, per label (§7.25). Two
     * documents sharing a number in one series is the one thing AC-9 forbids.
     */
    uniqueIndex('ebm_invoices_cis_receipt_no_uk')
      .on(t.orgId, t.rraBranchId, t.receiptLabel, t.cisReceiptNo)
      .where(sql`${t.cisReceiptNo} IS NOT NULL`),
  ],
);


/**
 * One ascending receipt series per taxpayer, per branch, per receipt label
 * (ADR-050 D-f, §7.25).
 *
 * Keyed by branch as well as taxpayer because §7.25's `A`/`B` counters are the
 * VSDC DEVICE's own, and a taxpayer's branches each have a device. A series
 * keyed by taxpayer alone would count differently from what the device counts.
 *
 * The number is minted as the LAST STATEMENT BEFORE COMMIT, never held across a
 * VSDC call: holding this row for the length of a folio close would serialize
 * every close for a busy taxpayer behind one row.
 */
export const ebmReceiptCounters = pgTable(
  'ebm_receipt_counters',
  {
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    rraBranchId: text('rra_branch_id').notNull().default('00'),
    receiptLabel: text('receipt_label').notNull(),
    lastNumber: integer('last_number').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({
      name: 'ebm_receipt_counters_pk',
      columns: [t.orgId, t.rraBranchId, t.receiptLabel],
    }),
  ],
);


/**
 * A business's authorisation to certify its sales through its own EBM account
 * (ADR-041). One per org: a taxpayer has one TIN, and one TIN has one EBM
 * account at the provider.
 *
 * The TOKENS ARE CIPHERTEXT. `*_ciphertext` columns hold AES-256-GCM output from
 * `modules/platform/fiscal/infrastructure/token-cipher.ts`, keyed by
 * `EBM_TOKEN_ENCRYPTION_KEY`, which is not in this database. A bearer token for
 * a taxpayer's fiscal account is the power to issue invoices in their name, and a
 * database dump, a read replica or a backup must not hand that out. (Better
 * Auth's own `accounts` table stores Google tokens in plaintext; that is not the
 * precedent to follow for a credential that can declare tax.)
 */
export const ebmConnections = pgTable(
  'ebm_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    status: ebmConnectionStatusEnum('status').notNull().default('connected'),
    /** The TIN the EBM account reported. Checked equal to `orgs.tin` at connect. */
    tin: text('tin').notNull(),
    accountName: text('account_name'),
    /**
     * The EBM account's own approval state at the provider (`submitted`,
     * `approved`, `disabled`), as last read. Only `approved` may invoice, and
     * the code that decides that names the value it tests.
     *
     * Text with a CHECK rather than an enum, because it is the provider's
     * vocabulary and may grow: widening a CHECK is one statement, widening a
     * Postgres enum is not reversible. The repository stores a value outside
     * the three as null ("not known"), which is what every reader already made
     * of it (`toAccountStatus`), so a new provider word can never fail a
     * connect on this constraint (platform audit step 3).
     */
    accountStatus: text('account_status'),
    branchId: text('branch_id'),
    vatRegistered: boolean('vat_registered'),
    scopes: text('scopes').array().notNull().default(sql`'{}'::text[]`),
    accessTokenCiphertext: text('access_token_ciphertext').notNull(),
    refreshTokenCiphertext: text('refresh_token_ciphertext'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }).notNull(),
    /** Catalog item ids at the provider. See `EbmItemMapping` in contracts. */
    accommodationItemId: integer('accommodation_item_id'),
    serviceFeeItemId: integer('service_fee_item_id'),
    walkInCustomerId: integer('walk_in_customer_id'),
    connectedByUserId: uuid('connected_by_user_id').references(() => users.id),
    connectedAt: timestamp('connected_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    /** Why the connection stopped working, in plain words. */
    lastError: text('last_error'),
    ...timestamps,
  },
  (t) => [
    unique('ebm_connections_org_uk').on(t.orgId),
    check(
      'ebm_connections_revoked_shape',
      sql`(${t.status} = 'revoked') = (${t.revokedAt} IS NOT NULL)`,
    ),
    check(
      'ebm_connections_account_status_known',
      sql`${t.accountStatus} IS NULL OR ${t.accountStatus} IN ('submitted', 'approved', 'disabled')`,
    ),
  ],
);

/**
 * One in-flight OAuth consent (ADR-041): the PKCE verifier and who started it.
 *
 * The `state` parameter travels through the taxpayer's browser and the
 * provider's logs, so only its SHA-256 is stored — a leaked row cannot be
 * replayed as a state. The code verifier is the PKCE secret that proves the
 * party redeeming the code is the party that asked for it, so it is ciphertext
 * like the tokens. Single use (`consumed_at`) and short lived (`expires_at`).
 */
export const ebmOauthStates = pgTable(
  'ebm_oauth_states',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    stateHash: text('state_hash').notNull(),
    codeVerifierCiphertext: text('code_verifier_ciphertext').notNull(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique('ebm_oauth_states_state_hash_uk').on(t.stateHash)],
);


export const ebmInvoiceLines = pgTable('ebm_invoice_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  /**
   * RESTRICT since migration 0043 (platform audit step 3). A signed invoice's
   * lines are what the Authority was told; deleting the header used to take
   * them with it silently.
   */
  ebmInvoiceId: uuid('ebm_invoice_id')
    .notNull()
    .references(() => ebmInvoices.id, { onDelete: 'restrict' }),
  /**
   * WHICH LINE OF THE BILL THIS IS (ADR-050 D-d, G19).
   *
   * The table carried description, quantity, price and tax and nothing linking
   * it back, which is not enough to name a line in a partial refund: §7.17
   * limits how many times an original may be cancelled, not how much of it, so
   * `lines[]` has to be able to select one.
   */
  folioChargeId: uuid('folio_charge_id').references(
    (): AnyPgColumn => folioCharges.id,
  ),
  serviceOrderItemId: uuid('service_order_item_id').references(
    (): AnyPgColumn => serviceOrderItems.id,
  ),
  description: text('description'),
  quantity: integer('quantity').notNull().default(1),
  /** TAX INCLUSIVE, because the VSDC's `prc` is. The folio is not (D-f). */
  unitPriceRwf: amount('unit_price_rwf'),
  taxCode: taxCodeEnum('tax_code').notNull(),
  taxRate: numeric('tax_rate'),
  lineTotalRwf: amount('line_total_rwf'),
  currency: currency(),
  /**
   * The Authority's own four codes for the thing sold, copied from the
   * `service_item` at sign time. A receipt line that cannot describe what was
   * sold is refused by the Authority.
   */
  rraItemClsCd: text('rra_item_cls_cd'),
  rraItemCd: text('rra_item_cd'),
  rraPkgUnitCd: text('rra_pkg_unit_cd'),
  rraQtyUnitCd: text('rra_qty_unit_cd'),
  /** The `taxTyCd` actually sent, kept beside the code it was derived from. */
  taxTypeCode: text('tax_type_code'),
}, (t) => [index('ebm_invoice_lines_invoice_idx').on(t.ebmInvoiceId)]);


export const reconciliationRuns = pgTable('reconciliation_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: reconciliationStatusEnum('status').notNull(),
  report: jsonb('report'),
  adapterMode: adapterModeEnum('adapter_mode').notNull().default('mock'),
  ranAt: timestamp('ran_at', { withTimezone: true }).notNull().defaultNow(),
});


export const moneyOverrides = pgTable(
  'money_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subjectType: text('subject_type'),
    subjectId: uuid('subject_id'),
    action: moneyOverrideActionEnum('action').notNull(),
    reason: text('reason').notNull(),
    initiatedByUserId: uuid('initiated_by_user_id')
      .notNull()
      .references(() => users.id),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id),
    state: moneyOverrideStateEnum('state').notNull().default('initiated'),
    reversible: boolean('reversible').notNull().default(false),
    idempotencyKey: text('idempotency_key'),
    /**
     * What the request asks for beyond its subject, read at approval: a
     * treasury adjustment's signed amount and bank reference
     * (073-gtbank-payments AC-15). Never a payee's number, name or ID.
     */
    details: jsonb('details'),
    ledgerTransactionId: uuid('ledger_transaction_id').references(
      () => ledgerTransactions.id,
    ),
    ...timestamps,
  },
  (t) => [
    unique('money_overrides_idempotency_key_uk').on(t.idempotencyKey),
    // true dual authorization: the approver must differ from the initiator.
    check(
      'money_overrides_dual_auth',
      sql`${t.approvedByUserId} IS NULL OR ${t.approvedByUserId} <> ${t.initiatedByUserId}`,
    ),
  ],
);

// ===========================================================================
// §9  EVENTS & NOTIFICATIONS
// ===========================================================================
