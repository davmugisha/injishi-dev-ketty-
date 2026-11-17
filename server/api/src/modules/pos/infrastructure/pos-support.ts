import {
  orderAmounts,
  rateToBps,
  settlementOf,
  type PosOrderStatus,
  type PosPaymentMethod,
  type PosTaxMode,
  type Settlement,
} from '@injishi/contracts';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, ne, or, sql, type SQL } from 'drizzle-orm';

import {
  configEntries,
  kitchenTicketItems,
  outlets,
  posAuditEvents,
  posCounters,
  posOrderDiscounts,
  posOrderEvents,
  posOrderLines,
  posOrders,
  posOutletSettings,
  posPayments,
  properties,
  serviceCategories,
  serviceItems,
  users,
} from '../../../database/drizzle/schema';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { inBranchScope } from '../../../shared/auth/branch-scope';
import type { Database } from '../../../shared/database/database.module';

/**
 * What every POS service shares: the outlet in scope, its settings, the tax
 * rates in force, numbering, the audit row, and the one recompute that keeps
 * an order's stored totals equal to what `orderAmounts` says of its lines.
 *
 * Every write helper takes the transaction it runs in, so a change and its
 * audit row, its totals and its status always commit together.
 */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
export type Db = Database | Tx;

/**
 * The outlet a menu item sells from: its own, or, with none of its own, the outlet of its menu section.
 *
 * This is the platform's rule (guest ordering and the catalogue read an item's outlet the same way), and it is why
 * a product an owner adds through the catalogue, which records only its section, reaches the till. Every query
 * that asks "is this item on this outlet's menu" joins `service_categories` and uses this, never the item's own
 * `outlet_id` alone.
 */
export const itemOutlet = sql<string | null>`coalesce(${serviceItems.outletId}, ${serviceCategories.outletId})`;
export const itemInOutlet = (outletId: string): SQL => sql`${itemOutlet} = ${outletId}`;

export interface OutletRow {
  id: string;
  workspaceId: string;
  propertyId: string | null;
  name: string;
  outletKind: string;
  taxEntityOrgId: string;
  branchName: string | null;
}

/** The outlet, if it is this workspace's and inside the caller's branch scope; 404 otherwise. */
export async function outletInScope(db: Db, ws: ScopedWorkspace, outletId: string): Promise<OutletRow> {
  const [row] = await db
    .select({
      id: outlets.id,
      workspaceId: outlets.workspaceId,
      propertyId: outlets.propertyId,
      name: outlets.name,
      outletKind: outlets.outletKind,
      taxEntityOrgId: outlets.taxEntityOrgId,
      branchName: properties.name,
    })
    .from(outlets)
    .leftJoin(properties, eq(properties.id, outlets.propertyId))
    .where(
      and(
        eq(outlets.id, outletId),
        eq(outlets.workspaceId, ws.workspaceId),
        eq(outlets.status, 'active'),
        inBranchScope(outlets.propertyId, ws.branchScope),
      ),
    )
    .limit(1);
  if (!row) throw new NotFoundException('That outlet is not available to you.');
  return row;
}

/** Every active outlet of the workspace the caller's scope covers, in the outlets' own order. */
export async function outletsInScope(db: Db, ws: ScopedWorkspace): Promise<OutletRow[]> {
  return db
    .select({
      id: outlets.id,
      workspaceId: outlets.workspaceId,
      propertyId: outlets.propertyId,
      name: outlets.name,
      outletKind: outlets.outletKind,
      taxEntityOrgId: outlets.taxEntityOrgId,
      branchName: properties.name,
    })
    .from(outlets)
    .leftJoin(properties, eq(properties.id, outlets.propertyId))
    .where(
      and(
        eq(outlets.workspaceId, ws.workspaceId),
        eq(outlets.status, 'active'),
        inBranchScope(outlets.propertyId, ws.branchScope),
      ),
    )
    .orderBy(asc(outlets.sortOrder), asc(outlets.name));
}

