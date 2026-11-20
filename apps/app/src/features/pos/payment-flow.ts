/**
 * The payment workflow's words and steps: Customer → Cashier → Waiter → Receipt → Table available.
 *
 * 1. The waiter presses Pay (MTN MoMo or Airtel Money): the payment is PENDING.
 * 2. The cashier checks the money arrived and confirms it: the payment is paid, and the bill settles when nothing else
 *    is owed.
 * 3. The waiter is told, can print or email the receipt, then releases the table when the guests leave (Cleaning).
 * 4. Once the table is cleared and cleaned, the waiter makes it Available.
 *
 * Pure: no React, no fetch, so every rule here is tested on its own.
 */

/** "RWF 14,000", as `money` in shared.tsx prints it. */
const money = (n: number) => `RWF ${Math.round(n).toLocaleString("en-US")}`;

export type UpdateOutcome = "confirmed" | "not_received";

export interface UpdateFacts {
  outcome: UpdateOutcome;
  billFullyPaid: boolean;
  outstandingRwf: number;
  orderType: string;
  tableLabel: string | null;
  sessionOpen: boolean;
  tableStatus: string | null;
  tableSessionId: string | null;
  tableId: string | null;
}

/** Where the bill is: its table, or takeaway / delivery. */
export function whereOf(orderType: string, tableLabel: string | null): string {
  if (tableLabel) return `Table ${tableLabel}`;
  if (orderType === "delivery") return "Delivery";
  return "Takeaway";
}

/** What the waiter reads first. */
export function updateHeadline(u: Pick<UpdateFacts, "outcome" | "billFullyPaid" | "outstandingRwf">): string {
  if (u.outcome === "not_received") return "Payment not received. The bill is still open.";
  if (u.billFullyPaid) return "Payment successful. Bill fully paid.";
  return `Payment successful. ${money(u.outstandingRwf)} still to pay.`;
}

/**
 * The table step the waiter may take next, after a confirmed payment:
 * - `release` once the bill is fully paid and the guests are still seated (they leave: the table goes to Cleaning);
 * - `clean` once the table is being cleaned (cleared and cleaned: the table becomes Available);
 * - null otherwise (a takeaway, a bill still owed, a table already free).
 */
export function nextTableStep(u: UpdateFacts): "release" | "clean" | null {
  if (u.outcome !== "confirmed" || !u.billFullyPaid || !u.tableId) return null;
  if (u.sessionOpen && u.tableSessionId) return "release";
  if (u.tableStatus === "cleaning") return "clean";
  return null;
}

/** How long a payment has waited, in words the desk reads at a glance. */
export function waitedFor(startedAt: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${minutes % 60} min ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

/** A payment the customer started more than 10 minutes ago: the cashier should look at it now. */
export function needsAttention(startedAt: string, now: number): boolean {
  return now - new Date(startedAt).getTime() > 10 * 60_000;
}

/** Everything still owed on the bill is held by payments waiting for the cashier. */
export function waitingOnCashier(s: { payableRwf: number; pendingRwf: number }): boolean {
  return s.payableRwf === 0 && s.pendingRwf > 0;
}

// ── The Cashier Desk's reading of bills (display only: nothing here takes or settles a payment) ─────────

/** Where a bill stands for the cashier, in one word. */
export type BillStage = "ready" | "preparing" | "not_sent" | "confirming";

export const BILL_STAGE_LABEL: Readonly<Record<BillStage, string>> = {
  ready: "Ready to pay",
  preparing: "Still being prepared",
  not_sent: "Not sent yet",
  confirming: "Waiting for confirmation",
};

/** The order in which the desk lists bills: what can be paid now first. */
const STAGE_ORDER: Readonly<Record<BillStage, number>> = { ready: 0, preparing: 1, not_sent: 2, confirming: 3 };

export interface BillFacts {
  status: string;
  createdAt: string;
  orderNumber: string;
  tableLabel: string | null;
  waiterName: string | null;
  customer?: { fullName: string } | null;
  settlement: { payableRwf: number; pendingRwf: number };
}

/** Held by a mobile payment the cashier still has to confirm; otherwise served (ready), in the kitchen, or a draft. */
export function billStage(b: Pick<BillFacts, "status" | "settlement">): BillStage {
  if (waitingOnCashier(b.settlement)) return "confirming";
  if (b.status === "delivered" || b.status === "ready") return "ready";
  if (b.status === "draft") return "not_sent";
  return "preparing";
}

/** Bills in desk order: ready to pay first, then by age (oldest first). */
export function sortBills<T extends Pick<BillFacts, "status" | "settlement" | "createdAt">>(bills: T[]): T[] {
  return [...bills].sort(
    (a, b) => STAGE_ORDER[billStage(a)] - STAGE_ORDER[billStage(b)] || a.createdAt.localeCompare(b.createdAt),
  );
}

/** A search over what a cashier is told: the table, the bill number, the waiter or the customer. */
export function matchesBill(
  b: Pick<BillFacts, "orderNumber" | "tableLabel" | "waiterName" | "customer">,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    b.orderNumber,
    b.tableLabel ? `table ${b.tableLabel}` : "",
    b.waiterName ?? "",
    b.customer?.fullName ?? "",
  ].some((v) => v.toLowerCase().includes(q));
}

/** The calendar day in Kigali (YYYY-MM-DD) of an instant. */
export function kigaliDay(at: string | number | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kigali",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(at));
}

/**
 * The bills paid in full today (Kigali), newest first, whatever the method: those settled and closed, and those
 * settled but still being served. One bill once, even when it is in both lists.
 */
export function paidToday<
  T extends { id: string; totalRwf: number; settledAt: string | null; settlement: { settled: boolean } },
