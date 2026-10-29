/**
 * Which SURFACE a pms path belongs to (ADR-029).
 *
 * pms serves two audiences since the government console moved into it, and they
 * need different pre-render gates. An operator holds a workspace and
 * `WorkspaceBoundary` refuses them without one. An officer holds an ASSIGNMENT
 * and no workspace at all, so that same gate would meet every officer with
 * "No workspace yet" and never render a console. Which gate applies is decided
 * here, once, and read by `app/providers.tsx`.
 *
 * IT IS NOT A SECURITY CONTROL. Both gates are routing controls; `SessionGuard`
 * and `OversightGuard` on the API are the boundary. What this function decides
 * is which of two refusal messages a person sees, not what they may do.
 *
 * THE EXACT-SEGMENT TEST IS THE POINT. `pathname.startsWith("/oversight")` also
 * matches `/oversightfoo` and `/oversight-reports`, so a future route named
 * either would quietly skip the workspace gate — a screen rendering for someone
 * who holds nothing, which is the exact class of bug `WorkspaceBoundary` exists
 * to prevent. Matching the segment boundary is what stops that.
 */
export function isOversightPath(pathname: string): boolean {
  return pathname === "/oversight" || pathname.startsWith("/oversight/");
}
