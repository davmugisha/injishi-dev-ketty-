/**
 * §14 PMS OPERATIONS LAYER (ADR-016).
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
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
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
import { taxCodeEnum } from './enums';
import { bookings, guestStays } from './hospitality';
import { properties, rooms } from './inventory';
import { orgMemberships, orgs, workspaces } from './org';
import { leases } from './residence';

// --- §14.2 departments and outlets -----------------------------------------

/**
 * USALI's two halves. `operated` departments earn (and therefore may take a
 * charge); `undistributed` ones cost. The split is what makes gross operating
 * profit fall out of the folio rather than being assembled later.
 */
export const departmentTypeEnum = pgEnum('department_type', [
  'operated',
  'undistributed',
]);


/**
 * The USALI vocabulary. Stable, so an enum rather than a catalog (D14): the
 * NAMES of a property's departments are editable, the accounting categories
 * they roll up to are not.
 */
export const departmentCategoryEnum = pgEnum('department_category', [
  'rooms',
  'fnb',
  'spa_recreation',
  'other_operated',
  'misc_income',
  'admin_general',
  'sales_marketing',
  'it',
  'engineering',
  'utilities',
  'hr',
]);


/** Soft retirement. A department is never deleted; its revenue history is why. */
export const departmentStatusEnum = pgEnum('department_status', [
  'active',
  'archived',
]);


export const outletKindEnum = pgEnum('outlet_kind', [
  'restaurant',
  'bar',
  'lounge',
  'banquet',
  'room_service',
  'spa',
  'gym',
  'pool',
  'gift_shop',
  'parking',
  'laundry',
  'business_center',
  'other',
]);


/** Operational rank inside a department. A second axis over `org_role` (D17). */
export const departmentPositionEnum = pgEnum('department_position', [
  'department_head',
  'supervisor',
  'staff',
]);


export const departmentMemberStatusEnum = pgEnum('department_member_status', [
  'active',
  'removed',
]);


/**
 * The USALI operating unit, per property (§14.2, D14).
 *
 * `property_id` null means a corporate department that spans the org. Set means
 * it belongs to one property, which is the only shape this build creates.
 *
 * Not an enum on purpose: the set is seeded from a template and then edited,
 * because a resort and a cottage do not run the same departments. The
 * `department_category` above is the stable part.
 */
