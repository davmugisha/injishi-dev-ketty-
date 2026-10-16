import { homeHref, type PersonaId, personas } from "@injishi/data";
import { type NextRequest, NextResponse } from "next/server";
import { encodeSessionCookie, SESSION_COOKIE, safeNext } from "@/lib/session";
import { demoSignInCode, sendSignInCode, verifySignInCode } from "@/server/auth";

/**
 * One-step demo sign-in for automated captures and smoke tests:
 *   GET /api/demo/sign-in?persona=frontdesk&next=/check-in
 * It signs in through the API exactly as a person does (send, then verify), so it only works where the
 * API itself runs as the demo and accepts the fixed code. Enabled in development, or with
 * INJISHI_DEMO_SHORTCUTS=1. People use the sign-in page.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && process.env.INJISHI_DEMO_SHORTCUTS !== "1") {
    return NextResponse.json({ error: "demo shortcuts are disabled" }, { status: 404 });
  }
  const id = request.nextUrl.searchParams.get("persona") as PersonaId | null;
  if (!id || !personas[id]) return NextResponse.json({ error: "unknown persona" }, { status: 400 });
  const code = await demoSignInCode();
  if (!code) return NextResponse.json({ error: "the API is not the demo" }, { status: 409 });
  const sent = await sendSignInCode(personas[id].email);
  if (!sent.ok) return NextResponse.json({ error: `could not send a code: ${sent.reason}` }, { status: 502 });
  const verified = await verifySignInCode(personas[id].email, code);
  if (!verified.ok) return NextResponse.json({ error: `sign-in refused: ${verified.reason}` }, { status: 502 });
  const next = safeNext(request.nextUrl.searchParams.get("next")) ?? homeHref(id);
  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(SESSION_COOKIE, encodeSessionCookie(verified.cookie), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: verified.expiresAt,
  });
  return response;
}
