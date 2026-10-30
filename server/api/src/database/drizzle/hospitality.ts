/**
 * §6 HOSPITALITY.
 *
 * Carved out of the single 3,956-line `schema.ts` along the section headers
 * that file already carried. Every declaration below is byte-identical to the
 * one it replaced; only the import lines are new. `schema.ts` re-exports this
 * module, so `drizzle.config.ts`, every migration and every importer still see
 * one schema at one path.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { amount, currency, timestamps } from './columns';
import { bookingModeEnum, bookingStatusEnum, cancellationTierEnum, checkInModeEnum, claimStatusEnum, collectionVisibilityEnum, declineReasonEnum, documentTypeEnum, paymentStatusEnum, reviewSideEnum, stayLifecycleEnum, storedObjectKindEnum } from './enums';
import { bookingChannelEnum } from './interface-frontdesk';
import { properties, ratePlans, roomTypes, rooms } from './inventory';
import { workspaces } from './org';

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reference: text('reference').notNull(),
    roomTypeId: uuid('room_type_id')
      .notNull()
      .references(() => roomTypes.id),
    /**
     * The product half: which rate plan was booked (F-L03). NULLABLE during the
     * expand phase because real bookings predate rate plans; the contract phase
     * backfills every row to its room type's seeded "Standard rate" and then
     * sets NOT NULL.
     *
     * Note the locked_* columns below do NOT move: D8 already snapshots rate,
     * tier and terms onto the booking, so historical correctness survives the
     * model change for free and no commercial backfill is needed.
     */
    ratePlanId: uuid('rate_plan_id').references(() => ratePlans.id),
    guestUserId: uuid('guest_user_id').references(() => users.id),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    checkIn: date('check_in').notNull(),
    checkOut: date('check_out').notNull(),
    guestCount: integer('guest_count').notNull().default(1),
    status: bookingStatusEnum('status').notNull(),
    bookingMode: bookingModeEnum('booking_mode').notNull(),
    /**
     * NOT NULL since migration 0043 (platform audit step 3). The one API insert
     * (`BookingRepository.create`) always wrote it from the quote, and every
     * seed does; a booking with no locked rate is a booking nobody can refund.
     */
    lockedNightlyRateRwf: amount('locked_nightly_rate_rwf').notNull(),
    lockedCancellationTier: cancellationTierEnum('locked_cancellation_tier'),
    nonrefundable: boolean('nonrefundable').notNull().default(false),
    /** NOT NULL since migration 0043, for the reason `locked_nightly_rate_rwf` is. */
    grossRwf: amount('gross_rwf').notNull(),
    currency: currency(),
    paymentStatus: paymentStatusEnum('payment_status'),
    declineReason: declineReasonEnum('decline_reason'),
    approvalExpiresAt: timestamp('approval_expires_at', { withTimezone: true }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    /**
     * Which fiscal rule this booking was confirmed under (ADR-050 D-a):
     * `booking` (the sale was signed at confirmation) or `checkout` (a proforma
     * was, and the sale is signed when the folio closes).
     *
     * STAMPED at confirmation from `EBM_SIGN_AT`, and read from here forever
     * after. Reading the variable again at close would mean a booking confirmed
     * under `checkout` (a `PS`, no `NS`) and checked out after a rollback
     * produces no `NS` ever: money taken, nothing declared. The stamp makes the
     * rule travel with the booking, which is why this column outlives the flag.
     */
    ebmSignAt: text('ebm_sign_at'),
    /**
     * Until when an expiry sweep owns this row (review 2.4). A sweep claims a
     * bounded batch by stamping this a few minutes ahead, so a second worker
     * running the same sweep skips it instead of asking the provider to
     * release the same hold twice. Null, or in the past, means unclaimed.
     */
    sweepClaimedUntil: timestamp('sweep_claimed_until', { withTimezone: true }),
    /**
     * A cancellation, as it was decided (F-B11, ADR-051). Written once, with
     * the status, in the transaction that records what the provider already
     * confirmed, so a trip and a desk read the refund the guest was actually
     * given rather than recomputing it from a tier and a clock that have moved.
     */
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    /**
     * When the guest checked out (0116). The booking stays `confirmed`; this
     * says the stay is over, frees the nights from that day on, and is what
     * releases the escrow to the host.
     */
    completedAt: timestamp('completed_at', { withTimezone: true }),
    /** `guest` or `host`. */
    cancelledBy: text('cancelled_by'),
    /** What went back to the guest; the rest of `gross_rwf` stays with the host. */
    refundRwf: amount('refund_rwf'),
    /**
     * The room money the guest has paid (migration 0120). Null until a desk change reprices the stay; until
     * then it is the locked nightly charge times the nights, less any refund. The bill credits this at check in.
     */
    paidRoomRwf: amount('paid_room_rwf'),
    /**
     * The front desk's working columns (interface real-data, frontdesk leaf).
     * Each is one fact about this reservation that the desk reads on every
     * queue and had nowhere to keep. All nullable: a booking made before them
     * simply has not said.
     *
     * Where it came from. Null reads as the marketplace, which is how every
     * earlier booking was made.
     */
    channel: bookingChannelEnum('channel'),
    /** The split of `guest_count`, when the booking recorded it. */
    adults: smallint('adults'),
    children: smallint('children'),
    /** When the guest expects to arrive, on the Kigali wall clock. */
    eta: time('eta'),
    /** What the desk wrote on the reservation: a request, a promise, a warning. */
    deskNote: text('desk_note'),
    /**
     * A no-show, as the desk recorded it (`POST /ops/reservations/:id/no-show`).
     * Written once, with the status, by the command that moves the money.
     */
    noShowAt: timestamp('no_show_at', { withTimezone: true }),
    noShowByUserId: uuid('no_show_by_user_id').references(() => users.id),
    noShowReason: text('no_show_reason'),
    /**
     * Why the desk cancelled, in the desk's words, when it cancelled at the
     * guest's request (`POST /ops/reservations/:id/cancel`). The refund is not
     * here: `refund_rwf` and `cancelled_by` already say what was decided.
     */
    cancelReason: text('cancel_reason'),
    ...timestamps,
  },
  (t) => [
    unique('bookings_reference_uk').on(t.reference),
    // A recorded no-show is a no-show: the stamp never sits on a live booking.
    check('bookings_no_show_shape', sql`${t.noShowAt} IS NULL OR ${t.status} = 'no_show'`),
    // The split, when given, adds up to the party the booking was priced for.
    check(
      'bookings_party_split',
      sql`(${t.adults} IS NULL OR (${t.adults} > 0 AND ${t.adults} + coalesce(${t.children}, 0) = ${t.guestCount}))
          AND (${t.children} IS NULL OR ${t.children} >= 0)`,
    ),
    // A recorded cancellation is whole: cancelled, by a party, with its refund.
    // One direction only, because rows cancelled before this column existed
    // (seeds, fixtures) carry no record and inventing one would be worse.
    check(
      'bookings_cancellation_shape',
      sql`${t.cancelledAt} IS NULL OR (${t.status} = 'cancelled' AND ${t.cancelledBy} IN ('guest', 'host') AND ${t.refundRwf} IS NOT NULL)`,
    ),
    // What the code has always assumed, now held where no path can skip it
    // (platform audit step 3). Half open stays: a zero night booking holds no
    // night and prices to nothing, so it is refused rather than stored.
    check('bookings_dates_ordered', sql`${t.checkOut} > ${t.checkIn}`),
    check('bookings_paid_room_nonnegative', sql`${t.paidRoomRwf} IS NULL OR ${t.paidRoomRwf} >= 0`),
    check('bookings_guest_count_positive', sql`${t.guestCount} > 0`),
    check(
      'bookings_amounts_non_negative',
      sql`${t.lockedNightlyRateRwf} >= 0 AND ${t.grossRwf} >= 0 AND (${t.refundRwf} IS NULL OR ${t.refundRwf} >= 0)`,
    ),
    index('bookings_guest_idx').on(t.guestUserId),
    index('bookings_workspace_status_idx').on(t.workspaceId, t.status, t.checkIn),
    /**
     * The availability hold (BookingRepository.create step 2) counts overlapping
     * bookings by `(room_type_id, status, check_in, check_out)` while holding a
     * row lock on the Room type — so its cost is serialised latency on the
     * booking path, not just IO. Partial on the two holding statuses: cancelled,
     * declined and no_show rows accumulate forever and are never counted, so
     * keeping them out holds the index at the size of *live* inventory.
     * Supersedes the room_type-only index, which this one prefixes.
     */
    index('bookings_hold_overlap_idx')
      .on(t.roomTypeId, t.checkIn, t.checkOut)
      .where(sql`${t.status} IN ('pending_approval', 'confirmed')`),
    /**
     * The auto-decline sweep (expireStaleRequests) runs every 5 minutes and
     * scans for `pending_approval` rows past their window. Without this it is a
     * full scan of `bookings` 288 times a day, growing with total booking
     * history. Partial + ordered by the column it ranges on, so the sweep costs
     * the size of its own result set.
     */
    index('bookings_pending_expiry_idx')
      .on(t.approvalExpiresAt)
      .where(
        sql`${t.status} = 'pending_approval' AND ${t.approvalExpiresAt} IS NOT NULL`,
      ),
  ],
);

