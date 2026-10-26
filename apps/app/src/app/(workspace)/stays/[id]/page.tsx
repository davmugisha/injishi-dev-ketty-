import { screens } from "@injishi/data";
import type {
  ChargeDepartment,
  DeskTender,
  FolioLine,
  FolioPayment,
  Stay,
  StayRecord,
} from "@injishi/data/fixtures/stays";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StayFolioView } from "@/features/stays/StayFolioView";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument } from "@/server/data";

export const metadata: Metadata = { title: screens.StayFolio.pageTitle };

/**
 * The stay and its bill, read live. What has no record yet is not read from the prototype's sample, because
 * none of it is this stay's: its history (no stay audit rows), keys (no lock provider), documents (no receipt
 * list) and a late-checkout fee schedule (no column). The screen says plainly that each is not recorded yet.
 */
export default async function StayFolioPage({ params }: { params: Promise<{ id: string }> }) {
  const persona = await requirePersona("StayFolio");
  const { id } = await params;
  const stay = await getDocument<Stay>("stays.stays", decodeURIComponent(id));
  if (!stay) notFound();
  const [records, lines, payments, chargeDepartments, tenders] = await Promise.all([
    getCollection<StayRecord>("stays.stayRecords"),
    getCollection<FolioLine>("stays.folioLines"),
    getCollection<FolioPayment>("stays.folioPayments"),
    getCollection<ChargeDepartment>("stays.chargeDepartments"),
    getCollection<DeskTender>("stays.deskTenders"),
  ]);
  const mine = <T extends { stayId: string }>(docs: T[]) => docs.filter((d) => d.stayId === stay.id);
  return (
    <StayFolioView
      persona={persona}
      data={{
        stay,
        records: mine(records),
        lines: mine(lines),
        payments: mine(payments),
        history: [],
        access: [],
        documents: [],
        chargeDepartments,
        tenders,
      }}
    />
  );
}
