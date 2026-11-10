import {
  TICKET_LATE_MINUTES,
  maskCustomerPhone,
  settlementOf,
  type PosCashMovement,
  type PosOrder,
  type PosOrderLine,
  type PosOrderSummary,
  type PosPayment,
  type PosShift,
  type PosTicket,
} from '@injishi/contracts';
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';

import {
  cashMovements,
  cashierShifts,
  customers,
  kitchenTicketItems,
  kitchenTickets,
  posOrderDiscounts,
  posOrderLines,
  posOrders,
  posPayments,
  posPrintJobs,
  posRefunds,
  posRegisters,
  preparationStations,
  restaurantTables,
  tableSessions,
} from '../../../database/drizzle/schema';
import { namesOf, type Db, type OrderRow } from './pos-support';

/**
 * Rows to the shapes `@injishi/contracts` pos.ts promises. Every command
 * answers with one of these, read back after it committed, so the screen
 * redraws from what the database holds rather than from what it sent.
 */

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

type SnapshotOption = { name: string; choices: { label: string; priceDeltaRwf: number }[] };
function snapshots(value: unknown): SnapshotOption[] {
  return Array.isArray(value) ? (value as SnapshotOption[]) : [];
}

async function tableLabels(db: Db, sessionIds: string[]): Promise<Map<string, string>> {
  if (sessionIds.length === 0) return new Map();
  const rows = await db
    .select({ id: tableSessions.id, label: restaurantTables.label })
    .from(tableSessions)
    .innerJoin(restaurantTables, eq(restaurantTables.id, tableSessions.tableId))
    .where(inArray(tableSessions.id, sessionIds));
  return new Map(rows.map((r) => [r.id, r.label]));
}

function presentPayment(p: typeof posPayments.$inferSelect, names: Map<string, string | null>): PosPayment {
  return {
    id: p.id,
    orderId: p.orderId,
    method: p.method,
    amountRwf: p.amountRwf,
    tenderedRwf: p.tenderedRwf,
    changeRwf: p.changeRwf,
    tipRwf: p.tipRwf,
    refundedRwf: p.refundedRwf,
    status: p.status,
    demoReference: p.demoReference,
    simulated: p.simulated,
    failureReason: p.failureReason,
    shiftId: p.shiftId,
    createdByName: names.get(p.createdByUserId) ?? null,
    createdAt: p.createdAt.toISOString(),
    settledAt: iso(p.settledAt),
  };
}

/** One order with its lines, discounts and payments. */
export async function presentOrder(db: Db, order: OrderRow): Promise<PosOrder> {
  const [lines, discounts, payments, labels, customerRows] = await Promise.all([
    db
      .select()
      .from(posOrderLines)
      .where(eq(posOrderLines.orderId, order.id))
      .orderBy(asc(posOrderLines.createdAt), asc(posOrderLines.id)),
    db
      .select()
      .from(posOrderDiscounts)
      .where(eq(posOrderDiscounts.orderId, order.id))
      .orderBy(asc(posOrderDiscounts.createdAt)),
    db.select().from(posPayments).where(eq(posPayments.orderId, order.id)).orderBy(asc(posPayments.createdAt)),
    tableLabels(db, order.tableSessionId ? [order.tableSessionId] : []),
    // The customer rides on the order (CRM, phase 1). Only the name and a masked number: the till greets, it never exports.
    order.customerId
      ? db
          .select({ id: customers.id, fullName: customers.fullName, phone: customers.phoneE164, status: customers.status })
          .from(customers)
          .where(and(eq(customers.id, order.customerId), eq(customers.workspaceId, order.workspaceId)))
          .limit(1)
      : Promise.resolve([]),
  ]);
  const customer = customerRows[0];
  const names = await namesOf(db, [
    order.waiterUserId,
    ...discounts.flatMap((d) => [d.requestedByUserId, d.decidedByUserId]),
    ...payments.map((p) => p.createdByUserId),
  ]);
  const presentedLines: PosOrderLine[] = lines.map((l) => ({
    id: l.id,
    serviceItemId: l.serviceItemId,
    name: l.nameSnapshot,
    sku: l.skuSnapshot,
    quantity: l.quantity,
    unitPriceRwf: l.unitPriceRwf,
    selectedOptions: snapshots(l.selectedOptions),
    note: l.note,
    status: l.status,
    taxCode: l.taxCode,
    taxRateBps: l.taxRateBps,
    grossRwf: l.grossRwf,
    discountRwf: l.status === 'voided' ? 0 : l.discountRwf,
    taxRwf: l.status === 'voided' ? 0 : l.taxRwf,
    totalRwf: l.status === 'voided' ? 0 : l.totalRwf,
    voidReason: l.voidReason,
    stationId: l.stationId,
  }));
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    outletId: order.outletId,
    orderType: order.orderType,
    status: order.status,
    tableSessionId: order.tableSessionId,
    tableLabel: order.tableSessionId ? (labels.get(order.tableSessionId) ?? null) : null,
    waiterName: order.waiterUserId ? (names.get(order.waiterUserId) ?? null) : null,
    guestNote: order.guestNote,
    // Present only when a customer is attached, so an order that never had one reads exactly as it always did.
    ...(customer
      ? {
          customer: {
            id: customer.id,
            fullName: customer.fullName,
            phoneMasked: customer.status === 'erased' ? '' : maskCustomerPhone(customer.phone),
          },
        }
      : {}),
    taxMode: order.taxMode,
    grossRwf: order.grossRwf,
    discountRwf: order.discountRwf,
    taxRwf: order.taxRwf,
    totalRwf: order.totalRwf,
    settlement: settlementOf(order.totalRwf, payments),
    lines: presentedLines,
    discounts: discounts.map((d) => ({
      id: d.id,
      orderItemId: d.orderLineId,
      amountRwf: d.amountRwf,
      reason: d.reason,
      status: d.status,
      requestedByName: names.get(d.requestedByUserId) ?? null,
      decidedByName: d.decidedByUserId ? (names.get(d.decidedByUserId) ?? null) : null,
      createdAt: d.createdAt.toISOString(),
    })),
    payments: payments.map((p) => presentPayment(p, names)),
    cancelReason: order.cancelReason,
    createdAt: order.createdAt.toISOString(),
    settledAt: iso(order.settledAt),
  };
}

