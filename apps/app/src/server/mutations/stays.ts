/**
 * Writes for the stays area, through the API. Plain functions: server actions and verify scripts both
 * call them. Every refusal is the API's (`WorkspaceGuard`, the folio's rules, the stay's state);
 * nothing here decides what a person may do.
 *
 * The screens name a stay by its reference ("ST-8812") and a department by its name, as the desk does;
 * both are resolved against the desk's own day (`GET /ops/front-desk`, `GET /ops/departments`) before
 * a command is sent, so another branch's stay or a cost centre never reaches one.
 *
 * Money commands carry the `Idempotency-Key` the screen minted at the press (AGENTS.md, Guest messaging
 * and ordering): a retried press replays at the API instead of charging, paying or voiding twice.
 */
import { ApiError } from "../api";
import {
  type ApiDepartment,
  type ApiFolioDetail,
  chargeDepartmentsOf,
  folioDetail,
  forgetStays,
  stayFolio,
  stayOf,
} from "../sources/stays";
import type { SourceContext } from "../sources/types";

/** Run one command; whatever it did, the next read through this context reads the day and the bill again. */
async function command<T>(ctx: SourceContext, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } finally {
    forgetStays(ctx);
  }
}

/**
 * Reply to a guest on their conversation (POST /ops/threads/:id/messages, `message.send`). No
 * Idempotency-Key, by the route's design: a repeated message is visible and fixable; an archived
 * conversation is refused (409) by the API.
 */
export async function sendGuestMessage(ctx: SourceContext, threadId: string, body: string): Promise<void> {
  await ctx.ops().post(`/api/v1/ops/threads/${encodeURIComponent(threadId)}/messages`, { body });
}

export interface PostChargeInput {
  stayRef: string;
  /** The revenue department, by name, as the charge drawer lists it (stays.chargeDepartments). */
  department: string;
  /** Whole francs BEFORE tax: the API posts the VAT as its own line at the rate in force. */
  amountRwf: number;
  /** What the guest reads on the bill. */
  description: string;
  /** Why the desk posted it (the drawer's reason code); kept on the line beside the description. */
  reason: string;
  idempotencyKey: string;
}

export interface Posted {
  chargeId: string | null;
  /** Set when the stay's bill was already signed and the charge went to its next bill. */
  movedToFolio: string | null;
  balanceRwf: number;
}

/**
 * Put a desk charge on a stay's bill (POST /ops/folios/:id/charges, `folio.charge`). A revenue charge
 * names a revenue centre of the stay's property (the API refuses a cost centre with 422), and a charge
 * aimed at a signed bill lands on the stay's next one.
 */
export async function postFolioCharge(ctx: SourceContext, input: PostChargeInput): Promise<Posted> {
  const amount = Math.trunc(input.amountRwf);
  if (!(amount > 0)) throw new ApiError(400, "amount", "Type an amount above zero.", null);
  const reason = input.reason.trim();
  if (!reason) throw new ApiError(400, "reason", "Choose why the charge is posted.", null);
  const { board, folio } = await stayFolio(ctx, input.stayRef);
  const { departments } = await ctx.ops().get<{ departments: ApiDepartment[] }>("/api/v1/ops/departments");
  const department = chargeDepartmentsOf(departments, board.property.id).find((d) => d.name === input.department);
  if (!department) {
    throw new ApiError(422, "department", `${input.department} is not a revenue department of this property.`, null);
  }
  const title = input.description.trim() || `${department.name} charge`;
  return command(ctx, async () => {
    const result = await ctx.ops().post<ApiFolioDetail & { openedFolioId: string | null }>(
      `/api/v1/ops/folios/${folio.id}/charges`,
      {
        chargeType: "pos",
        departmentId: department.id,
        description: `${title} · ${reason}`.slice(0, 500),
        amountRwf: amount,
      },
      { idempotencyKey: input.idempotencyKey },
    );
    const before = new Set(folio.charges.map((c) => c.id));
    const added = result.charges.find((c) => !before.has(c.id) && c.chargeType === "pos");
    return { chargeId: added?.id ?? null, movedToFolio: result.openedFolioId, balanceRwf: result.balanceRwf };
  });
}

