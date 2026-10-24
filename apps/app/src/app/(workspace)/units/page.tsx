import { UnitTab } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { NoRentalsBusiness } from "@/features/rentals/shared";
import { UnitsView } from "@/features/rentals/units/UnitsView";
import { requirePersona } from "@/lib/session";
import { can, landlordScope, rentalBlocks, rentalProperties, rentalUnits } from "@/server/rentals/client";

export const metadata: Metadata = { title: screens.Units.pageTitle };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Units: the tab, block and search are the URL's (`?tab=&block=&q=`); `?add=1` and `?blocks=1` open a panel. */
export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; block?: string; q?: string; add?: string; blocks?: string }>;
}) {
  await requirePersona("Units");
  const scope = await landlordScope();
  if (!scope) return <NoRentalsBusiness title="Units" />;
  const params = await searchParams;
  const tab = UnitTab.safeParse(params.tab).success ? (params.tab as UnitTab) : "all";
  const blockId = params.block && UUID.test(params.block) ? params.block : null;
  const q = (params.q ?? "").slice(0, 80);
  const filtered = tab !== "all" || blockId !== null || q !== "";
  const [all, list, blocks, properties] = await Promise.all([
    rentalUnits(),
    filtered ? rentalUnits(tab, blockId ?? undefined, q || undefined) : Promise.resolve(null),
    rentalBlocks(),
    rentalProperties(),
  ]);
  return (
    <UnitsView
      list={list ?? all}
      all={all.units}
      blocks={blocks.blocks}
      properties={properties.properties}
      query={{ tab, blockId, q }}
      canManage={can(scope, "unit.manage")}
      open={params.add === "1" ? "add" : params.blocks === "1" ? "blocks" : null}
    />
  );
}

export const dynamic = "force-dynamic";
