import { AdminPayoutStatus } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { type MoneyTab, MoneyView } from "@/features/admin/money/MoneyView";
import { Refused } from "@/features/admin/people/Refused";
import { requirePersona } from "@/lib/session";
import { failedCharges, ledger, payouts, reconRuns } from "@/server/admin/finance";
import { pageOf, type Search, wordOf } from "@/server/admin/list";
import { ApiError } from "@/server/api";
import { getCollection } from "@/server/data";
import type { MoneyDesk } from "@/server/sources/admin";

export const metadata: Metadata = { title: screens.AdminMoney.pageTitle };

const TABS = ["desk", "payouts", "failed", "ledger", "recon"] as const;

/**
 * Money (2026-11-09, real records): what needs a person on the payment account, then payouts, failed charges,
 * the ledger and reconciliation runs, one tab at a time and read only for the tab open (`?tab=`, `?page=`).
 */
export default async function AdminMoneyPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePersona("AdminMoney");
  const sp = await searchParams;
  const tab: MoneyTab = wordOf(sp.tab, TABS) ?? "desk";
  const page = pageOf(sp.page);
  try {
    const [desks, list] = await Promise.all([
      tab === "desk" ? getCollection<MoneyDesk>("admin.moneyDesk") : Promise.resolve([]),
      tab === "payouts"
        ? payouts(page, wordOf(sp.status, AdminPayoutStatus.options)).then((r) => ({ kind: "payouts" as const, r }))
        : tab === "failed"
          ? failedCharges(page).then((r) => ({ kind: "failed" as const, r }))
          : tab === "ledger"
            ? ledger(page).then((r) => ({ kind: "ledger" as const, r }))
            : tab === "recon"
              ? reconRuns(page).then((r) => ({ kind: "recon" as const, r }))
              : Promise.resolve(null),
    ]);
    return <MoneyView tab={tab} desk={desks[0] ?? null} list={list} />;
  } catch (error) {
    if (error instanceof ApiError && error.forbidden) return <Refused code={error.code} />;
    throw error;
  }
}

export const dynamic = "force-dynamic";
