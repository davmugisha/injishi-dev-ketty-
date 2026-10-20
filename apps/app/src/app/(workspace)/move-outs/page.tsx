import { screens } from "@injishi/data";
import type { DepositKpi, MoveOutCase, ResidenceUnit } from "@injishi/data/fixtures/residence";
import type { Metadata } from "next";
import { MoveOutsView } from "@/features/residence/MoveOutsView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.MoveOuts.pageTitle };

export default async function MoveOutsPage() {
  const persona = await requirePersona("MoveOuts");
  const [kpis, cases, units] = await Promise.all([
    getCollection<DepositKpi>("residence.depositKpis"),
    getCollection<MoveOutCase>("residence.moveOuts"),
    getCollection<ResidenceUnit>("residence.units"),
  ]);
  return <MoveOutsView persona={persona} data={{ kpis, cases, units }} />;
}
