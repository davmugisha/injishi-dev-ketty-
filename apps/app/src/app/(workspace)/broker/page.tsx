import { kigaliToday } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { BrokerHomeView } from "@/features/broker/BrokerHomeView";
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

/** The broker's home: where a real broker lands after signing in. */
export default async function BrokerHomePage() {
  const persona = await requirePersona("BrokerWork");
  if (!(await brokerScope())) return <NotABroker title="Home" />;
  const [summary, homes, placements, plan, earnings] = await Promise.all([
    brokerSummary(),
    brokerHomes({ sort: "newest" }),
    brokerPlacements(),
    brokerPlan(),
    brokerEarnings(),
  ]);
  return (
    <BrokerHomeView
      firstName={persona.firstName}
      summary={summary}
      homes={homes}
      placements={placements}
      plan={plan}
      earnings={earnings}
      today={kigaliToday()}
    />
  );
}

export const dynamic = "force-dynamic";
