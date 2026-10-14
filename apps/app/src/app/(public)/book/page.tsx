import { screens } from "@injishi/data";
import type {
  GuestProfile,
  MarketCheckout,
  MarketProperty,
  MarketRoom,
  Option,
  PaymentMethod,
} from "@injishi/data/fixtures/market";
import { getCollection, getDocument } from "@injishi/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { marketVisitor } from "@/features/market/format";
import { type CheckoutScreen, MarketCheckoutView } from "@/features/market/MarketCheckoutView";
import { requireScreen } from "@/lib/session";

export const metadata: Metadata = { title: screens.MarketCheckout.pageTitle };

const SCREENS = new Set<CheckoutScreen>([
  "checkout",
  "approve-on-phone",
  "payment-unclear",
  "booked",
  "request",
  "request-sent",
]);

/** Public checkout. Each artboard state is `?state=`. */
export default async function MarketCheckoutPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const persona = await requireScreen("MarketCheckout");
  const [checkouts, methods, countries, arrivals, tags, profiles] = await Promise.all([
    getCollection<MarketCheckout>("market.checkouts"),
    getCollection<PaymentMethod>("market.paymentMethods"),
    getCollection<Option>("market.countries"),
    getCollection<Option>("market.arrivalWindows"),
    getCollection<Option>("market.requestTags"),
    getCollection<GuestProfile>("market.guestProfiles"),
  ]);
  const { state } = await searchParams;
  const initial: CheckoutScreen = SCREENS.has(state as CheckoutScreen) ? (state as CheckoutScreen) : "checkout";
  const bookingId = initial === "request" || initial === "request-sent" ? "request" : "instant";
  const booking = checkouts.find((c) => c.id === bookingId) ?? checkouts[0];
  if (!booking) notFound();
  const property = await getDocument<MarketProperty>("market.properties", booking.property);
  if (!property) notFound();
  const rooms = await getCollection<MarketRoom>("market.rooms");
  const room = rooms.find((r) => r.property === property.id && r.name === booking.room);
  return (
    <MarketCheckoutView
      key={initial}
      visitor={marketVisitor(persona, profiles[0])}
      booking={booking}
      property={property}
      photo={room?.photo ?? "deluxeLakeViewRoom"}
      methods={methods}
      countries={countries}
      arrivals={arrivals}
      tags={tags}
      initial={initial}
    />
  );
}
