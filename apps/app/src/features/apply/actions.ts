"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { refusal, sessionCookie, url } from "./application";

export type ApplyResult = { ok: true; sentTo?: string } | { ok: false; error: string };

const WEEK = 7 * 24 * 60 * 60;

async function session(token: string): Promise<string | undefined> {
  return (await cookies()).get(sessionCookie(token).name)?.value;
}

/** Mail a code to the address on the application. */
export async function sendCodeAction(token: string): Promise<ApplyResult> {
  const res = await fetch(url(token, "/code"), { method: "POST", cache: "no-store" });
  if (!res.ok) return { ok: false, error: await refusal(res) };
  const body = (await res.json()) as { sentTo: string };
  return { ok: true, sentTo: body.sentTo };
}

/** The code they typed: on a match, a week's session kept on this page's path. */
export async function verifyCodeAction(token: string, code: string): Promise<ApplyResult> {
  const res = await fetch(url(token, "/verify"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: code.replace(/\D/g, "") }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: await refusal(res) };
  const body = (await res.json()) as { session: string };
  const where = sessionCookie(token);
  (await cookies()).set(where.name, body.session, {
    path: where.path,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: WEEK,
  });
  revalidatePath(`/apply/${token}`);
  return { ok: true };
}

/** One document, with which of the role's documents it is in `name`. */
export async function uploadDocumentAction(token: string, form: FormData): Promise<ApplyResult> {
  const res = await fetch(url(token, "/documents"), {
    method: "POST",
    headers: { "x-application-session": (await session(token)) ?? "" },
    body: form,
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: await refusal(res) };
  revalidatePath(`/apply/${token}`);
  return { ok: true };
}

/** Take the offer, or ask for another figure. */
export async function respondAction(
  token: string,
  answer: { accept: true } | { askRwf: number; note: string },
): Promise<ApplyResult> {
  const res = await fetch(url(token, "/offer"), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-application-session": (await session(token)) ?? "" },
    body: JSON.stringify("accept" in answer ? answer : { askRwf: answer.askRwf, note: answer.note.trim() || null }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: await refusal(res) };
  revalidatePath(`/apply/${token}`);
  return { ok: true };
}
