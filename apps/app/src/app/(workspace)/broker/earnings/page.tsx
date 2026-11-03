import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { EarningsView } from "@/features/broker/EarningsView";
import { NotABroker } from "@/features/broker/shared";
import { requirePersona } from "@/lib/session";
import { brokerEarnings, brokerScope } from "@/server/broker/client";

export const metadata: Metadata = { title: screens.BrokerEarnings.pageTitle };

/** The fees landlords recorded for the broker, owed and paid. */
export default async function BrokerEarningsPage() {
  await requirePersona("BrokerEarnings");
  if (!(await brokerScope())) return <NotABroker title="Earnings" />;
  return <EarningsView data={await brokerEarnings()} />;
}

export const dynamic = "force-dynamic";
