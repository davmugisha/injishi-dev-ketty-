import { screens } from "@injishi/data";
import type {
  FolioCharge,
  FolioPayment,
  GuestFolioRecord,
  GuestStayRecord,
  PaymentMethod,
} from "@injishi/data/fixtures/guest";
import { type FolioPaymentState, type FolioStage, GuestFolioView } from "@injishi/product-pms/web";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PmsMount } from "@/features/pms/pms-mount";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.GuestFolio.pageTitle };

const STAGES: FolioStage[] = ["in-stay", "checked-out"];
const PAYMENTS: FolioPaymentState[] = ["ready", "pending", "unknown", "verified"];

export default async function GuestFolioPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; payment?: string }>;
}) {
  await requirePersona("GuestFolio");
  const [folios, charges, payments, methods, stays] = await Promise.all([
    getCollection<GuestFolioRecord>("guest.folios"),
    getCollection<FolioCharge>("guest.folioCharges"),
    getCollection<FolioPayment>("guest.folioPayments"),
    getCollection<PaymentMethod>("guest.paymentMethods"),
    getCollection<GuestStayRecord>("guest.stays"),
  ]);
  const folio = folios[0];
  const stay = stays[0];
  if (!folio || !stay || !charges.length) notFound();
  const { stage, payment } = await searchParams;
  return (
    <PmsMount>
      <GuestFolioView
        data={{ folio, charges, payments, methods, initials: stay.initials, property: stay.property }}
        stage={STAGES.includes(stage as FolioStage) ? (stage as FolioStage) : "in-stay"}
        payment={PAYMENTS.includes(payment as FolioPaymentState) ? (payment as FolioPaymentState) : "ready"}
      />
    </PmsMount>
  );
}
