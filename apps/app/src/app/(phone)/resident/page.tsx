import { screens } from "@injishi/data";
import type {
  MessageThread,
  RenewalOffer,
  RentCharge,
  RentReceipt,
  ResidentNotice,
  Tenancy,
  ThreadMessage,
} from "@injishi/data/fixtures/resident";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantHomeView } from "@/features/resident/TenantHomeView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.TenantHome.pageTitle };

export default async function TenantHomePage() {
  const persona = await requirePersona("TenantHome");
  const [tenancies, charges, receipts, notices, threads, messages, offers] = await Promise.all([
    getCollection<Tenancy>("resident.tenancies"),
    getCollection<RentCharge>("resident.rentCharges"),
    getCollection<RentReceipt>("resident.receipts"),
    getCollection<ResidentNotice>("resident.notices"),
    getCollection<MessageThread>("resident.threads"),
    getCollection<ThreadMessage>("resident.messages"),
    getCollection<RenewalOffer>("resident.renewalOffers"),
  ]);
  const tenancy = tenancies.find((t) => t.persona === persona.id) ?? tenancies[0];
  if (!tenancy) notFound();
  // A tenant with no charge this month, no verified payment, no renewal offer or no conversation yet still has
  // a home screen: the view leaves those parts out rather than the page answering 404.
  const charge = charges.find((c) => c.lease === tenancy.id) ?? null;
  const offer = offers.find((o) => o.lease === tenancy.id) ?? null;
  const thread = threads[0] ?? null;
  const receipt = receipts[0] ?? null;
  return (
    <TenantHomeView
      persona={persona}
      tenancy={tenancy}
      charge={charge}
      receipt={receipt}
      notices={notices}
      thread={thread}
      messages={thread ? messages.filter((m) => m.thread === thread.id) : []}
      offer={offer}
    />
  );
}
