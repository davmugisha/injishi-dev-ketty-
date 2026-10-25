import type { RentalsAttentionKind, RentalsSetupStep, RentalUnitView } from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import { ActionLink, EmptyBlock, PageContent, PageHeader } from "@injishi/ui";

/** The settings page's sections, as `?tab=` names them. */
export const SETTINGS_TABS = ["getting-paid", "location", "lease-defaults", "signatory"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const settingsHref = (tab: SettingsTab): string => `${screenHref("RentalsSettings")}?tab=${tab}`;

/** Where each setup step is done. */
export const SETUP_STEP_HREF: Record<RentalsSetupStep, string> = {
  location: settingsHref("location"),
  units: `${screenHref("Units")}?add=1`,
  getting_paid: settingsHref("getting-paid"),
  lease_defaults: settingsHref("lease-defaults"),
  signatory: settingsHref("signatory"),
};

/** Where a "Needs attention" line is dealt with, for the screens that exist so far. */
export const ATTENTION_HREF: Partial<Record<RentalsAttentionKind, { href: string; label: string }>> = {
  setup_incomplete: { href: screenHref("RentalsSetup"), label: "Open setup" },
  no_payout_account: { href: settingsHref("getting-paid"), label: "Add an account" },
  leases_to_sign: { href: `${screenHref("Leases")}?tab=to_sign`, label: "Open leases to sign" },
  waiting_for_tenant: { href: `${screenHref("Leases")}?tab=waiting_for_tenant`, label: "Open leases out for signing" },
  ready_to_start: { href: `${screenHref("Leases")}?tab=ready_to_start`, label: "Open leases ready to start" },
  overdue_rent: { href: `${screenHref("Leases")}?tab=active`, label: "Open active leases" },
};

export const ATTENTION_ICON: Record<RentalsAttentionKind, string> = {
  setup_incomplete: "ListCheck",
  no_payout_account: "Wallet",
  overdue_rent: "Wallet",
  leases_to_sign: "FileText",
  ready_to_start: "FileCheck",
  notices_to_acknowledge: "ArrowRightFromSquare",
  filings_due: "Receipt",
  waiting_for_tenant: "Hourglass",
};

/** A unit's status chip key: retired and off market from its state, else occupancy from its leases. */
export function unitStatus(u: Pick<RentalUnitView, "state" | "occupancy">): string {
  if (u.state === "retired") return "retired";
  if (u.occupancy === "occupied") return "occupied";
  if (u.occupancy === "reserved") return "reserved";
  if (u.state === "off_market") return "off_market";
  return "vacant";
}

/** "2 bedrooms", "Studio", null when not said. */
export function bedroomsWords(bedrooms: number | null): string | null {
  if (bedrooms === null) return null;
  if (bedrooms === 0) return "Studio";
  return `${bedrooms} ${bedrooms === 1 ? "bedroom" : "bedrooms"}`;
}

/** A rentals page opened by someone with no running residence business to act in. */
export function NoRentalsBusiness({ title }: { title: string }) {
  return (
    <PageContent>
      <PageHeader title={title} />
      <EmptyBlock
        icon="FolderHouse"
        title="There is no rentals business here"
        description="Rentals open once a residence business you belong to is approved."
        action={
          <ActionLink href={screenHref("Register")} icon="Plus">
            Register a business
          </ActionLink>
        }
      />
    </PageContent>
  );
}
