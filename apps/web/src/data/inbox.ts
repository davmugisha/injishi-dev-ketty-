import {
  GuestMessage,
  GuestMessagePage,
  MyDepartments,
  MyThreads,
  OpenDepartmentResult,
  type GuestDeskPlace,
  type GuestThread,
  type OpenThreadRequest,
} from "@injishi/contracts";
import { apiFetch, apiFetchParsed, type ApiResult } from "@/lib/api";

/**
 * The client for the guest's conversations — `/api/v1/me/threads*` (ADR-032).
 *
 * Before these endpoints existed, `/inbox` was a hardcoded empty state and
 * `/inbox/<id>` explained itself in terms of endpoints and fixtures, which is
 * where a guest landed after pressing "track it in the kitchen chat" on an order
 * they had just placed. This is the read and write side of that.
 *
 * Through `apiFetch`, like every other call here: one definition of where the
 * API is, `credentials: "include"` so the session cookie crosses from :3000 to
 * :8000, and a ceiling so no screen waits for ever.
 *
 * Every answer is validated against the contract's own schema. A response that
 * does not match is reported as `failed` rather than rendered: half a
 * conversation is worse than an honest "we couldn't load this".
 */
export async function fetchMyThreads(): Promise<ApiResult<GuestThread[]>> {
  const result = await apiFetch<unknown>("/api/v1/me/threads");
  if (result.status !== "ok") return result;

  const parsed = MyThreads.safeParse(result.data);
  if (!parsed.success) return { status: "failed" };
  return { status: "ok", data: parsed.data.threads };
}

/**
 * `GET /api/v1/me/departments`: every desk this person may write to, anywhere
 * (ADR-050 D-q).
 *
 * Session scoped and takes no parameter, because a property in the answer was
 * resolved from the caller's own stays and bookings — there is nothing to pass
 * somebody else's. A guest staying nowhere and booked nowhere gets an empty
 * list, never a refusal: "you may write to nobody today" is an answer, and a
 * 403 there would have `/inbox` render an error for an ordinary account.
 *
 * `/inbox` opens with this rather than with `GET /me/stays/:id/departments`,
 * which answers the same question for ONE stay. An inbox does not know which
 * stay or booking the guest has in mind, and the guest who most needs a desk is
 * the one who has booked and not yet arrived — who has no stay at all.
 */
export async function fetchMyDepartments(): Promise<ApiResult<GuestDeskPlace[]>> {
  const result = await apiFetchParsed(MyDepartments, "/api/v1/me/departments");
  return result.status === "ok" ? { status: "ok", data: result.data.places } : result;
}

/**
 * `POST /api/v1/me/threads`: open or RESUME the conversation with one desk.
 *
 * The body names the department and nothing else; which stay or booking the
 * thread hangs off is the server's to resolve (an open stay at that property
 * first, else a live booking). A second call for the same desk returns the SAME
 * thread with `created: false` and appends to it, which is what lets a screen
 * offer "Message Housekeeping" without checking first.
 *
 * Distinct from `openDepartmentRequest` in `data/my-stay.ts`, which posts to
 * `POST /me/stays/:id/requests` and needs an OPEN stay. That route is what
 * `/stay` uses, where a stay is the whole subject of the screen. This one is
 * what works before arrival, and it is the only one `/inbox` can use.
 */
export function openThread(
  body: OpenThreadRequest,
): Promise<ApiResult<OpenDepartmentResult>> {
  return apiFetchParsed(OpenDepartmentResult, "/api/v1/me/threads", {
    method: "POST",
    body,
  });
}

/**
 * One page of a conversation, NEWEST first — the order the API serves and the
 * order a chat screen reverses for display.
 *
 * `cursor` comes from the previous page's `nextCursor` and is opaque: it encodes
 * a message's `(created_at, id)` so paging cannot skip or repeat a line when
 * somebody replies mid-scroll.
 */
export async function fetchThreadMessages(
  threadId: string,
  cursor?: string,
): Promise<ApiResult<GuestMessagePage>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const result = await apiFetch<unknown>(
    `/api/v1/me/threads/${encodeURIComponent(threadId)}/messages${query}`,
  );
  if (result.status !== "ok") return result;

  const parsed = GuestMessagePage.safeParse(result.data);
  if (!parsed.success) return { status: "failed" };
  return { status: "ok", data: parsed.data };
}

/** Say something. The sender is the session; this body cannot name one. */
export async function sendThreadMessage(
  threadId: string,
  body: string,
): Promise<ApiResult<GuestMessage>> {
  const result = await apiFetch<unknown>(
    `/api/v1/me/threads/${encodeURIComponent(threadId)}/messages`,
    { method: "POST", body: { body } },
  );
  if (result.status !== "ok") return result;

  const parsed = GuestMessage.safeParse(result.data);
  if (!parsed.success) return { status: "failed" };
  return { status: "ok", data: parsed.data };
}

/**
 * I have read this conversation.
 *
 * Fire and forget on purpose: the unread badge is a courtesy, and a person who
 * has just read a thread should not be shown an error because the bookkeeping
 * call failed. The server stamps its own clock, so a retry is harmless.
 */
export async function markThreadRead(threadId: string): Promise<void> {
  await apiFetch<unknown>(
    `/api/v1/me/threads/${encodeURIComponent(threadId)}/read`,
    { method: "POST" },
  );
}

/**
 * Who the guest is talking to, in one line.
 *
 * The property is who they think they are talking to; a department is named
 * beside it once the property has routed the conversation to one, because
 * "Amahoro Boutique Hotel · Housekeeping" answers "who replied" in a way that
 * either half alone does not.
 */
export function threadTitle(thread: GuestThread): string {
  const property = thread.propertyName ?? "Your stay";
  return thread.departmentName ? `${property} · ${thread.departmentName}` : property;
}
