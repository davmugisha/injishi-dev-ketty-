import { screens } from "@injishi/data";
import type { LedgerAccount, LedgerPosting, MoneyDesk, MoneyOverride, ReconRun } from "@injishi/data/fixtures/admin";
import type { Metadata } from "next";
import { AdminMoneyView } from "@/features/admin/AdminMoneyView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.AdminMoney.pageTitle };

export default async function AdminMoneyPage() {
  await requirePersona("AdminMoney");
  const [desks, accounts, postings, runs, overrides] = await Promise.all([
    getCollection<MoneyDesk>("admin.moneyDesk"),
    getCollection<LedgerAccount>("admin.ledgerAccounts"),
    getCollection<LedgerPosting>("admin.ledgerPostings"),
    getCollection<ReconRun>("admin.reconRuns"),
    getCollection<MoneyOverride>("admin.overrides"),
  ]);
  return <AdminMoneyView data={{ desk: desks[0] ?? null, accounts, postings, runs, overrides }} />;
}
