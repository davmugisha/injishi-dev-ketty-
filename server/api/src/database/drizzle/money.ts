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
import { adapterModeEnum, ebmConnectionStatusEnum, ebmReceiptTypeEnum, ebmSourceEnum, ebmStatusEnum, ebmTransactionTypeEnum, invoiceKindEnum, ledgerAccountTypeEnum, ledgerTxnKindEnum, moneyOverrideActionEnum, moneyOverrideStateEnum, payoutDestinationEnum, payoutPayeeTypeEnum, payoutSourceEnum, payoutStatusEnum, placementFeeStatusEnum, planBillingPeriodEnum, reconciliationStatusEnum, registrationBusinessTypeEnum, subscriptionInvoiceStatusEnum, subscriptionStatusEnum, taxCodeEnum, tinTypeEnum } from './enums';
import { bookings } from './hospitality';
import { folioCharges, folios, outlets, serviceOrderItems, serviceOrders } from './operations';
import { orgs, workspaces } from './org';
import { brokers, leases } from './residence';

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
    ...timestamps,
  },
  (t) => [
    unique('payouts_idempotency_key_uk').on(t.idempotencyKey),
    index('payouts_workspace_status_idx').on(t.workspaceId, t.status),
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
    ...timestamps,
  },
  (t) => [unique('placement_fees_lease_uk').on(t.leaseId)],
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
 * `modules/ebm/infrastructure/token-cipher.ts`, keyed by
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
     * `approved`, `disabled`), as last read. Text rather than an enum because
     * it is the provider's vocabulary and may grow; only `approved` may
     * invoice, and the code that decides that names the value it tests.
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
  ebmInvoiceId: uuid('ebm_invoice_id')
    .notNull()
    .references(() => ebmInvoices.id, { onDelete: 'cascade' }),
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
});


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
