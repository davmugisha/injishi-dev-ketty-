/**
 * The landlord's sidebar (WP 2.2), built per request from what the person may do in the business and the
 * business's own counts (`GET /ops/rentals/summary`). Only screens that exist are listed; a count shows
 * only when there is something to count. Hiding an item is presentation: the API still decides.
 */
import type { RentalsSummary } from "@injishi/contracts";
import type { NavGroup, NavItem } from "@injishi/data";
import { ApiError } from "../api";
import { can, type LandlordScope, landlordScope, rentalsSummary } from "./client";
import { landlordUnread, quietUnread } from "../messages";
import { faultCounts } from "./faults";

const RENTALS_READ = [
  "lease.manage",
  "unit.manage",
  "listing.manage",
  "money.view",
  "rent.record",
  "deposit.return",
  "payout.manage",
  "lease.sign",
];

export function landlordNavGroups(
  scope: Pick<LandlordScope, "permissions">,
  summary: RentalsSummary | null,
  /** Faults still to be fixed (reported, seen or in hand), when the person works on faults. */
  openFaults: number | null = null,
  /** Lines from tenants this person has not read, when they answer messages (P3.4). */
  unreadMessages: number | null = null,
): NavGroup[] {
  const top: NavItem[] = [{ id: "home", label: "Home", icon: "House", board: "ResidenceHome" }];
  if (can(scope, "message.send")) {
    top.push({
      id: "messages",
      label: "Messages",
      icon: "Comments",
      board: "LandlordMessages",
      ...(unreadMessages && unreadMessages > 0 ? { chip: String(unreadMessages) } : {}),
    });
  }
  const groups: NavGroup[] = [{ label: null, items: top }];

  const property: NavItem[] = [];
  if (can(scope, "unit.manage", "lease.manage", "money.view")) {
    const vacant = summary?.counts.vacantUnits ?? 0;
    property.push({
      id: "units",
      label: "Units",
      icon: "FolderHouse",
      board: "Units",
      ...(vacant > 0 ? { chip: String(vacant) } : {}),
    });
  }
  if (can(scope, "lease.manage", "rent.record", "money.view", "deposit.return")) {
    const waiting = (summary?.counts.leasesToSign ?? 0) + (summary?.counts.readyToStart ?? 0);
    property.push({
      id: "leases",
      label: "Leases",
      icon: "FileText",
      board: "Leases",
      ...(waiting > 0 ? { chip: String(waiting) } : {}),
    });
  }
  if (can(scope, "ticket.advance")) {
    property.push({
      id: "faults",
      label: "Faults",
      icon: "Wrench",
      board: "Faults",
      ...(openFaults && openFaults > 0 ? { chip: String(openFaults) } : {}),
    });
  }
  if (can(scope, "guest.register")) {
    property.push({ id: "guests", label: "My guests", icon: "PersonPlus", board: "LandlordGuests" });
  }
  if (summary && !summary.setup.complete && can(scope, ...RENTALS_READ)) {
    const left = summary.setup.total - summary.setup.done;
    property.push({ id: "setup", label: "Setup", icon: "ListCheck", board: "RentalsSetup", chip: String(left) });
  }
  if (property.length > 0) groups.push({ label: "Property", items: property });

  const money: NavItem[] = [];
  if (can(scope, "money.view", "expense.manage")) {
    money.push({ id: "expenses", label: "Expenses", icon: "Receipt", board: "Expenses" });
  }
  if (can(scope, "money.view", "tax.manage")) {
    const filings = summary?.counts.filingsDue ?? 0;
    money.push({
      id: "taxes",
      label: "Taxes",
      icon: "Calculator",
      board: "Taxes",
      ...(filings > 0 ? { chip: String(filings) } : {}),
    });
  }
  if (money.length > 0) groups.push({ label: "Money", items: money });

  const business: NavItem[] = [];
  if (can(scope, "team.manage")) business.push({ id: "team", label: "Team", icon: "Persons", board: "TeamRoles" });
  if (can(scope, ...RENTALS_READ))
    business.push({ id: "settings", label: "Settings", icon: "Gear", board: "RentalsSettings" });
  if (business.length > 0) groups.push({ label: "Business", items: business });
  return groups;
}

/** The sidebar of the landlord in this request. A summary the API can't give leaves the counts out. */
export async function landlordNav(): Promise<NavGroup[]> {
  const scope = await landlordScope();
  if (!scope) return [{ label: null, items: [{ id: "home", label: "Home", icon: "House", board: "ResidenceHome" }] }];
  const quiet = <T>(read: Promise<T>): Promise<T | null> =>
    read.catch((error) => {
      if (!(error instanceof ApiError) && !(error instanceof Error && error.name === "ApiUnreachableError"))
        throw error;
      return null;
    });
  const [summary, faults, unread] = await Promise.all([
    can(scope, ...RENTALS_READ) ? quiet(rentalsSummary()) : Promise.resolve(null),
    can(scope, "ticket.advance") ? quiet(faultCounts()) : Promise.resolve(null),
    can(scope, "message.send") ? quietUnread(landlordUnread()) : Promise.resolve(null),
  ]);
  return landlordNavGroups(
    scope,
    summary,
    faults ? (faults.open ?? 0) + (faults.in_hand ?? 0) : null,
    unread?.total ?? null,
  );
}
