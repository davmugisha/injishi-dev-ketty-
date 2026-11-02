/**
 * BROKERS: the leaf schema file of the broker side (rentals blueprint 1.2, 2026-10-25).
 *
 * Nothing in the schema imports it back, so it may reference brokers, leases,
 * units and geography without adding an import cycle. What it holds:
 *
 *   - the three plans a broker can be on (`broker_plans`: District free,
 *     Province and Country by the month), priced in the table and edited by
 *     finance in the admin console;
 *   - a broker's paid plan (`broker_subscriptions`) and every payment for it
 *     (`broker_subscription_payments`), one per month, keyed for idempotency;
 *   - the 5,000 RWF registration fee, paid by mobile money before the broker
 *     row exists (`broker_registration_payments`);
 *   - ratings of a broker by the landlord and the tenant of a lease they
 *     brought (`broker_ratings`), one per lease and side;
 *   - a broker's commission deals with hotels (`broker_hotel_deals`, 0124).
 *
 * Statuses are enums built from `@injishi/contracts`. Money is whole francs;
 * plan periods are Kigali calendar days.
 */
import {
  BrokerDealKind,
  BrokerDealStatus,
  BrokerFeeMethod,
  BrokerPayMethod,
  BrokerPaymentKind,
  BrokerPaymentStatus,
  BrokerPlanCode,
  BrokerPlanStatus,
} from '@injishi/contracts';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { timestamps } from './columns';
import { adapterModeEnum } from './enums';
import { provinces } from './geography';
import { orgs } from './org';
import { brokers, leases } from './residence';

export const brokerPlanCodeEnum = pgEnum('broker_plan_code', BrokerPlanCode.options);
export const brokerSubscriptionStatusEnum = pgEnum('broker_subscription_status', BrokerPlanStatus.options);
export const brokerPayMethodEnum = pgEnum('broker_pay_method', BrokerPayMethod.options);
export const brokerPaymentStatusEnum = pgEnum('broker_payment_status', BrokerPaymentStatus.options);
export const brokerPaymentKindEnum = pgEnum('broker_payment_kind', BrokerPaymentKind.options);
export const brokerRaterRoleEnum = pgEnum('broker_rater_role', ['tenant', 'landlord']);

/** The plans. District is free by a CHECK; the prices are data, the codes are code. */
export const brokerPlans = pgTable(
  'broker_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: brokerPlanCodeEnum('code').notNull(),
    name: text('name').notNull(),
    /** Per month, whole francs. */
    priceRwf: integer('price_rwf').notNull(),
    active: boolean('active').notNull().default(true),
    sort: integer('sort').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    unique('broker_plans_code_uk').on(t.code),
    check('broker_plans_price_ck', sql`${t.priceRwf} BETWEEN 0 AND 10000000`),
    check('broker_plans_district_free_ck', sql`${t.code} <> 'district' OR ${t.priceRwf} = 0`),
  ],
);

/**
 * A broker's paid plan. District needs no row: a broker with none in force is
 * on District. One plan in force (active or past due) and one upgrade waiting
 * for its money, at most, per broker.
 */
export const brokerSubscriptions = pgTable(
  'broker_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brokerId: uuid('broker_id')
      .notNull()
      .references(() => brokers.id),
    planId: uuid('plan_id')
      .notNull()
      .references(() => brokerPlans.id),
    /** The province the Province plan covers. */
    scopeProvinceId: integer('scope_province_id').references(() => provinces.id),
    /** The last time the Province plan's province moved: at most once per 30 days. */
    scopeChangedAt: timestamp('scope_changed_at', { withTimezone: true }),
    status: brokerSubscriptionStatusEnum('status').notNull().default('pending_payment'),
    currentPeriodStart: date('current_period_start').notNull(),
    /** The day the month ends: the next one starts on it. */
    currentPeriodEnd: date('current_period_end').notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    nextPlanId: uuid('next_plan_id').references(() => brokerPlans.id),
    nextScopeProvinceId: integer('next_scope_province_id').references(() => provinces.id),
    /** How the next month is charged: the number that paid last, or the card the gateway saved. */
    payMethod: brokerPayMethodEnum('pay_method'),
    payMsisdn: text('pay_msisdn'),
    cardToken: text('card_token'),
    ...timestamps,
  },
  (t) => [
    index('broker_subscriptions_broker_idx').on(t.brokerId, t.createdAt),
    uniqueIndex('broker_subscriptions_one_live_uk').on(t.brokerId).where(sql`${t.status} IN ('active', 'past_due')`),
    uniqueIndex('broker_subscriptions_one_pending_uk').on(t.brokerId).where(sql`${t.status} = 'pending_payment'`),
    check('broker_subscriptions_period_ck', sql`${t.currentPeriodEnd} > ${t.currentPeriodStart}`),
    check('broker_subscriptions_msisdn_ck', sql`${t.payMsisdn} IS NULL OR ${t.payMsisdn} ~ '^[0-9]{9}$'`),
    check('broker_subscriptions_cancel_ck', sql`NOT (${t.cancelAtPeriodEnd} AND ${t.nextPlanId} IS NOT NULL)`),
  ],
);

