/**
 * THE BAR AND RESTAURANT POINT OF SALE (POS spec, phase 1).
 *
 * Tables and their sessions, orders taken at a table or the counter, the
 * kitchen and bar tickets they send, payments (several per order, every
 * provider SIMULATED), and the cashier's register, shift and cash movements.
 *
 * WHY A POS ORDER IS NOT A `service_orders` ROW. A service order is a guest
 * request routed to a department: it posts to a folio on delivery, or settles
 * first and raises its own EBM receipt, and the department boards, the folio
 * and the EBM trigger all read it. A table's order is a different life:
 * drafted, sent in rounds to stations, split, transferred, paid in parts. So
 * it lives here, over the SAME menu (`service_items`), outlets and branches,
 * and nothing the hotel already runs reads or writes these tables.
 *
 * THE RULES THE DATABASE HOLDS:
 * 1. One open session per table, one open shift per register and per cashier
 *    (partial unique indexes).
 * 2. A dine in order sits at a table session; nothing else does (check).
 * 3. A cancelled order, a voided line, a closed shift and a decided approval
 *    carry what made them so (checks).
 * 4. A payment, a refund and an order carry a unique idempotency key, and a
 *    line is sent to the kitchen once (`kitchen_ticket_items` unique on line):
 *    a retried request can never pay, refund or cook twice.
 * 5. A reprint is a new `pos_print_jobs` row with the next copy number, and
 *    nothing else: it never makes an order or a ticket.
 *
 * Money is whole RWF (`amount`), with `currency` beside it. Every row carries
 * `workspace_id`, and the branch (`property_id`) where scope needs it, so a
 * repository filters by the same branch scope as every other ops read.
 *
 * IMPORT RULE. A leaf over operations, inventory, org and auth: nothing
 * imports it back, so it is exported last from `schema.ts`.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { amount, currency, timestamps } from './columns';
import { taxCodeEnum } from './enums';
import { properties } from './inventory';
import { outlets, serviceItems } from './operations';
import { orgs, workspaces } from './org';

// --- Vocabulary (mirrors `@injishi/contracts` pos.ts) -----------------------

export const posOrderTypeEnum = pgEnum('pos_order_type', [
  'dine_in',
  'takeaway',
  'delivery',
  'room_service',
  'event',
]);

export const posTaxModeEnum = pgEnum('pos_tax_mode', ['exclusive', 'inclusive']);

export const restaurantTableStatusEnum = pgEnum('restaurant_table_status', [
  'available',
  'occupied',
  'reserved',
  'bill_requested',
  'cleaning',
]);

export const tableSessionStatusEnum = pgEnum('table_session_status', ['open', 'closed']);

export const posStationKindEnum = pgEnum('pos_station_kind', ['kitchen', 'bar']);

export const posOrderStatusEnum = pgEnum('pos_order_status', [
  'draft',
  'submitted',
  'in_progress',
  'ready',
  'delivered',
  'completed',
  'cancelled',
]);

export const posLineStatusEnum = pgEnum('pos_line_status', ['draft', 'sent', 'voided']);

export const kitchenTicketStatusEnum = pgEnum('kitchen_ticket_status', [
  'queued',
  'preparing',
  'ready',
  'served',
  'cancelled',
]);

export const posPaymentMethodEnum = pgEnum('pos_payment_method', [
  'cash',
  'mtn_momo',
  'airtel_money',
  'card',
  'bank_transfer',
  'voucher',
  'customer_credit',
]);

export const posPaymentStatusEnum = pgEnum('pos_payment_status', [
  'initiated',
  'pending',
  'successful',
  'failed',
  'cancelled',
  'expired',
  'refunded',
]);

export const cashierShiftStatusEnum = pgEnum('cashier_shift_status', ['open', 'closed', 'reviewed']);

export const cashMovementKindEnum = pgEnum('cash_movement_kind', ['paid_in', 'paid_out']);

export const posApprovalStatusEnum = pgEnum('pos_approval_status', [
  'approved',
  'pending_approval',
  'rejected',
]);

export const posDiscountKindEnum = pgEnum('pos_discount_kind', ['amount', 'percent']);

export const posPrintKindEnum = pgEnum('pos_print_kind', ['kitchen_ticket', 'bill', 'receipt']);

// --- Outlet settings ---------------------------------------------------------

/**
 * How one outlet sells. A row is written the first time anyone reads the
 * outlet's POS, with the defaults below, so a missing row never means
 * "anything goes".
 */