/**
 * A change the desk made to a confirmed reservation (migration 0120): its dates, its room type, its party.
 *
 * Each row keeps the stay before and after, what the room cost before (what the guest had paid) and after,
 * and how the difference is settled: on the guest's bill, by a MoMo request to the guest (the change waits
 * for the payment), or as credit on the bill when the stay costs less. Never edited after it applies; a
 * second change is a second row.
 */
export const bookingChanges = pgTable(
  'booking_changes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    /** `applied`, `awaiting_payment` (a MoMo request is out) or `abandoned` (it was refused or ran out). */
    status: text('status').notNull(),
    /** `none` (same price), `bill`, `momo` (costs more) or `credit` (costs less). */
    settlement: text('settlement').notNull(),
    fromCheckIn: date('from_check_in').notNull(),
    fromCheckOut: date('from_check_out').notNull(),
    fromRoomTypeId: uuid('from_room_type_id')
      .notNull()
      .references(() => roomTypes.id),
    fromAdults: smallint('from_adults').notNull(),
    fromChildren: smallint('from_children').notNull(),
    toCheckIn: date('to_check_in').notNull(),
    toCheckOut: date('to_check_out').notNull(),
    toRoomTypeId: uuid('to_room_type_id')
      .notNull()
      .references(() => roomTypes.id),
    toAdults: smallint('to_adults').notNull(),
    toChildren: smallint('to_children').notNull(),
    fromNightlyRwf: amount('from_nightly_rwf').notNull(),
    toNightlyRwf: amount('to_nightly_rwf').notNull(),
    /** The room money paid before the change. */
    paidRoomRwf: amount('paid_room_rwf').notNull(),
    /** What the room costs after it. */
    newRoomRwf: amount('new_room_rwf').notNull(),
    /** `new_room_rwf - paid_room_rwf`: more owed when positive, credit when negative. */
    differenceRwf: bigint('difference_rwf', { mode: 'number' }).notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
  },
  (t) => [
    index('booking_changes_booking_idx').on(t.bookingId, t.createdAt),
    uniqueIndex('booking_changes_one_awaiting_uk')
      .on(t.bookingId)
      .where(sql`${t.status} = 'awaiting_payment'`),
    check('booking_changes_status_ck', sql`${t.status} IN ('applied', 'awaiting_payment', 'abandoned')`),
    check('booking_changes_settlement_ck', sql`${t.settlement} IN ('none', 'bill', 'credit', 'momo')`),
    check(
      'booking_changes_settlement_shape',
      sql`(${t.differenceRwf} = 0 AND ${t.settlement} = 'none')
          OR (${t.differenceRwf} > 0 AND ${t.settlement} IN ('bill', 'momo'))
          OR (${t.differenceRwf} < 0 AND ${t.settlement} = 'credit')`,
    ),
    check('booking_changes_applied_shape', sql`(${t.status} = 'applied') = (${t.appliedAt} IS NOT NULL)`),
    check('booking_changes_awaiting_momo', sql`${t.status} <> 'awaiting_payment' OR ${t.settlement} = 'momo'`),
    check(
      'booking_changes_dates_ordered',
      sql`${t.toCheckOut} > ${t.toCheckIn} AND ${t.fromCheckOut} > ${t.fromCheckIn}`,
    ),
    check(
      'booking_changes_money_nonnegative',
      sql`${t.fromNightlyRwf} >= 0 AND ${t.toNightlyRwf} >= 0 AND ${t.paidRoomRwf} >= 0 AND ${t.newRoomRwf} >= 0`,
    ),
  ],
);


