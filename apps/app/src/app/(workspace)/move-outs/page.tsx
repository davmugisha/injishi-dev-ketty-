import { kigaliToday, MoveOutTab } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { MoveOutsView } from "@/features/move-outs/MoveOutsView";
import { NoRentalsBusiness } from "@/features/rentals/shared";
import { requirePersona } from "@/lib/session";
import { can, landlordScope } from "@/server/rentals/client";
import { moveOutList } from "@/server/rentals/move-outs";

export const metadata: Metadata = { title: screens.MoveOuts.pageTitle };

/** Move-outs: the tab and search are the URL's (`?tab=&q=`). */
export default async function MoveOutsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  await requirePersona("MoveOuts");
  const scope = await landlordScope();
  if (!scope) return <NoRentalsBusiness title="Move-outs" />;
  const params = await searchParams;
  const tab = MoveOutTab.safeParse(params.tab).success ? (params.tab as MoveOutTab) : "to_acknowledge";
  const q = (params.q ?? "").slice(0, 120);
  const list = await moveOutList(tab, q);
  return (
    <MoveOutsView
      list={list}
      q={q}
      today={kigaliToday()}
      canManage={can(scope, "lease.manage")}
      canSettle={can(scope, "deposit.return")}
    />
  );
}

export const dynamic = "force-dynamic";
