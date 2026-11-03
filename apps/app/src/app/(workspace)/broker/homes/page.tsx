import { BrokerHomesQuery } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { HomesView } from "@/features/broker/HomesView";
import { NotABroker } from "@/features/broker/shared";
import { requirePersona } from "@/lib/session";
import { brokerHomes, brokerScope } from "@/server/broker/client";

export const metadata: Metadata = { title: screens.BrokerDirectory.pageTitle };

type Params = Record<string, string | undefined>;

/** Find homes: the homes the plan shows, with the map; the filters are the URL's. `?home=` opens one. */
export default async function BrokerFindHomesPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requirePersona("BrokerDirectory");
  if (!(await brokerScope())) return <NotABroker title="Find homes" />;
  const params = await searchParams;
  const parsed = BrokerHomesQuery.safeParse({
    district: params.district,
    minRent: params.minRent,
    maxRent: params.maxRent,
    bedrooms: params.bedrooms,
    q: params.q,
    sort: params.sort,
  });
  const data = await brokerHomes(parsed.success ? parsed.data : {});
  return <HomesView data={data} openUnitId={params.home ?? null} />;
}

export const dynamic = "force-dynamic";