/** Many orders, without their lines: the orders list. */
export async function presentOrderSummaries(db: Db, orders: OrderRow[]): Promise<PosOrderSummary[]> {
  if (orders.length === 0) return [];
  const ids = orders.map((o) => o.id);
  const [payments, lineCounts, labels, names] = await Promise.all([
    db
      .select({
        orderId: posPayments.orderId,
        amountRwf: posPayments.amountRwf,
        refundedRwf: posPayments.refundedRwf,
        status: posPayments.status,
      })
      .from(posPayments)
      .where(inArray(posPayments.orderId, ids)),
    db
      .select({ orderId: posOrderLines.orderId, status: posOrderLines.status })
      .from(posOrderLines)
      .where(and(inArray(posOrderLines.orderId, ids), ne(posOrderLines.status, 'voided'))),
    tableLabels(db, orders.map((o) => o.tableSessionId).filter((v): v is string => !!v)),
    namesOf(db, orders.map((o) => o.waiterUserId)),
  ]);
  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    outletId: o.outletId,
    orderType: o.orderType,
    status: o.status,
    tableSessionId: o.tableSessionId,
    tableLabel: o.tableSessionId ? (labels.get(o.tableSessionId) ?? null) : null,
    waiterName: o.waiterUserId ? (names.get(o.waiterUserId) ?? null) : null,
    guestNote: o.guestNote,
    taxMode: o.taxMode,
    grossRwf: o.grossRwf,
    discountRwf: o.discountRwf,
    taxRwf: o.taxRwf,
    totalRwf: o.totalRwf,
    settlement: settlementOf(
      o.totalRwf,
      payments.filter((p) => p.orderId === o.id),
    ),
    cancelReason: o.cancelReason,
    createdAt: o.createdAt.toISOString(),
    settledAt: iso(o.settledAt),
    lineCount: lineCounts.filter((l) => l.orderId === o.id).length,
  }));
}