/**
 * Void a charge (POST /ops/folios/:id/charges/:chargeId/void, `folio.charge`): a reversing line naming
 * the original, its VAT reversed with it. Nothing on a bill is ever deleted.
 */
export async function voidFolioCharge(
  ctx: SourceContext,
  input: { stayRef: string; chargeId: string; reason: string; idempotencyKey: string },
): Promise<{ balanceRwf: number }> {
  const reason = input.reason.trim();
  if (!reason) throw new ApiError(400, "reason", "Choose why the line is voided.", null);
  const { folio } = await stayFolio(ctx, input.stayRef);
  if (!folio.charges.some((c) => c.id === input.chargeId)) {
    throw new ApiError(404, "not_found", "That line is not on this stay's bill.", null);
  }
  return command(ctx, async () => {
    const result = await ctx
      .ops()
      .post<ApiFolioDetail>(
        `/api/v1/ops/folios/${folio.id}/charges/${input.chargeId}/void`,
        { reason },
        { idempotencyKey: input.idempotencyKey },
      );
    return { balanceRwf: result.balanceRwf };
  });
}

/**
 * Record cash the desk took (POST /ops/folios/:id/payments, `folio.payment`): exactly the amount the
 * person typed, never the balance. Mobile money and card prompts are not connected, so only cash is
 * recorded from the desk.
 */
export async function takeCashPayment(
  ctx: SourceContext,
  input: { stayRef: string; amountRwf: number; idempotencyKey: string },
): Promise<{ balanceRwf: number }> {
  const amount = Math.trunc(input.amountRwf);
  if (!(amount > 0)) throw new ApiError(400, "amount", "Type the cash received, above zero.", null);
  const { folio } = await stayFolio(ctx, input.stayRef);
  return command(ctx, async () => {
    const result = await ctx
      .ops()
      .post<ApiFolioDetail>(
        `/api/v1/ops/folios/${folio.id}/payments`,
        { amountRwf: amount, method: "cash", reference: "Desk" },
        { idempotencyKey: input.idempotencyKey },
      );
    return { balanceRwf: result.balanceRwf };
  });
}

export interface CheckedOut {
  guest: string;
  room: string;
  /** The bill as it stands after check out: closed (and signed) when it was settled to zero. */
  folioNumber: string | null;
  folioStatus: string | null;
  balanceRwf: number;
}

/**
 * Check a guest out (POST /ops/stays/:id/checkout, `stay.checkout` and `folio.close`). The API closes
 * the stay and dirties its room in one transaction, releases the room's holds, and closes and signs a
 * bill settled to zero; a bill still owing or in credit is left open on the Bills screen. The answer
 * is read back, so the screen says what happened to the bill rather than what it hoped.
 */
export async function checkOutStay(ctx: SourceContext, stayRef: string, note?: string): Promise<CheckedOut> {
  const { stay } = await stayOf(ctx, stayRef);
  if (stay.lifecycle === "closed") {
    throw new ApiError(409, "closed", `${stay.guestName ?? "The guest"} has already checked out.`, null);
  }
  return command(ctx, async () => {
    await ctx.ops().post(`/api/v1/ops/stays/${stay.id}/checkout`, note?.trim() ? { note: note.trim() } : {});
    forgetStays(ctx);
    const folio = stay.folio ? await folioDetail(ctx, stay.folio.id) : null;
    return {
      guest: stay.guestName ?? "The guest",
      room: stay.roomLabel ?? "",
      folioNumber: folio?.folioNumber ?? null,
      folioStatus: folio?.status ?? null,
      balanceRwf: folio?.balanceRwf ?? 0,
    };
  });
}
