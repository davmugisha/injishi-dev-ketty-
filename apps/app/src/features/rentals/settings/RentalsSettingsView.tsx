"use client";

import { Toast } from "@heroui/react";
import type {
  LandlordProfileView,
  OperatorStaffInvitation,
  OperatorTeamMember,
  PayoutAccountView,
  RentalPropertyView,
  RentalsSetupView,
} from "@injishi/contracts";
import { FilterTabs, KeyValueList, PageContent, PageHeader, SectionCard } from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { SetupChecklist } from "../SetupChecklist";
import { SETTINGS_TABS, type SettingsTab } from "../shared";
import { BrokerDefaults } from "./BrokerDefaults";
import { LeaseDefaults } from "./LeaseDefaults";
import { Location } from "./Location";
import { PayoutAccounts } from "./PayoutAccounts";
import { Signatory } from "./Signatory";
import { Team } from "./Team";

const LABEL: Record<SettingsTab, string> = {
  "getting-paid": "Getting paid",
  location: "Location",
  "lease-defaults": "Lease defaults",
  signatory: "Who signs",
  brokers: "Brokers",
  team: "Team",
};

export interface SettingsPermissions {
  payouts: boolean;
  location: boolean;
  leaseDefaults: boolean;
  signatory: boolean;
  brokers: boolean;
  team: boolean;
}

/** The landlord's settings (WP 2.2): getting paid, where the buildings are, lease defaults, who signs. */
export function RentalsSettingsView({
  tab,
  profile,
  accounts,
  properties,
  setup,
  team,
  can,
  payOn,
}: {
  tab: SettingsTab;
  profile: LandlordProfileView;
  accounts: PayoutAccountView[] | null;
  properties: RentalPropertyView[];
  setup: RentalsSetupView | null;
  /** The team, for a person who manages it. */
  team: { members: OperatorTeamMember[]; invitations: OperatorStaffInvitation[] } | null;
  can: SettingsPermissions;
  /** Whether Pay is on for this business. Getting paid is Pay's, so its tab goes while Pay is off (ADR-076 G14). */
  payOn: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader title="Settings" />
      <FilterTabs
        label="Settings"
        variant="tabs"
        tabs={SETTINGS_TABS.filter((id) => (id !== "team" || can.team) && (id !== "getting-paid" || payOn)).map(
          (id) => ({ id, label: LABEL[id] }),
        )}
        selectedKey={tab}
        onSelectionChange={(key) => router.replace(`${pathname}?tab=${key}`, { scroll: false })}
      />
      <div className="grid min-w-0 gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 *:last:flex-1 lg:col-span-2">
          {tab === "getting-paid" && payOn ? <PayoutAccounts accounts={accounts} canManage={can.payouts} /> : null}
          {tab === "location" ? <Location properties={properties} canEdit={can.location} /> : null}
          {tab === "lease-defaults" ? (
            <LeaseDefaults defaults={profile.leaseDefaults} canEdit={can.leaseDefaults} />
          ) : null}
          {tab === "signatory" ? <Signatory signatory={profile.signatory} canEdit={can.signatory} /> : null}
          {tab === "brokers" ? <BrokerDefaults fee={profile.brokerFee} canEdit={can.brokers} /> : null}
          {tab === "team" && team ? <Team members={team.members} invitations={team.invitations} /> : null}
        </div>
        {setup && !setup.complete ? (
          <SetupChecklist setup={setup} title="Setup" headingLevel={2} />
        ) : (
          <SectionCard title="Business">
            <KeyValueList
              items={[
                { label: "Name", value: profile.legalName },
                { label: "TIN", value: profile.tin ? <span className="tabular">{profile.tin}</span> : "Not on file" },
              ]}
            />
          </SectionCard>
        )}
      </div>
    </PageContent>
  );
}
