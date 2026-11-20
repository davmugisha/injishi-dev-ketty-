import { describe, expect, test } from "vitest";
import {
  BILL_MONEY_LABEL,
  BILL_STAGE_LABEL,
  billMoney,
  billStage,
  freshUpdates,
  isMyTable,
  kigaliDay,
  matchesBill,
  needsAttention,
  nextTableStep,
  paidMethods,
  paidToday,
  releaseBlockerList,
  releaseBlockers,
  sittingMoney,
  sortBills,
  updateHeadline,
  waitedFor,
  waitingNote,
  waitingOnCashier,
  whereOf,
} from "@/features/pos/payment-flow";

describe("the Cashier Desk's reading of bills (display only)", () => {
  const bill = (over: Record<string, unknown>) => ({
    id: "x",
    status: "delivered",
    createdAt: "2026-11-20T08:00:00Z",
    orderNumber: "POS-261120-0007",
    tableLabel: "T6",
    waiterName: "Jean Bosco",
    customer: null as { fullName: string } | null,
    totalRwf: 6000,
    settledAt: null as string | null,
    settlement: { payableRwf: 6000, pendingRwf: 0, settled: false },
    ...over,
  });

  test("each bill gets one plain stage", () => {
    expect(BILL_STAGE_LABEL[billStage(bill({}))]).toBe("Ready to pay");
    expect(billStage(bill({ status: "ready" }))).toBe("ready");
    expect(BILL_STAGE_LABEL[billStage(bill({ status: "in_progress" }))]).toBe("Still being prepared");
    expect(billStage(bill({ status: "submitted" }))).toBe("preparing");
    expect(BILL_STAGE_LABEL[billStage(bill({ status: "draft" }))]).toBe("Not sent yet");
    // Held by a MoMo/Airtel payment the cashier still has to confirm, whatever the kitchen says.
    expect(billStage(bill({ settlement: { payableRwf: 0, pendingRwf: 6000, settled: false } }))).toBe("confirming");
  });

  test("ready to pay comes first, then by age", () => {
    const list = [
      bill({ id: "a", status: "in_progress", createdAt: "2026-11-20T07:00:00Z" }),
      bill({ id: "b", status: "delivered", createdAt: "2026-11-20T09:00:00Z" }),
      bill({ id: "c", status: "delivered", createdAt: "2026-11-20T08:00:00Z" }),
      bill({ id: "d", settlement: { payableRwf: 0, pendingRwf: 6000, settled: false } }),
    ];
    expect(sortBills(list).map((b) => b.id)).toEqual(["c", "b", "a", "d"]);
  });

  test("search finds a table, a bill number, a waiter or a customer", () => {
    const b = bill({ customer: { fullName: "Aline Uwase" } });
    expect(matchesBill(b, "")).toBe(true);
    expect(matchesBill(b, "t6")).toBe(true);
    expect(matchesBill(b, "0007")).toBe(true);
    expect(matchesBill(b, "bosco")).toBe(true);
    expect(matchesBill(b, "aline")).toBe(true);
    expect(matchesBill(b, "T9")).toBe(false);
  });

  test("paid today: settled today in Kigali, any method, newest first, each bill once", () => {
    const now = Date.parse("2026-11-20T10:00:00Z"); // 12:00 in Kigali
    const settled = { payableRwf: 0, pendingRwf: 0, settled: true };
    const list = [
      bill({ id: "cash", settledAt: "2026-11-20T08:00:00Z", settlement: settled }),
      bill({ id: "momo", settledAt: "2026-11-20T09:30:00Z", settlement: settled }),
      bill({ id: "momo", settledAt: "2026-11-20T09:30:00Z", settlement: settled }), // in both lists
      bill({ id: "yesterday", settledAt: "2026-11-19T21:30:00Z", settlement: settled }), // 23:30 Kigali, 19 Nov
      bill({ id: "late-night", settledAt: "2026-11-19T22:30:00Z", settlement: settled }), // 00:30 Kigali, 20 Nov
      bill({ id: "pending", settledAt: null, settlement: { payableRwf: 0, pendingRwf: 6000, settled: false } }),
      bill({ id: "free", totalRwf: 0, settledAt: "2026-11-20T08:00:00Z", settlement: settled }),
    ];
    expect(paidToday(list, now).map((b) => b.id)).toEqual(["momo", "cash", "late-night"]);
    expect(kigaliDay("2026-11-19T22:30:00Z")).toBe("2026-11-20");
  });

  test("how long a mobile payment waited, and how loudly", () => {
    const now = Date.parse("2026-11-20T12:00:00Z");
    expect(waitingNote("2026-11-20T11:55:00Z", now)).toEqual({ text: "New", tone: "new" });
    expect(waitingNote("2026-11-20T11:30:00Z", now)).toEqual({ text: "Waiting 30 min", tone: "waiting" });
    expect(waitingNote("2026-11-20T09:15:00Z", now)).toEqual({ text: "Waiting 2 h 45 min", tone: "old" });
    expect(waitingNote("2026-11-18T12:18:00Z", now)).toEqual({ text: "Waiting since an earlier day", tone: "old" });
  });

  test("the methods that paid a bill: collected ones only, each once", () => {
    expect(
      paidMethods([
        { method: "mtn_momo", status: "failed" },
        { method: "cash", status: "successful" },
        { method: "airtel_money", status: "successful" },
        { method: "cash", status: "refunded" },
        { method: "mtn_momo", status: "pending" },
      ]),
    ).toEqual(["cash", "airtel_money"]);
  });
});

