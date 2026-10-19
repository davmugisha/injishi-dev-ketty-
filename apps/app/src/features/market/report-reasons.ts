/**
 * Why someone reports a listing. One list for the property page's choice and for the support ticket the report
 * becomes (`reportListing` in server/mutations/market.ts), so the words the person picked are the words support
 * reads. Plain data: no server or client imports.
 */
export const LISTING_REPORT_REASONS = [
  { id: "details", label: "Wrong or misleading details" },
  { id: "photos", label: "Photos do not match the place" },
  { id: "not-real", label: "Not a real place or business" },
  { id: "safety", label: "Safety or legal concern" },
  { id: "other", label: "Something else" },
] as const;

export type ListingReportReason = (typeof LISTING_REPORT_REASONS)[number]["id"];

export function listingReportLabel(id: string): string | null {
  return LISTING_REPORT_REASONS.find((r) => r.id === id)?.label ?? null;
}
