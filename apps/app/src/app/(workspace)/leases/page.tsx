import { kigaliToday, LeaseTab } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { type LeaseListTab, LeasesView } from "@/features/leases/LeasesView";
import { NoRentalsBusiness } from "@/features/rentals/shared";
import { requirePersona } from "@/lib/session";
import { can, landlordScope } from "@/server/rentals/client";
import { leaseCounts, leaseList } from "@/server/rentals/leases";

export const metadata: Metadata = { title: screens.Leases.pageTitle };

/** Leases: the tab, the search and the page are the URL's (`?tab=&q=&page=`). */
export default async function LeasesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}) {
  await requirePersona("Leases");
  const scope = await landlordScope();
  if (!scope) return <NoRentalsBusiness title="Leases" />;
  const params = await searchParams;
  const tab: LeaseListTab = LeaseTab.safeParse(params.tab).success ? (params.tab as LeaseTab) : "all";
  const q = (params.q ?? "").slice(0, 120);
  const page = Math.max(1, Math.min(10_000, Number.parseInt(params.page ?? "1", 10) || 1));
  const [list, counts] = await Promise.all([leaseList(tab === "all" ? undefined : tab, q, page), leaseCounts()]);
  return (
    <LeasesView
      list={list}
      counts={counts}
      query={{ tab, q, page }}
      today={kigaliToday()}
      canManage={can(scope, "lease.manage")}
      canSign={can(scope, "lease.sign")}
      canRecord={can(scope, "rent.record")}
    />
  );
}

export const dynamic = "force-dynamic";
