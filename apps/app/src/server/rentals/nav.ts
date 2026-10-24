/**
 * The landlord's sidebar (WP 2.2), built per request from what the person may do in the business and the
 * business's own counts (`GET /ops/rentals/summary`). Only screens that exist are listed; a count shows
 * only when there is something to count. Hiding an item is presentation: the API still decides.
 */
import type { RentalsSummary } from "@injishi/contracts";
import type { NavGroup, NavItem } from "@injishi/data";
import { ApiError } from "../api";
import { can, type LandlordScope, landlordScope, rentalsSummary } from "./client";

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
): NavGroup[] {
  const groups: NavGroup[] = [
    { label: null, items: [{ id: "home", label: "Home", icon: "House", board: "ResidenceHome" }] },
  ];

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
  if (summary && !summary.setup.complete && can(scope, ...RENTALS_READ)) {
    const left = summary.setup.total - summary.setup.done;
    property.push({ id: "setup", label: "Setup", icon: "ListCheck", board: "RentalsSetup", chip: String(left) });
  }
  if (property.length > 0) groups.push({ label: "Property", items: property });

  // Messages come with the tenant's side (P3): the existing inbox is the hotel desk's.

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
  let summary: RentalsSummary | null = null;
  try {
    summary = can(scope, ...RENTALS_READ) ? await rentalsSummary() : null;
  } catch (error) {
    if (!(error instanceof ApiError) && !(error instanceof Error && error.name === "ApiUnreachableError")) throw error;
  }
  return landlordNavGroups(scope, summary);
}