export interface SettingsRow {
  outletId: string;
  taxMode: PosTaxMode;
  discountLimitBps: number;
  enabledMethods: PosPaymentMethod[];
  receiptHeader: string;
  receiptFooter: string;
  venueTin: string;
  venuePhone: string;
  venueAddress: string;
  /** Minutes after midnight (Kigali) at which a business day starts (0 is the calendar day). */
  businessDayStartMinutes: number;
}

/** The outlet's settings, written with the defaults the first time anyone asks. */
export async function settingsFor(db: Db, outlet: Pick<OutletRow, 'id' | 'workspaceId'>): Promise<SettingsRow> {
  await db
    .insert(posOutletSettings)
    .values({ outletId: outlet.id, workspaceId: outlet.workspaceId })
    .onConflictDoNothing();
  const [row] = await db
    .select({
      outletId: posOutletSettings.outletId,
      taxMode: posOutletSettings.taxMode,
      discountLimitBps: posOutletSettings.discountLimitBps,
      enabledMethods: posOutletSettings.enabledMethods,
      receiptHeader: posOutletSettings.receiptHeader,
      receiptFooter: posOutletSettings.receiptFooter,
      venueTin: posOutletSettings.venueTin,
      venuePhone: posOutletSettings.venuePhone,
      venueAddress: posOutletSettings.venueAddress,
      businessDayStartMinutes: posOutletSettings.businessDayStartMinutes,
    })
    .from(posOutletSettings)
    .where(eq(posOutletSettings.outletId, outlet.id))
    .limit(1);
  if (!row) throw new NotFoundException('That outlet is not available to you.');
  return row;
}

/** The tax rates in force at `at`, as basis points per tax code (the same config row the folio prices by). */
export async function taxRatesBps(db: Db, at: Date): Promise<Record<string, number>> {
  const [row] = await db
    .select({ value: configEntries.value })
    .from(configEntries)
    .where(
      and(
        eq(configEntries.configType, 'tax_rates'),
        or(isNull(configEntries.effectiveFrom), sql`${configEntries.effectiveFrom} <= ${at}`),
        or(isNull(configEntries.effectiveTo), sql`${configEntries.effectiveTo} > ${at}`),
      ),
    )
    .orderBy(desc(configEntries.effectiveFrom), desc(configEntries.version))
    .limit(1);
  const value = row?.value;
  if (!value || typeof value !== 'object') {
    throw new UnprocessableEntityException(
      'No tax rates are effective right now, so nothing can be priced. Set them in config first.',
    );
  }
  const out: Record<string, number> = {};
  for (const [code, rate] of Object.entries(value as Record<string, unknown>)) {
    if (typeof rate === 'number') out[code] = rateToBps(rate);
  }
  return out;
}

/** `yymmdd` of `at` in Africa/Kigali, the day a POS number counts in. */
export function kigaliPeriod(at: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kigali',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}${get('month')}${get('day')}`;
}

/** The next number of `kind` today, under the counter row's lock, so two tills never take the same one. */
export async function nextNumber(tx: Tx, workspaceId: string, kind: string, at: Date): Promise<number> {
  const period = kigaliPeriod(at);
  const [row] = await tx
    .insert(posCounters)
    .values({ workspaceId, kind, period, value: 1 })
    .onConflictDoUpdate({
      target: [posCounters.workspaceId, posCounters.kind, posCounters.period],
      set: { value: sql`${posCounters.value} + 1` },
    })
    .returning({ value: posCounters.value });
  if (!row) throw new Error('The POS counter did not answer.');
  return row.value;
}

export function orderNumberOf(period: string, n: number): string {
  return `POS-${period}-${String(n).padStart(4, '0')}`;
}

export interface AuditInput {
  workspaceId: string;
  outletId: string | null;
  /** Null only for what a guest did from their table's QR (migration 0156): nobody on the staff did it. */
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}

/** One audit row, in the caller's transaction. */
export async function audit(tx: Tx, a: AuditInput): Promise<void> {
  await tx.insert(posAuditEvents).values({
    workspaceId: a.workspaceId,
    outletId: a.outletId,
    actorUserId: a.actorUserId,
    action: a.action,
    entityType: a.entityType,
    entityId: a.entityId,
    before: a.before ?? null,
    after: a.after ?? null,
    reason: a.reason ?? null,
  });
}

