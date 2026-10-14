import { screens } from "@injishi/data";
import type { PackagesItem, PackagesNoticeTier, PackagesWeekend } from "@injishi/data/fixtures/commercial";
import type { Metadata } from "next";
import { PackagesView } from "@/features/commercial/PackagesView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.Packages.pageTitle };

export default async function PackagesPage() {
  await requirePersona("Packages");
  const [packages, weekends, tiers] = await Promise.all([
    getCollection<PackagesItem>("commercial.packagesItems"),
    getCollection<PackagesWeekend>("commercial.packagesWeekends"),
    getCollection<PackagesNoticeTier>("commercial.packagesNoticeTiers"),
  ]);
  return <PackagesView packages={packages} weekends={weekends} tiers={tiers} />;
}
