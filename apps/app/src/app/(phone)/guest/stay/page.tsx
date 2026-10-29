import { screens } from "@injishi/data";
import type { GuestStayRecord, HotelInfoRow, LateCheckoutOption, StayShortcut } from "@injishi/data/fixtures/guest";
import { GuestStayView, type LateCheckout } from "@injishi/product-pms/web";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PmsMount } from "@/features/pms/pms-mount";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.GuestStay.pageTitle };

const LATES: LateCheckout[] = ["none", "requested", "approved"];

export default async function GuestStayPage({ searchParams }: { searchParams: Promise<{ late?: string }> }) {
  const persona = await requirePersona("GuestStay");
  const [stays, shortcuts, lateOptions, info] = await Promise.all([
    getCollection<GuestStayRecord>("guest.stays"),
    getCollection<StayShortcut>("guest.stayShortcuts"),
    getCollection<LateCheckoutOption>("guest.lateCheckoutOptions"),
    getCollection<HotelInfoRow>("guest.hotelInfo"),
  ]);
  const stay = stays[0];
  if (!stay || !shortcuts.length) notFound();
  const { late } = await searchParams;
  return (
    <PmsMount>
      <GuestStayView
        persona={persona}
        data={{ stay, shortcuts, lateOptions, info }}
        late={LATES.includes(late as LateCheckout) ? (late as LateCheckout) : "none"}
      />
    </PmsMount>
  );
}
