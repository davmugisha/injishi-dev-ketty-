/**
 * The point of sale, read and written through server/api (`/api/v1/ops/pos`, POS spec phase 1).
 *
 * Unlike the area sources, these screens were built for the API rather than for fixtures, so they read the
 * API's own shapes, declared here as the app declares every API shape it reads (the app does not depend on
 * @injishi/contracts; `pos.ts` there is the definition these mirror). Every call is scoped to the person's
 * hospitality workspace; the API applies their branch scope and every rule. Every payment is SIMULATED.
 */
import type { SourceContext } from "./sources/types";

// ── Shapes (PosOutlet, PosMenu, PosFloor, PosOrder, PosTicket, PosRegister, PosShift in contracts) ──────

export type TaxMode = "exclusive" | "inclusive";
export type PaymentMethod =
  | "cash"
  | "mtn_momo"
  | "airtel_money"
  | "card"
  | "bank_transfer"
  | "voucher"
  | "customer_credit";
export type PaymentStatus = "initiated" | "pending" | "successful" | "failed" | "cancelled" | "expired" | "refunded";
export type OrderStatus = "draft" | "submitted" | "in_progress" | "ready" | "delivered" | "completed" | "cancelled";
export type OrderType = "dine_in" | "takeaway" | "delivery" | "room_service" | "event";
export type TableStatus = "available" | "occupied" | "reserved" | "bill_requested" | "cleaning";
export type TicketStatus = "queued" | "preparing" | "ready" | "served" | "cancelled";
export type StationKind = "kitchen" | "bar";
export type ApprovalStatus = "approved" | "pending_approval" | "rejected";

export interface PosOutlet {
  id: string;
  name: string;
  outletKind: string;
  propertyId: string | null;
  branchName: string | null;
  settings: {
    outletId: string;
    taxMode: TaxMode;
    discountLimitBps: number;
    enabledMethods: PaymentMethod[];
    receiptHeader: string;
    receiptFooter: string;
    /** The venue's TIN on its receipts: empty, or 9 digits. */
    venueTin: string;
    venuePhone: string;
    venueAddress: string;
    /** Minutes after midnight (Kigali) at which the business day starts; 0 is the calendar day. */
    businessDayStartMinutes: number;
  };
}

export interface MenuOption {
  name: string;
  required: boolean;
  maxChoices: number;
  choices: { label: string; priceDeltaRwf: number }[];
}

export interface PosMenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  sku: string | null;
  priceRwf: number;
  taxCode: string;
  taxRateBps: number;
  options: MenuOption[];
  stationId: string | null;
  available: boolean;
  unavailableReason: string | null;
  /** The library photo saved for the item (`beer`), or null: the name then suggests one. */
  photo?: string | null;
}

export interface PosMenu {
  outletId: string;
  taxMode: TaxMode;
  categories: { id: string; name: string; sortOrder: number }[];
  items: PosMenuItem[];
}

export interface PosTable {
  id: string;
  areaId: string;
  label: string;
  seats: number;
  status: TableStatus;
  sessionId: string | null;
  guestCount: number | null;
  waiterName: string | null;
  openedAt: string | null;
  openOrders: number;
  outstandingRwf: number;
  /** Open orders guests sent from this table's QR (migration 0156). Absent when there are none. */
  qrOrders?: number;
}

export interface PosFloor {
  outletId: string;
  areas: { id: string; name: string; sortOrder: number }[];
  tables: PosTable[];
}

export interface Settlement {
  totalRwf: number;
  collectedRwf: number;
  refundedRwf: number;
  pendingRwf: number;
  outstandingRwf: number;
  payableRwf: number;
  state: "unpaid" | "partially_paid" | "paid" | "overpaid";
  settled: boolean;
}

export interface PosOrderLine {
  id: string;
  serviceItemId: string | null;
  name: string;
  sku: string | null;
  quantity: number;
  unitPriceRwf: number;
  selectedOptions: { name: string; choices: { label: string; priceDeltaRwf: number }[] }[];
  note: string | null;
  status: "draft" | "sent" | "voided";
  taxCode: string | null;
  taxRateBps: number;
  grossRwf: number;
  discountRwf: number;
  taxRwf: number;
  totalRwf: number;
  voidReason: string | null;
  stationId: string | null;
}

export interface PosDiscount {
  id: string;
  orderItemId: string | null;
  amountRwf: number;
  reason: string;
  status: ApprovalStatus;
  requestedByName: string | null;
  decidedByName: string | null;
  createdAt: string;
}

export interface PosPayment {
  id: string;
  orderId: string;
  method: PaymentMethod;
  amountRwf: number;
  tenderedRwf: number | null;
  changeRwf: number;
  tipRwf: number;
  refundedRwf: number;
  status: PaymentStatus;
  demoReference: string;
  simulated: boolean;
  failureReason: string | null;
  shiftId: string | null;
  createdByName: string | null;
  createdAt: string;
  settledAt: string | null;
}

export interface PosOrder {
  id: string;
  orderNumber: string;
  outletId: string;
  orderType: OrderType;
  status: OrderStatus;
  tableSessionId: string | null;
  tableLabel: string | null;
  waiterName: string | null;
  guestNote: string | null;
  /** `table_qr`: a guest sent it from the QR on their table. Absent on a staff order. */
  source?: "table_qr";
  /** Who the bill is for, when a customer was attached (CRM). Only the name and a masked number. */
  customer?: { id: string; fullName: string; phoneMasked: string } | null;
  taxMode: TaxMode;
  grossRwf: number;
  discountRwf: number;
  taxRwf: number;
  totalRwf: number;
  settlement: Settlement;
  lines: PosOrderLine[];
  discounts: PosDiscount[];
  payments: PosPayment[];
  cancelReason: string | null;
  createdAt: string;
  settledAt: string | null;
}

