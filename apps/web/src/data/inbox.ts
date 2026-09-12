import {
  GuestMessage,
  GuestMessagePage,
  MyThreads,
  type GuestThread,
} from "@injishi/contracts";
import { apiFetch, type ApiResult } from "@/lib/api";

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