const paid = {
  outcome: "confirmed" as const,
  billFullyPaid: true,
  outstandingRwf: 0,
  orderType: "dine_in",
  tableLabel: "T4",
  sessionOpen: true,
  tableStatus: "occupied",
  tableSessionId: "s1",
  tableId: "t1",
};

describe("Customer → Cashier → Waiter → Receipt → Table available", () => {
  test("the waiter reads the exact sentence once the cashier confirmed the whole bill", () => {
    expect(updateHeadline(paid)).toBe("Payment successful. Bill fully paid.");
    expect(updateHeadline({ ...paid, billFullyPaid: false, outstandingRwf: 3500 })).toBe(
      "Payment successful. RWF 3,500 still to pay.",
    );
    expect(updateHeadline({ ...paid, outcome: "not_received" })).toBe("Payment not received. The bill is still open.");
  });

  test("the table is never made available by the payment: first the guests leave, then it is cleaned", () => {
    // Paid, guests still seated: the next step is releasing the table (to Cleaning), not Available.
    expect(nextTableStep(paid)).toBe("release");
    // Released: the table is being cleaned; only "cleared and cleaned" makes it available.
    expect(nextTableStep({ ...paid, sessionOpen: false, tableStatus: "cleaning" })).toBe("clean");
    // Already available: nothing left to do.
    expect(nextTableStep({ ...paid, sessionOpen: false, tableStatus: "available" })).toBeNull();
  });

  test("no table step while the bill is still owed, the money was not received, or there is no table", () => {
    expect(nextTableStep({ ...paid, billFullyPaid: false })).toBeNull();
    expect(nextTableStep({ ...paid, outcome: "not_received" })).toBeNull();
    expect(
      nextTableStep({ ...paid, tableId: null, tableSessionId: null, tableLabel: null, orderType: "takeaway" }),
    ).toBeNull();
  });

  test("names where a bill is", () => {
    expect(whereOf("dine_in", "T4")).toBe("Table T4");
    expect(whereOf("takeaway", null)).toBe("Takeaway");
    expect(whereOf("delivery", null)).toBe("Delivery");
  });

  test("the desk shows how long a payment waited and flags it after 10 minutes", () => {
    const now = Date.parse("2026-11-19T12:00:00Z");
    expect(waitedFor("2026-11-19T11:59:40Z", now)).toBe("just now");
    expect(waitedFor("2026-11-19T11:55:00Z", now)).toBe("5 min ago");
    expect(waitedFor("2026-11-19T10:30:00Z", now)).toBe("1 h 30 min ago");
    expect(needsAttention("2026-11-19T11:55:00Z", now)).toBe(false);
    expect(needsAttention("2026-11-19T11:45:00Z", now)).toBe(true);
  });

  test("a bill held entirely by a pending payment is not offered for payment again", () => {
    expect(waitingOnCashier({ payableRwf: 0, pendingRwf: 17300 })).toBe(true);
    expect(waitingOnCashier({ payableRwf: 2000, pendingRwf: 15300 })).toBe(false);
    expect(waitingOnCashier({ payableRwf: 0, pendingRwf: 0 })).toBe(false);
  });

  test("dismissed updates stay gone; the newest show first", () => {
    const list = [
      { id: "a", at: "2026-11-19T10:00:00Z" },
      { id: "b", at: "2026-11-19T11:00:00Z" },
      { id: "c", at: "2026-11-19T12:00:00Z" },
    ];
    expect(freshUpdates(list, new Set(["b"])).map((u) => u.id)).toEqual(["c", "a"]);
    expect(freshUpdates(list, new Set(), 1).map((u) => u.id)).toEqual(["c"]);
  });
});