export type PosOrderSummary = Omit<PosOrder, "lines" | "discounts" | "payments"> & { lineCount: number };

export interface PosTicket {
  id: string;
  ticketNumber: string;
  orderId: string;
  orderNumber: string;
  stationId: string;
  stationName: string;
  stationKind: StationKind;
  status: TicketStatus;
  tableLabel: string | null;
  waiterName: string | null;
  orderType: OrderType;
  guestNote: string | null;
  guestCount: number | null;
  /** `table_qr`: the guests sent this order from their table's QR. */
  source?: "table_qr";
  items: {
    id: string;
    orderItemId: string;
    name: string;
    quantity: number;
    options: string[];
    note: string | null;
    status: TicketStatus;
  }[];
  createdAt: string;
  startedAt: string | null;
  readyAt: string | null;
  servedAt: string | null;
  elapsedMinutes: number;
  late: boolean;
  printCount: number;
}

export interface PosRegister {
  id: string;
  outletId: string;
  name: string;
  deviceLabel: string | null;
  openShiftId: string | null;
  openShiftCashierName: string | null;
}

export interface PosCashMovement {
  id: string;
  kind: "paid_in" | "paid_out";
  amountRwf: number;
  reason: string;
  status: ApprovalStatus;
  requestedByName: string | null;
  decidedByName: string | null;
  createdAt: string;
}

export interface PosShift {
  id: string;
  registerId: string;
  registerName: string;
  cashierUserId: string;
  cashierName: string | null;
  status: "open" | "closed" | "reviewed";
  openingFloatRwf: number;
  openedAt: string;
  closedAt: string | null;
  cashSalesRwf: number;
  cashRefundsRwf: number;
  paidInRwf: number;
  paidOutRwf: number;
  expectedCashRwf: number;
  countedCashRwf: number | null;
  varianceRwf: number | null;
  takingsByMethod: { method: PaymentMethod; amountRwf: number; count: number }[];
  tipsRwf: number;
  closeNote: string | null;
  handoverNote: string | null;
  reviewedByName: string | null;
  reviewNote: string | null;
  movements: PosCashMovement[];
}

export interface BillPrint {
  copyNumber: number;
  payload: {
    stamp: string;
    header: string;
    footer: string;
    orderNumber: string;
    table: string | null;
    taxMode: TaxMode;
    lines: { quantity: number; name: string; totalRwf: number; taxCode: string | null }[];
    grossRwf: number;
    discountRwf: number;
    taxRwf: number;
    totalRwf: number;
    collectedRwf: number;
    outstandingRwf: number;
    copy: string;
  };
}

// ── Words ───────────────────────────────────────────────────────────────────────────────────────────

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  // Paid from the customer's phone and confirmed by the cashier who sees the money arrive: not simulated.
  mtn_momo: "MTN MoMo",
  airtel_money: "Airtel Money",
  card: "Card (simulated)",
  bank_transfer: "Bank transfer (simulated)",
  voucher: "Voucher",
  customer_credit: "Customer credit",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "Draft",
  submitted: "Sent",
  in_progress: "Preparing",
  ready: "Ready",
  delivered: "Served",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const TABLE_STATUS_LABEL: Record<TableStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  bill_requested: "Bill requested",
  cleaning: "Cleaning",
};

/** The hand moves a table may make (TABLE_STATUS_MOVES in contracts). */
export const TABLE_MOVES: Record<TableStatus, TableStatus[]> = {
  available: ["reserved", "cleaning"],
  reserved: ["available"],
  occupied: ["bill_requested"],
  bill_requested: ["occupied"],
  cleaning: ["available"],
};

export const POS_DEMO_NOTICE = "Simulated payments: no money moves and no provider is contacted.";

// ── Reads ───────────────────────────────────────────────────────────────────────────────────────────

const P = "/api/v1/ops/pos";

export const posOutlets = (ctx: SourceContext) => ctx.ops().get<PosOutlet[]>(`${P}/outlets`);
export const posMenu = (ctx: SourceContext, outletId: string) =>
  ctx.ops().get<PosMenu>(`${P}/outlets/${outletId}/menu`);
export const posFloor = (ctx: SourceContext, outletId: string) =>
  ctx.ops().get<PosFloor>(`${P}/outlets/${outletId}/floor`);
/** Each table's permanent QR code (migration 0156): what its printed card opens for guests (`/t/<code>`). */
export const posTableQr = (ctx: SourceContext, outletId: string) =>
  ctx.ops().get<{ tableId: string; code: string }[]>(`${P}/outlets/${outletId}/table-qr`);
export const posOrder = (ctx: SourceContext, orderId: string) => ctx.ops().get<PosOrder>(`${P}/orders/${orderId}`);
export const posOrders = (ctx: SourceContext, query: { outletId?: string; status?: string; limit?: number }) =>
  ctx.ops().get<PosOrderSummary[]>(`${P}/orders`, { query });
