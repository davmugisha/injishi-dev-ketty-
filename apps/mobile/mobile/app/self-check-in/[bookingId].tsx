/**
 * Self check-in — the capture flow (F-B09). On the BOOKING id, not a stay id: a
 * stay does not exist until someone arrives, which is the rule the API's
 * `ops/stays/:id/checkin` already follows.
 */
import { useLocalSearchParams } from 'expo-router';
import { TripCheckIn } from '@/screens/guest/trip-check-in';

export default function SelfCheckInScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  return <TripCheckIn bookingId={bookingId} />;
}