export const posOutletSettings = pgTable('pos_outlet_settings', {
  outletId: uuid('outlet_id')
    .primaryKey()
    .references(() => outlets.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  taxMode: posTaxModeEnum('tax_mode').notNull().default('exclusive'),
  /** The largest discount a `pos.discount` holder gives alone, in basis points of the gross. */
  discountLimitBps: integer('discount_limit_bps').notNull().default(1000),
  enabledMethods: posPaymentMethodEnum('enabled_methods')
    .array()
    .notNull()
    .default(sql`'{cash,mtn_momo,airtel_money,card}'::pos_payment_method[]`),
  receiptHeader: text('receipt_header').notNull().default(''),
  receiptFooter: text('receipt_footer').notNull().default(''),
  ...timestamps,
}, (t) => [
  check(
    'pos_outlet_settings_discount_limit_range',
    sql`${t.discountLimitBps} >= 0 AND ${t.discountLimitBps} <= 10000`,
  ),
]);

// --- The floor ---------------------------------------------------------------

export const diningAreas = pgTable(
  'dining_areas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [unique('dining_areas_outlet_name_uk').on(t.outletId, t.name)],
);

/**
 * A table. Its `status` is the floor's current picture; who sits there is the
 * open `table_sessions` row, never the table itself, and an order belongs to
 * the session.
 */
export const restaurantTables = pgTable(
  'restaurant_tables',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'cascade' }),
    areaId: uuid('area_id')
      .notNull()
      .references(() => diningAreas.id),
    label: text('label').notNull(),
    seats: smallint('seats').notNull(),
    status: restaurantTableStatusEnum('status').notNull().default('available'),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('restaurant_tables_outlet_label_uk').on(t.outletId, t.label),
    index('restaurant_tables_area_idx').on(t.areaId),
    check('restaurant_tables_seats_range', sql`${t.seats} >= 1 AND ${t.seats} <= 100`),
  ],
);

/** One sitting at one table: opened when guests sit, closed when the table is released. */
export const tableSessions = pgTable(
  'table_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'cascade' }),
    tableId: uuid('table_id')
      .notNull()
      .references(() => restaurantTables.id),
    status: tableSessionStatusEnum('status').notNull().default('open'),
    guestCount: smallint('guest_count').notNull(),
    waiterUserId: uuid('waiter_user_id').references(() => users.id),
    openedByUserId: uuid('opened_by_user_id')
      .notNull()
      .references(() => users.id),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedByUserId: uuid('closed_by_user_id').references(() => users.id),
    /** Set when another session took this one's orders (a merge). */
    mergedIntoSessionId: uuid('merged_into_session_id'),
  },
  (t) => [
    uniqueIndex('table_sessions_one_open_uk')
      .on(t.tableId)
      .where(sql`${t.status} = 'open'`),
    index('table_sessions_outlet_idx').on(t.outletId, t.status),
    check(
      'table_sessions_closed_shape',
      sql`(${t.status} = 'closed') = (${t.closedAt} IS NOT NULL AND ${t.closedByUserId} IS NOT NULL)`,
    ),
    check('table_sessions_guest_range', sql`${t.guestCount} >= 1 AND ${t.guestCount} <= 200`),
  ],
);

// --- Stations and routing ----------------------------------------------------

export const preparationStations = pgTable(
  'preparation_stations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kind: posStationKindEnum('kind').notNull(),
    /** A SIMULATED printer: the name a print job is addressed to. No device is contacted. */
    printerName: text('printer_name'),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [unique('preparation_stations_outlet_name_uk').on(t.outletId, t.name)],
);

