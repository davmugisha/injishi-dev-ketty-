import { AppShell } from "@/pms/components/app-shell";
import { ReservationRecord } from "@/pms/screens/reservation";

/**
 * Reservation · the payment lens.
 *
 * A lens is a ROUTE SEGMENT, not a query param (ADR-018, D-c). That is what
 * makes it something one member of staff can send another. A lens this record
 * does not carry has no route here, so a typed URL to one is a 404, the same
 * answer an unheld id gets (D-n).
 */
export default async function Page({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const { reservationId: id } = await params;
  return (
    <AppShell title="Reservation">
      <ReservationRecord id={id} lens="payment" />
    </AppShell>
  );
}
