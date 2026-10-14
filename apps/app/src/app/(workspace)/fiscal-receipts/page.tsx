import { screens } from "@injishi/data";
import type {
  FiscalDocumentKind,
  FiscalInvoice,
  FiscalJournalEvent,
  FiscalProfile,
  FiscalQueueItem,
  FiscalReceipt,
  ItemCode,
  VsdcDevice,
  ZReport,
} from "@injishi/data/fixtures/accounting";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { FiscalReceiptsView, type FiscalTab } from "@/features/accounting/FiscalReceiptsView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.FiscalReceipts.pageTitle };

const TABS: FiscalTab[] = ["invoices", "receipts", "queue", "numbering", "journal", "items"];

export default async function FiscalReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ vsdc?: string; tab?: string; merchant?: string }>;
}) {
  const persona = await requirePersona("FiscalReceipts");
  const [profiles, queue, kinds, invoices, receipts, devices, journal, zReports, items] = await Promise.all([
    getCollection<FiscalProfile>("accounting.fiscalProfiles"),
    getCollection<FiscalQueueItem>("accounting.fiscalQueue"),
    getCollection<FiscalDocumentKind>("accounting.documentKinds"),
    getCollection<FiscalInvoice>("accounting.fiscalInvoices"),
    getCollection<FiscalReceipt>("accounting.fiscalReceipts"),
    getCollection<VsdcDevice>("accounting.vsdcDevices"),
    getCollection<FiscalJournalEvent>("accounting.fiscalJournal"),
    getCollection<ZReport>("accounting.zReports"),
    getCollection<ItemCode>("accounting.itemCodes"),
  ]);
  const { vsdc, tab, merchant } = await searchParams;
  const initialTab = TABS.find((t) => t === tab) ?? "queue";
  const initialMerchant = profiles.find((p) => p.id === merchant)?.id ?? profiles[0]?.id ?? "ahl";
  return (
    <FiscalReceiptsView
      persona={persona}
      offline={vsdc === "offline"}
      initialTab={initialTab}
      initialMerchant={initialMerchant}
      data={{ profiles, queue, kinds, invoices, receipts, devices, journal, zReports, items }}
    />
  );
}