/** Which station makes a menu item. An item with no route sends no ticket (a bottle handed over the counter). */
export const posItemRoutes = pgTable('pos_item_routes', {
  serviceItemId: uuid('service_item_id')
    .primaryKey()
    .references(() => serviceItems.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  stationId: uuid('station_id')
    .notNull()
    .references(() => preparationStations.id, { onDelete: 'cascade' }),
});

// --- Orders --------------------------------------------------------------------

/**
 * A POS order. Its totals are recomputed by the service from its lines and
 * approved discounts on every change (`orderAmounts` in contracts), never
 * typed. `tax_mode` is copied from the outlet's settings at creation, so a
 * change of setting never reprices an open bill.
 *
 * Payment state is NOT a column: it is derived from `pos_payments`
 * (`settlementOf`). `settled_at` records the instant it first settled.
 */
export const posOrders = pgTable(
  'pos_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id),
    /** The branch, copied from the outlet. Null for a standalone outlet. */
    propertyId: uuid('property_id').references(() => properties.id),
    /** Whose TIN a later fiscal document is issued under, copied from the outlet (ADR-050 contract 1). */
    taxEntityOrgId: uuid('tax_entity_org_id')
      .notNull()
      .references(() => orgs.id),
    orderNumber: text('order_number').notNull(),
    orderType: posOrderTypeEnum('order_type').notNull(),
    status: posOrderStatusEnum('status').notNull().default('draft'),
    tableSessionId: uuid('table_session_id').references(() => tableSessions.id),
    waiterUserId: uuid('waiter_user_id').references(() => users.id),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    guestNote: text('guest_note'),
    taxMode: posTaxModeEnum('tax_mode').notNull(),
    grossRwf: amount('gross_rwf').notNull().default(0),
    discountRwf: amount('discount_rwf').notNull().default(0),
    taxRwf: amount('tax_rwf').notNull().default(0),
    totalRwf: amount('total_rwf').notNull().default(0),
    currency: currency(),
    /** The order a split took these lines from. */
    splitFromOrderId: uuid('split_from_order_id'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByUserId: uuid('cancelled_by_user_id').references(() => users.id),
    cancelReason: text('cancel_reason'),
    /** `${workspaceId}:${clientKey}`, as everywhere else in this layer. */
    idempotencyKey: text('idempotency_key'),
    ...timestamps,
  },
  (t) => [
    unique('pos_orders_workspace_number_uk').on(t.workspaceId, t.orderNumber),
    unique('pos_orders_idempotency_key_uk').on(t.idempotencyKey),
    index('pos_orders_outlet_status_idx').on(t.outletId, t.status),
    index('pos_orders_session_idx').on(t.tableSessionId),
    index('pos_orders_workspace_created_idx').on(t.workspaceId, t.createdAt),
    check(
      'pos_orders_table_shape',
      sql`(${t.orderType} = 'dine_in') = (${t.tableSessionId} IS NOT NULL)`,
    ),
    check(
      'pos_orders_cancel_shape',
      sql`(${t.status} = 'cancelled') = (${t.cancelledAt} IS NOT NULL AND ${t.cancelledByUserId} IS NOT NULL AND ${t.cancelReason} IS NOT NULL)`,
    ),
    check(
      'pos_orders_amounts_nonnegative',
      sql`${t.grossRwf} >= 0 AND ${t.discountRwf} >= 0 AND ${t.taxRwf} >= 0 AND ${t.totalRwf} >= 0`,
    ),
  ],
);

/** A line, locked at the moment it is added: name, item code, price, options and tax (spec §5). */
export const posOrderLines = pgTable(
  'pos_order_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    orderId: uuid('order_id')
      .notNull()
      .references(() => posOrders.id, { onDelete: 'cascade' }),
    serviceItemId: uuid('service_item_id').references(() => serviceItems.id),
    nameSnapshot: text('name_snapshot').notNull(),
    /** The item's code at the time: `service_items.rra_item_cd`. */
    skuSnapshot: text('sku_snapshot'),
    quantity: integer('quantity').notNull(),
    unitPriceRwf: amount('unit_price_rwf').notNull(),
    selectedOptions: jsonb('selected_options').notNull().default(sql`'[]'::jsonb`),
    note: text('note'),
    status: posLineStatusEnum('status').notNull().default('draft'),
    taxCode: taxCodeEnum('tax_code').notNull(),
    taxRateBps: integer('tax_rate_bps').notNull(),
    /** Approved discounts on this line alone. */
    lineDiscountRwf: amount('line_discount_rwf').notNull().default(0),
    /** This line's share of the order's approved discounts. */
    orderDiscountShareRwf: amount('order_discount_share_rwf').notNull().default(0),
    grossRwf: amount('gross_rwf').notNull(),
    discountRwf: amount('discount_rwf').notNull().default(0),
    taxRwf: amount('tax_rwf').notNull(),
    totalRwf: amount('total_rwf').notNull(),
    /** The station it went to when sent, copied from the route then. */
    stationId: uuid('station_id').references(() => preparationStations.id),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedByUserId: uuid('voided_by_user_id').references(() => users.id),
    voidReason: text('void_reason'),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index('pos_order_lines_order_idx').on(t.orderId),
    check('pos_order_lines_quantity_range', sql`${t.quantity} >= 1 AND ${t.quantity} <= 500`),
    check(
      'pos_order_lines_void_shape',
      sql`(${t.status} = 'voided') = (${t.voidedAt} IS NOT NULL AND ${t.voidedByUserId} IS NOT NULL AND ${t.voidReason} IS NOT NULL)`,
    ),
    check(
      'pos_order_lines_sent_shape',
      sql`${t.status} = 'draft' OR ${t.sentAt} IS NOT NULL OR ${t.status} = 'voided'`,
    ),
    check(
      'pos_order_lines_amounts',
      sql`${t.unitPriceRwf} >= 0 AND ${t.discountRwf} >= 0 AND ${t.discountRwf} <= ${t.grossRwf} AND ${t.taxRwf} >= 0`,
    ),
  ],
);

