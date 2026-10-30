/**
 * The hotel or venue owner's sidebar, built per request from their own business, the way the landlord's is
 * (`server/rentals/nav.ts`). It replaced the design boards' fifteen items, which every owner got whatever their
 * business was and most of which drew sample data.
 *
 * Only what exists for this business, and only what the person may do there: a business in review holds
 * `listing.manage` and nothing else, so it sees Setup alone. A venue (bar & restaurant, coffee shop) is
 * listed, not booked, so it has no front desk, reservations or housekeeping. Hiding an item is presentation;
 * the API still decides.
 */
import type { Permission } from "@injishi/contracts";
import type { NavGroup, NavItem } from "@injishi/data";
import { setupPath } from "@/lib/setup-path";
import type { Account, Workspace } from "../auth";
import { requestContext } from "../data";
import { type SetupGlance, setupGlance } from "../mutations/setup";

/** The hospitality business the sidebar is about: the one the session chose, else the first. */
function hospitalityWorkspace(account: Account): Workspace | null {
  const held = account.workspaces.filter((w) => w.kind === "business" && w.domain === "hospitality");
  const active = account.context?.activeWorkspaceId;
  return held.find((w) => w.workspaceId === active) ?? held[0] ?? null;
}

export function businessNavGroups(
  workspace: Pick<Workspace, "workspaceId" | "permissions" | "registrationStatus">,
  setup: SetupGlance | null,
): NavGroup[] {
  const may = (...needed: Permission[]) => needed.some((p) => workspace.permissions.includes(p));
  const approved = workspace.registrationStatus === "active";
  const venue = setup?.foodVenue === true;
  const setupHref = setupPath(workspace.workspaceId);

  const top: NavItem[] = [];
  // Until the listing is live, setting it up is the job, so it leads with what is left.
  if (setup && !setup.published) {
    top.push({
      id: "setup",
      label: "Set up your listing",
      icon: "ListCheck",
      board: "Listing",
      href: setupHref,
      ...(setup.left > 0 ? { chip: String(setup.left) } : {}),
    });
  }
  if (approved && !venue) {
    if (may("stay.checkin"))
      top.push({ id: "front-desk", label: "Front desk", icon: "Persons", board: "FrontDeskToday" });
    if (may("reservation.approve", "reservation.assign", "stay.checkin"))
      top.push({ id: "reservations", label: "Reservations", icon: "Calendar", board: "Reservations" });
    // The rack reads the same desk day as Reservations (2026-10-30): every room across the coming days.
    if (may("reservation.approve", "reservation.assign", "stay.checkin"))
      top.push({ id: "room-rack", label: "Room rack", icon: "LayoutCells", board: "RoomRack" });
    if (may("housekeeping.set"))
      top.push({ id: "housekeeping", label: "Housekeeping", icon: "BroomMotion", board: "HousekeepingBoard" });
  }
  if (approved && may("message.send"))
    top.push({ id: "messages", label: "Messages", icon: "Comments", board: "Messages" });
  const groups: NavGroup[] = top.length > 0 ? [{ label: null, items: top }] : [];

  const business: NavItem[] = [];
  if (setup?.published) {
    business.push({ id: "listing", label: "Your listing", icon: "ListCheck", board: "Listing", href: setupHref });
  }
  if (approved && !venue && may("payout.manage", "money.view")) {
    business.push({
      id: "getting-paid",
      label: "Getting paid",
      icon: "Wallet",
      board: "Payments",
      href: `/w/${workspace.workspaceId}/getting-paid`,
    });
  }
  if (approved && may("team.manage")) business.push({ id: "team", label: "Team", icon: "Gear", board: "TeamRoles" });
  if (business.length > 0) groups.push({ label: "Business", items: business });
  return groups;
}

/** The sidebar of the hotel or venue owner in this request, or null when they hold no hospitality business. */
export async function businessNav(account: Account): Promise<NavGroup[] | null> {
  const workspace = hospitalityWorkspace(account);
  if (!workspace) return null;
  const setup = await setupGlance(await requestContext(), workspace.workspaceId);
  return businessNavGroups(workspace, setup);
}