/** One month of a plan, paid or tried. The key makes a retried press, or a second sweep, the same payment. */
export const brokerSubscriptionPayments = pgTable(
  'broker_subscription_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => brokerSubscriptions.id),
    brokerId: uuid('broker_id')
      .notNull()
      .references(() => brokers.id),
    planId: uuid('plan_id')
      .notNull()
      .references(() => brokerPlans.id),
    kind: brokerPaymentKindEnum('kind').notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    amountRwf: integer('amount_rwf').notNull(),
    method: brokerPayMethodEnum('method').notNull(),
    msisdnMasked: text('msisdn_masked'),
    adapterMode: adapterModeEnum('adapter_mode').notNull(),
    gatewayRef: text('gateway_ref'),
    checkoutUrl: text('checkout_url'),
    status: brokerPaymentStatusEnum('status').notNull().default('pending'),
    failureReason: text('failure_reason'),
    idempotencyKey: text('idempotency_key').notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    receiptSentAt: timestamp('receipt_sent_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('broker_subscription_payments_key_uk').on(t.idempotencyKey),
    index('broker_subscription_payments_broker_idx').on(t.brokerId, t.createdAt),
    index('broker_subscription_payments_pending_idx').on(t.createdAt).where(sql`${t.status} = 'pending'`),
    check('broker_subscription_payments_amount_ck', sql`${t.amountRwf} > 0 AND ${t.amountRwf} <= 10000000`),
    check('broker_subscription_payments_period_ck', sql`${t.periodEnd} > ${t.periodStart}`),
    check('broker_subscription_payments_paid_ck', sql`(${t.status} = 'paid') = (${t.paidAt} IS NOT NULL)`),
    check('broker_subscription_payments_failed_ck', sql`${t.status} <> 'failed' OR ${t.failureReason} IS NOT NULL`),
  ],
);

/** The registration fee rails: mobile money only (the broker has no saved card yet). */
export const brokerFeeMethodEnum = pgEnum('broker_fee_method', BrokerFeeMethod.options);

/**
 * The broker registration fee, paid before the broker row exists. The
 * registration names a paid one, and it is then tied to the broker.
 */
export const brokerRegistrationPayments = pgTable(
  'broker_registration_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    brokerId: uuid('broker_id').references(() => brokers.id),
    amountRwf: integer('amount_rwf').notNull(),
    method: brokerFeeMethodEnum('method').notNull(),
    msisdnMasked: text('msisdn_masked'),
    adapterMode: adapterModeEnum('adapter_mode').notNull(),
    gatewayRef: text('gateway_ref'),
    status: brokerPaymentStatusEnum('status').notNull().default('pending'),
    failureReason: text('failure_reason'),
    idempotencyKey: text('idempotency_key').notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('broker_registration_payments_key_uk').on(t.idempotencyKey),
    index('broker_registration_payments_user_idx').on(t.userId, t.createdAt),
    uniqueIndex('broker_registration_payments_broker_uk').on(t.brokerId).where(sql`${t.brokerId} IS NOT NULL`),
    check('broker_registration_payments_amount_ck', sql`${t.amountRwf} > 0`),
    check('broker_registration_payments_paid_ck', sql`(${t.status} = 'paid') = (${t.paidAt} IS NOT NULL)`),
    check('broker_registration_payments_failed_ck', sql`${t.status} <> 'failed' OR ${t.failureReason} IS NOT NULL`),
    check('broker_registration_payments_broker_paid_ck', sql`${t.brokerId} IS NULL OR ${t.status} = 'paid'`),
  ],
);

