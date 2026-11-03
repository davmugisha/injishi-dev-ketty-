import { kigaliToday } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrokerHomeView } from "@/features/broker/BrokerHomeView";
import { NotABroker } from "@/features/broker/shared";
import { requirePersona } from "@/lib/session";
import { brokerEarnings, brokerPlan, brokerScope, brokerSummary } from "@/server/broker/client";

export const metadata: Metadata = { title: screens.BrokerWork.pageTitle };

type Params = Record<string, string | undefined>;

/** The broker's overview: the figures, fees over time and the plan. Find homes is its own tab. */
export default async function BrokerOverviewPage({ searchParams }: { searchParams: Promise<Params> }) {
  const persona = await requirePersona("BrokerWork");
  const params = await searchParams;
  // Old links opened Find homes as `/broker?tab=homes`.
  if (params.tab === "homes") {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "tab") q.set(k, v);
    redirect(`/broker/homes${q.size > 0 ? `?${q.toString()}` : ""}`);
  }
  if (!(await brokerScope())) return <NotABroker title="Home" />;
  const [summary, plan, earnings] = await Promise.all([brokerSummary(), brokerPlan(), brokerEarnings()]);
  return (
    <BrokerHomeView
      firstName={persona.firstName}
      summary={summary}
      plan={plan}
      earnings={earnings}
      today={kigaliToday()}
    />
  );
}

export const dynamic = "force-dynamic";
