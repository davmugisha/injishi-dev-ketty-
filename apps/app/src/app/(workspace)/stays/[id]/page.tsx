import { screens } from "@injishi/data";
import type {
  ChargeDepartment,
  DeskTender,
  FolioLine,
  FolioPayment,
  LateCheckoutOption,
  Stay,
  StayAccess,
  StayDocument,
  StayEvent,
  StayRecord,
} from "@injishi/data/fixtures/stays";
import { getCollection, getDocument } from "@injishi/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StayFolioView } from "@/features/stays/StayFolioView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.StayFolio.pageTitle };

export default async function StayFolioPage({ params }: { params: Promise<{ id: string }> }) {
  const persona = await requirePersona("StayFolio");
  const { id } = await params;
  const stay = await getDocument<Stay>("stays.stays", decodeURIComponent(id));
  if (!stay) notFound();
  const [records, lines, payments, history, access, documents, lateOptions, chargeDepartments, tenders] =
    await Promise.all([
      getCollection<StayRecord>("stays.stayRecords"),
      getCollection<FolioLine>("stays.folioLines"),
      getCollection<FolioPayment>("stays.folioPayments"),
      getCollection<StayEvent>("stays.stayHistory"),
      getCollection<StayAccess>("stays.stayAccess"),
      getCollection<StayDocument>("stays.stayDocuments"),
      getCollection<LateCheckoutOption>("stays.lateCheckoutOptions"),
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
        history: mine(history),
        access: mine(access),
        documents: mine(documents),
        lateOptions,
        chargeDepartments,
        tenders,
      }}
    />
  );
}
