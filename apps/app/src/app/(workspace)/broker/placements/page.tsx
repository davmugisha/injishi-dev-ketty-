import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { PlacementsView } from "@/features/broker/PlacementsView";
import { NotABroker } from "@/features/broker/shared";
import { requirePersona } from "@/lib/session";
import { brokerPlacements, brokerScope } from "@/server/broker/client";

export const metadata: Metadata = { title: screens.BrokerPlacements.pageTitle };

export default async function BrokerPlacementsPage() {
  await requirePersona("BrokerPlacements");
  if (!(await brokerScope())) return <NotABroker title="Placements" />;
  return <PlacementsView data={await brokerPlacements()} />;
}

export const dynamic = "force-dynamic";