export const posTickets = (ctx: SourceContext, outletId: string, kind?: StationKind) =>
  ctx.ops().get<PosTicket[]>(`${P}/outlets/${outletId}/tickets`, { query: { kind } });
export const posRegisters = (ctx: SourceContext, outletId: string) =>
  ctx.ops().get<PosRegister[]>(`${P}/outlets/${outletId}/registers`);
export const posMyShift = (ctx: SourceContext, outletId: string) =>
  ctx.ops().get<PosShift | null>(`${P}/outlets/${outletId}/my-shift`);
export const posShifts = (ctx: SourceContext, query: { outletId?: string; status?: string; limit?: number }) =>
  ctx.ops().get<PosShift[]>(`${P}/shifts`, { query });

// ── Mobile money confirmed by the cashier ──────────────────────────────────────────────────────────────

/** MTN MoMo and Airtel Money: paid from the customer's phone, PENDING until the cashier sees the money arrive. */
export const MOBILE_METHODS = ["mtn_momo", "airtel_money"] as const;
export type MobileMethod = (typeof MOBILE_METHODS)[number];
export const isMobileMethod = (m: string): m is MobileMethod => (MOBILE_METHODS as readonly string[]).includes(m);

/** One payment waiting for the cashier on the Cashier Desk. */
export interface PosAwaitingPayment {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  orderType: OrderType;
  tableLabel: string | null;
  customerName: string | null;
  customerPhoneMasked: string | null;
  payerPhoneMasked: string | null;
  method: PaymentMethod;
  amountRwf: number;
  reference: string;
  status: PaymentStatus;
  startedAt: string;
  startedByName: string | null;
  waiterName: string | null;
  /** MTN MoMo and Airtel Money: confirmed by hand on the desk. Anything else is answered on the bill. */
  confirmable: boolean;
}

export interface PosPaymentDecision {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  tableLabel: string | null;
  method: PaymentMethod;
  amountRwf: number;
  outcome: "confirmed" | "not_received";
  byName: string | null;
  at: string;
  note: string | null;
}

export interface PosAwaitingPayments {
  awaiting: PosAwaitingPayment[];
  recent: PosPaymentDecision[];
}

/** What a waiter is told once the cashier answered a payment on one of their bills. */
export interface PosPaymentUpdate {
  id: string;
  paymentId: string;
  orderId: string;
  orderNumber: string;
  orderType: OrderType;
  tableLabel: string | null;
  tableId: string | null;
  tableSessionId: string | null;
  sessionOpen: boolean;
  tableStatus: TableStatus | null;
  method: PaymentMethod;
  amountRwf: number;
  outcome: "confirmed" | "not_received";
  billFullyPaid: boolean;
  outstandingRwf: number;
  byName: string | null;
  at: string;
}

export const posAwaitingPayments = (ctx: SourceContext, outletId: string) =>
  ctx.ops().get<PosAwaitingPayments>(`${P}/outlets/${outletId}/awaiting-payments`);
export const posPaymentUpdates = (ctx: SourceContext, outletId: string, since?: string) =>
  ctx.ops().get<PosPaymentUpdate[]>(`${P}/outlets/${outletId}/payment-updates`, { query: { since } });

// ── Writes ──────────────────────────────────────────────────────────────────────────────────────────

export interface LineRequest {
  serviceItemId: string;
  quantity: number;
  selectedOptions?: { name: string; choices: string[] }[];
  note?: string;
}