/** Kitchen and bar tickets, with their items, elapsed time and print count, at `now`. */
export async function presentTickets(
  db: Db,
  tickets: (typeof kitchenTickets.$inferSelect)[],
  now: Date,
): Promise<PosTicket[]> {
  if (tickets.length === 0) return [];
  const ids = tickets.map((t) => t.id);
  const orderIds = [...new Set(tickets.map((t) => t.orderId))];
  const [items, stations, orders, prints] = await Promise.all([
    db.select().from(kitchenTicketItems).where(inArray(kitchenTicketItems.ticketId, ids)),
    db
      .select({ id: preparationStations.id, name: preparationStations.name, kind: preparationStations.kind })
      .from(preparationStations)
      .where(inArray(preparationStations.id, [...new Set(tickets.map((t) => t.stationId))])),
    db
      .select({
        id: posOrders.id,
        orderNumber: posOrders.orderNumber,
        orderType: posOrders.orderType,
        tableSessionId: posOrders.tableSessionId,
        waiterUserId: posOrders.waiterUserId,
        guestNote: posOrders.guestNote,
      })
      .from(posOrders)
      .where(inArray(posOrders.id, orderIds)),
    db
      .select({ sourceId: posPrintJobs.sourceId })
      .from(posPrintJobs)
      .where(and(eq(posPrintJobs.kind, 'kitchen_ticket'), inArray(posPrintJobs.sourceId, ids))),
  ]);
  const sessionIds = orders.map((o) => o.tableSessionId).filter((v): v is string => !!v);
  const labels = await tableLabels(db, sessionIds);
  // The party size, so the pass can see how many plates a table is waiting for. Read one connection at a time.
  const guests = new Map(
    sessionIds.length === 0
      ? []
      : (
          await db
            .select({ id: tableSessions.id, guestCount: tableSessions.guestCount })
            .from(tableSessions)
            .where(inArray(tableSessions.id, sessionIds))
        ).map((s) => [s.id, s.guestCount] as const),
  );
  const names = await namesOf(db, orders.map((o) => o.waiterUserId));
  return tickets.map((t) => {
    const station = stations.find((s) => s.id === t.stationId);
    const order = orders.find((o) => o.id === t.orderId);
    const open = t.status === 'queued' || t.status === 'preparing';
    const end = t.servedAt ?? t.readyAt ?? t.cancelledAt;
    const elapsedMinutes = Math.max(0, Math.floor(((open || !end ? now : end).getTime() - t.createdAt.getTime()) / 60_000));
    return {
      id: t.id,
      ticketNumber: t.ticketNumber,
      orderId: t.orderId,
      orderNumber: order?.orderNumber ?? '',
      stationId: t.stationId,
      stationName: station?.name ?? '',
      stationKind: station?.kind ?? 'kitchen',
      status: t.status,
      tableLabel: order?.tableSessionId ? (labels.get(order.tableSessionId) ?? null) : null,
      waiterName: order?.waiterUserId ? (names.get(order.waiterUserId) ?? null) : null,
      orderType: order?.orderType ?? 'dine_in',
      // There is no customer-name field on an order: the guest note is the closest thing the waiter can write (a name, an allergy).
      guestNote: order?.guestNote?.trim() ? order.guestNote.trim() : null,
      guestCount: order?.tableSessionId ? (guests.get(order.tableSessionId) ?? null) : null,
      items: items
        .filter((i) => i.ticketId === t.id)
        .map((i) => ({
          id: i.id,
          orderItemId: i.orderLineId,
          name: i.name,
          quantity: i.quantity,
          options: i.options,
          note: i.note,
          status: i.status,
        })),
      createdAt: t.createdAt.toISOString(),
      startedAt: iso(t.startedAt),
      readyAt: iso(t.readyAt),
      servedAt: iso(t.servedAt),
      elapsedMinutes,
      late: open && elapsedMinutes >= TICKET_LATE_MINUTES,
      printCount: prints.filter((p) => p.sourceId === t.id).length,
    };
  });
}

export interface ShiftCash {
  cashSalesRwf: number;
  cashTipsRwf: number;
  cashRefundsRwf: number;
  paidInRwf: number;
  paidOutRwf: number;
  pendingPaidOuts: number;
  takingsByMethod: { method: PosPayment['method']; amountRwf: number; count: number }[];
  tipsRwf: number;
}

/**
 * The money a shift handled, from its payments, refunds and cash movements.
 * Cash sales are what was applied to bills; a cash tip is in the drawer too,
 * so it is counted beside them.
 */
