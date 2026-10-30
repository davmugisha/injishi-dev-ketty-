"use server";

/**
 * The local leader's writes (P5): opening a guest marks it seen, and flagging it with a note. Each calls
 * the API as the signed-in leader (the API decides scope: a guest outside their area is a 404) and
 * answers in words for a toast or under the note field. The console's counts refresh after a change.
 */
import { FlagGuestRequest, type LeaderGuest } from "@injishi/contracts";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentApi } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";

export type LeaderActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function run<T>(write: () => Promise<T>): Promise<LeaderActionResult<T>> {
  try {
    const value = await write();
    revalidatePath("/officer/guests", "layout");
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.unauthenticated) redirect("/sign-in?next=/officer/guests");
      if (error.notFound) return { ok: false, error: "That guest is not in your area any more." };
      if (error.forbidden) return { ok: false, error: "You do not hold a local leader post." };
      const body = error.body as { issues?: { path: (string | number)[]; message: string }[] } | null;
      const first = body?.issues?.[0];
      if (first)
        return { ok: false, error: first.message, fieldErrors: { [first.path.join(".") || "note"]: first.message } };
      return { ok: false, error: error.message || "That did not work. Try again." };
    }
    if (error instanceof ApiUnreachableError) return { ok: false, error: "Injishi could not be reached. Try again." };
    throw error;
  }
}

/** Opening a guest: the leader's own step of the chain records that they saw it. */
export async function markGuestSeen(id: string): Promise<LeaderActionResult<LeaderGuest>> {
  if (!UUID.test(id)) return { ok: false, error: "That guest was not found." };
  const api = await currentApi();
  return run(() => api.post<LeaderGuest>(`/api/v1/oversight/guests/${id}/seen`, {}));
}

/** Flag a guest for a closer look, with a note the rest of the chain reads. */
export async function flagGuest(id: string, note: string): Promise<LeaderActionResult<LeaderGuest>> {
  if (!UUID.test(id)) return { ok: false, error: "That guest was not found." };
  const parsed = FlagGuestRequest.safeParse({ note });
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Say what needs a closer look.";
    return { ok: false, error: message, fieldErrors: { note: message } };
  }
  const api = await currentApi();
  return run(() => api.post<LeaderGuest>(`/api/v1/oversight/guests/${id}/flag`, parsed.data));
}

/** One guest in the leader's area, read fresh for the side panel. */
export async function readGuest(id: string): Promise<LeaderActionResult<LeaderGuest>> {
  if (!UUID.test(id)) return { ok: false, error: "That guest was not found." };
  const api = await currentApi();
  try {
    return { ok: true, value: await api.get<LeaderGuest>(`/api/v1/oversight/guests/${id}`) };
  } catch (error) {
    if (error instanceof ApiError && (error.notFound || error.forbidden))
      return { ok: false, error: "That guest is not in your area." };
    if (error instanceof ApiUnreachableError) return { ok: false, error: "Injishi could not be reached. Try again." };
    throw error;
  }
}