export const posWrite = {
  seat: (ctx: SourceContext, tableId: string, guestCount: number) =>
    ctx.ops().post<PosFloor>(`${P}/tables/${tableId}/seat`, { guestCount }),
  tableStatus: (ctx: SourceContext, tableId: string, status: TableStatus) =>
    ctx.ops().post<PosFloor>(`${P}/tables/${tableId}/status`, { status }),
  release: (ctx: SourceContext, sessionId: string) =>
    ctx.ops().post<PosFloor>(`${P}/sessions/${sessionId}/release`, {}),
  moveSession: (ctx: SourceContext, sessionId: string, toTableId: string) =>
    ctx.ops().post<PosFloor>(`${P}/sessions/${sessionId}/move`, { toTableId }),
  mergeSessions: (ctx: SourceContext, sessionId: string, fromSessionId: string) =>
    ctx.ops().post<PosFloor>(`${P}/sessions/${sessionId}/merge`, { fromSessionId }),
  createOrder: (
    ctx: SourceContext,
    body: {
      outletId: string;
      orderType: OrderType;
      tableSessionId?: string;
      guestNote?: string;
      lines?: LineRequest[];
    },
    idempotencyKey: string,
  ) => ctx.ops().post<PosOrder>(`${P}/orders`, body, { idempotencyKey }),
  addLines: (ctx: SourceContext, orderId: string, lines: LineRequest[]) =>
    ctx.ops().post<PosOrder>(`${P}/orders/${orderId}/lines`, { lines }),
  updateLine: (
    ctx: SourceContext,
    orderId: string,
    lineId: string,
    body: { quantity?: number; note?: string | null },
  ) => ctx.ops().patch<PosOrder>(`${P}/orders/${orderId}/lines/${lineId}`, body),
  removeLine: (ctx: SourceContext, orderId: string, lineId: string) =>
    ctx.ops().delete<PosOrder>(`${P}/orders/${orderId}/lines/${lineId}`),
  voidLine: (ctx: SourceContext, orderId: string, lineId: string, reason: string) =>
    ctx.ops().post<PosOrder>(`${P}/orders/${orderId}/lines/${lineId}/void`, { reason }),
  send: (ctx: SourceContext, orderId: string) => ctx.ops().post<PosOrder>(`${P}/orders/${orderId}/send`, {}),
  cancel: (ctx: SourceContext, orderId: string, reason: string) =>
    ctx.ops().post<PosOrder>(`${P}/orders/${orderId}/cancel`, { reason }),
  discount: (
    ctx: SourceContext,
    orderId: string,
    body: { orderItemId?: string; kind: "amount" | "percent"; value: number; reason: string },
  ) => ctx.ops().post<PosOrder>(`${P}/orders/${orderId}/discounts`, body),
  decideDiscount: (ctx: SourceContext, orderId: string, discountId: string, approve: boolean, note?: string) =>
    ctx.ops().post<PosOrder>(`${P}/orders/${orderId}/discounts/${discountId}/decide`, { approve, note }),
  transfer: (ctx: SourceContext, orderId: string, toTableSessionId: string, reason: string) =>
    ctx.ops().post<PosOrder>(`${P}/orders/${orderId}/transfer`, { toTableSessionId, reason }),
  split: (ctx: SourceContext, orderId: string, orderItemIds: string[]) =>
    ctx.ops().post<PosOrder>(`${P}/orders/${orderId}/split`, { orderItemIds }),
  printBill: (ctx: SourceContext, orderId: string) =>
    ctx.ops().post<BillPrint>(`${P}/orders/${orderId}/print-bill`, {}),
  pay: (
    ctx: SourceContext,
    orderId: string,
    body: {
      method: PaymentMethod;
      amountRwf: number;
      tenderedRwf?: number;
      tipRwf?: number;
      simulate?: "success" | "pending" | "failure" | "timeout";
      payerPhone?: string;
      voucherCode?: string;
      idempotencyKey: string;
    },
  ) => ctx.ops().post<PosOrder>(`${P}/orders/${orderId}/payments`, body),
  resolvePayment: (ctx: SourceContext, paymentId: string, outcome: "success" | "failure" | "timeout") =>
    ctx.ops().post<PosOrder>(`${P}/payments/${paymentId}/resolve`, { outcome }),
  startMobilePayment: (
    ctx: SourceContext,
    orderId: string,
    body: { method: MobileMethod; amountRwf: number; payerPhone: string; idempotencyKey: string },
  ) => ctx.ops().post<PosOrder>(`${P}/orders/${orderId}/mobile-payments`, body),
  confirmPayment: (ctx: SourceContext, paymentId: string, transactionId?: string) =>
    ctx.ops().post<PosOrder>(`${P}/payments/${paymentId}/confirm`, transactionId ? { transactionId } : {}),
  paymentNotReceived: (ctx: SourceContext, paymentId: string, reason: string) =>
    ctx.ops().post<PosOrder>(`${P}/payments/${paymentId}/not-received`, { reason }),
  emailReceipt: (ctx: SourceContext, orderId: string, email: string) =>
    ctx.ops().post<{ sent: true; to: string }>(`${P}/orders/${orderId}/receipt-email`, { email }),
  refund: (
    ctx: SourceContext,
    paymentId: string,
    body: { amountRwf: number; reason: string; idempotencyKey: string },
  ) => ctx.ops().post<PosOrder>(`${P}/payments/${paymentId}/refund`, body),
  advanceTicket: (ctx: SourceContext, ticketId: string, to: TicketStatus) =>
    ctx.ops().post<PosTicket>(`${P}/tickets/${ticketId}/advance`, { to }),
  reprintTicket: (ctx: SourceContext, ticketId: string) =>
    ctx.ops().post<PosTicket>(`${P}/tickets/${ticketId}/reprint`, {}),
  openShift: (ctx: SourceContext, registerId: string, openingFloatRwf: number) =>
    ctx.ops().post<PosShift>(`${P}/shifts`, { registerId, openingFloatRwf }),
  cashMovement: (
    ctx: SourceContext,
    shiftId: string,
    body: { kind: "paid_in" | "paid_out"; amountRwf: number; reason: string },
  ) => ctx.ops().post<PosShift>(`${P}/shifts/${shiftId}/movements`, body),
  decideMovement: (ctx: SourceContext, movementId: string, approve: boolean) =>
    ctx.ops().post<PosShift>(`${P}/cash-movements/${movementId}/decide`, { approve }),
  closeShift: (
    ctx: SourceContext,
    shiftId: string,
    body: { countedCashRwf: number; closeNote?: string; handoverNote?: string },
  ) => ctx.ops().post<PosShift>(`${P}/shifts/${shiftId}/close`, body),
  reviewShift: (ctx: SourceContext, shiftId: string, note?: string) =>
    ctx.ops().post<PosShift>(`${P}/shifts/${shiftId}/review`, { note }),
};

/** The permissions the person holds in their hospitality workspace, for what a screen offers (the API decides). */
export function posPermissions(ctx: SourceContext): Set<string> {
  try {
    return new Set(ctx.ops().workspace.permissions);
  } catch {
    return new Set();
  }
}

/** The person's role in this business (`bartender`, `cashier`…), for choosing a starting view only. */
export function roleOf(ctx: SourceContext): string | null {
  try {
    return ctx.ops().workspace.orgRole ?? null;
  } catch {
    return null;
  }
}

// ── Back office: dashboard, reports, stock, expenses (POS spec sections 4, 8, 13 and 15) ────────────────

