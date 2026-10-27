/** Live sources for the admin area: API responses presented as the admin fixture document types. */
import { ApiError } from "../api";
import { defineSources, type SourceContext } from "./types";

// ── The money desk document (`admin.moneyDesk`, 073-gtbank-payments AC-19) ──
//
// Declared here, as market.ts declares CheckoutDocument, rather than imported from the fixture types, so
// this file adds no import of the demo package (ADR-074, no-demo-data). The view (features/admin/money-desk.tsx)
// takes these types, and AdminMoneyView hands it the demo document typed by @injishi/data's `MoneyDesk`, so
// TypeScript checks the fixture against this shape there.

export type MoneyBucket = "parked" | "reversals" | "owed" | "short" | "over_limit" | "waiting_on_payer";

export interface MoneyDeskRow {
  id: string;
  bucket: MoneyBucket;
  /** Ours (`INJ…`). */
  reference: string;
  providerReference: string | null;
  direction: string;
  operation: string;
  amount: number;
  status: string;
  reason: string | null;
  /** The wallet, masked. */
  party: string | null;
  bookingReference: string | null;
  /** How long it has waited ("3 min", "2 h"). */
  age: string;
  pendingOverride: { id: string; action: string } | null;
}

export interface MoneyDeskOverride {
  id: string;
  action: string;
  state: string;
  reason: string;
  subjectReference: string | null;
  amount: number | null;
  initiatedBy: string;
  createdAt: string;
  /** A super admin who did not request it. */
  canDecide: boolean;
}

export interface MoneyDesk {
  id: string;
  /** "none" for a staff role that cannot read finance (ops, compliance). */
  access: "full" | "none";
  provider: string;
  mode: string;
  available: number;
  inFlight: number;
  queued: number;
  parked: number;
  lastRun: string | null;
  counts: Record<MoneyBucket, number>;
  rows: MoneyDeskRow[];
  overrides: MoneyDeskOverride[];
  canRequest: boolean;
  canDecide: boolean;
}

// ── The API's shapes (MoneyQueue, MoneyBalance, MoneyOverrideList in @injishi/contracts) ──

interface ApiQueueRow {
  id: string;
  bucket: MoneyDeskRow["bucket"];
  reference: string;
  providerReference: string | null;
  direction: string;
  operation: string;
  amountRwf: number;
  status: string;
  reason: string | null;
  party: string | null;
  bookingReference: string | null;
  ageSeconds: number;
  pendingOverride: { id: string; action: string } | null;
}
interface ApiQueue {
  rows: ApiQueueRow[];
  counts: Record<MoneyDeskRow["bucket"], number>;
}
interface ApiBalance {
  provider: string;
  mode: string;
  availableRwf: number;
  inFlightRwf: number;
  queuedRwf: number;
  parkedCount: number;
  lastReconciliation: { status: string; ranAt: string } | null;
}
interface ApiOverride {
  id: string;
  action: string;
  state: string;
  reason: string;
  subjectReference: string | null;
  amountRwf: number | null;
  initiatedBy: string;
  createdAt: string;
  canDecide: boolean;
}
interface ApiStaff {
  permissions: string[];
}

const EMPTY_COUNTS: MoneyDesk["counts"] = {
  parked: 0,
  reversals: 0,
  owed: 0,
  short: 0,
  over_limit: 0,
  waiting_on_payer: 0,
};

/** "3 min", "2 h", "4 d": how long a row has waited. */
function age(seconds: number): string {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86_400)} d`;
}

/**
 * The money queue and the balance (073-gtbank-payments AC-19), as one document. A staffer whose role cannot
 * read finance (ops, compliance) gets the desk with `access: "none"`, so the screen says so rather than
 * showing an empty queue that would read as "nothing needs anyone".
 */
async function moneyDesk(ctx: SourceContext): Promise<MoneyDesk[]> {
  let staff: ApiStaff;
  let queue: ApiQueue;
  let balance: ApiBalance;
  let overrides: { overrides: ApiOverride[] };
  try {
    [staff, queue, balance, overrides] = await Promise.all([
      ctx.api.get<ApiStaff>("/api/v1/me/staff"),
      ctx.api.get<ApiQueue>("/api/v1/admin/finance/payments"),
      ctx.api.get<ApiBalance>("/api/v1/admin/finance/payments/balance"),
      ctx.api.get<{ overrides: ApiOverride[] }>("/api/v1/admin/money-overrides"),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.forbidden) {
      return [
        {
          id: "desk",
          access: "none",
          provider: "",
          mode: "",
          available: 0,
          inFlight: 0,
          queued: 0,
          parked: 0,
          lastRun: null,
          counts: EMPTY_COUNTS,
          rows: [],
          overrides: [],
          canRequest: false,
          canDecide: false,
        },
      ];
    }
    throw error;
  }
  const rows: MoneyDeskRow[] = queue.rows.map((r) => ({
    id: r.id,
    bucket: r.bucket,
    reference: r.reference,
    providerReference: r.providerReference,
    direction: r.direction,
    operation: r.operation,
    amount: r.amountRwf,
    status: r.status,
    reason: r.reason,
    party: r.party,
    bookingReference: r.bookingReference,
    age: age(r.ageSeconds),
    pendingOverride: r.pendingOverride,
  }));
  const pending: MoneyDeskOverride[] = overrides.overrides.map((o) => ({
    id: o.id,
    action: o.action,
    state: o.state,
    reason: o.reason,
    subjectReference: o.subjectReference,
    amount: o.amountRwf,
    initiatedBy: o.initiatedBy,
    createdAt: o.createdAt,
    canDecide: o.canDecide,
  }));
  return [
    {
      id: "desk",
      access: "full",
      provider: balance.provider,
      mode: balance.mode,
      available: balance.availableRwf,
      inFlight: balance.inFlightRwf,
      queued: balance.queuedRwf,
      parked: balance.parkedCount,
      lastRun: balance.lastReconciliation
        ? `${balance.lastReconciliation.status} · ${balance.lastReconciliation.ranAt.slice(0, 10)}`
        : null,
      counts: { ...EMPTY_COUNTS, ...queue.counts },
      rows,
      overrides: pending,
      canRequest: staff.permissions.includes("admin.payout.release"),
      canDecide: staff.permissions.includes("admin.money.override"),
    },
  ];
}

export const sources = defineSources({
  "admin.moneyDesk": { list: moneyDesk },
});
