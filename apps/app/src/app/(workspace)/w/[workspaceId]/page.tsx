import { redirect } from "next/navigation";
import { homeAfterSignIn } from "@/lib/return-to";
import { currentAccount } from "@/lib/session";
import { setupPath } from "@/lib/setup-path";
import { requestContext } from "@/server/data";
import { readSetup } from "@/server/mutations/setup";

/**
 * A business's own address, `/w/<workspaceId>`. Web lands every operator here after sign-in, a claimed
 * business and a passed step-up included, and this app had no page at it: each of them met a 404.
 *
 * It routes on. A business that still has setup ahead (in review, or approved and not yet on the
 * marketplace) opens its setup page, which says where it stands and what is left. Anyone else, and anyone
 * who cannot set up listings (a receptionist, a housekeeper), opens their own home.
 */
export default async function WorkspaceLanding({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const account = await currentAccount();
  if (!account) redirect(`/sign-in?next=${encodeURIComponent(setupPath(workspaceId))}`);
  const home = homeAfterSignIn(account.persona.id, account.user.email);
  const business = account.workspaces.find((w) => w.workspaceId === workspaceId && w.kind === "business");
  if (!business) redirect(home);
  if (business.registrationStatus !== "active") redirect(setupPath(workspaceId));
  if (!business.permissions.includes("listing.manage")) redirect(home);
  const setup = await readSetup(await requestContext(), workspaceId);
  redirect(setup.open && !setup.published ? setupPath(workspaceId) : home);
}
