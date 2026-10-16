import { screens } from "@injishi/data";
import type {
  CashDenomination,
  CashierShift,
  ExcludedTender,
  FloatRow,
  ShiftTender,
  TillStatus,
} from "@injishi/data/fixtures/finance";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShiftCloseView } from "@/features/finance/ShiftCloseView";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument } from "@/server/data";

export const metadata: Metadata = { title: screens.ShiftClose.pageTitle };

/** The shift being closed: Eric Habimana's evening shift on Till 2. */
const SHIFT_ID = "TS2-1012-E";

export default async function ShiftClosePage() {
  await requirePersona("ShiftClose");
  const [shift, denominations, floatRows, tenders, excluded, tills] = await Promise.all([
    getDocument<CashierShift>("finance.cashierShifts", SHIFT_ID),
    getCollection<CashDenomination>("finance.cashDenominations"),
    getCollection<FloatRow>("finance.floatRows"),
    getCollection<ShiftTender>("finance.shiftTenders"),
    getCollection<ExcludedTender>("finance.excludedTenders"),
    getCollection<TillStatus>("finance.tillStatuses"),
  ]);
  if (!shift) notFound();
  return <ShiftCloseView data={{ shift, denominations, floatRows, tenders, excluded, tills }} />;
}
