/**
 * Where "Set up your property" goes from the In review page, and whether there is anywhere to go yet.
 *
 * THE RULE IS THE API'S (D20). A business that is not `active` holds no permissions at all, so every inventory
 * route refuses it: no property, no room type, no price, no photograph can be prepared while it waits. The page
 * used to say "While you wait, prepare your listing" and link to a setup no one could use. So the link exists only
 * once the registration is active; before that the page says when setup opens.
 *
 * THE PAGE LIVES IN THE OPERATOR APP, at `/w/<workspaceId>/setup`. Web forwards `/w/*` to it (next.config.ts), so
 * in a deployed stack, where the app is a zone under web's origin, the path alone is right. On a laptop the app is
 * its own origin (:3002) with its own sign-in, and the zone's rewrite does not carry that session, so the link
 * goes to the app's origin directly, where signing in returns to the setup page.
 *
 * NO IMPORTS: `tests/setup-link.test.mjs` loads this file bare.
 */

/** The origin of an absolute url, or null when it is not one. */
function originOf(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/**
 * The setup link for a registration, or null while setup is closed. `webUrl` and `appUrl` are the two public
 * origins web was built with (`NEXT_PUBLIC_WEB_URL`, `NEXT_PUBLIC_PMS_URL`).
 */
export function setupLink(
  summary: { status: string; workspaceId: string },
  webUrl: string | undefined,
  appUrl: string | undefined,
): string | null {
  if (summary.status !== "active") return null;
  if (!/^[0-9a-f-]{36}$/i.test(summary.workspaceId)) return null;
  const path = `/w/${summary.workspaceId}/setup`;
  const web = originOf(webUrl || "http://localhost:3000");
  const app = originOf(appUrl || "http://localhost:3002");
  return app && app !== web ? `${app}${path}` : path;
}

/** What the page says about setup, by where the registration stands. */
export function setupNote(status: string): string {
  if (status === "active") return "Rooms, prices and photographs, then publish. Guests see nothing until you publish.";
  if (status === "approved")
    return "Setup opens once the owner accepts the invitation, because the business is theirs to set up.";
  if (status === "rejected") return "Setup opens once the fix is accepted and the registration is approved.";
  return "Setup opens once your registration is approved. Until then nothing can be added for this business, so there is nothing to prepare yet. We email you when it opens.";
}
