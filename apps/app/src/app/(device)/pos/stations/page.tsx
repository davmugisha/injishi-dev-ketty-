import type { Metadata } from "next";
import { parseStation } from "@/features/pos/kds";
import { loadPosPage } from "@/features/pos/load";
import { PosBlocked } from "@/features/pos/pos-blocked";
import { POS_BOARDS } from "@/features/pos/pos-boards";
import { PosStationsView } from "@/features/pos/pos-stations-view";
import { posTickets, roleOf } from "@/server/pos";

export const metadata: Metadata = { title: POS_BOARDS.PosStations.pageTitle };

/**
 * The kitchen and the bar display of one outlet, from the API. One page, two separate displays: `?kind=bar` opens the
 * bar (the older kitchen and bar links keep working), anything else the kitchen. Both are read at once so each display
 * can show the other's count.
 */
export default async function PosStationsPage({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string; kind?: string }>;
}) {
  const { outlet: outletParam, kind: kindParam } = await searchParams;
  const page = await loadPosPage("PosStations", outletParam);
  if (!page.ok) return <PosBlocked title={page.title} message={page.message} firstOutlet={page.firstOutlet} />;
  const tickets = await posTickets(page.ctx, page.outlet.id);
  // With no display named in the link, a bartender's board opens on the bar; everyone else's on the kitchen.
  const station = parseStation(kindParam ?? (roleOf(page.ctx) === "bartender" ? "bar" : undefined));
  return <PosStationsView outlet={page.outlet} initialStation={station} tickets={tickets} can={page.can} />;
}
