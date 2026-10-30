/**
 * Where "Set up your property" goes from the In review page, and whether there is anywhere to go yet.
 *
 * THE RULE IS THE API'S. A hotel, lodge, venue or any other hospitality business holds `listing.manage` from the
 * moment its fee is paid (`canSetUpDuringReview`), so it can build its listing while the documents are reviewed;
 * only Publish waits for approval. A residence is set up on the rentals screen, whose units, leases and payouts
 * need more than that, so its link waits for approval. Unpaid, sent back, suspended or unclaimed: no link.
 *
 * THE PAGE LIVES IN THE OPERATOR APP, at `/w/<workspaceId>/setup` (a residence: `/residence/setup`), on the app's
 * own origin (app.injishi.com, :3002 on a laptop), so the link goes there directly; signing in on the app returns
 * to the setup page. The path alone is kept only for a build whose app shares web's origin, where web redirects it
 * on (`app-handoff.ts`).
 *
 * NO IMPORTS: `tests/setup-link.test.mjs` loads this file bare.
 */

/** Paid and being reviewed: the statuses in which a hospitality business may already set up. */
const IN_REVIEW = new Set(["submitted", "tin_verified", "field_verified"]);

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
  summary: { status: string; workspaceId: string; domain?: string | null },
  webUrl: string | undefined,
  appUrl: string | undefined,
): string | null {
  if (!setupIsOpen(summary)) return null;
  if (!/^[0-9a-f-]{36}$/i.test(summary.workspaceId)) return null;
  const path = summary.domain === "residence" ? "/residence/setup" : `/w/${summary.workspaceId}/setup`;
  const web = originOf(webUrl || "http://localhost:3000");
  const app = originOf(appUrl || "http://localhost:3002");
  return app && app !== web ? `${app}${path}` : path;
}

/** May this registration's owner open setup now? */
export function setupIsOpen(summary: { status: string; domain?: string | null }): boolean {
  if (summary.status === "active") return true;
  return summary.domain !== "residence" && IN_REVIEW.has(summary.status);
}

/** What the page says about setup, by where the registration stands. */
export function setupNote(status: string, domain: string | null = null): string {
  if (status === "active") return "Rooms, prices and photographs, then publish. Guests see nothing until you publish.";
  if (status === "approved")
    return "Setup opens once the owner accepts the invitation, because the business is theirs to set up.";
  if (status === "rejected") return "Setup opens again once you resubmit the fix.";
  if (IN_REVIEW.has(status) && domain !== "residence")
    return "Open now. Add your rooms, prices and photographs while we review; you can publish once you are approved.";
  if (IN_REVIEW.has(status)) return "Units, leases and payouts open once your registration is approved. We email you when it does.";
  return "Setup opens once your registration fee is paid.";
}