export const guestStays = pgTable(
  'guest_stays',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id').references(() => bookings.id),
    guestUserId: uuid('guest_user_id').references(() => users.id),
    /**
     * The guest's name when there is no account to read it from (ADR-035).
     *
     * A WALK IN has no booking and no `users` row, so every read that took the
     * name from `users.name` returned null and the desk saw "Unnamed guest" for
     * the person standing in front of them. The alternative was creating a
     * shell `users` row per walk in, which mints an account nobody asked for
     * and collides with the real sign up when that person later joins.
     *
     * NULL for a stay that HAS an account: the account is the better source and
     * it stays current when the person renames themselves. Readers prefer
     * `users.name` and fall back to this.
     */
    guestName: text('guest_name'),
    /**
     * Where the "continue in the app" mail goes, captured at the desk.
     *
     * A WALK IN HAS NO ACCOUNT, which is what a walk in means, so there is no
     * `users.email` to read. The desk types this on the registration card and
     * it is the ONLY address this stay's claim invitation is ever sent to: the
     * claim binds a stay to whoever holds the code, so an address a caller
     * could supply later would be a way to have somebody else's stay mailed to
     * you.
     *
     * NULL for a stay that has an account. The account is the better source and
     * stays current when the person changes their address; readers prefer
     * `users.email` and fall back to this.
     */
    guestEmail: text('guest_email'),
    /** The number on the registration card. Not a sign-in channel; a contact. */
    guestPhone: text('guest_phone'),
    /**
     * When the claim invitation was last handed to the mailer.
     *
     * Recorded so a second press at the desk is visible rather than silent, and
     * so the resend cap has something to count. It says the mail was SENT, not
     * that it arrived — the mailer seam never promises delivery.
     */
    claimInvitedAt: timestamp('claim_invited_at', { withTimezone: true }),
    /** When the stay was bound to an account. Set with `claim_status`. */
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    checkInMode: checkInModeEnum('check_in_mode').notNull(),
    isVerified: boolean('is_verified').notNull().default(false),
    entryAt: timestamp('entry_at', { withTimezone: true }).notNull(),
    plannedExitAt: timestamp('planned_exit_at', { withTimezone: true }),
    actualExitAt: timestamp('actual_exit_at', { withTimezone: true }),
    /**
     * What the desk wrote down as the guest left — "left early, keys at desk",
     * "disputes the minibar line", "balance to be invoiced to the employer".
     *
     * `CheckOutRequest.note` has been in the contract since ADR-035 and there
     * was nowhere to put it: the field was declared, the controller took no
     * body, and anything typed would have been accepted and dropped. A column
     * is the smaller half of fixing that; the larger half is that check out is
     * the one moment a receptionist has a reason to write something down and
     * the only record of it was a verbal handover.
     *
     * Deliberately NOT a general stay note. It is written once, by the close,
     * and nothing else updates it — which is why it lives on the stay rather
     * than growing a notes table nobody asked for yet.
     */
    departureNote: text('departure_note'),
    priceRwf: amount('price_rwf'),
    currency: currency(),
    lifecycle: stayLifecycleEnum('lifecycle').notNull().default('open'),
    claimCode: text('claim_code'),
    claimStatus: claimStatusEnum('claim_status').notNull().default('unclaimed'),
    claimedByUserId: uuid('claimed_by_user_id').references(() => users.id),
    /**
     * The stay's human handle, `ST-` and six characters, minted when the stay
     * opens (interface real-data, frontdesk leaf). The desk quotes it on the
     * phone and in a handover the way it quotes a booking reference; a uuid is
     * not something anybody reads aloud. Null on a stay opened before it existed.
     */
    reference: text('reference'),
    /**
     * The desk's running note on a guest in house ("extra bed in room", "pays at
     * checkout"). Unlike `departure_note`, which the close writes once, this is
     * the note the desk keeps while the guest is here.
     */
    deskNote: text('desk_note'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('guest_stays_reference_uk')
      .on(t.reference)
      .where(sql`${t.reference} IS NOT NULL`),
    uniqueIndex('guest_stays_claim_code_uk')
      .on(t.claimCode)
      .where(sql`${t.claimCode} IS NOT NULL`),
    index('guest_stays_workspace_idx').on(t.workspaceId),
    index('guest_stays_room_idx').on(t.roomId),
    index('guest_stays_booking_idx').on(t.bookingId),
    // One open stay per room, enforced where a race cannot reach it. The walk
    // in re-check selects open stays FOR UPDATE, and on a free room that locks
    // no row, so two desks admitting guests at once both saw "free" and both
    // inserted (platform audit 2026-09-14, H2). A losing insert now fails with
    // 23505 and is answered as an occupied room.
    uniqueIndex('guest_stays_one_open_per_room_uk')
      .on(t.roomId)
      .where(sql`${t.lifecycle} = 'open'`),
    // A claimed stay names WHO claimed it and WHEN. Without this the three
    // columns can disagree — a stay marked claimed with nobody attached is a
    // record the guest cannot reach and the desk cannot re-issue a code for,
    // because re-issuing refuses a claimed stay. Nothing writes `claimed`
    // today, so the check is safe to state in both directions.
    check(
      'guest_stays_claim_shape',
      sql`${t.claimStatus} = 'unclaimed'
           OR (${t.claimedByUserId} IS NOT NULL AND ${t.claimedAt} IS NOT NULL)`,
    ),
    // The claim lands by GUEST first: "is there a stay waiting for me" is
    // answered off the address the desk typed, and without this it is a scan of
    // every stay the platform has ever recorded. Partial, because a stay that
    // is already claimed is never a candidate again.
    index('guest_stays_unclaimed_email_idx')
      .on(t.guestEmail)
      .where(sql`${t.claimStatus} = 'unclaimed' AND ${t.guestEmail} IS NOT NULL`),
  ],
);


