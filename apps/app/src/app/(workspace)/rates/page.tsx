import { personas, screens } from "@injishi/data";
import type {
  RatesInventoryAmenity,
  RatesInventoryMealPlan,
  RatesInventoryRatePlan,
  RatesInventoryRoomType,
  RatesInventorySpace,
} from "@injishi/data/fixtures/commercial";
import type { Metadata } from "next";
import { ratesInventoryTab } from "@/features/commercial/RatesInventoryTabs";
import { RatesInventoryView } from "@/features/commercial/RatesInventoryView";
import { PmsMount } from "@/features/pms/pms-mount";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.RatesInventory.pageTitle };

export default async function RatesInventoryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const persona = await requirePersona("RatesInventory");
  const { tab } = await searchParams;
  const [roomTypes, ratePlans, spaces, amenities, mealPlans] = await Promise.all([
    getCollection<RatesInventoryRoomType>("commercial.ratesInventoryRoomTypes"),
    getCollection<RatesInventoryRatePlan>("commercial.ratesInventoryRatePlans"),
    getCollection<RatesInventorySpace>("commercial.ratesInventorySpaces"),
    getCollection<RatesInventoryAmenity>("commercial.ratesInventoryAmenities"),
    getCollection<RatesInventoryMealPlan>("commercial.ratesInventoryMealPlans"),
  ]);
  return (
    <PmsMount>
      <RatesInventoryView
        persona={persona}
        owner={personas.owner.name}
        initialTab={ratesInventoryTab(tab)}
        data={{ roomTypes, ratePlans, spaces, amenities, mealPlans }}
      />
    </PmsMount>
  );
}
