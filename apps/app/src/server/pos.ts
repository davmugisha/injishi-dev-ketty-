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
  mtn_momo: "MTN MoMo (simulated)",
  airtel_money: "Airtel Money (simulated)",
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
