/**
 * `/reservations` — the Host bookings tab.
 *
 * The Injishi word is **Booking**, never Reservation (ui-glossary.md). The
 * ROUTE keeps the industry word because the operator app already addresses it
 * that way and Session 0 registered the tab under it; every LABEL says Booking.
 */
import { HostBookingsScreen } from '@/screens/host';

export default function ReservationsScreen() {
  return <HostBookingsScreen />;
}
