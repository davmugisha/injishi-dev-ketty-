import { homeHref, type PersonaId, personas } from "@injishi/data";
import { createSession } from "@injishi/db";
import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, safeNext } from "@/lib/session";

/**
 * One-step demo sign-in for automated A/B captures and smoke tests:
 *   GET /api/demo/sign-in?persona=frontdesk&next=/check-in
 * Enabled in development, or when INJISHI_DEMO_SHORTCUTS=1. People use the sign-in page.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && process.env.INJISHI_DEMO_SHORTCUTS !== "1") {
    return NextResponse.json({ error: "demo shortcuts are disabled" }, { status: 404 });
  }
  const id = request.nextUrl.searchParams.get("persona") as PersonaId | null;
  if (!id || !personas[id]) return NextResponse.json({ error: "unknown persona" }, { status: 400 });
  const { token, expiresAt } = await createSession(id);
  const next = safeNext(request.nextUrl.searchParams.get("next")) ?? homeHref(id);
  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", expires: expiresAt });
  return response;
}
