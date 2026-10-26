import { screens } from "@injishi/data";
import type {
  CashGuest,
  ConflictChoice,
  OfflineAction,
  OfflineArrival,
  PaymentRail,
  SyncConflict,
} from "@injishi/data/fixtures/stays";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OfflineDeskView } from "@/features/stays/OfflineDeskView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.OfflineDesk.pageTitle };

export default async function OfflineDeskPage({ searchParams }: { searchParams: Promise<{ offline?: string }> }) {
  const persona = await requirePersona("OfflineDesk");
  const [arrivals, queue, rails, cashGuests, conflicts, choices] = await Promise.all([
    getCollection<OfflineArrival>("stays.offlineArrivals"),
    getCollection<OfflineAction>("stays.offlineQueue"),
    getCollection<PaymentRail>("stays.paymentRails"),
    getCollection<CashGuest>("stays.cashGuests"),
    getCollection<SyncConflict>("stays.syncConflicts"),
    getCollection<ConflictChoice>("stays.conflictChoices"),
  ]);
  const conflict = conflicts[0];
  if (!conflict) notFound();
  const { offline } = await searchParams;
  return (
    <OfflineDeskView
      persona={persona}
      data={{ arrivals, queue, rails, cashGuests, conflict, choices }}
      initialOffline={offline !== "0" && offline !== "false"}
    />
  );
}