export const departments = pgTable(
  'departments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    /** Null = an org-wide corporate department (A and G, corporate sales). */
    propertyId: uuid('property_id').references(() => properties.id, {
      onDelete: 'cascade',
    }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    name: text('name').notNull(),
    departmentType: departmentTypeEnum('department_type').notNull(),
    departmentCategory: departmentCategoryEnum('department_category').notNull(),
    /**
     * May a revenue charge post here? Operated implies true (AC-1). Kept as its
     * own column rather than derived from the type, because an operator may
     * retire a revenue centre without changing what USALI calls it.
     */
    isRevenueCenter: boolean('is_revenue_center').notNull().default(false),
    /** May a guest message or order this department directly? */
    guestRequestable: boolean('guest_requestable').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    status: departmentStatusEnum('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    index('departments_property_idx').on(t.propertyId),
    index('departments_workspace_idx').on(t.workspaceId),
    index('departments_org_idx').on(t.orgId),
    /**
     * One department per category per property. The template seeds exactly one
     * of each and the backfill has to be safe to run twice; without this a
     * second run silently doubles every property's department list, and the
     * Rooms lookup a room charge does becomes ambiguous.
     */
    uniqueIndex('departments_property_category_uk')
      .on(t.propertyId, t.departmentCategory)
      .where(sql`${t.propertyId} IS NOT NULL`),
    check(
      'departments_revenue_center_is_operated',
      sql`${t.isRevenueCenter} = false OR ${t.departmentType} = 'operated'`,
    ),
  ],
);


/**
 * A named place inside a department (§14.2).
 *
 * So a hotel's three restaurants roll up to one Food and Beverage profit and
 * loss line. A charge may name an outlet, and always also names the parent
 * department, so departmental revenue never depends on outlets existing.
 */
export const outlets = pgTable(
  'outlets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    name: text('name').notNull(),
    outletKind: outletKindEnum('outlet_kind').notNull().default('other'),
    /** Service windows, e.g. `{"mon":["07:00","22:00"]}`. */
    hours: jsonb('hours'),
    sortOrder: integer('sort_order').notNull().default(0),
    status: departmentStatusEnum('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    index('outlets_department_idx').on(t.departmentId),
    index('outlets_workspace_idx').on(t.workspaceId),
  ],
);


/**
 * Who works in which department (§14.3, D17).
 *
 * This decides whose board a task appears on. It never decides what anybody may
 * do: permission scope stays on `org_memberships.org_role`, so a department
 * head with a receptionist's role still cannot move money.
 */
export const departmentMembers = pgTable(
  'department_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'cascade' }),
    orgMembershipId: uuid('org_membership_id')
      .notNull()
      .references(() => orgMemberships.id, { onDelete: 'cascade' }),
    /** Denormalized from the membership so a board query needs no join. */
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    departmentPosition: departmentPositionEnum('department_position')
      .notNull()
      .default('staff'),
    /** Free text ranks the enum deliberately omits: therapist, waiter, concierge. */
    jobTitles: jsonb('job_titles'),
    /** The staffer's home department, the one their shift board defaults to. */
    isPrimary: boolean('is_primary').notNull().default(false),
    status: departmentMemberStatusEnum('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    index('department_members_department_idx').on(t.departmentId),
    index('department_members_user_idx').on(t.userId),
    uniqueIndex('department_members_active_uk')
      .on(t.departmentId, t.userId)
      .where(sql`${t.status} = 'active'`),
  ],
);


// --- §14.5 the folio and its charges ---------------------------------------

/** Whose bill this is. `guest` is the only one this build opens. */
export const folioTypeEnum = pgEnum('folio_type', [
  'guest',
  'master',
  'group',
  'house',
]);


/**
 * `open -> settled -> closed`, and `settled -> disputed -> settled`.
 *
 * `settled` means the balance reached zero. `closed` means no further charge
 * may post. Voiding a charge on a settled folio moves it back to `open`,
 * because the balance is no longer zero.
 */
export const folioStatusEnum = pgEnum('folio_status', [
  'open',
  'settled',
  'closed',
  'disputed',
]);


/**
 * The ten typed lines a bill is made of (§14.5).
 *
 * Signed: charges positive, payments and discounts negative. The sign rule is
 * fixed here and a ledger entry inherits it, so departmental revenue is a plain
 * sum with no second convention to remember.
 */
export const chargeTypeEnum = pgEnum('charge_type', [
  'room',
  'service_order',
  'pos',
  'tax',
  'service_charge',
  'adjustment',
  'discount',
  'deposit',
  'payment',
  'refund',
]);


/**
 * A guest's running bill (§14.5, D13).
 *
 * Never created through the API. The system opens one: a pre-arrival folio when
 * a booking is confirmed, and check in binds it to the stay. A bill with no
 * subject is not a thing an operator should be able to make.
 */
export const folios = pgTable(
  'folios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * A short human code, generated like `bookings.reference`: random base32,
     * checked unique, never derived from a sequence. A sequential bill number
     * tells a competitor how many guests you had last month.
     */
    folioNumber: text('folio_number').notNull(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    guestStayId: uuid('guest_stay_id').references(() => guestStays.id),
    bookingId: uuid('booking_id').references(() => bookings.id),
    leaseId: uuid('lease_id').references(() => leases.id),
    /** Null for a walk in nobody has an account for yet. */
    guestUserId: uuid('guest_user_id').references(() => users.id),
    folioType: folioTypeEnum('folio_type').notNull().default('guest'),
    status: folioStatusEnum('status').notNull().default('open'),
    currency: currency(),
    /**
     * A derived cache of the sum of this folio's charges (D13, D-l).
     *
     * Recomputed from the sum under a row lock inside the charge's own
     * transaction, never incremented. Incrementing drifts permanently the first
     * time a write reaches the charges by another path, and a bill quietly
     * wrong by one line is very hard to notice.
     */
    balanceRwf: amount('balance_rwf').notNull().default(0),
    openedAt: timestamp('opened_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('folios_number_uk').on(t.folioNumber),
    index('folios_workspace_status_idx').on(t.workspaceId, t.status),
    index('folios_stay_idx').on(t.guestStayId),
    index('folios_booking_idx').on(t.bookingId),
    /**
     * ADR-016 correction 2 (D-k). §14 asked for "exactly one is set" AND for a
     * pre-arrival folio to bind to the stay at check in, which cannot both
     * hold: after check in a guest folio carries the booking AND the stay.
     *
     * So: at least one, and only for a `guest` folio. `master`, `group` and
     * `house` folios carry none of the three, which the strict check would have
     * made impossible.
     */
    check(
      'folios_guest_subject_at_least_one',
      sql`${t.folioType} <> 'guest'
           OR ${t.guestStayId} IS NOT NULL
           OR ${t.bookingId} IS NOT NULL
           OR ${t.leaseId} IS NOT NULL`,
    ),
    /** A folio never closes owing money. */
    check(
      'folios_closed_is_zero',
      sql`${t.status} <> 'closed' OR ${t.balanceRwf} = 0`,
    ),
  ],
);


/**
 * Append only charge lines (§14.5, D13, D-j).
 *
 * A row here is NEVER updated or deleted. Voiding posts a second, negative row
 * naming the first through `source_ref_id`, so history shows the mistake and
 * the correction rather than hiding both. There is no `is_void` column: §14 had
 * one and it contradicted its own "never a mutation" rule, which is ADR-016
 * correction 1.
 *
 * A charge log that can be edited after the fact is worth nothing in a dispute,
 * and this is the document a Rwandan tax invoice is cut from.
 */
export const folioCharges = pgTable(
  'folio_charges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    folioId: uuid('folio_id')
      .notNull()
      .references(() => folios.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    /**
     * Required on a revenue charge, and that department must be a revenue
     * centre (AC-1). Nullable in the column because a payment, a deposit and a
     * tax line credit no department at all; the service refuses a revenue
     * charge without one, which a CHECK cannot do because it would have to
     * subquery `departments`.
     */
    departmentId: uuid('department_id').references(() => departments.id),
    outletId: uuid('outlet_id').references(() => outlets.id),
    chargeType: chargeTypeEnum('charge_type').notNull(),
    description: text('description'),
    quantity: integer('quantity').notNull().default(1),
    unitPriceRwf: amount('unit_price_rwf'),
    /** Signed, and TAX EXCLUSIVE (D-n). Tax is its own line, never folded in. */
    amountRwf: amount('amount_rwf').notNull(),
    currency: currency(),
    taxCode: taxCodeEnum('tax_code'),
    /**
     * Snapshotted from `config_entries` at post time (AC-5, D-m). A later rate
     * change never re-prices a posted charge, which is the whole reason the
     * rate is copied here instead of joined at read time.
     */
    taxRate: numeric('tax_rate'),
    /** What the separate `tax` line raised from this one. */
    taxAmountRwf: amount('tax_amount_rwf'),
    /**
     * Where this line came from: `manual`, `night_audit`, `service_order`,
     * `external_pos`, `ebm_invoice`, or `void` for a reversing line, which
     * names the charge it reverses in `source_ref_id`.
     *
     * Text rather than an enum because §14 keeps it open for the Open API
     * seams (D22) that have not been decided yet.
     */
    sourceRefType: text('source_ref_type'),
    sourceRefId: uuid('source_ref_id'),
    /** Null means the system posted it: the night audit, or an order fulfilment. */
    postedByUserId: uuid('posted_by_user_id').references(() => users.id),
    /**
     * The property's business date this line belongs to.
     *
     * Set by the night audit for a room charge, which is the only use the
     * decision names a source for, and what the unique index below counts. A
     * manual charge leaves it null rather than having a date invented for it.
     */
    businessDate: date('business_date'),
    /**
     * Stored as `${workspaceId}:${clientKey}`, because this column is globally
     * unique and a client generated key is not: two properties could pick the
     * same UUID and the second would silently receive the first one's result.
     */
    idempotencyKey: text('idempotency_key'),
    postedAt: timestamp('posted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('folio_charges_folio_idx').on(t.folioId, t.postedAt),
    index('folio_charges_department_idx').on(t.departmentId),
    index('folio_charges_source_idx').on(t.sourceRefType, t.sourceRefId),
    unique('folio_charges_idempotency_key_uk').on(t.idempotencyKey),
    /**
     * One room charge per folio per night (AC-15). The night audit is a job and
     * a job runs twice; without this, a rerun bills the guest for the same
     * night again and the second charge looks exactly as legitimate as the
     * first.
     *
     * A reversing line is excluded, because voiding a night charge posts a
     * second `room` row for the same date and the index would refuse the
     * correction.
     */
    uniqueIndex('folio_charges_room_night_uk')
      .on(t.folioId, t.businessDate)
      .where(
        sql`${t.chargeType} = 'room'
             AND ${t.businessDate} IS NOT NULL
             AND ${t.sourceRefType} IS DISTINCT FROM 'void'`,
      ),
  ],
);


// --- room assignment (ADR-016 D-g, new here, not in §14) -------------------

/**
 * A Postgres `daterange`, half open: `[check_in, check_out)`.
 *
 * Half open matters. A departure on the morning of the 5th does not collide
 * with an arrival that afternoon, which a closed range would refuse.
 */
const daterange = customType<{ data: string; driverData: string }>({
  dataType: () => 'daterange',
});


/**
 * Terminal. A move writes a new row rather than reopening a released one, so
 * the history of who was where survives the move.
 */
export const roomAssignmentStatusEnum = pgEnum('room_assignment_status', [
  'assigned',
  'released',
]);


/**
 * A room held for a booking over a date range (ADR-016 D-g, D-h).
 *
 * A booking names a room TYPE, never a physical room, which is correct: the
 * guest bought "a Standard Double", not room 101. A room becomes concrete at
 * check in. But a front desk assigns rooms the afternoon before, and until this
 * table there was no column anywhere that held that.
 *
 * A nullable `rooms` column on `bookings` was the obvious alternative and it
 * cannot express a SPLIT STAY: a guest in 101 for two nights and 205 for the
 * third has two assignments and one booking.
 *
 * THE HOLD RUNS TO CHECKOUT, NOT TO CHECK IN (D-h). Releasing at check in looks
 * tidy and defeats the very requirement that justified the table: the moment
 * the guest walks into 101, the second leg of their split stay in 205 would
 * stop being held and anyone could take it.
 *
 * Occupancy is untouched by this and stays derived from `guest_stays` (D15). A
 * hold and an occupancy are two different facts about the same room.
 */
export const roomAssignments = pgTable(
  'room_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    /** `[check_in, check_out)`. The half open range the constraint compares. */
    occupies: daterange('occupies').notNull(),
    status: roomAssignmentStatusEnum('status').notNull().default('assigned'),
    assignedByUserId: uuid('assigned_by_user_id').references(() => users.id),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('room_assignments_booking_idx').on(t.bookingId),
    index('room_assignments_room_idx').on(t.roomId),
    index('room_assignments_workspace_idx').on(t.workspaceId),
    /**
     * An empty range overlaps nothing, so a same day range would slip past the
     * exclusion constraint entirely and two guests would both hold the room.
     * This check matters more than it looks.
     */
    check('room_assignments_range_not_empty', sql`NOT isempty(${t.occupies})`),
    check(
      'room_assignments_released_shape',
      sql`(${t.status} = 'released') = (${t.releasedAt} IS NOT NULL)`,
    ),
    // The GiST exclusion constraint that refuses an overlapping hold lives in
    // migration 0014 by hand: drizzle-kit has no EXCLUDE, so it cannot appear
    // here. It is `EXCLUDE USING gist (room_id WITH =, occupies WITH &&)
    // WHERE (status = 'assigned')`, and AC-6 is proven against the database
    // rather than against this file.
  ],
);


// --- §14.4 the housekeeping queue ------------------------------------------

export const housekeepingTaskTypeEnum = pgEnum('housekeeping_task_type', [
  'checkout_clean',
  'stayover_clean',
  'inspection',
  'deep_clean',
  'turndown',
]);


/**
 * `pending -> in_progress -> done -> inspected`, and any state to `blocked`
 * (it needs maintenance) and back to `pending`.
 */
export const housekeepingTaskStatusEnum = pgEnum('housekeeping_task_status', [
  'pending',
  'in_progress',
  'done',
  'inspected',
  'blocked',
]);


/**
 * The cleaning queue behind the housekeeper's phone (§14.4).
 *
 * `assigned_to_user_id` is optional on purpose: a department can run an
 * unassigned pull queue, where whoever is free takes the next room. Assigning
 * every task up front is a supervisor's job that nobody has time for.
 *
 * Checkout writes `rooms.housekeeping_status = 'dirty'` AND inserts a pending
 * `checkout_clean` here in the SAME transaction. Two separate calls mean a
 * dropped connection between them loses the second, and housekeeping then walks
 * past a room that needs them.
 */
export const housekeepingTasks = pgTable(
  'housekeeping_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    /** The Rooms department, which is where housekeeping sits under USALI. */
    departmentId: uuid('department_id').references(() => departments.id),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    /** The stay whose checkout triggered a `checkout_clean`, when one did. */
    guestStayId: uuid('guest_stay_id').references(() => guestStays.id),
    taskType: housekeepingTaskTypeEnum('task_type').notNull(),
    status: housekeepingTaskStatusEnum('status').notNull().default('pending'),
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id),
    priority: integer('priority').notNull().default(0),
    note: text('note'),
    /**
     * So the offline phone app can replay a "mark clean" safely (F-P10).
     * Stored `${workspaceId}:${clientKey}` for the same reason the folio does:
     * the column is globally unique and a client key is not.
     */
    idempotencyKey: text('idempotency_key'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('housekeeping_tasks_queue_idx').on(
      t.propertyId,
      t.status,
      t.priority,
    ),
    index('housekeeping_tasks_room_idx').on(t.roomId),
    index('housekeeping_tasks_assignee_idx').on(t.assignedToUserId),
    unique('housekeeping_tasks_idempotency_key_uk').on(t.idempotencyKey),
    /**
     * One open checkout clean per stay. A checkout that runs twice (a double
     * click, a retry) must not put the same room on the board twice, and the
     * queue is the screen where a duplicate is most obvious and most annoying.
     */
    uniqueIndex('housekeeping_tasks_checkout_clean_uk')
      .on(t.guestStayId)
      .where(
        sql`${t.taskType} = 'checkout_clean' AND ${t.guestStayId} IS NOT NULL`,
      ),
  ],
);


// --- §14.6 and §14.7 the service catalog and its orders --------------------

export const serviceCatalogStatusEnum = pgEnum('service_catalog_status', [
  'active',
  'out_of_stock',
  'archived',
]);


export const fulfillmentTypeEnum = pgEnum('fulfillment_type', [
  'in_room_delivery',
  'pickup',
  'appointment',
  'onsite',
  'instant',
]);


export const serviceOrderChannelEnum = pgEnum('service_order_channel', [
  'guest_app',
  'in_room_device',
  'front_desk',
  'staff',
  'api',
]);


/**
 * `submitted -> acknowledged -> in_progress -> ready -> delivered -> completed`,
 * plus `submitted -> rejected`, and anything before `delivered` to `cancelled`.
 */
export const serviceOrderStatusEnum = pgEnum('service_order_status', [
  'submitted',
  'acknowledged',
  'in_progress',
  'ready',
  'delivered',
  'completed',
  'cancelled',
  'rejected',
]);


/** Groups items within a department or outlet. `guest_visible` gates the app. */
export const serviceCategories = pgTable(
  'service_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'cascade' }),
    outletId: uuid('outlet_id').references(() => outlets.id, {
      onDelete: 'set null',
    }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    guestVisible: boolean('guest_visible').notNull().default(true),
    status: departmentStatusEnum('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    index('service_categories_department_idx').on(t.departmentId),
    index('service_categories_workspace_idx').on(t.workspaceId),
  ],
);


/**
 * A priced, tax coded, orderable thing (§14.6).
 *
 * Because an item carries its own department and tax code, an order posts to
 * the right department and the right folio line with the right tax and nobody
 * has to be asked. Editing an item never rewrites a placed order: the order
 * snapshots name, price and tax at order time (D8).
 */
export const serviceItems = pgTable(
  'service_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serviceCategoryId: uuid('service_category_id')
      .notNull()
      .references(() => serviceCategories.id, { onDelete: 'cascade' }),
    /** Denormalized from the category so a charge needs no join to attribute. */
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id),
    outletId: uuid('outlet_id').references(() => outlets.id, {
      onDelete: 'set null',
    }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    name: text('name').notNull(),
    description: text('description'),
    photoObjectKeys: jsonb('photo_object_keys'),
    priceRwf: amount('price_rwf').notNull(),
    currency: currency(),
    taxCode: taxCodeEnum('tax_code').notNull().default('TAX_B'),
    fulfillmentType: fulfillmentTypeEnum('fulfillment_type')
      .notNull()
      .default('in_room_delivery'),
    prepTimeMinutes: integer('prep_time_minutes'),
    /** Size, extras, modifiers. */
    options: jsonb('options'),
    /** Hours and days this item can be ordered. */
    availability: jsonb('availability'),
    guestOrderable: boolean('guest_orderable').notNull().default(true),
    /** Null means unlimited, which is the normal case for a service. */
    stockQty: integer('stock_qty'),
    status: serviceCatalogStatusEnum('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    index('service_items_category_idx').on(t.serviceCategoryId),
    index('service_items_department_idx').on(t.departmentId),
    index('service_items_workspace_idx').on(t.workspaceId),
  ],
);


/**
 * A guest request routed to a department (§14.7).
 *
 * Routing is to the DEPARTMENT, never to a person (D14). Whoever is on that
 * department's board answers, which is why a shift change does not strand an
 * order.
 *
 * On `delivered` or `completed` the order posts one `folio_charges` line in the
 * same transaction, so the single folio invariant holds without a sweep.
 */
export const serviceOrders = pgTable(
  'service_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderNumber: text('order_number').notNull(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id),
    outletId: uuid('outlet_id').references(() => outlets.id, {
      onDelete: 'set null',
    }),
    /** The bill this order charges when it is fulfilled. */
    folioId: uuid('folio_id').references(() => folios.id),
    guestStayId: uuid('guest_stay_id').references(() => guestStays.id),
    bookingId: uuid('booking_id').references(() => bookings.id),
    orderedByUserId: uuid('ordered_by_user_id').references(() => users.id),
    /** Where it is delivered, when it is delivered anywhere. */
    roomId: uuid('room_id').references(() => rooms.id),
    channel: serviceOrderChannelEnum('channel').notNull().default('front_desk'),
    status: serviceOrderStatusEnum('status').notNull().default('submitted'),
    fulfillmentType: fulfillmentTypeEnum('fulfillment_type')
      .notNull()
      .default('in_room_delivery'),
    requestedForAt: timestamp('requested_for_at', { withTimezone: true }),
    subtotalRwf: amount('subtotal_rwf').notNull().default(0),
    taxRwf: amount('tax_rwf').notNull().default(0),
    totalRwf: amount('total_rwf').notNull().default(0),
    currency: currency(),
    guestNote: text('guest_note'),
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id),
    /** `${workspaceId}:${clientKey}`, as everywhere else in this layer. */
    idempotencyKey: text('idempotency_key'),
    ...timestamps,
  },
  (t) => [
    unique('service_orders_number_uk').on(t.orderNumber),
    unique('service_orders_idempotency_key_uk').on(t.idempotencyKey),
    index('service_orders_board_idx').on(t.departmentId, t.status),
    index('service_orders_workspace_idx').on(t.workspaceId),
    index('service_orders_folio_idx').on(t.folioId),
  ],
);


/** Locked at order time (D8), so editing the menu never rewrites an order. */
export const serviceOrderItems = pgTable(
  'service_order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serviceOrderId: uuid('service_order_id')
      .notNull()
      .references(() => serviceOrders.id, { onDelete: 'cascade' }),
    serviceItemId: uuid('service_item_id').references(() => serviceItems.id),
    nameSnapshot: text('name_snapshot').notNull(),
    quantity: integer('quantity').notNull().default(1),
    unitPriceRwf: amount('unit_price_rwf').notNull(),
    selectedOptions: jsonb('selected_options'),
    lineTotalRwf: amount('line_total_rwf').notNull(),
    taxCode: taxCodeEnum('tax_code'),
    taxRate: numeric('tax_rate'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('service_order_items_order_idx').on(t.serviceOrderId)],
);


/** The append only status trail behind the department kanban board. */
export const serviceOrderEvents = pgTable(
  'service_order_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serviceOrderId: uuid('service_order_id')
      .notNull()
      .references(() => serviceOrders.id, { onDelete: 'cascade' }),
    status: serviceOrderStatusEnum('status').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    note: text('note'),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('service_order_events_order_idx').on(t.serviceOrderId)],
);
