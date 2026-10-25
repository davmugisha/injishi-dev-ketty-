"use client";

import { Toast } from "@heroui/react";
import type { LandlordProfileView, PayoutAccountView, RentalPropertyView, RentalsSetupView } from "@injishi/contracts";
import { FilterTabs, KeyValueList, PageContent, PageHeader, SectionCard } from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { SetupChecklist } from "../SetupChecklist";
import { SETTINGS_TABS, type SettingsTab } from "../shared";
import { BrokerDefaults } from "./BrokerDefaults";
import { LeaseDefaults } from "./LeaseDefaults";
import { Location } from "./Location";
import { PayoutAccounts } from "./PayoutAccounts";
import { Signatory } from "./Signatory";

const LABEL: Record<SettingsTab, string> = {
  "getting-paid": "Getting paid",
  location: "Location",
  "lease-defaults": "Lease defaults",
  signatory: "Who signs",
  brokers: "Brokers",
};

export interface SettingsPermissions {
  payouts: boolean;
  location: boolean;
  leaseDefaults: boolean;
  signatory: boolean;
  brokers: boolean;
}

/** The landlord's settings (WP 2.2): getting paid, where the buildings are, lease defaults, who signs. */
export function RentalsSettingsView({
  tab,
  profile,
  accounts,
  properties,
  setup,
  can,
}: {
  tab: SettingsTab;
  profile: LandlordProfileView;
  accounts: PayoutAccountView[] | null;
  properties: RentalPropertyView[];
  setup: RentalsSetupView | null;
  can: SettingsPermissions;
}) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader title="Settings" description={profile.legalName} />
      <FilterTabs
        label="Settings"
        tabs={SETTINGS_TABS.map((id) => ({ id, label: LABEL[id] }))}
        selectedKey={tab}
        onSelectionChange={(key) => router.replace(`${pathname}?tab=${key}`, { scroll: false })}
      />
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          {tab === "getting-paid" ? <PayoutAccounts accounts={accounts} canManage={can.payouts} /> : null}
          {tab === "location" ? <Location properties={properties} canEdit={can.location} /> : null}
          {tab === "lease-defaults" ? (
            <LeaseDefaults defaults={profile.leaseDefaults} canEdit={can.leaseDefaults} />
          ) : null}
          {tab === "signatory" ? <Signatory signatory={profile.signatory} canEdit={can.signatory} /> : null}
          {tab === "brokers" ? <BrokerDefaults fee={profile.brokerFee} canEdit={can.brokers} /> : null}
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