export type StockLevel = "untracked" | "ok" | "low" | "out";

export interface PosStockItem {
  id: string;
  name: string;
  category: string;
  priceRwf: number;
  stockQty: number | null;
  level: StockLevel;
  unitCostRwf: number;
  valueRwf: number;
  /** The library photo saved for the item, or null: the name then suggests one. */
  photo?: string | null;
}

export interface PosStockMovement {
  id: string;
  at: string;
  action: string;
  item: string;
  delta: number | null;
  stockBefore: number | null;
  stockAfter: number | null;
  by: string | null;
  reason: string | null;
  order: string | null;
}

export interface PosStockView {
  outletId: string;
  lowAt: number;
  costRatio: number;
  items: PosStockItem[];
  summary: { tracked: number; low: number; out: number; valuationRwf: number };
  movements: PosStockMovement[];
}

export interface PosExpenseRow {
  id: string;
  paidOn: string;
  category: string;
  amountRwf: number;
  method: string;
  payeeName: string | null;
  note: string | null;
}

export interface PosSalesLine {
  name: string;
  category: string;
  quantity: number;
  revenueRwf: number;
}

export interface PosReport {
  period: { from: string; to: string };
  outlet: { id: string | null; name: string };
  /** When each day starts (minutes after midnight); `mixed`: the outlets disagree, so calendar days were used. */
  businessDay: { startMinutes: number; mixed: boolean };
  sales: {
    orders: number;
    completedOrders: number;
    totalRwf: number;
    taxRwf: number;
    discountRwf: number;
    netOfTaxRwf: number;
    averageOrderRwf: number;
  };
  payments: {
    collectedRwf: number;
    refundsRwf: number;
    tipsRwf: number;
    byMethod: { method: string; count: number; amountRwf: number; tipRwf: number }[];
  };
  expenses: { totalRwf: number; byCategory: { category: string; totalRwf: number }[]; recent: PosExpenseRow[] };
  profit: {
    netSalesRwf: number;
    costOfGoodsRwf: number;
    expensesRwf: number;
    estimatedProfitRwf: number;
    costRatio: number;
    note: string;
  };
  bestSellers: PosSalesLine[];
  topDrinks: PosSalesLine[];
  byCategory: { category: string; quantity: number; revenueRwf: number }[];
  waiters: { name: string; orders: number; totalRwf: number; averageRwf: number }[];
  daily: { day: string; orders: number; totalRwf: number }[];
  tax: { code: string; ratePercent: number; taxableRwf: number; taxRwf: number }[];
  shifts: { count: number; varianceRwf: number };
  stock: { tracked: number; low: number; out: number; valuationRwf: number };
}

export interface PosDashboard {
  asOf: string;
  outlet: { id: string | null; name: string };
  today: PosReport;
  week: PosReport;
  live: {
    activeOrders: { status: string; count: number; totalRwf: number }[];
    activeOrderCount: number;
    tables: { status: string; count: number }[];
    openShifts: number;
    alerts: { low: number; out: number };
  };
}

export const posDashboard = (ctx: SourceContext, outletId?: string) =>
  ctx.ops().get<PosDashboard>(`${P}/dashboard`, { query: { outletId } });

/** One recorded POS action: who did it, when, at which outlet, what changed and the reason they gave. */
export interface PosAuditEvent {
  id: string;
  occurredAt: string;
  actorName: string | null;
  outletId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
}

/** The POS audit trail (money.view, shift.review or pos.override), newest first. */
export const posAudit = (ctx: SourceContext, query: { outletId?: string; from?: string; limit?: number }) =>
  ctx.ops().get<PosAuditEvent[]>(`${P}/audit`, { query });
export const posReport = (ctx: SourceContext, query: { outletId?: string; from?: string; to?: string }) =>
  ctx.ops().get<PosReport>(`${P}/reports`, { query });
export const posStock = (ctx: SourceContext, outletId: string) =>
  ctx.ops().get<PosStockView>(`${P}/stock`, { query: { outletId } });

export interface PosStationRow {
  id: string;
  name: string;
  kind: "kitchen" | "bar";
}
export const posStations = (ctx: SourceContext, outletId: string) =>
  ctx.ops().get<PosStationRow[]>(`${P}/outlets/${outletId}/stations`);

export type StockMovementKind = "damaged" | "broken" | "expired" | "spillage" | "staff_use" | "received" | "count";

export const STOCK_KIND_LABEL: Record<StockMovementKind, string> = {
  damaged: "Damaged",
  broken: "Broken",
  expired: "Expired",
  spillage: "Spilled",
  staff_use: "Staff use",
  received: "Received",
  count: "Stock count",
};

export const posBackOffice = {
  adjustStock: (
    ctx: SourceContext,
    body: { serviceItemId: string; kind: StockMovementKind; quantity: number; reason: string },
  ) => ctx.ops().post<PosStockItem>(`${P}/stock/adjust`, body),
  recordExpense: (
    ctx: SourceContext,
    body: {
      outletId?: string;
      category: string;
      amountRwf: number;
      paidOn?: string;
      method: string;
      payeeName?: string;
      note?: string;
    },
  ) => ctx.ops().post<PosExpenseRow>(`${P}/expenses`, body),
  voidExpense: (ctx: SourceContext, expenseId: string, reason: string) =>
    ctx.ops().post<PosExpenseRow>(`${P}/expenses/${expenseId}/void`, { reason }),
};

