"use server";

import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";

export type PsfSetupResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** A change on PSF's setup screens. Only paths under the setup route go through; the API checks the National Manager. */
export async function psfSetupCall<T>(method: "post" | "put" | "patch", path: string, body: unknown): Promise<PsfSetupResult<T>> {
  await requirePersona("PsfSetup");
  if (!/^[a-z]+(\/[A-Za-z0-9_-]+)*$/.test(path)) return { ok: false, error: "That change is not on this screen." };
  try {
    const ctx = await requestContext();
    return { ok: true, value: await ctx.api[method]<T>(`/api/v1/oversight/psf/setup/${path}`, body) };
  } catch (error) {
    if (error instanceof ApiError) {
      const issue = (error.body as { issues?: { message?: string }[] } | null)?.issues?.[0]?.message;
      return { ok: false, error: issue ?? error.message };
    }
    if (error instanceof ApiUnreachableError) return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}
