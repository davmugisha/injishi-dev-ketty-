import { screenByPath } from "@injishi/data";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Route guard (Next.js 16 proxy). Public screens pass; protected screens need a session cookie,
 * otherwise the visitor goes to sign-in and comes back afterwards. Pages still verify the session
 * and the persona's access with `requireScreen`.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const screen = screenByPath(pathname);
  if (!screen || screen.persona === null) return NextResponse.next();
  if (request.cookies.get("ij_session")?.value) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|api/|stock/|brand/|favicon|.*\\.[a-z0-9]+$).*)"],
};