// ── Venue setup and menu management (the owner configures the floor and the menu) ──────────────────────
// Venue shapes mirror PosVenue / PosSetup in contracts (`/ops/pos/outlets/:id/venue`, `outlet.manage`). The menu
// is the existing catalogue (`/ops/service-catalog`, `menu.manage`): nothing about it is new on the API side.

export interface PosVenueArea {
  id: string;
  name: string;
  sortOrder: number;
  tableCount: number;
}
export interface PosVenueTable {
  id: string;
  areaId: string;
  label: string;
  seats: number;
  status: TableStatus;
  sortOrder: number;
  hasOpenSession: boolean;
}
export interface PosVenueStation {
  id: string;
  name: string;
  kind: StationKind;
  printerName: string | null;
  sortOrder: number;
  routedItems: number;
  openTickets: number;
}
export interface PosVenueRegister {
  id: string;
  name: string;
  deviceLabel: string | null;
  hasOpenShift: boolean;
}
export interface PosVenueRoute {
  serviceItemId: string;
  name: string;
  categoryName: string | null;
  stationId: string | null;
}
export interface PosVenue {
  outletId: string;
  areas: PosVenueArea[];
  tables: PosVenueTable[];
  stations: PosVenueStation[];
  registers: PosVenueRegister[];
  routing: PosVenueRoute[];
}

export type SetupStepKey =
  | "areas"
  | "tables"
  | "stations"
  | "registers"
  | "categories"
  | "products"
  | "routing"
  | "receipts"
  | "team";
export interface PosSetup {
  outletId: string;
  steps: { key: SetupStepKey; done: boolean; count: number }[];
  doneCount: number;
  total: number;
}

export type CatalogStatus = "active" | "out_of_stock" | "archived";
export interface CatalogItem {
  id: string;
  serviceCategoryId: string;
  departmentId: string;
  name: string;
  description: string | null;
  priceRwf: number;
  taxCode: string;
  fulfillmentType: string;
  prepTimeMinutes: number | null;
  guestOrderable: boolean;
  stockQty: number | null;
  status: CatalogStatus;
  rraItemClsCd: string | null;
  rraItemClsName: string | null;
  rraItemTyCd: string | null;
  rraItemCd: string | null;
  rraPkgUnitCd: string | null;
  rraQtyUnitCd: string | null;
  /** What still stops this item selling (the RRA codes a receipt needs). */
  missingRra: string[];
  /** The library photo saved for the item, or null: the name then suggests one. */
  photo?: string | null;
}
export interface CatalogCategory {
  id: string;
  departmentId: string;
  departmentName: string | null;
  outletId: string | null;
  name: string;
  sortOrder: number;
  guestVisible: boolean;
  status: string;
  defaultRraItemClsCd: string | null;
  defaultRraItemTyCd: string | null;
  defaultRraPkgUnitCd: string | null;
  defaultRraQtyUnitCd: string | null;
  defaultTaxCode: string | null;
  items: CatalogItem[];
}
export interface PosCatalog {
  categories: CatalogCategory[];
}
/** The slice of an operator outlet a menu needs to create a category under it. */
export interface PosOutletRef {
  id: string;
  name: string;
  departmentId: string;
  propertyId: string | null;
}

export const posVenue = (ctx: SourceContext, outletId: string) =>
  ctx.ops().get<PosVenue>(`${P}/outlets/${outletId}/venue`);
export const posSetup = (ctx: SourceContext, outletId: string) =>
  ctx.ops().get<PosSetup>(`${P}/outlets/${outletId}/setup`);
export const posCatalog = (ctx: SourceContext) => ctx.ops().get<PosCatalog>("/api/v1/ops/service-catalog");
export async function posOutletRefs(ctx: SourceContext): Promise<PosOutletRef[]> {
  const res = await ctx.ops().get<{ outlets: PosOutletRef[] }>("/api/v1/ops/outlets");
  return res.outlets.map((o) => ({ id: o.id, name: o.name, departmentId: o.departmentId, propertyId: o.propertyId }));
}

const V = (outletId: string) => `${P}/outlets/${outletId}/venue`;
export interface SettingsInput {
  taxMode?: TaxMode;
  discountLimitBps?: number;
  enabledMethods?: PaymentMethod[];
  receiptHeader?: string;
  receiptFooter?: string;
  venueTin?: string;
  venuePhone?: string;
  venueAddress?: string;
  businessDayStartMinutes?: number;
}
/**
 * Where a business's FIRST outlet goes. Registration gives every business a head-office branch and the standard
 * department chart, which includes "Food and Beverage"; an outlet belongs to a department and a branch, so the
 * Food and Beverage department (which carries its branch) is exactly what creating the first outlet needs.
 */
export async function posFirstOutletTarget(
  ctx: SourceContext,
): Promise<{ departmentId: string; propertyId: string } | null> {
  const res = await ctx
    .ops()
    .get<{ departments: { id: string; propertyId: string | null; departmentCategory: string }[] }>(
      "/api/v1/ops/departments",
    );
  const dept = res.departments.find((d) => d.departmentCategory === "fnb" && d.propertyId);
  return dept?.propertyId ? { departmentId: dept.id, propertyId: dept.propertyId } : null;
}
export const outletWrite = {
  create: (
    ctx: SourceContext,
    body: { name: string; outletKind: "restaurant" | "bar"; departmentId: string; propertyId: string },
  ) => ctx.ops().post<{ id: string; name: string }>("/api/v1/ops/outlets", body),
};

