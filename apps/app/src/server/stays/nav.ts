/**
 * A stay business's sidebar (2026-10-29), built per request from how the business is run and what the
 * person may do. A compact place (up to twelve rooms, owner run) gets one short menu; a full one (a team,
 * more rooms) gets the same plus the team's tools. Only screens that read real records are listed, and a
 * count shows only when there is something waiting. Hiding an item is presentation: the API still decides.
 */
import type { StaysSummary } from "@injishi/contracts";
import { stayUnitWords } from "@injishi/contracts";
import type { NavGroup, NavItem, NavTab } from "@injishi/data";
import { requestContext } from "../data";
import { posOutlets } from "../pos";
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
  const bookings = can(scope, "reservation.approve", "reservation.assign", "stay.checkin");
  // Few sidebar items (2026-10-30): each area's pages are tabs at the top of its pages.
  const items: NavItem[] = [];

  // Home is the overview, the one page with charts (2026-10-30).
  items.push({ id: "home", label: "Home", icon: "House", board: home });

  const front: NavTab[] = [];
  if (desk) {
    front.push({
      id: "today",
      label: "Today",
      board: "FrontDeskToday",
      also: ["CheckIn", "Checkout", "WalkIn", "StayFolio"],
      ...chip(summary.counts.arrivalsToday + summary.counts.departuresToday),
    });
  }
  if (bookings) {
    front.push({
      id: "bookings",
      label: "Bookings",
      board: "Reservations",
      also: ["ReservationDetail"],
      ...chip(summary.counts.requestsWaiting),
    });
  }
  if (desk || bookings) front.push({ id: "calendar", label: "Calendar", board: "StaysCalendar" });
  if (front.length > 0) {
    items.push({ id: "desk", label: "Front desk", icon: "Persons", board: front[0].board, tabs: front });
  }

  const rooms: NavTab[] = [];
  if (can(scope, "listing.manage")) {
    rooms.push({ id: "prices", label: "Prices", board: "AvailabilityCalendar" });
  }
  if (can(scope, "housekeeping.set", "stay.checkin")) {
    rooms.push({ id: "cleaning", label: "Cleaning", board: "HousekeepingBoard" });
  }
  if (summary.business.size === "full" && can(scope, "ticket.advance", "stay.checkin")) {
    rooms.push({ id: "maintenance", label: "Maintenance", board: "Maintenance" });
  }
  if (rooms.length > 0) {
    const label = words.many.charAt(0).toUpperCase() + words.many.slice(1);
    items.push({ id: "rooms", label, icon: "LayoutCells", board: rooms[0].board, tabs: rooms });
  }

  if (can(scope, "message.send"))
    items.push({ id: "messages", label: "Messages", icon: "Comments", board: "Messages" });
  if (can(scope, "team.manage")) {
    items.push({
      id: "team",
      label: summary.business.size === "compact" ? "Helpers" : "Team",
      icon: "PersonsLock",
      board: "TeamRoles",
    });
  }
  // The sidebar chip of an area: what waits on any of its pages.
  for (const item of items) {
    const waiting = (item.tabs ?? []).reduce((t, tab) => t + Number(tab.chip ?? 0), 0);
    if (item.tabs && waiting > 0) item.chip = String(waiting);
  }
  return [{ label: null, items }];
}

/**
 * The sidebar of a stay business's owner or manager; null when the workspace lets no rooms. A business with no rooms
 * that sells from a bar or restaurant outlet is run from the point of sale (as its home page already decides), so it
 * gets the business sidebar, not a front desk, rooms and a hotel's menu.
 */
export async function staysNav(home: "OwnerHome" | "ManagerToday" = "OwnerHome"): Promise<NavGroup[] | null> {
  const [scope, summary] = await Promise.all([staysScope(), staysSummary()]);
  if (!scope || !summary) return null;
  if (summary.business.rooms === 0 && (await sellsFromPos())) return barRestaurantNavGroups(scope);
  return staysNavGroups(scope, summary, home);
}

/**
 * The owner's or manager's sidebar on the workspace pages (team, business settings, audit) of a bar and restaurant:
 * the way back to the point of sale and the business's own pages, never a front desk or rooms it does not have.
 */
export function barRestaurantNavGroups(scope: Pick<StaysScope, "permissions">): NavGroup[] {
  const items: NavItem[] = [];
  if (can(scope, "shift.review", "money.view"))
    items.push({ id: "pos-dashboard", label: "Dashboard", icon: "House", board: "PosDashboard" });
  items.push({ id: "pos-floor", label: "Floor", icon: "LayoutCells", board: "PosFloor" });
  if (can(scope, "customer.view", "customer.manage"))
    items.push({ id: "pos-customers", label: "Customers", icon: "Persons", board: "PosCustomers" });
  const business: NavItem[] = [];
  if (can(scope, "team.manage")) business.push({ id: "team", label: "Team", icon: "PersonsLock", board: "TeamRoles" });
  return business.length > 0
    ? [
        { label: null, items },
        { label: "Business", items: business },
      ]
    : [{ label: null, items }];
}

/** Whether the workspace has a bar or restaurant outlet to sell from. A failed read counts as no (the hotel menu stays). */
async function sellsFromPos(): Promise<boolean> {
  try {
    return (await posOutlets(await requestContext())).length > 0;
  } catch {
    return false;
  }
}
