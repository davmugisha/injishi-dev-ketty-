import { screenByPath } from "@injishi/data";
import { type NextRequest, NextResponse } from "next/server";
import { isSetupPath } from "@/lib/setup-path";

/**
 * Route guard (Next.js 16 proxy). Public screens pass; protected screens need a session cookie,
 * otherwise the visitor goes to sign-in and comes back afterwards. Pages still verify the session
 * and the persona's access with `requireScreen`.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const screen = screenByPath(pathname);
  // The property setup page is not a registered screen, but it is never public (lib/setup-path.ts).
  const gated = screen ? screen.persona !== null : isSetupPath(pathname);
  if (!gated) return NextResponse.next();
  if (request.cookies.get("ij_session")?.value) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|api/|stock/|brand/|favicon|.*\\.[a-z0-9]+$).*)"],
};