/** A discount asked for, with its reason, and who approved it when it was over the limit. */
export const posOrderDiscounts = pgTable(
  'pos_order_discounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    orderId: uuid('order_id')
      .notNull()
      .references(() => posOrders.id, { onDelete: 'cascade' }),
    /** A line, or null for the whole order. */
    orderLineId: uuid('order_line_id').references(() => posOrderLines.id, { onDelete: 'cascade' }),
    kind: posDiscountKindEnum('kind').notNull(),
    /** RWF for `amount`, basis points for `percent`. */
    value: integer('value').notNull(),
    /** What it takes off, fixed when asked for. */
    amountRwf: amount('amount_rwf').notNull(),
    reason: text('reason').notNull(),
    status: posApprovalStatusEnum('status').notNull(),
    requestedByUserId: uuid('requested_by_user_id')
      .notNull()
      .references(() => users.id),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: text('decision_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('pos_order_discounts_order_idx').on(t.orderId),
    check('pos_order_discounts_amount_positive', sql`${t.amountRwf} > 0 AND ${t.value} > 0`),
    check(
      'pos_order_discounts_decided_shape',
      sql`(${t.status} = 'pending_approval') = (${t.decidedAt} IS NULL)`,
    ),
  ],
);

/** The order's append only history: created, lines, rounds sent, voids, transfers, splits, settlement. */
export const posOrderEvents = pgTable(
  'pos_order_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => posOrders.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    fromStatus: posOrderStatusEnum('from_status'),
    toStatus: posOrderStatusEnum('to_status'),
    data: jsonb('data'),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('pos_order_events_order_idx').on(t.orderId, t.occurredAt)],
);

// --- Kitchen and bar -----------------------------------------------------------

/**
 * One station's share of one round sent from an order. Sending an order makes
 * one ticket per station its draft lines route to; sending again later makes
 * a new round. A reprint never makes a ticket.
 */
export const kitchenTickets = pgTable(
  'kitchen_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id),
    orderId: uuid('order_id')
      .notNull()
      .references(() => posOrders.id, { onDelete: 'cascade' }),
    stationId: uuid('station_id')
      .notNull()
      .references(() => preparationStations.id),
    ticketNumber: text('ticket_number').notNull(),
    round: smallint('round').notNull(),
    status: kitchenTicketStatusEnum('status').notNull().default('queued'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    readyAt: timestamp('ready_at', { withTimezone: true }),
    servedAt: timestamp('served_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  },
  (t) => [
    unique('kitchen_tickets_order_station_round_uk').on(t.orderId, t.stationId, t.round),
    unique('kitchen_tickets_workspace_number_uk').on(t.workspaceId, t.ticketNumber),
    index('kitchen_tickets_station_status_idx').on(t.stationId, t.status),
  ],
);

export const kitchenTicketItems = pgTable(
  'kitchen_ticket_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => kitchenTickets.id, { onDelete: 'cascade' }),
    orderLineId: uuid('order_line_id')
      .notNull()
      .references(() => posOrderLines.id, { onDelete: 'cascade' }),
    status: kitchenTicketStatusEnum('status').notNull().default('queued'),
    quantity: integer('quantity').notNull(),
    name: text('name').notNull(),
    options: text('options').array().notNull().default(sql`'{}'::text[]`),
    note: text('note'),
  },
  (t) => [
    /** A line is cooked once: sending twice cannot put it on a second ticket. */
    unique('kitchen_ticket_items_line_uk').on(t.orderLineId),
    index('kitchen_ticket_items_ticket_idx').on(t.ticketId),
  ],
);

/** Every status a ticket or one of its items took, and who moved it (the item status history). */
export const kitchenTicketEvents = pgTable(
  'kitchen_ticket_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => kitchenTickets.id, { onDelete: 'cascade' }),
    ticketItemId: uuid('ticket_item_id').references(() => kitchenTicketItems.id, { onDelete: 'cascade' }),
    fromStatus: kitchenTicketStatusEnum('from_status'),
    toStatus: kitchenTicketStatusEnum('to_status').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('kitchen_ticket_events_ticket_idx').on(t.ticketId, t.occurredAt)],
);