export const storedObjects = pgTable('stored_objects', {
  id: uuid('id').primaryKey().defaultRandom(),
  objectKey: text('object_key').notNull().unique(),
  kind: storedObjectKindEnum('kind').notNull(),
  mime: text('mime'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  uploadedByUserId: uuid('uploaded_by_user_id').references(() => users.id),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  legalHold: boolean('legal_hold').notNull().default(false),
  retentionUntil: timestamp('retention_until', { withTimezone: true }),
  ...timestamps,
});


/**
 * The identity a guest showed at check in. Personal data under retention and
 * legal hold rules, so deleting a stay must never take it silently: RESTRICT
 * since migration 0043 (platform audit step 3). It used to cascade.
 */
export const stayIdentities = pgTable('stay_identities', {
  id: uuid('id').primaryKey().defaultRandom(),
  guestStayId: uuid('guest_stay_id')
    .notNull()
    .unique()
    .references(() => guestStays.id, { onDelete: 'restrict' }),
  fullName: text('full_name'),
  idNumber: text('id_number'),
  documentType: documentTypeEnum('document_type'),
  /** ISO-3166-1 alpha-2, as the desk took it (0114): who the stay is reported to. */
  nationality: char('nationality', { length: 2 }),
  idPhotoObjectId: uuid('id_photo_object_id').references(() => storedObjects.id),
  addressText: text('address_text'),
  capturedAt: timestamp('captured_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});


/**
 * The identity a guest sent from their phone BEFORE arrival (F-B09, ADR-060).
 *
 * Keyed by the BOOKING, because a `guest_stays` row is only created when the
 * desk checks the guest in, and `stay_identities` cannot exist before its stay.
 * The desk check-in copies this onto `stay_identities`, photo included, so the
 * desk confirms what the guest sent rather than retyping it. Personal data
 * under the same retention rules as `stay_identities`: RESTRICT, not cascade.
 */
export const preArrivalIdentities = pgTable('pre_arrival_identities', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id')
    .notNull()
    .unique()
    .references(() => bookings.id, { onDelete: 'restrict' }),
  guestUserId: uuid('guest_user_id')
    .notNull()
    .references(() => users.id),
  documentType: documentTypeEnum('document_type').notNull(),
  documentNumber: text('document_number').notNull(),
  issuingCountry: text('issuing_country').notNull(),
  idPhotoObjectId: uuid('id_photo_object_id').references(() => storedObjects.id),
  addressText: text('address_text').notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  ...timestamps,
}, (t) => [
  index('pre_arrival_identities_guest_user_idx').on(t.guestUserId),
  index('pre_arrival_identities_id_photo_idx').on(t.idPhotoObjectId),
]);


export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    stayId: uuid('stay_id')
      .notNull()
      .references(() => guestStays.id, { onDelete: 'cascade' }),
    side: reviewSideEnum('side').notNull(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id),
    overallRating: smallint('overall_rating'),
    cleanliness: smallint('cleanliness'),
    accuracy: smallint('accuracy'),
    checkIn: smallint('check_in'),
    communication: smallint('communication'),
    location: smallint('location'),
    value: smallint('value'),
    comment: text('comment'),
    moderationState: text('moderation_state').notNull().default('visible'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('reviews_stay_side_uk').on(t.stayId, t.side),
    check(
      'reviews_side_shape',
      sql`(${t.side} = 'guest_to_host')
          OR (${t.cleanliness} IS NULL AND ${t.accuracy} IS NULL AND ${t.checkIn} IS NULL
              AND ${t.communication} IS NULL AND ${t.location} IS NULL AND ${t.value} IS NULL)`,
    ),
  ],
);


export const collections = pgTable(
  'collections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id),
    name: text('name').notNull(),
    shareToken: text('share_token'),
    visibility: collectionVisibilityEnum('visibility')
      .notNull()
      .default('private'),
    /**
     * ADR-032. The one list `/me/saved` writes into, created lazily on a
     * person's first save.
     *
     * A flag rather than a name or an age, because F-B16 explicitly permits
     * duplicate collection names, so the name cannot identify the default list,
     * and age stops working the day somebody deletes their oldest list.
     */
    isDefault: boolean('is_default').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    /**
     * At most one default list per person, enforced by the database.
     *
     * This is load bearing, not tidiness. Without it two hearts tapped in the
     * same instant each find no default, each create one, and the person
     * quietly ends up with two Saved lists holding half their saves each. With
     * it the loser of the race takes a unique violation and retries into the
     * winner's row.
     */
    uniqueIndex('collections_one_default_per_user_uk')
      .on(t.userId)
      .where(sql`${t.isDefault}`),
  ],
);


export const collectionItems = pgTable(
  'collection_items',
  {
    /**
     * A row id beside the composite key, so a seed can name the rows it wrote
     * (the interface seed converges every table on ids). The key is unchanged.
     */
    id: uuid('id').notNull().defaultRandom().unique(),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    /**
     * The nightly rate (or monthly rent) when it was saved, whole francs, so the
     * list can say the price moved. Null for a save made before the column, or a
     * property that had no price.
     */
    savedPriceRwf: bigint('saved_price_rwf', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.propertyId] })],
);