export const venueWrite = {
  updateSettings: (ctx: SourceContext, outletId: string, body: SettingsInput) =>
    ctx.ops().patch<PosOutlet>(`${P}/outlets/${outletId}/settings`, body),
  createArea: (ctx: SourceContext, outletId: string, body: { name: string }) =>
    ctx.ops().post<PosVenue>(`${V(outletId)}/areas`, body),
  updateArea: (ctx: SourceContext, outletId: string, id: string, body: { name?: string }) =>
    ctx.ops().patch<PosVenue>(`${V(outletId)}/areas/${id}`, body),
  archiveArea: (ctx: SourceContext, outletId: string, id: string) =>
    ctx.ops().post<PosVenue>(`${V(outletId)}/areas/${id}/archive`, {}),
  createTable: (ctx: SourceContext, outletId: string, body: { areaId: string; label: string; seats: number }) =>
    ctx.ops().post<PosVenue>(`${V(outletId)}/tables`, body),
  updateTable: (
    ctx: SourceContext,
    outletId: string,
    id: string,
    body: { areaId?: string; label?: string; seats?: number },
  ) => ctx.ops().patch<PosVenue>(`${V(outletId)}/tables/${id}`, body),
  archiveTable: (ctx: SourceContext, outletId: string, id: string) =>
    ctx.ops().post<PosVenue>(`${V(outletId)}/tables/${id}/archive`, {}),
  createStation: (
    ctx: SourceContext,
    outletId: string,
    body: { name: string; kind: StationKind; printerName?: string | null },
  ) => ctx.ops().post<PosVenue>(`${V(outletId)}/stations`, body),
  updateStation: (
    ctx: SourceContext,
    outletId: string,
    id: string,
    body: { name?: string; kind?: StationKind; printerName?: string | null },
  ) => ctx.ops().patch<PosVenue>(`${V(outletId)}/stations/${id}`, body),
  archiveStation: (ctx: SourceContext, outletId: string, id: string) =>
    ctx.ops().post<PosVenue>(`${V(outletId)}/stations/${id}/archive`, {}),
  createRegister: (ctx: SourceContext, outletId: string, body: { name: string; deviceLabel?: string | null }) =>
    ctx.ops().post<PosVenue>(`${V(outletId)}/registers`, body),
  updateRegister: (
    ctx: SourceContext,
    outletId: string,
    id: string,
    body: { name?: string; deviceLabel?: string | null },
  ) => ctx.ops().patch<PosVenue>(`${V(outletId)}/registers/${id}`, body),
  archiveRegister: (ctx: SourceContext, outletId: string, id: string) =>
    ctx.ops().post<PosVenue>(`${V(outletId)}/registers/${id}/archive`, {}),
  setRoute: (ctx: SourceContext, outletId: string, serviceItemId: string, stationId: string | null) =>
    ctx.ops().put<PosVenue>(`${V(outletId)}/routing`, { serviceItemId, stationId }),
  /** Several routes in one transaction: all are set, or none. */
  setRoutes: (ctx: SourceContext, outletId: string, routes: { serviceItemId: string; stationId: string | null }[]) =>
    ctx.ops().put<PosVenue>(`${V(outletId)}/routing/bulk`, { routes }),
  bulkTables: (
    ctx: SourceContext,
    outletId: string,
    body: { areaId: string; prefix: string; start: number; count: number; seats: number },
  ) => ctx.ops().post<PosVenue>(`${V(outletId)}/tables/bulk`, body),
  reorder: (ctx: SourceContext, outletId: string, kind: "areas" | "tables" | "stations", ids: string[]) =>
    ctx.ops().put<PosVenue>(`${V(outletId)}/order`, { kind, ids }),
  restore: (ctx: SourceContext, outletId: string, kind: ArchivedKind, id: string) =>
    ctx.ops().post<PosVenue>(`${V(outletId)}/${kind}s/${id}/restore`, {}),
  applyTemplate: (ctx: SourceContext, outletId: string, template: VenueTemplateKey) =>
    ctx.ops().post<{ venue: PosVenue; created: number; skipped: number }>(`${V(outletId)}/templates/apply`, {
      template,
    }),
};

// ── Archived venue items and starter templates (venue setup, round 1) ─────────────────────────────

export type ArchivedKind = "area" | "table" | "station" | "register";
export interface PosArchivedVenue {
  outletId: string;
  areas: { id: string; name: string; archivedAt: string; archivedTables: number }[];
  tables: {
    id: string;
    label: string;
    seats: number;
    areaId: string;
    areaName: string;
    areaArchived: boolean;
    archivedAt: string;
  }[];
  stations: { id: string; name: string; kind: StationKind; archivedAt: string }[];
  registers: { id: string; name: string; deviceLabel: string | null; archivedAt: string }[];
}
export type VenueTemplateKey = "small_bar" | "restaurant" | "restaurant_bar";
/** new: will be created; exists / archived: the name is already used here, so it is skipped. */
export type TemplateMark = "new" | "exists" | "archived";
export interface PosVenueTemplatePlan {
  key: VenueTemplateKey;
  label: string;
  description: string;
  areas: { name: string; mark: TemplateMark; tables: { label: string; seats: number; mark: TemplateMark }[] }[];
  stations: { name: string; kind: StationKind; mark: TemplateMark }[];
  registers: { name: string; mark: TemplateMark }[];
  creates: number;
  skips: number;
}
export const posArchived = (ctx: SourceContext, outletId: string) =>
  ctx.ops().get<PosArchivedVenue>(`${V(outletId)}/archived`);