/** A SIMULATED print. Copy 1 is the original; every reprint is the next copy of the same document. */
export const posPrintJobs = pgTable(
  'pos_print_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id),
    stationId: uuid('station_id').references(() => preparationStations.id),
    kind: posPrintKindEnum('kind').notNull(),
    /** The ticket or the order printed. */
    sourceId: uuid('source_id').notNull(),
    copyNumber: smallint('copy_number').notNull(),
    printerName: text('printer_name'),
    payload: jsonb('payload').notNull(),
    requestedByUserId: uuid('requested_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('pos_print_jobs_copy_uk').on(t.kind, t.sourceId, t.copyNumber),
    index('pos_print_jobs_outlet_idx').on(t.outletId, t.createdAt),
  ],
);

// --- Registers, shifts and cash --------------------------------------------------

export const posRegisters = pgTable(
  'pos_registers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    deviceLabel: text('device_label'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [unique('pos_registers_outlet_name_uk').on(t.outletId, t.name)],
);

/**
 * A cashier's shift at one register. At close, the expected cash, the counted
 * cash and the variance are FROZEN here, so a refund recorded tomorrow cannot
 * rewrite what the drawer was expected to hold tonight.
 */
export const cashierShifts = pgTable(
  'cashier_shifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id),
    registerId: uuid('register_id')
      .notNull()
      .references(() => posRegisters.id),
    cashierUserId: uuid('cashier_user_id')
      .notNull()
      .references(() => users.id),
    status: cashierShiftStatusEnum('status').notNull().default('open'),
    openingFloatRwf: amount('opening_float_rwf').notNull(),
    currency: currency(),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    expectedCashRwf: amount('expected_cash_rwf'),
    countedCashRwf: amount('counted_cash_rwf'),
    varianceRwf: amount('variance_rwf'),
    closeNote: text('close_note'),
    handoverNote: text('handover_note'),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNote: text('review_note'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('cashier_shifts_one_open_per_register_uk')
      .on(t.registerId)
      .where(sql`${t.status} = 'open'`),
    uniqueIndex('cashier_shifts_one_open_per_cashier_uk')
      .on(t.workspaceId, t.cashierUserId)
      .where(sql`${t.status} = 'open'`),
    index('cashier_shifts_outlet_idx').on(t.outletId, t.openedAt),
    check('cashier_shifts_float_nonnegative', sql`${t.openingFloatRwf} >= 0`),
    check(
      'cashier_shifts_closed_shape',
      sql`(${t.status} = 'open') = (${t.closedAt} IS NULL)
          AND (${t.status} = 'open' OR (${t.expectedCashRwf} IS NOT NULL AND ${t.countedCashRwf} IS NOT NULL AND ${t.varianceRwf} IS NOT NULL))
          AND (${t.status} = 'reviewed') = (${t.reviewedAt} IS NOT NULL AND ${t.reviewedByUserId} IS NOT NULL)`,
    ),
  ],
);

/** Cash into or out of the drawer that is not a sale. A paid out waits for `shift.review` unless its author holds it. */
export const cashMovements = pgTable(
  'cash_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    shiftId: uuid('shift_id')
      .notNull()
      .references(() => cashierShifts.id),
    kind: cashMovementKindEnum('kind').notNull(),
    amountRwf: amount('amount_rwf').notNull(),
    currency: currency(),
    reason: text('reason').notNull(),
    status: posApprovalStatusEnum('status').notNull(),
    requestedByUserId: uuid('requested_by_user_id')
      .notNull()
      .references(() => users.id),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('cash_movements_shift_idx').on(t.shiftId),
    check('cash_movements_amount_positive', sql`${t.amountRwf} > 0`),
    check(
      'cash_movements_decided_shape',
      sql`(${t.status} = 'pending_approval') = (${t.decidedAt} IS NULL)`,
    ),
  ],
);

// --- Payments ------------------------------------------------------------------

/**
 * One payment toward one order. SIMULATED for every provider: `demo_reference`
 * is minted here (`DEMO-MOMO-…`), no provider is contacted, and `simulated` is
 * true for every method but cash. A screenshot or a typed reference is never
 * a payment: only this row's status is.
 */
