/** Sections of Rates & Inventory, with the primary action each one offers. `?tab=<id>` opens a section. */
export const RATES_INVENTORY_TABS = [
  { id: "types", label: "Room types", action: "Add room type" },
  { id: "rates", label: "Rate plans", action: "New rate plan" },
  { id: "spaces", label: "Spaces", action: "Add space" },
  { id: "amen", label: "Amenities", action: "Add amenity" },
  { id: "meals", label: "Meal plans", action: "Add meal plan" },
] as const;

export type RatesInventoryTab = (typeof RATES_INVENTORY_TABS)[number]["id"];

export function ratesInventoryTab(value: string | undefined): RatesInventoryTab {
  return RATES_INVENTORY_TABS.find((t) => t.id === value)?.id ?? "rates";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-01" → "1 Nov 2026" (deterministic, so server and client render the same text). */
export function ratesInventoryDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}
