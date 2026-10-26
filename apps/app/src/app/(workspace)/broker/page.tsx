import { BrokerHomesQuery, kigaliToday } from "@injishi/contracts";
import { screens } from "@injishi/data";
import { PageContent } from "@injishi/ui";
import type { Metadata } from "next";
import { BrokerDeskTabs } from "@/features/broker/BrokerDeskTabs";
import { BrokerHomeView } from "@/features/broker/BrokerHomeView";
import { HomesView } from "@/features/broker/HomesView";
import { NotABroker } from "@/features/broker/shared";
import { requirePersona } from "@/lib/session";
import {
  brokerEarnings,
  brokerHomes,
  brokerPlacements,
  brokerPlan,
  brokerScope,
  brokerSummary,
} from "@/server/broker/client";

export const metadata: Metadata = { title: screens.BrokerWork.pageTitle };

type Params = Record<string, string | undefined>;

/**
 * Broker Homes desk: Overview (dashboard) and Find homes share one route with page tabs.
 * Account is the sign-in landing; this is where they work homes.
 */
export default async function BrokerHomesDeskPage({ searchParams }: { searchParams: Promise<Params> }) {
  const persona = await requirePersona("BrokerWork");
  if (!(await brokerScope())) return <NotABroker title="Homes" />;
  const params = await searchParams;
  const tab = params.tab === "homes" ? "homes" : "overview";

  if (tab === "homes") {
    const parsed = BrokerHomesQuery.safeParse({
      district: params.district,
      minRent: params.minRent,
      maxRent: params.maxRent,
      bedrooms: params.bedrooms,
      q: params.q,
      sort: params.sort,
    });
    const data = await brokerHomes(parsed.success ? parsed.data : {});
    return (
      <PageContent>
        <BrokerDeskTabs tab="homes">
          <HomesView data={data} openUnitId={params.home ?? null} desk />
        </BrokerDeskTabs>
      </PageContent>
    );
  }

  const [summary, homes, placements, plan, earnings] = await Promise.all([
    brokerSummary(),
    brokerHomes({ sort: "newest" }),
    brokerPlacements(),
    brokerPlan(),
    brokerEarnings(),
  ]);
  return (
    <PageContent>
      <BrokerDeskTabs tab="overview">
        <BrokerHomeView
          firstName={persona.firstName}
          summary={summary}
          homes={homes}
          placements={placements}
          plan={plan}
          earnings={earnings}
          today={kigaliToday()}
          desk
        />
      </BrokerDeskTabs>
    </PageContent>
  );
}

export const dynamic = "force-dynamic";
