import { FaultTab, kigaliToday } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { type FaultListTab, FaultsView } from "@/features/faults/FaultsView";
import { NoRentalsBusiness } from "@/features/rentals/shared";
import { requirePersona } from "@/lib/session";
import { can, landlordScope, orNull, rentalUnits } from "@/server/rentals/client";
import { faultList, teamMembers } from "@/server/rentals/faults";

export const metadata: Metadata = { title: screens.Faults.pageTitle };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Faults: the tab, unit, search, page and view are the URL's (`?tab=&unit=&q=&page=&view=board`); `?fault=` opens one. */
export default async function FaultsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; unit?: string; q?: string; page?: string; view?: string; fault?: string }>;
}) {
  await requirePersona("Faults");
  const scope = await landlordScope();
  if (!scope) return <NoRentalsBusiness title="Faults" />;
  const params = await searchParams;
  const view = params.view === "board" ? "board" : "list";
  const tab: FaultListTab =
    view === "list" && FaultTab.safeParse(params.tab).success ? (params.tab as FaultTab) : "all";
  const unitId = params.unit && UUID.test(params.unit) ? params.unit : null;
  const q = (params.q ?? "").slice(0, 120);
  const page = Math.max(1, Math.min(10_000, Number.parseInt(params.page ?? "1", 10) || 1));
  const [list, units, team] = await Promise.all([
    faultList(tab === "all" ? undefined : tab, unitId ?? undefined, q, view === "board" ? 1 : page),
    rentalUnits(),
    can(scope, "team.manage") ? orNull(teamMembers()) : Promise.resolve(null),
  ]);
  return (
    <FaultsView
      list={list}
      query={{ tab, unitId, q, page, view }}
      units={units.units.filter((u) => u.state !== "retired").map((u) => ({ id: u.id, label: `Unit ${u.label}` }))}
      openId={params.fault && UUID.test(params.fault) ? params.fault : null}
      team={team?.members ?? null}
      today={kigaliToday()}
      canPay={can(scope, "expense.manage")}
      canReply={can(scope, "message.send")}
    />
  );
}

export const dynamic = "force-dynamic";