export async function shiftCash(db: Db, shiftId: string): Promise<ShiftCash> {
  const [payments, refunds, movements] = await Promise.all([
    db
      .select({
        method: posPayments.method,
        amountRwf: posPayments.amountRwf,
        tipRwf: posPayments.tipRwf,
        status: posPayments.status,
      })
      .from(posPayments)
      .where(eq(posPayments.shiftId, shiftId)),
    db
      .select({ amountRwf: posRefunds.amountRwf, method: posPayments.method })
      .from(posRefunds)
      .innerJoin(posPayments, eq(posPayments.id, posRefunds.paymentId))
      .where(eq(posRefunds.shiftId, shiftId)),
    db
      .select({ kind: cashMovements.kind, amountRwf: cashMovements.amountRwf, status: cashMovements.status })
      .from(cashMovements)
      .where(eq(cashMovements.shiftId, shiftId)),
  ]);
  const collected = payments.filter((p) => p.status === 'successful' || p.status === 'refunded');
  const byMethod = new Map<PosPayment['method'], { amountRwf: number; count: number }>();
  for (const p of collected) {
    const m = byMethod.get(p.method) ?? { amountRwf: 0, count: 0 };
    m.amountRwf += p.amountRwf;
    m.count += 1;
    byMethod.set(p.method, m);
  }
  const cash = collected.filter((p) => p.method === 'cash');
  return {
    cashSalesRwf: cash.reduce((a, p) => a + p.amountRwf, 0),
    cashTipsRwf: cash.reduce((a, p) => a + p.tipRwf, 0),
    cashRefundsRwf: refunds.filter((r) => r.method === 'cash').reduce((a, r) => a + r.amountRwf, 0),
    paidInRwf: movements
      .filter((m) => m.kind === 'paid_in' && m.status === 'approved')
      .reduce((a, m) => a + m.amountRwf, 0),
    paidOutRwf: movements
      .filter((m) => m.kind === 'paid_out' && m.status === 'approved')
      .reduce((a, m) => a + m.amountRwf, 0),
    pendingPaidOuts: movements.filter((m) => m.kind === 'paid_out' && m.status === 'pending_approval').length,
    takingsByMethod: [...byMethod.entries()].map(([method, v]) => ({ method, ...v })),
    tipsRwf: collected.reduce((a, p) => a + p.tipRwf, 0),
  };
}

export function expectedFrom(openingFloatRwf: number, c: ShiftCash): number {
  return openingFloatRwf + c.cashSalesRwf + c.cashTipsRwf - c.cashRefundsRwf + c.paidInRwf - c.paidOutRwf;
}

export async function presentShift(db: Db, shift: typeof cashierShifts.$inferSelect): Promise<PosShift> {
  const [cash, register, movements] = await Promise.all([
    shiftCash(db, shift.id),
    db.select({ name: posRegisters.name }).from(posRegisters).where(eq(posRegisters.id, shift.registerId)).limit(1),
    db.select().from(cashMovements).where(eq(cashMovements.shiftId, shift.id)).orderBy(desc(cashMovements.createdAt)),
  ]);
  const names = await namesOf(db, [
    shift.cashierUserId,
    shift.reviewedByUserId,
    ...movements.flatMap((m) => [m.requestedByUserId, m.decidedByUserId]),
  ]);
  const expected = shift.status === 'open' ? expectedFrom(shift.openingFloatRwf, cash) : (shift.expectedCashRwf ?? 0);
  return {
    id: shift.id,
    registerId: shift.registerId,
    registerName: register[0]?.name ?? '',
    cashierUserId: shift.cashierUserId,
    cashierName: names.get(shift.cashierUserId) ?? null,
    status: shift.status,
    openingFloatRwf: shift.openingFloatRwf,
    openedAt: shift.openedAt.toISOString(),
    closedAt: iso(shift.closedAt),
    cashSalesRwf: cash.cashSalesRwf + cash.cashTipsRwf,
    cashRefundsRwf: cash.cashRefundsRwf,
    paidInRwf: cash.paidInRwf,
    paidOutRwf: cash.paidOutRwf,
    expectedCashRwf: expected,
    countedCashRwf: shift.countedCashRwf,
    varianceRwf: shift.varianceRwf,
    takingsByMethod: cash.takingsByMethod,
    tipsRwf: cash.tipsRwf,
    closeNote: shift.closeNote,
    handoverNote: shift.handoverNote,
    reviewedByName: shift.reviewedByUserId ? (names.get(shift.reviewedByUserId) ?? null) : null,
    reviewNote: shift.reviewNote,
    movements: movements.map(
      (m): PosCashMovement => ({
        id: m.id,
        kind: m.kind,
        amountRwf: m.amountRwf,
        reason: m.reason,
        status: m.status,
        requestedByName: names.get(m.requestedByUserId) ?? null,
        decidedByName: m.decidedByUserId ? (names.get(m.decidedByUserId) ?? null) : null,
        createdAt: m.createdAt.toISOString(),
      }),
    ),
  };
}
