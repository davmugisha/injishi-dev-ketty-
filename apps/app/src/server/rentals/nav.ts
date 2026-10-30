/**
 * The landlord's sidebar (WP 2.2), built per request from what the person may do in the business and the
 * business's own counts (`GET /ops/rentals/summary`). Only screens that exist are listed; a count shows
 * only when there is something to count. Hiding an item is presentation: the API still decides.
 */
import type { RentalsSummary } from "@injishi/contracts";
import type { NavGroup, NavItem, NavTab } from "@injishi/data";
import { ApiError } from "../api";
import { landlordUnread, quietUnread } from "../messages";
import { can, type LandlordScope, landlordScope, rentalsSummary } from "./client";
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
  const count = (n: number | null | undefined) => (n && n > 0 ? { chip: String(n) } : {});
  // Few sidebar items (2026-10-30): each area's pages are tabs at the top of its pages.
  const items: NavItem[] = [];

  const home: NavTab[] = [{ id: "overview", label: "Overview", board: "ResidenceHome" }];
  if (can(scope, "money.view", "lease.manage", "rent.record")) {
    home.push({ id: "calendar", label: "Calendar", board: "RentalsCalendar" });
  }
  if (summary) {
    const waiting = summary.attention.length;
    home.push({ id: "todo", label: "To do", board: "RentalsTodo", also: ["RentalsSetup"], ...count(waiting) });
  }
  items.push({ id: "home", label: "Home", icon: "House", board: "ResidenceHome", tabs: home });

  const property: NavTab[] = [];
  if (can(scope, "unit.manage", "lease.manage", "money.view")) {
    property.push({ id: "units", label: "Units", board: "Units" });
  }
  if (can(scope, "lease.manage", "rent.record", "money.view", "deposit.return")) {
    property.push({
      id: "leases",
      label: "Leases",
      board: "Leases",
      also: ["LeaseNew", "LeaseRecord"],
      ...count((summary?.counts.leasesToSign ?? 0) + (summary?.counts.readyToStart ?? 0)),
    });
  }
  if (can(scope, "ticket.advance")) {
    property.push({ id: "faults", label: "Faults", board: "Faults", ...count(openFaults) });
  }
  if (can(scope, "lease.manage", "deposit.return")) {
    property.push({
      id: "move-outs",
      label: "Move-outs",
      board: "MoveOuts",
      ...count(summary?.counts.noticesToAcknowledge),
    });
  }
  if (property.length > 0) {
    items.push({ id: "property", label: "Property", icon: "FolderHouse", board: property[0].board, tabs: property });
  }

  const money: NavTab[] = [];
  if (can(scope, "money.view", "rent.record")) money.push({ id: "rent", label: "Rent", board: "RentPayments" });
  if (can(scope, "money.view", "payout.manage")) money.push({ id: "payouts", label: "Payouts", board: "RentPayouts" });
  if (can(scope, "money.view", "expense.manage")) money.push({ id: "expenses", label: "Expenses", board: "Expenses" });
  if (can(scope, "money.view", "tax.manage")) {
    money.push({ id: "taxes", label: "Taxes", board: "Taxes" });
    money.push({ id: "filings", label: "RRA filings", board: "TaxFilings", ...count(summary?.counts.filingsDue) });
  }
  if (money.length > 0) items.push({ id: "money", label: "Money", icon: "Wallet", board: money[0].board, tabs: money });

  const people: NavTab[] = [];
  if (can(scope, "lease.manage", "message.send"))
    people.push({ id: "brokers", label: "Brokers", board: "LandlordBrokers" });
  if (can(scope, "guest.register")) people.push({ id: "guests", label: "My guests", board: "LandlordGuests" });
  if (people.length > 0) {
    items.push({ id: "people", label: "People", icon: "Persons", board: people[0].board, tabs: people });
  }

  if (can(scope, "message.send")) {
    items.push({
      id: "messages",
      label: "Messages",
      icon: "Comments",
      board: "LandlordMessages",
      ...count(unreadMessages),
    });
  }
  // The team is a tab of Settings (`?tab=team`), not an item of its own.
  if (can(scope, ...RENTALS_READ, "team.manage")) {
    items.push({ id: "settings", label: "Settings", icon: "Gear", board: "RentalsSettings" });
  }
  // The sidebar chip of an area: what waits on any of its pages.
  for (const item of items) {
    const waiting = (item.tabs ?? []).reduce((t, tab) => t + Number(tab.chip ?? 0), 0);
    if (item.tabs && waiting > 0) item.chip = String(waiting);
  }
  return [{ label: null, items }];
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
