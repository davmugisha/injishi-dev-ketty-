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
 *   - a broker's commission deals with hotels (`broker_hotel_deals`, 0124);
 *   - a broker's groups of rooms booked under a deal (`broker_booking_groups`, 0125);
 *   - the commission those stays earn, what was taken off the hotel's payouts for it, and the MoMo
 *     number the broker's share goes to (`broker_commissions`, `broker_commission_deductions`,
 *     `broker_payout_accounts`, 0127).
 *
 * Statuses are enums built from `@injishi/contracts`. Money is whole francs;
 * plan periods are Kigali calendar days.
 */
import {
  BrokerBookingPayment,
  BrokerCommissionStatus,
  BrokerDealKind,
  BrokerDealStatus,
  BrokerFeeMethod,
  BrokerGroupStatus,
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
import { timestamps } from './columns';
import { adapterModeEnum, momoNetworkEnum } from './enums';
import { bookings } from './hospitality';
import { payouts } from './money';
import { provinces } from './geography';
import { orgs, workspaces } from './org';
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

export const brokerBookingPaymentEnum = pgEnum('broker_booking_payment', BrokerBookingPayment.options);
export const brokerGroupStatusEnum = pgEnum('broker_group_status', BrokerGroupStatus.options);

/**
 * A broker's booking at a hotel (0125): one or many rooms under a running deal, each room its own booking
 * (`bookings.broker_group_id`), written together. `rooms` keeps what was asked and its price, so a group
 * still waiting for its MoMo payment, or one that failed, says what it was for. Paid at the hotel, the
 * bookings are written at once; paid by MoMo, only when the payment lands.
 */
export const brokerBookingGroups = pgTable(
  'broker_booking_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reference: text('reference').notNull(),
    brokerId: uuid('broker_id')
      .notNull()
      .references(() => brokers.id),
    dealId: uuid('deal_id')
      .notNull()
      .references(() => brokerHotelDeals.id),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    checkIn: date('check_in').notNull(),
    checkOut: date('check_out').notNull(),
    payment: brokerBookingPaymentEnum('payment').notNull(),
    status: brokerGroupStatusEnum('status').notNull(),
    totalRwf: integer('total_rwf').notNull(),
    contactPhone: text('contact_phone').notNull(),
    note: text('note'),
    rooms: jsonb('rooms').notNull(),
    failureReason: text('failure_reason'),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (t) => [
    unique('broker_booking_groups_reference_uk').on(t.reference),
    index('broker_booking_groups_broker_idx').on(t.brokerId, t.createdAt),
    index('broker_booking_groups_org_idx').on(t.orgId, t.createdAt),
    check('broker_booking_groups_dates_ck', sql`${t.checkOut} > ${t.checkIn}`),
    check('broker_booking_groups_total_ck', sql`${t.totalRwf} > 0`),
  ],
);

export const brokerCommissionStatusEnum = pgEnum('broker_commission_status', BrokerCommissionStatus.options);

/**
 * A commission a broker earned (0127): one per booking on a percent deal (its percent of the room price for
 * the nights stayed), one per group on a bulk deal (its sum, once the group's last room checked out). It is
 * collected from the hotel's payouts, oldest first (`collected_rwf` grows; `broker_commission_deductions`
 * says from which); once all of it is, the broker's share is paid out (`payout_id`).
 */
export const brokerCommissions = pgTable(
  'broker_commissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brokerId: uuid('broker_id')
      .notNull()
      .references(() => brokers.id),
    dealId: uuid('deal_id')
      .notNull()
      .references(() => brokerHotelDeals.id),
    groupId: uuid('group_id')
      .notNull()
      .references(() => brokerBookingGroups.id),
    /** The booking a percent commission was earned on; null on a bulk one, which is the group's. */
    bookingId: uuid('booking_id').references(() => bookings.id),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    kind: brokerDealKindEnum('kind').notNull(),
    baseRwf: integer('base_rwf'),
    nightsStayed: integer('nights_stayed'),
    commissionRwf: integer('commission_rwf').notNull(),
    injishiRwf: integer('injishi_rwf').notNull(),
    brokerRwf: integer('broker_rwf').notNull(),
    collectedRwf: integer('collected_rwf').notNull().default(0),
    status: brokerCommissionStatusEnum('status').notNull().default('owed'),
    earnedAt: timestamp('earned_at', { withTimezone: true }).notNull().defaultNow(),
    collectedAt: timestamp('collected_at', { withTimezone: true }),
    payoutId: uuid('payout_id').references(() => payouts.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('broker_commissions_booking_uk').on(t.bookingId).where(sql`${t.bookingId} IS NOT NULL`),
    uniqueIndex('broker_commissions_group_bulk_uk').on(t.groupId).where(sql`${t.kind} = 'bulk_fixed'`),
    index('broker_commissions_org_owed_idx').on(t.orgId, t.earnedAt).where(sql`${t.status} = 'owed'`),
    index('broker_commissions_broker_idx').on(t.brokerId, t.earnedAt),
    check('broker_commissions_split_ck', sql`${t.injishiRwf} + ${t.brokerRwf} = ${t.commissionRwf} AND ${t.commissionRwf} > 0`),
    check('broker_commissions_collected_ck', sql`${t.collectedRwf} BETWEEN 0 AND ${t.commissionRwf}`),
    check(
      'broker_commissions_status_ck',
      sql`(${t.status} = 'collected') = (${t.collectedRwf} = ${t.commissionRwf} AND ${t.collectedAt} IS NOT NULL)`,
    ),
    check('broker_commissions_kind_ck', sql`(${t.kind} = 'percent') = (${t.bookingId} IS NOT NULL)`),
  ],
);

/** What one stay's check-out gave towards one commission, and the hotel payout it came off (0127). */
export const brokerCommissionDeductions = pgTable(
  'broker_commission_deductions',
  {
    commissionId: uuid('commission_id')
      .notNull()
      .references(() => brokerCommissions.id),
    /** The stay whose check-out paid it. */
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id),
    /** The hotel payout it came off; null when the whole of that stay's money went to commission. */
    payoutId: uuid('payout_id').references(() => payouts.id),
    amountRwf: integer('amount_rwf').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('broker_commission_deductions_pk').on(t.commissionId, t.bookingId),
    index('broker_commission_deductions_payout_idx').on(t.payoutId),
    check('broker_commission_deductions_amount_ck', sql`${t.amountRwf} > 0`),
  ],
);

/** The MoMo number a broker's share of commissions is paid to (0127). One per broker. */
export const brokerPayoutAccounts = pgTable(
  'broker_payout_accounts',
  {
    brokerId: uuid('broker_id')
      .primaryKey()
      .references(() => brokers.id),
    accountName: text('account_name').notNull(),
    momoNetwork: momoNetworkEnum('momo_network').notNull(),
    momoPhone: text('momo_phone').notNull(),
    ...timestamps,
  },
  (t) => [
    check('broker_payout_accounts_phone_ck', sql`${t.momoPhone} ~ '^[+]250(72|73|78|79)[0-9]{7}$'`),
    check('broker_payout_accounts_name_ck', sql`length(btrim(${t.accountName})) > 0`),
  ],
);