export const arrivalGuides = pgTable('arrival_guides', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id')
    .notNull()
    .unique()
    .references(() => properties.id, { onDelete: 'cascade' }),
  wifi: text('wifi'),
  lockCode: text('lock_code'),
  directions: text('directions'),
  houseManual: text('house_manual'),
  revealOnStaffed: boolean('reveal_on_staffed').notNull().default(false),
  ...timestamps,
});

// ===========================================================================
// §7  RESIDENCE  (leases + lifecycle + broker channel)
// ===========================================================================

/**
 * A reservation the FRONT DESK made (0124, 2026-10-30): a phone call, a WhatsApp, an email, a walk in
 * for a later day. One row per such booking, beside it rather than on it.
 *
 * A side table, not columns on `bookings`, for one reason the owner chose: the migration that adds it
 * alters nothing that exists, so the live database takes it with no risk to a single booking read.
 *
 * - `guest_name` and `guest_phone`: the desk's guest has no account, so `bookings.guest_user_id` is null
 *   and this is who the booking is for. Readers prefer an account's name and fall back to this.
 * - `nationality`, `document_type`, `id_number`: what the desk took on the phone, carried to the
 *   registration card at check in. Optional here; check in asks for what is missing.
 * - `hold_until`: a booking held for the guest, not confirmed. Past it, the sweep releases the nights.
 * - `rate_override_reason`: why the desk charged other than the room's price (the price itself is
 *   the booking's locked nightly rate).
 */
export const bookingDeskDetails = pgTable(
  'booking_desk_details',
  {
    bookingId: uuid('booking_id')
      .primaryKey()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    guestName: text('guest_name').notNull(),
    guestPhone: text('guest_phone'),
    guestEmail: text('guest_email'),
    /** ISO-3166-1 alpha-2, as the desk took it. */
    nationality: char('nationality', { length: 2 }),
    documentType: documentTypeEnum('document_type'),
    idNumber: text('id_number'),
    holdUntil: timestamp('hold_until', { withTimezone: true }),
    rateOverrideReason: text('rate_override_reason'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index('booking_desk_details_workspace_idx').on(t.workspaceId),
    index('booking_desk_details_hold_idx')
      .on(t.holdUntil)
      .where(sql`${t.holdUntil} IS NOT NULL`),
  ],
);
