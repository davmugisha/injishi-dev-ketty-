import { kigaliToday } from "@injishi/contracts";
import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantCalendarView } from "@/features/tenant/TenantCalendarView";
import { requirePersona } from "@/lib/session";
import { tenancyMoveOut } from "@/server/tenant/move-out";
import {
  isLeaseId,
  mineOrNull,
  tenancyCharges,
  tenancyDetail,
  tenancyPayments,
  tenantGuests,
} from "@/server/tenant/tenancies";

export const metadata: Metadata = { title: screens.TenantCalendar.pageTitle };

/** Rent days, payments, the move-out day and guests' stays on one calendar. */
export default async function TenancyCalendarPage({ params }: { params: Promise<{ leaseId: string }> }) {
  await requirePersona("TenantCalendar");
  const { leaseId } = await params;
  if (!isLeaseId(leaseId)) notFound();
  const [tenancy, charges, payments, moveOut, guests] = await Promise.all([
    mineOrNull(tenancyDetail(leaseId)),
    mineOrNull(tenancyCharges(leaseId)),
    mineOrNull(tenancyPayments(leaseId)),
    mineOrNull(tenancyMoveOut(leaseId)).catch(() => null),
    mineOrNull(tenantGuests(leaseId)).catch(() => null),
  ]);
  if (!tenancy) notFound();
  return (
    <TenantCalendarView
      tenancy={tenancy}
      charges={charges?.charges ?? []}
      payments={payments?.payments ?? []}
      moveOut={moveOut}
      guests={guests?.guests ?? []}
      today={kigaliToday()}
    />
  );
}

export const dynamic = "force-dynamic";
