/**
 * Trip detail — a Guest booking (Hospitality demand). Stay, dates, price,
 * the host, how to get there, and the arrival guide.
 *
 * Invariant, and it lives in the data rather than here: arrival details (wifi,
 * access code, directions) are gated behind check-in by `arrivalGuideFor` and
 * never render for a booking that is only confirmed (F-B18). Bookings emit an
 * EBM invoice, unlike leases, which never do.
 */
import { useLocalSearchParams } from 'expo-router';
import { TripDetail } from '@/screens/guest/trip-detail';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TripDetail id={id} />;
}
