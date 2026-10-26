/**
 * Writes from the tenant's phone, through the API (`/api/v1/me/residence`, `/api/v1/me/threads`). The
 * API proves every record is the caller's own; nothing here decides that.
 */
import { forgetTenancy, readTenancy } from "../sources/resident";
import type { SourceContext } from "../sources/types";
import { type RepairCategory, ResidenceInputError, type ResidenceWrite, readDay, readWindow } from "./residence";

/** The resident form's categories (resident.repairCategories), in the API's codes. */
const RESIDENT_CATEGORY: Record<string, RepairCategory> = {
  plumbing: "plumbing",
  electrical: "electrical",
  "doors-windows": "doors_windows",
  appliances: "appliance",
  other: "other",
};

async function write<T>(ctx: SourceContext, call: Promise<T>): Promise<T> {
  const out = await call;
  forgetTenancy(ctx);
  return out;
}

async function leaseByRef(ctx: SourceContext, ref: string) {
  const b = await readTenancy(ctx);
  const lease = b.v.leases.find((l) => l.reference === ref || l.id === ref);
  if (!lease) throw new ResidenceInputError("That lease is not yours.");
  return lease;
}

/** Report a repair on the resident's own unit. The description opens the conversation with management. */
export async function requestRepair(
  ctx: SourceContext,
  input: { unit: string; category: string; description: string; staffMayEnter: boolean },
): Promise<ResidenceWrite> {
  const text = input.description.trim();
  if (!text) throw new ResidenceInputError("Add a short description to send.");
  const title = text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text;
  return write(
    ctx,
    ctx.api.post<ResidenceWrite>("/api/v1/me/residence/repairs", {
      unit: input.unit,
      title,
      description: text,
      category: RESIDENT_CATEGORY[input.category] ?? "other",
      staffMayEnter: input.staffMayEnter,
    }),
  );
}

/** Register a guest for the resident's unit. Answers the gate code the server minted. */
export async function registerVisitor(
  ctx: SourceContext,
  input: { unit: string; visitorName: string; date: string; time: string; overnight: boolean },
): Promise<ResidenceWrite> {
  if (!input.visitorName.trim()) throw new ResidenceInputError("Write the visitor's name.");
  let { validFrom, validTo } = readWindow(input.time, ctx.today.iso, input.date);
  // Staying overnight: the visit ends the next day at the time given.
  if (input.overnight && validTo.slice(0, 10) === validFrom.slice(0, 10)) {
    const next = new Date(Date.parse(`${validTo.slice(0, 10)}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    validTo = `${next}${validTo.slice(10)}`;
  }
  return write(
    ctx,
    ctx.api.post<ResidenceWrite>("/api/v1/me/residence/visitor-passes", {
      unit: input.unit,
      visitorName: input.visitorName.trim(),
      validFrom,
      validTo,
      overnight: input.overnight,
      kind: "guest",
    }),
  );
}

/** Accept or decline the renewal offer. */
export async function answerRenewal(
  ctx: SourceContext,
  offerId: string,
  answer: "accepted" | "declined",
): Promise<ResidenceWrite> {
  return write(
    ctx,
    ctx.api.post<ResidenceWrite>(`/api/v1/me/residence/offers/${encodeURIComponent(offerId)}/answer`, { answer }),
  );
}

/** Give notice to move out: written notice, time stamped, held to the lease's notice period. */
export async function giveNotice(
  ctx: SourceContext,
  leaseRef: string,
  input: { moveOut: string; reason: string; note: string },
): Promise<ResidenceWrite> {
  const lease = await leaseByRef(ctx, leaseRef);
  const moveOutDate = readDay(input.moveOut, ctx.today.iso);
  if (!moveOutDate) {
    throw new ResidenceInputError(`"${input.moveOut}" is not a date: write it like "14 Nov 2026".`);
  }
  return write(
    ctx,
    ctx.api.post<ResidenceWrite>(`/api/v1/me/residence/leases/${lease.id}/notice`, {
      moveOutDate,
      reason: input.reason,
      ...(input.note.trim() ? { message: input.note.trim() } : {}),
    }),
  );
}

/** Write to management in a conversation (the existing guest messaging route). */
export async function sendMessage(ctx: SourceContext, threadId: string, text: string): Promise<{ id: string }> {
  const body = text.trim();
  if (!body) throw new ResidenceInputError("Write a message first.");
  return write(
    ctx,
    ctx.api.post<{ id: string }>(`/api/v1/me/threads/${encodeURIComponent(threadId)}/messages`, { body }),
  );
}
