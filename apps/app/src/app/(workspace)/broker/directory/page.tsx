import { screens } from "@injishi/data";
import type {
  BrokerCredits,
  BrokerFeeTerm,
  CreditLogEntry,
  CreditPack,
  DirectoryListing,
} from "@injishi/data/fixtures/public";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { BrokerDirectoryView } from "@/features/public/BrokerDirectoryView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.BrokerDirectory.pageTitle };

export default async function BrokerDirectoryPage() {
  await requirePersona("BrokerDirectory");
  const [credits, fees, listings, log, packs] = await Promise.all([
    getCollection<BrokerCredits>("public.brokerCredits"),
    getCollection<BrokerFeeTerm>("public.brokerFeeTerms"),
    getCollection<DirectoryListing>("public.directoryListings"),
    getCollection<CreditLogEntry>("public.creditLog"),
    getCollection<CreditPack>("public.creditPacks"),
  ]);
  return <BrokerDirectoryView data={{ credits, fees, listings, log, packs }} />;
}
