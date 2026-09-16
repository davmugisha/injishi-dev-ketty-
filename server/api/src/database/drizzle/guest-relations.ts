/**
 * §6.8 THE GUEST'S SIDE OF A STAY: money back, and money off.
 *
 * Two subjects that look unrelated and are the same shape, which is why they
 * share a module: both are a guest asking a property for a number, and both are
 * decided by a rule the property wrote down before the guest asked.
 *
 * - `stay_refund_requests` — the guest asks for money back, and the property
 *   answers with a rule of the accommodation or with a payment.
 * - `offers` / `offer_redemptions` — the property offers money off, and the
 *   guest takes it, once, against a bill.
 *
 * A LEAF MODULE. It imports from `hospitality`, `operations`, `inventory`,
 * `org` and `auth`, and nothing imports it back, so `schema.ts` can re-export
 * it last and `pnpm madge` stays clean. Putting `stay_refund_requests` in
 * `hospitality.ts` beside `guest_stays` would have been the obvious home and
 * would have made that module import `folios` from `operations`, which already
 * imports `hospitality` — a cycle bought for one line of tidiness.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { amount, currency, timestamps } from './columns';
import {
  offerAudienceEnum,
  offerDiscountKindEnum,
  offerScopeEnum,
  offerStatusEnum,
  stayRefundReasonEnum,
  stayRefundRefusalReasonEnum,
  stayRefundStateEnum,
} from './enums';
import { bookings, guestStays } from './hospitality';
import { properties } from './inventory';
import { departments, folioCharges, folios } from './operations';
import { orgs, workspaces } from './org';

// --- money back -------------------------------------------------------------

/**
 * ONE ASK FOR MONEY BACK, and the property's answer to it.
 *
 * ## Why this is not a booking cancellation
 *
 * `BookingCancellationService` already refunds a booking, and it refuses one
 * the guest has checked in to — "You have already checked in, so this booking
 * can no longer be cancelled here." That refusal is correct and this table is
 * what it was pointing at: a guest standing in the room has no way to raise
 * the question at all, so it is raised at the desk, by voice, and lives in
 * nobody's records.
 *
 * ## The entitlement is snapshotted, and it is not the decision
 *
 * `policy_*` is what the ACCOMMODATION'S OWN RULES allowed at the moment the
 * guest asked: the rate they booked, the tier it locked, the nights they have
 * already slept, what they actually paid. It is written once, with the request,
 * for the same reason `bookings.locked_cancellation_tier` exists — the rules
 * and the clock both move, and a decision argued three weeks later has to be
 * argued against the rules as they stood.
 *
 * The property is NOT bound by it in either direction. It may approve more than
 * the rules owed (goodwill, which is most of what a front office manager does
 * all day) and it may refuse what they owed, citing a rule the engine cannot
 * see — a broken window, a booking made through an agent who holds the money.
 * What it may not do is refuse without saying which rule: `refusal_reason` is
 * required on a rejection by the check below.
 */
