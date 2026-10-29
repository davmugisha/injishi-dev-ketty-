import { screens } from "@injishi/data";
import type { CancellationTier, PaymentOutcome, ReservationRecord } from "@injishi/data/fixtures/frontdesk";
import { ReservationDetailView } from "@injishi/product-pms/web";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PmsMount } from "@/features/pms/pms-mount";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument } from "@/server/data";

type Params = Promise<{ id: string }>;

/** Registry title ("Front desk · Booking BK-20433") with this record's booking id. */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const href = screens.ReservationDetail.href;
  const seeded = href.slice(href.lastIndexOf("/") + 1);
  return { title: screens.ReservationDetail.pageTitle.replace(seeded, decodeURIComponent(id)) };
}

const OUTCOMES: readonly PaymentOutcome[] = ["pending", "verified", "unknown"];

/** Reservation record. `?payment=pending|verified|unknown` shows each deposit outcome (default pending). */
export default async function ReservationDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ payment?: string }>;
}) {
  await requirePersona("ReservationDetail");
  const { id } = await params;
  const [record, tiers] = await Promise.all([
    getDocument<ReservationRecord>("frontdesk.reservationRecords", decodeURIComponent(id)),
    getCollection<CancellationTier>("frontdesk.cancellationTiers"),
  ]);
  if (!record) notFound();
  const { payment } = await searchParams;
  const outcome = OUTCOMES.find((o) => o === payment) ?? "pending";
  return (
    <PmsMount>
      <ReservationDetailView key={outcome} record={record} tiers={tiers} payment={outcome} />
    </PmsMount>
  );
}
