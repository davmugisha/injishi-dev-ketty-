import { screens } from "@injishi/data";
import type { LandlordPayout, RentKpi, RentLedger, RentRollRow } from "@injishi/data/fixtures/residence";
import type { Metadata } from "next";
import { ResidenceNothingYet } from "@/features/residence/NothingYet";
import { RentRollView } from "@/features/residence/RentRollView";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { residenceBuilding } from "@/server/sources/residence";

export const metadata: Metadata = { title: screens.RentRoll.pageTitle };

export default async function RentRollPage() {
  const persona = await requirePersona("RentRoll");
  const [kpis, rows, ledgers, payouts] = await Promise.all([
    getCollection<RentKpi>("residence.rentKpis"),
    getCollection<RentRollRow>("residence.rentRoll"),
    getCollection<RentLedger>("residence.rentLedgers"),
    getCollection<LandlordPayout>("residence.payouts"),
  ]);
  const building = residenceBuilding(await requestContext());
  if (!rows.length)
    return <ResidenceNothingYet title="Rent roll" building={building} message="No lease has rent due yet." />;
  return <RentRollView persona={persona} data={{ kpis, rows, ledgers, payouts }} building={building} />;
}
