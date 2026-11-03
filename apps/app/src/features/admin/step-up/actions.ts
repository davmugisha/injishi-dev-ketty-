"use server";

/**
 * The emailed step-up a grant asks for again when the last code is older than ten minutes (2026-11-02):
 * email a code to this session (`POST /me/two-factor/send`) and check it (`POST /me/two-factor/verify`). The
 * API keeps the code hashed against the session; a match marks the session stepped up now, and the grant
 * is tried again.
 */
import { currentApi } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";

export type StepUpResult<T> = { ok: true; value: T } | { ok: false; error: string };

function words(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body?.message[0] : body?.message;
    return message || error.message || "That did not work. Try again.";
  }
  if (error instanceof ApiUnreachableError) return "Injishi could not be reached. Try again.";
  throw error;
}

export async function sendStepUpCode(): Promise<StepUpResult<{ sentTo: string }>> {
  try {
    const api = await currentApi();
    const { sentTo } = await api.post<{ sentTo: string }>("/api/v1/me/two-factor/send", {});
    return { ok: true, value: { sentTo } };
  } catch (error) {
    return { ok: false, error: words(error) };
  }
}

export async function confirmStepUpCode(code: string): Promise<StepUpResult<null>> {
  const digits = code.replace(/\D/g, "");
  if (!/^\d{6}$/.test(digits)) return { ok: false, error: "Enter the 6-digit code from the email." };
  try {
    const api = await currentApi();
    await api.post("/api/v1/me/two-factor/verify", { code: digits });
    return { ok: true, value: null };
  } catch (error) {
    return { ok: false, error: words(error) };
  }
}