>(bills: T[], now: number): T[] {
  const today = kigaliDay(now);
  const seen = new Set<string>();
  return bills
    .filter((b) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return b.totalRwf > 0 && b.settlement.settled && !!b.settledAt && kigaliDay(b.settledAt) === today;
    })
    .sort((a, b) => (b.settledAt ?? "").localeCompare(a.settledAt ?? ""));
}

/** How long a mobile payment has waited, and how loudly the desk says so. */
export function waitingNote(startedAt: string, now: number): { text: string; tone: "new" | "waiting" | "old" } {
  const minutes = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60_000));
  if (minutes < 10) return { text: "New", tone: "new" };
  if (minutes < 60) return { text: `Waiting ${minutes} min`, tone: "waiting" };
  if (kigaliDay(startedAt) !== kigaliDay(now)) return { text: "Waiting since an earlier day", tone: "old" };
  return { text: `Waiting ${Math.floor(minutes / 60)} h ${minutes % 60} min`, tone: "old" };
}

/** The methods that paid a bill (successful or later refunded), each once, in the order they were taken. */
export function paidMethods(payments: { method: string; status: string }[]): string[] {
  return [
    ...new Set(payments.filter((p) => p.status === "successful" || p.status === "refunded").map((p) => p.method)),
  ];
}

/** The updates not dismissed yet, newest first, at most `limit`. */
export function freshUpdates<T extends { id: string; at: string }>(
  updates: T[],
  dismissed: ReadonlySet<string>,
  limit = 4,
): T[] {
  return updates
    .filter((u) => !dismissed.has(u.id))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

// ── The waiter's reading of bills and tables (display only: the API still decides every release) ─────

export interface BillMoneyFacts {
  totalRwf: number;
  settlement: {
    collectedRwf: number;
    pendingRwf: number;
    outstandingRwf: number;
    payableRwf: number;
    settled: boolean;
  };
}

/**
 * What a bill shows the waiter: the total, what was collected, what waits for the cashier (NOT paid), and the
 * balance still to ask for. "paid" only when the bill is settled: everything collected and nothing in flight.
 */
export function billMoney(b: BillMoneyFacts): {
  totalRwf: number;
  paidRwf: number;
  waitingRwf: number;
  balanceRwf: number;
  state: "paid" | "waiting" | "part_paid" | "owes";
} {
  const s = b.settlement;
  const state =
    s.settled && b.totalRwf > 0
      ? "paid"
      : s.pendingRwf > 0 && s.payableRwf === 0
        ? "waiting"
        : s.collectedRwf > 0 || s.pendingRwf > 0
          ? "part_paid"
          : "owes";
  return { totalRwf: b.totalRwf, paidRwf: s.collectedRwf, waitingRwf: s.pendingRwf, balanceRwf: s.payableRwf, state };
}

export const BILL_MONEY_LABEL = {
  paid: "Paid in full",
  waiting: "Waiting for the cashier",
  part_paid: "Part paid",
  owes: "Not paid",
} as const;

/**
 * Why the guests' table cannot be released yet, in the API's own order of checks (a draft, then anything still owed
 * or waiting for the cashier). Empty: the release may be asked for; the API checks again and stays the judge.
 */
export function releaseBlockers(bills: SittingBill[]): string[] {
  return releaseBlockerList(bills).map((b) => b.text);
}

/** A bill of one table sitting, as the floor and the payment card read it. */
export type SittingBill = BillMoneyFacts & { id?: string; orderNumber: string; status: string };

/** One reason the release waits, with the bill it comes from (so the screen can open that bill). */
export interface ReleaseBlocker {
  orderId: string | null;
  orderNumber: string;
  kind: "draft" | "waiting" | "owes";
  text: string;
}

/** {@link releaseBlockers} with the bill of each reason: a draft, money waiting for the cashier, money owed. */
export function releaseBlockerList(bills: SittingBill[]): ReleaseBlocker[] {
  const out: ReleaseBlocker[] = [];
  for (const b of bills) {
    if (b.status === "cancelled") continue;
    const of = { orderId: b.id ?? null, orderNumber: b.orderNumber };
    if (b.status === "draft") {
      out.push({ ...of, kind: "draft", text: `${b.orderNumber} has not been sent yet. Send it or cancel it first.` });
      continue;
    }
    if (b.settlement.pendingRwf > 0) {
      out.push({
        ...of,
        kind: "waiting",
        text: `${b.orderNumber}: ${money(b.settlement.pendingRwf)} is waiting for the cashier to confirm the MoMo or Airtel payment.`,
      });
    }
    if (b.settlement.payableRwf > 0) {
      out.push({ ...of, kind: "owes", text: `${b.orderNumber} still owes ${money(b.settlement.payableRwf)}.` });
    }
  }
  return out;
}

/**
 * What the whole sitting still needs, over all its bills: money to ask for, money waiting for the cashier (NOT
 * paid), and bills not sent yet. Cancelled bills do not count.
 */
export function sittingMoney(bills: SittingBill[]): { payableRwf: number; pendingRwf: number; drafts: number } {
  let payableRwf = 0;
  let pendingRwf = 0;
  let drafts = 0;
  for (const b of bills) {
    if (b.status === "cancelled") continue;
    if (b.status === "draft") drafts += 1;
    payableRwf += b.settlement.payableRwf;
    pendingRwf += b.settlement.pendingRwf;
  }
  return { payableRwf, pendingRwf, drafts };
}

/** The table is served by the person signed in (compared by display name, as the floor shows it). */
export function isMyTable(t: { waiterName: string | null }, myName: string | null | undefined): boolean {
  const a = (t.waiterName ?? "").trim().toLowerCase();
  const b = (myName ?? "").trim().toLowerCase();
  return a !== "" && a === b;
}
