import { screens } from "@injishi/data";
import type { AccountingKpi, AgingBucket, ArAccount, BankTransfer } from "@injishi/data/fixtures/accounting";
import type { Metadata } from "next";
import { AccountsReceivableView } from "@/features/accounting/AccountsReceivableView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.AccountsReceivable.pageTitle };

export default async function AccountsReceivablePage({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  const persona = await requirePersona("AccountsReceivable");
  const [kpis, accounts, aging, transfers] = await Promise.all([
    getCollection<AccountingKpi>("accounting.kpis"),
    getCollection<ArAccount>("accounting.arAccounts"),
    getCollection<AgingBucket>("accounting.arAging"),
    getCollection<BankTransfer>("accounting.bankTransfers"),
  ]);
  const { entity } = await searchParams;
  return (
    <AccountsReceivableView
      persona={persona}
      initialEntity={entity === "res" ? "res" : "ahl"}
      data={{ kpis: kpis.filter((k) => k.board === "AccountsReceivable"), accounts, aging, transfers }}
    />
  );
}
