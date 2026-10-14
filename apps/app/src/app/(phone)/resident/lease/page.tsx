import { screens } from "@injishi/data";
import type { LeaseDocument, MoveOutStep, NoticeReason, RenewalOffer, Tenancy } from "@injishi/data/fixtures/resident";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantLeaseView } from "@/features/resident/TenantLeaseView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.TenantLease.pageTitle };

export default async function TenantLeasePage() {
  const persona = await requirePersona("TenantLease");
  const [tenancies, offers, documents, steps, reasons] = await Promise.all([
    getCollection<Tenancy>("resident.tenancies"),
    getCollection<RenewalOffer>("resident.renewalOffers"),
    getCollection<LeaseDocument>("resident.leaseDocuments"),
    getCollection<MoveOutStep>("resident.moveOutSteps"),
    getCollection<NoticeReason>("resident.noticeReasons"),
  ]);
  const tenancy = tenancies.find((t) => t.persona === persona.id) ?? tenancies[0];
  const offer = tenancy ? offers.find((o) => o.lease === tenancy.id) : undefined;
  if (!tenancy || !offer || !documents.length || !steps.length || !reasons.length) notFound();
  return <TenantLeaseView tenancy={tenancy} offer={offer} documents={documents} steps={steps} reasons={reasons} />;
}
