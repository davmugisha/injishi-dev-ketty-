/**
 * The staff help desk and the things lent to staff, through the API (058-staff-services).
 * A person asks and replies on their own file (`/me/work/:employeeId/tickets`); HR answers, closes,
 * lends and takes back (`/ops/hr-tickets`, `/ops/asset-loans`).
 */

import type { AssetKindId } from "@injishi/product-hr";
import { myFile } from "../sources/staff";
import type { SourceContext } from "../sources/types";

export type { AssetKindId };

export type HelpTopicId = "pay" | "leave" | "documents" | "uniform" | "it" | "other";

const ticket = (id: string) => `/api/v1/ops/hr-tickets/${encodeURIComponent(id)}`;
const loan = (id: string) => `/api/v1/ops/asset-loans/${encodeURIComponent(id)}`;

/** Ask HR or IT a question on the person's own file. */
export async function askTicket(
  ctx: SourceContext,
  input: { topic: HelpTopicId; subject: string; body: string },
): Promise<void> {
  const { employeeId } = await myFile(ctx);
  await ctx.api.post(`/api/v1/me/work/${encodeURIComponent(employeeId)}/tickets`, input);
}

/** The person writes again on their own question; a resolved one opens again. `employeeId`: their file, when known. */
export async function replyTicket(ctx: SourceContext, id: string, body: string, employeeId?: string): Promise<void> {
  const file = employeeId ?? (await myFile(ctx)).employeeId;
  await ctx.api.post(`/api/v1/me/work/${encodeURIComponent(file)}/tickets/${encodeURIComponent(id)}/messages`, {
    body,
  });
}

/** The person writes their part of their own review. `employeeId`: their file, when known. */
export async function sendSelfReview(ctx: SourceContext, id: string, note: string, employeeId?: string): Promise<void> {
  const file = employeeId ?? (await myFile(ctx)).employeeId;
  await ctx.api.post(`/api/v1/me/work/${encodeURIComponent(file)}/reviews/${encodeURIComponent(id)}/self`, { note });
}

/** HR answers a ticket, and closes it with that answer when `close`. */
export async function answerTicket(ctx: SourceContext, id: string, body: string, close: boolean): Promise<void> {
  await ctx.ops("hospitality").post(`${ticket(id)}/reply`, { body, close });
}

/** HR closes a ticket without another word. */
export async function closeTicket(ctx: SourceContext, id: string): Promise<void> {
  await ctx.ops("hospitality").post(`${ticket(id)}/close`);
}

/** Record an item lent to a person. */
export async function lendAsset(
  ctx: SourceContext,
  input: {
    employeeId: string;
    kind: AssetKindId;
    name: string;
    tag: string | null;
    issuedOn: string;
    dueBackOn: string | null;
    note: string | null;
  },
): Promise<void> {
  await ctx.ops("hospitality").post("/api/v1/ops/asset-loans", input);
}

/** Record an item back (or lost: back on the books as not returned, with the word why). */
export async function returnAsset(
  ctx: SourceContext,
  id: string,
  returnedOn: string,
  note: string | null,
): Promise<void> {
  await ctx.ops("hospitality").post(`${loan(id)}/return`, { returnedOn, note });
}
