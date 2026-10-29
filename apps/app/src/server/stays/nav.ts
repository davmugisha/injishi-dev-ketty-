/**
 * A stay business's sidebar (2026-10-29), built per request from how the business is run and what the
 * person may do. A compact place (up to twelve rooms, owner run) gets one short menu; a full one (a team,
 * more rooms) gets the same plus the team's tools. Only screens that read real records are listed, and a
 * count shows only when there is something waiting. Hiding an item is presentation: the API still decides.
 */
import type { StaysSummary } from "@injishi/contracts";
import { stayUnitWords } from "@injishi/contracts";
import type { NavGroup, NavItem } from "@injishi/data";
import { can, type StaysScope, staysScope, staysSummary } from "./client";

const chip = (n: number | undefined) => (n && n > 0 ? { chip: String(n) } : {});

export function staysNavGroups(
  scope: Pick<StaysScope, "permissions">,
  summary: StaysSummary,
  /** The person's own home: the owner's or the manager's board. */
  home: "OwnerHome" | "ManagerToday" = "OwnerHome",
): NavGroup[] {
  const words = stayUnitWords(summary.business.kind);
  const desk = can(scope, "stay.checkin", "stay.checkout");
  const top: NavItem[] = [{ id: "home", label: "Home", icon: "House", board: home }];
  if (desk) {
    top.push({
      id: "frontdesk",
      label: "Today",
      icon: "Persons",
      board: "FrontDeskToday",
      ...chip(summary.counts.arrivalsToday + summary.counts.departuresToday),
    });
  }
  if (can(scope, "reservation.approve", "reservation.assign", "stay.checkin")) {
    top.push({
      id: "reservations",
      label: "Bookings",
      icon: "Calendar",
      board: "Reservations",
      ...chip(summary.counts.requestsWaiting),
      ...(summary.counts.requestsWaiting > 0 ? { alert: true } : {}),
    });
  }
  if (can(scope, "message.send")) top.push({ id: "messages", label: "Messages", icon: "Comments", board: "Messages" });
  const groups: NavGroup[] = [{ label: null, items: top }];

  const property: NavItem[] = [];
  if (can(scope, "listing.manage")) {
    property.push({
      id: "calendar",
      label: "Prices and availability",
      icon: "Calendar",
      board: "AvailabilityCalendar",
    });
  }
  if (can(scope, "housekeeping.set", "stay.checkin")) {
    property.push({
      id: "housekeeping",
      label: summary.business.size === "compact" ? "Cleaning" : "Housekeeping",
      icon: "BroomMotion",
      board: "HousekeepingBoard",
    });
  }
  if (summary.business.size === "full" && can(scope, "ticket.advance", "stay.checkin")) {
    property.push({ id: "maintenance", label: "Maintenance", icon: "Wrench", board: "Maintenance" });
  }
  if (property.length > 0) {
    groups.push({ label: words.many.charAt(0).toUpperCase() + words.many.slice(1), items: property });
  }

  const business: NavItem[] = [];
  if (can(scope, "team.manage")) {
    business.push({
      id: "team",
      label: summary.business.size === "compact" ? "Helpers" : "Team and roles",
      icon: "PersonsLock",
      board: "TeamRoles",
    });
  }
  if (business.length > 0) groups.push({ label: "Business", items: business });
  return groups;
}

/** The sidebar of a stay business's owner or manager; null when the workspace lets no rooms. */
export async function staysNav(home: "OwnerHome" | "ManagerToday" = "OwnerHome"): Promise<NavGroup[] | null> {
  const [scope, summary] = await Promise.all([staysScope(), staysSummary()]);
  if (!scope || !summary) return null;
  return staysNavGroups(scope, summary, home);
}
