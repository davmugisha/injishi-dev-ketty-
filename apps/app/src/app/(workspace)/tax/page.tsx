import { screens } from "@injishi/data";
import type { FiscalProfile, Levy, VatDeclaration, VatSummary } from "@injishi/data/fixtures/accounting";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { TaxSummaryView } from "@/features/accounting/TaxSummaryView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.TaxSummary.pageTitle };

const STAGES = ["draft", "reviewed", "exported"] as const;

export default async function TaxSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ declaration?: string; merchant?: string; period?: string }>;
}) {
  await requirePersona("TaxSummary");
  const [merchants, summaries, declarations, levies] = await Promise.all([
    getCollection<FiscalProfile>("accounting.fiscalProfiles"),
    getCollection<VatSummary>("accounting.vatSummaries"),
    getCollection<VatDeclaration>("accounting.vatDeclarations"),
    getCollection<Levy>("accounting.levies"),
  ]);
  const { declaration, merchant, period } = await searchParams;
  return (
    <TaxSummaryView
      merchants={merchants}
      summaries={summaries}
      declarations={declarations}
      levies={levies}
      stageOverride={STAGES.find((s) => s === declaration) ?? null}
      initialMerchant={merchants.find((m) => m.id === merchant)?.id ?? merchants[0]?.id ?? "ahl"}
      initialPeriod={period === "oct" ? "oct" : "sep"}
    />
  );
}
