import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { type BrokersShow, BrokersView } from "@/features/rentals/brokers/BrokersView";
import { NoRentalsBusiness } from "@/features/rentals/shared";
import { requirePersona } from "@/lib/session";
import { landlordPlacements } from "@/server/rentals/brokers";
import { landlordScope } from "@/server/rentals/client";

export const metadata: Metadata = { title: screens.LandlordBrokers.pageTitle };

const SHOWS: readonly BrokersShow[] = ["open", "leased", "all"];

/** Brokers who brought tenants: the tab and search are the URL's (`?show=&q=`). */
export default async function LandlordBrokersPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; q?: string }>;
}) {
  await requirePersona("LandlordBrokers");
  const scope = await landlordScope();
  if (!scope) return <NoRentalsBusiness title="Brokers" />;
  const params = await searchParams;
  const show = (SHOWS as readonly string[]).includes(params.show ?? "") ? (params.show as BrokersShow) : "all";
  const list = await landlordPlacements();
  return <BrokersView list={list} show={show} q={(params.q ?? "").slice(0, 80)} />;
}

export const dynamic = "force-dynamic";
