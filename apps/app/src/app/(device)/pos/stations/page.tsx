import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { loadPosPage } from "@/features/pos/load";
import { PosBlocked } from "@/features/pos/PosBlocked";
import { PosStationsView } from "@/features/pos/PosStationsView";
import { posTickets } from "@/server/pos";

export const metadata: Metadata = { title: screens.PosStations.pageTitle };

/** The live kitchen or bar board of one outlet, from the API. */
export default async function PosStationsPage({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string; kind?: string }>;
}) {
  const { outlet: outletParam, kind: kindParam } = await searchParams;
  const page = await loadPosPage("PosStations", outletParam);
  if (!page.ok) return <PosBlocked title={page.title} message={page.message} />;
  const kind = kindParam === "bar" ? "bar" : "kitchen";
  const tickets = await posTickets(page.ctx, page.outlet.id, kind);
  return <PosStationsView outlet={page.outlet} kind={kind} tickets={tickets} can={page.can} />;
}