export const stayRefundRequests = pgTable(
  'stay_refund_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * A short human code, `RF-XXXX-XXXX`, generated like `bookings.reference`.
     * The guest reads it out at the desk and quotes it in a dispute, so it has
     * to be sayable and it must not be a sequence: a sequential number tells a
     * competitor how many guests asked for their money back last month.
     */
    reference: text('reference').notNull(),
    guestStayId: uuid('guest_stay_id')
      .notNull()
      .references(() => guestStays.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    /** The bill as it stood. Null for a stay whose folio was never opened. */
    folioId: uuid('folio_id').references(() => folios.id),
    /** Null for a walk in, which is the case with no money held in escrow. */
    bookingId: uuid('booking_id').references(() => bookings.id),
    /**
     * Who asked. NOT NULL, and that is the point of the claim flow: a stay the
     * desk typed has no account attached, so the guest must have claimed it
     * before they can ask for anything. Without that, "refund me" is a sentence
     * anybody holding a room number could send.
     */
    raisedByUserId: uuid('raised_by_user_id')
      .notNull()
      .references(() => users.id),
    reason: stayRefundReasonEnum('reason').notNull(),
    /** The guest's own words. Required: a code alone is not a complaint. */
    detail: text('detail').notNull(),
    /**
     * What the guest asked for, or null for "whatever the rules allow".
     *
     * Null is the normal case and is deliberately distinct from zero: a guest
     * who does not know the tariff should not have to name a number to be
     * heard, and a request for nothing is not a request.
     */
    requestedRwf: amount('requested_rwf'),
    currency: currency(),
    state: stayRefundStateEnum('state').notNull().default('submitted'),

    // --- the snapshot: the house rules as they stood when the guest asked ---
    /** Did the rules owe anything at all? */
    policyEligible: boolean('policy_eligible').notNull().default(false),
    /** The ceiling the rules put on this request, in francs. */
    policyMaxRwf: amount('policy_max_rwf').notNull().default(0),
    /** The rule that decided it, in the sentence the guest was shown. */
    policyRule: text('policy_rule').notNull(),
    /**
     * The refusal the rules already point at, when they point at one. The desk
     * gets it as the pre-filled answer on the decision screen; it is a
     * suggestion, never the decision, which is why the decision has its own
     * column below.
     */
    policyRefusalReason: stayRefundRefusalReasonEnum('policy_refusal_reason'),

    // --- the answer --------------------------------------------------------
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    /** What was actually given back. Zero is a legitimate approval of nothing. */
    approvedRwf: amount('approved_rwf'),
    refusalReason: stayRefundRefusalReasonEnum('refusal_reason'),
    /** The property's own words, shown to the guest verbatim. */
    decisionNote: text('decision_note'),
    /**
     * What the payment rail answered, when money moved. Null on a rejection, on
     * an approval of zero, and on an approval the rail has not confirmed — the
     * money is never recorded as sent on the strength of a button press.
     */
    paymentRef: text('payment_ref'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('stay_refund_requests_reference_uk').on(t.reference),
    index('stay_refund_requests_workspace_state_idx').on(
      t.workspaceId,
      t.state,
      t.createdAt,
    ),
    index('stay_refund_requests_stay_idx').on(t.guestStayId),
    index('stay_refund_requests_raised_by_idx').on(t.raisedByUserId),
    /**
     * ONE OPEN REQUEST PER STAY. A guest who taps twice, or who asks again
     * while the first is still being read, must not create a second queue item
     * that a second staffer answers differently. Closed requests are unlimited:
     * a rejection is not the end of the conversation, and a new night can bring
     * a new complaint.
     */
    uniqueIndex('stay_refund_requests_one_open_per_stay_uk')
      .on(t.guestStayId)
      .where(sql`${t.state} = 'submitted'`),
    /**
     * A DECISION IS WHOLE, or it is not a decision.
     *
     * An approval names its amount, a rejection names its rule, and both name
     * who decided and when. A rejection with no reason is the thing this whole
     * table exists to prevent: it is what a guest escalates, because there is
     * nothing in it they can answer.
     */
    check(
      'stay_refund_requests_decision_shape',
      sql`(${t.state} = 'submitted' AND ${t.decidedAt} IS NULL)
           OR (${t.state} = 'withdrawn' AND ${t.decidedAt} IS NOT NULL)
           OR (${t.state} = 'approved' AND ${t.decidedAt} IS NOT NULL
               AND ${t.decidedByUserId} IS NOT NULL AND ${t.approvedRwf} IS NOT NULL)
           OR (${t.state} = 'rejected' AND ${t.decidedAt} IS NOT NULL
               AND ${t.decidedByUserId} IS NOT NULL AND ${t.refusalReason} IS NOT NULL)`,
    ),
    check(
      'stay_refund_requests_amounts_nonnegative',
      sql`(${t.requestedRwf} IS NULL OR ${t.requestedRwf} >= 0)
           AND (${t.approvedRwf} IS NULL OR ${t.approvedRwf} >= 0)
           AND ${t.policyMaxRwf} >= 0`,
    ),
  ],
);

// --- money off --------------------------------------------------------------

/**
 * A DISCOUNT THE PROPERTY IS OFFERING, with the conditions it is offered under.
 *
 * ## Conditions are columns, not prose
 *
 * "Two nights or more", "in-house guests only", "September", "RWF 20,000 and
 * up" are each a column, because the server has to be able to REFUSE a
 * redemption that does not meet them. An offer whose conditions live in its
 * description is an offer the server cannot enforce, which means the only thing
 * standing between a stranger and the staff rate is what the listing chose to
 * show them.
 *
 * ## What it is not
 *
 * It is not a rate plan. `rate_plans` prices a room type before a booking is
 * made and is snapshotted onto the booking at sale (D8); an offer takes money
 * off a bill that already exists, as a `discount` line on the folio. The two
 * answer different questions and a property uses both: a September rate, and
 * 15% off dinner for anybody sleeping upstairs tonight.
 */
export const offers = pgTable(
  'offers',
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
    /** What the guest reads on the card. */
    name: text('name').notNull(),
    description: text('description'),
    discountKind: offerDiscountKindEnum('discount_kind').notNull(),
    /**
     * Percent (1-100) when `discount_kind` is `percentage`, francs when it is
     * `fixed_amount`. One column with two readings rather than two nullable
     * ones, because exactly one is meaningful at a time and a pair of nullable
     * columns is a pair that can both be set.
     */
    discountValue: amount('discount_value').notNull(),
    scope: offerScopeEnum('scope').notNull(),
    /**
     * Narrows a `service` offer to one department's charges — 15% off the spa
     * rather than off everything. Meaningless on a `room` or `folio` offer, and
     * the check below refuses it there rather than letting it sit as a field
     * nobody reads.
     */
    departmentId: uuid('department_id').references(() => departments.id),
    /**
     * The code a guest types, or null for an offer that needs none.
     *
     * Stored upper-cased by the service, and unique per property: two live
     * offers sharing a code is an ambiguity the redemption cannot resolve, and
     * resolving it by "the newest one" would silently retire the other.
     */
    code: text('code'),
    audience: offerAudienceEnum('audience').notNull().default('anyone'),
    /** The window, in the property's own calendar. Null end means open ended. */
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on'),
    /** Conditions. Null means the condition is not imposed. */
    minNights: integer('min_nights'),
    minSpendRwf: amount('min_spend_rwf'),
    /** A ceiling on how many times ANY guest may take it. Null is unlimited. */
    maxRedemptions: integer('max_redemptions'),
    status: offerStatusEnum('status').notNull().default('draft'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index('offers_property_status_idx').on(t.propertyId, t.status),
    index('offers_workspace_idx').on(t.workspaceId),
    /**
     * One live code per property. Partial, because an archived offer keeps its
     * code on the record — a redemption three months old has to stay readable —
     * and a retired code must be reusable.
     */
    uniqueIndex('offers_property_code_uk')
      .on(t.propertyId, t.code)
      .where(sql`${t.code} IS NOT NULL AND ${t.status} <> 'archived'`),
    check(
      'offers_discount_value_in_range',
      sql`(${t.discountKind} = 'percentage' AND ${t.discountValue} BETWEEN 1 AND 100)
           OR (${t.discountKind} = 'fixed_amount' AND ${t.discountValue} > 0)`,
    ),
    check(
      'offers_department_only_on_service_scope',
      sql`${t.departmentId} IS NULL OR ${t.scope} = 'service'`,
    ),
    check(
      'offers_window_ordered',
      sql`${t.endsOn} IS NULL OR ${t.endsOn} >= ${t.startsOn}`,
    ),
    check(
      'offers_limits_positive',
      sql`(${t.minNights} IS NULL OR ${t.minNights} >= 1)
           AND (${t.minSpendRwf} IS NULL OR ${t.minSpendRwf} >= 0)
           AND (${t.maxRedemptions} IS NULL OR ${t.maxRedemptions} >= 1)`,
    ),
  ],
);

/**
 * ONE GUEST TAKING ONE OFFER, ONCE.
 *
 * The row is the receipt for the discount, and it names the folio LINE the
 * discount posted as. That link is what makes the discount auditable in both
 * directions: from the bill you can reach the offer that justified the credit,
 * and from the offer you can count what it cost. A discount line on a folio
 * with no row here is a credit nobody authorised.
 */
export const offerRedemptions = pgTable(
  'offer_redemptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    offerId: uuid('offer_id')
      .notNull()
      .references(() => offers.id, { onDelete: 'cascade' }),
    guestStayId: uuid('guest_stay_id')
      .notNull()
      .references(() => guestStays.id, { onDelete: 'cascade' }),
    folioId: uuid('folio_id')
      .notNull()
      .references(() => folios.id),
    /**
     * The negative `discount` line this created. Nullable only because the
     * charge is written in the same transaction and one of the two has to be
     * inserted first; it is never null once that transaction commits.
     */
    folioChargeId: uuid('folio_charge_id').references(() => folioCharges.id),
    /** Who took it. Null is impossible in practice: a claim is required first. */
    userId: uuid('user_id').references(() => users.id),
    /** What came off, as a POSITIVE number. The folio line carries the sign. */
    amountRwf: amount('amount_rwf').notNull(),
    currency: currency(),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    /**
     * ONE REDEMPTION PER OFFER PER STAY, in the database.
     *
     * This is the rule that actually stops a guest tapping "Apply" four times
     * and taking 15% off the same bill four times. The service checks first,
     * and two taps in the same second both pass that check; the loser takes a
     * 23505 and is answered with the redemption that already exists.
     */
    uniqueIndex('offer_redemptions_offer_stay_uk').on(t.offerId, t.guestStayId),
    index('offer_redemptions_offer_idx').on(t.offerId),
    index('offer_redemptions_stay_idx').on(t.guestStayId),
    check('offer_redemptions_amount_positive', sql`${t.amountRwf} > 0`),
  ],
);
