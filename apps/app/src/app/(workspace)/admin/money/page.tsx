import { screens } from "@injishi/data";
import type { LedgerAccount, LedgerPosting, MoneyOverride, ReconRun } from "@injishi/data/fixtures/admin";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { AdminMoneyView } from "@/features/admin/AdminMoneyView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.AdminMoney.pageTitle };

export default async function AdminMoneyPage() {
  await requirePersona("AdminMoney");
  const [accounts, postings, runs, overrides] = await Promise.all([
    getCollection<LedgerAccount>("admin.ledgerAccounts"),
    getCollection<LedgerPosting>("admin.ledgerPostings"),
    getCollection<ReconRun>("admin.reconRuns"),
    getCollection<MoneyOverride>("admin.overrides"),
  ]);
  return <AdminMoneyView data={{ accounts, postings, runs, overrides }} />;
}