describe("the waiter's bills and table release (display only)", () => {
  const bill = (
    orderNumber: string,
    status: string,
    s: Partial<Record<string, number | boolean>>,
    totalRwf = 10000,
  ) => ({
    orderNumber,
    status,
    totalRwf,
    settlement: {
      collectedRwf: 0,
      pendingRwf: 0,
      outstandingRwf: totalRwf,
      payableRwf: totalRwf,
      settled: false,
      ...s,
    } as {
      collectedRwf: number;
      pendingRwf: number;
      outstandingRwf: number;
      payableRwf: number;
      settled: boolean;
    },
  });

  test("a bill shows total, paid, waiting for the cashier and balance; pending is never paid", () => {
    expect(billMoney(bill("A", "delivered", {}))).toEqual({
      totalRwf: 10000,
      paidRwf: 0,
      waitingRwf: 0,
      balanceRwf: 10000,
      state: "owes",
    });
    const waiting = billMoney(bill("B", "delivered", { pendingRwf: 10000, payableRwf: 0 }));
    expect(waiting).toMatchObject({ paidRwf: 0, waitingRwf: 10000, balanceRwf: 0, state: "waiting" });
    expect(BILL_MONEY_LABEL[waiting.state]).toBe("Waiting for the cashier");
    expect(
      billMoney(bill("C", "delivered", { collectedRwf: 4000, outstandingRwf: 6000, payableRwf: 6000 })).state,
    ).toBe("part_paid");
    const paid = billMoney(
      bill("D", "completed", { collectedRwf: 10000, outstandingRwf: 0, payableRwf: 0, settled: true }),
    );
    expect(paid).toMatchObject({ paidRwf: 10000, balanceRwf: 0, state: "paid" });
    expect(BILL_MONEY_LABEL.paid).toBe("Paid in full");
  });

  test("release is blocked by a draft, money owed, or a payment waiting for the cashier", () => {
    expect(
      releaseBlockers([
        bill("POS-1", "completed", { collectedRwf: 10000, outstandingRwf: 0, payableRwf: 0, settled: true }),
      ]),
    ).toEqual([]);
    expect(releaseBlockers([bill("POS-2", "draft", {})])).toEqual([
      "POS-2 has not been sent yet. Send it or cancel it first.",
    ]);
    expect(releaseBlockers([bill("POS-3", "delivered", { pendingRwf: 10000, payableRwf: 0 })])).toEqual([
      "POS-3: RWF 10,000 is waiting for the cashier to confirm the MoMo or Airtel payment.",
    ]);
    expect(
      releaseBlockers([bill("POS-4", "delivered", { collectedRwf: 4000, payableRwf: 6000, outstandingRwf: 6000 })]),
    ).toEqual(["POS-4 still owes RWF 6,000."]);
    // A cancelled bill never blocks.
    expect(releaseBlockers([bill("POS-5", "cancelled", {})])).toEqual([]);
  });

  test("a paid bill does not free the table while another bill of the sitting still owes (the T1 case)", () => {
    const paid = {
      ...bill("POS-A", "completed", { collectedRwf: 10000, outstandingRwf: 0, payableRwf: 0, settled: true }),
      id: "a",
    };
    const owes = { ...bill("POS-B", "delivered", { payableRwf: 6000, outstandingRwf: 6000 }), id: "b" };
    expect(releaseBlockerList([paid, owes])).toEqual([
      { orderId: "b", orderNumber: "POS-B", kind: "owes", text: "POS-B still owes RWF 6,000." },
    ]);
    // Part waiting for the cashier and part still owed: both reasons, each with its amount.
    const both = {
      ...bill("POS-C", "delivered", { pendingRwf: 3000, payableRwf: 2000, outstandingRwf: 5000 }),
      id: "c",
    };
    expect(releaseBlockerList([both]).map((b) => b.kind)).toEqual(["waiting", "owes"]);
    // Without an id (an older caller), the reason still reads the same.
    expect(releaseBlockerList([bill("POS-D", "draft", {})])[0]).toMatchObject({ orderId: null, kind: "draft" });
  });

  test("the sitting's totals: to pay, waiting for the cashier (not paid) and drafts", () => {
    expect(
      sittingMoney([
        bill("POS-1", "completed", { collectedRwf: 10000, outstandingRwf: 0, payableRwf: 0, settled: true }),
        bill("POS-2", "delivered", { pendingRwf: 4000, payableRwf: 6000, outstandingRwf: 10000 }),
        bill("POS-3", "draft", {}),
        bill("POS-4", "cancelled", {}),
      ]),
    ).toEqual({ payableRwf: 16000, pendingRwf: 4000, drafts: 1 });
    expect(sittingMoney([])).toEqual({ payableRwf: 0, pendingRwf: 0, drafts: 0 });
  });

  test("my tables: the tables served by the person signed in", () => {
    expect(isMyTable({ waiterName: "Jean Bosco Ndayisaba" }, "jean bosco ndayisaba")).toBe(true);
    expect(isMyTable({ waiterName: "Claudine Uwase" }, "Jean Bosco Ndayisaba")).toBe(false);
    expect(isMyTable({ waiterName: null }, "Jean Bosco Ndayisaba")).toBe(false);
    expect(isMyTable({ waiterName: "" }, "")).toBe(false);
  });
});
