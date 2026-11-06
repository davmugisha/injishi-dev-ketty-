import { redirect } from "next/navigation";
import { homeAfterSignIn } from "@/lib/return-to";
import { currentAccount, currentSessionCookie } from "@/lib/session";
import { setupPath } from "@/lib/setup-path";
import { apiRequest } from "@/server/api";
import { requestContext } from "@/server/data";
import { readSetup } from "@/server/mutations/setup";

/**
 * A business's own address, `/w/<workspaceId>`. Web lands every operator here after sign-in, a claimed
 * business and a passed step-up included, and this app had no page at it: each of them met a 404.
 *
 * Opening a business the person holds makes it the one this session acts in (`POST /me/active-workspace`),
 * so the shell, its navigation, the switcher and the home all follow the business in view (ADR-076 G13).
 * The switcher's other businesses link here. One extra hop after a switch, so the account is read again.
 *
 * It then routes on. A business that still has setup ahead (in review, or approved and not yet on the
 * marketplace) opens its setup page, which says where it stands and what is left. Anyone else, and anyone
 * who cannot set up listings (a receptionist, a housekeeper), opens their own home.
 */
export default async function WorkspaceLanding({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const account = await currentAccount();
  if (!account) redirect(`/sign-in?next=${encodeURIComponent(setupPath(workspaceId))}`);
  const home = homeAfterSignIn(account.persona.id, account.user.email, account.home);
  const business = account.workspaces.find((w) => w.workspaceId === workspaceId && w.kind === "business");
  if (!business) redirect(home);
  if (!account.demo && account.active?.workspaceId !== workspaceId) {
    const switched = await apiRequest(await currentSessionCookie(), "/api/v1/me/active-workspace", {
      method: "POST",
      body: { workspaceId },
    }).then(
      () => true,
      () => false,
    );
    if (switched) redirect(`/w/${workspaceId}`);
  }
  if (business.registrationStatus !== "active") redirect(setupPath(workspaceId));
  if (!business.permissions.includes("listing.manage")) redirect(home);
  const setup = await readSetup(await requestContext(), workspaceId);
  redirect(setup.open && !setup.published ? setupPath(workspaceId) : home);
}
