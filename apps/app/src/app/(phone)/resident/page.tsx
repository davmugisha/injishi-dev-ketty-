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
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantHomeView } from "@/features/resident/TenantHomeView";
import { requirePersona } from "@/lib/session";

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
  const charge = tenancy ? charges.find((c) => c.lease === tenancy.id) : undefined;
  const offer = tenancy ? offers.find((o) => o.lease === tenancy.id) : undefined;
  const thread = threads[0];
  const receipt = receipts[0];
  if (!tenancy || !charge || !receipt || !offer || !thread) notFound();
  return (
    <TenantHomeView
      persona={persona}
      tenancy={tenancy}
      charge={charge}
      receipt={receipt}
      notices={notices}
      thread={thread}
      messages={messages.filter((m) => m.thread === thread.id)}
      offer={offer}
    />
  );
}
