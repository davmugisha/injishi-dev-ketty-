import { screens } from "@injishi/data";
import type {
  RatesInventoryAmenity,
  RatesInventoryMealPlan,
  RatesInventoryRatePlan,
  RatesInventoryRoomType,
  RatesInventorySpace,
} from "@injishi/data/fixtures/commercial";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { ratesInventoryTab } from "@/features/commercial/RatesInventoryTabs";
import { RatesInventoryView } from "@/features/commercial/RatesInventoryView";
import { requirePersona } from "@/lib/session";

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
    <RatesInventoryView
      persona={persona}
      initialTab={ratesInventoryTab(tab)}
      data={{ roomTypes, ratePlans, spaces, amenities, mealPlans }}
    />
  );
}
