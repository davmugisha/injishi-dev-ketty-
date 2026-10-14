import { screens } from "@injishi/data";
import type {
  Bill,
  BillLine,
  BillPayment,
  BillSeat,
  FiscalState,
  MomoOutcome,
  Tender,
} from "@injishi/data/fixtures/outlets";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { type MomoId, PosPaymentView } from "@/features/outlets/PosPaymentView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.POSPayment.pageTitle };

const MOMO: readonly MomoId[] = ["pending", "verified", "unknown", "failed"];

export default async function PosPaymentPage({ searchParams }: { searchParams: Promise<{ momo?: string }> }) {
  await requirePersona("POSPayment");
  const { momo: momoParam } = await searchParams;
  const momo = MOMO.find((id) => id === momoParam) ?? "pending";
  const [bills, seats, payments, outcomes, lines, tenders, fiscalStates] = await Promise.all([
    getCollection<Bill>("outlets.bills"),
    getCollection<BillSeat>("outlets.billSeats"),
    getCollection<BillPayment>("outlets.billPayments"),
    getCollection<MomoOutcome>("outlets.momoOutcomes"),
    getCollection<BillLine>("outlets.billLines"),
    getCollection<Tender>("outlets.tenders"),
    getCollection<FiscalState>("outlets.fiscalStates"),
  ]);
  const bill = bills[0];
  if (!bill) return null;
  return <PosPaymentView momo={momo} data={{ bill, seats, payments, outcomes, lines, tenders, fiscalStates }} />;
}
