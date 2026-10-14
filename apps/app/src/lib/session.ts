import { type BoardId, canAccess, type Persona, personas, screens } from "@injishi/data";
import { getSession } from "@injishi/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "ij_session";
export const OTP_COOKIE = "ij_otp";

/** The signed-in persona, or null. Server components, route handlers and actions only. */
export async function currentPersona(): Promise<Persona | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await getSession(token);
  return session ? personas[session.personaId] : null;
}

/**
 * Gate a screen: public screens return the persona (or null); protected screens redirect
 * signed-out visitors to sign-in and people without access to the access-denied screen.
 * Call it first in every page: `const persona = await requireScreen("CheckIn")`.
 */
export async function requireScreen(board: BoardId): Promise<Persona | null> {
  const persona = await currentPersona();
  const screen = screens[board];
  if (screen.persona === null) return persona;
  if (!persona) redirect(`/sign-in?next=${encodeURIComponent(screen.href)}`);
  if (!canAccess(persona.id, board)) redirect(`/access-denied?from=${board}`);
  return persona;
}

/** Same as requireScreen for screens that always need a person (narrows the type). */
export async function requirePersona(board: BoardId): Promise<Persona> {
  const persona = await requireScreen(board);
  if (!persona) redirect(`/sign-in?next=${encodeURIComponent(screens[board].href)}`);
  return persona;
}

/** Only allow same-site relative redirects. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}