export const posPayments = pgTable(
  'pos_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id),
    orderId: uuid('order_id')
      .notNull()
      .references(() => posOrders.id),
    /** The cashier shift it was taken in, which is whose drawer cash lands in. */
    shiftId: uuid('shift_id').references(() => cashierShifts.id),
    method: posPaymentMethodEnum('method').notNull(),
    amountRwf: amount('amount_rwf').notNull(),
    currency: currency(),
    tenderedRwf: amount('tendered_rwf'),
    changeRwf: amount('change_rwf').notNull().default(0),
    tipRwf: amount('tip_rwf').notNull().default(0),
    refundedRwf: amount('refunded_rwf').notNull().default(0),
    status: posPaymentStatusEnum('status').notNull(),
    demoReference: text('demo_reference').notNull(),
    simulated: boolean('simulated').notNull(),
    /** A fictional payer number, masked. */
    payerPhoneMasked: text('payer_phone_masked'),
    voucherCode: text('voucher_code'),
    failureReason: text('failure_reason'),
    idempotencyKey: text('idempotency_key').notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('pos_payments_idempotency_key_uk').on(t.idempotencyKey),
    unique('pos_payments_demo_reference_uk').on(t.demoReference),
    index('pos_payments_order_idx').on(t.orderId),
    index('pos_payments_shift_idx').on(t.shiftId),
    index('pos_payments_workspace_created_idx').on(t.workspaceId, t.createdAt),
    check(
      'pos_payments_amounts',
      sql`${t.amountRwf} > 0 AND ${t.changeRwf} >= 0 AND ${t.tipRwf} >= 0
          AND ${t.refundedRwf} >= 0 AND ${t.refundedRwf} <= ${t.amountRwf}`,
    ),
    check(
      'pos_payments_cash_shape',
      sql`${t.method} = 'cash' OR (${t.changeRwf} = 0 AND ${t.tenderedRwf} IS NULL)`,
    ),
    check(
      'pos_payments_refunded_shape',
      sql`(${t.status} = 'refunded') = (${t.refundedRwf} = ${t.amountRwf} AND ${t.refundedRwf} > 0)`,
    ),
  ],
);

export const posPaymentEvents = pgTable(
  'pos_payment_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => posPayments.id, { onDelete: 'cascade' }),
    fromStatus: posPaymentStatusEnum('from_status'),
    toStatus: posPaymentStatusEnum('to_status').notNull(),
    /** The simulated provider's answer, sanitized: never a credential or a real reference. */
    note: text('note'),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('pos_payment_events_payment_idx').on(t.paymentId, t.occurredAt)],
);

/** Money given back from one payment. A cash refund leaves the drawer of the shift that gave it. */
export const posRefunds = pgTable(
  'pos_refunds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => posPayments.id),
    shiftId: uuid('shift_id').references(() => cashierShifts.id),
    amountRwf: amount('amount_rwf').notNull(),
    currency: currency(),
    reason: text('reason').notNull(),
    demoReference: text('demo_reference').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    refundedByUserId: uuid('refunded_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('pos_refunds_idempotency_key_uk').on(t.idempotencyKey),
    unique('pos_refunds_demo_reference_uk').on(t.demoReference),
    index('pos_refunds_payment_idx').on(t.paymentId),
    check('pos_refunds_amount_positive', sql`${t.amountRwf} > 0`),
  ],
);

// --- Numbering and audit ---------------------------------------------------------

/** Order and ticket numbers per workspace per Kigali day, taken under the row's lock. */
export const posCounters = pgTable(
  'pos_counters',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    kind: text('kind').notNull(),
    /** `yymmdd` in Africa/Kigali. */
    period: text('period').notNull(),
    value: integer('value').notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.kind, t.period] })],
);

/**
 * The POS audit trail (spec §14): who did what, at which outlet, to which
 * row, with the values before and after. Written in the SAME transaction as
 * the change it records. Platform wide `audit_events` carries no workspace,
 * so a business could not be shown its own trail from there.
 */
export const posAuditEvents = pgTable(
  'pos_audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    outletId: uuid('outlet_id').references(() => outlets.id),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    reason: text('reason'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('pos_audit_events_workspace_idx').on(t.workspaceId, t.occurredAt),
    index('pos_audit_events_entity_idx').on(t.entityType, t.entityId),
  ],
);