/** A rating of a broker, by the landlord or the tenant of a lease the broker brought. One per lease and side. */
export const brokerRatings = pgTable(
  'broker_ratings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brokerId: uuid('broker_id')
      .notNull()
      .references(() => brokers.id),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id, { onDelete: 'cascade' }),
    raterUserId: uuid('rater_user_id')
      .notNull()
      .references(() => users.id),
    raterRole: brokerRaterRoleEnum('rater_role').notNull(),
    stars: integer('stars').notNull(),
    comment: text('comment'),
    ...timestamps,
  },
  (t) => [
    unique('broker_ratings_lease_role_uk').on(t.leaseId, t.raterRole),
    index('broker_ratings_broker_idx').on(t.brokerId, t.createdAt),
    check('broker_ratings_stars_ck', sql`${t.stars} BETWEEN 1 AND 5`),
  ],
);

export const brokerDealKindEnum = pgEnum('broker_deal_kind', BrokerDealKind.options);
export const brokerDealStatusEnum = pgEnum('broker_deal_status', BrokerDealStatus.options);

/**
 * A broker's commission deal with a hotel (0124, 2026-11-02): the broker brings
 * bookings, the hotel pays a commission on the stays they become, and Injishi
 * takes 15% of it. A percent of each booking (`percent_bp`, basis points, so
 * 7.5% is 750) or one sum for a booking of at least `min_rooms` rooms
 * (`amount_rwf`). The broker proposes; the hotel's owner accepts or declines;
 * either side ends a running deal. One proposed or running deal per pair.
 */
export const brokerHotelDeals = pgTable(
  'broker_hotel_deals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brokerId: uuid('broker_id')
      .notNull()
      .references(() => brokers.id),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    kind: brokerDealKindEnum('kind').notNull(),
    percentBp: integer('percent_bp'),
    amountRwf: integer('amount_rwf'),
    minRooms: integer('min_rooms'),
    startsOn: date('starts_on'),
    endsOn: date('ends_on'),
    note: text('note'),
    status: brokerDealStatusEnum('status').notNull().default('proposed'),
    proposedByUserId: uuid('proposed_by_user_id')
      .notNull()
      .references(() => users.id),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: text('decision_note'),
    closedByUserId: uuid('closed_by_user_id').references(() => users.id),
    closedBy: text('closed_by'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closeNote: text('close_note'),
    ...timestamps,
  },
  (t) => [
    index('broker_hotel_deals_broker_idx').on(t.brokerId, t.createdAt),
    index('broker_hotel_deals_org_idx').on(t.orgId, t.createdAt),
    uniqueIndex('broker_hotel_deals_one_live_uk')
      .on(t.brokerId, t.orgId)
      .where(sql`${t.status} IN ('proposed', 'active')`),
    check(
      'broker_hotel_deals_terms_ck',
      sql`(${t.kind} = 'percent' AND ${t.percentBp} BETWEEN 100 AND 3000 AND ${t.percentBp} % 50 = 0 AND ${t.amountRwf} IS NULL AND ${t.minRooms} IS NULL)
        OR (${t.kind} = 'bulk_fixed' AND ${t.percentBp} IS NULL AND ${t.amountRwf} BETWEEN 1000 AND 50000000 AND ${t.minRooms} BETWEEN 2 AND 500)`,
    ),
    check('broker_hotel_deals_dates_ck', sql`${t.startsOn} IS NULL OR ${t.endsOn} IS NULL OR ${t.endsOn} > ${t.startsOn}`),
    check('broker_hotel_deals_closed_by_ck', sql`${t.closedBy} IS NULL OR ${t.closedBy} IN ('broker', 'hotel')`),
  ],
);
