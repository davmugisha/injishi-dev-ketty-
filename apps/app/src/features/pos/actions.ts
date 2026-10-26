"use server";

import { screenHref } from "@injishi/data";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import {
  type BillPrint,
  type LineRequest,
  type OrderType,
  type PaymentMethod,
  type PosFloor,
  type PosOrder,
  type PosShift,
  type PosTicket,
  posWrite,
  type TableStatus,
  type TicketStatus,
} from "@/server/pos";

/**
 * The point of sale's commands. Each checks the person may open the POS, calls the API through
 * `server/pos.ts`, and refreshes the POS screens. A refusal comes back as the API's own sentence (a sold out
 * item, a discount over the limit, cash without an open shift), never as an error the floor cannot read.
 * Every rule is the API's; nothing here decides.
 */
export type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

const POS_SCREENS = ["PosFloor", "PosTill", "PosStations", "PosShift"] as const;

async function run<T>(act: () => Promise<T>): Promise<ActionResult<T>> {
  await requirePersona("PosFloor");
  try {
    const value = await act();
    for (const board of POS_SCREENS) revalidatePath(screenHref(board));
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.forbidden) return { ok: false, error: `Not allowed: ${error.message}` };
      return { ok: false, error: error.message };
    }
    if (error instanceof ApiUnreachableError)
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}

const ctx = () => requestContext();

// ── Floor ──────────────────────────────────────────────────────────────────────────────────────────

export async function seatAction(tableId: string, guestCount: number): Promise<ActionResult<PosFloor>> {
  return run(async () => posWrite.seat(await ctx(), tableId, guestCount));
}

export async function tableStatusAction(tableId: string, status: TableStatus): Promise<ActionResult<PosFloor>> {
  return run(async () => posWrite.tableStatus(await ctx(), tableId, status));
}

export async function releaseAction(sessionId: string): Promise<ActionResult<PosFloor>> {
  return run(async () => posWrite.release(await ctx(), sessionId));
}

export async function moveSessionAction(sessionId: string, toTableId: string): Promise<ActionResult<PosFloor>> {
  return run(async () => posWrite.moveSession(await ctx(), sessionId, toTableId));
}

export async function mergeSessionsAction(sessionId: string, fromSessionId: string): Promise<ActionResult<PosFloor>> {
  return run(async () => posWrite.mergeSessions(await ctx(), sessionId, fromSessionId));
}

// ── Orders ─────────────────────────────────────────────────────────────────────────────────────────

/** `clientKey` is minted once per press in the browser, so a double tap opens one order. */
export async function createOrderAction(
  body: { outletId: string; orderType: OrderType; tableSessionId?: string; guestNote?: string },
  clientKey: string,
): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.createOrder(await ctx(), body, clientKey));
}

export async function addLinesAction(orderId: string, lines: LineRequest[]): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.addLines(await ctx(), orderId, lines));
}

export async function updateLineAction(
  orderId: string,
  lineId: string,
  body: { quantity?: number; note?: string | null },
): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.updateLine(await ctx(), orderId, lineId, body));
}

export async function removeLineAction(orderId: string, lineId: string): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.removeLine(await ctx(), orderId, lineId));
}

export async function voidLineAction(orderId: string, lineId: string, reason: string): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.voidLine(await ctx(), orderId, lineId, reason));
}

export async function sendAction(orderId: string): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.send(await ctx(), orderId));
}

export async function cancelAction(orderId: string, reason: string): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.cancel(await ctx(), orderId, reason));
}

export async function discountAction(
  orderId: string,
  body: { orderItemId?: string; kind: "amount" | "percent"; value: number; reason: string },
): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.discount(await ctx(), orderId, body));
}

export async function decideDiscountAction(
  orderId: string,
  discountId: string,
  approve: boolean,
): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.decideDiscount(await ctx(), orderId, discountId, approve));
}

export async function transferAction(
  orderId: string,
  toTableSessionId: string,
  reason: string,
): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.transfer(await ctx(), orderId, toTableSessionId, reason));
}

export async function splitAction(orderId: string, orderItemIds: string[]): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.split(await ctx(), orderId, orderItemIds));
}

export async function printBillAction(orderId: string): Promise<ActionResult<BillPrint>> {
  return run(async () => posWrite.printBill(await ctx(), orderId));
}

// ── Payments ───────────────────────────────────────────────────────────────────────────────────────

export async function payAction(
  orderId: string,
  body: {
    method: PaymentMethod;
    amountRwf: number;
    tenderedRwf?: number;
    tipRwf?: number;
    simulate?: "success" | "pending" | "failure" | "timeout";
    payerPhone?: string;
    voucherCode?: string;
  },
  clientKey: string,
): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.pay(await ctx(), orderId, { ...body, idempotencyKey: clientKey }));
}

export async function resolvePaymentAction(
  paymentId: string,
  outcome: "success" | "failure" | "timeout",
): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.resolvePayment(await ctx(), paymentId, outcome));
}

export async function refundAction(
  paymentId: string,
  amountRwf: number,
  reason: string,
  clientKey: string,
): Promise<ActionResult<PosOrder>> {
  return run(async () => posWrite.refund(await ctx(), paymentId, { amountRwf, reason, idempotencyKey: clientKey }));
}

// ── Kitchen and bar ────────────────────────────────────────────────────────────────────────────────

export async function advanceTicketAction(ticketId: string, to: TicketStatus): Promise<ActionResult<PosTicket>> {
  return run(async () => posWrite.advanceTicket(await ctx(), ticketId, to));
}

export async function reprintTicketAction(ticketId: string): Promise<ActionResult<PosTicket>> {
  return run(async () => posWrite.reprintTicket(await ctx(), ticketId));
}

// ── Shifts ─────────────────────────────────────────────────────────────────────────────────────────

export async function openShiftAction(registerId: string, openingFloatRwf: number): Promise<ActionResult<PosShift>> {
  return run(async () => posWrite.openShift(await ctx(), registerId, openingFloatRwf));
}

export async function cashMovementAction(
  shiftId: string,
  body: { kind: "paid_in" | "paid_out"; amountRwf: number; reason: string },
): Promise<ActionResult<PosShift>> {
  return run(async () => posWrite.cashMovement(await ctx(), shiftId, body));
}

export async function decideMovementAction(movementId: string, approve: boolean): Promise<ActionResult<PosShift>> {
  return run(async () => posWrite.decideMovement(await ctx(), movementId, approve));
}

export async function closeShiftAction(
  shiftId: string,
  body: { countedCashRwf: number; closeNote?: string; handoverNote?: string },
): Promise<ActionResult<PosShift>> {
  return run(async () => posWrite.closeShift(await ctx(), shiftId, body));
}

export async function reviewShiftAction(shiftId: string, note?: string): Promise<ActionResult<PosShift>> {
  return run(async () => posWrite.reviewShift(await ctx(), shiftId, note));
}
