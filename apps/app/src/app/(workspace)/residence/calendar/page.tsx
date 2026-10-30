import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { RentalsCalendarView } from "@/features/rentals/RentalsCalendarView";
import { NoRentalsBusiness } from "@/features/rentals/shared";
import { requirePersona } from "@/lib/session";
import { can, landlordScope, orNull, rentalsMoney } from "@/server/rentals/client";
import { moveOutList } from "@/server/rentals/move-outs";

export const metadata: Metadata = { title: screens.RentalsCalendar.pageTitle };

/** Rent due, paid and overdue, and move-outs, on one calendar. */
export default async function RentalsCalendarPage() {
  await requirePersona("RentalsCalendar");
  const scope = await landlordScope();
  if (!scope) return <NoRentalsBusiness title="Calendar" />;
  const moves = can(scope, "lease.manage", "deposit.return");
  const [money, moveOuts] = await Promise.all([
    orNull(rentalsMoney()),
    moves ? orNull(moveOutList("all")) : Promise.resolve(null),
  ]);
  return (
    <RentalsCalendarView
      today={money?.today ?? new Date().toISOString().slice(0, 10)}
      money={money}
      moveOuts={(moveOuts?.items ?? []).filter((m) => m.endedOn === null)}
    />
  );
}

export const dynamic = "force-dynamic";
