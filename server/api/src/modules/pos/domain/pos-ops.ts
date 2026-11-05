import { z } from 'zod';

/**
 * Requests and answers of the point of sale's stock, expenses and reports (POS spec sections 8 and 13 to
 * 15). The shapes live here, next to the services that fill them, because the app reads them as plain JSON;
 * the money rules (tax, settlement) stay in `@injishi/contracts`.
 */

const IsoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-11-05.');
const Uuid = z.string().uuid();

/** A report window in Kigali calendar days, both ends included. Absent means today. */
export const PosPeriodQuery = z.object({
  outletId: Uuid.optional(),
  from: IsoDay.optional(),
  to: IsoDay.optional(),
});
export type PosPeriodQuery = z.infer<typeof PosPeriodQuery>;

/** The stock of one outlet. */
export const PosStockQuery = z.object({ outletId: Uuid });
export type PosStockQuery = z.infer<typeof PosStockQuery>;

export const StockMovementKind =z.enum(['damaged', 'broken', 'expired', 'spillage', 'staff_use', 'received', 'count']);
export type StockMovementKind = z.infer<typeof StockMovementKind>;

/** One stock record. `count` sets the balance to the counted quantity; `received` adds; the rest take away. */
export const StockAdjustRequest = z.object({
  serviceItemId: Uuid,
  kind: StockMovementKind,
  quantity: z.number().int().min(0).max(100000),
  reason: z.string().trim().min(3, 'Say why, in a few words.').max(300),
});
export type StockAdjustRequest = z.infer<typeof StockAdjustRequest>;

export const PosExpenseCategory = z.enum(['utilities', 'cleaning', 'repairs', 'security', 'insurance', 'other']);
export const PosExpenseMethod = z.enum(['cash', 'momo', 'bank', 'other']);

export const RecordPosExpenseRequest = z.object({
  outletId: Uuid.optional(),
  category: PosExpenseCategory,
  amountRwf: z.number().int().min(1).max(10_000_000_000),
  paidOn: IsoDay.optional(),
  method: PosExpenseMethod.default('cash'),
  payeeName: z.string().trim().max(120).optional(),
  note: z.string().trim().max(300).optional(),
});
export type RecordPosExpenseRequest = z.infer<typeof RecordPosExpenseRequest>;

export const VoidPosExpenseRequest = z.object({ reason: z.string().trim().min(3, 'Say why.').max(300) });
export type VoidPosExpenseRequest = z.infer<typeof VoidPosExpenseRequest>;

// ── answers ────────────────────────────────────────────────────────────────────────────────────────

export type StockLevel = 'untracked' | 'ok' | 'low' | 'out';

export interface PosStockItem {
  id: string;
  name: string;
  category: string;
  priceRwf: number;
  stockQty: number | null;
  level: StockLevel;
  /** Estimated: price times the demo cost ratio. No cost price is stored per item yet. */
  unitCostRwf: number;
  valueRwf: number;
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

export interface PosMethodTotal {
  method: string;
  count: number;
  amountRwf: number;
  tipRwf: number;
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
  sales: {
    orders: number;
    completedOrders: number;
    totalRwf: number;
    taxRwf: number;
    discountRwf: number;
    netOfTaxRwf: number;
    averageOrderRwf: number;
  };
  payments: { collectedRwf: number; refundsRwf: number; tipsRwf: number; byMethod: PosMethodTotal[] };
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
