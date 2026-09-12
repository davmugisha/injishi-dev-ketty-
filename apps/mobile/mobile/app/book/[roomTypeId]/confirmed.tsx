/**
 * Booking confirmed. Guest canvas artboard 8, FL07 §8.
 *
 * `bookingId` is the reference the stepper minted and wrote to the trips store.
 * The screen reads the Trip back by it rather than being handed one, so this
 * route is a real destination: it survives a reload and "View trip" opens the
 * same record the Trips tab lists.
 */
import { useLocalSearchParams } from 'expo-router';
import { BookConfirmedScreen } from '@/screens/guest/book-confirmed';

export default function BookConfirmedRoute() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  return <BookConfirmedScreen bookingId={bookingId} />;
}