export async function orderEvent(
  tx: Tx,
  e: {
    orderId: string;
    kind: string;
    actorUserId: string | null;
    fromStatus?: PosOrderStatus | null;
    toStatus?: PosOrderStatus | null;
    data?: unknown;
  },
): Promise<void> {
  await tx.insert(posOrderEvents).values({
    orderId: e.orderId,
    kind: e.kind,
    actorUserId: e.actorUserId,
    fromStatus: e.fromStatus ?? null,
    toStatus: e.toStatus ?? null,
    data: e.data ?? null,
  });
}

export type OrderRow = typeof posOrders.$inferSelect;

/** The order, if it is this workspace's and inside the caller's branch scope. Locked FOR UPDATE inside a transaction. */
export async function orderInScope(db: Db, ws: ScopedWorkspace, orderId: string, lock = false): Promise<OrderRow> {
  const query = db
    .select()
    .from(posOrders)
    .where(
      and(
        eq(posOrders.id, orderId),
        eq(posOrders.workspaceId, ws.workspaceId),
        inBranchScope(posOrders.propertyId, ws.branchScope),
      ),
    )
    .limit(1);
  const [row] = lock ? await query.for('update') : await query;
  if (!row) throw new NotFoundException('That order is not available to you.');
  return row;
}

/** The payments' settlement of one order, from its stored total. */
export async function settlementFor(db: Db, order: Pick<OrderRow, 'id' | 'totalRwf'>): Promise<Settlement> {
  const rows = await db
    .select({ amountRwf: posPayments.amountRwf, refundedRwf: posPayments.refundedRwf, status: posPayments.status })
    .from(posPayments)
    .where(eq(posPayments.orderId, order.id));
  return settlementOf(order.totalRwf, rows);
}

/**
 * Recompute an order's lines and totals from its live lines and approved
 * discounts, and store them. A discount larger than what is left to discount
 * (a line voided under an order discount) is applied only up to what is left,
 * so the stored amounts are always ones `orderAmounts` could produce.
 */
export async function recomputeOrder(tx: Tx, order: Pick<OrderRow, 'id' | 'taxMode'>): Promise<{ totalRwf: number }> {
  const lines = await tx
    .select({
      id: posOrderLines.id,
      unitPriceRwf: posOrderLines.unitPriceRwf,
      quantity: posOrderLines.quantity,
      taxRateBps: posOrderLines.taxRateBps,
    })
    .from(posOrderLines)
    .where(and(eq(posOrderLines.orderId, order.id), ne(posOrderLines.status, 'voided')))
    .orderBy(asc(posOrderLines.createdAt), asc(posOrderLines.id));
  const discounts = await tx
    .select({ orderLineId: posOrderDiscounts.orderLineId, amountRwf: posOrderDiscounts.amountRwf })
    .from(posOrderDiscounts)
    .where(and(eq(posOrderDiscounts.orderId, order.id), eq(posOrderDiscounts.status, 'approved')));

  const lineDiscount = new Map<string, number>();
  let orderDiscount = 0;
  for (const d of discounts) {
    if (d.orderLineId) lineDiscount.set(d.orderLineId, (lineDiscount.get(d.orderLineId) ?? 0) + d.amountRwf);
    else orderDiscount += d.amountRwf;
  }
  const inputs = lines.map((l) => ({
    unitPriceRwf: l.unitPriceRwf,
    quantity: l.quantity,
    lineDiscountRwf: Math.min(lineDiscount.get(l.id) ?? 0, l.unitPriceRwf * l.quantity),
    taxRateBps: l.taxRateBps,
  }));
  const left = inputs.reduce((a, l) => a + l.unitPriceRwf * l.quantity - l.lineDiscountRwf, 0);
  const bill = orderAmounts(inputs, Math.min(orderDiscount, left), order.taxMode);

  for (const [i, l] of lines.entries()) {
    const priced = bill.lines[i];
    const input = inputs[i];
    if (!priced || !input) continue;
    await tx
      .update(posOrderLines)
      .set({
        lineDiscountRwf: input.lineDiscountRwf,
        orderDiscountShareRwf: priced.orderDiscountShareRwf,
        grossRwf: priced.grossRwf,
        discountRwf: priced.discountRwf,
        taxRwf: priced.taxRwf,
        totalRwf: priced.totalRwf,
        updatedAt: new Date(),
      })
      .where(eq(posOrderLines.id, l.id));
  }
  await tx
    .update(posOrders)
    .set({
      grossRwf: bill.grossRwf,
      discountRwf: bill.discountRwf,
      taxRwf: bill.taxRwf,
      totalRwf: bill.totalRwf,
      updatedAt: new Date(),
    })
    .where(eq(posOrders.id, order.id));
  return { totalRwf: bill.totalRwf };
}

