import type { Metadata } from "next";
import { HotelsView } from "@/features/broker/hotels-view";
import { NotABroker } from "@/features/broker/shared";
import { requirePersona } from "@/lib/session";
import { brokerDeals, brokerHotels, brokerScope } from "@/server/broker/client";

export const metadata: Metadata = { title: "Hotels" };

export default async function BrokerHotelsPage() {
  await requirePersona("BrokerHotels");
  if (!(await brokerScope())) return <NotABroker title="Hotels" />;
  const [data, deals] = await Promise.all([brokerHotels(), brokerDeals()]);
  return <HotelsView data={data} deals={deals} />;
}

export const dynamic = "force-dynamic";
