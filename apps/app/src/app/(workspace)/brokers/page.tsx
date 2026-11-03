import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { BrokersView } from "@/features/rentals/brokers/BrokersView";
import { NoRentalsBusiness } from "@/features/rentals/shared";
import { requirePersona } from "@/lib/session";
import { landlordPlacements } from "@/server/rentals/brokers";
import { landlordScope } from "@/server/rentals/client";

export const metadata: Metadata = { title: screens.LandlordBrokers.pageTitle };

/** Brokers who brought tenants, with the fee each lease records. */
export default async function LandlordBrokersPage() {
  await requirePersona("LandlordBrokers");
  const scope = await landlordScope();
  if (!scope) return <NoRentalsBusiness title="Brokers" />;
  const list = await landlordPlacements();
  return <BrokersView list={list} />;
}

export const dynamic = "force-dynamic";