/**
 * The order's own status, derived from its lines and tickets, then
 * `completed` once it is both served and settled. Draft, cancelled and
 * completed orders are left alone. Returns the status it now has.
 */
export async function refreshOrderStatus(tx: Tx, orderId: string, actorUserId: string | null): Promise<PosOrderStatus> {
  const [order] = await tx.select().from(posOrders).where(eq(posOrders.id, orderId)).limit(1).for('update');
  if (!order) throw new NotFoundException('That order is not available to you.');
  if (order.status === 'cancelled' || order.status === 'completed') return order.status;

  const sent = await tx
    .select({ id: posOrderLines.id })
    .from(posOrderLines)
    .where(and(eq(posOrderLines.orderId, orderId), eq(posOrderLines.status, 'sent')));
  // The ITEMS of this order's own lines, not the tickets of this order: a
  // split moves lines to a new order while their ticket stays where it was.
  const tickets = await tx
    .select({ status: kitchenTicketItems.status })
    .from(kitchenTicketItems)
    .innerJoin(posOrderLines, eq(posOrderLines.id, kitchenTicketItems.orderLineId))
    .where(
      and(
        eq(posOrderLines.orderId, orderId),
        eq(posOrderLines.status, 'sent'),
        ne(kitchenTicketItems.status, 'cancelled'),
      ),
    );

  let next: PosOrderStatus;
  if (sent.length === 0) {
    next = order.submittedAt ? 'delivered' : 'draft';
  } else if (tickets.length === 0 || tickets.every((t) => t.status === 'served')) {
    next = 'delivered';
  } else if (tickets.every((t) => t.status === 'ready' || t.status === 'served')) {
    next = 'ready';
  } else if (tickets.some((t) => t.status !== 'queued')) {
    next = 'in_progress';
  } else {
    next = 'submitted';
  }

  const [drafts] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(posOrderLines)
    .where(and(eq(posOrderLines.orderId, orderId), eq(posOrderLines.status, 'draft')));
  const hasDraft = (drafts?.n ?? 0) > 0;

  const settlement = await settlementFor(tx, order);
  const now = new Date();
  const patch: Partial<typeof posOrders.$inferInsert> = {};
  if (settlement.settled && order.totalRwf > 0 && !order.settledAt) patch.settledAt = now;
  // Never complete over a round not yet sent.
  if (next === 'delivered' && !hasDraft && settlement.settled && order.totalRwf > 0) {
    next = 'completed';
    patch.completedAt = now;
  }
  if (next !== order.status || Object.keys(patch).length > 0) {
    await tx
      .update(posOrders)
      .set({ ...patch, status: next, updatedAt: now })
      .where(eq(posOrders.id, orderId));
    if (next !== order.status) {
      await orderEvent(tx, { orderId, kind: 'status', actorUserId, fromStatus: order.status, toStatus: next });
    }
  }
  return next;
}

/** Display names for a set of user ids, read once. */
export async function namesOf(db: Db, ids: readonly (string | null | undefined)[]): Promise<Map<string, string | null>> {
  const wanted = [...new Set(ids.filter((v): v is string => !!v))];
  if (wanted.length === 0) return new Map();
  const rows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, wanted));
  return new Map(rows.map((r) => [r.id, r.name]));
}
