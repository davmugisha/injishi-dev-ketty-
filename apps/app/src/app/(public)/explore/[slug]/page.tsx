import type {
  GuestProfile,
  MarketProperty,
  MarketReview,
  MarketRoom,
  ReportReason,
} from "@injishi/data/fixtures/market";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { marketVisitor } from "@/features/market/format";
import { MarketPropertyView, type PropertyPanel } from "@/features/market/MarketPropertyView";
import { requireScreen } from "@/lib/session";
import { getCollection, getDocument } from "@/server/data";

/**
 * The tab title names THIS property, from the same live document the page draws; it was the prototype's
 * "Marketplace · Isangano Lakeside Hotel" on every property. An unknown or unreadable property is "Marketplace".
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const property = await getDocument<MarketProperty>("market.properties", decodeURIComponent(slug)).catch(() => null);
  return { title: property?.name ? `Marketplace · ${property.name}` : "Marketplace" };
}

const PANELS = new Set<PropertyPanel>(["none", "dates", "guests"]);

/** Public property page. Dates and guests open from `?panel=`. */
export default async function MarketPropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ panel?: string }>;
}) {
  const persona = await requireScreen("MarketProperty");
  const { slug } = await params;
  const [property, rooms, reviews, reasons, profiles] = await Promise.all([
    getDocument<MarketProperty>("market.properties", decodeURIComponent(slug)),
    getCollection<MarketRoom>("market.rooms"),
    getCollection<MarketReview>("market.reviews"),
    getCollection<ReportReason>("market.reportReasons"),
    getCollection<GuestProfile>("market.guestProfiles"),
  ]);
  if (!property) notFound();
  const { panel } = await searchParams;
  const initialPanel: PropertyPanel = PANELS.has(panel as PropertyPanel) ? (panel as PropertyPanel) : "none";
  return (
    <MarketPropertyView
      key={initialPanel}
      visitor={marketVisitor(persona, profiles[0])}
      property={property}
      rooms={rooms.filter((r) => r.property === property.id)}
      reviews={reviews.filter((r) => r.property === property.id)}
      reasons={reasons}
      initialPanel={initialPanel}
    />
  );
}
