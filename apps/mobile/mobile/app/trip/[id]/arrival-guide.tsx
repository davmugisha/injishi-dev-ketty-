/**
 * Arrival guide — gated behind check-in (F-B18). The Injishi word is **Arrival
 * guide**, never "check-in instructions" (ui-glossary.md).
 */
import { useLocalSearchParams } from 'expo-router';
import { TripArrivalGuide } from '@/screens/guest/trip-arrival-guide';

export default function ArrivalGuideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TripArrivalGuide id={id} />;
}
