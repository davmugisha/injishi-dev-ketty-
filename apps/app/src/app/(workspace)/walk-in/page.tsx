import { screens } from "@injishi/data";
import type { RoomType } from "@injishi/data/fixtures/frontdesk";
import type { Metadata } from "next";
import { WalkInView } from "@/features/frontdesk/WalkInView";
import { PmsMount } from "@/features/pms/pms-mount";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.WalkIn.pageTitle };

const clamp = (raw: string | undefined, min: number, max: number) => {
  const n = Number(raw);
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : undefined;
};

/**
 * Walk-in: the room types and what is free tonight, from the desk's day. `?nights=&adults=` come from the
 * quick walk-in panel on Today; without them, one night for two adults (the panel's own defaults). The
 * prototype's sample quote and guest matches are not read: quote holds and guest profiles do not exist yet.
 */
export default async function WalkInPage({
  searchParams,
}: {
  searchParams: Promise<{ nights?: string; adults?: string }>;
}) {
  await requirePersona("WalkIn");
  const roomTypes = await getCollection<RoomType>("frontdesk.roomTypes");
  const { nights, adults } = await searchParams;
  return (
    <PmsMount>
      <WalkInView roomTypes={roomTypes} nights={clamp(nights, 1, 10) ?? 1} adults={clamp(adults, 1, 6) ?? 2} />
    </PmsMount>
  );
}