export const posVenueTemplates = (ctx: SourceContext, outletId: string) =>
  ctx.ops().get<PosVenueTemplatePlan[]>(`${V(outletId)}/templates`);

const CAT = "/api/v1/ops/service-catalog";
export interface ItemInput {
  serviceCategoryId?: string;
  name?: string;
  description?: string;
  priceRwf?: number;
  taxCode?: string;
  prepTimeMinutes?: number;
  guestOrderable?: boolean;
  stockQty?: number | null;
  status?: CatalogStatus;
  /** A library photo's id (`beer`); null clears the saved choice. Left out, the photo is not changed. */
  photo?: string | null;
}
export interface CategoryInput {
  name?: string;
  guestVisible?: boolean;
  sortOrder?: number;
  defaultRraItemClsCd?: string;
  defaultRraItemTyCd?: string;
  defaultRraPkgUnitCd?: string;
  defaultRraQtyUnitCd?: string;
  defaultTaxCode?: string;
}
export const catalogWrite = {
  createCategory: (
    ctx: SourceContext,
    body: CategoryInput & { name: string; propertyId: string; departmentId: string; outletId: string },
  ) => ctx.ops().post<PosCatalog>(`${CAT}/categories`, body),
  updateCategory: (ctx: SourceContext, id: string, body: CategoryInput) =>
    ctx.ops().patch<PosCatalog>(`${CAT}/categories/${id}`, body),
  createItem: (ctx: SourceContext, body: ItemInput & { serviceCategoryId: string; name: string; priceRwf: number }) =>
    ctx.ops().post<PosCatalog>(`${CAT}/items`, { fulfillmentType: "onsite", ...body }),
  updateItem: (ctx: SourceContext, id: string, body: ItemInput) =>
    ctx.ops().patch<PosCatalog>(`${CAT}/items/${id}`, body),
};

// ── Customers (CRM, phase 1) ──────────────────────────────────────────────────────────────────────────
// Shapes mirror CustomerList / CustomerProfile in contracts (`/ops/pos/customers`). The phone comes back masked
// unless the person holds `customer.manage` (`contactHidden` says which), and a role that may only look customers
// up gets an empty list until it has typed enough to search (`searchRequired`).

export interface PosCustomerSummary {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  contactHidden: boolean;
  marketingConsent: boolean;
  source: "pos" | "qr" | "reservation" | "import";
  visitCount: number;
  lifetimeSpendRwf: number;
  lastVisitAt: string | null;
  createdAt: string;
}

export interface PosCustomerList {
  customers: PosCustomerSummary[];
  total: number;
  limit: number;
  offset: number;
  searchRequired: boolean;
  contactHidden: boolean;
}

export interface PosCustomerOrderRow {
  orderId: string;
  orderNumber: string;
  outletName: string;
  orderType: OrderType;
  tableLabel: string | null;
  status: OrderStatus;
  totalRwf: number;
  createdAt: string;
}

export interface PosCustomerProfile extends PosCustomerSummary {
  notes: string | null;
  consentAt: string | null;
  consentSource: string | null;
  phoneVerifiedAt: string | null;
  status: "active";
  orders: PosCustomerOrderRow[];
}

export interface PosCustomerExport {
  exportedAt: string;
  customer: PosCustomerProfile;
  audit: { action: string; at: string; reason: string | null }[];
}

/** The shortest look-up a role that may not browse customers is allowed (CUSTOMER_SEARCH_MIN in contracts). */
export const CUSTOMER_SEARCH_MIN = 3;

export interface CustomerInput {
  fullName: string;
  phone: string;
  email?: string | null;
  marketingConsent?: boolean;
  notes?: string | null;
}

export const posCustomers = (ctx: SourceContext, query: { q?: string; limit?: number; offset?: number } = {}) =>
  ctx.ops().get<PosCustomerList>(`${P}/customers`, { query });
export const posCustomer = (ctx: SourceContext, customerId: string) =>
  ctx.ops().get<PosCustomerProfile>(`${P}/customers/${customerId}`);

export const customerWrite = {
  create: (ctx: SourceContext, body: CustomerInput) => ctx.ops().post<PosCustomerProfile>(`${P}/customers`, body),
  update: (ctx: SourceContext, customerId: string, body: Partial<CustomerInput>) =>
    ctx.ops().patch<PosCustomerProfile>(`${P}/customers/${customerId}`, body),
  merge: (ctx: SourceContext, customerId: string, body: { intoCustomerId: string; reason: string }) =>
    ctx.ops().post<PosCustomerProfile>(`${P}/customers/${customerId}/merge`, body),
  erase: (ctx: SourceContext, customerId: string, reason: string) =>
    ctx.ops().post<{ erased: true }>(`${P}/customers/${customerId}/erase`, { reason }),
  export: (ctx: SourceContext, customerId: string) =>
    ctx.ops().get<PosCustomerExport>(`${P}/customers/${customerId}/export`),
  /** Put a customer on a bill, or (null) take them off it. */
  attach: (ctx: SourceContext, orderId: string, customerId: string | null) =>
    ctx.ops().put<PosOrder>(`${P}/orders/${orderId}/customer`, { customerId }),
};
