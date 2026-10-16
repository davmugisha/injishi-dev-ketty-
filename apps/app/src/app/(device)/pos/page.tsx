import { screens } from "@injishi/data";
import type {
  LineDraft,
  MenuCategory,
  MenuItem,
  PosPlace,
  RoomChargeTarget,
  TicketLine,
} from "@injishi/data/fixtures/outlets";
import type { Metadata } from "next";
import { PosView } from "@/features/outlets/PosView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.POS.pageTitle };

export default async function PosPage() {
  const persona = await requirePersona("POS");
  const [places, menuItems, categories, lines, drafts, roomCharges] = await Promise.all([
    getCollection<PosPlace>("outlets.places"),
    getCollection<MenuItem>("outlets.menuItems"),
    getCollection<MenuCategory>("outlets.menuCategories"),
    getCollection<TicketLine>("outlets.ticketLines"),
    getCollection<LineDraft>("outlets.lineDrafts"),
    getCollection<RoomChargeTarget>("outlets.roomCharges"),
  ]);
  return (
    <PosView
      persona={persona}
      data={{
        places,
        menuItems,
        categories: categories.filter((c) => c.menu === "dinner"),
        lines,
        draft: drafts[0] ?? null,
        roomCharges,
      }}
    />
  );
}
