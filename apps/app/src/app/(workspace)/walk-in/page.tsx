import { screens } from "@injishi/data";
import type { GuestMatch, RoomType, WalkInQuote } from "@injishi/data/fixtures/frontdesk";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WalkInView } from "@/features/frontdesk/WalkInView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.WalkIn.pageTitle };

const clamp = (raw: string | undefined, min: number, max: number) => {
  const n = Number(raw);
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : undefined;
};

/** Walk-in quote. `?nights=&adults=` come from the quick walk-in panel on Today. */
export default async function WalkInPage({
  searchParams,
}: {
  searchParams: Promise<{ nights?: string; adults?: string }>;
}) {
  await requirePersona("WalkIn");
  const [roomTypes, matches, quotes] = await Promise.all([
    getCollection<RoomType>("frontdesk.roomTypes"),
    getCollection<GuestMatch>("frontdesk.guestMatches"),
    getCollection<WalkInQuote>("frontdesk.walkInQuotes"),
  ]);
  const quote = quotes[0];
  if (!quote) notFound();
  const { nights, adults } = await searchParams;
  return (
    <WalkInView
      roomTypes={roomTypes}
      matches={matches}
      quote={quote}
      nights={clamp(nights, 1, 10) ?? quote.nights}
      adults={clamp(adults, 1, 6) ?? quote.adults}
    />
  );
}
