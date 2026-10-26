import { screens } from "@injishi/data";
import type { ExceptionGroup, FinanceException, FinanceKpi, ResolvedException } from "@injishi/data/fixtures/finance";
import type { Metadata } from "next";
import { FinanceHomeView, type QueryOutcome } from "@/features/finance/FinanceHomeView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.FinanceHome.pageTitle };

const OUTCOMES: QueryOutcome[] = ["successful", "failed", "no-answer"];

export default async function FinanceHomePage({ searchParams }: { searchParams: Promise<{ queryOutcome?: string }> }) {
  await requirePersona("FinanceHome");
  const [groups, exceptions, kpis, resolved] = await Promise.all([
    getCollection<ExceptionGroup>("finance.exceptionGroups"),
    getCollection<FinanceException>("finance.exceptions"),
    getCollection<FinanceKpi>("finance.homeKpis"),
    getCollection<ResolvedException>("finance.resolvedToday"),
  ]);
  const { queryOutcome } = await searchParams;
  const outcome = OUTCOMES.find((o) => o === queryOutcome) ?? "successful";
  return <FinanceHomeView data={{ groups, exceptions, kpis, resolved }} queryOutcome={outcome} />;
}
