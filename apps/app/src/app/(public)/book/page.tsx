import { screens } from "@injishi/data";
import type { GuestProfile, MarketProperty, MarketRoom, Option, PaymentMethod } from "@injishi/data/fixtures/market";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { marketVisitor } from "@/features/market/format";
import { type CheckoutScreen, MarketCheckoutView } from "@/features/market/MarketCheckoutView";
import { requireScreen } from "@/lib/session";
import { getCollection, getDocument } from "@/server/data";
import { type CheckoutDocument, parseStayKey, stayKey } from "@/server/sources/market";

export const metadata: Metadata = { title: screens.MarketCheckout.pageTitle };

interface BookParams {
  state?: string;
  /** The stay chosen on a property page: room type, check-in, check-out, party and plan. */
  room?: string;
  in?: string;
  out?: string;
  adults?: string;
  children?: string;
  plan?: string;
}

/** This checkout's own address with its stay, for coming back after signing in. */
function returnTo(p: BookParams): string {
  const q = new URLSearchParams();
  for (const k of ["state", "room", "in", "out", "adults", "children", "plan"] as const) {
    const v = p[k];
    if (typeof v === "string" && v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `/book?${s}` : "/book";
}

/** The chosen stay's checkout key, or null when the address names no stay (or names one malformed). */
function chosenStay(p: BookParams): string | null {
  if (!p.room && !p.in && !p.out) return null;
  const key = stayKey({
    roomTypeId: p.room ?? "",
    checkIn: p.in ?? "",
    checkOut: p.out ?? "",
    adults: Number(p.adults ?? 2),
    children: Number(p.children ?? 0),
    nonRefundable: p.plan === "saver",
  });
  return parseStayKey(key) ? key : null;
}

/**
 * Public checkout. From a property page it books exactly the stay chosen there (`?room=&in=&out=&adults=&children=
 * &plan=`); with no stay in the address it shows the featured property's default stay, and `?state=request` opens
 * its request draft. Every later state (waiting on the phone, booked, request sent) is reached only by a real press
 * of Pay or Send request, never by the address.
 */
export default async function MarketCheckoutPage({ searchParams }: { searchParams: Promise<BookParams> }) {
  const persona = await requireScreen("MarketCheckout");
  const params = await searchParams;
  const chosen = chosenStay(params);
  if (chosen === null && (params.room || params.in || params.out)) notFound();
  const stay = chosen ?? (params.state === "request" || params.state === "request-sent" ? "request" : "instant");
  const [booking, methods, countries, arrivals, tags, profiles] = await Promise.all([
    getDocument<CheckoutDocument>("market.checkouts", stay),
    getCollection<PaymentMethod>("market.paymentMethods"),
    getCollection<Option>("market.countries"),
    getCollection<Option>("market.arrivalWindows"),
    getCollection<Option>("market.requestTags"),
    getCollection<GuestProfile>("market.guestProfiles"),
  ]);
  if (!booking) notFound();
  const initial: CheckoutScreen = booking.id === "request" ? "request" : "checkout";
  const property = await getDocument<MarketProperty>("market.properties", booking.property);
  if (!property) notFound();
  const rooms = await getCollection<MarketRoom>("market.rooms");
  const room = rooms.find((r) => r.property === property.id && r.name === booking.room);
  return (
    <MarketCheckoutView
      key={stay}
      visitor={marketVisitor(persona, profiles[0])}
      stay={stay}
      returnTo={returnTo(params)}
      booking={booking}
      property={property}
      photo={room?.photo ?? "deluxeLakeViewRoom"}
      // The payment methods are product configuration. The sample's numbers, masks and references are a sample
      // person's, so they never reach the screen: the payer is whatever the person types.
      methods={methods.map((m) => ({ ...m, number: null, mask: "", reference: "" }))}
      countries={countries}
      arrivals={arrivals}
      tags={tags}
      initial={initial}
    />
  );
}
