import type { Metadata } from "next";
import { loadPosPage, readOrBlock } from "@/features/pos/load";
import { PosBlocked } from "@/features/pos/pos-blocked";
import { POS_BOARDS } from "@/features/pos/pos-boards";
import { PosFloorView } from "@/features/pos/pos-floor-view";
import { posFloor, posOrders, posTableQr } from "@/server/pos";

export const metadata: Metadata = { title: POS_BOARDS.PosFloor.pageTitle };

/** The live floor: tables, sessions and open orders of one outlet, from the API. */
export default async function PosFloorPage({ searchParams }: { searchParams: Promise<{ outlet?: string }> }) {
  const { outlet: outletParam } = await searchParams;
  const page = await loadPosPage("PosFloor", outletParam);
  if (!page.ok) return <PosBlocked title={page.title} message={page.message} firstOutlet={page.firstOutlet} />;
  const read = await readOrBlock(() =>
    Promise.all([
      posFloor(page.ctx, page.outlet.id),
      posOrders(page.ctx, { outletId: page.outlet.id, status: "open", limit: 200 }),
      // The guest-ordering code of each table, for its QR card. Without it the cards keep the staff link.
      posTableQr(page.ctx, page.outlet.id).catch(() => []),
      // READ ONLY: the latest closed bills, so a table's paid bills stay in its panel while the guests are seated
      // (for the receipt). Nothing is taken, settled or released here.
      posOrders(page.ctx, { outletId: page.outlet.id, status: "completed", limit: 200 }).catch(() => []),
    ]),
  );
  if (!read.ok) return <PosBlocked title={read.title} message={read.message} />;
  const [floor, orders, codes, completed] = read.value;
  const qrCodes = Object.fromEntries(codes.map((c) => [c.tableId, c.code]));
  const seated = new Set(floor.tables.map((t) => t.sessionId).filter((s): s is string => !!s));
  const paidBills = completed.filter((o) => o.tableSessionId && seated.has(o.tableSessionId));
  return (
    <PosFloorView
      outlets={page.outlets}
      outlet={page.outlet}
      floor={floor}
      orders={orders}
      paidBills={paidBills}
      can={page.can}
      qrCodes={qrCodes}
    />
  );
}
