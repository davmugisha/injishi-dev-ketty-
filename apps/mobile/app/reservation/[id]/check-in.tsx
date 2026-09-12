/**
 * `/reservation/[id]/check-in` — the staffed capture stepper (F-B08, FL09).
 *
 * A pushed card rather than a sheet: it is three steps deep, opens a camera,
 * and is the one flow on this surface a desk can be interrupted in the middle
 * of. See the note in `app/reservation/[id]/index.tsx` about registration.
 */
import { useLocalSearchParams } from 'expo-router';
import { HostCheckInCapture } from '@/screens/host';

export default function CheckInScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HostCheckInCapture id={id} />;
}
